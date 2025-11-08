# Public Repo Cloning - No Token Required ✅

## Summary

**Public GitHub repositories can now be cloned WITHOUT needing a GITHUB_TOKEN.**

The system automatically handles both public and private repos:
- ✅ **Public repos**: Work without any authentication
- ✅ **Private repos**: Require GITHUB_TOKEN to be set

---

## The Fix

### Problem
Git in Docker containers was trying to prompt for credentials:
```
fatal: could not read Username for 'https://github.com': No such device or address
```

This happened even for public repos because Git couldn't access a terminal (TTY) to prompt.

### Solution
Disabled Git credential prompting by configuring:
```typescript
await gitWithProgress.addConfig('core.askPass', '');
await gitWithProgress.addConfig('credential.helper', '');
```

**Location**: `/services/api-server/src/services/repository-manager.ts` (lines 77-79)

---

## How It Works

### Public Repositories

**No token needed** - Just provide the repo URL:

```bash
curl -X POST http://localhost:3030/projects/test/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/openai/openai-python",
    "dataset": "openai-python",
    "branch": "main"
  }'
```

**Examples of public repos you can clone**:
- `https://github.com/openai/openai-python`
- `https://github.com/anthropics/anthropic-sdk-python`
- `https://github.com/pytorch/pytorch`
- `https://github.com/tensorflow/tensorflow`
- Any other public GitHub repository

### Private Repositories

**Token required** - Set GITHUB_TOKEN environment variable:

```bash
# Option 1: Export in shell
export GITHUB_TOKEN=ghp_your_github_personal_access_token
docker-compose -f services/docker-compose.yml restart api-server

# Option 2: Add to .env file (permanent)
echo 'GITHUB_TOKEN=ghp_your_token' >> .env
docker-compose -f services/docker-compose.yml restart api-server

# Then clone private repo
curl -X POST http://localhost:3030/projects/test/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/your-org/private-repo",
    "dataset": "private-repo",
    "branch": "main"
  }'
```

---

## Testing

### Test Public Repo (No Token)

```bash
# Clone a small public repo for testing
curl -X POST http://localhost:3030/projects/public-test/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/octocat/Hello-World",
    "dataset": "hello-world",
    "branch": "master"
  }'

# Watch progress
docker logs claude-context-api-server -f | grep -E "(GitHubWorker|Cloning|indexed)"
```

**Expected output**:
```
[GitHubWorker] Processing job...
[RepositoryManager] Cloning https://github.com/octocat/Hello-World to /tmp/...
[RepositoryManager] Successfully cloned https://github.com/octocat/Hello-World
[Context] ✅ Project-aware indexing completed! Processed X files, generated Y chunks
```

### Test Private Repo (With Token)

```bash
# First set token
export GITHUB_TOKEN=ghp_your_token_here
docker-compose -f services/docker-compose.yml restart api-server

# Wait for restart
sleep 5

# Clone private repo
curl -X POST http://localhost:3030/projects/private-test/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/your-org/your-private-repo",
    "dataset": "private-repo"
  }'
```

### Verify in Database

```bash
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context \
  -c "SELECT 
        p.name as project,
        d.name as dataset,
        dc.collection_name,
        dc.point_count
      FROM claude_context.projects p
      JOIN claude_context.datasets d ON p.id = d.project_id
      LEFT JOIN claude_context.dataset_collections dc ON d.id = dc.dataset_id
      ORDER BY d.created_at DESC
      LIMIT 5;"
```

---

## Authentication Flow

### When Token is NOT Set

```javascript
// Worker code (github-worker.ts)
auth: process.env.GITHUB_TOKEN ? {
  username: 'x-access-token',
  token: process.env.GITHUB_TOKEN
} : undefined  // ← undefined for public repos
```

### When Token IS Set

```javascript
auth: {
  username: 'x-access-token',  // GitHub requires this username
  token: process.env.GITHUB_TOKEN
}
```

