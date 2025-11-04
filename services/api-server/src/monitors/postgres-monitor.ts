import { Pool, Client } from 'pg';
import { QdrantClient } from '@qdrant/qdrant-js';
import { PostgresStats, WebSocketMessage } from '../types';
import { config } from '../config';

export class PostgresMonitor {
  private pool: Pool;
  private qdrantClient: QdrantClient;
  private listenerClient?: Client;
  private intervalId?: NodeJS.Timeout;
  private lastSnapshot: string = '';
  private onUpdate?: (message: WebSocketMessage) => void;
  private lastNotificationAt?: number;

  constructor(pool: Pool) {
    this.pool = pool;
    this.qdrantClient = new QdrantClient({ url: config.qdrantUrl });
  }

  async start(onUpdate: (message: WebSocketMessage) => void): Promise<void> {
    if (this.intervalId) {
      return;
    }

    this.onUpdate = onUpdate;
    this.log('Starting event-driven monitoring with LISTEN/NOTIFY...');
    
    // Start PostgreSQL listener for stats updates
    await this.startListener();
    
    // Send initial stats immediately
    await this.updateStats();
    
    // Keep minimal polling as fallback (every 30 seconds) in case notifications fail
    this.intervalId = setInterval(() => {
      this.updateStats();
    }, 30000); // 30 seconds fallback instead of 1 second
  }

  private async startListener(): Promise<void> {
    if (this.listenerClient) {
      return;
    }

    try {
      // Get connection string from pool
      const poolConfig = (this.pool as any).options;
      const connectionString = poolConfig.connectionString || 
        `postgres://${poolConfig.user}:${poolConfig.password}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`;

      this.listenerClient = new Client({ connectionString });
      await this.listenerClient.connect();

      // Listen for stats updates from database triggers
      await this.listenerClient.query('LISTEN stats_updates');
      await this.listenerClient.query('LISTEN github_job_updates'); // Also listen for job completions

      this.listenerClient.on('notification', (msg) => {
        if (msg.channel === 'stats_updates' || msg.channel === 'github_job_updates') {
          // Trigger stats recalculation when data changes
          const now = Date.now();
          const sinceLast = this.lastNotificationAt ? `${((now - this.lastNotificationAt) / 1000).toFixed(2)}s` : 'first event';
          this.lastNotificationAt = now;
          this.log(`Notification on ${msg.channel}, updating stats (since last: ${sinceLast})`);
          this.updateStats();
        }
      });

      this.listenerClient.on('error', (error) => {
        this.error('Listener error', error);
        // Try to reconnect
        this.listenerClient = undefined;
        setTimeout(() => this.startListener(), 5000);
      });

      this.log('PostgreSQL listener started for stats_updates');
    } catch (error: any) {
      this.error('Failed to start listener', error);
      this.log('Falling back to polling only');
    }
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.listenerClient) {
      try {
        await this.listenerClient.query('UNLISTEN stats_updates');
        await this.listenerClient.query('UNLISTEN github_job_updates');
        await this.listenerClient.end();
      } catch (error: any) {
        this.error('Error stopping listener', error);
      }
      this.listenerClient = undefined;
    }

