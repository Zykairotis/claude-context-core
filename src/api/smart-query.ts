import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { Context } from '../context';
import type { ProjectQueryRequest, ProjectQueryResult, ProjectQueryResponse } from './query';
import { queryProject } from './query';
import {
  LLMClient,
  QueryEnhancementStrategy,
  SmartAnswer,
  SmartAnswerType,
  SmartQueryContextChunk,
  EnhancedQuery,
} from '../utils/llm-client';

export interface SmartQueryRequest extends ProjectQueryRequest {
  strategies: QueryEnhancementStrategy[];
  answerType: SmartAnswerType;
  includeOriginalAnswer?: boolean;
}

export interface QueryRunMetadata {
  query: string;
  strategy: string;
  resultCount: number;
  requestId: string;
  metadata?: ProjectQueryResponse['metadata'];
}

export interface SmartQueryMetadata {
  enhancedQuery: EnhancedQuery;
  queryRuns: QueryRunMetadata[];
  strategiesUsed: QueryEnhancementStrategy[];
  strategies?: QueryEnhancementStrategy[];
  queryVariations: string[];
  timingMs: {
    enhancement: number;
    retrieval: number;
    synthesis: number;
    total: number;
  };
  tokensUsed?: number;
  totalRetrievals?: number;
}

export interface SmartQueryResponse {
  requestId: string;
  answer: SmartAnswer;
  retrievals: ProjectQueryResult[];
  metadata: SmartQueryMetadata;
}

interface AggregatedResult {
  result: ProjectQueryResult;
  score: number;
  sourceQueries: Set<string>;
}

const MAX_CONTEXT_CHUNKS = 12;

export async function smartQueryProject(
  context: Context,
  request: SmartQueryRequest,
  onProgress?: (phase: string, percentage: number, detail: string) => void,
): Promise<SmartQueryResponse> {
  const requestId = crypto.randomUUID();
  const startTime = performance.now();

  const {
    strategies,
    answerType,
    includeOriginalAnswer,
    query,
    ...baseRequest
  } = request;

  onProgress?.('smart-query', 5, 'Enhancing query with LLM');

  const llmStart = performance.now();
  const llmClient = new LLMClient();
  const enhancedQuery = await llmClient.enhanceQuery(query, strategies);
  const enhancementDuration = performance.now() - llmStart;

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

  addQuery(query, 'original');

  if (enhancedQuery.refinedQuery && enhancedQuery.refinedQuery !== query) {
    addQuery(enhancedQuery.refinedQuery, 'refinement');
  }

  if (enhancedQuery.variations.length > 0) {
    enhancedQuery.variations.slice(0, 3).forEach((variant, index) => {
      addQuery(variant, `multi-query-${index + 1}`);
    });
  }

  if (enhancedQuery.conceptTerms.length > 0) {
    const conceptBag = enhancedQuery.conceptTerms.slice(0, 6).join(' ');
    if (conceptBag) {
      addQuery(`${query} ${conceptBag}`, 'concept-extraction');
      addQuery(conceptBag, 'concept-bag');
    }
  }

  onProgress?.('smart-query', 20, `Executing ${queriesToRun.length} retrieval run(s)`);

  const aggregatedResults = new Map<string, AggregatedResult>();
  const queryRuns: QueryRunMetadata[] = [];
  const retrievalStart = performance.now();

  let runIndex = 0;
  for (const { query: variant, strategy: strategyLabel } of queriesToRun) {
    runIndex += 1;
    onProgress?.('smart-query', 20 + Math.round((runIndex / queriesToRun.length) * 50), `Retrieving results for strategy ${strategyLabel}`);

    const variantResponse = await queryProject(context, { ...baseRequest, query: variant }, undefined);

    queryRuns.push({
      query: variant,
      strategy: strategyLabel,
      resultCount: variantResponse.results.length,
      requestId: variantResponse.requestId,
      metadata: variantResponse.metadata,
    });

    variantResponse.results.forEach((result) => {
      const existing = aggregatedResults.get(result.id);
      const finalScore = result.scores?.final ?? result.scores?.vector ?? 0;

      if (!existing || finalScore > existing.score) {
        aggregatedResults.set(result.id, {
          result,
          score: finalScore,
          sourceQueries: existing?.sourceQueries || new Set<string>(),
        });
      }
      const record = aggregatedResults.get(result.id);
      record?.sourceQueries.add(strategyLabel);
    });
  }

  const retrievalDuration = performance.now() - retrievalStart;

  const aggregated = Array.from(aggregatedResults.values())
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({
      ...entry.result,
      smartStrategies: Array.from(entry.sourceQueries),
    }));

  const topContextChunks: SmartQueryContextChunk[] = aggregated.slice(0, MAX_CONTEXT_CHUNKS).map((result) => ({
    id: result.id,
    content: result.chunk,
    file: result.file,
    lineStart: result.lineSpan?.start,
    lineEnd: result.lineSpan?.end,
    repo: result.repo,
    lang: result.lang,
    metadata: result,
  }));

  onProgress?.('smart-query', 80, 'Synthesizing smart answer with LLM');

  const synthesisStart = performance.now();
  const smartAnswer = await llmClient.synthesizeAnswer(query, topContextChunks, answerType);
  const synthesisDuration = performance.now() - synthesisStart;

  const totalDuration = performance.now() - startTime;

  const metadata: SmartQueryMetadata = {
    enhancedQuery,
    queryRuns,
    strategiesUsed: Array.from(new Set(strategies)),
    strategies: Array.from(new Set(strategies)),
    queryVariations: queriesToRun.map((item) => item.query),
    timingMs: {
      enhancement: Math.round(enhancementDuration),
      retrieval: Math.round(retrievalDuration),
      synthesis: Math.round(synthesisDuration),
      total: Math.round(totalDuration),
    },
    totalRetrievals: aggregated.length,
  };

  const response: SmartQueryResponse = {
    requestId,
    answer: smartAnswer,
    retrievals: aggregated,
    metadata,
  };

  onProgress?.('smart-query', 100, 'Smart query complete');

  return response;
}

