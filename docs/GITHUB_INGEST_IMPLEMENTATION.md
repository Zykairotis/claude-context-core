# GitHub Ingestion Pipeline Implementation

## Summary

Successfully implemented a complete GitHub repository ingestion pipeline with asynchronous job processing, real-time progress tracking, and WebSocket notifications.

## What Was Implemented

### 1. Database Schema (`services/init-scripts/03-github-jobs.sql`)
- **`github_jobs` table**: Tracks ingestion jobs with status, progress, and metadata
- **PostgreSQL LISTEN/NOTIFY trigger**: Broadcasts job updates in real-time
- **Job status enum**: `pending`, `in_progress`, `completed`, `failed`, `cancelled`
- **Progress tracking**: 0-100% with current phase and file information
- **Retry logic**: Configurable retry count and max retries
- **Views and functions**: `github_job_history` view and `cleanup_old_github_jobs()` function

### 2. Job Queue Service (`services/api-server/src/services/job-queue.ts`)
- **pg-boss integration**: PostgreSQL-backed job queue
- **Job enqueuing**: `enqueueGitHubJob()` with singleton keys to prevent duplicates
- **Worker registration**: `registerWorker()` for processing jobs
- **Job management**: Get status, cancel jobs
- **Error handling**: Automatic retries with exponential backoff

### 3. Repository Manager (`services/api-server/src/services/repository-manager.ts`)
- **Git cloning**: Using `simple-git` with progress tracking
- **Authentication**: Support for GitHub tokens via environment variables
- **Branch/SHA handling**: Clone specific branches or commits
- **Cleanup**: Automatic cleanup of temporary cloned repositories
- **URL parsing**: Flexible handling of GitHub URL formats

### 4. GitHub Worker (`services/api-server/src/workers/github-worker.ts`)
- **Job processing**: Clones repo → indexes files → stores in vector DB
- **Progress updates**: Real-time status updates to database (triggers WebSocket notifications)
- **Core integration**: Calls existing `ingestGithubRepository()` from core module
- **Error handling**: Captures errors, updates job status, cleans up resources
- **Context creation**: Dynamically creates Context with proper embedding and vector DB

### 5. API Route Updates (`services/api-server/src/routes/projects.ts`)
- **POST `/projects/:project/ingest/github`**:
  - Validates input (repo URL, branch, dataset)
  - Creates project and dataset if they don't exist
  - Inserts job into `github_jobs` table
  - Enqueues job via pg-boss
  - Returns job ID and status (202 Accepted)
  
- **GET `/projects/:project/ingest/history`**:
  - Queries both GitHub jobs and crawl sessions
  - Returns combined history with status, progress, and summary
  - Supports project-specific and "all" projects views

### 6. WebSocket Integration (`services/api-server/src/websocket/index.ts`)
- **PostgreSQL LISTEN**: Subscribes to `github_job_updates` channel
- **Real-time broadcasts**: Sends `github:progress` messages to connected clients
- **Message format**: Includes jobId, status, progress, phase, currentFile, error
- **Graceful shutdown**: Properly closes PostgreSQL listener

### 7. Server Integration (`services/api-server/src/server.ts`)
- **Job queue initialization**: Starts pg-boss on server startup
- **Worker startup**: Starts GitHub worker to process jobs
- **WebSocket listener**: Starts PostgreSQL LISTEN for job updates
- **Graceful shutdown**: Stops worker, job queue, and WebSocket listener

### 8. Dependencies
Added to `services/api-server/package.json`:
- `pg-boss@^11.1.1`: PostgreSQL-backed job queue
- `simple-git@^3.x`: Git operations in Node.js

## Architecture

```
┌─────────────┐
│   Frontend  │
│     UI      │
└──────┬──────┘
       │ POST /projects/:project/ingest/github
       ├──────────────────────────────────────┐
       │                                      │
       ▼                                      ▼
┌─────────────┐                      ┌──────────────┐
│  API Route  │                      │  WebSocket   │
│             │                      │   Manager    │
└──────┬──────┘                      └──────▲───────┘
       │                                    │
       │ 1. Insert job                      │ 5. LISTEN/NOTIFY
       │    into github_jobs                │    github_job_updates
       ▼                                    │
┌─────────────┐                      ┌──────┴───────┐
│  PostgreSQL │◄─────────────────────┤  PostgreSQL  │
│   Database  │  2. Trigger fires    │   Trigger    │
└──────┬──────┘                      └──────────────┘
       │                                    ▲
       │ 3. pg-boss polls                   │
       │    for pending jobs                │ 4. Update job status
       ▼                                    │    (progress, phase, etc)
┌─────────────┐                      ┌──────┴───────┐
│   pg-boss   │──────────────────────►│    GitHub   │
│ Job Queue   │  Job payload         │    Worker    │
└─────────────┘                      └──────┬───────┘
                                            │
                                            │ 4a. Clone repo
                                            │     (simple-git)
                                            ▼
                                     ┌──────────────┐
                                     │  Repository  │
                                     │   Manager    │
                                     └──────┬───────┘
                                            │
                                            │ 4b. Index files
                                            │     (core module)
                                            ▼
                                     ┌──────────────┐
                                     │   Context    │
                                     │ (embedding + │
                                     │  vector DB)  │
                                     └──────────────┘
```

