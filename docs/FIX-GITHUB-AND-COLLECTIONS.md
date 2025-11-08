# Fix: GitHub Cloning & Collection Name Issues

## Problems Found

### 1. ❌ GitHub Clone Failing
```
fatal: could not read Username for 'https://github.com': No such device or address
```

**Root Cause**: Docker container can't prompt for credentials when cloning public repos via HTTPS without a token.

### 2. ❌ Wrong Collection Name for ai-pydantic-dev
```sql
dataset: ai-pydantic-dev
collection: project_aumgfqly_hypr_voice_ernatjwc  ❌ WRONG (missing dataset suffix)
expected:   project_aumgfqly_hypr_voice_ernatjwc_dataset_ai_pydantic_dev
```

### 3. ✅ Crawl Fix Ready (Not Tested Yet)
The crawl dataset_collections fix is in place but hasn't been tested because no crawls have run yet.

---

## Fix #1: GitHub Cloning

### Option A: Add GITHUB_TOKEN (Recommended)

**Add to `/services/docker-compose.yml`**:
```yaml
api-server:
  environment:
    - GITHUB_TOKEN=${GITHUB_TOKEN}
```

**Add to `.env`** (create a GitHub PAT: https://github.com/settings/tokens):
```bash
GITHUB_TOKEN=ghp_your_token_here
```

**Restart API server**:
```bash
docker-compose -f services/docker-compose.yml restart api-server
```

### Option B: Fix Git Credential Helper (Alternative)

Update `/services/api-server/src/services/repository-manager.ts`:

```typescript
async clone(repoUrl: string, options: CloneOptions = {}): Promise<string> {
  // ... existing code ...

  try {
    console.log(`[RepositoryManager] Cloning ${repoUrl} to ${localPath}`);
    
    // ✅ FIX: Disable credential prompts for public repos
    await gitWithProgress.addConfig('core.askPass', '');
    await gitWithProgress.addConfig('credential.helper', '');
    
    await gitWithProgress.clone(authenticatedUrl, localPath, {
      '--depth': depth,
      '--single-branch': null,
      '--branch': branch,
      '--no-tags': null
    });
```

---

## Fix #2: Wrong Collection Name

The issue is that when indexing, the collection name wasn't properly constructed.

### Check Current State

```bash
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context -c "
SELECT 
  d.name as dataset,
  dc.collection_name,
  dc.point_count
FROM claude_context.datasets d
JOIN claude_context.dataset_collections dc ON d.id = dc.dataset_id
WHERE d.name = 'ai-pydantic-dev';"
```

### Manual Fix (If Needed)

```sql
-- Get the correct collection name from Qdrant
SELECT name FROM claude_context.qdrant_collections 
WHERE name LIKE '%ai_pydantic_dev%';

-- Update the dataset_collections record
UPDATE claude_context.dataset_collections
SET collection_name = 'project_aumgfqly_hypr_voice_ernatjwc_dataset_ai_pydantic_dev'
WHERE dataset_id = (
  SELECT id FROM claude_context.datasets WHERE name = 'ai-pydantic-dev'
);
```

### Verify Fix

```bash
# Check Qdrant collection
curl -s "http://localhost:6333/collections/project_aumgfqly_hypr_voice_ernatjwc_dataset_ai_pydantic_dev" | jq '.result.vectors_count'

# Should match point_count in database
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context -c "
SELECT dc.point_count, dc.collection_name
FROM claude_context.dataset_collections dc
JOIN claude_context.datasets d ON dc.dataset_id = d.id
WHERE d.name = 'ai-pydantic-dev';"
```

---

## Fix #3: Verify Crawl Fix is Ready

The crawl fix is in place but untested. To verify it will work:

### 1. Check Container Has Latest Code

```bash
# Check file timestamp (should be Nov 8 20:39)
docker exec claude-context-crawl4ai stat -c "%y" /app/app/storage/dataset_collection_helper.py
```

### 2. Test with Small Crawl

```bash
curl -X POST http://localhost:3030/projects/test-crawl-fix/ingest/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "start_url": "https://docs.python.org/3/tutorial/",
    "dataset": "test",
    "max_pages": 2,
    "depth": 1
  }'
```

### 3. Watch Logs for Success

```bash
docker logs claude-context-crawl4ai -f | grep -E "(dataset_collections|Created collection|Updated point)"

# Expected output:
# ✅ Created dataset_collections mapping: dataset_id=<uuid>, collection=<name>, record_id=<uuid>
# ✅ Updated point count for <collection>: <count>
```

### 4. Verify in Database

```bash
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context -c "
SELECT 
  d.name as dataset,
  dc.collection_name,
  dc.point_count,
  dc.created_at
FROM claude_context.datasets d
JOIN claude_context.dataset_collections dc ON d.id = dc.dataset_id
WHERE d.name = 'test'
ORDER BY dc.created_at DESC;"
```

---

## Root Cause Analysis

### GitHub Issue
- **Problem**: Docker container can't access terminal for credential prompts
- **Impact**: Public repo clones fail without GITHUB_TOKEN
- **Solution**: Either provide token OR disable credential prompts

### Collection Name Issue
- **Problem**: Scope manager generated wrong collection name during indexing
- **Impact**: MCP tools can't find vectors (shows 0)
- **Solution**: Re-index with correct scope OR manually fix database

### Crawl Issue (Preventative)
- **Problem**: Crawl path didn't create dataset_collections mappings
- **Status**: ✅ FIXED (awaiting test)
- **Impact**: Future crawls will work correctly

---

## Quick Fixes Summary

### Immediate (Do Now)

**1. Add GitHub Token**:
```bash
# Add to .env
echo 'GITHUB_TOKEN=ghp_your_token_here' >> .env

# Restart
docker-compose -f services/docker-compose.yml restart api-server
```

**2. Fix ai-pydantic-dev collection name**:
```bash
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context <<EOF
UPDATE claude_context.dataset_collections
SET collection_name = 'project_aumgfqly_hypr_voice_ernatjwc_dataset_ai_pydantic_dev'
WHERE dataset_id = (SELECT id FROM claude_context.datasets WHERE name = 'ai-pydantic-dev');
EOF
```

### Testing (Do After)

**3. Test crawl fix**:
```bash
# Small test crawl
curl -X POST http://localhost:3030/projects/test/ingest/crawl \
  -H "Content-Type: application/json" \
  -d '{"start_url": "https://example.com", "max_pages": 1, "dataset": "crawl-test"}'

# Watch logs
docker logs claude-context-crawl4ai -f | grep "dataset_collections"
```

---

## Verification Commands

```bash
# 1. Check all dataset_collections mappings
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context -c "
SELECT 
  p.name as project,
  d.name as dataset,
  dc.collection_name,
  dc.point_count,
  CASE 
    WHEN dc.collection_name IS NULL THEN '❌ Missing'
    WHEN dc.collection_name NOT LIKE '%' || d.name || '%' THEN '⚠️  Wrong Name'
    ELSE '✅ OK'
  END as status
FROM claude_context.projects p
JOIN claude_context.datasets d ON p.id = d.project_id
LEFT JOIN claude_context.dataset_collections dc ON d.id = dc.dataset_id
ORDER BY d.created_at DESC;"

# 2. Check GitHub token is set
docker exec claude-context-api-server sh -c 'echo $GITHUB_TOKEN | cut -c1-10'

# 3. Check crawl4ai has latest code
docker exec claude-context-crawl4ai test -f /app/app/storage/dataset_collection_helper.py && echo "✅ File exists" || echo "❌ Missing"
```

---

## Status

| Issue | Status | Fix Applied | Tested |
|-------|--------|-------------|--------|
| GitHub Clone Failure | ❌ Broken | ⏳ Pending | No |
| ai-pydantic-dev Name | ❌ Wrong | ⏳ Pending | No |
| Crawl Collections | ✅ Fixed | ✅ Yes | No (no crawls run yet) |

---

**Next Steps**:
1. Add GITHUB_TOKEN to .env
2. Fix ai-pydantic-dev collection name
3. Restart API server
4. Retry failed GitHub job
5. Test crawl with small dataset
