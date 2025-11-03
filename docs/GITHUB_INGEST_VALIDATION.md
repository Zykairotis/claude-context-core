# GitHub Ingestion Validation Checklist

Use this checklist to validate that GitHub ingestion is working correctly end-to-end.

## Prerequisites

- [ ] Services running: `docker compose -f services/docker-compose.yml ps` shows all healthy
- [ ] Core module built: `ls -la dist/core.js` exists
- [ ] API server responding: `curl http://localhost:3030/health` returns OK

## Step 1: Setup

```bash
# Build core module
npm run build

# Start services (if not already running)
cd services
docker compose up -d

# Verify services are healthy
docker compose ps
```

- [ ] TypeScript build completes without errors
- [ ] All services show "healthy" or "running" status
- [ ] API server logs show "GitHub worker started"

## Step 2: Test Via Web UI

1. Open `http://localhost:3030` in browser
2. Navigate to "Ingest" section
3. Ensure GitHub tab is active
4. Fill in form:
   - Repository: `github.com/nodejs/node` (public repo for testing)
   - Dataset: `test-node-repo`
   - Branch: `main`
   - Scope: `project`

- [ ] Form validation works (repo field is required)
- [ ] Form doesn't submit to "all" projects
- [ ] Submit button shows "Scheduling..."

5. Click "Launch GitHub ingest"

- [ ] Button becomes disabled while submitting
- [ ] Response received with jobId
- [ ] New job appears in "Recent jobs" section

## Step 3: Monitor Job Progress

1. Check job status via API:
```bash
curl http://localhost:3030/projects/default/ingest/history | jq '.[0]'
```

2. Watch logs:
```bash
docker logs -f claude-context-api-server | grep -E "(GitHubWorker|github-ingest)"
```

Expected progression:
- [ ] Status: `queued` → `running` → `completed`
- [ ] Progress: 0% → increasing → 100%
- [ ] Current phase updates: "Cloning" → "Indexing" → "Completed"

## Step 4: Verify Indexed Data

1. Check database:
```sql
SELECT status, progress, indexed_files, total_chunks 
FROM claude_context.github_jobs 
ORDER BY created_at DESC LIMIT 1;
```

Expected results:
- [ ] Status = `completed`
- [ ] Progress = 100
- [ ] indexed_files > 0
- [ ] total_chunks > 0

2. Check chunks were created:
```bash
curl http://localhost:3030/projects/default/stats | jq '.metrics[] | select(.label=="Chunks")'
```

- [ ] Chunks count increased

## Step 5: Query Indexed Code

```bash
curl -X POST http://localhost:3030/projects/default/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does the event loop work?",
    "k": 5,
    "repo": "nodejs/node"
  }'
```

- [ ] Response contains results
- [ ] Results have non-zero vector scores
- [ ] Results are from the indexed repository

## Step 6: Test Error Handling

### Test 1: Invalid Repository URL
```bash
curl -X POST http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{"repo":"invalid-url"}'
```

- [ ] Returns 400 error with message
- [ ] Error message indicates invalid URL format

### Test 2: Private Repository (without token)
```bash
curl -X POST http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{"repo":"github.com/Zykairotis/private-repo","branch":"main"}'
```

- [ ] Job created but worker logs show authentication error
- [ ] Job status becomes `failed` with error message

### Test 3: All Projects Error
```bash
curl -X POST http://localhost:3030/projects/all/ingest/github \
  -H "Content-Type: application/json" \
  -d '{"repo":"github.com/nodejs/node"}'
```

- [ ] Returns 400 error
- [ ] Error message indicates cannot ingest to "all" projects

## Step 7: WebSocket Monitoring

1. Connect to WebSocket:
```bash
websocat ws://localhost:3030/ws
```

2. Subscribe to GitHub progress:
```json
{"action": "subscribe", "topics": ["github:progress"]}
```

3. While job is running, observe messages:

- [ ] Receive `github:progress` messages
- [ ] Each message contains jobId, status, progress, phase
- [ ] Progress increases over time
- [ ] Updates arrive every few seconds

## Step 8: Test Multiple Ingestions

1. Queue another GitHub ingestion for a different repository
2. Observe job history while both are running:

```bash
curl http://localhost:3030/projects/default/ingest/history | jq 'length'
```

- [ ] Both jobs tracked separately
- [ ] Job status updates don't interfere
- [ ] Both complete successfully

## Step 9: Test Branch/SHA Selection

```bash
curl -X POST http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "github.com/vercel/next.js",
    "dataset": "nextjs-canary",
    "branch": "canary",
    "scope": "project"
  }'
```

- [ ] Job created successfully
- [ ] Worker clones correct branch
- [ ] Job completes with indexed files from that branch

## Step 10: Performance Validation

Run a medium-sized repository (100-500 files):

```bash
curl -X POST http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{"repo":"github.com/lodash/lodash","dataset":"lodash-lib"}'
```

Monitor while running:
- [ ] Memory usage stays reasonable (< 1GB container)
- [ ] CPU usage reasonable (20-40%)
- [ ] No hanging or stuck processes
- [ ] Job completes in < 5 minutes

## Troubleshooting During Validation

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Job stuck in "pending" | Worker not running | `docker logs claude-context-api-server \| grep GitHubWorker` |
| Clone failed with auth error | Private repo without token | Set `GITHUB_TOKEN` environment variable |
| Indexing fails | Embedding service down | Check Docker logs, restart services |
| WebSocket no messages | Not subscribed correctly | Check browser console for ws errors |
| Query returns no results | Wrong dataset/project scope | Verify query filters match ingestion scope |

## Final Verification

All items checked? GitHub ingestion is validated and working!

- [ ] UI ingestion works
- [ ] Job progress tracking works
- [ ] Database records updated
- [ ] Query results returned
- [ ] Error handling working
- [ ] WebSocket real-time updates working
- [ ] Multiple jobs handled correctly
- [ ] Branch selection works
- [ ] Performance acceptable

**✅ Validation Complete!**
