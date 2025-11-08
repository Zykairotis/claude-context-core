# Dataset Filtering Bug Fix

## Problem Identified

The search system is **NOT filtering by dataset** when performing searches. This causes results from all datasets to be returned, regardless of which dataset is specified.

### Root Cause

In `/src/api/query.ts`, the `executeSearch` function has multiple issues:

1. **Dual-model search**: The filter is explicitly passed as `undefined` (line 334)
2. **Collection-based search**: Searches across all collections without dataset filtering
3. **Filter not properly constructed**: The filter object needs to be formatted for Qdrant

## The Bug

### Location 1: query.ts line 329-337
```typescript
// CURRENT (BROKEN):
const dualResults = await context.dualModelSearch(
  collectionName,
  request.query,
  initialK,
  threshold,
  undefined, // ← THIS IS THE BUG! Filter is not passed
  hybridEnabled,
  querySparse
);
```

### Location 2: Filter construction (lines 292-311)
The filter object is created but needs to be converted to Qdrant filter expression:
```typescript
const filter: Record<string, any> = {
  datasetIds  // This is an array, needs to be converted to Qdrant format
};
```

## The Fix

### Step 1: Convert filter to Qdrant format

```typescript
// Add this function to convert filter to Qdrant expression
function buildQdrantFilter(filter: Record<string, any>): string | undefined {
  const conditions: string[] = [];
  
  // Handle datasetIds array
  if (filter.datasetIds && filter.datasetIds.length > 0) {
    const datasetConditions = filter.datasetIds
      .map((id: string) => `metadata.datasetId == "${id}"`)
      .join(' OR ');
    conditions.push(`(${datasetConditions})`);
  }
  
  // Handle projectId
  if (filter.projectId) {
    conditions.push(`metadata.projectId == "${filter.projectId}"`);
  }
  
  // Handle other filters
  if (filter.repo) {
    conditions.push(`metadata.repo == "${filter.repo}"`);
  }
  
  if (filter.lang) {
    conditions.push(`metadata.lang == "${filter.lang}"`);
  }
  
  if (filter.pathPrefix) {
    conditions.push(`metadata.path LIKE "${filter.pathPrefix}%"`);
  }
  
  return conditions.length > 0 ? conditions.join(' AND ') : undefined;
}
```

### Step 2: Update executeSearch to use filter

```typescript
const executeSearch = async (collectionName: string): Promise<SearchResultWithBreakdown[]> => {
  try {
    // Convert filter to Qdrant expression format
    const qdrantFilter = buildQdrantFilter(filter);
    
    // Dual-model search path
    if (isDualModel) {
      const dualResults = await context.dualModelSearch(
        collectionName,
        request.query,
        initialK,
        threshold,
        qdrantFilter, // ← FIX: Pass the filter!
        hybridEnabled,
        querySparse
      );
      
      return dualResults.map(result => ({
        document: result.document,
        score: result.score,
        vectorScore: result.score
      }));
    }
    
    // Single-model search path
    if (hybridEnabled && querySparse && typeof (vectorDb as any).hybridQuery === 'function') {
      const [hybridResults, denseResults]: [VectorSearchResult[], VectorSearchResult[]] = await Promise.all([
        (vectorDb as any).hybridQuery(collectionName, queryVector.vector, querySparse, {
          topK: initialK,
          threshold,
          filterExpr: qdrantFilter // ← FIX: Use filterExpr
        }),
        vectorDb.search(collectionName, queryVector.vector, {
          topK: initialK,
          threshold,
          filterExpr: qdrantFilter // ← FIX: Use filterExpr
        })
      ]);
      // ... rest of code
    }
    
    const denseOnlyResults = await vectorDb.search(collectionName, queryVector.vector, {
      topK: initialK,
      threshold,
      filterExpr: qdrantFilter // ← FIX: Use filterExpr
    });
    // ... rest of code
  } catch (error: any) {
    console.warn(`[Query] Search failed for collection ${collectionName}:`, error.message || error);
    return [];
  }
};
```

## Alternative Solution: PostgreSQL-Based Filtering

If Qdrant filtering is complex, we can also filter results AFTER retrieval using the PostgreSQL chunks table:

```typescript
// After getting search results, filter by dataset
const filterResultsByDataset = async (
  results: SearchResultWithBreakdown[],
  datasetIds: string[]
): Promise<SearchResultWithBreakdown[]> => {
  if (!pool || datasetIds.length === 0) return results;
  
  // Get chunk IDs that belong to the specified datasets
  const chunkIds = results.map(r => r.document.id);
  const placeholders = chunkIds.map((_, i) => `$${i + 1}`).join(', ');
  
  const query = `
    SELECT c.id 
    FROM claude_context.chunks c
    WHERE c.id IN (${placeholders})
    AND c.dataset_id = ANY($${chunkIds.length + 1}::uuid[])
  `;
  
  const validChunks = await pool.query(query, [...chunkIds, datasetIds]);
  const validChunkSet = new Set(validChunks.rows.map(r => r.id));
  
  // Filter results to only those in the valid dataset
  return results.filter(r => validChunkSet.has(r.document.id));
};
```

## Testing the Fix

1. **Before Fix**:
   ```bash
   # Search inception-docs dataset
   claudeContext.search({
     dataset: "inception-docs",
     query: "Inception Labs"
   })
   # Returns: Results from ai-docs dataset (WRONG!)
   ```

2. **After Fix**:
   ```bash
   # Search inception-docs dataset
   claudeContext.search({
     dataset: "inception-docs", 
     query: "Inception Labs"
   })
   # Returns: ONLY results from inception-docs dataset (CORRECT!)
   ```

## Files to Modify

1. `/src/api/query.ts`:
   - Add `buildQdrantFilter` function
   - Update `executeSearch` to pass filter to all search methods
   - Change `filter` to `filterExpr` in search options

2. Optional: `/src/context.ts`:
   - Verify `dualModelSearch` properly uses the `filterExpr` parameter

## Quick Patch

For immediate testing, you can add this logging to verify the issue:

```typescript
// In executeSearch function, add:
console.log('[DEBUG] Filter being used:', filter);
console.log('[DEBUG] DatasetIds:', filter.datasetIds);
console.log('[DEBUG] Collection:', collectionName);
```

This will show that the filter has the correct dataset IDs but they're not being applied to the search.
