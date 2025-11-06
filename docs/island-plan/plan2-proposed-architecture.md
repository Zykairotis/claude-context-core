# Plan 2: Proposed "Island" Architecture

## 🎯 Design Goals

1. **One Collection Per Dataset** - Clear 1:1 mapping
2. **Project-Scoped Queries** - Only search within active project
3. **Semantic Collection Names** - Names reveal purpose
4. **Easy Dataset Sharing** - Import/export between projects
5. **Global vs Local Logic** - Clear visibility rules

---

## New Architecture

### Collection Naming Convention

**Format:** `proj_{PROJECT_ID}_{DATASET_ID}` (Primary - Immutable)

**Examples:**
```
proj_a1b2c3d4_e5f6g7h8  ← Immutable, survives renames
proj_f9e8d7c6_b5a4c3d2  ← Different project/dataset
proj_00000000_global001  ← System-level global dataset
```

**Database Stores Human-Readable Names:**
```sql
CREATE TABLE dataset_collections (
  collection_name TEXT NOT NULL,  -- proj_{UUID}_{UUID}
  display_name TEXT NOT NULL,     -- "MyApp Frontend" (for UI)
  project_name TEXT NOT NULL,     -- "myapp" (cached)
  dataset_name TEXT NOT NULL      -- "frontend" (cached)
);
```

**Benefits:**
- ✅ **Immutable** - Survives project/dataset renames
- ✅ **No collisions** - UUIDs guarantee uniqueness
- ✅ **Human-readable in database** - Display names in UI
- ✅ **Debuggable** - Can trace UUID back to project/dataset
- ✅ **Safe** - No breaking changes on renames

**Handling Renames:**
```typescript
// User renames project "myapp" → "my-app"
// Collection name stays: proj_a1b2c3d4_e5f6g7h8
// Only update cached display names:
UPDATE dataset_collections 
SET project_name = 'my-app', display_name = 'My-App Frontend'
WHERE dataset_id = 'e5f6g7h8';
```

**For Debugging:**
```typescript
// Helper function to get human-readable collection info
async function getCollectionInfo(collectionName: string) {
  return db.query(`
    SELECT dc.collection_name, dc.display_name, 
           p.name as project_name, d.name as dataset_name
    FROM dataset_collections dc
    JOIN datasets d ON dc.dataset_id = d.id
    JOIN projects p ON d.project_id = p.id
    WHERE dc.collection_name = $1
  `, [collectionName]);
}
```

---

## Database Schema Changes

### Add Collection Tracking Table

```sql
CREATE TABLE IF NOT EXISTS claude_context.dataset_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL UNIQUE,
  vector_db_type TEXT NOT NULL DEFAULT 'qdrant',  -- 'qdrant' or 'postgres'
  dimension INTEGER NOT NULL,
  is_hybrid BOOLEAN NOT NULL DEFAULT true,
  point_count BIGINT NOT NULL DEFAULT 0,
  last_indexed_at TIMESTAMPTZ,
  last_point_count_sync TIMESTAMPTZ,  -- Track when point_count was synced
  
  -- Human-readable metadata (cached for performance)
  project_name TEXT NOT NULL,  -- Cached from projects.name
  dataset_name TEXT NOT NULL,  -- Cached from datasets.name
  display_name TEXT NOT NULL,  -- "MyApp Frontend" for UI
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dataset_id)  -- One collection per dataset
);

CREATE INDEX IF NOT EXISTS dataset_collections_dataset_idx 
  ON dataset_collections(dataset_id);
  
CREATE INDEX IF NOT EXISTS dataset_collections_name_idx 
  ON dataset_collections(collection_name);
```

**Why this table?**
- Explicit mapping: Dataset → Collection Name
- Track vector DB type (future: support multiple backends)
- Track metadata (dimension, point count, last indexed)
- Query: "What collection does this dataset use?"
- Query: "What dataset owns this collection?"

### Update Datasets Table (Required)

```sql
-- Add metadata for better organization
ALTER TABLE claude_context.datasets 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'github' 
CHECK (source_type IN ('github', 'local', 'crawl'));

ALTER TABLE claude_context.datasets
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS datasets_source_type_idx 
  ON datasets(source_type);

-- Define JSON schema for source_metadata per type:
-- GitHub: {"repo": "owner/name", "branch": "main", "sha": "abc123", "url": "https://..."}
-- Local:  {"path": "/absolute/path", "last_scan_at": "2025-11-05T16:00:00Z"}
-- Crawl:  {"base_url": "https://...", "depth": 3, "max_pages": 100}
```

---

## Qdrant Collection Structure

### Collection per Dataset

