# 🏝️ Island Architecture - Project-Scoped Knowledge Organization

> **⚠️ CRITICAL UPDATE:** Reality check completed - PARTIAL implementation found!
>
> **🔴 READ FIRST:** [REALITY-CHECK.md](./REALITY-CHECK.md) - Documents actual vs planned status
>
> **Status:** Crawl4AI service ✅ implemented, TypeScript core ❌ not implemented
>
> **Updated Timeline:** 1-2 weeks to align TypeScript core with Python implementation

---

## 🚨 Reality Check Summary

### ✅ What IS Implemented (Crawl4AI Python Service)
- **ScopeManager** - Fully working with 3-tier scope (global/project/local)
- **Name-based collections** - `project_{name}_dataset_{name}` format
- **Web content ingestion** - Uses ScopeManager for proper isolation
- **CanonicalMetadataStore** - Syncs to Postgres (projects, datasets, web_pages, chunks)

### ❌ What's NOT Implemented (TypeScript Core)
- **Context.ts** - Still uses MD5 hash-based naming (`hybrid_code_chunks_{hash}`)
- **Query logic** - Searches ALL collections, no project scoping
- **dataset_collections table** - Does NOT exist in schema
- **CollectionManager class** - Does NOT exist
- **deleteFileChunks** - Stub implementation (returns 0)
- **Context.indexWebPages** - Stub implementation
- **indexed_files.collection_name** - Column does NOT exist

### 🔄 Architecture Inconsistency Found
- Crawl4AI: `project_{name}_dataset_{name}` (NAME-based)
- TypeScript: `hybrid_code_chunks_{MD5}` (PATH-based)
- Plan: `proj_{UUID}_{UUID}` (UUID-based)

**See [REALITY-CHECK.md](./REALITY-CHECK.md) for complete analysis**

---

## Overview

The **Island Architecture** is a comprehensive redesign of how projects, datasets, and Qdrant collections are organized and queried in the Claude Context system.

**Core Concept:** The entire system (API + Qdrant + Postgres) is "the island," with each **project** being a distinct **section** of that island, containing multiple **datasets** (codebases, repos, crawled docs).

---

## 📚 Documentation Structure

### ⚠️ START HERE: Updated Plans After Reality Check

**📖 Required Reading (in order):**
1. [SUMMARY-NOV-5-2025.md](./SUMMARY-NOV-5-2025.md) - 📊 Executive summary
2. [REALITY-CHECK.md](./REALITY-CHECK.md) - 🔍 Detailed analysis of actual vs planned
3. [plan7-corrected-implementation.md](./plan7-corrected-implementation.md) - ⭐ CORRECTED implementation guide
4. [IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md) - ✅ Task breakdown
5. [NEXT-ACTIONS.md](./NEXT-ACTIONS.md) - 🚀 Immediate next steps

**📝 Phase Completion Reports:**
1. [PHASE-3-COMPLETE.md](./PHASE-3-COMPLETE.md) - ✅ Context.ts Integration
2. [PHASE-4-COMPLETE.md](./PHASE-4-COMPLETE.md) - ✅ deleteFileChunks Implementation
3. [PHASE-5-COMPLETE.md](./PHASE-5-COMPLETE.md) - ✅ Query Logic (Project-Scoped)
4. [PHASE-6-COMPLETE.md](./PHASE-6-COMPLETE.md) - ✅ indexWebPages Implementation
5. [PHASE-7-COMPLETE.md](./PHASE-7-COMPLETE.md) - ✅ Integration Testing & Documentation

**📚 Production Documentation:**
1. [MIGRATION-GUIDE.md](../migration/MIGRATION-GUIDE.md) - Step-by-step upgrade instructions
2. [DEPLOYMENT-RUNBOOK.md](../deployment/DEPLOYMENT-RUNBOOK.md) - Production deployment procedures

### 📖 Original Plans (Reference Only)

Read the original plans for context:

### [Plan 1: Current Architecture Analysis](./plan1-current-architecture.md)
**What's covered:**
- Current database schema (Postgres)
- Current collection naming (Qdrant)
- Problems with path-based collections
- Why queries search too broadly
- What works well in current design

**Key findings:**
- ❌ Collections named by path hash, not project
- ❌ Queries search ALL collections
- ❌ No clear collection → project mapping
- ✅ Good: Project/dataset hierarchy in Postgres
- ✅ Good: Access control via `project_shares`

---

### [Plan 2: Proposed Architecture](./plan2-proposed-architecture.md)
**What's covered:**
- New collection naming: `project_{NAME}_{DATASET}`
- New database table: `dataset_collections`
- Project-scoped query logic
- Global vs local dataset semantics
- Dataset sharing and import/export

