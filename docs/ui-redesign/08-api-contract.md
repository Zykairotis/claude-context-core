# HTTP API Contract

**Shard**: 08  
**Dependencies**: 02-data-models  
**Blocks**: API integration, React Query setup

---

## Base URL & Authentication

```
Base: http://localhost:3030/api
Auth: None (future: Bearer token)
Content-Type: application/json
```

---

## Mesh Operations

### Get Mesh

Fetch complete mesh for a project.

```http
GET /projects/:projectId/mesh
```

**Response 200**:
```typescript
{
  nodes: MeshNode[];
  edges: MeshEdge[];
  lastSync: string; // ISO timestamp
}
```

**Example**:
```bash
curl http://localhost:3030/api/projects/default/mesh
```

---

### Create Node

Add a new node to the mesh.

```http
POST /projects/:projectId/nodes
```

**Request Body**:
```typescript
{
  kind: NodeKind;
  label: string;
  position: { x: number; y: number };
  meta?: {
    repo?: string;
    url?: string;
    dataset?: string;
  };
}
```

**Response 201**:
```typescript
MeshNode // with generated id
```

**Example**:
```bash
curl -X POST http://localhost:3030/api/projects/default/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "github",
    "label": "claude-context",
    "position": { "x": 100, "y": 100 },
    "meta": { "repo": "github.com/user/repo" }
  }'
```

---

### Update Node

Update node metadata or position.

```http
PATCH /projects/:projectId/nodes/:nodeId
```

**Request Body** (partial):
```typescript
{
  label?: string;
  position?: { x: number; y: number };
  meta?: Record<string, any>;
}
```

**Response 200**:
```typescript
MeshNode
```

---

### Delete Node

Remove a node from the mesh.

```http
DELETE /projects/:projectId/nodes/:nodeId
```

**Response 204**: No content

---

## Edge Operations

### Create Edge

Connect two nodes.

```http
POST /projects/:projectId/edges
```

**Request Body**:
```typescript
{
  source: string; // node id
  target: string; // node id
  kind: 'data' | 'trigger' | 'control';
}
```

**Response 201**:
```typescript
MeshEdge
```

**Example**:
```bash
curl -X POST http://localhost:3030/api/projects/default/edges \
  -H "Content-Type: application/json" \
  -d '{
    "source": "node-123",
    "target": "node-456",
    "kind": "data"
  }'
```

---

### Delete Edge

```http
DELETE /projects/:projectId/edges/:edgeId
```

**Response 204**: No content

---

## Node Actions

### Run Node

Trigger node execution.

```http
POST /projects/:projectId/nodes/:nodeId/run
```

**Request Body** (optional):
```typescript
{
  force?: boolean;
  params?: Record<string, any>;
}
```

**Response 202**:
```typescript
{
  accepted: true;
  jobId: string;
  estimatedDuration: number; // seconds
}
```

---

### Stop Node

Cancel running node.

```http
POST /projects/:projectId/nodes/:nodeId/stop
```

**Response 200**:
```typescript
{
  stopped: true;
  jobId: string;
}
```

---

### Get Node Logs

Fetch execution logs.

```http
GET /projects/:projectId/nodes/:nodeId/logs?tail=500&since=<timestamp>
```

**Query Params**:
- `tail` (number): Last N lines
- `since` (ISO timestamp): Logs since timestamp

**Response 200**:
```typescript
{
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    text: string;
  }>;
  hasMore: boolean;
}
```

---

### Get Node Metrics

Fetch node metrics.

```http
GET /projects/:projectId/nodes/:nodeId/metrics?range=1h
```

**Response 200**:
```typescript
{
  throughput: Array<{ t: number; y: number }>;
  latency: Array<{ t: number; y: number }>;
  errors: Array<{ t: number; y: number }>;
}
```

---

## Error Responses

### 400 Bad Request
```typescript
{
  error: "Invalid request";
  details: string;
  field?: string;
}
```

### 404 Not Found
```typescript
{
  error: "Not found";
  resource: string;
  id: string;
}
```

### 500 Internal Server Error
```typescript
{
  error: "Internal server error";
  message: string;
  requestId: string;
}
```

---

## React Query Integration

**File**: `src/lib/api.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeshNode, MeshEdge } from '../types';

const BASE_URL = 'http://localhost:3030/api';

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.message || res.statusText);
  }
  
  return res.json();
}

// Hooks
export function useMesh(projectId: string) {
  return useQuery({
    queryKey: ['mesh', projectId],
    queryFn: () => fetchJSON(`/projects/${projectId}/mesh`)
  });
}

export function useCreateNode(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: any) =>
      fetchJSON(`/projects/${projectId}/nodes`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesh', projectId] });
    }
  });
}

export function useRunNode(projectId: string) {
  return useMutation({
    mutationFn: ({ nodeId, params }: { nodeId: string; params?: any }) =>
      fetchJSON(`/projects/${projectId}/nodes/${nodeId}/run`, {
        method: 'POST',
        body: JSON.stringify(params || {})
      })
  });
}

export function useNodeLogs(projectId: string, nodeId: string) {
  return useQuery({
    queryKey: ['logs', projectId, nodeId],
    queryFn: () => fetchJSON(`/projects/${projectId}/nodes/${nodeId}/logs?tail=500`),
    refetchInterval: 5000 // Poll every 5s
  });
}
```

---

**Read next**: [09-user-flows.md](./09-user-flows.md)
