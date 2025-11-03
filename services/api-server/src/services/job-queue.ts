import PgBoss from 'pg-boss';
import { Pool } from 'pg';

export interface GitHubJobPayload {
  jobId: string; // github_jobs table ID
  projectId: string;
  datasetId: string;
  repoUrl: string;
  repoOrg: string;
  repoName: string;
  branch: string;
  sha?: string;
  scope: string;
  force?: boolean;
}

export interface JobQueueConfig {
  pool: Pool;
  schema?: string;
  retryLimit?: number;
  retryDelay?: number;
  expireInHours?: number;
}

export class JobQueue {
  private boss: PgBoss | null = null;
  private config: JobQueueConfig;

  constructor(config: JobQueueConfig) {
    this.config = {
      schema: 'claude_context',
      retryLimit: 3,
      retryDelay: 60,
      expireInHours: 24,
      ...config
    };
  }

  async start(): Promise<void> {
    if (this.boss) {
      console.log('[JobQueue] Already started');
      return;
    }

    // Get connection string from pool
    const connectionString = this.getConnectionString();

    this.boss = new PgBoss({
      connectionString,
      schema: this.config.schema
    });

    this.boss.on('error', (error) => {
      console.error('[JobQueue] Error:', error);
    });

    await this.boss.start();
    console.log('[JobQueue] Started successfully');
  }

  async stop(): Promise<void> {
    if (!this.boss) {
      return;
    }

    await this.boss.stop();
    this.boss = null;
    console.log('[JobQueue] Stopped');
  }

  async enqueueGitHubJob(payload: GitHubJobPayload): Promise<string> {
    if (!this.boss) {
      throw new Error('JobQueue not started');
    }

    const jobId = await this.boss.send(
      'github-ingest',
      payload,
      {
        retryLimit: this.config.retryLimit,
        retryDelay: this.config.retryDelay,
        singletonKey: `${payload.projectId}:${payload.repoOrg}/${payload.repoName}:${payload.branch}`
      }
    );

    if (!jobId) {
      throw new Error('Failed to enqueue job');
    }

    console.log(`[JobQueue] Enqueued GitHub job ${jobId} for ${payload.repoOrg}/${payload.repoName}`);
    return jobId;
  }

  async getJobStatus(jobId: string): Promise<any> {
    if (!this.boss) {
      throw new Error('JobQueue not started');
    }

    return await this.boss.getJobById(jobId);
  }

  async cancelJob(jobId: string): Promise<void> {
    if (!this.boss) {
      throw new Error('JobQueue not started');
    }

    await this.boss.cancel(jobId);
    console.log(`[JobQueue] Cancelled job ${jobId}`);
  }

  async registerWorker(
    queueName: string,
    handler: (job: PgBoss.Job<any>) => Promise<any>
  ): Promise<string> {
    if (!this.boss) {
      throw new Error('JobQueue not started');
    }

    const workerId = await this.boss.work(queueName, handler);

    console.log(`[JobQueue] Registered worker ${workerId} for queue: ${queueName}`);
    return workerId;
  }

  private getConnectionString(): string {
    // Extract connection string from pool config
    const poolConfig = (this.config.pool as any).options;
    
    if (poolConfig.connectionString) {
      return poolConfig.connectionString;
    }

    // Build connection string from individual components
    const { host, port, database, user, password } = poolConfig;
    return `postgres://${user}:${password}@${host}:${port}/${database}`;
  }

  getBoss(): PgBoss | null {
    return this.boss;
  }
}

