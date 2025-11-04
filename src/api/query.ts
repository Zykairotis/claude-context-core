import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { Context } from '../context';
import { VectorDocument, VectorSearchResult } from '../vectordb';

const DEFAULT_RERANK_CANDIDATE_LIMIT = 20;
const DEFAULT_RERANK_TEXT_MAX_CHARS = 4000;

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max?: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  let result = parsed;

  if (typeof max === 'number' && Number.isFinite(max)) {
    result = Math.min(result, max);
  }

  return Math.max(result, min);
}

function getRerankCandidateLimit(): number {
  return parseBoundedInt(process.env.RERANK_CANDIDATE_LIMIT, DEFAULT_RERANK_CANDIDATE_LIMIT, 1);
}

function getRerankTextMaxChars(): number {
  return parseBoundedInt(process.env.RERANK_TEXT_MAX_CHARS, DEFAULT_RERANK_TEXT_MAX_CHARS, 200);
}

function buildRerankText(document: VectorDocument, maxChars: number): string {
  const header = document.relativePath ? `${document.relativePath}\n` : '';
  const combined = `${header}${document.content ?? ''}`;
  const normalized = combined.trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const safeLength = Math.max(0, maxChars - 3);
  return `${normalized.slice(0, safeLength)}...`;
}
import { getAccessibleDatasets, getOrCreateProject, ALL_PROJECTS_SENTINEL, getAllDatasetIds } from '../utils/project-helpers';
import { Pool } from 'pg';

export interface ProjectQueryRequest {
  project: string;
  query: string;
  codebasePath: string;
  dataset?: string;
  includeGlobal?: boolean;
  topK?: number;
  threshold?: number;
  repo?: string;
  lang?: string;
  pathPrefix?: string;
}

export interface QueryScoreBreakdown {
  vector: number;
  sparse?: number;
  rerank?: number;
  final?: number;
}

export interface ProjectQueryResult {
  id: string;
  chunk: string;
  file: string;
  lineSpan: {
    start: number;
    end: number;
  };
  scores: QueryScoreBreakdown;
  projectId?: string;
  datasetId?: string;
  repo?: string;
  lang?: string;
  chunkTitle?: string;
  projectName?: string;
  symbolName?: string;
  symbolKind?: string;
  smartStrategies?: string[];
}

export interface ProjectQueryMetadata {
  retrievalMethod: string;
  featuresUsed: {
    hybridSearch: boolean;
    reranking: boolean;
    symbolExtraction: boolean;
  };
  timingMs: {
    embedding: number;
    search: number;
    reranking?: number;
    total: number;
  };
  searchParams: {
    initialK: number;
    finalK: number;
    denseWeight?: number;
    sparseWeight?: number;
  };
}

export interface ProjectQueryResponse {
  requestId: string;
  results: ProjectQueryResult[];
  metadata: ProjectQueryMetadata;
}

/**
 * Execute a dense vector search constrained to a project's accessible datasets.
 * This is the Phase A query surface that runs entirely on the PostgresDualVectorDatabase.
 */
