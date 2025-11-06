# Reality Check: What's Actually Implemented vs The Plan

> **Date:** November 5, 2025
> 
> **Purpose:** Document actual implementation status vs plan assumptions

---

## 🔴 Critical Discrepancies

### 1. Collection Naming - PATH-BASED, NOT UUID-BASED ❌

**Plan Assumes:**
```typescript
// UUID-based: proj_{PROJECT_ID}_{DATASET_ID}
generateCollectionName({ projectId, datasetId });
// Result: proj_a1b2c3d4_e5f6g7h8
```

**Reality:**
```typescript
// Path-based (MD5 hash)
// Location: /src/context.ts:294-300
public getCollectionName(codebasePath: string): string {
    const normalizedPath = path.resolve(codebasePath);
    const hash = crypto.createHash('md5').update(normalizedPath).digest('hex');
    const prefix = isHybrid ? 'hybrid_code_chunks' : 'code_chunks';
    return `${prefix}_${hash.substring(0, 8)}`;
}
// Result: hybrid_code_chunks_8c069df5
```

**Impact:** 
- ❌ Same path = same collection across different projects
- ❌ Breaks on project renames (path changes)
- ❌ No project isolation
- ❌ Collisions possible

---

### 2. dataset_collections Table DOES NOT EXIST ❌

**Plan Assumes:**
- Table exists with columns: `collection_name`, `display_name`, `project_name`, `dataset_name`, etc.
- One collection per dataset tracked in database

**Reality:**
- ❌ Table does NOT exist in `/services/init-scripts/02-init-schema.sql`
- ❌ No migration script for this table
- ❌ No tracking of collection → dataset relationship in database
- ❌ CollectionManager class does NOT exist

**Implications:**
- Can't track which collection belongs to which dataset
- Can't cache human-readable names
- Can't sync point counts
- Can't handle renames properly

---

### 3. indexed_files Table - Missing collection_name Column ❌

**Plan Assumes:**
```sql
ALTER TABLE indexed_files
ADD COLUMN collection_name TEXT
  REFERENCES dataset_collections(collection_name);
```

**Reality:**
```sql
-- From /scripts/migrate-add-indexed-files.sh:81-96
CREATE TABLE IF NOT EXISTS claude_context.indexed_files (
    project_id UUID NOT NULL,
    dataset_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    chunk_count INTEGER DEFAULT 0,
    language TEXT,
    -- NO collection_name column!
    UNIQUE(project_id, dataset_id, file_path)
);
```

**Impact:**
- ❌ Incremental sync can't target specific collection
- ❌ Must search ALL collections to delete chunks for a file
- ❌ Performance penalty on modified files

---

### 4. deleteFileChunks Implementation - STUB ❌

**Plan Assumes:**
- Targets specific collection
- Uses filters to delete chunks for a file

**Reality:**
```typescript
// From /src/sync/incremental-sync.ts:56-71
async function deleteFileChunks(
    context: Context,
    filePath: string,
    project: string,
    dataset: string
): Promise<number> {
    // STUB - doesn't actually delete!
    console.warn(`[IncrementalSync] Chunk deletion for ${filePath} not fully implemented yet`);
    return 0;
}
```

**Impact:**
- ❌ Modified files leave orphaned chunks in vector DB
- ❌ Wastes storage space
- ❌ Can return duplicate/stale results in queries

---

### 5. Query Logic - Searches ALL Collections ❌

**Plan Assumes:**
- Project-scoped queries
- Only searches collections for specific project

**Reality:**
```typescript
// From /src/api/query.ts:390-394
const allCollections: string[] = await vectorDb.listCollections();
const hybridCollections = allCollections.filter(name => 
  name.startsWith('hybrid_code_chunks_') || name.startsWith('project_')
);
candidateCollections = hybridCollections;
// Searches EVERYTHING matching pattern!
```

**Impact:**
- ❌ Slow queries (searches all projects)
- ❌ No project isolation
- ❌ Cross-project contamination possible
- ❌ Scales poorly with multiple projects

---

### 6. indexWebPages - STUB IMPLEMENTATION ❌

**Plan Assumes:**
- Full web page indexing with chunking
- SPLADE sparse vectors
- Project/dataset tracking

**Reality:**
```typescript
// From /src/context.ts:992-1001
async indexWebPages(pages, project, dataset, options?) {
    // STUB - not implemented!
    console.warn('[Context] indexWebPages not fully implemented');
    return { indexedPages: 0, totalChunks: 0 };
}
```

**Impact:**
- ❌ Web content ingestion doesn't work through Context
- ⚠️ Alternative path exists via `ingestCrawlPages` (Postgres-only)

---

### 7. Global System Project - DOES NOT EXIST ❌

**Plan Assumes:**
```sql
INSERT INTO projects (id, name, is_system)
VALUES ('00000000-0000-0000-0000-000000000000', 'global', true);
```

