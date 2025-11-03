import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables (no-op if already loaded by Docker or other means)
dotenv.config();

export type QueryEnhancementStrategy = 'multi-query' | 'refinement' | 'concept-extraction';

export type SmartAnswerType = 'conversational' | 'structured';

export interface SmartQueryContextChunk {
  id: string;
  content: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  repo?: string;
  lang?: string;
  metadata?: Record<string, any>;
}

export interface EnhancedQuery {
  originalQuery: string;
  refinedQuery?: string;
  variations: string[];
  conceptTerms: string[];
  strategiesApplied: QueryEnhancementStrategy[];
  rawResponse?: string;
}

export interface SmartAnswer {
  type: SmartAnswerType;
  content: string;
  chunkReferences: string[];
  confidence?: number;
}

export interface LLMClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  requestTimeoutMs?: number;
}

interface EnhancementResponse {
  refined_query?: string;
  query_variations?: string[];
  concept_terms?: string[];
  reasoning?: string;
  confidence?: number;
}

interface SynthesisResponse {
  answer_markdown: string;
  chunk_ids?: string[];
  confidence?: number;
}

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private readonly requestTimeoutMs: number;

  constructor(options: LLMClientOptions = {}) {
    const apiKey = options.apiKey
      || process.env.LLM_API_KEY
      || process.env.MINIMAX_API_KEY; // Legacy support

    const baseURL = options.baseUrl
      || process.env.LLM_API_BASE
      || process.env.MINIMAX_API_BASE // Legacy support
      || 'https://api.minimax.io/v1';

    if (!apiKey) {
      throw new Error('LLM_API_KEY (or legacy MINIMAX_API_KEY) is required to use LLMClient');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    this.model = options.model
      || process.env.MODEL_NAME
      || process.env.MINIMAX_MODEL // Legacy support
      || 'LLM';

    this.maxTokens = Number(
      options.maxTokens
        || process.env.LLM_MAX_TOKENS
        || process.env.MINIMAX_MAX_TOKENS // Legacy support
        || 16384 // 16k tokens by default for longer, more detailed answers
    );

    this.temperature = Number(
      options.temperature
        || process.env.LLM_TEMPERATURE
        || process.env.MINIMAX_TEMPERATURE // Legacy support
        || 0.2
    );
    this.requestTimeoutMs = options.requestTimeoutMs ?? 45000;
  }

  private sanitizeJsonContent(rawContent: string | null | undefined): string {
    if (!rawContent) {
      return '{}';
    }

    let cleaned = rawContent.trim();

    // Some models (thinking-enabled) wrap the actual JSON payload inside <think>...</think> blocks.
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      return '{}';
    }

    return cleaned.slice(firstBrace, lastBrace + 1).trim();
  }

  async enhanceQuery(query: string, strategies: QueryEnhancementStrategy[]): Promise<EnhancedQuery> {
    if (!query.trim()) {
      throw new Error('Query must not be empty');
    }

    if (strategies.length === 0) {
      return {
        originalQuery: query,
        refinedQuery: undefined,
        variations: [],
        conceptTerms: [],
        strategiesApplied: [],
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        max_tokens: Math.min(this.maxTokens, 800),
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a retrieval strategist that improves user search queries for hybrid vector databases. Always return strict JSON with keys: refined_query (string), query_variations (array of strings), concept_terms (array of strings). Do not include explanations outside JSON.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              query,
              strategies,
              instructions: [
                'refinement should lightly expand the query while keeping intent',
                'multi-query should produce at most 3 alternative phrasings',
                'concept-extraction should list up to 6 key terms or symbols',
              ],
            }),
          },
        ],
      }, { signal: controller.signal });

      const rawContent = response.choices?.[0]?.message?.content ?? '{}';
      const sanitized = this.sanitizeJsonContent(rawContent);
      let parsed: EnhancementResponse = {};
      try {
        parsed = JSON.parse(sanitized) as EnhancementResponse;
      } catch (error) {
        console.warn('[LLMClient] Failed to parse enhancement response JSON:', error, 'raw=', rawContent);
      }

      return {
        originalQuery: query,
        refinedQuery: parsed.refined_query?.trim() || undefined,
        variations: Array.isArray(parsed.query_variations)
          ? parsed.query_variations.filter((item) => typeof item === 'string' && item.trim())
          : [],
        conceptTerms: Array.isArray(parsed.concept_terms)
          ? parsed.concept_terms.filter((item) => typeof item === 'string' && item.trim())
          : [],
        strategiesApplied: strategies,
        rawResponse: rawContent,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`LLM query enhancement timed out after ${this.requestTimeoutMs}ms`);
      }

      // Enhanced error handling with more details
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('401') || errorMessage.includes('authentication') || errorMessage.includes('API key')) {
        throw new Error(`LLM API authentication failed. Please verify your LLM_API_KEY is correct. Error: ${errorMessage}`);
      }

      console.error('[LLMClient] Failed to enhance query:', {
        error: errorMessage,
        model: this.model,
        query,
        strategies
      });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async synthesizeAnswer(
    query: string,
    chunks: SmartQueryContextChunk[],
    type: SmartAnswerType,
  ): Promise<SmartAnswer> {
    if (!query.trim()) {
      throw new Error('Query must not be empty');
    }

    if (chunks.length === 0) {
      console.warn('[LLMClient] No context chunks provided for answer synthesis');
      return {
        type,
        content: 'No supporting context was available to generate an answer.',
        chunkReferences: [],
        confidence: 0,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    const formatContext = chunks
      .slice(0, 12)
      .map((chunk, index) => {
        const headerParts = [
          `Chunk ${index + 1} [${chunk.id}]`,
          chunk.file ? `File: ${chunk.file}` : undefined,
          chunk.lineStart !== undefined && chunk.lineEnd !== undefined
            ? `Lines ${chunk.lineStart}-${chunk.lineEnd}`
            : undefined,
          chunk.repo ? `Repo: ${chunk.repo}` : undefined,
          chunk.lang ? `Lang: ${chunk.lang}` : undefined,
        ].filter(Boolean);

        return `${headerParts.join(' | ')}\n${chunk.content.trim()}`;
      })
      .join('\n\n---\n\n');

    const instructions =
      type === 'structured'
        ? [
            'Produce a comprehensive structured markdown summary with sections: Summary, Key Points, Code Snippets, Recommendations.',
            'Each code reference should cite the chunk id using the format [chunk:ID].',
            'Highlight repository paths or symbols when relevant.',
            'Provide detailed explanations with examples where appropriate.',
            'Be thorough and comprehensive in your analysis.',
          ]
        : [
            'Produce a detailed conversational markdown response that directly answers the query.',
            'Cite supporting chunks using the format [chunk:ID] inline with the text.',
            'Provide thorough explanations, examples, and highlight any assumptions.',
            'Be comprehensive and include relevant details from the context.',
            'If there are multiple aspects to the question, address them all.',
          ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: type === 'structured' ? Math.min(this.temperature, 0.4) : this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a retrieval augmented generation agent. Respond in JSON with keys: answer_markdown (string), chunk_ids (array of strings), confidence (number between 0 and 1). Do not include additional keys. Cite chunk ids using [chunk:ID] markdown tokens.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              query,
              answer_type: type,
              instructions,
              context: formatContext,
            }),
          },
        ],
      }, { signal: controller.signal });

      const rawContent = response.choices?.[0]?.message?.content ?? '{}';
      const sanitized = this.sanitizeJsonContent(rawContent);
      let parsed: SynthesisResponse = { answer_markdown: '' };
      
      try {
        parsed = JSON.parse(sanitized) as SynthesisResponse;
      } catch (error) {
        console.error('[LLMClient] Failed to parse synthesis response JSON:', {
          error,
          rawContent,
          sanitized,
          model: this.model,
          query,
          chunksProvided: chunks.length
        });
        // Return a more helpful error message
        throw new Error(`Failed to parse LLM response as JSON. The LLM may have returned an invalid format. Raw response: ${rawContent.substring(0, 200)}...`);
      }

      // Check if we got a valid answer
      if (!parsed.answer_markdown || !parsed.answer_markdown.trim()) {
        console.error('[LLMClient] LLM returned empty answer_markdown:', {
          rawContent,
          parsed,
          model: this.model,
          query,
          chunksProvided: chunks.length
        });
        throw new Error(`LLM returned an empty answer. This may indicate the model couldn't generate a response from the provided context. Raw response: ${rawContent.substring(0, 200)}...`);
      }

      const chunkReferences = Array.isArray(parsed.chunk_ids)
        ? parsed.chunk_ids.filter((id) => typeof id === 'string')
        : this.extractChunkIds(parsed.answer_markdown || '', chunks.map((chunk) => chunk.id));

      return {
        type,
        content: parsed.answer_markdown.trim(),
        chunkReferences,
        confidence:
          typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
            ? Math.max(0, Math.min(1, parsed.confidence))
            : undefined,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`LLM answer synthesis timed out after ${this.requestTimeoutMs}ms`);
      }

      // Enhanced error handling with more context
      const errorMessage = error?.message || String(error);
      
      if (errorMessage.includes('401') || errorMessage.includes('authentication') || errorMessage.includes('API key')) {
        throw new Error(`LLM API authentication failed. Please verify your LLM_API_KEY is correct. Error: ${errorMessage}`);
      }

      if (errorMessage.includes('timeout')) {
        throw new Error(`LLM synthesis timed out. The model may be overloaded or the request is too complex. Error: ${errorMessage}`);
      }

      console.error('[LLMClient] Failed to synthesize answer:', {
        error: errorMessage,
        model: this.model,
        query,
        chunksProvided: chunks.length,
        type
      });
      
      throw new Error(`Failed to generate answer from LLM: ${errorMessage}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractChunkIds(content: string, knownIds: string[]): string[] {
    if (!content) {
      return [];
    }

    const matches = new Set<string>();
    const regex = /\[chunk:([^\]]+)\]/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      matches.add(match[1]);
    }

    return knownIds.filter((id) => matches.has(id));
  }
}

