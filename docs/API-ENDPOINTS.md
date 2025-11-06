# API Server Endpoints Documentation

**Base URL**: `http://localhost:3030`  
**Last Updated**: November 4, 2025

---

## Table of Contents

1. [Health & System](#health--system)
2. [Mesh Canvas API](#mesh-canvas-api)
3. [Projects API](#projects-api)
4. [Ingestion API](#ingestion-api)
5. [Query API](#query-api)

---

## Health & System

### GET `/health`
Health check endpoint

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-04T16:00:00.000Z",
  "services": {
    "postgres": "connected",
    "qdrant": "http://localhost:6333",
    "crawl4ai": "http://localhost:7070"
  }
}
```

### GET `/tools`
List available tools

**Response**:
```json
[
  "claudeContext.index",
  "claudeContext.search",
  "claudeContext.query",
  "claudeContext.share",
  "claudeContext.listProjects",
  "claudeContext.listDatasets"
]
```

---

## Mesh Canvas API

Base path: `/api`

### GET `/api/:project`
Get all nodes and edges for a project

**Parameters**:
- `project` (path) - Project name

**Response**:
```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "github",
      "label": "GitHub Repo",
      "status": "idle",
      "position": { "x": 100, "y": 100 },
      "data": { "repo": "example/repo" },
      "createdAt": "2025-11-04T21:02:31.591Z",
      "updatedAt": "2025-11-04T21:02:31.591Z"
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "type": "data",
      "animated": false,
      "label": null,
      "createdAt": "2025-11-04T21:02:31.592Z",
      "updatedAt": "2025-11-04T21:02:31.592Z"
    }
  ]
}
```

### POST `/api/nodes`
Create a new node

**Request Body**:
```json
{
  "project": "default",
  "type": "github",
  "label": "My GitHub Repo",
  "position": { "x": 100, "y": 100 },
  "data": {
    "repo": "user/repo",
    "branch": "main"
  }
}
```

**Response**:
```json
{
  "id": "generated-uuid",
  "type": "github",
  "label": "My GitHub Repo",
  "status": "idle",
  "position": { "x": 100, "y": 100 },
  "data": { "repo": "user/repo", "branch": "main" },
  "createdAt": "2025-11-04T21:10:00.000Z",
  "updatedAt": "2025-11-04T21:10:00.000Z"
}
```

### PATCH `/api/nodes/:nodeId`
Update a node

**Parameters**:
- `nodeId` (path) - Node ID

**Request Body** (all fields optional):
```json
{
  "label": "Updated Label",
  "position": { "x": 200, "y": 200 },
  "data": { "updated": "data" },
  "status": "running"
}
```

**Response**: Updated node object

### DELETE `/api/nodes/:nodeId`
Delete a node (and associated edges)

**Parameters**:
- `nodeId` (path) - Node ID

**Response**:
```json
{
  "success": true,
  "id": "node-id"
}
```

### POST `/api/nodes/:nodeId/run`
Start node execution

**Parameters**:
- `nodeId` (path) - Node ID

**Response**:
```json
{
  "success": true,
  "nodeId": "node-id",
  "status": "running"
}
```

### POST `/api/nodes/:nodeId/stop`
Stop node execution

**Parameters**:
- `nodeId` (path) - Node ID

**Response**:
```json
{
  "success": true,
  "nodeId": "node-id",
  "status": "idle"
}
```

### GET `/api/nodes/:nodeId/logs`
Get node execution logs

**Parameters**:
- `nodeId` (path) - Node ID
- `limit` (query, optional) - Max logs to return (default: 100)

**Response**:
```json
{
  "logs": [
    {
      "id": 1,
      "nodeId": "node-id",
      "level": "info",
      "message": "Starting execution...",
      "timestamp": "2025-11-04T21:10:00.000Z"
    }
  ]
}
```

### POST `/api/edges`
Create a new edge

**Request Body**:
```json
{
  "project": "default",
  "source": "node-1",
  "target": "node-2",
  "type": "data",
  "animated": false,
  "label": "Data Flow"
}
```

**Response**: Created edge object

### DELETE `/api/edges/:edgeId`
Delete an edge

**Parameters**:
- `edgeId` (path) - Edge ID

**Response**:
```json
{
  "success": true,
  "id": "edge-id"
}
```

---

## Projects API

Base path: `/projects`

### GET `/projects/:project/stats`
Get project statistics

**Parameters**:
- `project` (path) - Project name or "all"

**Response**:
```json
{
  "metrics": [
    { "label": "Datasets", "value": 5, "caption": "active" },
    { "label": "Chunks", "value": 1250, "caption": "indexed" },
    { "label": "Web Pages", "value": 45, "caption": "crawled" },
    { "label": "Sessions", "value": 12, "caption": "total" }
  ],
  "pipeline": [
    {
      "name": "Crawling",
      "description": "Retrieving web pages and repository content",
      "status": "idle",
      "completion": 0,
      "throughput": "0 pages/s",
      "latency": "~0ms",
      "nextDeliveryMs": 0
    }
  ],
  "pulses": []
}
```

### GET `/projects/:project/scopes`
Get project scopes (datasets)

**Parameters**:
- `project` (path) - Project name or "all"

**Response**:
```json
{
  "global": [],
  "project": [
    {
      "id": "dataset-uuid",
      "type": "dataset",
      "name": "web-pages",
      "updatedAt": "11/4/2025, 4:00:00 PM",
      "highlights": ["120 chunks", "15 pages"]
    }
  ],
  "local": []
}
```

### GET `/projects/:project/ingest/history`
Get ingestion history

**Parameters**:
- `project` (path) - Project name or "all"

**Response**:
```json
[
  {
    "id": "job-uuid",
    "source": "github",
    "project": "my-project",
    "dataset": "my-repo",
    "scope": "project",
    "status": "completed",
    "startedAt": "4:00:00 PM",
    "duration": "45s",
    "summary": "user/repo (main): 150 files, 3200 chunks"
  }
]
```

### GET `/projects/:project/operations`
Get recent operations

**Parameters**:
- `project` (path) - Project name or "all"

**Response**:
```json
[
  {
    "title": "Crawl completed: web-pages",
    "detail": "15 pages crawled",
    "timestamp": "4:00:00 PM",
    "scope": "project",
    "impact": "success"
  }
]
```

---

## Ingestion API

### POST `/projects/:project/ingest/local`
Index a local codebase directory

**Parameters**:
- `project` (path) - Project name

**Request Body**:
```json
{
  "path": "/absolute/path/to/codebase",
  "dataset": "my-dataset",
  "repo": "my-repo",
  "branch": "main",
  "sha": "abc123",
  "scope": "project",
  "force": false
}
```

**Response**:
```json
{
  "status": "completed",
  "message": "Local codebase indexed successfully",
  "project": "my-project",
  "dataset": "my-dataset",
  "path": "/absolute/path/to/codebase",
  "scope": "project",
  "stats": {
    "indexedFiles": 150,
    "totalChunks": 3200,
    "status": "completed"
  },
  "durationMs": 45000
}
```

**Notes**:
- Path must be absolute (starts with `/`)
- Indexing happens synchronously (blocks until complete)
- Progress updates broadcast via WebSocket (`ingest:progress`)
- Dataset defaults to directory basename if not provided

### POST `/projects/:project/ingest/crawl`
Start web crawling

**Parameters**:
- `project` (path) - Project name

**Request Body**:
```json
{
  "start_url": "https://example.com/docs",
  "crawl_type": "recursive",
  "max_pages": 50,
  "depth": 2,
  "dataset": "web-pages",
  "scope": "project",
  "force": false
}
```

**Response**:
```json
{
  "jobId": "session-uuid",
  "status": "queued",
  "message": "Crawl session initiated",
  "force": false
}
```

**Duplicate Prevention**:
- Returns `status: "skipped"` if URL already crawled (unless `force: true`)
- Returns `status: "queued"/"running"` if crawl already in progress

### POST `/projects/:project/ingest/github`
Start GitHub repository ingestion

**Parameters**:
- `project` (path) - Project name

**Request Body**:
```json
{
  "repo": "github.com/user/repo",
  "branch": "main",
  "sha": "abc123",
  "dataset": "my-repo",
  "scope": "project",
  "force": false
}
```

**Response**:
```json
{
  "jobId": "job-uuid",
  "status": "queued",
  "message": "GitHub ingest job queued",
  "project": "my-project",
  "dataset": "my-repo",
  "repository": "user/repo",
  "branch": "main",
  "scope": "project",
  "force": false
}
```

**Duplicate Prevention**:
- Returns `status: "skipped"` if repo/branch/sha already indexed (unless `force: true`)
- Returns `status: "queued"/"running"` if ingestion already in progress

### DELETE `/projects/:project/ingest/github`
Delete GitHub dataset

**Parameters**:
- `project` (path) - Project name
- `dataset` (query or body) - Dataset name
- `repo` (query or body) - Repository URL

**Response**:
```json
{
  "project": "my-project",
  "dataset": "my-repo",
  "projectId": "project-uuid",
  "datasetId": "dataset-uuid",
  "deletedVectors": 3200,
  "status": "deleted",
  "message": "GitHub dataset deleted"
}
```

---

## Query API

### POST `/projects/:project/query`
Semantic search across project

**Parameters**:
- `project` (path) - Project name or "all"

**Request Body**:
```json
{
  "query": "how to authenticate users",
  "dataset": "my-dataset",
  "includeGlobal": true,
  "topK": 10,
  "threshold": 0.5,
  "repo": "user/repo",
  "lang": "typescript",
  "pathPrefix": "src/",
  "codebasePath": "/path/to/code"
}
```

**Response**:
```json
{
  "request_id": "req-uuid",
  "results": [
    {
      "id": "chunk-uuid",
      "content": "Code or text content...",
      "score": 0.95,
      "relativePath": "src/auth.ts",
      "startLine": 10,
      "endLine": 25,
      "fileExtension": ".ts",
      "lang": "typescript",
      "metadata": {}
    }
  ],
  "metadata": {
    "timingMs": {
      "total": 150,
      "query": 50,
      "search": 80,
      "rerank": 20
    },
    "featuresUsed": {
      "hybridSearch": true,
      "reranking": true
    }
  },
  "latency_ms": 150,
  "tool_invocations": [
    "claudeContext.query",
    "claudeContext.hybrid",
    "claudeContext.rerank"
  ]
}
```

### POST `/projects/:project/smart-query`
LLM-enhanced query with answer generation

**Parameters**:
- `project` (path) - Project name or "all"

**Request Body**:
```json
{
  "query": "How do I set up authentication in this codebase?",
  "dataset": "my-dataset",
  "includeGlobal": true,
  "topK": 10,
  "threshold": 0.5,
  "strategies": ["multi-query", "refinement", "concept-extraction"],
  "answerType": "conversational",
  "codebasePath": "/path/to/code"
}
```

**Response**:
```json
{
  "request_id": "req-uuid",
  "answer": {
    "content": "To set up authentication in this codebase, you need to...",
    "confidence": 0.92
  },
  "retrievals": [
    {
      "id": "chunk-uuid",
      "content": "Authentication code...",
      "score": 0.95,
      "relativePath": "src/auth.ts",
      "startLine": 10,
      "endLine": 25
    }
  ],
  "metadata": {
    "timingMs": {
      "total": 2500,
      "enhancement": 800,
      "retrieval": 200,
      "generation": 1500
    },
    "strategiesApplied": ["multi-query", "refinement"]
  },
  "latency_ms": 2500,
  "tool_invocations": [
    "claudeContext.smartQuery",
    "LLM",
    "smartQuery.multi",
    "smartQuery.refine"
  ]
}
```

### POST `/projects/:project/share`
Share resources between projects

**Parameters**:
- `project` (path) - Source project name

**Request Body**:
```json
{
  "to_project": "target-project",
  "resource_type": "dataset",
  "resource_id": "dataset-uuid",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response**:
```json
{
  "message": "Resource shared successfully"
}
```

---

## Node Types Reference

For settings panel, these are the available node types:

```typescript
type NodeType = 
  | 'github'     // GitHub repository ingestion
  | 'webcrawler' // Web page crawler
  | 'vectordb'   // Vector database
  | 'reranker'   // Reranker service
  | 'llm'        // LLM service
  | 'dashboard'  // Dashboard/metrics

type NodeStatus = 
  | 'idle'     // Not running
  | 'queued'   // Waiting to start
  | 'running'  // Currently executing
  | 'ok'       // Completed successfully
  | 'failed'   // Error occurred
  | 'warning'  // Completed with warnings
```

---

## Node Type Settings Schema

For the settings panel, each node type expects specific data fields:

### GitHub Node
```json
{
  "type": "github",
  "data": {
    "repo": "github.com/user/repo",
    "branch": "main",
    "dataset": "my-dataset",
    "scope": "project",
    "token": "optional-github-token",
    "fileFilters": {
      "include": ["*.ts", "*.tsx"],
      "exclude": ["node_modules/**", "*.test.ts"]
    }
  }
}
```

### Web Crawler Node
```json
{
  "type": "webcrawler",
  "data": {
    "startUrl": "https://example.com",
    "maxPages": 50,
    "maxDepth": 2,
    "crawlType": "recursive",
    "sameDomainOnly": true,
    "extractCodeExamples": true,
    "dataset": "web-pages",
    "scope": "project"
  }
}
```

### Vector DB Node
```json
{
  "type": "vectordb",
  "data": {
    "url": "http://localhost:6333",
    "collectionName": "my-collection",
    "embeddingModel": "text-embedding-3-small",
    "distanceMetric": "cosine"
  }
}
```

### Reranker Node
```json
{
  "type": "reranker",
  "data": {
    "url": "http://localhost:30003",
    "model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
    "topK": 10,
    "scoreThreshold": 0.5
  }
}
```

### LLM Node
```json
{
  "type": "llm",
  "data": {
    "apiBase": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "gpt-4-turbo",
    "temperature": 0.7,
    "maxTokens": 2000,
    "systemPrompt": "You are a helpful assistant..."
  }
}
```

### Dashboard Node
```json
{
  "type": "dashboard",
  "data": {
    "metrics": ["chunks", "queries", "latency"],
    "refreshInterval": 5000,
    "visualizationType": "line-chart"
  }
}
```

---

## WebSocket API

**URL**: `ws://localhost:3030/ws`

### Message Types

#### Query Progress
```json
{
  "type": "query:progress",
  "project": "my-project",
  "timestamp": "2025-11-04T21:10:00.000Z",
  "data": {
    "phase": "Searching...",
    "percentage": 50,
    "detail": "Processing chunks"
  }
}
```

#### Crawl Progress
```json
{
  "type": "crawl:progress",
  "sessionId": "session-uuid",
  "project": "my-project",
  "dataset": "web-pages",
  "data": {
    "phase": "crawling",
    "current": 25,
    "total": 50,
    "percentage": 50
  }
}
```

#### GitHub Job Update
```json
{
  "type": "github:update",
  "jobId": "job-uuid",
  "project": "my-project",
  "status": "in_progress",
  "progress": 60,
  "currentPhase": "Chunking",
  "currentFile": "src/auth.ts"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `202` - Accepted (async operation started)
- `400` - Bad request (invalid parameters)
- `404` - Not found
- `500` - Internal server error
- `503` - Service unavailable

---

## Rate Limiting

Currently no rate limiting is implemented. For production, consider:
- `RATE_LIMIT_WINDOW_MS=60000` (1 minute window)
- `RATE_LIMIT_MAX_REQUESTS=100` (100 requests per window)

---

## CORS Configuration

Current CORS settings (development):
```javascript
app.use(cors());
```

For production, configure:
```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

---

## Authentication

Currently no authentication is implemented. For production, add:
- JWT token authentication
- API key validation
- OAuth2 integration

---

## Examples for Settings Panel

### Complete Node Creation Flow

```typescript
// 1. Create GitHub node
const githubNode = await fetch('http://localhost:3030/api/nodes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project: 'default',
    type: 'github',
    label: 'My Repo',
    position: { x: 100, y: 100 },
    data: {
      repo: 'github.com/user/repo',
      branch: 'main',
      dataset: 'repo-dataset'
    }
  })
});

// 2. Create Vector DB node
const vectorNode = await fetch('http://localhost:3030/api/nodes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project: 'default',
    type: 'vectordb',
    label: 'Qdrant',
    position: { x: 400, y: 100 },
    data: {
      url: 'http://localhost:6333',
      collectionName: 'hybrid_code_chunks'
    }
  })
});

// 3. Connect them with an edge
const edge = await fetch('http://localhost:3030/api/edges', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project: 'default',
    source: githubNode.id,
    target: vectorNode.id,
    type: 'data'
  })
});

// 4. Update node settings
await fetch(`http://localhost:3030/api/nodes/${githubNode.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: {
      ...githubNode.data,
      fileFilters: {
        include: ['*.ts', '*.tsx'],
        exclude: ['**/*.test.ts']
      }
    }
  })
});

// 5. Run the node
await fetch(`http://localhost:3030/api/nodes/${githubNode.id}/run`, {
  method: 'POST'
});
```

---

**For Frontend Development**: Use the API client at `/ui/src/lib/api.ts` which wraps all these endpoints with proper error handling and TypeScript types.
