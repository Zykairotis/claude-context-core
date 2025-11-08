# Proper Re-indexing Procedure for Dataset Isolation

## ✅ Now You Can Run db-force-reinit.sh!

I've fixed the script so it will work correctly:

### What I Changed:

1. **Created** `/services/init-scripts/04-dataset-collections.sql`
   - Creates the `dataset_collections` table
   - Sets up indexes and triggers
   - Will be automatically run during database initialization

2. **Updated** `/scripts/db-reinit.sh`
   - Added `04-dataset-collections.sql` to the list of init scripts (line 181)
   - Now the table will be created every time you reinitialize

## 🚀 Step-by-Step Procedure

### Step 1: Run the Force Reinit Script

```bash
cd /home/mewtwo/Zykairotis/claude-context-core
./scripts/db-force-reinit.sh
```

**What this does:**
1. ✅ Terminates all database connections
2. ✅ Drops `claude_context` schema (all tables)
3. ✅ Recreates schema with extensions (pgvector, uuid-ossp, etc.)
4. ✅ Runs init scripts:
   - `01-init-pgvector.sql` - PostgreSQL vector setup
   - `02-init-schema.sql` - Creates projects, datasets, chunks tables
   - `03-github-jobs.sql` - Creates GitHub job queue tables
   - `04-dataset-collections.sql` - **Creates dataset_collections table!** ⭐
5. ✅ Runs migrations (web_provenance, mesh_tables)
6. ✅ Deletes ALL Qdrant collections (clean slate)
7. ✅ Recreates cognee_db database
8. ✅ Cleans Neo4j graph
9. ✅ Restarts API server (recreates pg-boss tables)

**You'll be prompted:**
```
⚠️  This will DROP and recreate the PostgreSQL schema and delete all Qdrant collections.
Proceed? (type 'reinit' to continue):
```

Type `reinit` and press Enter.

### Step 2: Verify the Setup

```bash
# Check that dataset_collections table exists
psql postgresql://postgres:code-context-secure-password@localhost:5533/claude_context \
  -c "\d claude_context.dataset_collections"
```

**Expected output:**
```
                          Table "claude_context.dataset_collections"
        Column         |           Type           | Modifiers
-----------------------+--------------------------+-----------
 id                    | uuid                     | PRIMARY KEY
 dataset_id            | uuid                     | NOT NULL
 collection_name       | text                     | UNIQUE
 vector_db_type        | text                     | DEFAULT 'qdrant'
 dimension             | integer                  | DEFAULT 768
 is_hybrid             | boolean                  | DEFAULT true
 point_count           | bigint                   | DEFAULT 0
 ...
```

### Step 3: Re-index Each Dataset

**Important:** Index each dataset separately so they get unique collections.

#### 3.1 Index Main Codebase (if you have local code)

```javascript
claudeContext.index({
  project: 'Hypr-Voice',
  dataset: 'main',
  path: '/path/to/your/hypr-voice/codebase'
})
```

This will create:
- Collection: `project_hypr_voice_dataset_main`
- Entry in `dataset_collections` table linking dataset to collection
- Vectors with proper `datasetId` and `projectId` metadata

#### 3.2 Index Pydantic AI Docs

```javascript
claudeContext.crawl({
  project: 'Hypr-Voice',
  dataset: 'pydantic-ai-docs-v2',
  url: 'https://ai.pydantic.dev/sitemap.xml',
  maxPages: 10000
})
```

This will create:
- Collection: `project_hypr_voice_dataset_pydantic_ai_docs_v2`
- Proper mapping in `dataset_collections`

#### 3.3 Index GitHub Repositories

```javascript
// Perplexity-Claude repo
claudeContext.indexGitHub({
  project: 'Hypr-Voice',
  dataset: 'perplexity-claude',
  repo: 'Zykairotis/Perplexity-claude'
})

// Claude-Context-Core repo
claudeContext.indexGitHub({
  project: 'Hypr-Voice',
  dataset: 'claude-context-core',
  repo: 'Zykairotis/claude-context-core'
})
```

