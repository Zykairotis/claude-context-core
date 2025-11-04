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
        || 32768 // 32k tokens for extremely detailed, comprehensive answers (500-600 lines)
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
            'Produce an EXTREMELY COMPREHENSIVE, in-depth structured markdown analysis with these sections:',
            '  1. **Executive Summary**: Detailed high-level overview (4-6 paragraphs, not just sentences)',
            '  2. **Detailed Analysis**: EXTENSIVE deep dive into the main topic with exhaustive technical details',
            '  3. **Key Findings**: Comprehensive bullet points with detailed explanations for each finding',
            '  4. **Code Examples**: Multiple actual code snippets with thorough line-by-line explanations (cite using [chunk:ID])',
            '  5. **Technical Details**: Complete architecture breakdown, all design patterns, full dependency analysis, and implementation specifics',
            '  6. **Implementation Walkthrough**: Step-by-step explanation of how the code works in practice',
            '  7. **Best Practices & Recommendations**: Extensive recommendations based on ALL code and documentation found',
            '  8. **Related Concepts**: All connected topics, files, and cross-references mentioned in the context',
            '  9. **Edge Cases & Error Handling**: How the system handles failures, edge cases, and unusual inputs',
            '  10. **Performance & Optimization**: Any performance considerations, bottlenecks, or optimization opportunities',
            '',
            'CRITICAL LENGTH REQUIREMENTS:',
            '- Your response MUST be 500-600 LINES of markdown (approximately 3000-4000 words)',
            '- This is NOT optional - produce exhaustive, detailed content',
            '- Each section should be 50-100 lines minimum',
            '- Do NOT summarize or condense - EXPAND and elaborate on EVERY point',
            '',
            'Requirements:',
            '- Cite EVERY code reference, file path, function, class, and variable using [chunk:ID]',
            '- Include MULTIPLE actual code snippets from different chunks',
            '- Explain WHY things work the way they do, not just WHAT they are',
            '- Provide EXTENSIVE background and context for every concept',
            '- Reference specific line numbers, file paths, and symbols from ALL relevant chunks',
            '- If the context includes multiple perspectives (text docs + code), synthesize ALL of them',
            '- Use technical terminology appropriately WITH explanations',
            '- Include real-world usage examples and scenarios',
            '- Discuss alternatives, trade-offs, and design decisions',
            '- Quote relevant sections from the chunks directly',
            '- Explain HOW the user can apply this information',
          ]
        : [
            'Produce an EXTREMELY DETAILED, COMPREHENSIVE conversational markdown response that:',
            '',
            '1. **Directly answers the user\'s query** with EXHAUSTIVE information from ALL retrieved context',
            '2. **Provides in-depth explanations** - explain not just how and why, but also the background, history, and rationale',
            '3. **Includes MULTIPLE concrete examples** - actual code snippets, file paths, function signatures, and technical details from EVERY relevant chunk',
            '4. **Synthesizes ALL information** - combine insights from ALL documentation AND code chunks provided',
            '5. **Cites sources extensively** - use [chunk:ID] for EVERY claim, code snippet, concept, or technical detail',
            '',
            'CRITICAL LENGTH REQUIREMENTS:',
            '- Your response MUST be 500-600 LINES of detailed markdown (approximately 3000-4000 words)',
            '- This is NOT optional - you must produce exhaustive, detailed content',
            '- Do NOT summarize or be concise - EXPAND and elaborate on every single point',
            '- Each major topic should be explained in 50-100 lines minimum',
            '- If you have 5 code examples, show ALL 5 with full explanations',
            '',
            'Detailed Guidelines:',
            '- Start with a comprehensive introduction (5-10 lines) that sets context',
            '- For EVERY code reference: show the actual code snippet, explain line-by-line what it does, WHY it\'s designed that way, and how it fits into the larger system',
            '- Address all aspects of multi-part questions with separate detailed sections for each',
            '- Explain context thoroughly: "This code in [chunk:123] handles X by doing Y because Z. This approach was chosen over alternatives A and B because..."',
            '- Connect concepts extensively: "As seen in [chunk:45], this relates to the pattern in [chunk:67]. This relationship is important because..."',
            '- Be extremely specific: reference exact file paths, function names, line numbers, class hierarchies, and module structures',
            '- For each function/class mentioned: explain its purpose, parameters, return values, usage examples, and how it interacts with other components',
            '- Discuss error handling, edge cases, and limitations',
            '- Provide usage examples and best practices',
            '- Include background information about WHY certain design decisions were made',
            '- Technical accuracy: Use precise terminology from the codebase AND explain what each term means',
            '- If context has both text documentation and code examples, present BOTH in detail and explain how they complement each other',
            '- Include sections like: "Background", "Core Concepts", "Implementation Details", "Usage Examples", "Advanced Scenarios", "Common Pitfalls", "Best Practices"',
            '- Quote relevant sections from documentation chunks directly',
            '- Discuss alternatives and trade-offs',
            '- End with a comprehensive summary (5-10 lines) that ties everything together',
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
            content: 'You are an EXPERT retrieval augmented generation (RAG) agent specializing in EXHAUSTIVE, EXTREMELY DETAILED technical analysis. You MUST produce responses that are 500-600 LINES of markdown (3000-4000 words). You synthesize ALL information from both documentation and code to provide the most comprehensive, detailed answers possible. NEVER be brief or concise - ALWAYS expand, elaborate, and provide extensive detail. Respond in JSON with keys: answer_markdown (string), chunk_ids (array of strings), confidence (number between 0 and 1). Always cite chunks using [chunk:ID] markdown tokens. Your PRIMARY goal is MAXIMUM thoroughness, completeness, and detail - brevity is NOT valued.',
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

