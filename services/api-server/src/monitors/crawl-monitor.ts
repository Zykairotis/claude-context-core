import { CrawlProgress, WebSocketMessage } from '../types';
import { config } from '../config';

interface SessionMetadata {
  sessionId: string;
  project?: string;
  dataset?: string;
}

export class CrawlMonitor {
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

  trackSession(sessionId: string, project?: string, dataset?: string): void {
    this.activeSessions.set(sessionId, { sessionId, project, dataset });
    console.log(`[CrawlMonitor] Tracking session: ${sessionId} (project: ${project || 'unknown'}, dataset: ${dataset || 'unknown'})`);
  }

  private async pollProgress(sessionId: string, metadata: SessionMetadata): Promise<CrawlProgress | null> {
    try {
      const response = await fetch(`${config.crawl4aiUrl}/progress/${sessionId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data: any = await response.json();

      return {
        sessionId,
        project: metadata.project,
        dataset: metadata.dataset,
        phase: data.phase || data.current_phase || 'unknown',
        percentage: data.percentage ?? data.progress ?? 0,
        current: data.current ?? 0,
        total: data.total ?? 0,
        status: data.status || 'running',
        currentPhase: data.current_phase || data.phase || 'unknown',
        phaseDetail: data.phase_detail || data.phaseDetail,
        chunksTotal: data.chunks_total ?? data.total ?? 0,
        chunksProcessed: data.chunks_processed ?? data.current ?? 0,
        summariesGenerated: data.summaries_generated ?? 0,
        embeddingsGenerated: data.embeddings_generated ?? 0
      };
    } catch (error: any) {
      console.error(`[CrawlMonitor] Error polling ${sessionId}:`, error.message);
      return null;
    }
  }
}
