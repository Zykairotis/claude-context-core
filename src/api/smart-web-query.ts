import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { Context } from '../context';
import type { WebQueryRequest, WebQueryResult, WebQueryResponse } from './query';
import { queryWebContent } from './query';
import {
  LLMClient,
  QueryEnhancementStrategy,
  SmartAnswer,
  SmartAnswerType,
  SmartQueryContextChunk,
  EnhancedQuery,
} from '../utils/llm-client';

/**
 * Smart query request for web content with LLM enhancement
 */
export interface SmartWebQueryRequest extends WebQueryRequest {
  strategies: QueryEnhancementStrategy[];
  answerType: SmartAnswerType;
  includeOriginalAnswer?: boolean;
  maxContextChunks?: number;
}

export interface WebQueryRunMetadata {
  query: string;
  strategy: string;
  resultCount: number;
  requestId: string;
  metadata?: WebQueryResponse['metadata'];
}

export interface SmartWebQueryMetadata {
  enhancedQuery: EnhancedQuery;
  queryRuns: WebQueryRunMetadata[];
  strategiesUsed: QueryEnhancementStrategy[];
  queryVariations: string[];
  timingMs: {
    enhancement: number;
    retrieval: number;
    synthesis: number;
    total: number;
  };
  tokensUsed?: number;
  totalRetrievals: number;
}

export interface SmartWebQueryResponse {
  requestId: string;
  answer: SmartAnswer;
  retrievals: WebQueryResult[];
  metadata: SmartWebQueryMetadata;
}

interface AggregatedWebResult {
  result: WebQueryResult;
  score: number;
  sourceQueries: Set<string>;
}

const MAX_CONTEXT_CHUNKS = 12;

/**
 * Smart query for web content with LLM-powered query enhancement
 * Combines multi-query expansion, refinement, and answer synthesis
 */
