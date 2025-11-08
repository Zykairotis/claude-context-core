# GitHub Ingestion Quick Reference

## TL;DR - Ingest a Repository

### Via Web UI
1. Open http://localhost:3030
2. Click "Ingest" → GitHub tab
3. Enter repo: `github.com/org/repo`
4. (Optional) Tick **Force re-ingest** to bypass existing results
5. Click "Launch GitHub ingest"

### Via cURL
```bash
curl -X POST http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{"repo":"github.com/org/repo","dataset":"my-dataset","branch":"main","force":false}'
```

## Check Job Status
```bash
curl http://localhost:3030/projects/default/ingest/history | jq
```

## Query Indexed Code
```bash
curl -X POST http://localhost:3030/projects/default/query \
  -H "Content-Type: application/json" \
  -d '{"query":"how does this work?","k":5}'
```

## Common Issues

### Job Stuck in "pending"
```bash
docker logs -f claude-context-api-server | grep GitHubWorker
```
- If the previous ingest completed, add `"force": true` to re-run it

### Services Not Running
```bash
cd services
docker compose up -d
npm run build  # in root
```

### Clone Failed
- Check GITHUB_TOKEN for private repos
- Verify URL format: `github.com/org/repo`

## Environment Setup

```bash
# Optional: for private repos
export GITHUB_TOKEN=ghp_your_token_here

# Optional: specify embedding provider
export EMBEDDING_PROVIDER=auto  # or 'openai'
export OPENAI_API_KEY=sk_...

# Run services
cd services
docker compose up -d
```

## Full Documentation
See `GITHUB_INGESTION_GUIDE.md` for complete details
