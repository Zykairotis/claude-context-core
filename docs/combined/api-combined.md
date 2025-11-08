# Combined Files from api

*Generated on: Thu Nov  6 09:52:37 AM EST 2025*

---

## File: API-ENDPOINTS.md

**Path:** `API-ENDPOINTS.md`

```markdown
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

```

---

## File: UNIFIED_API_GUIDE.md

**Path:** `UNIFIED_API_GUIDE.md`

```markdown
# Unified API Guide: Claude-Context + Cognee

> **Your API server now has BOTH systems integrated!** 🎉  
> **URL:** `http://localhost:3030`

---

## 🎯 Quick Start

### One API, Two Powerful Systems

```bash
# Claude-Context endpoints (existing)
http://localhost:3030/projects/*
http://localhost:3030/api/*

# Cognee endpoints (NEW!)
http://localhost:3030/cognee/*
```

**All Cognee endpoints are now proxied through your main API server!**

---

## 🔍 When to Use Which Endpoint

### Use `/projects/*` (Claude-Context) for:
- ✅ Fast code search
- ✅ Finding functions/classes
- ✅ Symbol lookup
- ✅ File navigation
- ✅ Hybrid search with reranking

### Use `/cognee/*` for:
- ✅ Understanding relationships
- ✅ Graph-based queries
- ✅ LLM-powered explanations
- ✅ Architecture questions
- ✅ Chain-of-thought reasoning

---

## 📚 Complete Cognee Endpoints

### 🏥 Health & Status

#### Check Cognee Health
```bash
GET http://localhost:3030/cognee/health

# Response
{
  "status": "healthy",
  "cognee": { ... },
  "apiUrl": "http://localhost:8340"
}
```

#### Detailed Health Check
```bash
GET http://localhost:3030/cognee/health/detailed
```

---

### 📦 Dataset Management

#### List All Datasets
```bash
GET http://localhost:3030/cognee/datasets

# Response: Array of datasets
[
  {
    "id": "37df7223-7647-57df-9ea1-1526ca3e3e8a",
    "name": "crypto-depth-performance",
    "created_at": "2025-11-06T...",
    ...
  }
]
```

#### Create Dataset
```bash
POST http://localhost:3030/cognee/datasets
Content-Type: application/json

{
  "name": "my-project",
  "description": "My awesome project"
}
```

#### Get Dataset Details
```bash
GET http://localhost:3030/cognee/datasets/{id}
```

#### Delete Dataset
```bash
DELETE http://localhost:3030/cognee/datasets/{id}
```

#### Get Dataset Knowledge Graph
```bash
GET http://localhost:3030/cognee/datasets/{id}/graph
```

---

### 📤 Add Data (Ingestion)

#### Add Files/URLs to Dataset
```bash
POST http://localhost:3030/cognee/add
Content-Type: application/json

{
  "data": ["https://example.com", "text content", ...],
  "datasetName": "my-project",
  "nodeSet": ["optional-group-name"]
}

# For file uploads, use multipart/form-data
```

---

### 🧠 Cognify (Build Knowledge Graph)

#### Process Dataset into Knowledge Graph
```bash
POST http://localhost:3030/cognee/cognify
Content-Type: application/json

{
  "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
  "runInBackground": false,
  "customPrompt": ""
}

# This extracts entities, relationships, and builds the graph
```

---

### 🔍 Search (15 Types!)

#### Basic Search
```bash
POST http://localhost:3030/cognee/search
Content-Type: application/json

{
  "searchType": "CHUNKS",
  "query": "memory pool implementation",
  "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
  "topK": 5
}
```

#### All Search Types:

1. **CHUNKS** - Raw text chunks
2. **SUMMARIES** - Document summaries
3. **RAG_COMPLETION** - LLM answers with context
4. **GRAPH_COMPLETION** - Graph-aware answers
5. **GRAPH_SUMMARY_COMPLETION** - Graph summaries
6. **GRAPH_COMPLETION_COT** - Chain-of-thought reasoning
7. **GRAPH_COMPLETION_CONTEXT_EXTENSION** - Extended context
8. **CODE** - Code-specific search
9. **CYPHER** - Direct Neo4j queries
10. **NATURAL_LANGUAGE** - Conversational
11. **FEELING_LUCKY** - Best single result
12. **CHUNKS_LEXICAL** - Keyword search
13. **TEMPORAL** - Time-based
14. **CODING_RULES** - Code standards
15. **FEEDBACK** - User feedback

