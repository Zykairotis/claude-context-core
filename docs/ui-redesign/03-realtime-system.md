# Real-time WebSocket System

**Shard**: 03  
**Dependencies**: 01-tech-stack, 02-data-models  
**Blocks**: 04-layout-components, 07-node-types

---

## Architecture Overview

```
Browser                          API Server
  │                                  │
  ├─ useWS hook                      ├─ WebSocket handler
  │  └─ manages connection           │  └─ /ws?project=<id>
  │                                  │
  ├─ Zustand store                   ├─ Pub/Sub system
  │  ├─ nodes: {}                    │  ├─ postgres:stats
  │  ├─ edges: {}                    │  ├─ crawl:progress
  │  ├─ events: []                   │  ├─ node:status
  │  └─ charts: {}                   │  └─ edge:stats
  │                                  │
  └─ React components                └─ Emits WsMessage
     └─ auto-update on state changes    on state changes
```

---

## Zustand Store Implementation

**File**: `src/store/realtime.ts`

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MeshNode, MeshEdge, WsMessage } from '../types';

interface RealtimeState {
  status: 'connecting' | 'open' | 'closed' | 'error';
  nodes: Record<string, MeshNode>;
  edges: Record<string, MeshEdge>;
  events: Array<{ ts: string; message: string; severity: string; nodeId?: string }>;
  charts: Record<string, Array<{ t: number; y: number }>>;
  logs: Record<string, string[]>;
  
  // Actions
  setConnection: (status: RealtimeState['status']) => void;
  apply: (message: WsMessage) => void;
  clearNode: (id: string) => void;
  clearEdge: (id: string) => void;
  clearEvents: () => void;
}

export const useRealtime = create<RealtimeState>()(
  devtools(
    (set, get) => ({
      status: 'connecting',
      nodes: {},
      edges: {},
      events: [],
      charts: {},
      logs: {},

      setConnection: (status) => set({ status }),

      apply: (message) => {
        const state = get();
        
        switch (message.data.type) {
          case 'node-upsert': {
            const { node } = message.data;
            set({
              nodes: { ...state.nodes, [node.id]: node }
            });
            break;
          }

          case 'node-status': {
            const { id, status } = message.data;
            if (state.nodes[id]) {
              set({
                nodes: {
                  ...state.nodes,
                  [id]: { ...state.nodes[id], status }
                }
              });
            }
            break;
          }

          case 'node-delete': {
            const { [message.data.id]: removed, ...rest } = state.nodes;
            set({ nodes: rest });
            break;
          }

          case 'edge-upsert': {
            const { edge } = message.data;
            set({
              edges: { ...state.edges, [edge.id]: edge }
            });
            break;
          }

          case 'edge-stats': {
            const { id, stats } = message.data;
            if (state.edges[id]) {
              set({
                edges: {
                  ...state.edges,
                  [id]: { ...state.edges[id], stats }
                }
              });
            }
            break;
          }

          case 'event': {
            const newEvent = {
              ts: message.ts,
              message: message.data.message,
              severity: message.data.severity,
              nodeId: message.data.nodeId
            };
            const events = [newEvent, ...state.events].slice(0, 2000);
            set({ events });
            break;
          }

          case 'log-chunk': {
            const { nodeId, text } = message.data;
            const logs = { ...state.logs };
            logs[nodeId] = [...(logs[nodeId] || []), text].slice(-1000);
            set({ logs });
            break;
          }

          case 'chart-point': {
            const { series, value } = message.data;
            const charts = { ...state.charts };
            charts[series] = [...(charts[series] || []), value].slice(-600);
            set({ charts });
            break;
          }
        }
      },

      clearNode: (id) => {
        const { [id]: removed, ...rest } = get().nodes;
        set({ nodes: rest });
      },

      clearEdge: (id) => {
        const { [id]: removed, ...rest } = get().edges;
        set({ edges: rest });
      },

      clearEvents: () => set({ events: [] })
    }),
    { name: 'realtime-store' }
  )
);
```

---

## WebSocket Hook

**File**: `src/lib/useWS.ts`

```typescript
import { useEffect, useRef } from 'react';
import { useRealtime } from '../store/realtime';

export function useWS(url: string, enabled = true) {
  const apply = useRealtime((s) => s.apply);
  const setConnection = useRealtime((s) => s.setConnection);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let backoff = 1000;
    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;

      setConnection('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to', url);
        setConnection('open');
        backoff = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          apply(message);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setConnection('error');
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setConnection('closed');
        wsRef.current = null;

        if (shouldReconnect) {
          const timeout = window.setTimeout(() => {
            console.log('[WS] Reconnecting...');
            connect();
          }, backoff);
          reconnectTimeoutRef.current = timeout;
          backoff = Math.min(backoff * 1.8, 30000);
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [url, enabled, apply, setConnection]);

  return {
    send: (message: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    }
  };
}
```

---

## Usage in App

**File**: `src/app/App.tsx`

```typescript
import { useWS } from '../lib/useWS';
import { useRealtime } from '../store/realtime';

export function App() {
  const project = 'default'; // from router or context
  const wsUrl = `ws://localhost:3030/ws?project=${project}`;
  
  // Connect to WebSocket
  useWS(wsUrl, true);
  
  // Subscribe to state
  const status = useRealtime((s) => s.status);
  const nodes = useRealtime((s) => s.nodes);
  const edges = useRealtime((s) => s.edges);
  
  return (
    <div>
      <ConnectionBadge status={status} />
      {/* ... rest of app */}
    </div>
  );
}
```

---

## Performance Optimizations

### Debounce High-Frequency Updates
```typescript
// In useWS hook, debounce rapid updates
const debouncedApply = useRef(
  debounce((messages: WsMessage[]) => {
    messages.forEach(apply);
  }, 250)
).current;
```

### Selective Re-renders
```typescript
// Only subscribe to what you need
const nodeCount = useRealtime((s) => Object.keys(s.nodes).length);
const specificNode = useRealtime((s) => s.nodes['node-123']);
```

### Limit Array Sizes
```typescript
// Events: keep last 2000
events: [...state.events, newEvent].slice(0, 2000)

// Charts: keep last 600 points (10 min @ 1s)
charts[series]: [...charts[series], value].slice(-600)

// Logs per node: keep last 1000 lines
logs[nodeId]: [...logs[nodeId], text].slice(-1000)
```

---

**Read next**: [04-layout-components.md](./04-layout-components.md)
