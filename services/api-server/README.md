# Real-time API Middleware

Real-time observability and control middleware for claude-context-core. Provides REST endpoints and WebSocket streaming for monitoring Postgres, Crawl4AI, and Qdrant activity.

## Features

- **REST API**: Endpoints matching `ContextApiClient` interface
- **WebSocket Server**: Real-time bi-directional updates on `ws://localhost:3030/ws`
- **Postgres Monitor**: Polls project statistics, crawl sessions, and activity
- **Crawl4AI Monitor**: Tracks live crawl progress through 8-phase pipeline
- **Qdrant Monitor**: Monitors collection stats and embedding sync
- **Error Stream**: Aggregates errors from all services

## Architecture

```
┌─────────────┐
│   UI (React)│
└──────┬──────┘
       │ HTTP + WS
┌──────▼──────────────────────────┐
│   API Server (Express + WS)     │
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │  REST Routes            │   │
│  │  - /projects/:id/stats  │   │
│  │  - /projects/:id/scopes │   │
│  │  - /projects/:id/query  │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Monitors (Polling)     │   │
│  │  - PostgresMonitor      │   │
│  │  - CrawlMonitor         │   │
│  │  - QdrantMonitor        │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  WebSocket Manager      │   │
│  │  - Subscriptions        │   │
│  │  - Broadcasting         │   │
│  └─────────────────────────┘   │
└────┬────────────┬─────────┬────┘
     │            │         │
┌────▼────┐  ┌───▼───┐  ┌──▼────┐
│Postgres │  │Crawl4AI│  │Qdrant │
└─────────┘  └────────┘  └───────┘
```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file or set environment variables:

```env
POSTGRES_URL=postgres://postgres:password@localhost:5533/claude_context
QDRANT_URL=http://localhost:6333
CRAWL4AI_URL=http://localhost:7070
PORT=3030
NODE_ENV=development
# Enable reranking and control payload size when using a TEI reranker
ENABLE_RERANKING=false
RERANKER_URL=http://localhost:30003
RERANK_CANDIDATE_LIMIT=20
RERANK_TEXT_MAX_CHARS=4000
```

- `ENABLE_RERANKING`: turn reranking on (`true`) once a reranker service is available
- `RERANKER_URL`: TEI reranker endpoint (defaults to `http://localhost:30003`)
- `RERANK_CANDIDATE_LIMIT`: maximum result count sent to the reranker (defaults to 20)
- `RERANK_TEXT_MAX_CHARS`: per-result character budget when building reranker payloads (defaults to 4000)

Lower the candidate limit or text cap if the reranker returns `413 Payload Too Large`.

**Environment Variable Loading**: When running via Docker, pass `--env-file .env` from the project root so `LLM_API_KEY`, `LLM_API_BASE`, `MODEL_NAME`, and other settings are available to the container.

## Database Setup

The API expects the relational schema created by the init scripts in `services/init-scripts/`.

1. From the `services/` directory start Postgres (runs the init scripts inside the container):
   ```bash
   docker compose up -d postgres
   ```
2. For existing data volumes, rerun the schema script manually:
   ```bash
   docker compose exec postgres \
     psql -U postgres -d claude_context \
     -f /docker-entrypoint-initdb.d/02-init-schema.sql
   ```
3. Verify the tables were created:
   ```bash
   docker compose exec postgres \
     psql -U postgres -d claude_context \
     -c '\dt claude_context.*'
   ```
4. With the database ready, start the API middleware:
   ```bash
   npm run mcp:dev
   ```

You should now be able to hit `/projects/default/stats` without `relation "projects" does not exist` errors.

## Development

```bash
# Run with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start
```

## Docker

**Important**: Run docker-compose from the **project root** to ensure environment variables load correctly:

```bash
# From project root (claude-context-core/)
docker compose --env-file .env -f services/docker-compose.yml up -d api-server
```

Or to restart after code changes:
```bash
docker compose --env-file .env -f services/docker-compose.yml restart api-server
```

## REST API Endpoints

### Project Stats
```
GET /projects/:project/stats
```
Returns metrics (datasets, chunks, web pages) and pipeline phases.

### Scope Resources
```
GET /projects/:project/scopes
```
Returns datasets grouped by scope (global/project/local).

### Ingestion History
```
GET /projects/:project/ingest/history
```
Returns recent crawl sessions with status.

### Trigger Crawl
```
POST /projects/:project/ingest/crawl
Body: { start_url, crawl_type, max_pages, depth, dataset, scope }
```
Forwards to Crawl4AI service and tracks session.

### Query Search
```
POST /projects/:project/query
Body: { q, repo?, path_prefix?, lang?, include_global?, k? }
```
Executes hybrid search with reranking.