**Before:**
```
All Projects → Many Collections (path-based)
├── hybrid_code_chunks_abc123  (what project?)
├── hybrid_code_chunks_def456  (what dataset?)
└── hybrid_code_chunks_ghi789  (unknown ownership)
```

**After:**
```
Project "MyApp" → Datasets → Collections
├── Dataset "frontend" → project_myapp_frontend
├── Dataset "backend" → project_myapp_backend
└── Dataset "docs" → project_myapp_docs

Project "OtherApp" → Datasets → Collections
└── Dataset "api" → project_otherapp_api
```

### Collection Payload Structure

Each vector in Qdrant includes:

```json
{
  "id": "frontend_src_app.tsx_10_50_0",
  "vector": [...],           // Dense embedding (768d)
  "sparse": {...},           // Sparse vector (SPLADE)
  "payload": {
    // Core identifiers
    "project_id": "uuid",
    "project_name": "myapp",
    "dataset_id": "uuid",
    "dataset_name": "frontend",
    "collection_name": "project_myapp_frontend",
    
    // File metadata
    "relative_path": "src/App.tsx",
    "file_extension": ".tsx",
    "start_line": 10,
    "end_line": 50,
    "chunk_index": 0,
    
    // Content metadata
    "content": "...code...",
    "language": "typescript",
    "source_type": "local",  // 'local', 'github', 'crawl'
    
    // Provenance (for GitHub)
    "repo": "owner/repo",
    "branch": "main",
    "sha": "abc123",
    
    // Timestamps
    "indexed_at": "2025-11-05T16:00:00Z"
  }
}
```

**Key Changes:**
- ✅ Added `project_name` for easy filtering
- ✅ Added `dataset_name` for context
- ✅ Added `collection_name` for traceability
- ✅ Added `source_type` to distinguish content origin

---

## Query Logic Changes

### Current Query Flow

```typescript
// WRONG: Searches ALL collections
const allCollections = await vectorDb.listCollections();
const hybridCollections = allCollections.filter(name => 
  name.startsWith('hybrid_code_chunks_')
);

// Search every collection (slow, wrong scope)
for (const collection of hybridCollections) {
  results.push(...await vectorDb.search(collection, query));
}
```

### New Query Flow (Project-Scoped)

```typescript
// Step 1: Get project ID from name
const project = await getOrCreateProject(client, projectName);

// Step 2: Get accessible datasets for this project
const datasetIds = await getAccessibleDatasets(
  client, 
  project.id, 
  includeGlobal  // Include global datasets?
);

// Step 3: Get collection names for these datasets
const collectionNames = await client.query(`
  SELECT collection_name 
  FROM claude_context.dataset_collections
  WHERE dataset_id = ANY($1::uuid[])
`, [datasetIds]);

// Step 4: Search ONLY project-scoped collections
const results = [];
for (const { collection_name } of collectionNames.rows) {
  // Check if collection exists in Qdrant
  const exists = await vectorDb.hasCollection(collection_name);
  if (!exists) continue;
  
  // Search within this collection
  const collectionResults = await vectorDb.search(
    collection_name,
    queryVector,
    { 
      limit: topK
      // Note: No project_id filter needed - collection already scoped to project!
    }
  );
  
  results.push(...collectionResults);
}

// Step 5: Aggregate and rank results
return rankAndDeduplicate(results);
```

**Benefits:**
- ✅ Only searches project's datasets
- ✅ Respects dataset permissions
- ✅ Includes global datasets when appropriate
- ✅ Efficient (no unnecessary collection scans)

### Query with Dataset Filter

```typescript
// User wants to search specific dataset within project
const query = "authentication logic";
const projectName = "myapp";
const datasetName = "backend";  // Optional filter

// Get collection for specific dataset
const result = await client.query(`
  SELECT dc.collection_name
  FROM claude_context.dataset_collections dc
  JOIN claude_context.datasets d ON dc.dataset_id = d.id
  JOIN claude_context.projects p ON d.project_id = p.id
  WHERE p.name = $1 AND d.name = $2
`, [projectName, datasetName]);

const collectionName = result.rows[0]?.collection_name;

// Search ONLY that collection
const results = await vectorDb.search(collectionName, queryVector);
```

---

## Indexing Logic Changes

### Current Indexing Flow

```typescript
// WRONG: Collection name based on codebase path
const collectionName = context.getCollectionName(codebasePath);
// Result: "hybrid_code_chunks_8c069df5" (unclear ownership)

await context.indexCodebase(codebasePath);
```

### New Indexing Flow (Project-Aware)