    this.log('Stopped monitoring');
  }

  /**
   * Manually trigger stats update (useful for immediate updates on client subscription)
   */
  async updateStats(): Promise<void> {
    if (!this.onUpdate) return;
    
    try {
      const started = process.hrtime.bigint();
      const stats = await this.pollStats();
      const snapshot = JSON.stringify(stats);
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      
      // Always emit on manual update, otherwise only emit if data changed
      const forceUpdate = !this.lastSnapshot;
      if (forceUpdate || snapshot !== this.lastSnapshot) {
        this.lastSnapshot = snapshot;
        
        // Emit a message for each project with their specific crawl sessions
        stats.projects.forEach(project => {
          const projectCrawls = stats.recentCrawls.filter(c => c.project === project.name);
          this.onUpdate!({
            type: 'postgres:stats',
            project: project.name,
            timestamp: new Date().toISOString(),
            data: {
              ...stats,
              recentCrawls: projectCrawls
            }
          });
        });
        
        // Emit aggregated "all" projects message
        const aggregatedStats = {
          projects: [{
            name: 'all',
            datasets: stats.projects.reduce((sum, p) => sum + p.datasets, 0),
            chunks: stats.projects[0]?.chunks || 0, // Total chunks (same for all since it's a global count)
            webPages: stats.projects.reduce((sum, p) => sum + p.webPages, 0)
          }],
          recentCrawls: stats.recentCrawls
        };
        
        this.onUpdate({
          type: 'postgres:stats',
          project: 'all',
          timestamp: new Date().toISOString(),
          data: aggregatedStats
        });
        
        // Also send a global update for UI initialization
        this.onUpdate({
          type: 'postgres:stats',
          timestamp: new Date().toISOString(),
          data: stats
        });

        this.log(
          `Stats refreshed in ${durationMs.toFixed(1)}ms (projects=${stats.projects.length}, recentCrawls=${stats.recentCrawls.length})`
        );
      } else {
        this.log(`Stats unchanged after ${durationMs.toFixed(1)}ms, skipping broadcast`);
      }
    } catch (error: any) {
      this.error('Poll error', error);
      if (this.onUpdate) {
        this.onUpdate({
          type: 'error',
          timestamp: new Date().toISOString(),
          data: {
            source: 'postgres',
            message: 'Failed to poll Postgres stats',
            details: error.message
          }
        });
      }
    }
  }

  private async getQdrantChunkCount(): Promise<number> {
    try {
      const started = process.hrtime.bigint();
      const collections = await this.qdrantClient.getCollections();
      let totalChunks = 0;
      
      for (const collection of collections.collections) {
        // Count chunks from all code/content collections:
        // - hybrid_code_chunks_* (GitHub ingestion)
        // - code_chunks_* (legacy GitHub)
        // - project_* (Crawl4AI web ingestion)
        if (collection.name.startsWith('hybrid_code_chunks_') || 
            collection.name.startsWith('code_chunks_') ||
            collection.name.startsWith('project_')) {
          try {
            const info = await this.qdrantClient.getCollection(collection.name);
            totalChunks += info.points_count || 0;
          } catch (error: any) {
            this.warn(`Failed to get collection ${collection.name}`, error);
          }
        }
      }
      
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      this.log(`Qdrant chunk count refreshed in ${durationMs.toFixed(1)}ms (collections=${collections.collections.length}, totalChunks=${totalChunks})`);

      return totalChunks;
    } catch (error: any) {
      this.warn('Failed to get Qdrant chunk count', error);
      return 0;
    }
  }

  private async pollStats(): Promise<PostgresStats> {
    const client = await this.pool.connect();
    const started = process.hrtime.bigint();
    try {
      // Get Qdrant chunk count (for GitHub ingestion chunks)
      const qdrantChunks = await this.getQdrantChunkCount();

      // Query project statistics
      const projectsResult = await client.query(`
        SELECT 
          p.name,
          COUNT(DISTINCT d.id) as datasets,
          (SELECT COUNT(*) FROM claude_context.chunks) as chunks,
          COUNT(DISTINCT w.id) as web_pages
        FROM claude_context.projects p
        LEFT JOIN claude_context.datasets d ON d.project_id = p.id
        LEFT JOIN claude_context.web_pages w ON w.dataset_id = d.id
        GROUP BY p.name, p.created_at
        ORDER BY p.created_at DESC
        LIMIT 10
      `);

      // Query recent crawl sessions
      const crawlsResult = await client.query(`
        SELECT 
          cs.id as session_id,
          p.name as project,
          d.name as dataset,
          cs.status,
          cs.pages_crawled,
          cs.pages_failed,
          EXTRACT(EPOCH FROM (cs.completed_at - cs.started_at)) * 1000 as duration_ms
        FROM claude_context.crawl_sessions cs
        JOIN claude_context.datasets d ON cs.dataset_id = d.id
        JOIN claude_context.projects p ON d.project_id = p.id
        WHERE cs.started_at > NOW() - INTERVAL '1 hour'
        ORDER BY cs.started_at DESC
        LIMIT 20
      `);

      const postgresChunks = parseInt(projectsResult.rows[0]?.chunks || '0', 10);
      const totalChunks = postgresChunks + qdrantChunks;
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      this.log(`Postgres stats query completed in ${durationMs.toFixed(1)}ms (projects=${projectsResult.rows.length}, crawls=${crawlsResult.rows.length}, qdrantExtra=${qdrantChunks})`);

      return {
        projects: projectsResult.rows.map(row => ({
          name: row.name,
          datasets: parseInt(row.datasets || '0', 10),
          chunks: totalChunks, // Combined PostgreSQL + Qdrant chunk count
          webPages: parseInt(row.web_pages || '0', 10)
        })),
        recentCrawls: crawlsResult.rows.map(row => ({
          sessionId: row.session_id,
          project: row.project,
          dataset: row.dataset,
          status: row.status,
          pagesCrawled: parseInt(row.pages_crawled || '0', 10),
          pagesFailed: parseInt(row.pages_failed || '0', 10),
          durationMs: parseFloat(row.duration_ms || '0')
        }))
      };
    } finally {
      client.release();
    }
  }

  private log(message: string): void {
    console.log(`[PostgresMonitor][${new Date().toISOString()}] ${message}`);
  }

  private warn(message: string, error?: any): void {
    const detail = error?.message ?? error?.toString?.() ?? error ?? '';
    console.warn(`[PostgresMonitor][${new Date().toISOString()}][warn] ${message}${detail ? ` :: ${detail}` : ''}`);
  }

  private error(message: string, error: any): void {
    const detail = error?.message ?? error?.toString?.() ?? error ?? '';
    console.error(`[PostgresMonitor][${new Date().toISOString()}][error] ${message}${detail ? ` :: ${detail}` : ''}`);
  }
}