**Key changes:**
- ✅ One collection per dataset
- ✅ Semantic collection names
- ✅ Explicit collection tracking in database
- ✅ Query only searches project's collections
- ✅ Easy global dataset sharing

---

### [Plan 3: Implementation Guide](./plan3-implementation.md)
**What's covered:**
- Phase 1: Database schema updates
- Phase 2: Collection management utilities
- Phase 3: Indexing logic updates
- Phase 4: Query logic updates
- Phase 5: Migration tools
- Phase 6: API endpoint updates

**Code included:**
- SQL migration scripts
- TypeScript utility classes
- Updated indexing functions
- Updated query functions
- Legacy collection migration tool

---

### [Plan 4: Summary & Next Steps](./plan4-summary.md)
**What's covered:**
- TL;DR of the entire architecture
- Key changes summary
- Benefits for users, developers, system
- Implementation checklist
- Migration strategies (3 options)
- Performance considerations
- Security & access control
- Monitoring & observability
- Troubleshooting guide
- Future enhancements
- Timeline and next actions

**Recommended reading:** Start here for quick overview!

---

### [Plan 5: Incremental Sync Integration](./plan5-incremental-sync-integration.md)
**What's covered:**
- Integration with auto-sync feature
- Adding `collection_name` to `indexed_files` table
- Updated sync logic for correct collection targeting
- Backfill migration for existing data
- File watcher integration
- Testing checklist

**Key fixes:**
- ✅ Sync knows which collection to update
- ✅ Targeted chunk deletion (no multi-collection scans)
- ✅ Complete data lineage tracking

---

### [Plan 6: Solutions Summary](./plan6-solutions-summary.md)
**What's covered:**
- All 12 issues identified and resolved
- Critical fixes: UUID-based naming, error recovery, sync integration
- Design improvements: Removed redundancy, clarified ownership
- Implementation details for each solution
- Complete changes summary
- Updated implementation checklist

**Status:** 🎉 **ALL ISSUES RESOLVED - READY FOR IMPLEMENTATION**

**Key wins:**
- 🔴 3 critical issues fixed
- ⚠️ 6 medium issues resolved
- 💡 3 clarifications documented

---

## Quick Reference

### The Problem
```
Current: hybrid_code_chunks_8c069df5  ← What project? What dataset?
Query searches ALL collections → Slow, wrong scope
```

### The Solution
```
New: proj_a1b2c3d4_e5f6g7h8  ← Immutable UUID-based (survives renames)
Display: "MyApp Frontend"    ← Human-readable (cached in database)
Query searches ONLY project's collections → Fast, correct scope
```

### Database Change
```sql
CREATE TABLE dataset_collections (
  dataset_id → collection_name (1:1 mapping)
  + display_name (human-readable)
  + project_name, dataset_name (cached)
  + point_count, last_sync
);

-- Links to incremental sync
ALTER TABLE indexed_files
ADD COLUMN collection_name TEXT;
```

### Query Change
```typescript
// Before: Search ALL
const all = await listCollections();

// After: Search ONLY project's collections
const datasets = await getAccessibleDatasets(projectId);
const collections = await getCollectionsForDatasets(datasets);
// No project_id filter needed - already scoped!
```

### Key Improvements
- ✅ **Immutable names** - UUIDs never change
- ✅ **Error recovery** - Transactions prevent partial failures
- ✅ **Sync integration** - Works with auto-sync feature
- ✅ **No collisions** - UUID uniqueness guaranteed
- ✅ **Debuggable** - Display names for humans, UUIDs for system

---

## Key Benefits

### Performance
- **5-10x faster queries** for typical projects
- **50-100x faster** for large multi-project deployments
- No unnecessary collection scans

### Organization
- Clear project → dataset → collection hierarchy
- Human-readable collection names
- Easy to debug and maintain

### Features
- Global datasets (shared across all projects)
- Dataset sharing (between specific projects)
- Import/export datasets
- Per-project isolation

---

## Migration Strategies

### Option A: Big Bang (Small Deployments)
1. Backup
2. Run migration
3. Deploy new code
4. Verify

### Option B: Gradual (Production) ✅ Recommended
1. Deploy new tables (backwards compatible)
2. Deploy code with fallback logic
3. Migrate existing collections
4. Remove compatibility layer

### Option C: Dual Mode (Maximum Safety)
1. Support both formats simultaneously
2. Environment variable controls format
3. Migrate incrementally
4. Deprecate legacy format

---

## Implementation Checklist

