# Plan 5: Incremental Sync Integration

## Overview

This plan addresses how the **Island Architecture** integrates with the **Incremental Sync** feature (auto-sync). The two systems must work together seamlessly.

---

## The Problem

**Incremental Sync** uses the `indexed_files` table to track file hashes:

```sql
CREATE TABLE indexed_files (
  file_path TEXT,
  sha256_hash TEXT,
  project_id UUID,
  dataset_id UUID,
  chunk_count INTEGER
);
```

**Island Architecture** introduces collection tracking:

```sql
CREATE TABLE dataset_collections (
  dataset_id UUID,
  collection_name TEXT,  -- proj_{UUID}_{UUID}
  point_count BIGINT
);
```

**Missing Link:** When a file changes, incremental sync needs to know:
- Which collection to update
- How to delete old chunks from the correct collection
- How to add new chunks to the correct collection

---

## Solution: Link indexed_files to Collections

### Database Update

```sql
-- Add collection_name to indexed_files
ALTER TABLE claude_context.indexed_files
ADD COLUMN collection_name TEXT;

-- Add foreign key constraint (optional, for data integrity)
ALTER TABLE claude_context.indexed_files
ADD CONSTRAINT fk_collection_name
  FOREIGN KEY (collection_name)
  REFERENCES claude_context.dataset_collections(collection_name)
  ON DELETE CASCADE;

-- Index for faster lookups
CREATE INDEX idx_indexed_files_collection
  ON claude_context.indexed_files(collection_name);
```

### Incremental Sync Update

**File:** `src/sync/incremental-sync.ts`

```typescript
// UPDATE: Pass collection info to sync
export async function incrementalSync(
  context: Context,
  pool: Pool,
  codebasePath: string,
  project: string,
  projectId: string,
  dataset: string,
  datasetId: string,
  options?: SyncOptions
): Promise<SyncStats> {
  
  // NEW: Get or create collection for this dataset
  const collectionManager = getCollectionManager(pool, context.getVectorDatabase());
  const collectionInfo = await collectionManager.getOrCreateCollection(
    projectId,
    datasetId,
    project,
    dataset
  );
  
  console.log(`[IncrementalSync] Using collection: ${collectionInfo.collectionName}`);
  
  // Detect changes
  const changes = await detectChanges(
    pool,
    codebasePath,
    projectId,
    datasetId,
    collectionInfo.collectionName  // NEW: Pass collection name
  );
  
  // Process each change type
  for (const file of changes.created) {
    await indexSingleFile(
      context, 
      pool, 
      file.path, 
      projectId, 
      datasetId,
      collectionInfo.collectionName  // NEW: Pass collection name
    );
  }
  
  for (const file of changes.modified) {
    // Delete old chunks from the CORRECT collection
    await deleteFileChunks(
      context.getVectorDatabase(),
      collectionInfo.collectionName,  // NEW: Use specific collection
      file.path,
      projectId,
      datasetId
    );
    
    // Reindex
    await indexSingleFile(
      context,
      pool,
      file.path,
      projectId,
      datasetId,
      collectionInfo.collectionName  // NEW: Pass collection name
    );
  }
  
  for (const file of changes.deleted) {
    await deleteFileChunks(
      context.getVectorDatabase(),
      collectionInfo.collectionName,  // NEW: Use specific collection
      file.path,
      projectId,
      datasetId
    );
  }
  
  return stats;
}
```

### File Metadata Update

**File:** `src/sync/file-metadata.ts`

```typescript
// UPDATE: Store collection_name when recording file
export async function recordIndexedFile(
  client: PoolClient,
  projectId: string,
  datasetId: string,
  collectionName: string,  // NEW parameter
  file: {
    path: string;
    relativePath: string;
    sha256: string;
    size: number;
    chunkCount: number;
    language?: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO claude_context.indexed_files
     (project_id, dataset_id, collection_name, file_path, relative_path, 
      sha256_hash, file_size, chunk_count, language)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (project_id, dataset_id, file_path)
     DO UPDATE SET
       sha256_hash = EXCLUDED.sha256_hash,
       file_size = EXCLUDED.file_size,
       chunk_count = EXCLUDED.chunk_count,
       collection_name = EXCLUDED.collection_name,  // NEW
       last_indexed_at = NOW()`,
    [projectId, datasetId, collectionName, file.path, file.relativePath,
     file.sha256, file.size, file.chunkCount, file.language]
  );
}
```

### Chunk Deletion Logic

**File:** `src/sync/incremental-sync.ts`

```typescript
/**
 * Delete chunks for a specific file from the CORRECT collection
 * Previously searched ALL collections - now targets specific one
 */
