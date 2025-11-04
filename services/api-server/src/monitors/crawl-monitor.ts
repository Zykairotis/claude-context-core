import { Pool } from 'pg';
import { CrawlProgress, WebSocketMessage } from '../types';
import { config } from '../config';

interface SessionMetadata {
  sessionId: string;
  project?: string;
  dataset?: string;
  datasetId?: string;
  startUrl?: string;
  dbId?: string;
}

export class CrawlMonitor {
  constructor(private readonly pool: Pool) {}

  private intervalId?: NodeJS.Timeout;
  private activeSessions: Map<string, SessionMetadata> = new Map();

  start(onUpdate: (message: WebSocketMessage) => void): void {
    if (this.intervalId) {
      return;
    }

    console.log('[CrawlMonitor] Starting polling...');

    this.intervalId = setInterval(async () => {
      for (const [sessionId, metadata] of this.activeSessions.entries()) {
        try {
          const progress = await this.pollProgress(sessionId, metadata);
          if (progress) {
            onUpdate({
              type: 'crawl:progress',
              project: metadata.project,
              sessionId: progress.sessionId,
              progressId: progress.sessionId,  // Backward compat
              timestamp: new Date().toISOString(),
              data: progress
            });

            // Remove completed or failed sessions
            if (progress.status === 'completed' || progress.status === 'failed') {
              this.activeSessions.delete(sessionId);
              console.log(`[CrawlMonitor] Session ${sessionId} ${progress.status}, stopped tracking`);
            }
          }
        } catch (error: any) {
          console.error(`[CrawlMonitor] Failed to poll session ${sessionId}:`, error.message);
          this.activeSessions.delete(sessionId);
        }
      }
    }, config.crawlPollingInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[CrawlMonitor] Stopped polling');
    }
  }

  async trackSession(
    sessionId: string,
    options: { project?: string; dataset?: string; datasetId?: string | null; startUrl?: string } = {}
  ): Promise<void> {
    const metadata: SessionMetadata = {
      sessionId,
      project: options.project,
      dataset: options.dataset,
      datasetId: options.datasetId ?? undefined,
      startUrl: options.startUrl
    };

    this.activeSessions.set(sessionId, metadata);

    if (metadata.datasetId) {
      await this.createOrResetSessionRecord(metadata);
    }

    console.log(
      `[CrawlMonitor] Tracking session: ${sessionId} (project: ${options.project || 'unknown'}, dataset: ${options.dataset || 'unknown'})`
    );
  }

  private async pollProgress(sessionId: string, metadata: SessionMetadata): Promise<CrawlProgress | null> {
    try {
      const response = await fetch(`${config.crawl4aiBaseUrl}/progress/${sessionId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data: any = await response.json();
      const percentage = data.percentage ?? data.progress ?? 0;
      const status: string = data.status || (percentage >= 100 ? 'completed' : 'running');

      const progress: CrawlProgress = {
        sessionId,
        project: metadata.project,
        dataset: metadata.dataset,
        phase: data.phase || data.current_phase || 'unknown',
        percentage,
        current: data.current ?? 0,
        total: data.total ?? 0,
        status,
        currentPhase: data.current_phase || data.phase || 'unknown',
        phaseDetail: data.phase_detail || data.phaseDetail,
        chunksTotal: data.chunks_total ?? data.total ?? 0,
        chunksProcessed: data.chunks_processed ?? data.current ?? 0,
        summariesGenerated: data.summaries_generated ?? 0,
        embeddingsGenerated: data.embeddings_generated ?? 0
      };

      await this.syncSessionRecord(progress, metadata);

      return progress;
    } catch (error: any) {
      console.error(`[CrawlMonitor] Error polling ${sessionId}:`, error.message);
      return null;
    }
  }

  private async createOrResetSessionRecord(
    metadata: SessionMetadata,
    options: { status?: string; metadataPatch?: Record<string, unknown>; pagesCrawled?: number } = {}
  ): Promise<void> {
    if (!metadata.datasetId) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query(
        `DELETE FROM claude_context.crawl_sessions WHERE dataset_id = $1 AND external_id = $2`,
        [metadata.datasetId, metadata.sessionId]
      );

      const status = options.status ?? 'running';
      const pagesCrawled = options.pagesCrawled ?? 0;
      const metadataPatch: Record<string, unknown> = {
        project: metadata.project,
        dataset: metadata.dataset,
        start_url: metadata.startUrl ?? null,
        progress: 0,
        ...(options.metadataPatch ?? {})
      };
      if (metadataPatch['progress'] === undefined || metadataPatch['progress'] === null) {
        metadataPatch['progress'] = 0;
      }

      const result = await client.query(
        `INSERT INTO claude_context.crawl_sessions 
          (dataset_id, external_id, status, metadata, pages_crawled, pages_failed, started_at, updated_at, completed_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, 0, NOW(), NOW(), CASE WHEN $3 IN ('completed','failed','cancelled') THEN NOW() ELSE NULL END)
         RETURNING id`,
        [
          metadata.datasetId,
          metadata.sessionId,
          status,
          JSON.stringify(metadataPatch),
          pagesCrawled
        ]
      );

      metadata.dbId = result.rows[0]?.id;
    } catch (error: any) {
      console.error('[CrawlMonitor] Failed to record crawl session start:', error.message);
    } finally {
      client.release();
    }
  }

  private async syncSessionRecord(progress: CrawlProgress, metadata: SessionMetadata): Promise<void> {
    if (!metadata.datasetId) {
      return;
    }

    const client = await this.pool.connect();
    try {
      const isTerminal = ['completed', 'failed', 'cancelled'].includes(progress.status);
      const pagesCrawled = progress.current ?? progress.chunksProcessed ?? 0;
      const metadataPatch: Record<string, unknown> = {
        progress: progress.percentage ?? 0,
        phase: progress.currentPhase,
        phase_detail: progress.phaseDetail,
        last_update: new Date().toISOString()
      };

      const result = await client.query(
        `UPDATE claude_context.crawl_sessions
         SET status = $3,
             pages_crawled = GREATEST(COALESCE(pages_crawled, 0), $4),
             metadata = metadata || $5::jsonb,
             completed_at = CASE WHEN $6 THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE dataset_id = $1 AND external_id = $2`,
        [
          metadata.datasetId,
          progress.sessionId,
          progress.status,
          pagesCrawled,
          JSON.stringify(metadataPatch),
          isTerminal
        ]
      );

      if (result.rowCount === 0) {
        // Record may have been removed; recreate with current status to keep UI consistent
        await this.createOrResetSessionRecord(metadata, {
          status: progress.status,
          metadataPatch,
          pagesCrawled
        });
      }
    } catch (error: any) {
      console.error('[CrawlMonitor] Failed to sync crawl session status:', error.message);
    } finally {
      client.release();
    }
  }
}
