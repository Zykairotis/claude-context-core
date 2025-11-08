# Enhancement: Multiple Dataset Search Support

## Overview
Add support for searching across multiple specific datasets, with wildcards and glob patterns.

## Current Limitation
The `dataset` parameter only accepts a single string:
```typescript
dataset: z.string().optional()
```

## Proposed Enhancement

### 1. Update Input Schema

**File:** `mcp-server.js` (line 679)

**Current:**
```javascript
dataset: z.string().optional().describe('Limit search to a specific dataset')
```

**Proposed:**
```javascript
dataset: z.union([
  z.string(),
  z.array(z.string())
]).optional().describe('Dataset(s) to search: single name, array of names, "*" for all, or glob pattern')
```

### 2. Update Query Logic

**File:** `src/api/query.ts` (lines 203-221)

**Current:**
```typescript
// Narrow to explicit dataset when provided
if (request.dataset) {
  const datasetResult = await client.query(
    'SELECT id FROM claude_context.datasets WHERE project_id = $1 AND name = $2',
    [project.id, request.dataset]
  );
  // ... single dataset handling
}
```

**Proposed:**
```typescript
// Narrow to explicit dataset(s) when provided
if (request.dataset) {
  const datasets = Array.isArray(request.dataset) ? request.dataset : [request.dataset];
  
  // Handle wildcards
  if (datasets.length === 1 && datasets[0] === '*') {
    // Keep all accessible datasets (no-op)
  } else {
    // Handle glob patterns
    const datasetPatterns = datasets.map(ds => 
      ds.includes('*') ? ds.replace(/\*/g, '%') : ds
    );
    
    // Query with LIKE or exact match
    const conditions = datasetPatterns.map((_, i) => 
      datasets[i].includes('*') 
        ? `name LIKE $${i + 2}`
        : `name = $${i + 2}`
    ).join(' OR ');
    
    const datasetResult = await client.query(
      `SELECT id FROM claude_context.datasets 
       WHERE project_id = $1 AND (${conditions})`,
      [project.id, ...datasetPatterns]
    );
    
    if (datasetResult.rows.length === 0) {
      return { requestId, results: [], metadata: makeEmptyMetadata() };
    }
    
    const selectedIds = datasetResult.rows.map(row => row.id);
    
    // Filter to accessible datasets only
    datasetIds = accessibleDatasetIds.filter(id => selectedIds.includes(id));
  }
}
```

### 3. Update Type Definitions

**File:** `src/api/query.ts` (interface definition)

**Current:**
```typescript
export interface ProjectQueryRequest {
  project: string;
  dataset?: string;
  // ...
}
```

**Proposed:**
```typescript
export interface ProjectQueryRequest {
  project: string;
  dataset?: string | string[];  // ← Support array
  // ...
}
```

### 4. Update API Routes

**File:** `services/api-server/src/routes/projects.ts` (line 1340)

**Current:**
```typescript
dataset: body.dataset,
```

**Proposed:**
```typescript
dataset: Array.isArray(body.dataset) ? body.dataset : body.dataset,
```

No change needed - already passes through correctly!

---

## Usage Examples

### 1. Search Multiple Specific Datasets
```javascript
claudeContext.search({
  query: "authentication",
  datasets: ["docs", "github-main"]
})
// Searches only docs + github-main
```

### 2. Wildcard (All Datasets)
```javascript
claudeContext.search({
  query: "authentication",
  dataset: "*"
})
// Explicit "search all" (same as omitting dataset)
```

### 3. Glob Pattern
```javascript
claudeContext.search({
  query: "deployment scripts",
  dataset: "github-*"
})
// Matches: github-main, github-dev, github-v2, etc.
```

### 4. Multiple Patterns
```javascript
claudeContext.search({
  query: "API endpoints",
  datasets: ["docs", "api-*", "github-main"]
})
// Matches: docs, api-ref, api-v2, github-main
```

---

## Benefits

1. ✅ **Flexible Grouping** - Search related datasets without searching everything
2. ✅ **Pattern Matching** - Use globs for versioned datasets (github-v1, github-v2)
3. ✅ **Explicit Intent** - `dataset: "*"` is clearer than omitting parameter
4. ✅ **Backward Compatible** - Single string still works
5. ✅ **Already Built** - Backend already handles multiple dataset IDs

---

## Testing Plan

### Test Cases:

```javascript
// 1. Single dataset (existing behavior)
test("search single dataset", async () => {
  const result = await claudeContext.search({
    query: "test",
    dataset: "local"
  });
  expect(result.collections).toContain("project-local");
});

// 2. Multiple datasets
test("search multiple datasets", async () => {
  const result = await claudeContext.search({
    query: "test",
    datasets: ["local", "docs"]
  });
  expect(result.collections).toContain("project-local");
  expect(result.collections).toContain("project-docs");
  expect(result.collections).not.toContain("project-github-main");
});

// 3. Wildcard all
test("search all datasets with wildcard", async () => {
  const result = await claudeContext.search({
    query: "test",
    dataset: "*"
  });
  expect(result.collections.length).toBe(4); // All datasets
});

// 4. Glob pattern
test("search with glob pattern", async () => {
  const result = await claudeContext.search({
    query: "test",
    dataset: "github-*"
  });
  expect(result.collections).toContain("project-github-main");
  expect(result.collections).toContain("project-github-dev");
  expect(result.collections).not.toContain("project-docs");
});
```

---

## Implementation Estimate

- **Complexity:** Low-Medium
- **Time:** 2-4 hours
- **Risk:** Low (backend already supports it)
- **Breaking Changes:** None (backward compatible)

---

## Priority

**Medium-High** - This significantly improves search flexibility without major architectural changes.

---

## Alternative Approaches

### Option A: Dataset Groups (More Complex)
```javascript
// Define groups in config
groups: {
  "sources": ["docs", "github-main", "api-ref"],
  "code": ["local", "github-main"]
}

// Search by group
claudeContext.search({
  query: "auth",
  datasetGroup: "sources"
})
```

**Pros:** More organized, reusable groupings
**Cons:** Requires additional configuration management

### Option B: Dataset Hierarchy (Most Complex)
```javascript
// Nested datasets
"sources": {
  "docs": {...},
  "github": {
    "main": {...},
    "dev": {...}
  }
}

// Search with path
claudeContext.search({
  query: "auth",
  dataset: "sources/github/*"
})
```

**Pros:** Hierarchical organization
**Cons:** Major schema changes, complex migration

---

## Recommendation

**Implement the simple array + glob approach first** (outlined above). It's:
- ✅ Easy to implement
- ✅ Backward compatible
- ✅ Covers 90% of use cases
- ✅ Can be extended later if needed

If users need more organization, add **Option A (Dataset Groups)** later.
