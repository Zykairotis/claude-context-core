# Data Models & Type Definitions

**Shard**: 02  
**Dependencies**: 01-tech-stack  
**Blocks**: 03-realtime-system, 07-node-types

---

## Core Types

### Status Enum
```typescript
type Status = 'idle' | 'queued' | 'running' | 'ok' | 'degraded' | 'failed';
```

### Node Kinds
```typescript
type NodeKind = 
  | 'github'      // GitHub repository source
  | 'crawler'     // Web crawler (Crawl4AI)
  | 'file'        // File upload
  | 'dataset'     // Dataset storage
  | 'vector'      // Vector database (Qdrant)
  | 'reranker'    // Reranking service
  | 'llm'         // LLM processing
  | 'dashboard';  // Output/visualization
```

---

## Mesh Node

```typescript
interface MeshNode {
  id: string;                    // nanoid()
  kind: NodeKind;
  label: string;
  status: Status;
  position: { x: number; y: number };
  
  // Optional metadata based on kind
  meta?: {
    // GitHub nodes
    repo?: string;
    branch?: string;
    sha?: string;
    
    // Crawler nodes
    url?: string;
    maxPages?: number;
    depth?: number;
    
    // Dataset nodes
    dataset?: string;
    project?: string;
    
    // Environment
    env?: 'dev' | 'stage' | 'prod';
    
    // Metrics
    lastRun?: string;           // ISO timestamp
    itemsProcessed?: number;
    errorCount?: number;
  };
}
```

---

## Mesh Edge

```typescript
interface MeshEdge {
  id: string;                    // nanoid()
  source: string;                // node id
  target: string;                // node id
  kind: 'data' | 'trigger' | 'control';
  status?: Status;
  
  stats?: {
    ratePerMin?: number;
    lastRunTs?: string;
    errorCount?: number;
    totalItems?: number;
  };
}
```

**Edge Types**:
- `data`: Data flows from source → target
- `trigger`: Source triggers target on completion
- `control`: Manual/conditional control flow

---

## WebSocket Message Envelope

```typescript
type Envelope<T> = {
  topic: string;        // 'nodes' | 'edges' | 'events' | 'charts' | 'logs'
  ts: string;           // ISO timestamp
  projectId: string;
  data: T;
};
```

---

## WebSocket Message Types

```typescript
type WsMessage =
  // Node updates
  | Envelope<{ type: 'node-upsert'; node: MeshNode }>
  | Envelope<{ type: 'node-status'; id: string; status: Status }>
  | Envelope<{ type: 'node-delete'; id: string }>
  
  // Edge updates
  | Envelope<{ type: 'edge-upsert'; edge: MeshEdge }>
  | Envelope<{ type: 'edge-stats'; id: string; stats: MeshEdge['stats'] }>
  | Envelope<{ type: 'edge-delete'; id: string }>
  
  // Events & logs
  | Envelope<{ 
      type: 'event'; 
      severity: 'info' | 'warn' | 'error'; 
      message: string; 
      nodeId?: string;
      metadata?: Record<string, any>;
    }>
  | Envelope<{ type: 'log-chunk'; nodeId: string; text: string; timestamp: string }>
  
  // Chart data
  | Envelope<{ 
      type: 'chart-point'; 
      series: 'ingestRate' | 'latencyP95' | 'throughput' | 'errorRate';
      value: { t: number; y: number };
    }>;
```

---

## Zustand Store Shape

```typescript
interface RealtimeState {
  // Connection
  status: 'connecting' | 'open' | 'closed' | 'error';
  
  // Mesh data
  nodes: Record<string, MeshNode>;
  edges: Record<string, MeshEdge>;
  
  // Activity
  events: Array<{
    ts: string;
    message: string;
    severity: 'info' | 'warn' | 'error';
    nodeId?: string;
  }>;
  
  // Charts (last N points per series)
  charts: Record<string, Array<{ t: number; y: number }>>;
  
  // Logs (per-node buffers)
  logs: Record<string, string[]>;
  
  // Actions
  setConnection: (status: RealtimeState['status']) => void;
  apply: (message: WsMessage) => void;
  clearNode: (id: string) => void;
  clearEdge: (id: string) => void;
}
```

---

## HTTP Request/Response Types

### Fetch Mesh
```typescript
// GET /projects/:id/mesh
type MeshResponse = {
  nodes: MeshNode[];
  edges: MeshEdge[];
  lastSync: string;
};
```

### Create Node
```typescript
// POST /projects/:id/nodes
type CreateNodeRequest = {
  kind: NodeKind;
  label: string;
  position: { x: number; y: number };
  meta?: MeshNode['meta'];
};

type CreateNodeResponse = MeshNode;
```

### Create Edge
```typescript
// POST /projects/:id/edges
type CreateEdgeRequest = {
  source: string;
  target: string;
  kind: MeshEdge['kind'];
};

type CreateEdgeResponse = MeshEdge;
```

### Run Node
```typescript
// POST /projects/:id/nodes/:id/run
type RunNodeResponse = {
  accepted: true;
  jobId: string;
};
```

### Get Logs
```typescript
// GET /projects/:id/nodes/:id/logs?tail=500
type LogsResponse = {
  logs: Array<{ timestamp: string; text: string }>;
  hasMore: boolean;
};
```

---

## React Flow Integration Types

```typescript
import { Node, Edge } from 'reactflow';

// React Flow uses different shape than our MeshNode
type FlowNode = Node<{
  kind: NodeKind;
  label: string;
  status: Status;
  meta?: MeshNode['meta'];
}>;

type FlowEdge = Edge<{
  kind: MeshEdge['kind'];
  stats?: MeshEdge['stats'];
}>;

// Conversion helpers
function toFlowNode(mesh: MeshNode): FlowNode {
  return {
    id: mesh.id,
    type: 'knowledge',
    position: mesh.position,
    data: {
      kind: mesh.kind,
      label: mesh.label,
      status: mesh.status,
      meta: mesh.meta
    }
  };
}

function toFlowEdge(mesh: MeshEdge): FlowEdge {
  return {
    id: mesh.id,
    source: mesh.source,
    target: mesh.target,
    type: 'smoothstep',
    animated: mesh.status === 'running',
    data: {
      kind: mesh.kind,
      stats: mesh.stats
    }
  };
}
```

---

**Read next**: [03-realtime-system.md](./03-realtime-system.md)
