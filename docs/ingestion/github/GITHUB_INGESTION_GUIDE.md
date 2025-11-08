# GitHub Ingestion Usage Guide

## Overview

The GitHub ingestion feature is **fully implemented** and ready to use. It allows you to clone, index, and store GitHub repositories in your vector database for semantic search.

> 💡 **Idempotent by default** – if the same project/dataset/repo/branch/SHA has already been indexed successfully, the API returns the previous job instead of cloning again. Pass a `force` flag to override this cache.

## Prerequisites

1. **Services running**: PostgreSQL, Qdrant, API server, and workers must be running
   ```bash
   cd services
   docker compose up -d
   ```

2. **Core module built**: The TypeScript code must be compiled
   ```bash
   npm run build
   ```

3. **Database schema initialized**: The `github_jobs` table must exist (created automatically via init scripts)

## Method 1: Using the Web UI

1. **Access the UI**: Open `http://localhost:3030` (or your configured port)

2. **Navigate to Ingest section**: Click "Ingest" in the dock navigation

3. **Select GitHub tab**: The form should default to the GitHub tab

4. **Fill in the form**:
   - **Repository** (required): `github.com/org/repo` or `org/repo`
   - **Dataset** (optional): Name for the dataset (defaults to `org-repo`)
   - **Branch** (optional): Branch to clone (defaults to `main`)
   - **SHA** (optional): Specific commit SHA to checkout
   - **Scope**: Project, Global, or Local storage scope
   - **Force re-ingest** (optional): Tick to bypass the cache and re-run the ingest even when the repository is already indexed

5. **Submit**: Click "Launch GitHub ingest"

6. **Monitor progress**: 
   - Job appears in the "Recent jobs" section
   - Progress updates via WebSocket in real-time
   - Status shows: `queued` → `running` → `completed` or `failed`

## Method 2: Using cURL (API)

### Basic Example
```bash
curl -X POST http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "github.com/Zykairotis/claude-context-core",
    "dataset": "atlas-core",
    "branch": "main",
    "scope": "project",
    "force": false
  }'
```

### Response Format
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

### Check Job Status
```bash
curl http://localhost:3030/projects/default/ingest/history | jq
```

### Delete a Dataset
```bash
curl -X DELETE http://localhost:3030/projects/default/ingest/github \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataset": "atlas-core"
  }'
```

You can also omit `dataset` and provide `repo` (`org/repo` or any supported GitHub URL) to resolve the default dataset slug automatically. A successful deletion returns JSON containing the removed dataset identifiers and the number of vector chunks purged. A `404` response indicates that the project/dataset pair was not found.

## Method 3: Using the Frontend API Client

If you're building a custom frontend:

```typescript
import { ContextApiClient } from './api/client';

const client = new ContextApiClient({ baseUrl: 'http://localhost:3030' });

const job = await client.triggerGithubIngest({
  project: 'default',
  repo: 'github.com/org/repo',
  dataset: 'my-dataset',
  branch: 'main',
  scope: 'project'
});

await client.deleteGithubDataset('default', { dataset: 'atlas-core' });
```

## How It Works

1. **API receives request** → Creates job in `github_jobs` table
2. **pg-boss enqueues job** → Worker picks it up
3. **Worker clones repo** → Temporary directory using `simple-git`
4. **Worker indexes files** → Calls `ingestGithubRepository()` from core using chunked snippets (~1K characters ≈250 tokens, 100-character overlap) with AST-aware splitting where available
5. **Progress updates** → Database trigger fires → WebSocket broadcasts
6. **Cleanup** → Temporary clone directory removed

## Repository URL Formats Supported

All these formats work:
- `github.com/org/repo`
- `https://github.com/org/repo`
- `git@github.com:org/repo.git`
- `org/repo` (assumes github.com)

## Monitoring & Debugging

### View Job History
```bash
curl http://localhost:3030/projects/default/ingest/history | jq
```

### Check Worker Logs
```bash
docker logs -f claude-context-api-server | grep GitHubWorker
```

### Check Database Status
```sql
SELECT id, status, progress, current_phase, error 
FROM claude_context.github_jobs 
ORDER BY created_at DESC LIMIT 5;
```

### WebSocket Monitoring
Connect to `ws://localhost:3030/ws` and subscribe to `github:progress` topic to receive real-time updates.

## Environment Variables

Optional configuration:
- `GITHUB_TOKEN`: GitHub personal access token for private repos
- `EMBEDDING_PROVIDER`: `openai` or `auto` (default)
- `OPENAI_API_KEY`: Required if using OpenAI embeddings
- `POSTGRES_URL`: Database connection string
- `CORE_MODULE_PATH`: Path to compiled core module
- `CHUNK_CHAR_TARGET`: Target character length for chunks (default `1000`, ≈250 tokens)
- `CHUNK_CHAR_OVERLAP`: Character overlap between adjacent chunks (default `100`)
- `CHUNK_STATS_VERBOSE`: Set to `true` to log chunk size statistics during ingest
- `EMBEDDING_BATCH_SIZE_PER_REQUEST`: Overrides the embedding batch size (defaults to 32)

## Troubleshooting

### Job Stuck in "pending"
- Check if worker is running: `docker logs claude-context-api-server | grep GitHubWorker`
- Check pg-boss schema: `docker exec -it claude-context-postgres psql -U postgres -d claude_context -c "\dt claude_context.pgboss*"`
- If the previous job already finished, re-run with `force: true` to enqueue a new job

### Clone Fails
- Check network connectivity
- For private repos, ensure `GITHUB_TOKEN` is set
- Check repository URL format

### Indexing Fails
- Verify core module is built: `ls -la dist/core.js`
- Check embedding service is running (if using AutoEmbeddingMonster)
- Review worker logs for specific error messages

## Files Involved

- **API Route**: `services/api-server/src/routes/projects.ts` (GitHub ingest & delete endpoints)
- **Worker**: `services/api-server/src/workers/github-worker.ts`
- **Repository Manager**: `services/api-server/src/services/repository-manager.ts`
- **Job Queue**: `services/api-server/src/services/job-queue.ts`
- **Core Function**: `src/api/ingest.ts` (`ingestGithubRepository`)
- **Frontend UI**: `src/ui/app.tsx` (lines 774-812)
- **Frontend Client**: `src/ui/api/client.ts` (lines 165-190)
- **Database Schema**: `services/database/init-scripts/03-github-jobs.sql`

## Next Steps After Ingestion

Once a repository is ingested, you can query it:

```bash
curl -X POST http://localhost:3030/projects/default/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does the Context class work?",
    "k": 5,
    "repo": "Zykairotis/claude-context-core"
  }'
```

The ingested code will be searchable via semantic search across all chunks indexed from the repository.
