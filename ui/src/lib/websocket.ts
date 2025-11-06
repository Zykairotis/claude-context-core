/**
 * Material Mesh Command Center - WebSocket Client
 * Based on docs/ui-redesign/03-realtime-system.md
 */

import { useRealtimeStore } from '@store';
import type { WSMessage, NodeStatusUpdate, MetricsUpdate, LogUpdate } from '@types';

// ============================================================================
// WebSocket Manager
// ============================================================================

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1s
  private maxReconnectDelay = 30000; // Max 30s

  connect(url: string = 'ws://localhost:3030/ws') {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    try {
      console.log('[WS] Connecting to', url);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        useRealtimeStore.getState().setConnected(true);
        useRealtimeStore.getState().setReconnecting(false);
        
        // Subscribe to default project topics
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const project = urlParams.get('project') || 'default';
        
        // Send subscription directly (not wrapped in WSMessage format)
        if (this.ws) {
          this.ws.send(JSON.stringify({
            action: 'subscribe',
            project,
            topics: [
              'node:status',
              'node:metrics',
              'node:logs',
              'mesh:sync',
              'query:progress',
              'crawl:progress',
              'github:progress'
            ]
          }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      this.ws.onerror = () => {
        console.warn('[WS] Connection error (server may not be running)');
        // Don't log the full error object, it's not useful
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        useRealtimeStore.getState().setConnected(false);
        this.scheduleReconnect(url);
      };
    } catch (error) {
      console.error('[WS] Failed to create WebSocket:', error);
      useRealtimeStore.getState().setConnected(false);
    }
  }

  private scheduleReconnect(url: string) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      useRealtimeStore.getState().setReconnecting(false);
      return;
    }

    this.reconnectAttempts++;
    useRealtimeStore.getState().setReconnecting(true);

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(url);
    }, delay);
  }

  private handleMessage(message: WSMessage) {
    const store = useRealtimeStore.getState();

    switch (message.type) {
      case 'connected': {
        // Server acknowledgment - connection established
        console.log('[WS] Server acknowledged connection');
        break;
      }

      case 'node:status': {
        const payload = message.payload as NodeStatusUpdate;
        store.updateNodeStatus(payload.nodeId, payload.status, payload.message);
        break;
      }

      case 'node:metrics': {
        const payload = message.payload as MetricsUpdate;
        store.updateMetrics(payload.nodeId, payload.metrics);
        break;
      }

      case 'node:logs': {
        const payload = message.payload as LogUpdate;
        store.appendLogs(payload.nodeId, payload.logs);
        break;
      }

      case 'mesh:sync': {
        const { nodes, edges } = message.payload as any;
        if (nodes) store.setNodes(nodes);
        if (edges) store.setEdges(edges);
        break;
      }

      case 'event': {
        store.addEvent(message.payload as any);
        break;
      }

      case 'query:progress':
      case 'crawl:progress':
      case 'github:progress':
      case 'postgres:stats':
      case 'qdrant:stats':
      case 'crawl4ai:status': {
        // Real-time progress updates - can be handled by store if needed
        console.log(`[WS] ${message.type}:`, message.payload);
        break;
      }

      default:
        console.warn('[WS] Unknown message type:', message.type);
    }
  }

  send(message: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send message, not connected');
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useRealtimeStore.getState().setConnected(false);
    useRealtimeStore.getState().setReconnecting(false);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const wsManager = new WebSocketManager();

// ============================================================================
// React Hook
// ============================================================================

export function useWebSocket(url?: string) {
  const connected = useRealtimeStore((state: any) => state.connected);
  const reconnecting = useRealtimeStore((state: any) => state.reconnecting);

  const connect = () => wsManager.connect(url);
  const disconnect = () => wsManager.disconnect();
  const send = (message: WSMessage) => wsManager.send(message);

  return {
    connected,
    reconnecting,
    connect,
    disconnect,
    send,
  };
}
