import { Router, Request, Response } from 'express';
import { Pool, PoolClient } from 'pg';
import { QdrantClient } from '@qdrant/qdrant-js';
import { MetricPulse, PipelinePhase, ScopeResource, ScopeLevel, IngestionJob, OperationsEvent } from '../types';
import { config } from '../config';
import { CrawlMonitor } from '../monitors/crawl-monitor';
import { WebSocketManager } from '../websocket';
import { getCore } from '../core/context-factory';
import { JobQueue } from '../services/job-queue';
import { RepositoryManager } from '../services/repository-manager';

const SMART_STRATEGIES: Array<'multi-query' | 'refinement' | 'concept-extraction'> = [
  'multi-query',
  'refinement',
  'concept-extraction'
];

type SmartAnswerType = 'conversational' | 'structured';

type SmartStrategy = (typeof SMART_STRATEGIES)[number];

interface SmartQueryRequestBody {
  query: string;
  dataset?: string;
  includeGlobal?: boolean;
  topK?: number;
  threshold?: number;
  repo?: string;
  lang?: string;
  pathPrefix?: string;
  path_prefix?: string;
  strategies?: SmartStrategy[];
  answerType?: SmartAnswerType;
  codebasePath?: string;
}

export function createProjectsRouter(pool: Pool, crawlMonitor: CrawlMonitor, wsManager: WebSocketManager, context: any, jobQueue?: JobQueue): Router {
  const router = Router();
  const core = getCore();
  const repoManager = new RepositoryManager();

  // GET /projects/:project/stats
  router.get('/:project/stats', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const isAllProjects = project.toLowerCase() === 'all';
      const client = await pool.connect();

      try {
        // Query project metrics - aggregate all if "all", otherwise filter by project
        const metricsResult = await client.query(
          isAllProjects
            ? `
              SELECT 
                COUNT(DISTINCT d.id) as datasets,
                COUNT(DISTINCT c.id) as chunks,
                COUNT(DISTINCT w.id) as web_pages,
                COUNT(DISTINCT cs.id) as crawl_sessions
              FROM claude_context.projects p
              LEFT JOIN claude_context.datasets d ON d.project_id = p.id
              LEFT JOIN claude_context.documents doc ON doc.dataset_id = d.id
              LEFT JOIN claude_context.chunks c ON (c.document_id = doc.id OR c.web_page_id IN (SELECT id FROM claude_context.web_pages WHERE dataset_id = d.id))
              LEFT JOIN claude_context.web_pages w ON w.dataset_id = d.id
              LEFT JOIN claude_context.crawl_sessions cs ON cs.dataset_id = d.id
            `
            : `
              SELECT 
                COUNT(DISTINCT d.id) as datasets,
                COUNT(DISTINCT c.id) as chunks,
                COUNT(DISTINCT w.id) as web_pages,
                COUNT(DISTINCT cs.id) as crawl_sessions
              FROM claude_context.projects p
              LEFT JOIN claude_context.datasets d ON d.project_id = p.id
              LEFT JOIN claude_context.documents doc ON doc.dataset_id = d.id
              LEFT JOIN claude_context.chunks c ON (c.document_id = doc.id OR c.web_page_id IN (SELECT id FROM claude_context.web_pages WHERE dataset_id = d.id))
              LEFT JOIN claude_context.web_pages w ON w.dataset_id = d.id
              LEFT JOIN claude_context.crawl_sessions cs ON cs.dataset_id = d.id
              WHERE p.name = $1
            `,
          isAllProjects ? [] : [project]
        );

        const row = metricsResult.rows[0] || {};

        // Get Qdrant chunk count (for GitHub ingestion chunks)
        const qdrantClient = new QdrantClient({ url: config.qdrantUrl });
        let qdrantChunks = 0;
        try {
          const collections = await qdrantClient.getCollections();
          for (const collection of collections.collections) {
            if (collection.name.startsWith('hybrid_code_chunks_') ||
                collection.name.startsWith('code_chunks_')) {
              try {
                const info = await qdrantClient.getCollection(collection.name);
                qdrantChunks += info.points_count || 0;
              } catch (error: any) {
                console.warn(`[API] Failed to get collection ${collection.name}:`, error.message);
              }
            }
          }
        } catch (error: any) {
          console.warn('[API] Failed to get Qdrant chunk count:', error.message);
        }

        const postgresChunks = parseInt(row.chunks || '0', 10);
        const totalChunks = postgresChunks + qdrantChunks;

        const metrics: MetricPulse[] = [
          { label: 'Datasets', value: parseInt(row.datasets || '0', 10), caption: 'active' },
          { label: 'Chunks', value: totalChunks, caption: 'indexed' },
          { label: 'Web Pages', value: parseInt(row.web_pages || '0', 10), caption: 'crawled' },
          { label: 'Sessions', value: parseInt(row.crawl_sessions || '0', 10), caption: 'total' }
        ];

        // Mock pipeline phases (to be replaced with real telemetry)
        const pipeline: PipelinePhase[] = [
          {
            name: 'Crawling',
            description: 'Retrieving web pages and repository content',
            status: 'idle',
            completion: 0,
            throughput: '0 pages/s',
            latency: '~0ms',
            nextDeliveryMs: 0
          },
          {
            name: 'Chunking',
            description: 'Tree-sitter AST parsing and smart text splitting',
            status: 'idle',
            completion: 0,
            throughput: '0 chunks/s',
            latency: '~0ms',
            nextDeliveryMs: 0
          },
          {
            name: 'Summarizing',
            description: 'LLM hybrid summarization across chunks',
            status: 'idle',
            completion: 0,
            throughput: '0 summaries/s',
            latency: '~0ms',
            nextDeliveryMs: 0
          },
          {
            name: 'Embedding (Content)',
            description: 'GTE embeddings for natural language content',
            status: 'idle',
            completion: 0,
            throughput: '0 vec/s',
            latency: '~0ms',
            nextDeliveryMs: 0
          },
          {
            name: 'Embedding (Code)',
            description: 'CodeRank embeddings for source code chunks',
            status: 'idle',
            completion: 0,
            throughput: '0 vec/s',
            latency: '~0ms',
            nextDeliveryMs: 0
          },
          {
            name: 'Storage (Postgres)',
            description: 'Persist chunk metadata and vectors in Postgres',
            status: 'idle',
            completion: 0,
            throughput: '0 ops/s',
            latency: '~0ms',
            nextDeliveryMs: 0
          },
          {
            name: 'Storage (Qdrant)',
            description: 'Index vectors in Qdrant collection',
            status: 'idle',
            completion: 0,
            throughput: '0 ops/s',
            latency: '~0ms',
            nextDeliveryMs: 0
          }
        ];

        res.json({ metrics, pipeline, pulses: metrics });
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[API] /projects/:project/stats error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /projects/:project/scopes
  router.get('/:project/scopes', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const isAllProjects = project.toLowerCase() === 'all';
      const client = await pool.connect();

      try {
        const result = await client.query(
          isAllProjects
            ? `
              SELECT 
                d.id,
                d.name,
                CASE 
                  WHEN d.is_global THEN 'global'
                  ELSE 'project'
                END as scope,
                d.updated_at,
                (SELECT COUNT(DISTINCT c.id) 
                 FROM claude_context.chunks c 
                 LEFT JOIN claude_context.documents doc ON c.document_id = doc.id 
                 LEFT JOIN claude_context.web_pages wp ON c.web_page_id = wp.id
                 WHERE doc.dataset_id = d.id OR wp.dataset_id = d.id
                ) as chunk_count,
                COUNT(DISTINCT w.id) as page_count
              FROM claude_context.datasets d
              LEFT JOIN claude_context.web_pages w ON w.dataset_id = d.id
              GROUP BY d.id, d.name, d.is_global, d.updated_at
              ORDER BY d.updated_at DESC
            `
            : `
              SELECT 
                d.id,
                d.name,
                CASE 
                  WHEN d.is_global THEN 'global'
                  ELSE 'project'
                END as scope,
                d.updated_at,
                (SELECT COUNT(DISTINCT c.id) 
                 FROM claude_context.chunks c 
                 LEFT JOIN claude_context.documents doc ON c.document_id = doc.id 
                 LEFT JOIN claude_context.web_pages wp ON c.web_page_id = wp.id
                 WHERE doc.dataset_id = d.id OR wp.dataset_id = d.id
                ) as chunk_count,
                COUNT(DISTINCT w.id) as page_count
              FROM claude_context.datasets d
              LEFT JOIN claude_context.web_pages w ON w.dataset_id = d.id
              WHERE d.project_id = (SELECT id FROM claude_context.projects WHERE name = $1)
              GROUP BY d.id, d.name, d.is_global, d.updated_at
              ORDER BY d.updated_at DESC
            `,
          isAllProjects ? [] : [project]
        );

        const scopes: Record<ScopeLevel, ScopeResource[]> = {
          global: [],
          project: [],
          local: []
        };

        result.rows.forEach(row => {
          const scope = row.scope as ScopeLevel;
          if (scopes[scope]) {
            scopes[scope].push({
              id: row.id,
              type: 'dataset',
              name: row.name,
              updatedAt: new Date(row.updated_at).toLocaleString(),
              highlights: [
                `${row.chunk_count} chunks`,
                `${row.page_count} pages`
              ]
            });
          }
        });

        res.json(scopes);
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[API] /projects/:project/scopes error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /projects/:project/ingest/history
  router.get('/:project/ingest/history', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const isAllProjects = project.toLowerCase() === 'all';
      const client = await pool.connect();

      try {
        // Query both GitHub jobs and crawl sessions
        const githubResult = await client.query(
          isAllProjects
            ? `
              SELECT 
                gj.id,
                'github' as source,
                gj.status,
                gj.created_at as started_at,
                gj.completed_at,
                gj.repo_org || '/' || gj.repo_name as repo_name,
                gj.branch,
                gj.indexed_files,
                gj.total_chunks,
                gj.error,
                d.name as dataset,
                p.name as project_name,
                (gj.metadata->>'scope')::text as scope,
                EXTRACT(EPOCH FROM (COALESCE(gj.completed_at, NOW()) - gj.started_at)) as duration_seconds
              FROM claude_context.github_jobs gj
              JOIN claude_context.datasets d ON gj.dataset_id = d.id
              JOIN claude_context.projects p ON gj.project_id = p.id
              ORDER BY gj.created_at DESC
              LIMIT 10
            `
            : `
              SELECT 
                gj.id,
                'github' as source,
                gj.status,
                gj.created_at as started_at,
                gj.completed_at,
                gj.repo_org || '/' || gj.repo_name as repo_name,
                gj.branch,
                gj.indexed_files,
                gj.total_chunks,
                gj.error,
                d.name as dataset,
                p.name as project_name,
                (gj.metadata->>'scope')::text as scope,
                EXTRACT(EPOCH FROM (COALESCE(gj.completed_at, NOW()) - gj.started_at)) as duration_seconds
              FROM claude_context.github_jobs gj
              JOIN claude_context.datasets d ON gj.dataset_id = d.id
              JOIN claude_context.projects p ON gj.project_id = p.id
              WHERE p.name = $1
              ORDER BY gj.created_at DESC
              LIMIT 10
            `,
          isAllProjects ? [] : [project]
        );

        const crawlResult = await client.query(
          isAllProjects
            ? `
              SELECT 
                cs.id,
                'crawl' as source,
                cs.status,
                cs.started_at,
                cs.completed_at,
                cs.pages_crawled,
                cs.pages_failed,
                d.name as dataset,
                p.name as project_name,
                CASE 
                  WHEN d.is_global THEN 'global'
                  ELSE 'project'
                END as scope,
                EXTRACT(EPOCH FROM (COALESCE(cs.completed_at, NOW()) - cs.started_at)) as duration_seconds
              FROM claude_context.crawl_sessions cs
              JOIN claude_context.datasets d ON cs.dataset_id = d.id
              JOIN claude_context.projects p ON d.project_id = p.id
              ORDER BY cs.started_at DESC
              LIMIT 10
            `
            : `
              SELECT 
                cs.id,
                'crawl' as source,
                cs.status,
                cs.started_at,
                cs.completed_at,
                cs.pages_crawled,
                cs.pages_failed,
                d.name as dataset,
                p.name as project_name,
                CASE 
                  WHEN d.is_global THEN 'global'
                  ELSE 'project'
                END as scope,
                EXTRACT(EPOCH FROM (COALESCE(cs.completed_at, NOW()) - cs.started_at)) as duration_seconds
              FROM claude_context.crawl_sessions cs
              JOIN claude_context.datasets d ON cs.dataset_id = d.id
              JOIN claude_context.projects p ON d.project_id = p.id
              WHERE p.name = $1
              ORDER BY cs.started_at DESC
              LIMIT 10
            `,
          isAllProjects ? [] : [project]
        );

        // Combine and format jobs
        const githubJobs: IngestionJob[] = githubResult.rows.map(row => ({
          id: row.id,
          source: 'github',
          project: isAllProjects ? row.project_name : project,
          dataset: row.dataset,
          scope: (row.scope || 'project') as ScopeLevel,
          status: row.status === 'completed' ? 'completed' : 
                  row.status === 'failed' ? 'failed' : 
                  row.status === 'in_progress' ? 'running' : 'queued',
          startedAt: new Date(row.started_at).toLocaleTimeString(),
          duration: row.completed_at 
            ? `${Math.round(row.duration_seconds)}s`
            : '⏳ running',
          summary: row.indexed_files 
            ? `${row.repo_name} (${row.branch}): ${row.indexed_files} files, ${row.total_chunks} chunks`
            : `${row.repo_name} (${row.branch})`,
          error: row.error ? row.error : undefined
        }));

        const crawlJobs: IngestionJob[] = crawlResult.rows.map(row => ({
          id: row.id,
          source: 'crawl',
          project: isAllProjects ? row.project_name : project,
          dataset: row.dataset,
          scope: row.scope as ScopeLevel,
          status: row.status === 'completed' ? 'completed' : 
                  row.status === 'failed' ? 'failed' : 
                  row.status === 'running' ? 'running' : 'queued',
          startedAt: new Date(row.started_at).toLocaleTimeString(),
          duration: row.completed_at 
            ? `${Math.round(row.duration_seconds)}s`
            : '⏳ running',
          summary: `${row.pages_crawled || 0} pages crawled${row.pages_failed ? `, ${row.pages_failed} failed` : ''}`
        }));

        // Merge and sort by started_at
        const allJobs = [...githubJobs, ...crawlJobs].sort((a, b) => {
          const timeA = new Date(`1970-01-01 ${a.startedAt}`).getTime();
          const timeB = new Date(`1970-01-01 ${b.startedAt}`).getTime();
          return timeB - timeA;
        });

        res.json(allJobs);
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[API] /projects/:project/ingest/history error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /projects/:project/ingest/crawl
  router.post('/:project/ingest/crawl', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const isAllProjects = project.toLowerCase() === 'all';
      
      // Reject ingest operations for "all" projects
      if (isAllProjects) {
        return res.status(400).json({ 
          error: 'Cannot ingest to "all" projects. Please specify a concrete project name.' 
        });
      }
      
      const { start_url, crawl_type, max_pages, depth, dataset, scope } = req.body;
      const rawForce = req.body?.force;
      const force = rawForce === true || rawForce === 'true' || rawForce === 'on' || rawForce === 1 || rawForce === '1';

      if (!start_url) {
        return res.status(400).json({ error: 'start_url is required' });
      }

      const datasetName = dataset || 'web-pages';
      let datasetId: string | null = null;

      let client: PoolClient | null = null;
      try {
        client = await pool.connect();

        const projectResult = await client.query(
          'SELECT id FROM claude_context.projects WHERE name = $1',
          [project]
        );

        let projectId: string;
        if (projectResult.rows.length === 0) {
          const newProject = await client.query(
            'INSERT INTO claude_context.projects (name, description) VALUES ($1, $2) RETURNING id',
            [project, `Auto-created for crawl: ${start_url}`]
          );
          projectId = newProject.rows[0].id;
        } else {
          projectId = projectResult.rows[0].id;
        }

        const datasetResult = await client.query(
          'SELECT id FROM claude_context.datasets WHERE project_id = $1 AND name = $2',
          [projectId, datasetName]
        );

        if (datasetResult.rows.length === 0) {
          const newDataset = await client.query(
            'INSERT INTO claude_context.datasets (project_id, name, description, status) VALUES ($1, $2, $3, $4) RETURNING id',
            [projectId, datasetName, `Crawl dataset for ${start_url}`, 'active']
          );
          datasetId = newDataset.rows[0].id;
        } else {
          datasetId = datasetResult.rows[0].id;
        }

        if (!force && datasetId) {
          const existingCrawl = await client.query(
            `SELECT id, status, started_at, completed_at
               FROM claude_context.crawl_sessions
              WHERE dataset_id = $1
                AND metadata->>'start_url' = $2
              ORDER BY started_at DESC
              LIMIT 1`,
            [datasetId, start_url]
          );

          if (existingCrawl.rows.length > 0) {
            const session = existingCrawl.rows[0];
            if (session.status === 'completed') {
              return res.status(200).json({
                jobId: session.id,
                status: 'skipped',
                message: 'Crawl already completed for this URL. Pass force=true to crawl again.',
                project,
                dataset: datasetName,
                scope: scope || 'project',
                completedAt: session.completed_at,
                lastRunAt: session.completed_at || session.started_at
              });
            }

            if (session.status === 'queued' || session.status === 'running') {
              return res.status(200).json({
                jobId: session.id,
                status: session.status,
                message: 'Crawl already in progress. Pass force=true to enqueue another run.',
                project,
                dataset: datasetName,
                scope: scope || 'project'
              });
            }
          }
        }
      } finally {
        client?.release();
      }

      // Forward to Crawl4AI service
      const crawlResponse = await fetch(`${config.crawl4aiUrl}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [start_url],  // Crawl4AI expects 'urls' array, not 'start_url'
          project,
          dataset: datasetName,
          mode: crawl_type || 'recursive',  // 'mode' instead of 'crawl_type'
          max_pages: max_pages || 25,
          max_depth: depth || 2,  // 'max_depth' instead of 'depth'
          scope: scope || 'project',
          same_domain_only: true,
          auto_discovery: true,
          extract_code_examples: true
        })
      });

      if (!crawlResponse.ok) {
        const errorText = await crawlResponse.text();
        throw new Error(`Crawl4AI returned ${crawlResponse.status}: ${errorText}`);
      }

      const crawlData: any = await crawlResponse.json();
      const sessionId = crawlData.progress_id || crawlData.session_id || crawlData.jobId;

      // Track this session for progress monitoring with project/dataset context
      if (sessionId) {
        crawlMonitor.trackSession(sessionId, project, datasetName);
        console.log(`[API] Tracking crawl session ${sessionId} for project ${project}, dataset ${datasetName}`);
      }

      res.json({
        jobId: sessionId,
        status: 'queued',
        message: 'Crawl session initiated',
        force
      });
    } catch (error: any) {
      console.error('[API] /projects/:project/ingest/crawl error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /projects/:project/ingest/github
  router.post('/:project/ingest/github', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const isAllProjects = project.toLowerCase() === 'all';

      if (isAllProjects) {
        return res.status(400).json({
          error: 'Cannot ingest to "all" projects. Please specify a concrete project name.'
        });
      }

      const { repo, dataset, branch, sha, scope } = req.body ?? {};
      const rawForce = req.body?.force;
      const force = rawForce === true || rawForce === 'true' || rawForce === 'on' || rawForce === 1 || rawForce === '1';

      if (!repo || typeof repo !== 'string') {
        return res.status(400).json({ error: 'repo is required (e.g., github.com/org/repo)' });
      }

      // Parse repository URL
      let repoInfo;
      try {
        repoInfo = repoManager.parseRepoUrl(repo);
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }

      const client = await pool.connect();
      try {
        // Resolve project and dataset IDs
        const projectResult = await client.query(
          'SELECT id FROM claude_context.projects WHERE name = $1',
          [project]
        );

        let projectId: string;
        if (projectResult.rows.length === 0) {
          // Create project if it doesn't exist
          const newProject = await client.query(
            'INSERT INTO claude_context.projects (name, description) VALUES ($1, $2) RETURNING id',
            [project, `Auto-created for ${repoInfo.org}/${repoInfo.name}`]
          );
          projectId = newProject.rows[0].id;
        } else {
          projectId = projectResult.rows[0].id;
        }

        const datasetName = dataset || `${repoInfo.org}-${repoInfo.name}`;
        const datasetResult = await client.query(
          'SELECT id FROM claude_context.datasets WHERE project_id = $1 AND name = $2',
          [projectId, datasetName]
        );

        let datasetId: string;
        if (datasetResult.rows.length === 0) {
          // Create dataset if it doesn't exist
          const newDataset = await client.query(
            'INSERT INTO claude_context.datasets (project_id, name, description, status) VALUES ($1, $2, $3, $4) RETURNING id',
            [projectId, datasetName, `GitHub repository: ${repoInfo.org}/${repoInfo.name}`, 'active']
          );
          datasetId = newDataset.rows[0].id;
        } else {
          datasetId = datasetResult.rows[0].id;
        }

        // Prevent duplicate ingestion unless force flag is set
        const existingJobResult = await client.query(
          `SELECT id, status, completed_at, metadata, updated_at
             FROM claude_context.github_jobs
            WHERE project_id = $1
              AND dataset_id = $2
              AND repo_org = $3
              AND repo_name = $4
              AND branch = $5
              AND (sha IS NOT DISTINCT FROM $6)
            ORDER BY updated_at DESC
            LIMIT 1`,
          [projectId, datasetId, repoInfo.org, repoInfo.name, branch || 'main', sha || null]
        );

        if (!force && existingJobResult.rows.length > 0) {
          const existingJob = existingJobResult.rows[0];
          if (existingJob.status === 'completed') {
            return res.status(200).json({
              jobId: existingJob.id,
              status: 'skipped',
              message: 'GitHub ingest already completed. Pass force=true to reindex.',
              project,
              dataset: datasetName,
              repository: `${repoInfo.org}/${repoInfo.name}`,
              branch: branch || 'main',
              scope: scope || 'project',
              completedAt: existingJob.completed_at,
              lastRunAt: existingJob.completed_at || existingJob.updated_at
            });
          }

          if (existingJob.status === 'pending' || existingJob.status === 'in_progress') {
            return res.status(200).json({
              jobId: existingJob.id,
              status: existingJob.status === 'pending' ? 'queued' : 'running',
              message: 'GitHub ingest already in progress. Pass force=true to enqueue another run.',
              project,
              dataset: datasetName,
              repository: `${repoInfo.org}/${repoInfo.name}`,
              branch: branch || 'main',
              scope: scope || 'project'
            });
          }
        }

        // Insert job into github_jobs table
        const jobResult = await client.query(
          `INSERT INTO claude_context.github_jobs 
           (project_id, dataset_id, repo_url, repo_org, repo_name, branch, sha, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            projectId,
            datasetId,
            repoInfo.url,
            repoInfo.org,
            repoInfo.name,
            branch || 'main',
            sha || null,
            'pending',
            JSON.stringify({ scope: scope || 'project', force })
          ]
        );

        const jobId = jobResult.rows[0].id;

        // Enqueue job via pg-boss if available
        if (jobQueue) {
          try {
            await jobQueue.enqueueGitHubJob({
              jobId, // Pass the github_jobs table ID
              projectId,
              datasetId,
              repoUrl: repoInfo.url,
              repoOrg: repoInfo.org,
              repoName: repoInfo.name,
              branch: branch || 'main',
              sha: sha || undefined,
            scope: scope || 'project',
            force
            });
          } catch (queueError: any) {
            console.error('[API] Failed to enqueue job:', queueError);
            // Job is in database, worker will pick it up via polling
          }
        }

        res.status(202).json({
          jobId,
          status: 'queued',
          message: 'GitHub ingest job queued',
          project,
          dataset: datasetName,
          repository: `${repoInfo.org}/${repoInfo.name}`,
          branch: branch || 'main',
          scope: scope || 'project',
          force
        });
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[API] /projects/:project/ingest/github error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /projects/:project/ingest/github
  router.delete('/:project/ingest/github', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const isAllProjects = project.toLowerCase() === 'all';

      if (isAllProjects) {
        return res.status(400).json({
          error: 'Cannot delete from "all" projects. Please specify a concrete project name.'
        });
      }

      const datasetParam = typeof req.query.dataset === 'string' ? req.query.dataset : undefined;
      const repoParam = typeof req.query.repo === 'string' ? req.query.repo : undefined;
      const bodyDataset = typeof req.body?.dataset === 'string' ? req.body.dataset : undefined;
      const bodyRepo = typeof req.body?.repo === 'string' ? req.body.repo : undefined;

      const dataset = bodyDataset ?? datasetParam;
      const repo = bodyRepo ?? repoParam;

      if (!dataset && !repo) {
        return res.status(400).json({ error: 'Provide a dataset or repo to delete.' });
      }

      const result = await core.deleteGithubDataset(context, {
        project,
        dataset,
        repo
      });

      if (result.status === 'not_found') {
        return res.status(404).json({
          error: result.message || 'Dataset not found',
          project,
          dataset: result.dataset
        });
      }

      return res.json({
        project,
        dataset: result.dataset,
        projectId: result.projectId,
        datasetId: result.datasetId,
        deletedVectors: result.deletedVectors,
        status: result.status,
        message: result.message || 'GitHub dataset deleted'
      });
    } catch (error: any) {
      console.error('[API] /projects/:project/ingest/github DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /projects/:project/query
  router.post('/:project/query', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const body = req.body ?? {};
      const codebasePath: string = body.codebasePath
        || process.env.CODEBASE_PATH
        || process.env.DEFAULT_CODEBASE_PATH
        || process.cwd();

      if (!body.query || typeof body.query !== 'string') {
        return res.status(400).json({ error: 'query is required' });
      }

      const startTime = Date.now();
      const progressCallback = (phase: string, percentage: number, detail: string) => {
        wsManager.broadcast({
          type: 'query:progress',
          project,
          timestamp: new Date().toISOString(),
          data: { phase, percentage, detail }
        });
      };

      const result = await core.queryProject(
        context,
        {
          project,
          query: body.query,
          dataset: body.dataset,
          includeGlobal: body.includeGlobal,
          topK: body.topK,
          threshold: body.threshold,
          repo: body.repo,
          lang: body.lang,
          pathPrefix: body.pathPrefix ?? body.path_prefix,
          codebasePath
        },
        progressCallback
      );

      const latencyMs = result.metadata?.timingMs?.total ?? Date.now() - startTime;
      const toolInvocations = [
        'claudeContext.query',
        ...(result.metadata?.featuresUsed?.hybridSearch ? ['claudeContext.hybrid'] : []),
        ...(result.metadata?.featuresUsed?.reranking ? ['claudeContext.rerank'] : [])
      ];

      res.json({
        request_id: result.requestId,
        results: result.results,
        metadata: result.metadata,
        latency_ms: Math.round(latencyMs),
        tool_invocations: toolInvocations
      });
    } catch (error: any) {
      console.error('[API] /projects/:project/query error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /projects/:project/smart-query
  router.post('/:project/smart-query', async (req: Request, res: Response) => {
    try {
      if (typeof core.smartQueryProject !== 'function') {
        return res.status(503).json({ error: 'Smart query capability is not available in this build.' });
      }

      const { project } = req.params;
      const body = (req.body ?? {}) as SmartQueryRequestBody;
      const codebasePath: string = body.codebasePath
        || process.env.CODEBASE_PATH
        || process.env.DEFAULT_CODEBASE_PATH
        || process.cwd();

      if (!body.query || typeof body.query !== 'string') {
        return res.status(400).json({ error: 'query is required' });
      }

      const strategies: SmartStrategy[] = Array.isArray(body.strategies)
        ? body.strategies.filter((value: unknown): value is SmartStrategy =>
            typeof value === 'string' && (SMART_STRATEGIES as SmartStrategy[]).includes(value as SmartStrategy))
        : [...SMART_STRATEGIES];

      const normalizedStrategies: SmartStrategy[] = strategies.length > 0 ? strategies : ['multi-query'];

      const answerType: SmartAnswerType = body.answerType === 'structured'
        ? 'structured'
        : 'conversational';

      const progressCallback = (phase: string, percentage: number, detail: string) => {
        wsManager.broadcast({
          type: 'query:progress',
          project,
          timestamp: new Date().toISOString(),
          data: { phase, percentage, detail }
        });
      };

      const startTime = Date.now();

      const result = await core.smartQueryProject(
        context,
        {
          project,
          query: body.query,
          dataset: body.dataset,
          includeGlobal: body.includeGlobal,
          topK: body.topK,
          threshold: body.threshold,
          repo: body.repo,
          lang: body.lang,
          pathPrefix: body.pathPrefix ?? body.path_prefix,
          codebasePath,
          strategies: normalizedStrategies,
          answerType,
        },
        progressCallback
      );

      const latencyMs = result.metadata?.timingMs?.total ?? Date.now() - startTime;

      res.json({
        request_id: result.requestId,
        answer: result.answer,
        retrievals: result.retrievals,
        metadata: result.metadata,
        latency_ms: Math.round(latencyMs),
        tool_invocations: [
          'claudeContext.smartQuery',
          'LLM',
          ...(normalizedStrategies.includes('multi-query') ? ['smartQuery.multi'] : []),
          ...(normalizedStrategies.includes('refinement') ? ['smartQuery.refine'] : []),
          ...(normalizedStrategies.includes('concept-extraction') ? ['smartQuery.concepts'] : []),
        ]
      });
    } catch (error: any) {
      console.error('[API] /projects/:project/smart-query error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /projects/:project/operations
  router.get('/:project/operations', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const isAllProjects = project.toLowerCase() === 'all';
      const client = await pool.connect();

      try {
        const result = await client.query(
          isAllProjects
            ? `
              SELECT 
                cs.id,
                cs.status,
                cs.started_at,
                cs.pages_crawled,
                cs.pages_failed,
                d.name as dataset,
                CASE 
                  WHEN d.is_global THEN 'global'
                  ELSE 'project'
                END as scope
              FROM claude_context.crawl_sessions cs
              JOIN claude_context.datasets d ON cs.dataset_id = d.id
              JOIN claude_context.projects p ON d.project_id = p.id
              WHERE cs.started_at > NOW() - INTERVAL '6 hours'
              ORDER BY cs.started_at DESC
              LIMIT 50
            `
            : `
              SELECT 
                cs.id,
                cs.status,
                cs.started_at,
                cs.pages_crawled,
                cs.pages_failed,
                d.name as dataset,
                CASE 
                  WHEN d.is_global THEN 'global'
                  ELSE 'project'
                END as scope
              FROM claude_context.crawl_sessions cs
              JOIN claude_context.datasets d ON cs.dataset_id = d.id
              JOIN claude_context.projects p ON d.project_id = p.id
              WHERE p.name = $1 AND cs.started_at > NOW() - INTERVAL '6 hours'
              ORDER BY cs.started_at DESC
              LIMIT 50
            `,
          isAllProjects ? [] : [project]
        );

        const operations: OperationsEvent[] = result.rows.map(row => {
          const impact = row.status === 'completed' ? 'success' :
                        row.status === 'failed' ? 'incident' : 'warning';
          
          return {
            title: `Crawl ${row.status}: ${row.dataset}`,
            detail: `${row.pages_crawled || 0} pages crawled${row.pages_failed ? `, ${row.pages_failed} failed` : ''}`,
            timestamp: new Date(row.started_at).toLocaleTimeString(),
            scope: row.scope as ScopeLevel,
            impact
          };
        });

        res.json(operations);
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[API] /projects/:project/operations error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /projects/:project/share
  router.post('/:project/share', async (req: Request, res: Response) => {
    try {
      const { project } = req.params;
      const isAllProjects = project.toLowerCase() === 'all';
      
      // Reject share operations for "all" projects
      if (isAllProjects) {
        return res.status(400).json({ 
          error: 'Cannot share from "all" projects. Please specify a concrete project name.' 
        });
      }
      
      const { to_project, resource_type, resource_id, expires_at } = req.body;

      if (!to_project || !resource_type || !resource_id) {
        return res.status(400).json({ 
          error: 'to_project, resource_type, and resource_id are required' 
        });
      }
      
      // Also reject sharing to "all"
      if (to_project.toLowerCase() === 'all') {
        return res.status(400).json({ 
          error: 'Cannot share to "all" projects. Please specify a concrete target project name.' 
        });
      }

      const client = await pool.connect();
      try {
        await client.query(`
          INSERT INTO claude_context.project_shares (from_project_id, to_project_id, resource_type, resource_id, expires_at)
          SELECT 
            (SELECT id FROM claude_context.projects WHERE name = $1),
            (SELECT id FROM claude_context.projects WHERE name = $2),
            $3, $4, $5
        `, [project, to_project, resource_type, resource_id, expires_at || null]);

        res.json({ message: 'Resource shared successfully' });
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[API] /projects/:project/share error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
