# Island Architecture - Immediate Next Actions

**Date:** November 5, 2025  
**Priority:** HIGH  
**Est. Completion:** 1-2 weeks

---

## 🚀 Quick Start Guide

If you're ready to begin implementation, follow these steps in order:

### 1. Review & Approve (1-2 hours)

**Read these documents:**
- [ ] [REALITY-CHECK.md](./REALITY-CHECK.md) - Understand current state
- [ ] [plan7-corrected-implementation.md](./plan7-corrected-implementation.md) - Review new plan
- [ ] [SUMMARY-NOV-5-2025.md](./SUMMARY-NOV-5-2025.md) - Executive summary

**Team alignment:**
- [ ] Share documents with team
- [ ] Discuss NAME-based vs UUID-based approach
- [ ] Approve corrected implementation path
- [ ] Assign developers to phases

---

## 📅 Week 1: Foundation (Days 1-5)

### Day 1-2: Port ScopeManager (8-12 hours)

**Task:** Create TypeScript version of Python ScopeManager

**Files to create:**
```
src/utils/scope-manager.ts          # Core implementation
src/utils/scope-manager.spec.ts     # Unit tests
```

**Implementation steps:**
1. Create `ScopeLevel` enum (GLOBAL, PROJECT, LOCAL)
2. Implement `resolveScope()` method
3. Implement `getCollectionName()` - NAME-based
4. Implement `getProjectId()` - deterministic uuid5
5. Implement `getDatasetId()` - deterministic uuid5
6. Implement private `sanitizeName()` helper
7. Write comprehensive tests

**Commands:**
```bash
# Create files
touch src/utils/scope-manager.ts
touch src/utils/scope-manager.spec.ts

# Run tests
npm run test -- src/utils/scope-manager.spec.ts

# Build
npm run build
```

**Acceptance criteria:**
- ✅ All tests pass
- ✅ Collection names match Python format
- ✅ UUIDs are deterministic (same input = same output)
- ✅ Sanitization works correctly

**Reference:**
- Python implementation: `services/crawl4ai-runner/app/storage/scope_manager.py`
- Plan section: plan7 Phase 1

---

### Day 3: Database Migrations (4-6 hours)

**Task:** Add missing tables and columns

**Scripts to create:**
```
scripts/migrate-add-dataset-collections.sh
scripts/migrate-add-collection-to-indexed-files.sh
scripts/backfill-collection-names.ts
```

#### Step 3.1: Create dataset_collections table

```bash
# Create migration script
cat > scripts/migrate-add-dataset-collections.sh << 'EOF'
#!/bin/bash
psql -h localhost -U postgres -p 5533 -d claude_context << SQL
CREATE TABLE IF NOT EXISTS claude_context.dataset_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES claude_context.datasets(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL UNIQUE,
  vector_db_type TEXT NOT NULL DEFAULT 'qdrant',
  dimension INTEGER NOT NULL DEFAULT 768,
  is_hybrid BOOLEAN NOT NULL DEFAULT true,
  point_count BIGINT NOT NULL DEFAULT 0,
  last_indexed_at TIMESTAMPTZ,
  last_point_count_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_collection_per_dataset UNIQUE(dataset_id)
);

CREATE INDEX IF NOT EXISTS dataset_collections_dataset_idx 
  ON claude_context.dataset_collections(dataset_id);
  
CREATE INDEX IF NOT EXISTS dataset_collections_name_idx 
  ON claude_context.dataset_collections(collection_name);
SQL
EOF

chmod +x scripts/migrate-add-dataset-collections.sh
./scripts/migrate-add-dataset-collections.sh
```

#### Step 3.2: Add collection_name to indexed_files

```bash
cat > scripts/migrate-add-collection-to-indexed-files.sh << 'EOF'
#!/bin/bash
psql -h localhost -U postgres -p 5533 -d claude_context << SQL
ALTER TABLE claude_context.indexed_files
ADD COLUMN IF NOT EXISTS collection_name TEXT;

CREATE INDEX IF NOT EXISTS idx_indexed_files_collection
  ON claude_context.indexed_files(collection_name);
SQL
EOF

chmod +x scripts/migrate-add-collection-to-indexed-files.sh
./scripts/migrate-add-collection-to-indexed-files.sh
```

#### Step 3.3: Backfill collection_name

See plan7 Phase 2.3 for backfill script implementation.

**Verification:**
```bash
# Check tables exist
psql -h localhost -U postgres -p 5533 -d claude_context -c \
  "\\d claude_context.dataset_collections"

psql -h localhost -U postgres -p 5533 -d claude_context -c \
  "\\d claude_context.indexed_files" | grep collection_name

# Check backfill completed
psql -h localhost -U postgres -p 5533 -d claude_context -c \
  "SELECT COUNT(*) FROM claude_context.indexed_files WHERE collection_name IS NULL"
# Expected: 0
```

---

### Days 4-5: Update Context.ts (6-8 hours)

**Task:** Integrate ScopeManager into Context class

**File to modify:**
```
src/context.ts
```

**Changes needed:**

1. **Import ScopeManager:**
```typescript
import { ScopeManager, ScopeLevel } from './utils/scope-manager';
```

2. **Add instance variable:**
```typescript
export class Context {
  private scopeManager: ScopeManager;
  // ... existing variables
```

3. **Initialize in constructor:**
```typescript
constructor(config: ContextConfig) {
  // ... existing code
  this.scopeManager = new ScopeManager();
}
```