export async function queryProject(
  context: Context,
  request: ProjectQueryRequest,
  onProgress?: (phase: string, percentage: number, detail: string) => void
): Promise<ProjectQueryResponse> {
  const requestId = crypto.randomUUID();

  const baseTopK = request.topK ?? 10;

  const makeEmptyMetadata = (): ProjectQueryMetadata => ({
    retrievalMethod: 'dense',
    featuresUsed: {
      hybridSearch: false,
      reranking: false,
      symbolExtraction: process.env.ENABLE_SYMBOL_EXTRACTION !== 'false'
    },
    timingMs: {
      embedding: 0,
      search: 0,
      total: 0
    },
    searchParams: {
      initialK: baseTopK,
      finalK: baseTopK
    }
  });

  const pool = context.getPostgresPool();
  if (!pool) {
    throw new Error('Context is not configured with a PostgreSQL pool. Cannot query project data.');
  }

  const client = await pool.connect();
  try {
    // Special case: "all" projects scope
    const isAllProjects = request.project.toLowerCase() === 'all';
    
    let project: { id: string; name: string } | null = null;
    let datasetIds: string[] = [];

    if (isAllProjects) {
      onProgress?.('query', 10, 'Querying all projects');
      
      // Get all dataset IDs across all projects
      datasetIds = await getAllDatasetIds(client, request.includeGlobal !== false);
      
      // Narrow to explicit dataset when provided (search across all projects)
      if (request.dataset) {
        const datasetResult = await client.query(
          'SELECT id FROM claude_context.datasets WHERE name = $1',
          [request.dataset]
        );

        if (datasetResult.rows.length === 0) {
          return { requestId, results: [], metadata: makeEmptyMetadata() };
        }

        const datasetId = datasetResult.rows[0].id;
        
        // Verify it's in the accessible list
        if (!datasetIds.includes(datasetId)) {
          return { requestId, results: [], metadata: makeEmptyMetadata() };
        }

        datasetIds = [datasetId];
      }
    } else {
      // Resolve project (creates if missing—mirrors ingestion behaviour)
      project = await getOrCreateProject(client, request.project);
      onProgress?.('query', 10, 'Resolved project');

      // Resolve accessible datasets
      const accessibleDatasetIds = await getAccessibleDatasets(
        client,
        project.id,
        request.includeGlobal !== false
      );

      datasetIds = accessibleDatasetIds;

      // Narrow to explicit dataset when provided
      if (request.dataset) {
        const datasetResult = await client.query(
          'SELECT id FROM claude_context.datasets WHERE project_id = $1 AND name = $2',
          [project.id, request.dataset]
        );

        if (datasetResult.rows.length === 0) {
          return { requestId, results: [], metadata: makeEmptyMetadata() };
        }

        const datasetId = datasetResult.rows[0].id;

        if (!accessibleDatasetIds.includes(datasetId)) {
          return { requestId, results: [], metadata: makeEmptyMetadata() };
        }

        datasetIds = [datasetId];
      }
    }

    if (datasetIds.length === 0) {
      return { requestId, results: [], metadata: makeEmptyMetadata() };
    }

    onProgress?.('query', 20, `Resolved ${datasetIds.length} accessible dataset(s)`);

    const vectorDb = context.getVectorDatabase();
    const embedding = context.getEmbedding();
    const spladeClient = context.getSpladeClient();
    const rerankerClient = context.getRerankerClient();

    const hybridEnabled = process.env.ENABLE_HYBRID_SEARCH === 'true' && !!spladeClient?.isEnabled();
    const rerankEnabled = process.env.ENABLE_RERANKING === 'true' && !!rerankerClient;

    // Check if using dual-model (AutoEmbeddingMonster)
    const isDualModel = context.isAutoEmbeddingMonster();

    onProgress?.('query', 30, isDualModel ? 'Generating dual-model query embeddings' : 'Generating query embedding');
    const embeddingStart = performance.now();
    
    let queryVector: any;
    if (!isDualModel) {
      queryVector = await embedding.embed(request.query);
    }
    
    const embeddingDuration = performance.now() - embeddingStart;
    onProgress?.('query', 50, 'Query embedding(s) generated');

    let querySparse: { indices: number[]; values: number[] } | undefined;
    if (hybridEnabled && spladeClient) {
      onProgress?.('query', 55, 'Generating sparse query vector');
      try {
        querySparse = await spladeClient.computeSparse(request.query);
      } catch (error) {
        console.warn('[queryProject] Failed to compute sparse query vector, continuing with dense search:', error);
      }
    }

    const userTopK = request.topK ?? 10;
    const initialK = rerankEnabled
      ? parseInt(process.env.RERANK_INITIAL_K || '150', 10)
      : userTopK;
    const finalK = rerankEnabled
      ? parseInt(process.env.RERANK_FINAL_K || `${userTopK}`, 10)
      : userTopK;
    const denseWeight = hybridEnabled ? parseFloat(process.env.HYBRID_DENSE_WEIGHT || '0.6') : undefined;
    const sparseWeight = hybridEnabled ? parseFloat(process.env.HYBRID_SPARSE_WEIGHT || '0.4') : undefined;

    const filter: Record<string, any> = {
      datasetIds
    };

    // Only include projectId filter if not "all" projects
    if (!isAllProjects && project) {
      filter.projectId = project.id;
    }

    if (request.repo) {
      filter.repo = request.repo;
    }

    if (request.lang) {
      filter.lang = request.lang;
    }

    if (request.pathPrefix) {
      filter.pathPrefix = request.pathPrefix;
    }

    onProgress?.('query', 60, 'Searching vector database');

    const threshold = request.threshold ?? 0.4;
    type SearchResultWithBreakdown = {
      document: VectorDocument;
      score: number;
      vectorScore: number;
      sparseScore?: number;
    };

    const searchStart = performance.now();

    const executeSearch = async (collectionName: string): Promise<SearchResultWithBreakdown[]> => {
      try {
        // Dual-model search path
        if (isDualModel) {
          const dualResults = await context.dualModelSearch(
            collectionName,
            request.query,
            initialK,
            threshold,
            undefined, // filter managed internally
            hybridEnabled,
            querySparse
          );

          return dualResults.map(result => ({
            document: result.document,
            score: result.score,
            vectorScore: result.score
          }));
        }

        // Single-model search path
        if (hybridEnabled && querySparse && typeof (vectorDb as any).hybridQuery === 'function') {
          const [hybridResults, denseResults]: [VectorSearchResult[], VectorSearchResult[]] = await Promise.all([
            (vectorDb as any).hybridQuery(collectionName, queryVector.vector, querySparse, {
              topK: initialK,
              threshold,
              filter
            }),
            vectorDb.search(collectionName, queryVector.vector, {
              topK: initialK,
              threshold,
              filter
            })
          ]);

          const denseScoreMap = new Map<string, number>();
          denseResults.forEach(result => {
            denseScoreMap.set(result.document.id, result.score);
          });

          const combinedHybrid = hybridResults.map(result => ({
            document: result.document,
            score: result.score,
            vectorScore: denseScoreMap.get(result.document.id) ?? result.score,
            sparseScore: result.score
          }));

          if (combinedHybrid.length === 0) {
            return denseResults.map(result => ({
              document: result.document,
              score: result.score,
              vectorScore: result.score
            }));
          }

          return combinedHybrid;
        }

        const denseOnlyResults = await vectorDb.search(collectionName, queryVector.vector, {
          topK: initialK,
          threshold,
          filter
        });

        return denseOnlyResults.map(result => ({
          document: result.document,
          score: result.score,
          vectorScore: result.score
        }));
      } catch (error: any) {
        console.warn(`[Query] Search failed for collection ${collectionName}:`, error.message || error);
        return [];
      }
    };

    const isQdrant = vectorDb.constructor.name === 'QdrantVectorDatabase';
    const aggregatedResults: Map<string, SearchResultWithBreakdown> = new Map();

    const supportsListCollections = typeof (vectorDb as any).listCollections === 'function';
    const supportsHasCollection = typeof (vectorDb as any).hasCollection === 'function';
    const defaultCollectionName = context.getCollectionName(request.codebasePath);

    let candidateCollections: string[] = [];

    if (isQdrant && supportsListCollections) {
      const allCollections: string[] = await (vectorDb as any).listCollections();
      const hybridCollections = allCollections.filter(name => 
        name.startsWith('hybrid_code_chunks_') || name.startsWith('project_')
      );
      candidateCollections = hybridCollections.length > 0 ? hybridCollections : [defaultCollectionName];
    } else {
      let useDefault = true;

      if (supportsHasCollection) {
        try {
          const collectionExists = await (vectorDb as any).hasCollection(defaultCollectionName);
          useDefault = collectionExists;
          if (!collectionExists) {
            console.warn(`[queryProject] Collection ${defaultCollectionName} not found – falling back to available collections.`);
          }
        } catch (error) {
          useDefault = false;
          console.warn(`[queryProject] Failed to verify collection ${defaultCollectionName}:`, error);
        }
      }

      if (useDefault) {
        candidateCollections = [defaultCollectionName];
      } else if (supportsListCollections) {
        try {
          const allCollections: string[] = await (vectorDb as any).listCollections();
          const filteredCollections = allCollections.filter(name =>
            name.startsWith('hybrid_code_chunks_') || name.startsWith('code_chunks_') || name.startsWith('project_')
          );
          candidateCollections = filteredCollections;
        } catch (error) {
          console.warn('[queryProject] Failed to list collections:', error);
        }
      }

      if (candidateCollections.length === 0) {
        candidateCollections = [defaultCollectionName];
      }
    }

    candidateCollections = Array.from(new Set(candidateCollections));
    const progressMessage = candidateCollections.length === 1
      ? `Searching collection ${candidateCollections[0]}`
      : `Searching ${candidateCollections.length} collection(s)`;
    onProgress?.('query', 65, progressMessage);

    for (const collectionName of candidateCollections) {
      const results = await executeSearch(collectionName);
      results.forEach(result => {
        const existing = aggregatedResults.get(result.document.id);
        if (!existing || result.score > existing.score) {
          aggregatedResults.set(result.document.id, result);
        }
      });
    }

    let enrichedResults = Array.from(aggregatedResults.values()).map(entry => ({
      document: entry.document,
      vectorScore: entry.vectorScore,
      sparseScore: entry.sparseScore,
      finalScore: entry.score,
      rerankScore: undefined as number | undefined
    }));

    const searchDuration = performance.now() - searchStart;

    onProgress?.('query', 80, `Found ${enrichedResults.length} results before reranking`);

    let rerankDuration = 0;
    if (rerankEnabled && rerankerClient && enrichedResults.length > 0) {
      onProgress?.('query', 88, 'Reranking results');
      try {
        const rerankCandidateLimit = getRerankCandidateLimit();
        const rerankTextMaxChars = getRerankTextMaxChars();
        const candidateIndices: number[] = [];
        const candidateTexts: string[] = [];

        for (let index = 0; index < enrichedResults.length && candidateIndices.length < rerankCandidateLimit; index += 1) {
          const candidate = enrichedResults[index];
          const text = buildRerankText(candidate.document, rerankTextMaxChars);
          if (text.trim().length === 0) {
            continue;
          }
          candidateIndices.push(index);
          candidateTexts.push(text);
        }

        if (candidateTexts.length === 0) {
          console.warn('[queryProject] No rerank candidates after applying payload limits. Skipping reranker.');
        } else {
          const rerankStart = performance.now();
          const rerankScores = await rerankerClient.rerank(request.query, candidateTexts);

          if (rerankScores.length !== candidateTexts.length) {
            console.warn(`[queryProject] Reranker returned ${rerankScores.length} score(s) for ${candidateTexts.length} candidate(s).`);
          }

          const rerankScoreMap = new Map<number, number>();
          candidateIndices.forEach((originalIndex, candidateIndex) => {
            const score = rerankScores[candidateIndex];
            if (typeof score === 'number' && Number.isFinite(score)) {
              rerankScoreMap.set(originalIndex, score);
            }
          });

          if (rerankScoreMap.size === 0) {
            console.warn('[queryProject] Reranker produced no usable scores. Falling back to vector scores.');
          } else {
            enrichedResults = enrichedResults.map((result, index) => {
              const rerankScore = rerankScoreMap.get(index);
              if (rerankScore === undefined) {
                return result;
              }

              return {
                ...result,
                rerankScore,
                finalScore: rerankScore
              };
            });

            enrichedResults.sort((a, b) => b.finalScore - a.finalScore);
          }

          rerankDuration = performance.now() - rerankStart;
        }
      } catch (error) {
        console.warn('[queryProject] Reranking failed, using vector scores:', error);
      }
    }

    const finalLimit = Math.max(1, finalK);
    const trimmedResults = enrichedResults.slice(0, finalLimit);

    onProgress?.('query', 95, `Returning ${trimmedResults.length} results`);

    const results: ProjectQueryResult[] = trimmedResults.map(result => ({
      id: result.document.id,
      chunk: result.document.content,
      file: result.document.relativePath,
      lineSpan: {
        start: result.document.startLine,
        end: result.document.endLine
      },
      scores: {
        vector: result.vectorScore,
        sparse: result.sparseScore,
        rerank: result.rerankScore,
        final: result.finalScore
      },
      projectId: result.document.projectId,
      datasetId: result.document.datasetId,
      repo: result.document.repo || undefined,
      lang: result.document.lang || undefined,
      chunkTitle: result.document.metadata?.chunkTitle,
      projectName: project?.name,
      symbolName: (result.document.metadata?.symbol?.name ?? result.document.symbol?.name) || undefined,
      symbolKind: (result.document.metadata?.symbol?.kind ?? result.document.symbol?.kind) || undefined
    }));

    onProgress?.('query', 100, 'Query complete');

    const totalDuration = embeddingDuration + searchDuration + rerankDuration;
    const retrievalMethod = (() => {
      if (hybridEnabled && rerankEnabled) {
        return 'hybrid+rerank';
      }
      if (hybridEnabled) {
        return 'hybrid';
      }
      if (rerankEnabled) {
        return 'rerank';
      }
      return 'dense';
    })();

    const metadata: ProjectQueryMetadata = {
      retrievalMethod,
      featuresUsed: {
        hybridSearch: hybridEnabled,
        reranking: rerankEnabled,
        symbolExtraction: process.env.ENABLE_SYMBOL_EXTRACTION !== 'false'
      },
      timingMs: {
        embedding: Math.round(embeddingDuration),
        search: Math.round(searchDuration),
        reranking: rerankDuration ? Math.round(rerankDuration) : undefined,
        total: Math.round(totalDuration)
      },
      searchParams: {
        initialK,
        finalK,
        denseWeight,
        sparseWeight
      }
    };

    return {
      requestId,
      results,
      metadata
    };
  } finally {
    client.release();
  }
}

