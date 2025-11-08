/**
 * Enhanced multi-dataset query functionality for Claude Context API
 * Allows querying specific datasets across different projects
 */

import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { VectorDocument } from '../vectordb/index.js';

export interface MultiDatasetRequest {
  datasets: Array<{
    project: string;  // Project name or 'global' for global datasets
    dataset: string;  // Dataset name
  }>;
  query: string;
  topK?: number;
  threshold?: number;
  includeMetadata?: boolean;
  rerank?: boolean;
  hybridSearch?: boolean;
}

export interface DatasetQueryResult {
  requestId: string;
  results: Array<{
    document: VectorDocument;
    score: number;
    dataset?: {
      project: string;
      dataset: string;
      datasetId: string;
    };
  }>;
  metadata: {
    datasetsQueried: number;
    datasetNames: Array<{ project: string; dataset: string }>;
    queryDuration: number;
    vectorSearchDuration?: number;
    rerankDuration?: number;
  };
}

/**
 * Query multiple specific datasets across different projects
 */
export async function queryMultipleDatasets(
  context: any,
  request: MultiDatasetRequest,
  onProgress?: (phase: string, progress: number, message?: string) => void
): Promise<DatasetQueryResult> {
  const startTime = performance.now();
  const requestId = crypto.randomUUID();
  
  const pool = context.getPostgresPool();
  if (!pool) {
    throw new Error('PostgreSQL pool not configured');
  }
  
  const client = await pool.connect();
  try {
    onProgress?.('init', 5, 'Resolving dataset IDs');
    
    // Resolve all dataset IDs with their metadata
    const datasetMappings: Array<{
      id: string;
      project: string;
      dataset: string;
    }> = [];
    
    for (const spec of request.datasets) {
      let query: string;
      let params: any[];
      
      if (spec.project === 'global') {
        // Query global datasets (no project_id)
        query = 'SELECT id FROM claude_context.datasets WHERE project_id IS NULL AND name = $1';
        params = [spec.dataset];
      } else {
        // Query project-specific datasets
        query = `
          SELECT d.id 
          FROM claude_context.datasets d 
          JOIN claude_context.projects p ON d.project_id = p.id 
          WHERE p.name = $1 AND d.name = $2
        `;
        params = [spec.project, spec.dataset];
      }
      
      const result = await client.query(query, params);
      if (result.rows.length > 0) {
        datasetMappings.push({
          id: result.rows[0].id,
          project: spec.project,
          dataset: spec.dataset
        });
      } else {
        console.warn(`Dataset not found: ${spec.project}/${spec.dataset}`);
      }
    }
    
    if (datasetMappings.length === 0) {
      return {
        requestId,
        results: [],
        metadata: {
          datasetsQueried: 0,
          datasetNames: request.datasets,
          queryDuration: performance.now() - startTime
        }
      };
    }
    
    const datasetIds = datasetMappings.map(d => d.id);
    onProgress?.('query', 20, `Resolved ${datasetIds.length} datasets`);
    
    // Get vector database and embedding components
    const vectorDb = context.getVectorDatabase();
    const embedding = context.getEmbedding();
    const spladeClient = context.getSpladeClient();
    const rerankerClient = context.getRerankerClient();
    
    // Check feature flags
    const hybridEnabled = request.hybridSearch && 
                         process.env.ENABLE_HYBRID_SEARCH === 'true' && 
                         !!spladeClient?.isEnabled();
    const rerankEnabled = request.rerank && 
                         process.env.ENABLE_RERANKING === 'true' && 
                         !!rerankerClient;
    
    // Generate query embedding
    onProgress?.('embed', 30, 'Generating query embedding');
    const embeddingStart = performance.now();
    const queryVector = await embedding.embed(request.query);
    const embeddingDuration = performance.now() - embeddingStart;
    
    // Generate sparse vector for hybrid search if enabled
    let querySparse: { indices: number[]; values: number[] } | undefined;
    if (hybridEnabled) {
      onProgress?.('sparse', 35, 'Generating sparse query vector');
      try {
        querySparse = await spladeClient.computeSparse(request.query);
      } catch (error) {
        console.warn('Failed to compute sparse query vector:', error);
      }
    }
    
    // Determine K values for search and reranking
    const userTopK = request.topK ?? 10;
    const initialK = rerankEnabled ? Math.min(150, userTopK * 10) : userTopK;
    const finalK = rerankEnabled ? userTopK : userTopK;
    
    // Build filter for vector search
    const filter: Record<string, any> = {
      datasetIds  // Array of dataset IDs to search
    };
    
    // Perform vector search
    onProgress?.('search', 50, `Searching across ${datasetIds.length} datasets`);
    const searchStart = performance.now();
    
    let searchResults: any[];
    
    if (hybridEnabled && querySparse) {
      // Hybrid search (dense + sparse)
      const denseWeight = parseFloat(process.env.HYBRID_DENSE_WEIGHT || '0.6');
      const sparseWeight = parseFloat(process.env.HYBRID_SPARSE_WEIGHT || '0.4');
      
      searchResults = await vectorDb.searchHybrid(
        queryVector,
        querySparse,
        initialK,
        filter,
        request.threshold ?? 0.4,
        denseWeight,
        sparseWeight
      );
    } else {
      // Dense-only search
      searchResults = await vectorDb.search(
        queryVector,
        initialK,
        filter,
        request.threshold ?? 0.4
      );
    }
    
    const vectorSearchDuration = performance.now() - searchStart;
    
    // Apply reranking if enabled
    let finalResults = searchResults;
    let rerankDuration: number | undefined;
    
    if (rerankEnabled && searchResults.length > 0) {
      onProgress?.('rerank', 70, 'Reranking results');
      const rerankStart = performance.now();
      
      const contents = searchResults.map(r => r.document.content);
      const rerankedScores = await rerankerClient.rerank(request.query, contents);
      
      // Combine original and rerank scores
      finalResults = searchResults
        .map((result, idx) => ({
          ...result,
          score: rerankedScores[idx] ?? result.score
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, finalK);
      
      rerankDuration = performance.now() - rerankStart;
    }
    
    // Map results with dataset information
    const enrichedResults = finalResults.map((result: any) => {
      const datasetMapping = datasetMappings.find(
        d => result.document.metadata?.datasetId === d.id
      );
      
      return {
        document: result.document,
        score: result.score,
        dataset: datasetMapping ? {
          project: datasetMapping.project,
          dataset: datasetMapping.dataset,
          datasetId: datasetMapping.id
        } : undefined
      };
    });
    
    onProgress?.('complete', 100, 'Query completed');
    
    return {
      requestId,
      results: enrichedResults,
      metadata: {
        datasetsQueried: datasetIds.length,
        datasetNames: request.datasets,
        queryDuration: performance.now() - startTime,
        vectorSearchDuration,
        rerankDuration
      }
    };
    
  } finally {
    client.release();
  }
}

/**
 * Query datasets matching a pattern across projects
 */
export async function queryDatasetsByPattern(
  context: any,
  request: {
    datasetPattern?: string;  // SQL LIKE pattern for dataset names
    projectPattern?: string;  // SQL LIKE pattern for project names  
    query: string;
    topK?: number;
    threshold?: number;
  },
  onProgress?: (phase: string, progress: number, message?: string) => void
): Promise<DatasetQueryResult> {
  const pool = context.getPostgresPool();
  if (!pool) {
    throw new Error('PostgreSQL pool not configured');
  }
  
  const client = await pool.connect();
  try {
    // Build dynamic query based on patterns
    let query = `
      SELECT 
        d.id as dataset_id,
        d.name as dataset_name,
        p.name as project_name
      FROM claude_context.datasets d
      LEFT JOIN claude_context.projects p ON d.project_id = p.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (request.datasetPattern) {
      query += ` AND d.name LIKE $${paramIndex}`;
      params.push(request.datasetPattern);
      paramIndex++;
    }
    
    if (request.projectPattern) {
      query += ` AND (p.name LIKE $${paramIndex} OR (p.name IS NULL AND $${paramIndex} = 'global%'))`;
      params.push(request.projectPattern);
      paramIndex++;
    }
    
    const result = await client.query(query, params);
    
    // Convert to dataset specifications
    const datasets = result.rows.map((row: any) => ({
      project: row.project_name || 'global',
      dataset: row.dataset_name
    }));
    
    // Use the main multi-dataset query function
    return await queryMultipleDatasets(
      context,
      {
        datasets,
        query: request.query,
        topK: request.topK,
        threshold: request.threshold
      },
      onProgress
    );
    
  } finally {
    client.release();
  }
}

/**
 * Get statistics for multiple datasets
 */
export async function getMultiDatasetStats(
  pool: Pool,
  datasetIds: string[]
): Promise<Array<{
  datasetId: string;
  datasetName: string;
  projectName: string;
  chunkCount: number;
  pageCount: number;
  lastIndexed: Date | null;
}>> {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        d.id as dataset_id,
        d.name as dataset_name,
        COALESCE(p.name, 'global') as project_name,
        COUNT(DISTINCT c.id) as chunk_count,
        COUNT(DISTINCT wp.id) as page_count,
        MAX(GREATEST(c.created_at, wp.created_at)) as last_indexed
      FROM claude_context.datasets d
      LEFT JOIN claude_context.projects p ON d.project_id = p.id
      LEFT JOIN claude_context.chunks c ON c.dataset_id = d.id
      LEFT JOIN claude_context.web_pages wp ON wp.dataset_id = d.id
      WHERE d.id = ANY($1::uuid[])
      GROUP BY d.id, d.name, p.name
      ORDER BY p.name, d.name
    `;
    
    const result = await client.query(query, [datasetIds]);
    
    return result.rows.map((row: any) => ({
      datasetId: row.dataset_id,
      datasetName: row.dataset_name,
      projectName: row.project_name,
      chunkCount: parseInt(row.chunk_count, 10),
      pageCount: parseInt(row.page_count, 10),
      lastIndexed: row.last_indexed ? new Date(row.last_indexed) : null
    }));
    
  } finally {
    client.release();
  }
}