#### Example: Get Explanation with Graph Context
```bash
POST http://localhost:3030/cognee/search
Content-Type: application/json

{
  "searchType": "GRAPH_COMPLETION",
  "query": "How does the MemoryPool relate to other components?",
  "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
  "systemPrompt": "Explain relationships clearly.",
  "topK": 10
}
```

#### Example: Chain-of-Thought Reasoning
```bash
POST http://localhost:3030/cognee/search
Content-Type: application/json

{
  "searchType": "GRAPH_COMPLETION_COT",
  "query": "Walk me through how batch processing works step-by-step",
  "datasetIds": ["37df7223-7647-57df-9ea1-1526ca3e3e8a"],
  "systemPrompt": "Think step-by-step and explain your reasoning.",
  "topK": 8
}
```

#### Get Search History
```bash
GET http://localhost:3030/cognee/search
```

---

### 🗑️ Delete Data

```bash
POST http://localhost:3030/cognee/delete
Content-Type: application/json

{
  "datasetIds": ["dataset-id"],
  "datasets": ["dataset-name"]
}
```

---

### ♻️ Update Data

```bash
POST http://localhost:3030/cognee/update
Content-Type: application/json

{
  "data": [...],
  "datasetName": "my-project"
}
```

---

### ⚙️ Settings

#### Get Settings
```bash
GET http://localhost:3030/cognee/settings
```

#### Update Settings
```bash
PUT http://localhost:3030/cognee/settings
Content-Type: application/json

{
  "setting_key": "value"
}
```

---

### 🔄 Sync External Sources

```bash
POST http://localhost:3030/cognee/sync
Content-Type: application/json

{
  "datasetName": "my-project"
}
```

---

## 🚀 Convenience Endpoints (NEW!)

These are smart wrappers that make common tasks easier:

### Quick Search
Simple search with smart type detection:

```bash
POST http://localhost:3030/cognee/quick-search
Content-Type: application/json

{
  "query": "What is the MemoryPool class?",
  "datasetId": "37df7223-7647-57df-9ea1-1526ca3e3e8a",
  "type": "code"  // "code" | "architecture" | "explanation" | "question"
}

# Smart routing:
# - "code" → CODE search
# - "architecture" → GRAPH_COMPLETION
# - "explanation" → RAG_COMPLETION
# - "question" → NATURAL_LANGUAGE
```

### Explain Code
Get detailed explanations with chain-of-thought:

```bash
POST http://localhost:3030/cognee/explain-code
Content-Type: application/json

{
  "query": "Explain how the batch processing system works",
  "datasetId": "37df7223-7647-57df-9ea1-1526ca3e3e8a"
}

# Uses GRAPH_COMPLETION_COT with step-by-step reasoning
```

### Find Relationships
Discover component relationships:

```bash
POST http://localhost:3030/cognee/find-relationships
Content-Type: application/json

{
  "component": "MemoryPool",
  "datasetId": "37df7223-7647-57df-9ea1-1526ca3e3e8a"
}

# Returns all dependencies and relationships
```

---

## 🎯 Real-World Examples

### Example 1: Find Code (Claude-Context) + Understand (Cognee)

```bash
# Step 1: Find the code quickly
POST http://localhost:3030/projects/my-project/query
{
  "query": "MemoryPool allocate",
  "limit": 5
}

# Step 2: Understand what it does
POST http://localhost:3030/cognee/explain-code
{
  "query": "Explain the MemoryPool allocate method",
  "datasetId": "dataset-id"
}
```

---

### Example 2: Architecture Review

```bash
# Ask about architecture
POST http://localhost:3030/cognee/search
{
  "searchType": "GRAPH_COMPLETION",
  "query": "What are the main components of the performance optimization system?",
  "datasetIds": ["dataset-id"],
  "topK": 15
}
```

---

### Example 3: Debug Workflow

```bash
# 1. Find where error occurs (Claude-Context)
POST http://localhost:3030/projects/my-project/query
{
  "query": "error handling allocation",
  "limit": 10
}

# 2. Understand impact (Cognee)
POST http://localhost:3030/cognee/find-relationships
{
  "component": "allocate error handler",
  "datasetId": "dataset-id"
}

# 3. Get step-by-step fix guidance (Cognee)
POST http://localhost:3030/cognee/search
{
  "searchType": "GRAPH_COMPLETION_COT",
  "query": "How should I fix allocation errors? Walk through the steps.",
  "datasetIds": ["dataset-id"],
  "systemPrompt": "Provide step-by-step debugging guidance."
}
```