async function deleteFileChunks(
  vectorDb: VectorDatabase,
  collectionName: string,  // NEW: Specific collection
  filePath: string,
  projectId: string,
  datasetId: string
): Promise<number> {
  try {
    // Delete from the specific collection only
    const deleted = await vectorDb.deleteByFilter(collectionName, {
      must: [
        { key: 'project_id', match: { value: projectId } },
        { key: 'dataset_id', match: { value: datasetId } },
        { key: 'file_path', match: { value: filePath } }
      ]
    });
    
    console.log(`[IncrementalSync] Deleted ${deleted} chunks from ${collectionName}`);
    return deleted;
  } catch (error) {
    console.error(`[IncrementalSync] Failed to delete chunks for ${filePath}:`, error);
    throw error;
  }
}
```

---

## Migration Path

### Step 1: Update Schema

```bash
./scripts/migrate-add-collection-to-indexed-files.sh
```

```sql
-- Migration script
ALTER TABLE claude_context.indexed_files
ADD COLUMN collection_name TEXT;

CREATE INDEX idx_indexed_files_collection
  ON claude_context.indexed_files(collection_name);
```

### Step 2: Backfill Existing Records

```typescript
/**
 * Backfill collection_name for existing indexed_files
 */
async function backfillCollectionNames(pool: Pool) {
  const client = await pool.connect();
  
  try {
    // Get all indexed files without collection_name
    const files = await client.query(`
      SELECT DISTINCT if.project_id, if.dataset_id
      FROM claude_context.indexed_files if
      WHERE if.collection_name IS NULL
    `);
    
    for (const row of files.rows) {
      // Get collection for this dataset
      const collection = await client.query(`
        SELECT collection_name
        FROM claude_context.dataset_collections
        WHERE dataset_id = $1
      `, [row.dataset_id]);
      
      if (collection.rows.length > 0) {
        // Update all files for this dataset
        await client.query(`
          UPDATE claude_context.indexed_files
          SET collection_name = $1
          WHERE project_id = $2 AND dataset_id = $3 AND collection_name IS NULL
        `, [collection.rows[0].collection_name, row.project_id, row.dataset_id]);
        
        console.log(`Backfilled collection_name for dataset ${row.dataset_id}`);
      }
    }
    
    console.log('✅ Backfill complete');
  } finally {
    client.release();
  }
}
```

---

## File Watcher Integration

**File:** `src/sync/file-watcher.ts`

The file watcher already calls `incrementalSync()`, so no changes needed! The collection info will be automatically resolved inside `incrementalSync()`.

```typescript
// src/sync/file-watcher.ts - NO CHANGES NEEDED
export async function startWatching(
  context: Context,
  pool: Pool,
  path: string,
  project: string,
  projectId: string,
  dataset: string,
  datasetId: string,
  options?: WatcherOptions
): Promise<ActiveWatcher> {
  
  const watcher = chokidar.watch(path, watchOptions);
  
  watcher.on('change', async (filePath) => {
    // This automatically uses the correct collection now
    await incrementalSync(context, pool, path, project, projectId, dataset, datasetId);
  });
  
  return { id, watcher, startedAt: new Date() };
}
```

---

## Benefits

### ✅ Correctness
- Chunks always stored in correct collection
- No cross-project contamination
- File tracking linked to collection

### ✅ Performance
- Targeted deletion (one collection, not all)
- Faster sync operations
- No unnecessary collection scans

### ✅ Maintainability
- Clear data lineage
- Easy to debug
- Consistent with island architecture

---

## Testing Checklist

- [ ] Test: Create project → Create dataset → Index files → Verify collection_name in indexed_files
- [ ] Test: Modify file → Verify chunks deleted from correct collection
- [ ] Test: Rename project → Verify collection_name unchanged in indexed_files
- [ ] Test: Delete dataset → Verify indexed_files CASCADE deleted
- [ ] Test: Auto-sync → Verify uses correct collection
- [ ] Test: Backfill script → Verify all old records updated

---

## Summary

**Key Changes:**
1. Add `collection_name` to `indexed_files` table
2. Update `incrementalSync()` to get collection info
3. Update `recordIndexedFile()` to store collection name
4. Update `deleteFileChunks()` to target specific collection
5. Add backfill script for existing data

**Result:** Incremental sync and island architecture work together seamlessly, with proper data isolation and performance.
