# Dataset Collections Mapping - Complete Fix

## Problem

When indexing data through the API server, the `dataset_collections` table was not being populated, causing `listDatasets` to show:
- ❌ `qdrant_collection`: "none"  
- ❌ `vectors_in_qdrant`: 0

Even though the data WAS actually indexed in Qdrant.

## Root Cause

The collection helper functions (`getOrCreateCollectionRecord`, `updateCollectionMetadata`) were added to the core TypeScript library but:

1. **API Server was using old compiled code** - The Docker container had the old `dist/` files
2. **Build pipeline issue** - TypeScript changes weren't being rebuilt into the API server

## Solution Applied

### Step 1: Core Library Fix (DONE ✅)

Added collection mapping logic in `/src/context.ts`:

```typescript
// Line 1149-1154: Create collection record during indexing
const { getOrCreateCollectionRecord, updateCollectionMetadata } = 
  await import('./utils/collection-helpers');

const collectionId = await getOrCreateCollectionRecord(
  pool,
  datasetRecord.id,
  collectionName,
  'qdrant',
  768,
  true // hybrid search
);
```

### Step 2: Rebuild Core Library (DONE ✅)

```bash
cd /home/mewtwo/Zykairotis/claude-context-core
npx tsc --build --force
```

This compiles TypeScript to `/dist/` directory.

### Step 3: Rebuild API Server Container (DONE ✅)

```bash
docker-compose -f services/docker-compose.yml build api-server
docker-compose -f services/docker-compose.yml restart api-server
```

This copies the new `/dist/` files into the API server container.

### Step 4: Manual Fix for Existing Data (DONE ✅)

For data indexed BEFORE the fix, manually created the mapping:

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

## How It Works Now

When indexing happens through ANY method:

### 1. MCP Server (`node mcp-server.js`)
```
claudeContext.index
  → context.indexWithProject()
    → getOrCreateCollectionRecord() ✅
    → updateCollectionMetadata() ✅
```

### 2. API Server (Port 3030)
```
POST /projects/:project/ingest/local
  → core.ingestGithubRepository()
    → context.indexWithProject()
      → getOrCreateCollectionRecord() ✅
      → updateCollectionMetadata() ✅
```

### 3. GitHub Worker (Background Jobs)
```
GitHub Job Queue
  → GitHubWorker.processJob()
    → core.ingestGithubRepository()
      → context.indexWithProject()
        → getOrCreateCollectionRecord() ✅
        → updateCollectionMetadata() ✅
```

## Verification

Check if the fix is working:

```bash
# 1. Check dataset_collections table
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context \
  -c "SELECT dc.collection_name, dc.point_count, d.name as dataset_name 
      FROM claude_context.dataset_collections dc 
      JOIN claude_context.datasets d ON dc.dataset_id = d.id;"

# 2. Use MCP tool
claudeContext.listDatasets({ project: "your-project" })

# Expected output:
# {
#   "qdrant_collection": "hybrid_code_chunks_ea8707f8",
#   "vectors_in_qdrant": 7860
# }
```

## Testing the Fix

To test that new indexing operations create the mapping:

```bash
# 1. Index a new directory
curl -X POST http://localhost:3030/projects/test-project/ingest/local \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/path/to/some/code",
    "dataset": "test-dataset"
  }'

# 2. Check the mapping was created
PGPASSWORD='code-context-secure-password' psql -h localhost -p 5533 -U postgres -d claude_context \
  -c "SELECT * FROM claude_context.dataset_collections WHERE dataset_id IN (
      SELECT id FROM claude_context.datasets WHERE name = 'test-dataset'
    );"

# 3. Should show:
# - collection_name: project_test_project_dataset_test_dataset (or similar)
# - point_count: <number of chunks indexed>
# - vector_db_type: qdrant
```

## What Gets Updated

During indexing, the system now:

1. **Creates project** (if new)
2. **Creates dataset** (if new)  
3. **Creates collection mapping** ✅ NEW
   - `dataset_id` → links to datasets table
   - `collection_name` → actual Qdrant collection name
   - `point_count` → number of vectors
   - `vector_db_type` → "qdrant"
   - `dimension` → 768
   - `is_hybrid` → true

4. **Creates Qdrant collection** (if doesn't exist)
5. **Indexes chunks** → stores vectors
6. **Updates point count** ✅ NEW
   - Calls `updateCollectionMetadata()` after indexing

## Logs to Watch

When indexing with the fix:

```bash
# MCP Server logs
tail -f logs/mcp-server.log | grep -E "(getOrCreateCollectionRecord|updateCollectionMetadata)"

# API Server logs  
docker logs claude-context-api-server -f | grep -E "(Collection record|Updated collection)"

# Expected output:
[Context] ✅ Collection record: <uuid>
[Context] ✅ Updated collection metadata
```

## Important Notes

⚠️ **API Server Rebuild Required**

Whenever you modify TypeScript code in `/src/`, you MUST:

1. Rebuild core: `npx tsc --build --force`
2. Rebuild API container: `docker-compose -f services/docker-compose.yml build api-server`
3. Restart API: `docker-compose -f services/docker-compose.yml restart api-server`

⚠️ **Existing Data**

Data indexed BEFORE this fix will NOT have the mapping. You can:

**Option 1: Re-index** (recommended)
```bash
# This will recreate the mapping
curl -X POST http://localhost:3030/projects/your-project/ingest/local \
  -d '{"path": "/your/path", "dataset": "your-dataset", "force": true}'
```

**Option 2: Manual SQL** (for existing data)
```bash
# Run the backfill script
./scripts/backfill-dataset-collections.sh
```

## Status

✅ **COMPLETE** - All indexing paths now create dataset_collections mappings:
- MCP Server indexing ✅
- API Server local ingestion ✅
- GitHub worker background jobs ✅
- Manual fix applied for existing data ✅

---

**Date Fixed**: 2025-11-08  
**Fixed By**: Windsurf Cascade  
**Issue**: Dataset collections mapping not created during indexing  
**Impact**: Critical - affects all dataset listing and statistics
