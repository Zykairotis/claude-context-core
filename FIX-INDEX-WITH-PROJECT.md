# Fix for indexWithProject Method

## Problem
The `indexWithProject` method in `/src/context.ts` is using the OLD collection naming system (MD5 hash) instead of the NEW scope-based naming system. This causes:

1. Collections created with wrong names (`hybrid_code_chunks_ea8707f8` instead of `project_hypr_voice_dataset_main`)
2. No records in `dataset_collections` table
3. Dataset filtering fails because search can't find the right collections

## Current Code (BROKEN) - Line 1863
```typescript
async indexWithProject(...) {
    // ...
    // Line 1863 - WRONG!
    await this.prepareCollection(codebasePath, options?.forceReindex || false);
    // ...
}
```

## Fixed Code (CORRECT)
```typescript
async indexWithProject(...) {
    // ...
    
    // 1. Get collection name using ScopeManager (like indexWebPages does)
    const collectionName = this.scopeManager.getCollectionName(projectName, datasetName);
    console.log(`[Context] 📦 Collection: ${collectionName}`);
    
    // 2. Get or create collection record in dataset_collections table
    if (this.postgresPool) {
        const { getOrCreateCollectionRecord } = await import('./utils/collection-helpers');
        const collectionId = await getOrCreateCollectionRecord(
            this.postgresPool,
            projectContext.datasetId,
            collectionName,
            this.vectorDatabase.constructor.name === 'QdrantVectorDatabase' ? 'qdrant' : 'postgres',
            await this.embedding.detectDimension(),
            this.getIsHybrid() === true
        );
        console.log(`[Context] ✅ Collection record: ${collectionId}`);
    }
    
    // 3. Prepare collection with the NEW name
    await this.prepareCollectionScoped(collectionName, options?.forceReindex || false);
    
    // ...
}

// New helper method
private async prepareCollectionScoped(collectionName: string, forceReindex: boolean = false): Promise<void> {
    const isHybrid = this.getIsHybrid();
    
    // Check if collection exists
    const collectionExists = await this.vectorDatabase.hasCollection(collectionName);
    
    if (collectionExists && !forceReindex) {
        console.log(`📋 Collection ${collectionName} already exists, skipping creation`);
        return;
    }
    
    if (collectionExists && forceReindex) {
        console.log(`[Context] 🗑️  Dropping existing collection ${collectionName} for force reindex...`);
        await this.vectorDatabase.dropCollection(collectionName);
    }
    
    const dimension = await this.embedding.detectDimension();
    
    if (isHybrid === true) {
        await this.vectorDatabase.createHybridCollection(collectionName, dimension);
    } else {
        await this.vectorDatabase.createCollection(collectionName, dimension);
    }
    
    console.log(`[Context] ✅ Collection ${collectionName} created successfully`);
}
```

## Key Changes

1. **Use ScopeManager for collection naming:**
   ```typescript
   const collectionName = this.scopeManager.getCollectionName(projectName, datasetName);
   ```
   This generates names like `project_hypr_voice_dataset_main`

2. **Create dataset_collections record:**
   ```typescript
   await getOrCreateCollectionRecord(
       this.postgresPool,
       projectContext.datasetId,
       collectionName,
       ...
   );
   ```
   This populates the `dataset_collections` table

3. **Use scope-based collection throughout:**
   - Replace all `this.getCollectionName(codebasePath)` calls
   - Use the scope-based `collectionName` variable

## Testing After Fix

1. **Re-index with fixed code:**
   ```javascript
   claudeContext.index({
     project: 'hypr-voice',
     dataset: 'main',
     path: '/path/to/hypr-voice'
   })
   ```

2. **Check dataset_collections table:**
   ```sql
   SELECT * FROM claude_context.dataset_collections;
   -- Should show: project_hypr_voice_dataset_main
   ```

3. **Check Qdrant collections:**
   ```bash
   curl http://localhost:6333/collections | jq
   # Should show: project_hypr_voice_dataset_main
   ```

4. **Verify metadata in points:**
   ```bash
   curl -X POST http://localhost:6333/collections/project_hypr_voice_dataset_main/points/scroll \
     -H "Content-Type: application/json" \
     -d '{"limit": 1}' | jq '.result.points[0].payload'
   # Should show: datasetId and projectId with actual UUIDs
   ```

5. **Test search isolation:**
   ```javascript
   claudeContext.search({
     project: 'hypr-voice',
     dataset: 'main',
     query: 'test'
   })
   // Should ONLY return results from main dataset!
   ```

## Impact

After this fix:
- ✅ Each dataset gets its own properly named collection
- ✅ `dataset_collections` table is populated
- ✅ Search can find the right collection for each dataset
- ✅ Dataset filtering will work correctly
- ✅ No more mixed results!
