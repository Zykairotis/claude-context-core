# Middleware Connection Architecture

**Last Updated:** 2025-01-27  
**Status:** Production Ready

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [MCP Server Connection](#mcp-server-connection)
3. [API Middleware Layer](#api-middleware-layer)
4. [Frontend Connection](#frontend-connection)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Service Dependencies](#service-dependencies)
7. [Real-time Updates Pipeline](#real-time-updates-pipeline)
8. [Configuration Reference](#configuration-reference)

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend UI Layer                           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  React UI (Vite Dev Server)                                    │ │
│  │  - Port: 3455                                                  │ │
│  │  - Location: ui/main.tsx, src/ui/app.tsx                      │ │
│  │  - Components: Dashboard, Forms, Real-time Updates             │ │
│  └─────────────────────┬──────────────────────────────────────────┘ │
└────────────────────────┼─────────────────────────────────────────────┘
                         │ HTTP/WebSocket
                         │ (http://localhost:3030)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Middleware Layer                           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Express API Server                                            │ │
│  │  - Port: 3030                                                  │ │
│  │  - Location: services/api-server/src/server.ts                │ │
│  │  - REST Endpoints: /projects/*, /health, /tools                │ │
│  │  - WebSocket: ws://localhost:3030/ws                            │ │
│  └────┬──────────────────────┬───────────────────┬─────────────────┘ │
│       │                      │                   │                   │
│       │ Monitors            │ Routes            │ WebSocket          │
│       ▼                     ▼                   ▼                   │
│  ┌──────────┐         ┌──────────┐      ┌────────────┐          │
│  │Postgres   │         │Projects  │      │WS Manager  │          │
│  │Monitor    │         │Router    │      │            │          │
│  ├──────────┤         ├──────────┤      ├────────────┤          │
│  │Crawl     │         │- /stats  │      │- Broadcast │          │
│  │Monitor   │         │- /scopes  │      │- Subscribe │          │
│  ├──────────┤         │- /ingest │      │- Filter    │          │
│  │Qdrant    │         │- /query  │      │            │          │
│  │Monitor   │         │- /share  │      │            │          │
│  └──────────┘         └──────────┘      └────────────┘          │
└─────┬──────────────────────┬───────────────────┬──────────────────────┘
      │                        │                   │
      │ PostgreSQL Pool        │ HTTP              │ HTTP
      ▼                        ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Layer                               │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│  │ PostgreSQL   │    │  Qdrant      │    │  Crawl4AI    │        │
│  │              │    │              │    │              │        │
│  │ Port: 5533   │    │ Port: 6333   │    │ Port: 7070  │        │
│  │ Container:   │    │ Container:   │    │ Container:   │        │
│  │ postgres     │    │ qdrant       │    │ crawl4ai     │        │
│  │              │    │              │    │              │        │
│  │ - pgvector   │    │ - Vector DB  │    │ - Web Crawl  │        │
│  │ - Metadata   │    │ - Embeddings │    │ - Chunking   │        │
│  │ - Projects   │    │ - Similarity │    │ - Summaries  │        │
│  │ - Datasets   │    │   Search     │    │ - Storage    │        │
│  └──────────────┘    └──────────────┘    └──────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ MCP Tools
                              │ (mcp-server.js)
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                      MCP Server Layer                               │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  mcp-server.js                                                │ │
│  │  - Location: mcp-server.js                                    │ │
│  │  - Protocol: Model Context Protocol (stdio)                  │ │
│  │  - Tools: claudeContext.*                                     │ │
│  │                                                               │ │
│  │  Core Library Integration:                                    │ │
│  │  - Context class                                              │ │
│  │  - Vector databases (Postgres/Qdrant)                        │ │
│  │  - Embedding providers                                        │ │
│  │  - Ingestion functions                                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Service Roles and Responsibilities

| Component | Port | Container Name | Purpose |
|-----------|------|----------------|---------|
| **Frontend UI** | 3455 | (Dev server) | React dashboard, real-time telemetry, user interactions |
| **API Middleware** | 3030 | `claude-context-api-server` | REST API, WebSocket server, service orchestration |
| **PostgreSQL** | 5533 | `claude-context-postgres` | Metadata storage, projects, datasets, chunks, relationships |
| **Qdrant** | 6333 | `claude-context-qdrant` | Vector embeddings storage, similarity search |
| **Crawl4AI** | 7070 | `claude-context-crawl4ai` | Web crawling, content extraction, chunking, summarization |

### Network Topology

All services run on a Docker bridge network (`claude-context-network`) defined in `services/docker-compose.yml`:

```yaml
networks:
  claude-context-network:
    driver: bridge
```

**Internal Service Names:**
- `postgres` → PostgreSQL container (accessible as `postgres:5432` inside network)
- `qdrant` → Qdrant container (accessible as `qdrant:6333`)
- `crawl4ai` → Crawl4AI service (accessible as `crawl4ai:7070`)

**Host Access:**
- Frontend connects to API via `localhost:3030` (exposed port)
- API connects to services via internal Docker DNS names
- MCP server uses `localhost:5533` and `localhost:6333` (host ports)

---

## MCP Server Connection

### Overview

The MCP (Model Context Protocol) server (`mcp-server.js`) acts as a bridge between AI assistants (like Claude) and the claude-context-core library. It exposes tools that allow AI to index codebases, search code, manage projects, and trigger crawls.

### Core Library Integration

The MCP server imports and uses the compiled core library from `dist/core`:

```188:190:mcp-server.js
  const embedding = createEmbedding();
  const { vectorDatabase, pool: postgresPool } = createVectorDatabase();
  const context = new Context({ embedding, vectorDatabase, postgresPool });
```

**Key Components:**
- **Context**: Main orchestrator class from `src/context.ts`
- **Embedding Providers**: AutoEmbeddingMonster, OpenAI, Gemini, Ollama, VoyageAI
- **Vector Databases**: PostgresDualVectorDatabase, QdrantVectorDatabase
- **Ingestion Functions**: `ingestGithubRepository`, `ingestCrawlPages`, `queryProject`

### Tool Registration

Tools are registered with the `claudeContext` namespace:

```206:206:mcp-server.js
  const toolNamespace = 'claudeContext';
```

**Registered Tools:**

1. **`claudeContext.init`** - Set default project/dataset
   - Location: ```208:256:mcp-server.js```
   - Uses: `getOrCreateProject`, `getOrCreateDataset`, `saveMcpDefaults`

2. **`claudeContext.index`** - Index codebase
   - Location: ```346:451:mcp-server.js```
   - Uses: `ingestGithubRepository` or `context.indexCodebase`
   - Sends progress updates via `mcpServer.sendLoggingMessage`

3. **`claudeContext.search`** - Semantic search
   - Location: ```487:580:mcp-server.js```
   - Uses: `queryProject` (project-aware) or `context.semanticSearch` (legacy)

4. **`claudeContext.ingestCrawl`** - Ingest crawled pages
   - Location: ```283:344:mcp-server.js```
   - Uses: `ingestCrawlPages` function

5. **`claudeContext.crawl`** - Trigger web crawl
   - Location: ```707:811:mcp-server.js```
   - Calls Crawl4AI service: `http://localhost:7070/crawl`
   - Polls progress: `http://localhost:7070/progress/{progress_id}`

6. **`claudeContext.searchChunks`** - Search chunks with filters
   - Location: ```897:967:mcp-server.js```
   - Calls: `http://localhost:7070/search`

### Database Connections

**PostgreSQL:**
- Connection string from `POSTGRES_CONNECTION_STRING` env var
- Pool created: ```134:138:mcp-server.js```
- Used for metadata, projects, datasets, chunks

**Vector Database:**
- Provider: `VECTOR_DATABASE_PROVIDER` (default: `postgres`)
- Postgres mode: Uses pgvector extension
- Qdrant mode: Separate service at `http://localhost:6333`

### Crawl4AI Integration

The MCP server directly calls the Crawl4AI service:

```736:740:mcp-server.js
      const startResponse = await fetch('http://localhost:7070/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crawlRequest)
      });
```

**Flow:**
1. POST to `/crawl` → Returns `progress_id`
2. Poll `/progress/{progress_id}` → Returns status, percentage, pages
3. Complete when `status === 'completed'`

---

## API Middleware Layer

### Express Server Setup

The API middleware is built with Express and runs in a Docker container:

```12:34:services/api-server/src/server.ts
async function main() {
  console.log('[Server] Starting API server...');
  console.log(`[Server] Postgres: ${config.postgresUrl.replace(/:[^:]*@/, ':***@')}`);
  console.log(`[Server] Qdrant: ${config.qdrantUrl}`);
  console.log(`[Server] Crawl4AI: ${config.crawl4aiUrl}`);

  // Initialize database connection
  const pool = new Pool({
    connectionString: config.postgresUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test database connection
  try {
    const client = await pool.connect();
    console.log('[Server] Database connection established');
    client.release();
  } catch (error: any) {
    console.error('[Server] Failed to connect to database:', error.message);
    process.exit(1);
  }
```

**Server Configuration:**
- Port: 3030 (from `config.port` or `PORT` env var)
- CORS: Enabled for all origins
- JSON body limit: 10MB

### REST API Routes

**Health & Tools:**
- `GET /health` - Service status and connections
- `GET /tools` - List available MCP tools

**Project Routes** (mounted at `/projects`):
```74:74:services/api-server/src/server.ts
  app.use('/projects', createProjectsRouter(pool, crawlMonitor));
```

**Route Implementations:**

1. **`GET /projects/:project/stats`**
   - Location: ```11:90:services/api-server/src/routes/projects.ts```
   - Returns: Metrics (datasets, chunks, web pages), pipeline phases
   - Database queries: Project aggregation queries

2. **`GET /projects/:project/scopes`**
   - Location: ```93:152:services/api-server/src/routes/projects.ts```
   - Returns: Scoped resources (global, project, local)
   - Database queries: Datasets grouped by scope

3. **`GET /projects/:project/ingest/history`**
   - Location: ```155:207:services/api-server/src/routes/projects.ts```
   - Returns: Recent ingestion jobs from `crawl_sessions` table

4. **`POST /projects/:project/ingest/crawl`**
   - Location: ```210:258:services/api-server/src/routes/projects.ts```
   - Forwards to: `http://crawl4ai:7070/api/crawl`
   - Tracks session: `crawlMonitor.trackSession(sessionId, project, dataset)`

5. **`POST /projects/:project/query`**
   - Location: ```261:274:services/api-server/src/routes/projects.ts```
   - Placeholder: Integration with `queryProject` pending

6. **`GET /projects/:project/operations`**
   - Location: ```277:324:services/api-server/src/routes/projects.ts```
   - Returns: Recent operations events (crawl sessions)

7. **`POST /projects/:project/share`**
   - Location: ```327:356:services/api-server/src/routes/projects.ts```
   - Creates: Share record in `project_shares` table

### WebSocket Server Implementation

**Initialization:**
```79:80:services/api-server/src/server.ts
  // Initialize WebSocket server
  const wsManager = new WebSocketManager(httpServer);
```

**WebSocket Manager:**
- Location: `services/api-server/src/websocket/index.ts`
- Path: `/ws` (relative to HTTP server)
- Protocol: WebSocket over HTTP upgrade

**Client Connection Flow:**
```21:53:services/api-server/src/websocket/index.ts
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
```

**Subscription Model:**
- Clients subscribe to projects and topics
- Messages filtered by project and topic
- Broadcast only to matching subscribers

```91:108:services/api-server/src/websocket/index.ts
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
```

### Monitor Services

Three monitor classes poll services and broadcast updates:

**1. PostgresMonitor**
- Location: `services/api-server/src/monitors/postgres-monitor.ts`
- Interval: 2000ms (from `config.postgresPollingInterval`)
- Queries: Project stats, recent crawls
- Messages: `postgres:stats` with project data

**2. CrawlMonitor**
- Location: `services/api-server/src/monitors/crawl-monitor.ts`
- Interval: 1000ms (from `config.crawlPollingInterval`)
- Tracks: Active crawl sessions
- Polls: `http://crawl4ai:7070/api/progress/{sessionId}`
- Messages: `crawl:progress` with percentage, status

**3. QdrantMonitor**
- Location: `services/api-server/src/monitors/qdrant-monitor.ts`
- Interval: 5000ms (from `config.qdrantPollingInterval`)
- Queries: Collection statistics
- Messages: `qdrant:stats` with point counts

**Monitor Startup:**
```83:93:services/api-server/src/server.ts
  postgresMonitor.start((message) => {
    wsManager.broadcast(message);
  });

  crawlMonitor.start((message) => {
    wsManager.broadcast(message);
  });

  qdrantMonitor.start((message) => {
    wsManager.broadcast(message);
  });
```

---

## Frontend Connection

### React Application Structure

**Entry Point:**
- Location: `ui/main.tsx`
- Renders: `App` component from `src/ui/app.tsx`

**Main Component:**
```158:249:src/ui/app.tsx
export function App(): JSX.Element {
  const [project, setProject] = React.useState('Atlas');
  const [mode, setMode] = React.useState<'mock' | 'live'>('mock');
  const [baseUrl, setBaseUrl] = React.useState('http://localhost:3030');
  // ... state management
```

**Mode Switching:**
- **Mock Mode**: Uses `MockContextApiClient` with in-memory data
- **Live Mode**: Uses `ContextApiClient` with HTTP requests to API middleware

### API Client Implementation

**Client Selection:**
```244:249:src/ui/app.tsx
  const client = React.useMemo<ContextClient>(() => {
    if (mode === 'live') {
      return new ContextApiClient({ baseUrl });
    }
    return new MockContextApiClient();
  }, [mode, baseUrl]);
```

**ContextApiClient:**
- Location: `src/ui/api/client.ts`
- Base URL: Configurable (default: `http://localhost:3030`)
- Methods: All REST endpoints match API routes

**Key Methods:**

1. **`fetchSnapshot(project)`**
   - Calls: `GET /projects/{project}/stats`
   - Returns: Metrics and pipeline phases

2. **`listScopeResources(project)`**
   - Calls: `GET /projects/{project}/scopes`
   - Returns: Resources by scope level

3. **`triggerCrawlIngest(form)`**
   - Calls: `POST /projects/{project}/ingest/crawl`
   - Payload: `start_url`, `crawl_type`, `max_pages`, `depth`, `dataset`, `scope`

4. **`runQuery(request)`**
   - Calls: `POST /projects/{project}/query`
   - Payload: Query string, filters, `k` (top-K results)

### WebSocket Hook

**Hook Implementation:**
- Location: `src/ui/hooks/useWebSocket.ts`
- Purpose: Real-time updates from API middleware

**Connection Setup:**
```252:256:src/ui/app.tsx
  const wsUrl = React.useMemo(() => {
    const url = new URL(baseUrl);
    const wsProtocol = url.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProtocol}://${url.host}/ws`;
  }, [baseUrl]);
```

**Hook Usage:**
```258:381:src/ui/app.tsx
  const { isConnected, connectionStatus, sendMessage } = useWebSocket({
    url: wsUrl,
    enabled: mode === 'live',
    project,
    onMessage: (message) => {
      setLastUpdate(new Date(message.timestamp).toLocaleTimeString());

      switch (message.type) {
        case 'postgres:stats':
          // Update metrics from database stats
          break;
        case 'crawl:progress':
          // Update pipeline progress
          break;
        case 'qdrant:stats':
          // Update vector counts
          break;
        case 'error':
          // Add to error list
          break;
      }
    },
```

**WebSocket Subscription:**
```67:74:src/ui/hooks/useWebSocket.ts
        // Subscribe to project updates
        if (project) {
          ws.send(JSON.stringify({
            action: 'subscribe',
            project,
            topics: ['postgres:stats', 'crawl:progress', 'qdrant:stats', 'error']
          }));
        }
```

**Message Handling:**
The frontend processes different message types:
- `postgres:stats`: Updates metrics (datasets, chunks, web pages)
- `crawl:progress`: Updates pipeline completion percentage
- `qdrant:stats`: Updates vector point counts
- `error`: Displays error notifications

**Debouncing:**
High-frequency updates are debounced:
```239:243:src/ui/app.tsx
  // Debouncing refs for high-frequency updates
  const lastProgressUpdateRef = React.useRef<number>(0);
  const lastStatsUpdateRef = React.useRef<number>(0);
  const DEBOUNCE_INTERVAL_MS = 500;
```

---

## Data Flow Diagrams

### Request Flow: UI → API → Services

```
┌─────────────┐
│  Frontend   │
│  (React UI) │
└──────┬──────┘
       │
       │ 1. User action (form submit, button click)
       │    - Example: Trigger crawl ingest
       ▼
┌──────────────────────────────────────┐
│  ContextApiClient                    │
│  - triggerCrawlIngest(form)          │
│  - POST http://localhost:3030/       │
│    projects/{project}/ingest/crawl  │
└──────┬───────────────────────────────┘
       │
       │ 2. HTTP POST Request
       │    Body: { start_url, crawl_type, max_pages, ... }
       ▼
┌──────────────────────────────────────┐
│  API Middleware                      │
│  - Express Router                    │
│  - Route: POST /projects/:project/   │
│    ingest/crawl                      │
│  - Forward to Crawl4AI               │
└──────┬───────────────────────────────┘
       │
       │ 3. HTTP POST to Crawl4AI
       │    http://crawl4ai:7070/api/crawl
       ▼
┌──────────────────────────────────────┐
│  Crawl4AI Service                    │
│  - Receives crawl request             │
│  - Starts crawl session               │
│  - Returns: { session_id, status }   │
└──────┬───────────────────────────────┘
       │
       │ 4. Response to API
       │    { jobId: session_id, status: 'queued' }
       ▼
┌──────────────────────────────────────┐
│  API Middleware                      │
│  - crawlMonitor.trackSession()       │
│  - Returns response to frontend      │
└──────┬───────────────────────────────┘
       │
       │ 5. HTTP Response
       │    { jobId, status }
       ▼
┌──────────────────────────────────────┐
│  Frontend                             │
│  - Updates ingestionJobs state        │
│  - Displays job in recent jobs table  │
└───────────────────────────────────────┘
```

### Real-time Telemetry Pipeline

```
┌─────────────────┐
│   PostgreSQL    │
│   (Database)    │
└────────┬────────┘
         │
         │ Poll (every 2s)
         ▼
┌──────────────────────────────────────┐
│  PostgresMonitor                     │
│  - Queries project stats             │
│  - Detects changes                   │
│  - Creates WebSocketMessage          │
└──────┬───────────────────────────────┘
       │
       │ onUpdate(message)
       ▼
┌──────────────────────────────────────┐
│  WebSocketManager                    │
│  - broadcast(message)                │
│  - Filters by project/topic           │
└──────┬───────────────────────────────┘
       │
       │ WebSocket.send()
       │ (to all subscribed clients)
       ▼
┌──────────────────────────────────────┐
│  Frontend WebSocket                  │
│  - useWebSocket hook                 │
│  - onMessage handler                  │
│  - Updates React state               │
└──────┬───────────────────────────────┘
       │
       │ setSnapshot(), setMetrics()
       ▼
┌──────────────────────────────────────┐
│  React UI                            │
│  - Re-renders with new data          │
│  - Updates metrics display           │
│  - Shows real-time progress          │
└──────────────────────────────────────┘
```

### Ingestion Workflow

```
User submits crawl form
         │
         ▼
Frontend: triggerCrawlIngest()
         │
         ▼
API: POST /projects/:project/ingest/crawl
         │
         ├─► Validate request
         │
         ├─► Forward to Crawl4AI
         │   POST http://crawl4ai:7070/api/crawl
         │
         ├─► Crawl4AI starts session
         │   - Returns session_id
         │
         ├─► API tracks session
         │   crawlMonitor.trackSession(sessionId, project, dataset)
         │
         └─► Return jobId to frontend
             │
             ▼
Frontend displays job in queue
             │
             ▼
CrawlMonitor polls progress (every 1s)
    GET http://crawl4ai:7070/api/progress/{sessionId}
             │
             ├─► Status: running
             │   └─► Broadcast crawl:progress message
             │       └─► Frontend updates pipeline progress
             │
             └─► Status: completed
                 ├─► Crawl4AI stores pages in Postgres/Qdrant
                 ├─► Broadcast crawl:progress (100%)
                 └─► Remove from active sessions
```

### Query Workflow

```
User submits query form
         │
         ▼
Frontend: runQuery(request)
         │
         ▼
API: POST /projects/:project/query
         │
         ├─► [PLACEHOLDER: Integration pending]
         │   Should call: queryProject(context, {...})
         │
         └─► Return results
             │
             ▼
Frontend displays results
- Chunk matches
- Scores (vector, sparse, rerank)
- File locations
```

**Note:** The query endpoint is currently a placeholder. Full integration with `queryProject` from the core library is pending.

---

## Service Dependencies

### Docker Compose Network

All services run in the same Docker network:

```153:155:services/docker-compose.yml
networks:
  claude-context-network:
    driver: bridge
```

**Service Dependencies:**

```
api-server
  ├─► depends_on: postgres (healthy)
  ├─► depends_on: qdrant (healthy)
  └─► depends_on: crawl4ai (healthy)

crawl4ai
  ├─► depends_on: postgres (healthy)
  └─► depends_on: qdrant (healthy)
```

### Database Connections

**PostgreSQL:**
- Connection String Format: `postgres://postgres:{password}@postgres:5432/claude_context`
- From API: Uses `config.postgresUrl` (default includes `localhost:5533` for host access)
- Pool Size: 20 connections (API server), 10 connections (MCP server default)

**Qdrant:**
- URL: `http://qdrant:6333` (internal), `http://localhost:6333` (host)
- API: REST and gRPC on port 6333
- Collections: Created dynamically per project/dataset

### Inter-Service Communication

**API → Crawl4AI:**
```220:232:services/api-server/src/routes/projects.ts
      // Forward to Crawl4AI service
      const crawlResponse = await fetch(`${config.crawl4aiUrl}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_url,
          project,
          dataset: dataset || 'web-pages',
          crawl_type: crawl_type || 'breadth-first',
          max_pages: max_pages || 25,
          depth: depth || 2,
          scope: scope || 'project'
        })
      });
```

**API → PostgreSQL:**
- Direct connection via `pg.Pool`
- Queries: Project stats, scopes, ingestion history, operations

**API → Qdrant:**
- HTTP requests via `config.qdrantUrl`
- Endpoints: Collections, points, search

**Crawl4AI → PostgreSQL:**
- Writes: Pages, chunks, crawl sessions
- Connection via environment variables

**Crawl4AI → Qdrant:**
- Writes: Vector embeddings
- Connection via `QDRANT_URL` env var

### Port Mappings

| Service | Internal Port | Host Port | Access Pattern |
|---------|--------------|-----------|----------------|
| PostgreSQL | 5432 | 5533 | Host: `localhost:5533`, Docker: `postgres:5432` |
| Qdrant | 6333 | 6333 | Host: `localhost:6333`, Docker: `qdrant:6333` |
| Crawl4AI | 7070 | 7070 | Host: `localhost:7070`, Docker: `crawl4ai:7070` |
| API Server | 3030 | 3030 | Host: `localhost:3030` |

---

## Real-time Updates Pipeline

### Message Types

**1. `postgres:stats`**
```typescript
{
  type: 'postgres:stats',
  project?: string,  // Optional project filter
  timestamp: string,  // ISO 8601
  data: {
    projects: Array<{
      name: string,
      datasets: number,
      chunks: number,
      webPages: number
    }>,
    recentCrawls: Array<{
      sessionId: string,
      project: string,
      dataset: string,
      status: string,
      pagesCrawled: number,
      durationMs: number
    }>
  }
}
```

**2. `crawl:progress`**
```typescript
{
  type: 'crawl:progress',
  project?: string,
  sessionId: string,
  timestamp: string,
  data: {
    sessionId: string,
    phase: string,
    percentage: number,
    current: number,
    total: number,
    status: 'running' | 'completed' | 'failed'
  }
}
```

**3. `qdrant:stats`**
```typescript
{
  type: 'qdrant:stats',
  timestamp: string,
  data: Array<{
    collectionName: string,
    pointsCount: number
  }>
}
```

**4. `error`**
```typescript
{
  type: 'error',
  timestamp: string,
  data: {
    source: string,      // 'postgres', 'crawl', 'qdrant', 'api'
    message: string,
    details?: string,
    project?: string
  }
}
```

### Message Routing

**Broadcast Flow:**
1. Monitor detects change → calls `onUpdate(message)`
2. `WebSocketManager.broadcast(message)` called
3. Iterates all connected clients
4. Filters by:
   - **Project match**: If message has `project`, only send to clients subscribed to that project
   - **Topic match**: If client has subscriptions, only send matching topics
5. Sends JSON stringified message to matching clients

**Subscription:**
- Clients send: `{ action: 'subscribe', project: 'Atlas', topics: [...] }`
- Server stores: `ClientSubscription` with project and topic set
- Filtering: Applied in `broadcast()` method

### Frontend State Updates

**Debounced Updates:**
- High-frequency messages (crawl progress, stats) are debounced
- Interval: 500ms (`DEBOUNCE_INTERVAL_MS`)
- Prevents UI thrashing from rapid updates

**State Management:**
```typescript
// Metrics updated from postgres:stats
setSnapshot(prev => ({
  ...prev,
  metrics: updatedMetrics
}));

// Pipeline progress from crawl:progress
setSnapshot(prev => ({
  ...prev,
  pipeline: prev.pipeline.map((phase, idx) => {
    if (idx === 0) {
      return { ...phase, completion: safeCompletion };
    }
    return phase;
  })
}));
```

---

## Configuration Reference

### Environment Variables

**API Server** (`services/api-server/`):
```typescript
PORT=3030                              // API server port
POSTGRES_URL=postgres://...           // PostgreSQL connection string
QDRANT_URL=http://localhost:6333      // Qdrant service URL
CRAWL4AI_URL=http://localhost:7070    // Crawl4AI service URL
NODE_ENV=production                   // Environment mode
```

**MCP Server** (root):
```bash
EMBEDDING_PROVIDER=embeddingmonster   // Embedding provider
EMBEDDING_MODEL=auto                  // Model selection
POSTGRES_CONNECTION_STRING=...       // PostgreSQL connection
VECTOR_DATABASE_PROVIDER=postgres     // Vector DB provider
STELLA_PORT=30001                     // EmbeddingMonster GTE port
CODERANK_PORT=30002                  // EmbeddingMonster CodeRank port
OPENAI_API_KEY=...                   // (if using OpenAI)
GEMINI_API_KEY=...                   // (if using Gemini)
VOYAGEAI_API_KEY=...                 // (if using VoyageAI)
OLLAMA_HOST=...                      // (if using Ollama)
QDRANT_URL=...                       // (if using Qdrant)
QDRANT_API_KEY=...                    // (optional Qdrant auth)
```

### Configuration Files

**API Server Config:**
- Location: `services/api-server/src/config.ts`
- Polling Intervals:
  - `postgresPollingInterval`: 2000ms
  - `crawlPollingInterval`: 1000ms
  - `qdrantPollingInterval`: 5000ms

**Docker Compose:**
- Location: `services/docker-compose.yml`
- Network: `claude-context-network`
- Volumes: `postgres_data`, `qdrant_storage`, `playwright_cache`

### Service URLs

**Development (Localhost):**
- Frontend UI: `http://localhost:3455`
- API Server: `http://localhost:3030`
- WebSocket: `ws://localhost:3030/ws`
- PostgreSQL: `postgres://postgres:password@localhost:5533/claude_context`
- Qdrant: `http://localhost:6333`
- Crawl4AI: `http://localhost:7070`

**Docker Internal:**
- PostgreSQL: `postgres://postgres:password@postgres:5432/claude_context`
- Qdrant: `http://qdrant:6333`
- Crawl4AI: `http://crawl4ai:7070`

---

## Summary

### Connection Points

1. **Frontend ↔ API**: HTTP REST + WebSocket
   - REST: `http://localhost:3030/projects/*`
   - WebSocket: `ws://localhost:3030/ws`

2. **API ↔ Databases**: Direct connections
   - PostgreSQL: `pg.Pool` connection
   - Qdrant: HTTP client

3. **API ↔ Crawl4AI**: HTTP REST
   - Endpoints: `/api/crawl`, `/api/progress/{id}`, `/api/search`

4. **MCP ↔ Services**: Direct connections
   - PostgreSQL: Pool connection
   - Vector DB: Postgres/Qdrant instances
   - Crawl4AI: HTTP client (`http://localhost:7070`)

### Data Flow Summary

- **User Actions** → Frontend → API → Services → Databases
- **Real-time Updates** → Monitors → WebSocket → Frontend → UI
- **MCP Tools** → MCP Server → Core Library → Databases

### Key Integration Points

- **Project Awareness**: All routes scoped by project name
- **Real-time Telemetry**: WebSocket broadcasts from monitors
- **Service Orchestration**: API middleware coordinates all services
- **Dual Storage**: PostgreSQL (metadata) + Qdrant (vectors)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27  
**Maintained By:** Claude Context Core Team
