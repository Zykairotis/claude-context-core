# Plan 1: Current Architecture Analysis

## 🏝️ The Island Metaphor

**The Island** = API Server + Qdrant + Postgres (the entire system)

**Sections of the Island** = Projects (isolated knowledge boundaries)

**Contents of Each Section** = Datasets (codebases, repos, crawled docs)

---

## Current Architecture

### Database Schema (Postgres)

```
┌─────────────────────────────────────────────────────────────┐
│                       ISLAND (System)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Projects Table                                      │    │
│  │  - id (UUID)                                        │    │
│  │  - name (unique)                                    │    │
│  │  - is_active (bool)                                 │    │
│  │  - is_global (bool) ← Global projects visible to   │    │
│  │                        all                          │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                        │
│                     │ has many                               │
│                     ▼                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Datasets Table                                      │    │
│  │  - id (UUID)                                        │    │
│  │  - project_id (FK)                                  │    │
│  │  - name (unique per project)                        │    │
│  │  - is_global (bool) ← Global datasets accessible  │    │
│  │                        across projects              │    │
│  │  - status (active/inactive)                         │    │
│  └────────────────────────────────────────────────────┘    │
│           │                │                 │              │
│           │                │                 │              │
│      has many         has many          has many            │
│           │                │                 │              │
│           ▼                ▼                 ▼              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐   │
│  │ Documents    │ │ Web Pages    │ │ Crawl Sessions  │   │
│  │ (Code files  │ │ (Crawled     │ │ (Track          │   │
│  │  from GitHub │ │  docs/links) │ │  ingestion)     │   │
│  │  or local)   │ │              │ │                 │   │
│  └──────────────┘ └──────────────┘ └─────────────────┘   │
│           │                │                                │
│           └────────────────┤                                │
│                            │ has many                       │
│                            ▼                                │
│                   ┌──────────────┐                         │
│                   │ Chunks       │                         │
│                   │ (Embeddings  │                         │
│                   │  metadata)   │                         │
│                   └──────────────┘                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Project Shares Table                                │    │
│  │  - Allows sharing datasets between projects         │    │
│  │  - from_project_id → to_project_id                  │    │
│  │  - resource_type, resource_id                       │    │
│  │  - permissions: can_read, can_write, can_delete    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Vector Storage (Qdrant)

**Current Collection Naming:**
```typescript
// From src/context.ts:294
public getCollectionName(codebasePath: string): string {
    const isHybrid = this.getIsHybrid();
    const normalizedPath = path.resolve(codebasePath);
    const hash = crypto.createHash('md5').update(normalizedPath).digest('hex');
    const prefix = isHybrid === true ? 'hybrid_code_chunks' : 'code_chunks';
    return `${prefix}_${hash.substring(0, 8)}`;
}
```

**Example Collection Names:**
- `hybrid_code_chunks_8c069df5` ← Based on codebase PATH hash
- `hybrid_code_chunks_c50f80fa` ← Different path = different collection
- `code_chunks_a3b4c5d6` ← Non-hybrid collection

**What's Stored in Qdrant:**
- Dense vectors (768d GTE embeddings)
- Sparse vectors (SPLADE for hybrid search)
- Summary vectors (for summary-based search)
- Payload metadata:
  - `project_id` (UUID)
  - `dataset_id` (UUID)
  - `relative_path`
  - `file_extension`
  - `start_line`, `end_line`
  - `lang` (language)
  - `repo`, `branch`, `sha` (provenance)
  - Custom metadata

---

## Problems with Current Approach

### ❌ Problem 1: Collection Naming is Path-Based, Not Project-Based

**Current:** Collection = `hybrid_code_chunks_{PATH_HASH}`

```
Project A → /home/user/frontend → collection: hybrid_code_chunks_abc123
Project B → /home/user/frontend → collection: hybrid_code_chunks_abc123 (SAME!)
```

Both projects share the same collection because they index the same path! This is wrong.

**Issues:**
- Can't have multiple projects with different contexts for the same codebase
- Can't differentiate between Project A's view and Project B's view
- Collection name doesn't reveal which project it belongs to

### ❌ Problem 2: Query Searches ALL Collections

```typescript
// From src/api/query.ts:390
const allCollections: string[] = await vectorDb.listCollections();
const hybridCollections = allCollections.filter(name => 
  name.startsWith('hybrid_code_chunks_') || name.startsWith('project_')
);
candidateCollections = hybridCollections;
```

**Current behavior:**
- Lists ALL collections matching pattern
- Searches across multiple collections
- No project-scoped filtering

**Result:** Queries search EVERYTHING, not just the active project!

### ❌ Problem 3: No Clear Collection → Project/Dataset Mapping

**Current:**
- Postgres knows: Project → Dataset → Chunks (metadata)
- Qdrant knows: Collection → Vectors (just embeddings)
- **No explicit link between Collection NAME and Project/Dataset**

**To find which project a collection belongs to:**
1. Query Qdrant collection
2. Extract `project_id` from payload
3. Look up project in Postgres

This is inefficient and requires scanning payloads!

### ❌ Problem 4: Multiple Sources, Same Collection

**Current scenario:**
```
Project "My App"
├── Dataset "frontend" → /local/frontend → collection: hybrid_code_chunks_abc
├── Dataset "backend" → /local/backend → collection: hybrid_code_chunks_def  
├── Dataset "docs" → crawled website → chunks in Postgres only
└── Dataset "shared-lib" → GitHub repo → collection: hybrid_code_chunks_ghi
```

**Problems:**
- Each dataset gets its own collection based on PATH
- No unified collection per project
- Can't query "all of My App" easily
- Collection names don't reflect their purpose

---

## What Works Well

### ✅ Good: Project & Dataset Hierarchy

The Postgres schema is solid:
- Projects are well-isolated
- Datasets provide clear boundaries
- Foreign keys enforce relationships
- `is_global` flag for sharing

### ✅ Good: Access Control via project_shares

The `project_shares` table allows:
- Sharing datasets between projects
- Permission control (read/write/delete)
- Expiration support

### ✅ Good: Metadata in Postgres, Vectors in Qdrant

The dual-storage approach is correct:
- Postgres: Structured metadata, relationships
- Qdrant: High-performance vector search
- Each does what it's best at

### ✅ Good: Hybrid Search Support

The system supports:
- Dense vectors (GTE embeddings)
- Sparse vectors (SPLADE)
- Summary vectors
- Multiple vector types per document

---

## Key Insights for Redesign

### 1. Collection Naming Must Be Project-Aware

Instead of:
```
hybrid_code_chunks_{PATH_HASH}
```

Should be:
```
project_{PROJECT_ID}_dataset_{DATASET_ID}
```

or:

```
project_{PROJECT_NAME}_{DATASET_NAME}
```

### 2. One Collection Per Dataset

Each dataset should have exactly ONE Qdrant collection:
- Dataset "frontend" → `project_myapp_frontend`
- Dataset "backend" → `project_myapp_backend`
- Dataset "docs" → `project_myapp_docs`

### 3. Query Must Filter by Project

When querying Project "My App":
- List collections: `project_myapp_*`
- Search ONLY those collections
- Respect `is_global` flag for global datasets

### 4. Collection Metadata Must Link to Postgres

Each Qdrant collection should have:
- Explicit project_id
- Explicit dataset_id
- Easily queryable without payload scanning

---

## Next Steps

See **Plan 2** for the proposed new architecture.
