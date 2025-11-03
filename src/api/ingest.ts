import crypto from 'crypto';
import { Context } from '../context';

export interface GithubIngestRequest {
  project: string;
  dataset?: string;
  repo: string;
  codebasePath: string;
  branch?: string;
  sha?: string;
  forceReindex?: boolean;
  onProgress?: (progress: { phase: string; current: number; total: number; percentage: number }) => void;
}

export interface GithubIngestResponse {
  jobId: string;
  status: 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date;
  stats?: {
    indexedFiles: number;
    totalChunks: number;
    status: 'completed' | 'limit_reached';
  };
  error?: string;
}

export interface GithubDeleteRequest {
  project: string;
  dataset?: string;
  repo?: string;
}

export interface GithubDeleteResponse {
  project: string;
  dataset: string;
  projectId?: string;
  datasetId?: string;
  deletedVectors: number;
  status: 'deleted' | 'not_found';
  message?: string;
}

export interface CrawlPageInput {
  url: string;
  markdownContent: string;
  htmlContent?: string;
  title?: string;
  domain?: string;
  wordCount?: number;
  charCount?: number;
  contentHash?: string;
  metadata?: Record<string, any>;
  isGlobal?: boolean;
}

export interface CrawlIngestRequest {
  project: string;
  dataset: string;
  pages: CrawlPageInput[];
}

export interface CrawlIngestResponse {
  jobId: string;
  status: 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date;
  ingestedCount: number;
  pageIds: string[];
  error?: string;
}

/**
 * Ingest GitHub code into the project-aware context engine.
 * Wraps Context.indexWithProject and returns a job-style response for API usage.
 */
export async function ingestGithubRepository(
  context: Context,
  request: GithubIngestRequest
): Promise<GithubIngestResponse> {
  const jobId = crypto.randomUUID();
  const startedAt = new Date();

  try {
    const datasetName = request.dataset || request.repo;

    if (!datasetName) {
      throw new Error('Dataset name could not be resolved. Provide request.dataset or request.repo.');
    }

    const stats = await context.indexWithProject(
      request.codebasePath,
      request.project,
      datasetName,
      {
        repo: request.repo,
        branch: request.branch,
        sha: request.sha,
        progressCallback: request.onProgress,
        forceReindex: request.forceReindex
      }
    );

    return {
      jobId,
      status: 'completed',
      startedAt,
      completedAt: new Date(),
      stats
    };
  } catch (error: any) {
    return {
      jobId,
      status: 'failed',
      startedAt,
      completedAt: new Date(),
      error: error?.message || String(error)
    };
  }
}

function deriveDatasetName(dataset?: string, repo?: string): string | null {
  if (dataset && dataset.trim().length > 0) {
    return dataset.trim();
  }

  if (!repo) {
    return null;
  }

  let clean = repo.trim();
  if (!clean) {
    return null;
  }

  clean = clean.replace(/^https?:\/\/github\.com\//i, '');
  clean = clean.replace(/^git@github\.com:/i, '');
  clean = clean.replace(/^github\.com\//i, '');
  clean = clean.replace(/\.git$/i, '');

  const parts = clean.split('/').filter(Boolean);
  if (parts.length < 2) {
    return clean;
  }

  const [org, name] = parts;
  return `${org}-${name}`;
}

/**
 * Remove GitHub dataset artifacts including vector entries and dataset metadata.
 */
export async function deleteGithubDataset(
  context: Context,
  request: GithubDeleteRequest
): Promise<GithubDeleteResponse> {
  const datasetName = deriveDatasetName(request.dataset, request.repo);
  if (!datasetName) {
    throw new Error('A dataset or repo must be provided to delete GitHub content.');
  }

  const pool = context.getPostgresPool();
  if (!pool) {
    throw new Error('Context is not configured with a PostgreSQL pool. Cannot delete GitHub dataset.');
  }

  const vectorDb = context.getVectorDatabase();

  const client = await pool.connect();
  try {
    const projectResult = await client.query(
      'SELECT id FROM claude_context.projects WHERE name = $1',
      [request.project]
    );

    if (projectResult.rows.length === 0) {
      return {
        project: request.project,
        dataset: datasetName,
        deletedVectors: 0,
        status: 'not_found',
        message: `Project "${request.project}" not found`
      };
    }

    const projectId = projectResult.rows[0].id as string;

    const datasetResult = await client.query(
      'SELECT id FROM claude_context.datasets WHERE project_id = $1 AND name = $2',
      [projectId, datasetName]
    );

    if (datasetResult.rows.length === 0) {
      return {
        project: request.project,
        dataset: datasetName,
        projectId,
        deletedVectors: 0,
        status: 'not_found',
        message: `Dataset "${datasetName}" not found for project "${request.project}"`
      };
    }

    const datasetId = datasetResult.rows[0].id as string;

    const collections = await vectorDb.listCollections();
    let removedVectors = 0;

    for (const collectionName of collections) {
      try {
        const deleted = await vectorDb.deleteByDataset(collectionName, datasetId);
        if (typeof deleted === 'number') {
          removedVectors += deleted;
        }
      } catch (error) {
        console.warn(`[GithubDelete] Failed to delete dataset ${datasetId} from collection ${collectionName}:`, error);
      }
    }

    const deleteResult = await client.query(
      'DELETE FROM claude_context.datasets WHERE id = $1',
      [datasetId]
    );

    if (deleteResult.rowCount === 0) {
      return {
        project: request.project,
        dataset: datasetName,
        projectId,
        datasetId,
        deletedVectors: removedVectors,
        status: 'not_found',
        message: `Dataset "${datasetName}" was not deleted`
      };
    }

    return {
      project: request.project,
      dataset: datasetName,
      projectId,
      datasetId,
      deletedVectors: removedVectors,
      status: 'deleted',
      message: `Deleted dataset "${datasetName}" and ${removedVectors} vector chunk(s)`
    };
  } finally {
    client.release();
  }
}

/**
 * Ingest Crawl4AI pages into the orchestrator database using upsert_web_page_v3.
 * Requires the Context to have a PostgreSQL pool configured.
 */
export async function ingestCrawlPages(
  context: Context,
  request: CrawlIngestRequest
): Promise<CrawlIngestResponse> {
  const jobId = crypto.randomUUID();
  const startedAt = new Date();

  const pool = context.getPostgresPool();
  if (!pool) {
    return {
      jobId,
      status: 'failed',
      startedAt,
      completedAt: new Date(),
      ingestedCount: 0,
      pageIds: [],
      error: 'Context is not configured with a PostgreSQL pool. Cannot ingest crawl pages.'
    };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const pageIds: string[] = [];

    for (const page of request.pages) {
      const result = await client.query(
        'SELECT upsert_web_page_v3($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS id',
        [
          page.url,
          request.project,
          request.dataset,
          page.markdownContent,
          page.htmlContent || null,
          page.title || null,
          page.domain || null,
          page.wordCount || null,
          page.charCount || null,
          page.contentHash || null,
          JSON.stringify(page.metadata || {}),
          page.isGlobal ?? false
        ]
      );

      if (result.rows.length > 0) {
        pageIds.push(result.rows[0].id);
      }
    }

    await client.query('COMMIT');

    return {
      jobId,
      status: 'completed',
      startedAt,
      completedAt: new Date(),
      ingestedCount: pageIds.length,
      pageIds
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    return {
      jobId,
      status: 'failed',
      startedAt,
      completedAt: new Date(),
      ingestedCount: 0,
      pageIds: [],
      error: error?.message || String(error)
    };
  } finally {
    client.release();
  }
}
