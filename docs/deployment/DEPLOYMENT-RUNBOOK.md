# Island Architecture Deployment Runbook

**Version:** 1.0  
**Date:** November 5, 2025  
**For:** Production & Staging Deployments

---

## 🎯 Quick Reference

| Environment | URL | Database Port | Qdrant Port |
|-------------|-----|---------------|-------------|
| **Production** | https://api.prod.example.com | 5432 | 6333 |
| **Staging** | https://api.staging.example.com | 5432 | 6333 |
| **Local** | http://localhost:3030 | 5533 | 6333 |

---

## 📋 Pre-Deployment Checklist

### Code Review
- [ ] All Phase 1-6 tests passing
- [ ] Integration tests passing
- [ ] Build successful (`npm run build`)
- [ ] Type-check clean (`npm run typecheck`)
- [ ] Lint passing (`npm run lint`)

### Infrastructure
- [ ] PostgreSQL backup completed
- [ ] Qdrant snapshot created (optional)
- [ ] Disk space > 20% free
- [ ] Resource monitoring active

### Team Communication
- [ ] Deployment window scheduled
- [ ] Team notified
- [ ] Rollback plan reviewed
- [ ] On-call engineer identified

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment Verification (15 min)

#### 1.1 Check Current State

```bash
# SSH to server
ssh user@production-server

# Navigate to project
cd /opt/claude-context

# Check current version
git log --oneline | head -3

# Check running services
docker-compose ps

# Check resource usage
df -h
free -h
```

#### 1.2 Create Backup

```bash
# Database backup
export BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
export PGPASSWORD="$POSTGRES_PASSWORD"

pg_dump -h postgres -U postgres -d claude_context \
  --clean --if-exists \
  > "/backups/$BACKUP_FILE"

# Verify backup
ls -lh "/backups/$BACKUP_FILE"

# Optional: Qdrant snapshot
curl -X POST http://qdrant:6333/snapshots
```

#### 1.3 Health Check

```bash
# API Server
curl http://localhost:3030/health

# Qdrant
curl http://localhost:6333/health

# PostgreSQL
psql -h postgres -U postgres -d claude_context -c "SELECT version();"

# All should return success
```

---

### Step 2: Stop Services (5 min)

```bash
# Graceful shutdown - allow current requests to finish
docker-compose stop api-server

# Wait for shutdown
sleep 10

# Verify stopped
docker-compose ps | grep api-server
# Should show "Exit 0" or "Exited"

# Optional: Stop all services for major updates
# docker-compose down
```

---

### Step 3: Deploy New Code (10 min)

#### 3.1 Pull Latest Code

```bash
# Fetch latest
git fetch origin

# Checkout release version
git checkout v1.2.0

# Or main branch for latest
# git checkout main
# git pull origin main

# Verify version
git log --oneline | head -1
```

#### 3.2 Install Dependencies

```bash
# Install Node.js dependencies
npm ci  # Use ci for production (uses package-lock.json)

# Build TypeScript
npm run build

# Verify build
ls -l dist/
```

#### 3.3 Run Database Migrations

```bash
# Check if migrations needed
psql -h postgres -U postgres -d claude_context \
  -c "\dt claude_context.dataset_collections"

# If table doesn't exist, run migration
psql -h postgres -U postgres -d claude_context \
  -f services/init-scripts/002-island-architecture.sql

# Verify migration
psql -h postgres -U postgres -d claude_context \
  -c "SELECT COUNT(*) FROM claude_context.projects;"
```

---

### Step 4: Build & Deploy Containers (15 min)

#### 4.1 Build Docker Images

```bash
# Build API server (TypeScript changes)
docker-compose build api-server

# Tag for version tracking
docker tag services-api-server:latest services-api-server:v1.2.0

# Optional: Build other services if needed
# docker-compose build crawl4ai
```

#### 4.2 Update Configuration

```bash
# Review .env file
cat .env

# Should have:
# POSTGRES_URL=postgresql://postgres:PASSWORD@postgres:5432/claude_context
# QDRANT_URL=http://qdrant:6333
# EMBEDDING_URL=http://host.docker.internal:30001
# ENABLE_HYBRID_SEARCH=true
# ENABLE_RERANKING=true

# Update if needed
nano .env
```

---

### Step 5: Start Services (5 min)

```bash
# Start API server
docker-compose up -d api-server

# Watch logs
docker-compose logs -f api-server

# Should see:
# [Context] ✅ ScopeManager initialized
# [Server] 🚀 API Server listening on port 3030

# Press Ctrl+C to exit logs

# Start other services if stopped
docker-compose up -d
```

---

### Step 6: Post-Deployment Verification (20 min)

#### 6.1 Health Checks

```bash
# API Server health
curl http://localhost:3030/health
# Expected: {"status":"ok","timestamp":"..."}

# Check all services
docker-compose ps
# All should show "healthy" or "Up"

# Check logs for errors
docker-compose logs --tail=50 api-server | grep -i error
# Should be empty or only old errors
```

