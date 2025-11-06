# Island Architecture - CORRECTED Implementation Checklist

> **Status:** ✅ UPDATED after Reality Check (Nov 5, 2025)
> 
> **Last Updated:** November 5, 2025
> 
> **Approach:** Follow Crawl4AI's NAME-based architecture (not UUID-based)

---

## 🚨 CRITICAL: Read This First

**✅ Reality Check Completed - Plan Updated!**

**Key Findings:**
- ✅ Crawl4AI service ALREADY implements scope-based collections
- ✅ Uses NAME-based collections: `project_{name}_dataset_{name}`
- ❌ TypeScript core still uses MD5 hash-based naming
- ❌ Missing database tables and columns

**New Approach:**
- Port Python ScopeManager to TypeScript
- Follow existing working implementation
- Simpler than original UUID-based plan

**📖 Required Reading (in order):**
1. [REALITY-CHECK.md](./REALITY-CHECK.md) - What's implemented
2. [plan7-corrected-implementation.md](./plan7-corrected-implementation.md) - Corrected plan

---

## 🎯 Prerequisites

- [x] Reality check completed ✅
- [x] Understand Crawl4AI's implementation ✅
- [x] Read corrected plan (plan7) ✅
- [ ] Backup current database and Qdrant data
- [ ] Set up test environment
- [ ] Review with team

---

## CORRECTED PHASES (Following plan7-corrected-implementation.md)

### Phase 1: Port ScopeManager to TypeScript (Week 1, Days 1-2)

**Goal:** TypeScript equivalent of Python ScopeManager

- [ ] Create `src/utils/scope-manager.ts`
  - [ ] `ScopeLevel` enum (GLOBAL, PROJECT, LOCAL)
  - [ ] `resolveScope()` method
  - [ ] `getCollectionName()` - NAME-based (not UUID!)
  - [ ] `getProjectId()` - deterministic uuid5
  - [ ] `getDatasetId()` - deterministic uuid5
  - [ ] `sanitizeName()` - private helper

- [ ] Create `src/utils/scope-manager.spec.ts`
  - [ ] Test collection naming for each scope
  - [ ] Test UUID determinism
  - [ ] Test sanitization (lowercase, alphanumeric)
  - [ ] Test error handling

**Verification:**
```bash
npm run test -- src/utils/scope-manager.spec.ts
npm run build
```

**Expected Output:**
- Collection names: `project_myapp_dataset_frontend`
- UUIDs: Consistent across runs for same names

---

### Phase 2: Database Migrations (Week 1, Day 3)

**Goal:** Add missing tables and columns

#### 2.1 Create dataset_collections Table

- [ ] Write migration: `scripts/migrate-add-dataset-collections.sh`
- [ ] Create table with columns:
  - [ ] `id`, `dataset_id`, `collection_name` (UNIQUE)
  - [ ] `vector_db_type`, `dimension`, `is_hybrid`
  - [ ] `point_count`, `last_point_count_sync`
  - [ ] Timestamps and indexes
- [ ] Run migration
- [ ] Verify table exists

**Verification:**
```bash
./scripts/migrate-add-dataset-collections.sh
psql -h localhost -U postgres -p 5533 -d claude_context -c "\\d claude_context.dataset_collections"
```

#### 2.2 Add collection_name to indexed_files

- [ ] Write migration: `scripts/migrate-add-collection-to-indexed-files.sh`
- [ ] Add `collection_name` column
- [ ] Add FK constraint to `dataset_collections`
- [ ] Create index
- [ ] Run migration
- [ ] Verify column exists

**Verification:**
```bash
./scripts/migrate-add-collection-to-indexed-files.sh
psql -h localhost -U postgres -p 5533 -d claude_context -c "\\d claude_context.indexed_files"
```

#### 2.3 Backfill collection_name

- [ ] Write script: `scripts/backfill-collection-names.ts`
- [ ] Logic: For each indexed_file, generate collection_name using ScopeManager
- [ ] Update all existing records
- [ ] Run backfill
- [ ] Verify all rows have collection_name

**Verification:**
```bash
npm run tsx scripts/backfill-collection-names.ts
psql -h localhost -U postgres -p 5533 -d claude_context -c \
  "SELECT COUNT(*) FROM claude_context.indexed_files WHERE collection_name IS NULL"
# Expected: 0
```

---

### Phase 3: Update Context.ts (Week 1, Days 4-5)

**Goal:** Use ScopeManager instead of MD5 hashing