Each will get its own collection.

### Step 4: Verify Dataset Isolation

```javascript
// Check dataset list
claudeContext.listDatasets({ project: 'Hypr-Voice' })
```

**You should see:**
```
• main:
  Status: active
  PostgreSQL: X,XXX chunks
  Qdrant: X,XXX vectors
  Collection: project_hypr_voice_dataset_main  ✅
  
• pydantic-ai-docs-v2:
  Status: active
  PostgreSQL: X,XXX chunks
  Qdrant: X,XXX vectors
  Collection: project_hypr_voice_dataset_pydantic_ai_docs_v2  ✅
  
• perplexity-claude:
  Status: active
  PostgreSQL: X,XXX chunks
  Qdrant: X,XXX vectors
  Collection: project_hypr_voice_dataset_perplexity_claude  ✅
```

**Notice:** Each dataset has its **OWN collection** now!

### Step 5: Test Dataset Filtering

```javascript
// Search ONLY pydantic-ai docs
claudeContext.search({
  project: 'Hypr-Voice',
  dataset: 'pydantic-ai-docs-v2',
  query: 'how to use PydanticAI'
})

// Should return ONLY results from pydantic-ai-docs-v2 ✅

// Search ONLY your local code
claudeContext.search({
  project: 'Hypr-Voice',
  dataset: 'main',
  query: 'TTS voice configuration'
})

// Should return ONLY results from main dataset ✅
```

## 🎯 Why This Works Now

### Before (Broken):
```
PostgreSQL:
  ├─ dataset: main
  ├─ dataset: pydantic-ai-docs-v2
  ├─ dataset: perplexity-claude
  └─ dataset: claude-context-core
       ↓ (no mappings)
       
Qdrant:
  └─ project_hypr_voice (ALL data mixed!) ❌

Search: Always uses project_hypr_voice → mixed results
```

### After (Fixed):
```
PostgreSQL:
  ├─ dataset: main → collection: project_hypr_voice_dataset_main
  ├─ dataset: pydantic-ai-docs-v2 → project_hypr_voice_dataset_pydantic_ai_docs_v2
  ├─ dataset: perplexity-claude → project_hypr_voice_dataset_perplexity_claude
  └─ dataset: claude-context-core → project_hypr_voice_dataset_claude_context_core
       ↓ (mappings in dataset_collections table) ✅
       
Qdrant:
  ├─ project_hypr_voice_dataset_main (only main data)
  ├─ project_hypr_voice_dataset_pydantic_ai_docs_v2 (only docs)
  ├─ project_hypr_voice_dataset_perplexity_claude (only this repo)
  └─ project_hypr_voice_dataset_claude_context_core (only this repo)

Search: Uses dataset_collections to find the right collection → isolated results ✅
```

## 📊 What the Filter Fix Does

The filter fix I made earlier in `/src/api/query.ts`:

```typescript
// Builds Qdrant filter expression
const qdrantFilter = buildQdrantFilter(filter);
// Example: "(metadata.datasetId == "uuid1" OR metadata.datasetId == "uuid2")"

// Passes filter to all search methods
context.dualModelSearch(..., qdrantFilter, ...)
vectorDb.search(..., { filterExpr: qdrantFilter })
```

**Combined with proper collection mapping:**
1. ✅ Query resolves dataset name → dataset ID
2. ✅ Looks up collection name in `dataset_collections` table
3. ✅ Searches ONLY that collection in Qdrant
4. ✅ Additionally filters by `datasetId` metadata (belt + suspenders)
5. ✅ Returns ONLY results from specified dataset

## 🎉 Summary

**Now you can run:**
```bash
./scripts/db-force-reinit.sh
```

**Then re-index, and dataset isolation will work perfectly!**

The script now:
- ✅ Creates `dataset_collections` table automatically
- ✅ Sets up proper schema for collection tracking
- ✅ Cleans everything for a fresh start
- ✅ Works every time you reinitialize