/**
 * Query web content with hybrid search support
 * Combines dense embeddings with SPLADE sparse vectors
 */
export interface WebQueryRequest {
  query: string;
  project: string;
  dataset?: string;
  topK?: number;
  threshold?: number;
  includeGlobal?: boolean;
}

export interface WebQueryResult {
  id: string;
  chunk: string;
  url: string;
  title?: string;
  domain?: string;
  scores: {
    vector: number;
    sparse?: number;
    hybrid?: number;
    final: number;
  };
  metadata?: Record<string, any>;
}

export interface WebQueryResponse {
  requestId: string;
  results: WebQueryResult[];
  metadata: {
    retrievalMethod: 'dense' | 'hybrid';
    queriesExecuted: number;
    timingMs: {
      embedding: number;
      search: number;
      total: number;
    };
    searchParams: {
      initialK: number;
      finalK: number;
      denseWeight?: number;
      sparseWeight?: number;
    };
  };
}

export async function queryWebContent(
  context: Context,
  request: WebQueryRequest
): Promise<WebQueryResponse> {
  const requestId = crypto.randomUUID();
  const startTime = performance.now();
  const baseTopK = request.topK ?? 10;

  const pool = context.getPostgresPool();
  if (!pool) {
    throw new Error('PostgreSQL pool required for web content queries');
  }

  const client = await pool.connect();
  try {
    // Resolve project
    const projectData = await getOrCreateProject(client, request.project);

    // Get accessible datasets
    const accessibleDatasetIds = await (async () => {
      if (request.dataset) {
        const result = await client.query(
          'SELECT id FROM claude_context.datasets WHERE project_id = $1 AND name = $2',
          [projectData.id, request.dataset]
        );
        return result.rows.length > 0 ? [result.rows[0].id] : [];
      }
      return await (async () => {
        const result = await client.query(
          'SELECT id FROM claude_context.datasets WHERE project_id = $1',
          [projectData.id]
        );
        return result.rows.map(row => row.id);
      })();
    })();

    if (accessibleDatasetIds.length === 0) {
      return {
        requestId,
        results: [],
        metadata: {
          retrievalMethod: 'dense',
          queriesExecuted: 0,
          timingMs: { embedding: 0, search: 0, total: 0 },
          searchParams: { initialK: baseTopK, finalK: baseTopK }
        }
      };
    }

    // Generate query embedding
    const embeddingStart = performance.now();
    const embedding = context.getEmbedding();
    const queryVector = await embedding.embed(request.query);
    const embeddingDuration = performance.now() - embeddingStart;

    // Check for hybrid search support
    const spladeClient = context.getSpladeClient();
    const rerankerClient = context.getRerankerClient();
    const hybridEnabled = process.env.ENABLE_HYBRID_SEARCH === 'true' && !!spladeClient?.isEnabled();
    const rerankEnabled = process.env.ENABLE_RERANKING === 'true' && !!rerankerClient;

    let querySparse: { indices: number[]; values: number[] } | undefined;
    if (hybridEnabled && spladeClient) {
      try {
        querySparse = await spladeClient.computeSparse(request.query);
      } catch (error) {
        console.warn('[queryWebContent] SPLADE failed, continuing with dense-only:', error);
      }
    }

    // Search vector database
    const searchStart = performance.now();
    const vectorDb = context.getVectorDatabase();
    const threshold = request.threshold ?? 0.4;
    const initialK = rerankEnabled ? parseInt(process.env.RERANK_INITIAL_K || '150', 10) : baseTopK;
    const finalK = rerankEnabled ? parseInt(process.env.RERANK_FINAL_K || `${baseTopK}`, 10) : baseTopK;

    // Build filter
    const filter: Record<string, any> = {
      datasetIds: accessibleDatasetIds,
      projectId: projectData.id,
      sourceType: 'web_page'
    };

    // Execute search
    let searchResults: VectorSearchResult[] = [];
    
    if (hybridEnabled && querySparse && spladeClient?.isEnabled()) {
      // Hybrid search
      try {
        const hybridResults = await (vectorDb as any).hybridQuery?.(
          `hybrid_web_${projectData.name.toLowerCase()}`,
          queryVector.vector,
          querySparse,
          { topK: initialK, threshold, filter }
        ) || [];
        searchResults = hybridResults;
      } catch (error) {
        console.warn('[queryWebContent] Hybrid search failed, falling back to dense:', error);
        searchResults = await vectorDb.search(
          `web_${projectData.name.toLowerCase()}`,
          queryVector.vector,
          { topK: initialK, threshold, filter }
        );
      }
    } else {
      // Dense-only search
      searchResults = await vectorDb.search(
        `web_${projectData.name.toLowerCase()}`,
        queryVector.vector,
        { topK: initialK, threshold, filter }
      );
    }

    const searchDuration = performance.now() - searchStart;

    // Apply reranking if enabled
    if (rerankEnabled && rerankerClient && searchResults.length > 0) {
      const maxChars = parseInt(process.env.RERANK_TEXT_MAX_CHARS || '4000', 10);
      const candidateTexts = searchResults.map(r => buildRerankText(r.document, maxChars));

      try {
        const scores = await rerankerClient.rerank(request.query, candidateTexts);
        searchResults = searchResults
          .map((result, i) => ({
            ...result,
            rerankScore: scores[i] ?? 0
          }))
          .sort((a, b) => (b as any).rerankScore - (a as any).rerankScore)
          .slice(0, finalK);
      } catch (error) {
        console.warn('[queryWebContent] Reranking failed, using original scores:', error);
        searchResults = searchResults.slice(0, finalK);
      }
    } else {
      searchResults = searchResults.slice(0, finalK);
    }

    // Format results
    const results: WebQueryResult[] = searchResults.map(result => ({
      id: result.document.id,
      chunk: result.document.content,
      url: result.document.relativePath,
      title: result.document.metadata?.title,
      domain: result.document.metadata?.domain,
      scores: {
        vector: result.score,
        sparse: (result as any).sparseScore,
        hybrid: (result as any).hybridScore,
        final: (result as any).rerankScore ?? result.score
      },
      metadata: result.document.metadata
    }));

    const totalDuration = performance.now() - startTime;

    return {
      requestId,
      results,
      metadata: {
        retrievalMethod: hybridEnabled ? 'hybrid' : 'dense',
        queriesExecuted: 1,
        timingMs: {
          embedding: Math.round(embeddingDuration),
          search: Math.round(searchDuration),
          total: Math.round(totalDuration)
        },
        searchParams: {
          initialK,
          finalK,
          denseWeight: hybridEnabled ? 0.6 : undefined,
          sparseWeight: hybridEnabled ? 0.4 : undefined
        }
      }
    };
  } finally {
    client.release();
  }
}