**Reality:**
```sql
-- From /services/init-scripts/02-init-schema.sql:13-21
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  -- NO is_system column!
  is_global BOOLEAN NOT NULL DEFAULT false
);
```

**Impact:**
- ❌ No special system project for global datasets
- ⚠️ `is_global` flag exists on projects but not `is_system`

---

### 8. Datasets Table - Missing source_* Columns ❌

**Plan Assumes:**
```sql
ALTER TABLE datasets
ADD COLUMN source_type TEXT CHECK (source_type IN ('github', 'local', 'crawl'));
ADD COLUMN source_metadata JSONB DEFAULT '{}'::jsonb;
```

**Reality:**
```sql
-- From /services/init-scripts/02-init-schema.sql:24-34
CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_global BOOLEAN NOT NULL DEFAULT false,
  -- NO source_type column!
  -- NO source_metadata column!
);
```

---

## ✅ What IS Implemented

### Crawl4AI Service (Python) - FULLY IMPLEMENTED ✅

**Location:** `/services/crawl4ai-runner/app/storage/scope_manager.py`

**Features:**
```python
class ScopeManager:
    def resolve_scope(project, dataset, requested_scope) -> ScopeLevel:
        # Returns: GLOBAL, PROJECT, or LOCAL
    
    def get_collection_name(project, dataset, scope) -> str:
        # Global: 'global_knowledge'
        # Project: 'project_{sanitized_name}'
        # Local: 'project_{sanitized_name}_dataset_{sanitized_name}'
    
    def get_project_id(project) -> str:
        # Deterministic UUID from name via uuid5
    
    def get_dataset_id(dataset) -> str:
        # Deterministic UUID from name via uuid5
    
    def filter_by_scope(scope, project_id, dataset_id) -> Dict:
        # Generate database filters for queries
```

**Integration:**
- ✅ Used in `crawling_service.py` for web page ingestion
- ✅ Creates collections: `project_{name}_dataset_{name}`
- ✅ Stores to both Postgres (canonical) and Qdrant (vectors)
- ✅ CanonicalMetadataStore syncs projects, datasets, web_pages, chunks

**Example from crawling_service.py:980-1056:**
```python
scope_manager = ScopeManager()
scope = scope_manager.resolve_scope(ctx.project, ctx.dataset, ctx.scope)
collection_name = scope_manager.get_collection_name(
    ctx.project, ctx.dataset, scope
)
# Result: "project_myapp_dataset_frontend"
```

**Architecture Choice:**
- Uses **NAME-based** collections, not UUID-based
- Sanitizes names (lowercase, alphanumeric + underscores)
- Simple and debuggable
- BUT: Different from plan's UUID approach

---

### Database Schema - PARTIAL ✅

**Core tables exist:**
- ✅ `projects` - with is_global flag
- ✅ `datasets` - with is_global flag
- ✅ `documents` - with dataset_id FK
- ✅ `web_pages` - with dataset_id FK
- ✅ `chunks` - with dataset_id, document_id, web_page_id FKs
- ✅ `crawl_sessions` - with dataset_id FK
- ✅ `project_shares` - for cross-project resource sharing
- ✅ `indexed_files` - for incremental sync (see below)

**Missing columns:**
- ❌ `projects.is_system` - only has is_global
- ❌ `datasets.source_type` - no column
- ❌ `datasets.source_metadata` - no column
- ❌ `indexed_files.collection_name` - no column

**Missing tables:**
- ❌ `dataset_collections` - entire table doesn't exist

---

### indexed_files Table - PARTIAL ✅

**Location:** Created by migration script, used by incremental sync

**Current schema:**
```sql
CREATE TABLE indexed_files (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  dataset_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  chunk_count INTEGER DEFAULT 0,
  language TEXT,
  last_indexed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(project_id, dataset_id, file_path)
);
```

**What's used:**
- ✅ Change detection (compare sha256_hash)
- ✅ Rename detection (find matching hashes)
- ✅ File metadata tracking
- ✅ Incremental sync pipeline

