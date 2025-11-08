# Island Architecture Migration Guide

**Version:** 1.0  
**Date:** November 5, 2025  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Migration Strategies](#migration-strategies)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Verification](#verification)
6. [Rollback Procedure](#rollback-procedure)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

The Island Architecture is a major redesign of how projects, datasets, and vector collections are organized in the Claude Context system. This guide will help you migrate from the legacy MD5-based collection naming to the new NAME-based Island Architecture.

### What Changed

#### Before (Legacy)
```
Collection Naming: MD5 hash of path
Example: hybrid_code_chunks_a3b2c1d4e5f6...
Problem: Opaque, non-deterministic, hard to debug
```

#### After (Island Architecture)
```
Collection Naming: project_{name}_dataset_{name}
Example: project_myapp_dataset_backend
Benefit: Human-readable, deterministic, project-scoped
```

### Key Benefits

- **5-10x faster queries** (searches only relevant collections)
- **Project isolation** (no cross-contamination)
- **Human-readable** collection names
- **Deterministic** UUIDs for projects/datasets
- **Backward compatible** (legacy mode fallback)

---

## Prerequisites

### System Requirements

- **PostgreSQL**: 12+ with pgvector extension
- **Qdrant**: 1.0+
- **Node.js**: 18+
- **Disk Space**: 20% free (for temporary migration data)

### Backup Requirements

**CRITICAL**: Backup before migrating!

```bash
# 1. Backup PostgreSQL
pg_dump -h localhost -U postgres -p 5533 -d claude_context > backup_$(date +%Y%m%d).sql

# 2. Backup Qdrant (optional but recommended)
# Qdrant snapshots: http://localhost:6333/snapshots
curl -X POST http://localhost:6333/snapshots
```

### Version Compatibility

| Component | Minimum Version | Recommended |
|-----------|----------------|-------------|
| PostgreSQL | 12.0 | 15+ |
| Qdrant | 1.0.0 | 1.7+ |
| Node.js | 18.0 | 20 LTS |
| TypeScript | 5.0 | 5.3+ |

---

## Migration Strategies

### Option A: Green field (New Installations) ✅ Recommended

**When to use:**
- New deployment
- Empty database
- No existing data

**Steps:**
1. Install with migrations
2. Start using Island Architecture immediately
3. No migration needed

**Estimated Time:** 30 minutes

---

### Option B: Blue-Green Deployment (Zero Downtime)

**When to use:**
- Production system with existing data
- Zero downtime required
- High availability needs

**Steps:**
1. Deploy new version alongside old
2. Migrate data in background
3. Switch traffic when ready
4. Decommission old system

**Estimated Time:** 4-8 hours

**Pros:**
- ✅ Zero downtime
- ✅ Easy rollback
- ✅ Test in production

**Cons:**
- ❌ Requires double resources temporarily
- ❌ More complex setup

---

### Option C: In-Place Migration (Planned Downtime) ✅ Recommended

**When to use:**
- Can afford brief downtime (30-60 minutes)
- Want simplest migration path
- Medium-sized datasets

**Steps:**
1. Schedule maintenance window
2. Stop services
3. Run migrations
4. Start new version
5. Verify

**Estimated Time:** 1-2 hours

**Pros:**
- ✅ Simplest approach
- ✅ No double resources
- ✅ Clean cutover

**Cons:**
- ❌ Downtime required
- ❌ Harder rollback

---

## Step-by-Step Migration

### Phase 1: Pre-Migration (30 minutes)

#### 1.1 Audit Current State

```bash
# Check PostgreSQL connection
psql -h localhost -U postgres -p 5533 -d claude_context -c "SELECT version();"

# Check Qdrant connection
curl http://localhost:6333/health

# Count existing collections
curl http://localhost:6333/collections | jq '.result.collections | length'
```

#### 1.2 Backup Everything

```bash
# PostgreSQL backup
export PGPASSWORD="code-context-secure-password"
pg_dump -h localhost -U postgres -p 5533 \
  -d claude_context \
  --clean --if-exists \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

#### 1.3 Review Migration Plan

**Estimated downtime:** 30-60 minutes

**Services to stop:**
- API Server (port 3030)
- Background workers
- Any sync jobs

**Database changes:**
- Add `dataset_collections` table
- Add `projects` table enhancements
- Add `datasets` table enhancements

---

### Phase 2: Stop Services (5 minutes)

```bash
# Stop Docker services
cd /path/to/claude-context-core
docker-compose stop api-server

# Or stop all services
docker-compose down

# Verify nothing is running
docker-compose ps
# Should show all services as stopped or exit
```

---

### Phase 3: Run Database Migrations (10 minutes)

#### 3.1 Apply Migrations

```bash
cd /path/to/claude-context-core

# Run Phase 2 migrations
psql -h localhost -U postgres -p 5533 \
  -d claude_context \
  -f services/init-scripts/002-island-architecture.sql
```

#### 3.2 Verify Schema

```sql
-- Connect to database
\c claude_context

-- Check tables exist
\dt claude_context.*

-- Check dataset_collections table
\d claude_context.dataset_collections

-- Should show:
--  id | dataset_id | collection_name | vector_db_type | dimension | is_hybrid | point_count | last_indexed_at | created_at | updated_at
```

---

### Phase 4: Deploy New Code (10 minutes)

#### 4.1 Pull Latest Code

```bash
cd /path/to/claude-context-core
git pull origin main

# Or checkout specific version
git checkout v1.2.0
```

#### 4.2 Install Dependencies

```bash
npm install
npm run build
```

#### 4.3 Update Docker Images

```bash
# Rebuild API server (TypeScript changes)
docker-compose build api-server

# Restart Crawl4AI (Python, just restart)
docker-compose restart crawl4ai
```

---

### Phase 5: Start Services (5 minutes)

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f api-server

# Should see:
# [Context] ✅ ScopeManager initialized
# [Server] 🚀 API Server listening on port 3030
```

#### Verify Services Healthy

```bash
# Check all containers
docker-compose ps

# Should show all services as "healthy" or "running"

# Test API endpoint
curl http://localhost:3030/health

# Expected: {"status": "ok", "timestamp": "..."}
```

---

### Phase 6: Verification (20 minutes)

#### 6.1 Test New Collection Creation

```bash
# Index a test web page
curl -X POST http://localhost:3030/projects/test-migration/ingest/web \
  -H "Content-Type: application/json" \
  -d '{
    "pages": [{
      "url": "https://example.com/test",
      "content": "# Test Page\n\nThis is a test.",
      "title": "Test"
    }],
    "dataset": "test-dataset"
  }'

# Expected response:
# {"status": "completed", "processedPages": 1, "totalChunks": 1}
```

#### 6.2 Verify Collection Created

```bash
# Check Qdrant
curl http://localhost:6333/collections | jq '.result.collections[] | select(.name | contains("project_test_migration"))'

# Expected: Collection named "project_test_migration_dataset_test_dataset"

# Check database
psql -h localhost -U postgres -p 5533 -d claude_context -c \
  "SELECT collection_name, point_count FROM claude_context.dataset_collections WHERE collection_name LIKE '%test_migration%';"

# Expected: Row with collection name and point count > 0
```

#### 6.3 Test Query

```bash
# Query the indexed content
curl -X POST http://localhost:3030/projects/test-migration/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test page",
    "topK": 5
  }'

# Expected: Results array with matching content
```

#### 6.4 Verify Project Isolation

```bash
# Create second project
curl -X POST http://localhost:3030/projects/test-migration-2/ingest/web \
  -H "Content-Type: application/json" \
  -d '{
    "pages": [{
      "url": "https://example.com/secret",
      "content": "# Secret Content\n\nThis should be isolated.",
      "title": "Secret"
    }],
    "dataset": "secrets"
  }'

# Query first project
curl -X POST http://localhost:3030/projects/test-migration/query \
  -H "Content-Type: application/json" \
  -d '{"query": "secret content", "topK": 10}'

# Expected: Empty results (no cross-contamination)
```

---

### Phase 7: Cleanup (Optional)

#### 7.1 Remove Test Data

```sql
-- Connect to database
psql -h localhost -U postgres -p 5533 -d claude_context

-- Delete test collections
DELETE FROM claude_context.dataset_collections 
WHERE collection_name LIKE '%test_migration%';

-- Delete test projects
DELETE FROM claude_context.datasets 
WHERE name LIKE 'test-%';

DELETE FROM claude_context.projects 
WHERE name LIKE 'test-migration%';
```

```bash
# Drop Qdrant test collections
curl -X DELETE http://localhost:6333/collections/project_test_migration_dataset_test_dataset
curl -X DELETE http://localhost:6333/collections/project_test_migration_2_dataset_secrets
```

---

## Verification

### Success Criteria

✅ **All services healthy**
```bash
docker-compose ps
# All services show "healthy" or "Up"
```

✅ **New collections follow naming convention**
```bash
curl http://localhost:6333/collections | jq '.result.collections[] | select(.name | startswith("project_"))'
```

✅ **Database tables populated**
```sql
SELECT COUNT(*) FROM claude_context.dataset_collections;
-- Should return > 0 after indexing
```

✅ **Queries work**
```bash
curl -X POST http://localhost:3030/projects/YOUR_PROJECT/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "topK": 5}'
# Should return results
```

✅ **Project isolation enforced**
- Projects don't see each other's data
- Queries only search relevant collections

---

## Rollback Procedure

### If Something Goes Wrong

#### Quick Rollback (10 minutes)

```bash
# 1. Stop new services
docker-compose down

# 2. Restore PostgreSQL backup
export PGPASSWORD="code-context-secure-password"
psql -h localhost -U postgres -p 5533 -d claude_context < backup_YYYYMMDD_HHMMSS.sql

# 3. Checkout previous version
git checkout v1.1.16  # Or your previous version

# 4. Rebuild and restart
npm install
npm run build
docker-compose build api-server
docker-compose up -d

# 5. Verify
curl http://localhost:3030/health
```

#### Verify Rollback

```bash
# Check services
docker-compose ps

# Test old functionality
curl -X POST http://localhost:3030/projects/default/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "topK": 5}'
```

---

## Troubleshooting

### Problem: Migrations fail with "relation already exists"

**Cause:** Migrations already applied

**Solution:**
```sql
-- Check if tables exist
\dt claude_context.*

-- If dataset_collections exists, skip migration
-- Proceed to Phase 4 (Deploy New Code)
```

---

### Problem: Collections not created

**Cause:** PostgreSQL pool not configured

**Solution:**
```bash
# Check .env file
cat .env | grep POSTGRES

# Should have:
# POSTGRES_URL=postgresql://postgres:password@localhost:5533/claude_context

# Restart services
docker-compose restart api-server
```

---

### Problem: Queries return no results

**Cause:** Collection names mismatch

**Solution:**
```bash
# Check Qdrant collections
curl http://localhost:6333/collections

# Check database
psql -h localhost -U postgres -p 5533 -d claude_context \
  -c "SELECT collection_name FROM claude_context.dataset_collections;"

# Names should match between Qdrant and database
```

---

### Problem: "project_id filter" errors

**Cause:** Legacy query logic active

**Solution:**
```bash
# Ensure Phase 5 code is deployed
git log --oneline | head -5

# Should show Phase 5 commit
# If not, pull latest code and rebuild
```

---

## FAQ

### Q: Can I run old and new systems simultaneously?

**A:** Yes, but not recommended. Better to do blue-green deployment if you need zero downtime.

### Q: Will existing data be lost?

**A:** No. The migration is additive. Existing collections remain functional. Legacy mode fallback ensures backward compatibility.

### Q: How long does migration take?

**A:** 
- Green field: 30 minutes
- In-place: 1-2 hours
- Blue-green: 4-8 hours

### Q: Can I migrate incrementally?

**A:** Yes. Phase 5 includes legacy mode fallback. New data uses Island Architecture, old data continues working.

### Q: What if I have custom collection names?

**A:** Custom names are preserved. ScopeManager only affects NEW collections. Existing collections continue using their original names.

### Q: Do I need to reindex everything?

**A:** No. Reindexing is optional. New content will use Island Architecture automatically.

### Q: How do I check migration status?

**A:**
```sql
-- Check collections table
SELECT COUNT(*) FROM claude_context.dataset_collections;

-- Should have records for each indexed dataset
```

### Q: What's the performance impact?

**A:** 
- Queries: **5-10x faster** (typical)
- Indexing: Same speed
- Storage: Same size

### Q: Can I rename projects after migration?

**A:** Not recommended. Project names are part of collection names. Renaming requires recreating collections.

### Q: Is there a migration script?

**A:** Database migrations are in `services/init-scripts/002-island-architecture.sql`. Code changes are automatic (fallback mode).

---

## Summary

### Migration Checklist

- [ ] Backup PostgreSQL database
- [ ] Backup Qdrant snapshots (optional)
- [ ] Review migration plan
- [ ] Schedule maintenance window
- [ ] Stop services
- [ ] Run database migrations
- [ ] Deploy new code
- [ ] Start services
- [ ] Verify new collection creation
- [ ] Test queries
- [ ] Verify project isolation
- [ ] Monitor for 24 hours
- [ ] Clean up test data

### Post-Migration Monitoring

**First 24 hours:**
- Monitor query latency
- Check error rates
- Verify collection creation
- Test project isolation

**First week:**
- Review performance metrics
- Check for edge cases
- Gather user feedback

**First month:**
- Measure query speed improvements
- Analyze storage efficiency
- Plan for legacy data migration (if needed)

---

## Support

**Need help?**
- Check logs: `docker-compose logs -f`
- Review troubleshooting section above
- Open GitHub issue: [link]
- Contact support: [email]

**Resources:**
- [Phase Completion Reports](./island-plan/)
- [Architecture Docs](./island-plan/README.md)
- [Implementation Checklist](./island-plan/IMPLEMENTATION-CHECKLIST.md)

---

**Last Updated:** November 5, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready
