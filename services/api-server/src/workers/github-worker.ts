import { Pool } from 'pg';
import { JobQueue, GitHubJobPayload } from '../services/job-queue';
import { RepositoryManager } from '../services/repository-manager';
import { getProgressTracker } from '../services/progress-tracker';
import PgBoss from 'pg-boss';
import { loadCore } from '../core/core-loader';

interface WorkerConfig {
  pool: Pool;
  jobQueue: JobQueue;
}

export class GitHubWorker {
  private pool: Pool;
  private jobQueue: JobQueue;
  private repoManager: RepositoryManager;
  private core: any;
  private isRunning: boolean = false;

  constructor(config: WorkerConfig) {
    this.pool = config.pool;
    this.jobQueue = config.jobQueue;
    this.repoManager = new RepositoryManager();
    this.core = loadCore(); // Load core module once at construction
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[GitHubWorker] Already running');
      return;
    }

    console.log('[GitHubWorker] Starting worker...');
    this.isRunning = true;

    // Register worker with pg-boss
    await this.jobQueue.registerWorker(
      'github-ingest',
      async (job: PgBoss.Job<GitHubJobPayload>) => {
        await this.processJob(job);
      }
    );

    console.log('[GitHubWorker] Worker started and listening for jobs');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[GitHubWorker] Stopping worker...');
    this.isRunning = false;
    await this.repoManager.cleanupAll();
    console.log('[GitHubWorker] Worker stopped');
  }

  private async processJob(job: PgBoss.Job<GitHubJobPayload>): Promise<void> {
    const payload = job.data;
    const jobId = payload.jobId; // Use the github_jobs table ID from payload

    console.log(`[GitHubWorker] Processing job:`, payload);

    // Get project and dataset names first
    const jobInfo = await this.pool.query(
      `SELECT p.name as project_name, d.name as dataset_name
       FROM claude_context.github_jobs gj
       JOIN claude_context.projects p ON gj.project_id = p.id
       JOIN claude_context.datasets d ON gj.dataset_id = d.id
       WHERE gj.id = $1`,
      [jobId]
    );

    if (jobInfo.rows.length === 0) {
      throw new Error('Job not found in database');
    }

    const { project_name, dataset_name } = jobInfo.rows[0];

    // Start tracking progress
    const progressTracker = getProgressTracker();
    const operationId = progressTracker.startOperation(
      'github-ingest',
      project_name,
      dataset_name,
      jobId // Use jobId as the operation ID
    );

    // Update job status to in_progress
    await this.updateJobStatus(jobId!, 'in_progress', 0, 'Starting repository clone');
    progressTracker.updateProgress(operationId, {
      status: 'in_progress',
      phase: 'Cloning',
      progress: 0,
      message: 'Starting repository clone'
    });

    let localPath: string | null = null;

    try {
      // Clone repository
      await this.updateJobStatus(jobId!, 'in_progress', 10, 'Cloning repository');
      progressTracker.updateProgress(operationId, {
        status: 'in_progress',
        phase: 'Cloning',
        progress: 10,
        message: 'Cloning repository from GitHub'
      });

      localPath = await this.repoManager.clone(payload.repoUrl, {
        branch: payload.branch,
        depth: 1,
        auth: process.env.GITHUB_TOKEN ? {
          username: 'x-access-token',
          token: process.env.GITHUB_TOKEN
        } : undefined,
        onProgress: async (progress) => {
          const percent = Math.min(10 + Math.floor(progress.progress * 0.3), 40);
          await this.updateJobStatus(
            jobId!,
            'in_progress',
            percent,
            `Cloning: ${progress.stage} ${progress.progress}%`
          );
          progressTracker.updateProgress(operationId, {
            status: 'in_progress',
            phase: 'Cloning',
            progress: percent,
            message: `Cloning: ${progress.stage} ${progress.progress}%`
          });
        }
      });

      console.log(`[GitHubWorker] Cloned ${payload.repoUrl} to ${localPath}`);

      // Get current SHA
      const currentSha = await this.repoManager.getCurrentSha(localPath);

      // Update job with SHA
      await this.pool.query(
        'UPDATE claude_context.github_jobs SET sha = $1 WHERE id = $2',
        [currentSha, jobId]
      );

      // Get ingestGithubRepository from core
      await this.updateJobStatus(jobId!, 'in_progress', 45, 'Loading indexing engine...');
      progressTracker.updateProgress(operationId, {
        status: 'in_progress',
        phase: 'Loading',
        progress: 45,
        message: 'Loading indexing engine'
      });

      const { ingestGithubRepository } = this.core;

      // Create context instance
      const context = await this.createContext();

      // Update status: Indexing
      await this.updateJobStatus(jobId!, 'in_progress', 50, 'Indexing codebase');
      progressTracker.updateProgress(operationId, {
        status: 'in_progress',
        phase: 'Indexing',
        progress: 50,
        message: 'Indexing codebase files'
      });

      const result = await ingestGithubRepository(context, {
        project: project_name,
        dataset: dataset_name,
        repo: `${payload.repoOrg}/${payload.repoName}`,
        codebasePath: localPath,
        branch: payload.branch,
        sha: currentSha,
        forceReindex: payload.force,
        onProgress: async (progress: any) => {
          const percent = 50 + Math.floor((progress.percentage || 0) * 0.45);
          await this.updateJobStatus(
            jobId!,
            'in_progress',
            Math.min(percent, 95),
            progress.phase || 'Indexing...',
            progress.current ? `${progress.current}/${progress.total}` : undefined
          );
          progressTracker.updateProgress(operationId, {
            status: 'in_progress',
            phase: progress.phase || 'Indexing...',
            progress: Math.min(percent, 95),
            message: progress.current ? `${progress.current}/${progress.total}` : undefined
          });
        }
      });

      // Update job as completed
      await this.pool.query(
        `UPDATE claude_context.github_jobs 
         SET status = $1, 
             progress = $2, 
             completed_at = NOW(),
             indexed_files = $3,
             total_chunks = $4,
             current_phase = $5
         WHERE id = $6`,
        ['completed', 100, result.stats?.indexedFiles || 0, result.stats?.totalChunks || 0, 'Completed', jobId]
      );
      progressTracker.completeOperation(operationId);

      console.log(`[GitHubWorker] Job ${jobId} completed successfully`);
    } catch (error: any) {
      console.error(`[GitHubWorker] Job ${jobId} failed:`, error);

      const errorMessage = error.message || 'Unknown error';
      await this.updateJobStatus(
        jobId!,
        'failed',
        0,
        'Failed',
        errorMessage
      );
      if (progressTracker && operationId) {
        progressTracker.failOperation(operationId, errorMessage);
      }

      throw error;
    } finally {
      // Cleanup cloned repository
      if (localPath) {
        try {
          await this.repoManager.cleanup(localPath);
        } catch (cleanupError) {
          console.error(`[GitHubWorker] Cleanup failed for ${localPath}:`, cleanupError);
        }
      }
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: string,
    progress: number,
    phase: string,
    currentFile?: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE claude_context.github_jobs 
         SET status = $1::claude_context.github_job_status, 
             progress = $2, 
             current_phase = $3,
             current_file = $4,
             updated_at = NOW(),
             started_at = COALESCE(started_at, NOW())
         WHERE id = $5`,
        [status, progress, phase, currentFile || null, jobId]
      );
    } catch (error) {
      console.error(`[GitHubWorker] Failed to update job status:`, error);
    }
  }

  private async createContext(): Promise<any> {
    const { Context, AutoEmbeddingMonster, OpenAIEmbedding, QdrantVectorDatabase } = this.core;

    // Create embedding provider
    const embeddingProvider = process.env.EMBEDDING_PROVIDER?.toLowerCase();
    let embedding;

    if (embeddingProvider === 'openai' && process.env.OPENAI_API_KEY) {
      embedding = new OpenAIEmbedding({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL
      });
    } else {
      embedding = new AutoEmbeddingMonster({
        gteHost: process.env.STELLA_HOST || 'localhost',
        coderankHost: process.env.CODERANK_HOST || 'localhost',
        gtePort: Number(process.env.STELLA_PORT || 30001),
        coderankPort: Number(process.env.CODERANK_PORT || 30002),
        concurrency: Number(process.env.EMBEDDING_CONCURRENCY || 16),
        batchSizePerRequest: Number(process.env.EMBEDDING_BATCH_SIZE_PER_REQUEST || 32)
      });
    }

    // Create vector database (Qdrant)
    const vectorDatabase = new QdrantVectorDatabase({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });

    // Create context
    const context = new Context({
      vectorDatabase,
      embedding,
      postgresPool: this.pool
    });

    return context;
  }
}

