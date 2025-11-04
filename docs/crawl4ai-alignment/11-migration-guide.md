# Todo 11: Migration Guide & Backward Compatibility

**Status:** ⏳ Not Started  
**Complexity:** Medium  
**Estimated Time:** 4-6 hours  
**Dependencies:** Todo 10 (Testing)

---

## Objective

Provide migration path for existing Crawl4AI users and ensure backward compatibility where needed.

---

## Breaking Changes

### 1. Crawl4AI Service Response Format

**Before:**
```json
{
  "progress_id": "abc123",
  "status": "completed",
  "chunks_stored": 45,
  "project_id": "uuid",
  "dataset_id": "uuid"
}
```

**After:**
```json
{
  "progress_id": "abc123",
  "status": "completed",
  "pages": [
    { "url": "...", "content": "...", "title": "..." }
  ],
  "totalPages": 5
}
```

### 2. MCP Tool Response

**Before:** Direct storage acknowledgment  
**After:** Stats from Context processing

---

## Migration Steps

### Phase 1: Add Feature Flag

```bash
# .env
USE_UNIFIED_PIPELINE=true  # false for legacy mode
```

### Phase 2: Dual-Mode Support

```typescript
// mcp-server.js
if (process.env.USE_UNIFIED_PIPELINE === 'true') {
  // New unified path
  await context.indexWebPages(pages, project, dataset);
} else {
  // Legacy path
  await legacyCrawlAndStore(url, project, dataset);
}
```

### Phase 3: Deprecation Warnings

```typescript
if (!process.env.USE_UNIFIED_PIPELINE) {
  console.warn(
    '\n⚠️  DEPRECATION WARNING:\n' +
    'Legacy crawl mode will be removed in v2.0\n' +
    'Set USE_UNIFIED_PIPELINE=true to migrate\n'
  );
}
```

### Phase 4: Remove Legacy Code

After 2-4 weeks:
- Remove feature flags
- Delete legacy code paths
- Update documentation

---

## Migration Checklist

### For Users

- [ ] Update environment variables
- [ ] Set `USE_UNIFIED_PIPELINE=true`
- [ ] Test crawl workflows
- [ ] Verify search quality
- [ ] Update MCP tool calls (if using directly)
- [ ] Monitor performance metrics

### For Developers

- [ ] Review code for direct Crawl4AI calls
- [ ] Update to use `Context.indexWebPages()`
- [ ] Remove direct storage calls
- [ ] Update tests
- [ ] Deploy updated services

---

## Compatibility Matrix

| Feature | Legacy | Unified | Notes |
|---------|--------|---------|-------|
| Basic crawl | ✅ | ✅ | API compatible |
| Chunking | Custom | AST-based | Different boundaries |
| Embedding | GTE/CodeRank | Configurable | May differ |
| Storage | Direct PG | Context layer | Schema compatible |
| Hybrid search | ❌ | ✅ | New feature |
| Reranking | ❌ | ✅ | New feature |
| Symbols | ❌ | ✅ | New feature |

---

## Rollback Plan

If issues arise:

```bash
# Immediate rollback
export USE_UNIFIED_PIPELINE=false
docker-compose restart mcp-server

# Verify legacy mode
npm run test:legacy
```

---

## Next Steps

Proceed to [12-deployment.md](./12-deployment.md).

---

**Completion Criteria:**
- ✅ Migration docs complete
- ✅ Feature flags working
- ✅ Backward compatibility verified
- ✅ Rollback tested