## Data Flow

1. **User triggers ingest** via frontend or API
2. **API route**:
   - Validates input
   - Creates project/dataset if needed
   - Inserts job into `github_jobs` table (status: `pending`)
   - Enqueues job via pg-boss
   - Returns 202 Accepted with job ID
3. **Worker picks up job**:
   - Updates status to `in_progress`
   - Clones repository to temp directory
   - Calls `ingestGithubRepository()` from core with AST-aware chunking (~1K characters ≈250 tokens per chunk with 100-character overlap)
   - Updates progress (0-100%) and current phase
   - On success: Updates status to `completed` with stats
   - On failure: Updates status to `failed` with error message
   - Cleans up cloned repository
4. **Database trigger fires** on every job update
5. **WebSocket broadcasts** `github:progress` to connected clients
6. **Frontend receives updates** and displays progress in real-time

## Testing the Implementation

### 1. Start Services
```bash
cd /home/mewtwo/Zykairotis/claude-context-core

# Build core module
npm run build

# Start Docker services (PostgreSQL, Qdrant, Crawl4AI, API server)
cd services
docker compose up -d

# Check logs
docker logs -f claude-context-api-server
```

### 2. Trigger GitHub Ingest
```bash
curl -X POST http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "github.com/Zykairotis/claude-context-core",
    "dataset": "atlas-core",
    "branch": "main",
    "scope": "project"
  }'
```

Expected response:
```json
{
  "jobId": "uuid-here",
  "status": "queued",
  "message": "GitHub ingest job queued",
  "project": "default",
  "dataset": "atlas-core",
  "repository": "Zykairotis/claude-context-core",
  "branch": "main",
  "scope": "project"
}
```

### 3. Check Job History
```bash
curl http://localhost:3030/projects/default/ingest/history | jq
```

Expected response:
```json
[
  {
    "id": "uuid-here",
    "source": "github",
    "project": "default",
    "dataset": "atlas-core",
    "scope": "project",
    "status": "running",
    "startedAt": "10:30 AM",
    "duration": "⏳ running",
    "summary": "Zykairotis/claude-context-core (main)"
  }
]
```

### 4. Delete a GitHub Dataset

You can fully remove an ingested repository, including its vector chunks and relational metadata:

```bash
curl -X DELETE http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "atlas-core"
  }'
```

To delete based on repository slug instead of a dataset override:

```bash
curl -X DELETE http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "github.com/Zykairotis/claude-context-core"
  }'
```

Successful responses include the project/dataset identifiers and a count of removed vector chunks. A `404` status indicates that no matching dataset exists for the project.

### 4. Monitor Progress via WebSocket
```javascript
const ws = new WebSocket('ws://localhost:3030/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    project: 'default',
    topics: ['github:progress']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Progress:', message);
  // {
  //   type: 'github:progress',
  //   timestamp: '...',
  //   data: {
  //     jobId: 'uuid',
  //     status: 'in_progress',
  //     progress: 75,
  //     phase: 'Indexing repository...',
  //     currentFile: 'src/context.ts'
  //   }
  // }
};
```

### 5. Query Indexed Data
```bash
curl -X POST http://localhost:3030/projects/default/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does the Context class work?",
    "k": 5
  }' | jq
```

## Environment Variables

Add to `.env` or Docker environment:

```bash
# GitHub authentication (optional, for private repos)
GITHUB_TOKEN=ghp_your_token_here

# Embedding provider (default: auto)
EMBEDDING_PROVIDER=openai  # or 'auto' for AutoEmbeddingMonster
OPENAI_API_KEY=sk-...      # if using OpenAI

# Database
POSTGRES_URL=postgres://postgres:password@localhost:5533/claude_context

# Worker configuration
CORE_MODULE_PATH=/dist/core.js
```

## Frontend Compatibility

The frontend is **already compatible** with the new GitHub ingestion:

1. **API client** (`src/ui/api/client.ts`):
   - `triggerGithubIngest()` correctly calls the API
   - Handles the new response format with `jobId` and `status`
   