### Operations Log
```
GET /projects/:project/operations
```
Returns recent operations and incidents.

### Tools List
```
GET /tools
```
Returns available MCP tool names.

### Share Resource
```
POST /projects/:project/share
Body: { to_project, resource_type, resource_id, expires_at? }
```
Creates project share relationship.

## Special Project: "all"

The special project identifier `all` (case-insensitive) provides aggregated access across all projects in the system.

### Supported Operations

**Read Operations (Aggregated)**:
- `GET /projects/all/stats` - Returns aggregated metrics across all projects
- `GET /projects/all/scopes` - Returns all datasets from all projects
- `GET /projects/all/ingest/history` - Returns crawl sessions from all projects
- `POST /projects/all/query` - Queries all datasets across all projects

**Write Operations (Restricted)**:
- `POST /projects/all/ingest/crawl` - Returns 400 error (must specify concrete project)
- `POST /projects/all/ingest/github` - Returns 400 error (must specify concrete project)

### WebSocket Behavior

When subscribed to `project: "all"`, the client receives:
- Aggregated `postgres:stats` messages with totals across all projects
- All `crawl:progress` messages (not filtered by project)
- All `query:progress` messages for queries targeting all projects

### Query Behavior

When querying with `project: "all"`:
- No `projectId` filter is applied to vector search
- All accessible datasets across all projects are included
- If a `dataset` name is provided, it searches for that dataset name across all projects

### UI Behavior

In the web UI:
- Entering `all` in the project input displays aggregated metrics
- Ingest buttons (GitHub, Crawl) are disabled when `all` is selected
- Query operations search across all projects

## WebSocket Protocol

### Connect
```
ws://localhost:3030/ws
```

### Subscribe to Project
```json
{
  "action": "subscribe",
  "project": "Atlas",
  "topics": ["postgres:stats", "crawl:progress", "qdrant:stats", "query:progress", "error"]
}
```

**Special Project**: Use `"project": "all"` to subscribe to aggregated stats across all projects.

### Message Format
```json
{
  "type": "postgres:stats" | "crawl:progress" | "qdrant:stats" | "query:progress" | "error",
  "project": "Atlas",
  "timestamp": "2025-11-01T12:00:00.000Z",
  "data": { ... }
}
```

### Message Types

#### postgres:stats
```json
{
  "type": "postgres:stats",
  "data": {
    "projects": [{"name": "Atlas", "datasets": 3, "chunks": 1542, "webPages": 127}],
    "recentCrawls": [{"sessionId": "...", "status": "completed", ...}]
  }
}
```

#### crawl:progress
```json
{
  "type": "crawl:progress",
  "data": {
    "sessionId": "abc123",
    "phase": "chunking",
    "percentage": 45,
    "current": 23,
    "total": 50,
    "currentPhase": "chunking",
    "phaseDetail": "Content embeddings",
    "chunksTotal": 50,
    "chunksProcessed": 23,
    "summariesGenerated": 20,
    "embeddingsGenerated": 18
  }
}
```

**Real-time Progress Fields:**
- `currentPhase`: Current operation phase (`crawling`, `chunking`, `summarizing`, `embedding`, `storing`)
- `phaseDetail`: Sub-phase detail (e.g., `Content embeddings`, `Code embeddings`, `Postgres`, `Qdrant`)
- `chunksTotal`: Total chunks to process
- `chunksProcessed`: Chunks completed in current phase
- `summariesGenerated`: Number of summaries generated
- `embeddingsGenerated`: Number of embeddings generated

Progress updates emit only on percentage-point changes to minimize overhead.

#### qdrant:stats
```json
{
  "type": "qdrant:stats",
  "data": [
    {"collection": "web_context", "pointsCount": 15420}
  ]
}
```

#### query:progress
```json
{
  "type": "query:progress",
  "project": "Atlas",
  "data": {
    "phase": "query",
    "percentage": 70,
    "detail": "Searching vector database"
  }
}
```

Query progress tracks multi-step search operations:
- 10%: Resolved project and datasets
- 30-50%: Generated query embedding
- 60-85%: Searched vector database
- 100%: Results ready

#### error
```json
{
  "type": "error",
  "data": {
    "source": "postgres" | "crawl4ai" | "qdrant",
    "message": "Connection failed",
    "details": "...",
    "project": "Atlas"
  }
}
```

## Monitoring

- **Postgres**: Polls every 2s
- **Crawl4AI**: Polls active sessions every 1s
- **Qdrant**: Polls collections every 5s
- **Errors**: Aggregated from all sources

## Health Check

```
GET /health
```

Returns service status and configuration.

## License

MIT

