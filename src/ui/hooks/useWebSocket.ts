import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types';

interface UseWebSocketOptions {
  url: string;
  enabled: boolean;
  project?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    enabled,
    project,
    onMessage,
    onError,
    reconnectInterval = 3000
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);
  
  // Use refs for callbacks to avoid reconnection on every render
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        setConnectionStatus('connected');

        // Subscribe to project updates
        if (project) {
          ws.send(JSON.stringify({
            action: 'subscribe',
            project,
            topics: ['postgres:stats', 'crawl:progress', 'qdrant:stats', 'github:progress', 'query:progress', 'error']
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setConnectionStatus('error');
        onErrorRef.current?.(error);
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Attempt reconnection
        if (shouldReconnectRef.current && enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Reconnecting...');
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setConnectionStatus('error');
    }
  }, [enabled, url, project, reconnectInterval]);

  useEffect(() => {
    if (enabled) {
      shouldReconnectRef.current = true;
      connect();
    }

    return () => {
      shouldReconnectRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect]);

  // Re-subscribe when project changes
  useEffect(() => {
    if (isConnected && project) {
      sendMessage({
        action: 'subscribe',
        project,
        topics: ['postgres:stats', 'crawl:progress', 'qdrant:stats', 'github:progress', 'query:progress', 'error']
      });
    }
  }, [isConnected, project, sendMessage]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connectionStatus
  };
}