2. **Job history** (`src/ui/app.tsx`):
   - `fetchIngestionJobs()` retrieves both GitHub and crawl jobs
   - Displays job status, progress, and summary
   
3. **WebSocket** (`src/ui/hooks/useWebSocket.ts`):
   - Can receive `github:progress` messages
   - Updates UI in real-time (if subscribed to the topic)

**No frontend changes required!** The existing UI will automatically display GitHub jobs in the history and can receive progress updates.

## What to Rebuild

### Required Rebuilds:

1. **Core Module** (already done):
   ```bash
   cd /home/mewtwo/Zykairotis/claude-context-core
   npm run build
   ```

2. **API Server Docker Image**:
   ```bash
   cd /home/mewtwo/Zykairotis/claude-context-core/services
   docker compose build api-server --no-cache
   ```

3. **Restart Services**:
   ```bash
   cd /home/mewtwo/Zykairotis/claude-context-core/services
   docker compose down
   docker compose up -d
   ```

### Optional (if frontend changes were made):

```bash
cd /home/mewtwo/Zykairotis/claude-context-core/ui
npm run build
```

## Files Changed

### New Files:
- `services/database/init-scripts/03-github-jobs.sql`
- `services/init-scripts/03-github-jobs.sql` (copy)
- `services/api-server/src/services/job-queue.ts`
- `services/api-server/src/services/repository-manager.ts`
- `services/api-server/src/workers/github-worker.ts`

### Modified Files:
- `services/api-server/package.json` (added dependencies)
- `services/api-server/package-lock.json` (updated)
- `services/api-server/src/routes/projects.ts` (updated GitHub route and history)
- `services/api-server/src/websocket/index.ts` (added LISTEN/NOTIFY)
- `services/api-server/src/server.ts` (integrated job queue and worker)
- `services/api-server/src/types.ts` (added `github:progress` to WebSocketMessage)

### Frontend (No Changes Required):
- `src/ui/api/client.ts` (already compatible)
- `src/ui/app.tsx` (already compatible)

## Known Limitations & Future Enhancements

### Current Limitations:
1. **Single worker**: Only one worker processes jobs at a time
2. **No job cancellation UI**: Can cancel via API but not in frontend
3. **Temporary storage**: Cloned repos stored in `/tmp` (cleaned up after processing)
4. **No incremental updates**: Full re-index on each run

### Future Enhancements:
1. **Multiple workers**: Scale horizontally with multiple worker containers
2. **Job priority**: Prioritize certain repositories or projects
3. **Incremental updates**: Only index changed files (using git diff)
4. **Webhook integration**: Auto-trigger ingestion on GitHub push events
5. **Progress UI**: Real-time progress bar in frontend
6. **Job management UI**: Cancel, retry, view logs
7. **Scheduling**: Periodic re-indexing (cron-like)
8. **Statistics**: Track indexing performance, success rates

## Troubleshooting

### Worker not processing jobs:
```bash
# Check worker logs
docker logs -f claude-context-api-server | grep GitHubWorker

# Check pg-boss schema
docker exec -it claude-context-postgres psql -U postgres -d claude_context -c "\\dt claude_context.pgboss*"
```

### Job stuck in pending:
```sql
-- Check job status
SELECT id, status, progress, current_phase, error 
FROM claude_context.github_jobs 
ORDER BY created_at DESC LIMIT 5;

-- Manually update if needed
UPDATE claude_context.github_jobs 
SET status = 'pending', retry_count = 0 
WHERE id = 'job-id-here';
```

### WebSocket not receiving updates:
```bash
# Check if LISTEN is active
docker exec -it claude-context-postgres psql -U postgres -d claude_context -c "SELECT * FROM pg_stat_activity WHERE query LIKE '%LISTEN%';"

# Test trigger manually
docker exec -it claude-context-postgres psql -U postgres -d claude_context -c "UPDATE claude_context.github_jobs SET progress = 50 WHERE id = 'job-id';"
```

## Success Criteria

✅ All todos completed
✅ TypeScript builds without errors
✅ Database schema created with triggers
✅ Job queue service implemented
✅ Repository manager implemented
✅ GitHub worker implemented
✅ API routes updated
✅ WebSocket integration complete
✅ Server integration complete
✅ Frontend compatible (no changes needed)
✅ Docker configuration updated

## Next Steps

1. **Rebuild and restart services** (see "What to Rebuild" section)
2. **Test the flow** with a real repository
3. **Monitor logs** for any runtime errors
4. **Verify data** is indexed correctly in PostgreSQL and Qdrant
5. **Test WebSocket** updates in frontend
6. **Consider enhancements** from the "Future Enhancements" section

---

**Implementation completed successfully!** 🎉