---

## 📊 Comparison Table

| Feature | Claude-Context (`/projects/*`) | Cognee (`/cognee/*`) |
|---------|-------------------------------|---------------------|
| **Speed** | ⚡⚡⚡ Very Fast | ⚡⚡ Fast |
| **Best For** | Finding code | Understanding code |
| **Search Type** | Semantic + Hybrid | Graph + LLM-powered |
| **Returns** | Code chunks | Explanations + relationships |
| **Use Case** | "Where is X?" | "How does X work?" |
| **Complexity** | Simple queries | Complex reasoning |

---

## 🎓 Cheat Sheet

### Quick Decision Flow:

```
Need to FIND something? 
  → /projects/* (Claude-Context)

Need to UNDERSTAND something? 
  → /cognee/* 

Need BOTH? 
  → Use both! They complement each other!
```

### Example Queries:

| What You Want | Endpoint | Query Example |
|---------------|----------|---------------|
| Find a function | `/projects/{id}/query` | "allocate function" |
| Understand architecture | `/cognee/search` (GRAPH_COMPLETION) | "Explain the cache architecture" |
| Quick code explanation | `/cognee/explain-code` | "What does MemoryPool do?" |
| Find relationships | `/cognee/find-relationships` | component: "MemoryPool" |
| Step-by-step reasoning | `/cognee/search` (COT) | "How to implement caching?" |

---

## 🛠️ Environment Variables

Add to your `.env`:

```bash
# Cognee Configuration (already set in config.ts defaults)
COGNEE_API_URL=http://localhost:8340
COGNEE_API_KEY=local-development-only
```

---

## 🚀 Getting Started

1. **Start your API server** (already running on port 3030)
2. **Index your code in both systems:**
   ```bash
   # Claude-Context (existing method)
   # Use your normal indexing

   # Cognee (run once)
   cd services/cognee
   python3 /tmp/upload_to_cognee.py
   python3 /tmp/cognify_dataset.py
   ```

3. **Use the unified API!**
   ```bash
   # Fast search
   curl http://localhost:3030/projects/my-project/query

   # Smart understanding
   curl http://localhost:3030/cognee/quick-search
   ```

---

## 📝 Tips & Best Practices

1. **Start with Claude-Context** for speed
2. **Switch to Cognee** when you need deeper understanding
3. **Use convenience endpoints** (`/quick-search`, `/explain-code`) for common tasks
4. **Index in both systems** for maximum benefit
5. **Chain queries** - Find with Claude-Context, understand with Cognee

---

## 🎉 You're Ready!

Your API server now provides **ONE unified interface** to access:
- ✅ Fast Claude-Context code search
- ✅ Smart Cognee graph reasoning
- ✅ 15 different search types
- ✅ Convenient shortcuts

**All from `http://localhost:3030`!**

---

## 📚 Additional Resources

- **Cognee Search Examples**: `/services/cognee/COGNEE_SEARCH_EXAMPLES.md`
- **Which System to Use**: `/docs/guides/WHICH_SYSTEM_TO_USE.md`
- **Database Integration**: `/docs/database/DATABASE_INTEGRATION_ANALYSIS.md`
- **API Endpoints**: `/docs/api/API-ENDPOINTS.md`

---

**Happy Coding! 🚀**

```

---

## File: WEBSOCKET-FIX.md

**Path:** `WEBSOCKET-FIX.md`

```markdown
# WebSocket Connection Fix

**Date**: November 4, 2025  
**Issue**: WebSocket connection errors and unknown message type warnings

---

## 🐛 Problem

The frontend WebSocket client was experiencing several issues:

1. **Unknown message type**: `connected`
   ```
   [WS] Unknown message type: connected
   ```

2. **Connection warnings**: Initial connection attempts would fail before succeeding on retry

3. **Missing subscription**: Client wasn't subscribing to topics after connecting

---

## ✅ Solution

### 1. Handle `connected` Message Type

The backend sends a `connected` message when a client first connects (welcome message). The frontend now handles this:

```typescript
case 'connected': {
  // Server acknowledgment - connection established
  console.log('[WS] Server acknowledged connection');
  break;
}
```

### 2. Handle Additional Message Types

Added handlers for real-time progress updates:

```typescript
case 'query:progress':
case 'crawl:progress':
case 'github:progress':
case 'postgres:stats':
case 'qdrant:stats':
case 'crawl4ai:status': {
  // Real-time progress updates
  console.log(`[WS] ${message.type}:`, message.payload);
  break;
}
```