**Database** (1-2 days)
- [ ] Create `dataset_collections` table
- [ ] Add metadata columns to `datasets`
- [ ] Run migration script

**Core Library** (3-5 days)
- [ ] `collection-names.ts` - Name generation
- [ ] `collection-manager.ts` - CRUD operations
- [ ] Update `Context.indexWithProject()`
- [ ] Update `api/query.ts`

**API Server** (2-3 days)
- [ ] Update indexing endpoints
- [ ] Update query endpoints
- [ ] Add collection management endpoints

**Testing** (2-3 days)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Migration tests

**Total:** ~2 weeks

---

## Architecture Diagrams

### Current (Path-Based Collections)
```
Projects ─┬─ Project A ─┬─ Dataset "frontend" (/path/frontend)
          │             └─ Dataset "backend" (/path/backend)
          │
          └─ Project B ─── Dataset "app" (/path/frontend)  ← COLLISION!

Qdrant ───┬─ hybrid_code_chunks_abc123 (/path/frontend)
          └─ hybrid_code_chunks_def456 (/path/backend)

Problem: Project A and B both use /path/frontend → SAME COLLECTION!
```

### Proposed (Project-Based Collections)
```
Projects ─┬─ Project A ─┬─ Dataset "frontend"
          │             └─ Dataset "backend"
          │
          └─ Project B ─── Dataset "app"

Qdrant ───┬─ project_a_frontend
          ├─ project_a_backend
          └─ project_b_app

Solution: Each dataset has unique collection tied to project!
```

### Query Flow (New)
```
User Query: "auth logic" in Project A
     │
     ▼
[Get Project A ID]
     │
     ▼
[Get Accessible Datasets]
  - Dataset "frontend" (owned)
  - Dataset "backend" (owned)
  - Dataset "common" (global)
     │
     ▼
[Get Collections]
  - project_a_frontend
  - project_a_backend
  - project_global_common
     │
     ▼
[Search Collections]
     │
     ▼
[Rank & Return Results]
```

---

## File Locations (After Implementation)

```
src/
├── utils/
│   ├── collection-names.ts        ← NEW: Collection name utilities
│   ├── collection-manager.ts      ← NEW: Collection CRUD operations
│   └── project-helpers.ts         ← EXISTS: Project/dataset helpers

services/
├── init-scripts/
│   └── 04-dataset-collections.sql ← NEW: Schema migration
└── api-server/src/routes/
    └── projects.ts                ← UPDATED: Use CollectionManager

scripts/
├── migrate-collection-tracking.sh     ← NEW: Run migration
├── migrate-legacy-collections.ts      ← NEW: Migrate old collections
└── audit-collections.ts               ← NEW: Verify integrity

docs/
└── island-plan/
    ├── README.md                      ← YOU ARE HERE
    ├── plan1-current-architecture.md
    ├── plan2-proposed-architecture.md
    ├── plan3-implementation.md
    └── plan4-summary.md
```

---

## Questions & Feedback

**Before implementing, discuss:**

1. **Naming:** `project_{NAME}_{DATASET}` or `proj_{UUID}_{UUID}`?
2. **Migration:** Gradual (Option B) or Big Bang (Option A)?
3. **Legacy:** Keep old collections or rename?
4. **Timeline:** 2 weeks realistic?
5. **Priorities:** Any must-have features to add?

---

## Next Steps

### Immediate
1. ✅ Review all 4 plans
2. [ ] Team discussion on architecture decisions
3. [ ] Decide on migration strategy
4. [ ] Prioritize implementation phases

### This Week
1. [ ] Create database migration
2. [ ] Implement collection utilities
3. [ ] Write unit tests

### Next 2 Weeks
1. [ ] Update core library
2. [ ] Update API server
3. [ ] Integration testing
4. [ ] Deploy to dev environment

### Production
1. [ ] Staging deployment
2. [ ] Migration testing
3. [ ] Performance validation
4. [ ] Production rollout

---

## Related Documentation

- **Current Architecture:** See `docs/ARCHITECTURE.md` (if exists)
- **Database Schema:** See `services/init-scripts/02-init-schema.sql`
- **API Endpoints:** See `services/api-server/README.md`
- **Query Logic:** See `src/api/query.ts`
- **Incremental Sync:** See `docs/incremental-sync/INCREMENTAL-SYNC-SUMMARY.md`

---

## Author & Contact

**Created:** November 5, 2025  
**Purpose:** Implement project-scoped knowledge organization  
**Status:** 📋 Planning Phase  

**Feedback:** Review plans and provide feedback on architecture decisions

---

**Ready to implement?** Start with **Plan 4** for overview, then follow **Plan 3** for step-by-step implementation guide.
