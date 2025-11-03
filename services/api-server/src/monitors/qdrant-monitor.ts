import { QdrantClient } from '@qdrant/qdrant-js';
import { QdrantStats, WebSocketMessage } from '../types';
import { config } from '../config';

export class QdrantMonitor {
  private client: QdrantClient;
  private intervalId?: NodeJS.Timeout;
  private lastSnapshot: string = '';

  constructor() {
    this.client = new QdrantClient({ url: config.qdrantUrl });
  }

  start(onUpdate: (message: WebSocketMessage) => void): void {
    if (this.intervalId) {
      return;
    }

    console.log('[QdrantMonitor] Starting polling...');

    this.intervalId = setInterval(async () => {
      try {
        const stats = await this.pollStats();
        const snapshot = JSON.stringify(stats);
        
        // Only emit if data changed
        if (snapshot !== this.lastSnapshot) {
          this.lastSnapshot = snapshot;
          onUpdate({
            type: 'qdrant:stats',
            timestamp: new Date().toISOString(),
            data: stats
          });
        }
      } catch (error: any) {
        console.error('[QdrantMonitor] Poll error:', error.message);
        onUpdate({
          type: 'error',
          timestamp: new Date().toISOString(),
          data: {
            source: 'qdrant',
            message: 'Failed to poll Qdrant stats',
            details: error.message
          }
        });
      }
    }, config.qdrantPollingInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[QdrantMonitor] Stopped polling');
    }
  }

  private async pollStats(): Promise<QdrantStats[]> {
    try {
      // Get list of collections
      const collections = await this.client.getCollections();
      
      const stats: QdrantStats[] = [];
      
      for (const collection of collections.collections) {
        try {
          const info = await this.client.getCollection(collection.name);
          
          stats.push({
            collection: collection.name,
            pointsCount: info.points_count || 0,
            vectorsCount: info.vectors_count ?? undefined,
            indexedVectorsCount: info.indexed_vectors_count ?? undefined
          });
        } catch (error: any) {
          console.error(`[QdrantMonitor] Failed to get collection ${collection.name}:`, error.message);
        }
      }
      
      return stats;
    } catch (error: any) {
      console.error('[QdrantMonitor] Failed to list collections:', error.message);
      return [];
    }
  }
}