**What's missing:**
- ❌ `collection_name` column (can't target specific collection for chunk deletion)
- ❌ FK to `dataset_collections` (table doesn't exist)

---

## ❌ What's NOT Implemented

### TypeScript Context Class - LEGACY ARCHITECTURE 🔴

### 1. Incremental Sync Core ✅

**Files:**
- `/src/sync/change-detector.ts` - Full SHA256 change detection
- `/src/sync/file-metadata.ts` - CRUD operations for file metadata
- `/src/sync/hash-calculator.ts` - SHA256 utilities
- `/src/sync/incremental-sync.ts` - Main sync orchestration (with stub delete)

**Status:** ~80% complete
- ✅ Change detection works
- ✅ File metadata tracking works
- ✅ Rename detection works
- ❌ Chunk deletion is stub
- ❌ No collection_name tracking

### 2. File Watcher ✅

**Files:**
- `/src/sync/file-watcher.ts` (implied by API routes)
- API endpoints in `/services/api-server/src/routes/projects.ts`

**Status:** Likely working but untested

### 3. Project/Dataset Schema ✅

**Tables:**
- ✅ `projects` table exists
- ✅ `datasets` table exists
- ✅ `project_shares` table exists
- ✅ Foreign key relationships correct

### 4. Hybrid Search ✅

**Implementation:**
- ✅ SPLADE integration working
- ✅ Dense + sparse search
- ✅ Reranking support
- ✅ Fallback logic

### 5. Web Query (Separate Path) ✅

**Implementation:**
- ✅ `queryWebContent` function exists
- ✅ Uses project/dataset filtering
- ✅ Hybrid search support
- ⚠️ Uses different collection naming (`web_${project}`)

---

## 📊 Implementation Status Summary

| Component | Plan Status | Reality Status | Gap |
|-----------|-------------|----------------|-----|
| **Collection Naming** | UUID-based immutable | Path-based MD5 hash | 🔴 Critical |
| **dataset_collections Table** | Exists | Does NOT exist | 🔴 Critical |
| **indexed_files.collection_name** | Exists | Does NOT exist | 🔴 Critical |
| **CollectionManager Class** | Implemented | Does NOT exist | 🔴 Critical |
| **deleteFileChunks** | Full implementation | Stub (returns 0) | 🔴 Critical |
| **Query Project Scoping** | Project-scoped | Searches ALL | 🔴 Critical |
| **indexWebPages** | Full implementation | Stub | 🔴 Critical |
| **is_system Column** | Exists | Does NOT exist | 🟡 Medium |
| **source_type/metadata** | Exists | Does NOT exist | 🟡 Medium |
| **Change Detection** | Implemented | ✅ Implemented | ✅ Good |
| **File Metadata CRUD** | Implemented | ✅ Implemented | ✅ Good |
| **Hash Calculation** | Implemented | ✅ Implemented | ✅ Good |
| **Hybrid Search** | Implemented | ✅ Implemented | ✅ Good |

---

## 🚨 Required Plan Updates

### Priority 1: Database Schema (Must Have First)

1. **Create dataset_collections table**
   - Collection tracking
   - Point count sync
   - Display names
   
2. **Add collection_name to indexed_files**
   - Link files to collections
   - Enable targeted deletion

3. **Add is_system to projects**
   - Support global system project

4. **Add source_type/metadata to datasets**
   - Track content origin

### Priority 2: Core Utilities (Foundation)

1. **Implement UUID-based collection naming**
   - Replace path-based hashing
   - Use project_id + dataset_id
   
2. **Create CollectionManager class**
   - CRUD for collections
   - Error recovery
   - Point count sync

3. **Fix deleteFileChunks**
   - Implement actual deletion
   - Target specific collection
   - Use collection_name from indexed_files

### Priority 3: Query & Indexing (Features)

1. **Update query logic**
   - Project-scoped collection search
   - Use dataset_collections table
   
2. **Implement indexWebPages**
   - Full web content indexing
   - Use CollectionManager

3. **Update incremental sync**
   - Pass collection_name
   - Use new deleteFileChunks

---

## 🎯 Corrected Implementation Order

### Phase 0: Schema Migrations (Week 1, Days 1-2)
```bash
# Run these in order
./scripts/migrate-add-indexed-files.sh           # ✅ Already exists
./scripts/migrate-add-dataset-collections.sh     # ❌ Must create
./scripts/migrate-add-collection-column.sh       # ❌ Must create  
./scripts/migrate-add-source-columns.sh          # ❌ Must create
./scripts/migrate-add-is-system-column.sh        # ❌ Must create
```

### Phase 1: Fix Collection Naming (Week 1, Days 3-4)
- Replace `getCollectionName()` with UUID-based version
- Create `collection-names.ts` utilities
- Update all references

### Phase 2: Create CollectionManager (Week 1, Day 5)
- Implement class with error recovery
- Add to Context initialization

### Phase 3: Fix Incremental Sync (Week 2, Days 1-2)
- Implement real deleteFileChunks
- Add collection_name tracking
- Update sync workflow

### Phase 4: Fix Query Logic (Week 2, Days 3-4)
- Project-scoped collection selection
- Remove redundant filters

### Phase 5: Implement indexWebPages (Week 2, Day 5)
- Full implementation
- Use CollectionManager

---

## ✅ Updated Checklist Reference

See updated implementation checklist that reflects reality:
- Migration scripts to create
- Actual implementation gaps
- Correct dependency order

---

**Status:** 🔴 **MAJOR GAPS IDENTIFIED - PLAN NEEDS SIGNIFICANT UPDATES**

**Recommendation:** 
1. ✅ Run existing migrations first
2. Create missing migrations
3. Fix core utilities (collection naming, manager)
4. Then proceed with features