The repository manager then:
1. Checks if auth is provided
2. If yes: adds credentials to URL (`https://x-access-token:TOKEN@github.com/...`)
3. If no: uses plain URL (`https://github.com/...`)
4. In both cases: disables credential prompting (fixed the Docker issue)

---

## Troubleshooting

### Error: "could not read Username"

**This should NOT happen anymore**, but if it does:

1. **Check Git config is applied**:
```bash
docker exec claude-context-api-server grep -A 2 "Configure Git to not prompt" /app/dist/services/repository-manager.js
```

Should show:
```javascript
await gitWithProgress.addConfig('core.askPass', '');
await gitWithProgress.addConfig('credential.helper', '');
```

2. **Rebuild API server**:
```bash
npm run build
docker-compose -f services/docker-compose.yml build --no-cache api-server
docker-compose -f services/docker-compose.yml up -d api-server
```

### Error: "Repository not found"

**For public repos**:
- Check the URL is correct
- Verify repo actually exists and is public
- Try accessing it in a browser first

**For private repos**:
- Verify GITHUB_TOKEN is set: `docker exec claude-context-api-server sh -c 'echo $GITHUB_TOKEN | cut -c1-10'`
- Check token has repo access: https://github.com/settings/tokens
- Make sure token hasn't expired

### Error: "Authentication failed"

**This means your token is invalid or expired**:
1. Generate new token: https://github.com/settings/tokens
2. Required scopes: `repo` (for private repos)
3. Update environment variable
4. Restart API server

---

## GitHub Token Scopes

### For Public Repos Only
**No token needed** ✅

### For Private Repos
**Token required** with these scopes:
- ✅ `repo` - Full control of private repositories
  - Includes: repo:status, repo_deployment, public_repo, repo:invite, security_events

**Creating a token**:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it: "Claude Context API Server"
4. Select scopes: `repo`
5. Generate and copy the token
6. Set it: `export GITHUB_TOKEN=ghp_your_token`

---

## Examples

### Popular Public Repos to Test

**Small repos** (good for quick tests):
```bash
# Octocat's Hello World (tiny)
curl -X POST http://localhost:3030/projects/test/ingest/github \
  -d '{"repoUrl": "https://github.com/octocat/Hello-World", "dataset": "hello-world"}'

# GitHub's gitignore templates
curl -X POST http://localhost:3030/projects/test/ingest/github \
  -d '{"repoUrl": "https://github.com/github/gitignore", "dataset": "gitignore"}'
```

**Medium repos** (more realistic):
```bash
# OpenAI Python SDK
curl -X POST http://localhost:3030/projects/test/ingest/github \
  -d '{"repoUrl": "https://github.com/openai/openai-python", "dataset": "openai"}'

# Anthropic Python SDK
curl -X POST http://localhost:3030/projects/test/ingest/github \
  -d '{"repoUrl": "https://github.com/anthropics/anthropic-sdk-python", "dataset": "anthropic"}'
```

**Large repos** (will take time):
```bash
# PyTorch (large!)
curl -X POST http://localhost:3030/projects/test/ingest/github \
  -d '{"repoUrl": "https://github.com/pytorch/pytorch", "dataset": "pytorch"}'
```

---

## Status

✅ **Public repos** - Work without token  
✅ **Private repos** - Work with token  
✅ **Fix deployed** - In production  
✅ **Tested** - Ready to use  

**Pushed to GitHub**: Commit `4c2d2d2`

---

## Quick Reference

| Repo Type | Token Needed? | Command |
|-----------|---------------|---------|
| **Public** | ❌ No | `curl -X POST .../ingest/github -d '{"repoUrl": "https://github.com/org/repo"}'` |
| **Private** | ✅ Yes | `export GITHUB_TOKEN=ghp_xxx && docker-compose restart api-server` then curl |

**Remember**: 
- Public repos = Just clone
- Private repos = Set token first, then clone
