# Dataset Collections Mapping - Root Cause Analysis

## The Real Problem

The `dataset_collections` table was empty even after implementing the fix because:

### Issue 1: Docker Image Had OLD Compiled Code

1. **Docker build process** (Dockerfile line 19):
   ```dockerfile
   COPY dist /dist
   ```
   This copies `dist/` **at build time**, not at run time.

2. **What happened**:
   - First Docker build: Copied OLD `dist/` from Nov 7
   - Then rebuilt TypeScript: Created NEW `dist/` on host (Nov 8)
   - But Docker container still had OLD files from first build
   - Container had `collection-helpers.js` from **Nov 7 20:04**
   - Host had `collection-helpers.js` from **Nov 8 15:01**

3. **File size mismatch confirmed it**:
   - Host: 6.6K (Nov 8)
   - Container: 5.5K (Nov 7)

### Issue 2: MCP Server Had Old Code in Memory

Two MCP server processes were running with old code loaded:
```
mewtwo  983327  - Started at 14:58 (old code)
mewtwo  1011945 - Started at 15:04 (old code)
```

Even after rebuilding TypeScript, these processes had the old code in memory.

## The Fix

### Step 1: Rebuild Docker with Fresh dist/ ✅

```bash
# Ensure TypeScript is compiled fresh
npx tsc --build --force

# Rebuild Docker container with --no-cache to force fresh copy
docker-compose -f services/docker-compose.yml build api-server --no-cache

# Restart to use new image
docker-compose -f services/docker-compose.yml restart api-server
```

### Step 2: Kill Old MCP Server Processes ✅

```bash
# Kill all old MCP server processes
pkill -9 -f "node.*mcp-server.js"

# MCP server will auto-restart through Windsurf/IDE
```

### Step 3: Backfill Existing Data ✅

For data indexed **before** the fix, manually create the mapping:

```sql
INSERT INTO claude_context.dataset_collections (
  dataset_id,
  collection_name,
  vector_db_type,
  dimension,
  is_hybrid,
  point_count,
  last_indexed_at,
  last_point_count_sync
)
SELECT 
  d.id,
  'hybrid_code_chunks_ea8707f8',
  'qdrant',
  768,
  true,
  7860,
  NOW(),
  NOW()
FROM claude_context.datasets d
WHERE d.name = 'local'
  AND d.project_id = (SELECT id FROM claude_context.projects WHERE name = 'AuMGFqLY-hypr-voice-ErNATJWC');
```

## Verification

Check that everything is working:

```bash
# 1. Check dataset_collections table has data
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context \
  -c "SELECT * FROM claude_context.dataset_collections;"

# Expected: 1 row with collection_name = 'hybrid_code_chunks_ea8707f8', point_count = 7860

# 2. Check Qdrant has the vectors
curl -s http://localhost:6333/collections/hybrid_code_chunks_ea8707f8 | jq '.result.points_count'

# Expected: 7860

# 3. Use MCP tool to verify
claudeContext.listDatasets({ project: "AuMGFqLY-hypr-voice-ErNATJWC" })

# Expected output:
# {
#   "qdrant_collection": "hybrid_code_chunks_ea8707f8",
#   "vectors_in_qdrant": 7860
# }
```

## Going Forward

### For New Indexing Operations

All future indexing will **automatically** create the dataset_collections mapping:

1. **MCP Server** (`claudeContext.index`)
   ```
   → context.indexWithProject()
     → getOrCreateCollectionRecord() ✅
     → updateCollectionMetadata() ✅
   ```

2. **API Server** (`POST /projects/:project/ingest/local`)
   ```
   → core.ingestGithubRepository()
     → context.indexWithProject()
       → getOrCreateCollectionRecord() ✅
       → updateCollectionMetadata() ✅
   ```

3. **GitHub Worker** (Background jobs)
   ```
   → GitHubWorker.processJob()
     → core.ingestGithubRepository()
       → context.indexWithProject()
         → getOrCreateCollectionRecord() ✅
         → updateCollectionMetadata() ✅
   ```

### When You Modify TypeScript Code

**CRITICAL**: You MUST follow this sequence:

```bash
# 1. Rebuild TypeScript (generates new dist/)
npx tsc --build --force

# 2. Rebuild API server Docker image (picks up new dist/)
docker-compose -f services/docker-compose.yml build api-server

# 3. Restart API server (uses new image)
docker-compose -f services/docker-compose.yml restart api-server

# 4. Kill MCP server processes (will auto-restart)
pkill -9 -f "node.*mcp-server.js"
```

**Why all steps are needed**:
- Step 1: Creates fresh JavaScript in `dist/`
- Step 2: Copies fresh `dist/` into Docker image
- Step 3: Runs container with new code
- Step 4: MCP server loads fresh code from `dist/`

### Logs to Watch

When indexing with the fix active, you'll see:

```bash
# MCP Server logs
tail -f logs/mcp-server.log | grep "Collection record"

# API Server logs
docker logs claude-context-api-server -f | grep "Collection record"

# Expected output:
[Context] ✅ Collection record: <uuid>
[Context] ✅ Updated collection metadata
```

## Status Summary

✅ **TypeScript code** - Has the fix (getOrCreateCollectionRecord calls)
✅ **Compiled dist/** - Fresh build with fix
✅ **API Server Docker** - Rebuilt with fresh dist/
✅ **API Server running** - Using new image with fix
✅ **MCP Server** - Will load fresh code on restart
✅ **Existing data** - Manually backfilled mapping
✅ **Future indexing** - Will automatically create mappings

---

**Fixed**: 2025-11-08 15:10 PM EST
**Issue**: Docker image using old compiled code + MCP server with code in memory
**Impact**: Critical - dataset_collections table empty, listDatasets shows "none"
**Resolution**: Rebuild Docker with --no-cache + restart MCP server + backfill existing data
