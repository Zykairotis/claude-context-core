# Dataset Collection Mapping Problem

## The Real Issue

Your Qdrant has **3 separate collections** but PostgreSQL doesn't know about them:

### Qdrant Collections (Reality):
```
1. hybrid_code_chunks_bc391168 - 1,247 points
2. hybrid_code_chunks_ea870718 - 7,860 points  
3. project_hypr_voice - 19,522 points (SUM OF ALL!)
```

### PostgreSQL Datasets (Configuration):
```
1. main - 0 chunks
2. claude-context-core - 0 chunks
3. pydantic-ai-docs-v2 - 9,761 chunks
4. perplexity-claude - 0 chunks

ALL mapped to: project_hypr_voice ❌
```

## Why Filtering Doesn't Work

The search system looks for collections mapped in PostgreSQL's `dataset_collections` table:
- ❌ Table didn't exist (just created it)
- ❌ No mappings exist  
- ❌ System falls back to `project_hypr_voice` for everything
- ❌ `project_hypr_voice` has ALL data mixed together (19,522 = 1,247 + 7,860 + duplicates)

## The Problem

The data was indexed into **separate collections** but:
1. PostgreSQL doesn't track which dataset → which collection
2. Search falls back to `project_hypr_voice` which has everything
3. Your filter tries to filter by `datasetId` but the points don't have this metadata
4. Result: All datasets return mixed results

## Solutions

### Option 1: Map Existing Collections (Quick Fix)
Manually map datasets to their collections in `dataset_collections` table:

```sql
-- Map pydantic-ai-docs-v2 to its collection (most chunks)
INSERT INTO claude_context.dataset_collections 
(dataset_id, collection_name, vector_db_type, dimension, point_count)
VALUES (
  (SELECT id FROM claude_context.datasets WHERE name = 'pydantic-ai-docs-v2'),
  'hybrid_code_chunks_ea870718',
  'qdrant',
  768,
  7860
);
```

**Problem**: Other collections (`hybrid_code_chunks_bc391168`) don't map cleanly to datasets.

### Option 2: Re-index Everything (Proper Fix) ⭐

Delete old data and re-index with proper dataset→collection mapping:

```bash
# 1. Clear Qdrant collections
curl -X DELETE http://localhost:6333/collections/project_hypr_voice
curl -X DELETE http://localhost:6333/collections/hybrid_code_chunks_bc391168
curl -X DELETE http://localhost:6333/collections/hybrid_code_chunks_ea870718

# 2. Re-index each dataset separately
# This will create dataset-specific collections with proper metadata

# For local project (main dataset)
claudeContext.index({
  project: "Hypr-Voice",
  dataset: "main",
  path: "/path/to/hypr-voice"
})

# For pydantic-ai-docs
claudeContext.crawl({
  project: "Hypr-Voice",
  dataset: "pydantic-ai-docs-v2",
  url: "https://ai.pydantic.dev",
  // ...
})

# For GitHub repos
claudeContext.indexGitHub({
  project: "Hypr-Voice",
  dataset: "perplexity-claude",
  repo: "Zykairotis/Perplexity-claude"
})
```

### Option 3: Hybrid Approach (Temporary)

Use PostgreSQL chunks table to filter results AFTER retrieval:

```typescript
// In query.ts, after getting results from Qdrant
const filterResultsByDataset = async (results, datasetIds) => {
  // Query chunks table to verify which chunks belong to which datasets
  const chunkIds = results.map(r => r.document.id);
  const validChunks = await pool.query(`
    SELECT id FROM claude_context.chunks 
    WHERE id = ANY($1) AND dataset_id = ANY($2)
  `, [chunkIds, datasetIds]);
  
  const validSet = new Set(validChunks.rows.map(r => r.id));
  return results.filter(r => validSet.has(r.document.id));
};
```

**Problem**: Only works for data that's in PostgreSQL (9,761 chunks), not the other 11k+ points.

## Recommended Action

**Re-index everything** (Option 2) because:
1. ✅ Proper dataset→collection mapping
2. ✅ Metadata includes `datasetId` and `projectId`
3. ✅ Clean separation of concerns
4. ✅ Filter works at Qdrant level (fast)
5. ✅ No mixing of data

This ensures:
- `main` dataset → `project_hypr_voice_dataset_main` collection
- `pydantic-ai-docs-v2` → `project_hypr_voice_dataset_pydantic_ai_docs_v2` collection
- `perplexity-claude` → `project_hypr_voice_dataset_perplexity_claude` collection

Each search will then filter by collection name, ensuring complete isolation!
