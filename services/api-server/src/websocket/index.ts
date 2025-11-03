import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { Client as PgClient } from 'pg';
import { WebSocketMessage } from '../types';
import { PostgresMonitor } from '../monitors/postgres-monitor';

interface ClientSubscription {
  ws: WebSocket;
  project?: string;
  subscriptions: Set<string>;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private pgListener: PgClient | null = null;
  private postgresMonitor?: PostgresMonitor;

  constructor(server: Server, postgresMonitor?: PostgresMonitor) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.postgresMonitor = postgresMonitor;
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[WebSocket] Client connected');
      
      this.clients.set(ws, {
        ws,
        subscriptions: new Set()
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: { message: 'Connected to real-time monitoring' }
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error: any) {
          console.error('[WebSocket] Failed to parse message:', error.message);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`[WebSocket] Client disconnected (code=${code}${reason ? `, reason=${reason.toString()}` : ''})`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Error:', error.message);
      });
    });
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.action) {
      case 'subscribe':
        if (message.project) {
          client.project = message.project;
          console.log(`[WebSocket] Client subscribed to project: ${message.project}`);
        }
        if (message.topics && Array.isArray(message.topics)) {
          const wasSubscribed = message.topics.some((topic: string) => client.subscriptions.has(topic));
          message.topics.forEach((topic: string) => client.subscriptions.add(topic));
          console.log(`[WebSocket] Client subscribed to topics: ${message.topics.join(', ')}`);
          
          // Trigger immediate stats update if subscribing to postgres:stats for the first time
          if (!wasSubscribed && message.topics.includes('postgres:stats') && this.postgresMonitor) {
            this.postgresMonitor.updateStats();
          }
        }
        break;

      case 'unsubscribe':
        if (message.topics && Array.isArray(message.topics)) {
          message.topics.forEach((topic: string) => client.subscriptions.delete(topic));
        }
        break;

      case 'ping':
        this.sendToClient(ws, {
          type: 'connected',
          timestamp: new Date().toISOString(),
          data: { pong: true }
        });
        break;

      default:
        console.log('[WebSocket] Unknown action:', message.action);
    }
  }

  broadcast(message: WebSocketMessage): void {
    const payload = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      // Filter by project if message has a project
      if (message.project && client.project && client.project !== message.project) {
        return;
      }

      // Filter by topic if client has specific subscriptions
      if (client.subscriptions.size > 0 && !client.subscriptions.has(message.type)) {
        return;
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    });
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  async startPostgresListener(connectionString: string): Promise<void> {
    if (this.pgListener) {
      console.log('[WebSocket] PostgreSQL listener already started');
      return;
    }

    try {
      this.pgListener = new PgClient({ connectionString });
      await this.pgListener.connect();

      // Listen for GitHub job updates
      await this.pgListener.query('LISTEN github_job_updates');

      this.pgListener.on('notification', (msg) => {
        if (msg.channel === 'github_job_updates' && msg.payload) {
          try {
            const update = JSON.parse(msg.payload);
            
            // Broadcast as github:progress message
            this.broadcast({
              type: 'github:progress',
              project: update.project_id,
              timestamp: new Date().toISOString(),
              data: {
                jobId: update.id,
                status: update.status,
                progress: update.progress,
                phase: update.current_phase,
                currentFile: update.current_file,
                error: update.error
              }
            });
          } catch (error) {
            console.error('[WebSocket] Failed to parse notification:', error);
          }
        }
      });

      this.pgListener.on('error', (error) => {
        console.error('[WebSocket] PostgreSQL listener error:', error);
      });

      console.log('[WebSocket] PostgreSQL listener started for github_job_updates');
    } catch (error: any) {
      console.error('[WebSocket] Failed to start PostgreSQL listener:', error);
      throw error;
    }
  }

  async stopPostgresListener(): Promise<void> {
    if (this.pgListener) {
      try {
        await this.pgListener.query('UNLISTEN github_job_updates');
        await this.pgListener.end();
        this.pgListener = null;
        console.log('[WebSocket] PostgreSQL listener stopped');
      } catch (error) {
        console.error('[WebSocket] Error stopping PostgreSQL listener:', error);
      }
    }
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  async close(): Promise<void> {
    await this.stopPostgresListener();
    
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });
    this.wss.close();
  }
}

