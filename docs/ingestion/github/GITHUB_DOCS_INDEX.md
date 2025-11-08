# GitHub Ingestion Documentation Index

Complete documentation for the GitHub repository ingestion feature.

## Quick Navigation

### For Users (Just Want to Use It)
1. **Start here**: [Quick Reference](GITHUB_INGEST_QUICKREF.md) - 2 minute read
2. **Validate setup**: [Validation Checklist](GITHUB_INGEST_VALIDATION.md) - Run tests
3. **Ingest a repo**: Follow the UI or cURL examples

### For Developers (Want Details)
1. **Complete guide**: [Ingestion Guide](GITHUB_INGESTION_GUIDE.md) - Full documentation
2. **Validation**: [Validation Checklist](GITHUB_INGEST_VALIDATION.md) - Test everything
3. **Troubleshooting**: See sections in the main guide

---

## Document Descriptions

### GITHUB_INGEST_QUICKREF.md
**Length**: ~64 lines | **Time**: 2-3 minutes

Quick reference card with the essentials:
- TL;DR: 3-step UI process
- Copy-paste cURL examples
- Check job status commands
- Query indexed code
- Common issues & fixes
- Environment setup

**Best for**: Getting started quickly, reference during development

### GITHUB_INGESTION_GUIDE.md
**Length**: ~184 lines | **Time**: 10-15 minutes

Comprehensive guide covering:
- Prerequisites and setup
- Method 1: Web UI (step-by-step)
- Method 2: REST API (with examples)
- Method 3: Programmatic (TypeScript)
- How it works (architecture)
- Supported URL formats
- Monitoring & debugging commands
- Environment variables
- Troubleshooting guide
- Files involved (code references)
- Query examples

**Best for**: Learning the feature, understanding architecture, detailed reference

### GITHUB_INGEST_VALIDATION.md
**Length**: ~248 lines | **Time**: 30-45 minutes to complete

Step-by-step validation checklist:
- Step 1: Setup verification
- Step 2-5: Core functionality tests
- Step 6: Error handling tests
- Step 7: WebSocket monitoring
- Step 8: Multi-job handling
- Step 9: Branch/SHA selection
- Step 10: Performance testing
- Troubleshooting matrix
- Final verification checklist

**Best for**: Testing your setup, validating everything works

---

## Usage Scenarios

### Scenario 1: I Just Want to Ingest a Repo
1. Read: GITHUB_INGEST_QUICKREF.md (2 min)
2. Open: http://localhost:3030
3. Click: Ingest → GitHub
4. Submit: github.com/org/repo
5. Done!

### Scenario 2: I Want to Understand the Implementation
1. Read: GITHUB_INGESTION_GUIDE.md (15 min)
2. Review: Architecture section
3. Check: Files Involved section
4. Explore: Actual code in files listed

### Scenario 3: I Need to Test Everything Works
1. Read: GITHUB_INGEST_VALIDATION.md (start)
2. Follow: Step 1 (setup)
3. Execute: Steps 2-10 as checklist
4. Verify: Final verification section

### Scenario 4: Something's Broken
1. Check: Troubleshooting sections in GUIDE or VALIDATION
2. Run: Debugging commands from relevant doc
3. Inspect: Docker logs
4. Verify: Steps 1-3 of VALIDATION doc

---

## Key Concepts

### Three Ways to Ingest

| Method | Best For | Complexity |
|--------|----------|-----------|
| Web UI | Users, quick testing | Simple (clicks) |
| REST API | Automation, integration | Medium (JSON) |
| Programmatic | SDKs, advanced use | Complex (code) |

### Job Lifecycle

```
Submitted → Queued → Running → Completed
                            ↓
                          Failed
                            ↓
                         Cleanup
```

### Real-time Updates

- **Database**: PostgreSQL LISTEN/NOTIFY triggers
- **WebSocket**: Broadcasts `github:progress` messages
- **UI**: Updates job status and progress bars automatically
- **Idempotence**: The API skips duplicate ingests unless `force=true` is supplied

### Project Structure

```
Repository
├── Dataset 1 (indexed code)
├── Dataset 2 (indexed code)
└── Global Datasets (shared with others)
```

---

## Common Commands

### Trigger Ingestion
```bash
curl -X POST http://localhost:3030/projects/default/ingest/github \
  -H "Content-Type: application/json" \
  -d '{"repo":"github.com/org/repo","dataset":"my-dataset"}'
```

### Check Status
```bash
curl http://localhost:3030/projects/default/ingest/history | jq
```

### Query Results
```bash
curl -X POST http://localhost:3030/projects/default/query \
  -H "Content-Type: application/json" \
  -d '{"query":"how does this work?","k":5,"repo":"org/repo"}'
```

### Monitor Logs
```bash
docker logs -f claude-context-api-server | grep GitHubWorker
```

---

## Environment Variables

```bash
# Required (if private repos)
GITHUB_TOKEN=ghp_your_token_here

# Optional (defaults to 'auto')
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk_...
POSTGRES_URL=postgres://...
```

---

## Files in the Implementation

**API Layer**:
- `services/api-server/src/routes/projects.ts` - HTTP endpoint
- `services/api-server/src/services/job-queue.ts` - pg-boss queue

**Worker Processing**:
- `services/api-server/src/workers/github-worker.ts` - Job processing
- `services/api-server/src/services/repository-manager.ts` - Git operations

**Core Logic**:
- `src/api/ingest.ts` - Ingestion function
- `src/api/query.ts` - Query function

**Database**:
- `services/database/init-scripts/03-github-jobs.sql` - Schema

**Frontend**:
- `src/ui/app.tsx` - UI form (lines 774-812)
- `src/ui/api/client.ts` - API client (lines 165-190)

---

## Next Steps

1. **Get Started**: Read GITHUB_INGEST_QUICKREF.md
2. **Learn More**: Read GITHUB_INGESTION_GUIDE.md
3. **Validate**: Follow GITHUB_INGEST_VALIDATION.md
4. **Ingest**: Start adding GitHub repositories!

---

## Support

For issues or questions:
1. Check the Troubleshooting section in GITHUB_INGESTION_GUIDE.md
2. Review the Troubleshooting Matrix in GITHUB_INGEST_VALIDATION.md
3. Check Docker logs: `docker logs -f claude-context-api-server`
4. Verify database connection: `curl http://localhost:3030/health`

---

**Last Updated**: November 1, 2025
**Status**: Fully Implemented and Documented
