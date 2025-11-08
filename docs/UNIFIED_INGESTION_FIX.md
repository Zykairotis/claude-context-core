# Unified Ingestion Fix Summary

## Problem
Crawl4AI web content and GitHub repository content were stored in different schemas and collection formats, making unified retrieval impossible.

## Changes Made

### 1. Unified Schema in Crawl4AI Storage (`services/crawl4ai-runner/app/storage/postgres_store.py`)

**Changed:**
- Collection table name: `chunks_{collection}` → `{collection}` (matches GitHub format)
- Table schema: Custom web fields → Unified GitHub-compatible schema

**New Schema:**
```sql
CREATE TABLE claude_context.{collection_name} (
  id TEXT PRIMARY KEY,
  vector vector(768),
  content TEXT,              -- was chunk_text
  relative_path TEXT,
  start_line INTEGER,        -- reused for char position
  end_line INTEGER,          -- reused for char position  
  file_extension TEXT,
  project_id UUID,
  dataset_id UUID,
  source_type TEXT,          -- 'web' for crawl4ai, 'github' for code
  repo TEXT,
  branch TEXT,
  sha TEXT,
  lang TEXT,
  symbol JSONB,
  metadata JSONB,            -- web-specific fields stored here
  created_at TIMESTAMPTZ
)
```

**Field Mapping:**
- `chunk_text` → `content`
- `summary` → `metadata.summary`
- `is_code` → `metadata.is_code`
- `chunk_index` → `metadata.chunk_index`
- `model_used` → `metadata.model_used`
- `scope` → `metadata.scope`
- `source_type` → `'web'` (hardcoded)

### 2. Fixed API Routes (`services/api-server/src/routes/projects.ts`)

**Changed:**
- URL: `/api/crawl` → `/crawl` (matches FastAPI endpoints)
- Request params:
  - `start_url` → `urls: [start_url]`
  - `crawl_type` → `mode`
  - `depth` → `max_depth`
  
**Changed (`services/api-server/src/monitors/crawl-monitor.ts`):**
- Progress URL: `/api/progress/{id}` → `/progress/{id}`
- Response field: Added `progress_id` to lookup chain

### 3. Updated Query Logic (`src/api/query.ts`)

**Changed:**
- Collection search now includes: `project_*` collections
- Both PostgreSQL and Qdrant queries updated

**Before:**
```typescript
allCollections.filter(name =>
  name.startsWith('hybrid_code_chunks_') || name.startsWith('code_chunks_')
)
```

**After:**
```typescript
allCollections.filter(name =>
  name.startsWith('hybrid_code_chunks_') || 
  name.startsWith('code_chunks_') || 
  name.startsWith('project_')  // ← NEW
)
```

## Collection Naming

### GitHub Collections
- Format: `code_chunks_{hash}` or `hybrid_code_chunks_{hash}`
- Hash: MD5 of normalized codebase path
- Example: `hybrid_code_chunks_a1b2c3d4`

### Crawl4AI Collections  
- Format: `project_{name}` or `project_{name}_dataset_{name}`
- Based on: Project and dataset names
- Example: `project_claude-context_dataset_web-pages`

### Unified Query
Searches ALL collections matching:
- `hybrid_code_chunks_*`
- `code_chunks_*`
- `project_*` ← NEW

Then filters results by `projectId` and `datasetIds`.

## How It Works

### Ingestion Flow (Crawl4AI)
```
User requests crawl
  ↓
API Server → POST /crawl {urls, project, dataset}
  ↓
Crawl4AI Service
  ↓
1. Crawl pages
2. Chunk content (SmartChunker)
3. Generate summaries (MiniMax LLM)
4. Generate embeddings (EmbeddingMonster)
5. Store in PostgreSQL (unified schema)
   - Table: claude_context.project_{name}_dataset_{name}
   - Fields: content, vector, project_id, dataset_id, source_type='web'
6. Store in Qdrant (optional)
```

### Retrieval Flow
```
User queries project
  ↓
Query API resolves project + dataset IDs
  ↓
List all collections matching patterns
  ↓
Search each collection with filters:
  - projectId (if not "all")
  - datasetIds []
  - Optional: repo, lang, pathPrefix
  ↓
Aggregate results from all collections
  ↓
Optional: Rerank with Jina Reranker
  ↓
Return unified results (GitHub + Web)
```

## Testing

### Test Script
```bash
# Set environment
export POSTGRES_CONNECTION_STRING="postgresql://postgres:postgres@localhost:5433/claude_context"
export TEST_PROJECT="my-project"
export TEST_DATASET="web-pages"
export TEST_QUERY="how to use the API"

# Run test
node test-crawl-ingestion.js
```

### Expected Output
- Results from both GitHub code and web content
- Filtered by project/dataset
- Ranked by relevance
- Source type indicated (`📄 file` vs `🌐 web`)

## Migration Notes

### Existing Data
- Old crawl4ai chunks in `chunks_{collection}` tables will NOT be found
- Need to migrate or re-crawl

### Migration Script (if needed)
```sql
-- Copy old web chunks to unified schema
INSERT INTO claude_context.project_{name}_dataset_{name}
  (id, vector, content, relative_path, project_id, dataset_id, 
   source_type, lang, metadata, created_at)
SELECT 
  id,
  vector,
  chunk_text,
  relative_path,
  project_id,
  dataset_id,
  'web',
  language,
  jsonb_build_object(
    'summary', summary,
    'is_code', is_code,
    'chunk_index', chunk_index,
    'model_used', model_used,
    'scope', scope
  ),
  created_at
FROM claude_context.chunks_{old_collection_name};
```

## Benefits

1. **Unified Retrieval**: Query returns both code and web content
2. **Consistent Schema**: Same fields across all data sources
3. **Flexible Filtering**: Filter by project, dataset, repo, language, etc.
4. **Future-Proof**: Easy to add new data sources (PDFs, docs, etc.)

## Next Steps

- [ ] Test end-to-end: crawl → store → retrieve
- [ ] Verify hybrid search works across both sources
- [ ] Test reranking with mixed results
- [ ] Add source type badges in UI
- [ ] Document web-specific metadata fields