4. **Add new method:**
```typescript
/**
 * Generate collection name using ScopeManager (NEW)
 */
private getCollectionNameScoped(
  project: string,
  dataset: string
): string {
  return this.scopeManager.getCollectionName(project, dataset);
}
```

5. **Deprecate old method:**
```typescript
/**
 * @deprecated Use getCollectionNameScoped instead
 * Kept for backward compatibility
 */
public getCollectionName(codebasePath: string): string {
  // Keep existing MD5-based implementation
}
```

**Testing:**
```bash
npm run build
npm run test
npm run typecheck
```

**Acceptance criteria:**
- ✅ Code compiles without errors
- ✅ All existing tests pass
- ✅ New method generates correct collection names
- ✅ Old method still works (backward compat)

---

## 📅 Week 2: Core Features (Days 1-4)

### Day 1: Implement deleteFileChunks (4-6 hours)

**Task:** Actually delete chunks from vector DB

**File to modify:**
```
src/sync/incremental-sync.ts
src/vectordb/qdrant.ts (add deleteByFilter method)
```

**See plan7 Phase 5 for implementation details**

---

### Days 2-3: Update Query Logic (6-8 hours)

**Task:** Project-scoped queries

**Files to modify:**
```
src/api/query.ts
```

**Add helper function:**
```typescript
async function getProjectCollections(
  pool: Pool,
  projectId?: string,
  datasetId?: string
): Promise<string[]>
```

**See plan7 Phase 6 for implementation details**

---

### Day 4: Implement indexWebPages (4-6 hours)

**Task:** Full web page indexing with ScopeManager

**File to modify:**
```
src/context.ts
```

**See plan7 Phase 7 for implementation details**

---

## 🧪 Testing Checklist

After each phase, verify:

**Phase 1 (ScopeManager):**
```bash
npm run test -- src/utils/scope-manager.spec.ts
```

**Phase 2 (Database):**
```bash
psql -h localhost -U postgres -p 5533 -d claude_context
\dt claude_context.*
\d claude_context.dataset_collections
\d claude_context.indexed_files
```

**Phase 3 (Context):**
```bash
npm run build
npm run test
npm run typecheck
```

**Phase 4-7 (Features):**
```bash
npm run test
# Run integration tests
# Test incremental sync
# Test queries
# Test web ingestion
```

---

## 📊 Progress Tracking

Create a GitHub issue or project board with these tasks:

**Milestone 1: Foundation (Week 1)**
- [ ] Port ScopeManager to TypeScript
- [ ] Create dataset_collections table
- [ ] Add collection_name to indexed_files
- [ ] Backfill collection_name
- [ ] Update Context.ts

**Milestone 2: Core Features (Week 2)**
- [ ] Implement deleteFileChunks
- [ ] Update query logic
- [ ] Implement indexWebPages
- [ ] Integration testing
- [ ] Documentation

**Milestone 3: Polish (Week 3, optional)**
- [ ] Migration tool for old collections
- [ ] Performance testing
- [ ] Update API documentation
- [ ] User guides

---

## 🆘 Support & Questions

**If you get stuck:**

1. **Check Python implementation:** `services/crawl4ai-runner/app/storage/scope_manager.py`
2. **Review plan7:** Detailed implementation with code examples
3. **Read REALITY-CHECK:** Understand what's working vs what's not
4. **Ask team:** Schedule pairing session if needed

**Common issues:**

| Issue | Solution |
|-------|----------|
| Tests failing | Check Python implementation for correct logic |
| Collection names wrong | Verify sanitization matches Python regex |
| UUIDs not deterministic | Use uuid5 with DNS_NAMESPACE constant |
| Database migrations fail | Check for existing tables/columns first |
| Backward compat broken | Keep old getCollectionName() method |

---

## ✅ Definition of Done

**Week 1 complete when:**
- [ ] ScopeManager tests at 100% coverage
- [ ] Database migrations run successfully
- [ ] Context.ts builds without errors
- [ ] All existing tests still pass
- [ ] Code review completed

**Week 2 complete when:**
- [ ] deleteFileChunks actually deletes chunks
- [ ] Queries scoped to project/dataset
- [ ] indexWebPages works end-to-end
- [ ] Integration tests pass
- [ ] Performance benchmarks acceptable

**Ready for production when:**
- [ ] All acceptance criteria met
- [ ] Documentation updated
- [ ] Migration guide written
- [ ] Team training completed
- [ ] Rollout plan approved

---

## 🎯 Success Metrics

After implementation, measure:

1. **Query Performance:**
   - Baseline: Current query time for multi-project setup
   - Target: 80% reduction in query time

2. **Storage Efficiency:**
   - Baseline: Orphaned chunks from modified files
   - Target: 0 orphaned chunks

3. **Developer Experience:**
   - Collection names are human-readable
   - Easy to debug which dataset owns which collection
   - Clear project/dataset isolation

4. **Backward Compatibility:**
   - Old collections still work
   - No breaking changes for existing users
   - Migration is opt-in, not forced

---

## 📝 Daily Standup Template

**Today's Goal:**
- [ ] [Specific task from checklist]

**Blockers:**
- None / [List any blockers]

**Questions:**
- [Any questions for team]

**Tomorrow:**
- [ ] [Next task]

---

## 🎉 You're Ready!

Start with **Day 1-2: Port ScopeManager** and work through the checklist.

Good luck! 🚀