export async function smartQueryWebContent(
  context: Context,
  request: SmartWebQueryRequest,
  onProgress?: (phase: string, percentage: number, detail: string) => void
): Promise<SmartWebQueryResponse> {
  const requestId = crypto.randomUUID();
  const startTime = performance.now();

  const {
    strategies,
    answerType,
    includeOriginalAnswer,
    query,
    maxContextChunks = MAX_CONTEXT_CHUNKS,
    ...baseRequest
  } = request;

  onProgress?.('smart-web-query', 5, 'Enhancing query with LLM');

  // Phase 1: Query Enhancement
  const llmStart = performance.now();
  const llmClient = new LLMClient();
  const enhancedQuery = await llmClient.enhanceQuery(query, strategies);
  const enhancementDuration = performance.now() - llmStart;

  // Phase 2: Build query variations
  const queriesToRun: Array<{ query: string; strategy: string }> = [];
  const seen = new Set<string>();

  const addQuery = (value: string, strategyLabel: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) {
      return;
    }
    seen.add(trimmed.toLowerCase());
    queriesToRun.push({ query: trimmed, strategy: strategyLabel });
  };

  // Add original query
  addQuery(query, 'original');

  // Add refined query
  if (enhancedQuery.refinedQuery && enhancedQuery.refinedQuery !== query) {
    addQuery(enhancedQuery.refinedQuery, 'refinement');
  }

  // Add query variations
  if (enhancedQuery.variations && enhancedQuery.variations.length > 0) {
    for (const variation of enhancedQuery.variations.slice(0, 3)) {
      addQuery(variation, 'expansion');
    }
  }

  // Add concept-based queries
  if (enhancedQuery.conceptTerms && enhancedQuery.conceptTerms.length > 0) {
    for (const concept of enhancedQuery.conceptTerms.slice(0, 2)) {
      addQuery(`${query} ${concept}`, 'concept');
    }
  }

  onProgress?.('smart-web-query', 15, `Running ${queriesToRun.length} query variations`);

  // Phase 3: Execute all queries in parallel
  const retrievalStart = performance.now();
  const queryRuns: WebQueryRunMetadata[] = [];
  const allResults = new Map<string, AggregatedWebResult>();

  const queryPromises = queriesToRun.map(async ({ query: q, strategy }) => {
    try {
      const response = await queryWebContent(context, {
        ...baseRequest,
        query: q,
        topK: 10
      });

      queryRuns.push({
        query: q,
        strategy,
        resultCount: response.results.length,
        requestId: response.requestId,
        metadata: response.metadata
      });

      // Aggregate results
      for (const result of response.results) {
        const key = result.id;
        const existing = allResults.get(key);

        if (existing) {
          // Boost score for results from multiple queries
          existing.score = Math.max(existing.score, result.scores.final);
          existing.sourceQueries.add(q);
        } else {
          allResults.set(key, {
            result,
            score: result.scores.final,
            sourceQueries: new Set([q])
          });
        }
      }

      return response;
    } catch (error) {
      console.warn(`[smartQueryWebContent] Query failed: ${q}`, error);
      return null;
    }
  });

  await Promise.all(queryPromises);
  const retrievalDuration = performance.now() - retrievalStart;

  onProgress?.('smart-web-query', 60, 'Aggregating results');

  // Phase 4: Rank and deduplicate results
  const sortedResults = Array.from(allResults.values())
    .sort((a, b) => {
      // Prioritize results from multiple queries
      const queryCountDiff = b.sourceQueries.size - a.sourceQueries.size;
      if (queryCountDiff !== 0) return queryCountDiff;

      // Then by score
      return b.score - a.score;
    })
    .slice(0, maxContextChunks)
    .map(agg => agg.result);

  onProgress?.('smart-web-query', 75, 'Synthesizing answer with LLM');

  // Phase 5: Answer synthesis
  const synthesisStart = performance.now();
  const contextChunks: SmartQueryContextChunk[] = sortedResults.map((result, idx) => ({
    id: result.id,
    content: result.chunk,
    file: result.url,
    metadata: {
      url: result.url,
      title: result.title,
      domain: result.domain,
      score: result.scores.final,
      ...result.metadata
    }
  }));

  const answer = await llmClient.synthesizeAnswer(
    query,
    contextChunks,
    answerType
  );

  const synthesisDuration = performance.now() - synthesisStart;
  const totalDuration = performance.now() - startTime;

  onProgress?.('smart-web-query', 100, 'Complete');

  return {
    requestId,
    answer,
    retrievals: sortedResults,
    metadata: {
      enhancedQuery,
      queryRuns,
      strategiesUsed: strategies,
      queryVariations: queriesToRun.map(q => q.query),
      timingMs: {
        enhancement: Math.round(enhancementDuration),
        retrieval: Math.round(retrievalDuration),
        synthesis: Math.round(synthesisDuration),
        total: Math.round(totalDuration)
      },
      totalRetrievals: sortedResults.length
    }
  };
}

/**
 * Extract key terms from web query results for concept mapping
 */
export function extractKeyTerms(results: WebQueryResult[]): string[] {
  const combinedText = results
    .slice(0, 5)
    .map(r => r.chunk)
    .join(' ');

  // Simple keyword extraction: find capitalized terms and technical keywords
  const words = combinedText.split(/\s+/);
  const keyTerms = new Set<string>();

  for (const word of words) {
    const cleaned = word.replace(/[^a-zA-Z0-9]/g, '');
    if (cleaned.length < 3) continue;
    
    // Capitalized words (likely proper nouns/concepts)
    if (/^[A-Z][a-z]+/.test(cleaned)) {
      keyTerms.add(cleaned);
    }
    
    // Technical terms (CamelCase, snake_case, etc.)
    if (/[A-Z]{2,}|_/.test(cleaned)) {
      keyTerms.add(cleaned);
    }
  }

  return Array.from(keyTerms).slice(0, 10);
}