- [ ] Import ScopeManager in `src/context.ts`
- [ ] Add `scopeManager` instance variable
- [ ] Create `getCollectionNameScoped()` method
- [ ] Mark old `getCollectionName()` as deprecated
- [ ] Update all internal calls to use new method
- [ ] Add backward compatibility flag

**Changes:**
- [ ] Line ~35: Add `private scopeManager: ScopeManager;`
- [ ] Constructor: Initialize scopeManager
- [ ] New method: `getCollectionNameScoped(project, dataset)`
- [ ] Deprecate: Old `getCollectionName(codebasePath)`

**Verification:**
```bash
npm run build
npm run test
```

---

### Phase 4: Implement deleteFileChunks (Week 2, Day 1)

### 3.1 Update Sync Logic

- [ ] Update `src/sync/incremental-sync.ts`
  - [ ] Get collection info at start of sync
  - [ ] Pass `collectionName` to `indexSingleFile()`
  - [ ] Pass `collectionName` to `deleteFileChunks()`

- [ ] Update `src/sync/file-metadata.ts`
  - [ ] Add `collectionName` parameter to `recordIndexedFile()`
  - [ ] Store `collection_name` in database

- [ ] Update `src/sync/change-detector.ts`
  - [ ] Accept `collectionName` parameter
  - [ ] Pass through to metadata functions

**Tests:**
- [ ] Integration test: Sync with collection tracking
- [ ] Integration test: Modified file deletes from correct collection
- [ ] Integration test: Verify `collection_name` stored

### 3.2 Backfill Migration

- [ ] Create `scripts/backfill-collection-names.ts`
  - [ ] Query indexed files without `collection_name`
  - [ ] Look up collection for each dataset
  - [ ] Update records with collection name

**Verification:**
```bash
npm run backfill-collections
# Check: All indexed_files have collection_name
```

---

## Phase 4: Indexing Logic (Week 2, Days 1-2)

### 4.1 Update Context

- [ ] Update `src/context.ts`
  - [ ] Update `indexWithProject()` to use `CollectionManager`
  - [ ] Pass projectId and datasetId (not just names)
  - [ ] Get collection info before indexing
  - [ ] Update stats after indexing

**Tests:**
- [ ] Integration test: Index with new collection format
- [ ] Integration test: Re-index updates stats
- [ ] Integration test: Error during indexing (rollback)

---

## Phase 5: Query Logic (Week 2, Days 3-4)

### 5.1 Update Query API

- [ ] Update `src/api/query.ts`
  - [ ] Get accessible datasets for project
  - [ ] Use `CollectionManager` to get collections
  - [ ] Remove redundant `project_id` filter
  - [ ] Support `includeGlobal` flag

**Tests:**
- [ ] Integration test: Query searches only project collections
- [ ] Integration test: Global datasets included when requested
- [ ] Integration test: Cross-project isolation
- [ ] Integration test: Shared dataset access

**Verification:**
```bash
# Query should only search project collections
npm run test -- src/api/__tests__/query-*.spec.ts
```

---

## Phase 6: API Endpoints (Week 2, Day 5)

### 6.1 Update Ingestion Endpoints

- [ ] Update `services/api-server/src/routes/projects.ts`
  - [ ] `/projects/:project/ingest/github` - use `CollectionManager`
  - [ ] `/projects/:project/ingest/local` - use `CollectionManager`
  - [ ] `/projects/:project/ingest/local/sync` - integrated with incremental sync

### 6.2 Update Query Endpoints

- [ ] Update query endpoint to use project-scoped logic
- [ ] Add collection listing endpoint (optional)

**Tests:**
- [ ] API test: Create project → Index → Query
- [ ] API test: Multiple projects don't cross-contaminate
- [ ] API test: Global datasets accessible

---

## Phase 7: Migration Tools (Week 3, Days 1-2)

### 7.1 Legacy Collection Migration

- [ ] Create `scripts/migrate-legacy-collections.ts`
  - [ ] Scan Qdrant for legacy collections
  - [ ] Extract project/dataset from payloads
  - [ ] Create `dataset_collections` records
  - [ ] Support dry-run mode

**Verification:**
```bash
npm run migrate-legacy -- --dry-run
# Review changes
npm run migrate-legacy
```

### 7.2 Audit Tools

- [ ] Create `scripts/audit-collections.ts`
  - [ ] Check database vs Qdrant consistency
  - [ ] Find orphaned collections
  - [ ] Verify point counts

**Verification:**
```bash
npm run audit-collections
```

---

## Phase 8: Testing (Week 3, Days 3-5)

### 8.1 Unit Tests

- [ ] Collection naming utilities
- [ ] Collection manager
- [ ] Error recovery scenarios
- [ ] Rename handling

### 8.2 Integration Tests

- [ ] End-to-end: Create → Index → Query → Update
- [ ] Incremental sync with collections
- [ ] Project isolation
- [ ] Global dataset sharing
- [ ] Legacy collection support

### 8.3 Performance Tests

- [ ] Query latency (project-scoped vs all collections)
- [ ] Sync speed (targeted deletion)
- [ ] Point count sync overhead

**Target Metrics:**
- Query speed: 5-10x improvement
- Sync speed: 3-5x improvement

---

## Phase 9: Production Deployment (Week 4)

### 9.1 Staging Deployment (Days 1-2)

- [ ] Deploy to staging environment
- [ ] Run database migrations
- [ ] Backfill collection names
- [ ] Run legacy collection migration
- [ ] Verify all tests pass
- [ ] Performance testing

### 9.2 Production Rollout (Days 3-4)

**Gradual Migration Strategy:**

**Step 1: Deploy Schema (No Downtime)**
- [ ] Run schema migrations (add columns, don't remove)
- [ ] Verify backward compatibility

**Step 2: Deploy Code (Dual Mode)**
- [ ] Deploy updated code
- [ ] New indexes use new format
- [ ] Old indexes still work with legacy format
- [ ] Monitor for errors

**Step 3: Backfill Data**
- [ ] Run backfill scripts during low-traffic period
- [ ] Verify data integrity

**Step 4: Migrate Legacy Collections**
- [ ] Run migration in batches
- [ ] Monitor performance impact

**Step 5: Cleanup (Week 4+)**
- [ ] Remove legacy code paths (after validation period)
- [ ] Archive old collections (optional)

### 9.3 Monitoring (Day 5)

- [ ] Set up alerts
  - [ ] Query latency thresholds
  - [ ] Point count drift
  - [ ] Sync failures
- [ ] Dashboard updates
  - [ ] Collections per project
  - [ ] Vectors per project
  - [ ] Last indexed timestamps
- [ ] Error tracking
  - [ ] Collection creation failures
  - [ ] Sync errors
  - [ ] Query errors

---

## Post-Deployment

### Week 5: Validation

- [ ] Monitor query performance (expect 5-10x improvement)
- [ ] Monitor sync performance (expect 3-5x improvement)
- [ ] Check error rates
- [ ] Collect user feedback

### Week 6: Optimization

- [ ] Tune point count sync frequency
- [ ] Optimize query batching
- [ ] Review and adjust monitoring

### Week 7: Documentation

- [ ] Update API documentation
- [ ] Update user guides
- [ ] Document troubleshooting procedures
- [ ] Create runbook for operations team

---

## Rollback Plan

If critical issues arise:

### Level 1: Code Rollback (< 1 hour)
- [ ] Revert to previous code version
- [ ] Verify legacy format still works
- [ ] Database schema stays (backward compatible)

### Level 2: Data Rollback (< 4 hours)
- [ ] Restore database backup
- [ ] Restore Qdrant snapshot
- [ ] Verify data integrity

### Level 3: Full Rollback (< 8 hours)
- [ ] Revert all changes
- [ ] Restore from pre-migration backup
- [ ] Post-mortem analysis

---

## Success Criteria

### Must Have ✅
- [ ] All projects query only their own collections
- [ ] Incremental sync works correctly
- [ ] No data loss or corruption
- [ ] Error rate < 0.1%
- [ ] Performance improvement: 3x minimum

### Nice to Have 🌟
- [ ] 10x query performance improvement
- [ ] Point count sync < 1 minute
- [ ] Zero manual intervention needed
- [ ] Complete legacy migration
- [ ] User-visible improvements in UI

---

## Key Contacts

- **Database:** [DBA Team]
- **DevOps:** [DevOps Team]
- **QA:** [QA Team]
- **Product:** [Product Owner]
- **On-Call:** [Rotation Schedule]

---

## Reference Documents

- **Plan 1:** [Current Architecture Analysis](./plan1-current-architecture.md)
- **Plan 2:** [Proposed Architecture](./plan2-proposed-architecture.md)
- **Plan 3:** [Implementation Guide](./plan3-implementation.md)
- **Plan 4:** [Summary & Next Steps](./plan4-summary.md)
- **Plan 5:** [Incremental Sync Integration](./plan5-incremental-sync-integration.md)
- **Plan 6:** [Solutions Summary](./plan6-solutions-summary.md)

---

**Last Review:** November 5, 2025  
**Next Review:** After Phase 3 completion  
**Status:** 🚀 Ready for Implementation