#### 6.2 Smoke Tests

**Test 1: Create Test Project**
```bash
curl -X POST http://localhost:3030/projects/smoke-test/ingest/web \
  -H "Content-Type: application/json" \
  -d '{
    "pages": [{
      "url": "https://example.com/smoke",
      "content": "# Smoke Test\n\nThis is a deployment smoke test.",
      "title": "Smoke Test"
    }],
    "dataset": "smoke-test-dataset"
  }'

# Expected: {"status":"completed","processedPages":1,"totalChunks":1}
```

**Test 2: Verify Collection Created**
```bash
# Check Qdrant
curl http://localhost:6333/collections | \
  jq '.result.collections[] | select(.name | contains("smoke_test"))'

# Expected: Collection object with name "project_smoke_test_dataset_smoke_test_dataset"

# Check database
psql -h postgres -U postgres -d claude_context -c \
  "SELECT collection_name, point_count FROM claude_context.dataset_collections WHERE collection_name LIKE '%smoke_test%';"

# Expected: One row with point_count > 0
```

**Test 3: Query Data**
```bash
curl -X POST http://localhost:3030/projects/smoke-test/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "smoke test deployment",
    "topK": 5
  }'

# Expected: {"results":[...], "totalResults":1}
```

**Test 4: Project Isolation**
```bash
# Query different project (should not see smoke-test data)
curl -X POST http://localhost:3030/projects/default/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "smoke test deployment",
    "topK": 10
  }'

# Expected: Empty results or results from "default" project only
```

#### 6.3 Performance Check

```bash
# Measure query latency
time curl -X POST http://localhost:3030/projects/smoke-test/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "topK": 10}'

# Should complete in < 2 seconds for small dataset
```

#### 6.4 Cleanup Smoke Test

```bash
# Delete test data
curl -X DELETE http://localhost:6333/collections/project_smoke_test_dataset_smoke_test_dataset

psql -h postgres -U postgres -d claude_context <<EOF
DELETE FROM claude_context.dataset_collections WHERE collection_name LIKE '%smoke_test%';
DELETE FROM claude_context.datasets WHERE name = 'smoke-test-dataset';
DELETE FROM claude_context.projects WHERE name = 'smoke-test';
EOF
```

---

### Step 7: Enable Monitoring (10 min)

#### 7.1 Check Metrics

```bash
# Docker stats
docker stats --no-stream

# PostgreSQL connections
psql -h postgres -U postgres -d claude_context -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = 'claude_context';"

# Qdrant collection count
curl http://localhost:6333/collections | jq '.result.collections | length'
```

#### 7.2 Set Up Alerts (if not already configured)

```bash
# Example: Monitor API server health
watch -n 30 'curl -s http://localhost:3030/health || echo "API DOWN"'

# Example: Monitor disk space
watch -n 60 'df -h | grep -E "Filesystem|/opt"'
```

---

## 🔍 Post-Deployment Monitoring

### First Hour

**Monitor every 5 minutes:**
- [ ] API server responding
- [ ] No error spikes in logs
- [ ] Resource usage normal
- [ ] Query latency acceptable

```bash
# Quick health check script
while true; do
  clear
  echo "=== Health Check $(date) ==="
  echo ""
  echo "API Health:"
  curl -s http://localhost:3030/health | jq .
  echo ""
  echo "Docker Status:"
  docker-compose ps | grep -E "api-server|postgres|qdrant"
  echo ""
  echo "Recent Errors:"
  docker-compose logs --tail=10 api-server | grep -i error || echo "No errors"
  sleep 300  # 5 minutes
done
```

### First 24 Hours

**Check once per hour:**
- [ ] Error rate < 1%
- [ ] Query latency < 2s (p95)
- [ ] Memory usage stable
- [ ] Disk space not growing unexpectedly

**Metrics to track:**
```sql
-- Query performance
SELECT 
  COUNT(*) as total_queries,
  AVG(query_time_ms) as avg_time,
  MAX(query_time_ms) as max_time
FROM query_logs
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Collection count
SELECT COUNT(*) FROM claude_context.dataset_collections;

-- Active projects
SELECT COUNT(DISTINCT project_id) FROM claude_context.datasets;
```

### First Week

**Daily checks:**
- [ ] No memory leaks (memory usage stable)
- [ ] Disk space growth rate normal
- [ ] Query performance within SLAs
- [ ] No unusual error patterns

---

## 🚨 Rollback Procedure

### When to Rollback

- API server won't start
- Critical errors in logs
- Data corruption detected
- Performance unacceptable
- User-facing issues

### Quick Rollback (10 minutes)

```bash
# 1. Stop current services
docker-compose down

# 2. Restore database
export PGPASSWORD="$POSTGRES_PASSWORD"
psql -h postgres -U postgres -d claude_context < "/backups/$BACKUP_FILE"

# 3. Checkout previous version
git checkout v1.1.16  # Or your previous version tag

# 4. Rebuild
npm ci
npm run build
docker-compose build api-server

# 5. Start services
docker-compose up -d

# 6. Verify
curl http://localhost:3030/health

# 7. Test query
curl -X POST http://localhost:3030/projects/default/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "topK": 5}'
```