```typescript
// Step 1: Resolve project and dataset
const project = await getOrCreateProject(client, projectName);
const dataset = await getOrCreateDataset(client, project.id, datasetName);

// Step 2: Generate collection name
const collectionName = generateCollectionName(project.name, dataset.name);
// Result: "project_myapp_backend"

// Step 3: Check if collection record exists
let collectionRecord = await client.query(`
  SELECT * FROM claude_context.dataset_collections
  WHERE dataset_id = $1
`, [dataset.id]);

// Step 4: Create collection if needed
if (collectionRecord.rows.length === 0) {
  // Create Qdrant collection
  await vectorDb.createHybridCollection(collectionName, 768);
  
  // Record in Postgres
  await client.query(`
    INSERT INTO claude_context.dataset_collections
    (dataset_id, collection_name, dimension, is_hybrid)
    VALUES ($1, $2, $3, $4)
  `, [dataset.id, collectionName, 768, true]);
}

// Step 5: Index with project context
await context.indexWithProject(
  codebasePath,
  projectName,
  datasetName,
  {
    collectionName,  // Explicit collection
    projectId: project.id,
    datasetId: dataset.id
  }
);
```

---

## Global vs Local Datasets

### Global Datasets (Shared Across Projects)

**Use case:** Common libraries, shared documentation, company-wide knowledge

**System Project for Global Datasets:**
```sql
-- Create special "global" system project (one-time setup)
INSERT INTO projects (id, name, description, is_global, is_system)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- Special UUID
  'global',
  'System project for global datasets',
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Create global dataset
INSERT INTO datasets (project_id, name, is_global)
VALUES ('00000000-0000-0000-0000-000000000000', 'common_libraries', true);

-- Collection name (uses system project UUID)
collection_name = 'proj_00000000_a1b2c3d4'
```

**Schema Update:**
```sql
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

COMMENT ON COLUMN projects.is_system IS 
  'System-level project (e.g., global). Cannot be deleted by users.';
```

**Query behavior:**
- When `includeGlobal = true`, global datasets are included in search
- All projects can read global datasets
- Only system admins can write to global datasets

### Local Datasets (Project-Private)

**Use case:** Proprietary code, internal docs, project-specific context

**Example:**
```sql
-- Create local dataset
INSERT INTO datasets (project_id, name, is_global)
VALUES ('myapp_project_id', 'proprietary_backend', false);

-- Collection name
collection_name = 'project_myapp_proprietary_backend'
```

**Query behavior:**
- Only accessible to owning project
- Not visible to other projects (unless explicitly shared)

---

## Dataset Sharing & Import/Export

### Sharing a Dataset

**Scenario:** Project A wants to share "utils" dataset with Project B

```sql
-- Grant read access
INSERT INTO project_shares (
  from_project_id,
  to_project_id,
  resource_type,
  resource_id,
  can_read,
  can_write
) VALUES (
  'project_a_id',
  'project_b_id',
  'dataset',
  'utils_dataset_id',
  true,   -- can_read
  false   -- can_write (read-only)
);
```

**Result:**
- Project B queries now include `project_a_utils` collection
- Project B can search Project A's utils dataset
- No data duplication - same Qdrant collection

### Copying/Forking a Dataset

**Scenario:** Project B wants its own copy of Project A's "utils"

```typescript
// 1. Create new dataset in Project B
const newDataset = await createDataset(projectB.id, 'utils_fork');

// 2. Create new collection
const newCollectionName = 'project_b_utils_fork';
await vectorDb.createHybridCollection(newCollectionName, 768);

// 3. Copy vectors from source collection
const sourceCollection = 'project_a_utils';
const vectors = await vectorDb.scroll(sourceCollection, { limit: 10000 });

// 4. Update payload with new project/dataset IDs
const updatedVectors = vectors.map(v => ({
  ...v,
  payload: {
    ...v.payload,
    project_id: projectB.id,
    dataset_id: newDataset.id
  }
}));

// 5. Insert into new collection
await vectorDb.insert(newCollectionName, updatedVectors);
```

**Result:**
- Project B has independent copy
- Can modify without affecting Project A
- Full ownership and control

---

## Migration Strategy

See **Plan 3** for detailed migration steps.

---

## Summary

**Key Changes:**
1. ✅ Collection names: `project_{NAME}_{DATASET}`
2. ✅ New table: `dataset_collections` for mapping
3. ✅ Query: Project-scoped collection search
4. ✅ Indexing: Explicit project/dataset context
5. ✅ Sharing: Via `project_shares` or copy/fork

**Benefits:**
- 🎯 Fast, project-scoped queries
- 🔍 Debuggable collection names
- 🔒 Clear access control
- 📦 Easy dataset management
- 🌐 Flexible global/local logic

Next: **Plan 3** - Implementation & Migration