### 3. Auto-Subscribe to Topics

The client now automatically subscribes to relevant topics when connecting:

```typescript
this.ws.send(JSON.stringify({
  action: 'subscribe',
  project: 'default',
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
```

### 4. Fixed Lint Errors

- Removed unused `error` parameter from onerror handler
- Fixed `message.data` to `message.payload` (correct WSMessage type)

---

## 🔌 Backend WebSocket Protocol

### Server → Client Messages

All messages follow this format:
```typescript
{
  type: string,
  timestamp: string,
  data?: any,
  project?: string
}
```

### Client → Server Messages

Subscription messages:
```typescript
{
  action: 'subscribe' | 'unsubscribe' | 'ping',
  project?: string,
  topics?: string[]
}
```

### Available Message Types

**Connection**:
- `connected` - Server acknowledgment

**Node Updates**:
- `node:status` - Node status changed
- `node:metrics` - Node metrics updated
- `node:logs` - New log entries

**Mesh Updates**:
- `mesh:sync` - Full mesh state sync

**Progress Updates**:
- `query:progress` - Query execution progress
- `crawl:progress` - Web crawling progress
- `github:progress` - GitHub ingestion progress

**System Stats**:
- `postgres:stats` - PostgreSQL statistics
- `qdrant:stats` - Qdrant statistics
- `crawl4ai:status` - Crawl4AI service status

**Events**:
- `event` - General system events

---

## 📝 Files Modified

**Frontend**:
- `/ui/src/lib/websocket.ts`
  - Added `connected` message handler
  - Added progress message handlers
  - Added auto-subscription on connect
  - Fixed lint errors

**No backend changes needed** - backend was already working correctly

---

## 🧪 Testing

### Expected Behavior

1. **Initial Connection**:
   ```
   [WS] Connecting to ws://localhost:3030/ws?project=default
   [WS] Connected
   [WS] Server acknowledged connection
   ```

2. **No More Warnings**:
   - No "Unknown message type: connected" warnings
   - No "WebSocket is closed before connection" errors

3. **Automatic Subscription**:
   - Client automatically subscribes to project topics
   - Ready to receive real-time updates

### Test It

1. **Start the API server** (if not running):
   ```bash
   cd services
   docker-compose up api-server
   ```

2. **Start the UI** (if not running):
   ```bash
   cd ui
   npx vite --port 40001
   ```

3. **Open browser console**:
   - Navigate to http://localhost:40001
   - Check console for WebSocket messages
   - Should see clean connection without errors

4. **Test real-time updates**:
   ```bash
   # Trigger a GitHub ingestion to see progress messages
   curl -X POST http://localhost:3030/projects/test/ingest/github \
     -H 'Content-Type: application/json' \
     -d '{"repo":"github.com/user/repo","branch":"main"}'
   ```

---

## 🔄 WebSocket Lifecycle

```
1. Client connects
   ↓
2. Server sends "connected" message
   ↓
3. Client sends "subscribe" action with topics
   ↓
4. Server acknowledges subscription (console log)
   ↓
5. Client receives real-time updates for subscribed topics
   ↓
6. On disconnect: exponential backoff retry (max 10 attempts)
```

---

## 🎯 Connection URL Format

```
ws://localhost:3030/ws?project=<project-name>
```

**Parameters**:
- `project` (optional) - Filter messages by project
  - Default: `default`
  - Special: `all` - receives all projects

**Examples**:
```
ws://localhost:3030/ws?project=default
ws://localhost:3030/ws?project=my-project
ws://localhost:3030/ws?project=all
```

---

## 🚀 Next Steps

The WebSocket connection is now stable and ready for:

1. **Real-time node status updates** - Show running/idle/failed states
2. **Progress bars** - Display ingestion progress
3. **Live metrics** - Update dashboard in real-time
4. **Log streaming** - Stream node execution logs
5. **Mesh sync** - Keep canvas in sync across tabs

---

## 📚 Related Documentation

- **WebSocket Backend**: `/services/api-server/src/websocket/index.ts`
- **WebSocket Frontend**: `/ui/src/lib/websocket.ts`
- **Message Types**: `/ui/src/types/index.ts`
- **API Documentation**: `/docs/api/API-ENDPOINTS.md`

---

**Status**: ✅ **Fixed and Ready**

No more WebSocket errors! Connection is stable and subscriptions are working properly.

```

---