### Verify Rollback Success

```bash
# Check version
git log --oneline | head -1

# Check services
docker-compose ps

# Run smoke test
# (Same as deployment smoke tests above)
```

---

## 🐛 Troubleshooting

### Problem: API Server Won't Start

**Check:**
```bash
# View logs
docker-compose logs api-server

# Common issues:
# - Port 3030 already in use
# - PostgreSQL connection failed
# - Missing environment variables
```

**Solution:**
```bash
# Check port
lsof -i :3030

# Kill if needed
kill -9 $(lsof -t -i:3030)

# Check PostgreSQL
psql -h postgres -U postgres -d claude_context -c "SELECT 1;"

# Check .env
cat .env | grep -E "POSTGRES|QDRANT"
```

---

### Problem: Migrations Fail

**Check:**
```bash
# View detailed error
psql -h postgres -U postgres -d claude_context \
  -f services/init-scripts/002-island-architecture.sql 2>&1 | tee migration.log
```

**Solution:**
```bash
# If "already exists" error, skip migration
# Tables are already created, proceed to Step 4

# If permission error, grant permissions
psql -h postgres -U postgres -d claude_context -c \
  "GRANT ALL ON SCHEMA claude_context TO postgres;"
```

---

### Problem: Collections Not Created

**Check:**
```bash
# Check Qdrant
curl http://localhost:6333/collections

# Check database
psql -h postgres -U postgres -d claude_context -c \
  "SELECT * FROM claude_context.dataset_collections;"

# Check logs
docker-compose logs api-server | grep -i "collection"
```

**Solution:**
```bash
# Verify PostgreSQL pool configured
docker-compose exec api-server printenv | grep POSTGRES

# Should show POSTGRES_URL
# If missing, add to .env and restart
```

---

### Problem: Queries Return Empty

**Check:**
```bash
# Verify collection has data
curl http://localhost:6333/collections/project_NAME_dataset_NAME

# Check point count
psql -h postgres -U postgres -d claude_context -c \
  "SELECT collection_name, point_count FROM claude_context.dataset_collections;"
```

**Solution:**
```bash
# Reindex if needed
curl -X POST http://localhost:3030/projects/PROJECT/ingest/web \
  -H "Content-Type: application/json" \
  -d '{"pages":[...], "dataset":"DATASET", "forceReindex":true}'
```

---

## 📊 Success Metrics

### Deployment Success Criteria

✅ **All services healthy**
```bash
docker-compose ps | grep -E "healthy|Up"
# All services should show healthy/running
```

✅ **Smoke tests passing**
```bash
# Create → Query → Verify isolation
# All should succeed
```

✅ **Performance acceptable**
```bash
# Query latency < 2s (p95)
# Error rate < 1%
# Memory usage < 80%
```

✅ **Monitoring active**
```bash
# Logs being collected
# Metrics being tracked
# Alerts configured
```

### Performance Targets

| Metric | Target | Acceptable | Alert Threshold |
|--------|--------|------------|-----------------|
| Query Latency (p50) | < 500ms | < 1s | > 2s |
| Query Latency (p95) | < 1s | < 2s | > 5s |
| Error Rate | < 0.1% | < 1% | > 5% |
| Memory Usage | < 60% | < 80% | > 90% |
| Disk Space Free | > 40% | > 20% | < 10% |
| CPU Usage | < 50% | < 70% | > 90% |

---

## 📞 Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| On-Call Engineer | TBD | [phone/slack] |
| Database Admin | TBD | [phone/slack] |
| DevOps Lead | TBD | [phone/slack] |
| Product Owner | TBD | [phone/slack] |

---

## 📚 Related Documentation

- [Migration Guide](../migration/MIGRATION-GUIDE.md) - Step-by-step migration instructions
- [Architecture Overview](./island-plan/README.md) - System architecture
- [Phase Reports](./island-plan/) - Detailed phase completion reports
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

---

## 📝 Deployment Log Template

```
## Deployment Log

**Date:** YYYY-MM-DD
**Version:** v1.2.0
**Environment:** Production
**Engineer:** [Name]

### Pre-Deployment
- [ ] Backup created: /backups/backup_YYYYMMDD_HHMMSS.sql
- [ ] Team notified: [Time]
- [ ] Health check passed: [Time]

### Deployment
- [ ] Services stopped: [Time]
- [ ] Code deployed: [Time]
- [ ] Migrations run: [Time]
- [ ] Services started: [Time]

### Verification
- [ ] Health checks passed: [Time]
- [ ] Smoke tests passed: [Time]
- [ ] Performance acceptable: [Time]

### Issues Encountered
- None / [Description]

### Rollback Required
- No / Yes - [Reason]

### Sign-off
- Engineer: [Name] [Time]
- Reviewer: [Name] [Time]
```

---

**Last Updated:** November 5, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready
