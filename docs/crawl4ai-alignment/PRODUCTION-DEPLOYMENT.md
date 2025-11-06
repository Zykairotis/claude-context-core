# Production Deployment Guide

**Version**: 2.0  
**Date**: November 4, 2025  
**Target**: Production-ready unified pipeline deployment

---

## Overview

This guide provides a complete checklist and procedures for deploying the unified web ingestion pipeline to production. Follow these steps to ensure a safe, monitored, and successful deployment.

---

## Pre-Deployment Checklist

### Code & Testing
- [ ] All tests passing (`npm test`)
- [ ] Code coverage >85%
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No linting errors (`npm run lint`)
- [ ] Production build successful (`npm run build`)
- [ ] Integration tests passing
- [ ] Performance benchmarks met

### Infrastructure
- [ ] PostgreSQL with pgvector ready
- [ ] Qdrant vector database configured
- [ ] Crawl4AI service deployed
- [ ] SPLADE service available (optional)
- [ ] Reranker service available (optional)
- [ ] LLM API keys configured (for smart queries)

### Documentation
- [ ] Migration guide reviewed
- [ ] Runbooks prepared
- [ ] Monitoring dashboards ready
- [ ] Team training completed

---

## Environment Configuration

### Required Environment Variables

```bash
# ==================================================================================
# Database Configuration
# ==================================================================================

# PostgreSQL (with pgvector extension)
POSTGRES_HOST=prod-postgres.example.com
POSTGRES_PORT=5432
POSTGRES_DB=claude_context_prod
POSTGRES_USER=claude_context
POSTGRES_PASSWORD=<secure-password>
POSTGRES_SSL=true
POSTGRES_MAX_CONNECTIONS=50

# Vector Database (Qdrant)
QDRANT_URL=https://qdrant-prod.example.com
QDRANT_API_KEY=<api-key>
QDRANT_COLLECTION_PREFIX=prod_

# ==================================================================================
# Service URLs
# ==================================================================================

# Crawl4AI Service
CRAWL4AI_URL=https://crawl4ai-prod.example.com
CRAWL4AI_TIMEOUT=30000

# SPLADE Service (for hybrid search)
ENABLE_HYBRID_SEARCH=true
SPLADE_URL=https://splade-prod.example.com
SPLADE_TIMEOUT=5000

# Reranker Service (for cross-encoder reranking)
ENABLE_RERANKING=true
RERANKER_URL=https://reranker-prod.example.com
RERANKER_TIMEOUT=10000

# ==================================================================================
# LLM Configuration (for smart queries)
# ==================================================================================

LLM_API_KEY=<openai-api-key>
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4-turbo-preview
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2000

# ==================================================================================
# Performance Tuning
# ==================================================================================

# Embedding batch size
EMBEDDING_BATCH_SIZE=50

# Vector search parameters
DEFAULT_TOP_K=10
MAX_TOP_K=100

# Chunking parameters
MAX_CHUNK_SIZE=2000
CHUNK_OVERLAP=200

# ==================================================================================
# Monitoring & Logging
# ==================================================================================

LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9090

# Sentry for error tracking (optional)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production

# ==================================================================================
# Security
# ==================================================================================

# API rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS (if exposing API)
CORS_ORIGIN=https://app.example.com
CORS_CREDENTIALS=true
```

---

## Database Migration

### Step 1: Backup Existing Data

```bash
# Full PostgreSQL backup
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  -F custom -f backup-$(date +%Y%m%d-%H%M%S).dump

# Qdrant snapshot
curl -X POST "http://$QDRANT_URL/collections/*/snapshots"
```

### Step 2: Run Migrations

```sql
-- Connect to production database
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB

-- Create web_provenance table
CREATE TABLE IF NOT EXISTS web_provenance (
  url TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  first_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ,
  content_hash TEXT,
  version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_web_prov_domain 
  ON web_provenance(domain);

CREATE INDEX IF NOT EXISTS idx_web_prov_last_indexed 
  ON web_provenance(last_indexed_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_prov_version 
  ON web_provenance(version);

CREATE INDEX IF NOT EXISTS idx_web_prov_metadata_gin 
  ON web_provenance USING gin(metadata);

-- Verify migration
SELECT 
  tablename, 
  indexname 
FROM pg_indexes 
WHERE tablename = 'web_provenance';
```

### Step 3: Verify Database Health

```sql
-- Check table exists
\d web_provenance

-- Check indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'web_provenance';

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

## Service Deployment

### Docker Compose Production Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # PostgreSQL with pgvector
  postgres:
    image: ankane/pgvector:v0.5.1
    restart: always
    environment:
      POSTGRES_DB: claude_context_prod
      POSTGRES_USER: claude_context
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U claude_context"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Qdrant vector database
  qdrant:
    image: qdrant/qdrant:v1.7.0
    restart: always
    environment:
      QDRANT__SERVICE__API_KEY: ${QDRANT_API_KEY}
    volumes:
      - qdrant-data:/qdrant/storage
    ports:
      - "6333:6333"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Crawl4AI service
  crawl4ai:
    build: ./services/crawl4ai-runner
    restart: always
    environment:
      PORT: 7070
      LOG_LEVEL: info
    ports:
      - "7070:7070"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7070/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  # SPLADE sparse vector service (optional)
  splade:
    image: ghcr.io/zykairotis/splade-service:latest
    restart: always
    ports:
      - "30004:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G

  # Reranker service (optional)
  reranker:
    image: ghcr.io/huggingface/text-embeddings-inference:latest
    restart: always
    command: --model-id cross-encoder/ms-marco-MiniLM-L-6-v2
    ports:
      - "30003:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G

  # API Server (serves UI and handles requests)
  api-server:
    build: ./services/api-server
    restart: always
    environment:
      NODE_ENV: production
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      QDRANT_URL: http://qdrant:6333
      CRAWL4AI_URL: http://crawl4ai:7070
      SPLADE_URL: http://splade:8000
      RERANKER_URL: http://reranker:8000
    ports:
      - "3030:3030"
    depends_on:
      - postgres
      - qdrant
      - crawl4ai
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3030/health"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
  qdrant-data:
```

### Deploy Services

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Build custom images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Verify all services healthy
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## Health Checks

### Automated Health Check Script

```bash
#!/bin/bash
# health-check.sh

set -e

echo "🔍 Running production health checks..."

# PostgreSQL
echo "✓ Checking PostgreSQL..."
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  -c "SELECT version();" > /dev/null
echo "  PostgreSQL: OK"

# Qdrant
echo "✓ Checking Qdrant..."
curl -sf "$QDRANT_URL/health" > /dev/null
echo "  Qdrant: OK"

# Crawl4AI
echo "✓ Checking Crawl4AI..."
curl -sf "$CRAWL4AI_URL/health" > /dev/null
echo "  Crawl4AI: OK"

# SPLADE (optional)
if [ "$ENABLE_HYBRID_SEARCH" = "true" ]; then
  echo "✓ Checking SPLADE..."
  curl -sf "$SPLADE_URL/health" > /dev/null
  echo "  SPLADE: OK"
fi

# Reranker (optional)
if [ "$ENABLE_RERANKING" = "true" ]; then
  echo "✓ Checking Reranker..."
  curl -sf "$RERANKER_URL/health" > /dev/null
  echo "  Reranker: OK"
fi

echo "✅ All health checks passed!"
```

### Health Check Endpoints

```typescript
// Health check responses
GET /health/postgres
{
  "status": "healthy",
  "version": "PostgreSQL 15.3",
  "connections": 5,
  "maxConnections": 50
}

GET /health/qdrant
{
  "status": "healthy",
  "collections": 15,
  "totalVectors": 1250000
}

GET /health/services
{
  "postgres": "healthy",
  "qdrant": "healthy",
  "crawl4ai": "healthy",
  "splade": "healthy",
  "reranker": "healthy"
}
```

---

## Monitoring Setup

### Metrics to Track

#### Application Metrics

```typescript
// Key performance indicators
{
  // Ingestion
  "ingestion.pages_per_minute": 5.2,
  "ingestion.avg_page_time_ms": 1850,
  "ingestion.error_rate": 0.02,
  
  // Query
  "query.requests_per_second": 12.5,
  "query.avg_latency_ms": 145,
  "query.p95_latency_ms": 280,
  "query.p99_latency_ms": 450,
  
  // Search Quality
  "search.dense_only_queries": 120,
  "search.hybrid_queries": 980,
  "search.reranked_queries": 850,
  
  // Resources
  "db.connection_pool_size": 45,
  "db.active_connections": 12,
  "memory.usage_mb": 2048,
  "cpu.usage_percent": 35
}
```

#### Service Health Metrics

```typescript
{
  "services.postgres.status": "up",
  "services.postgres.response_time_ms": 2,
  "services.qdrant.status": "up",
  "services.qdrant.response_time_ms": 8,
  "services.crawl4ai.status": "up",
  "services.crawl4ai.response_time_ms": 850,
  "services.splade.status": "up",
  "services.splade.response_time_ms": 45,
  "services.reranker.status": "up",
  "services.reranker.response_time_ms": 120
}
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'claude-context-api'
    static_configs:
      - targets: ['api-server:9090']
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    
  - job_name: 'qdrant'
    static_configs:
      - targets: ['qdrant:6333']
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Claude Context - Web Ingestion",
    "panels": [
      {
        "title": "Ingestion Rate",
        "targets": [
          {
            "expr": "rate(ingestion_pages_total[5m])"
          }
        ]
      },
      {
        "title": "Query Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, query_latency_seconds)"
          }
        ]
      },
      {
        "title": "Service Health",
        "targets": [
          {
            "expr": "up{job=~\"claude-context.*\"}"
          }
        ]
      }
    ]
  }
}
```

---

## Deployment Strategy

### Gradual Rollout

#### Phase 1: Canary Deployment (10%)

```bash
# Deploy to 10% of traffic
kubectl apply -f k8s/canary-deployment.yaml

# Monitor for 2 hours
watch -n 60 './health-check.sh'

# Check error rates
curl http://prometheus:9090/api/v1/query?query=error_rate
```

#### Phase 2: Staged Rollout (50%)

```bash
# Increase to 50% after successful canary
kubectl scale deployment claude-context-api --replicas=5

# Monitor for 12 hours
# Check:
# - Error rates <0.1%
# - P95 latency <500ms
# - No memory leaks
# - No CPU spikes
```

#### Phase 3: Full Deployment (100%)

```bash
# Deploy to all traffic
kubectl scale deployment claude-context-api --replicas=10

# Final monitoring for 24 hours
```

### Rollback Procedure

```bash
#!/bin/bash
# rollback.sh

echo "⚠️  Starting rollback..."

# 1. Switch to previous version
docker-compose -f docker-compose.prod.yml down
git checkout previous-release-tag
docker-compose -f docker-compose.prod.yml up -d

# 2. Verify services
./health-check.sh

# 3. Restore database if needed
# psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
#   -f backup-TIMESTAMP.dump

echo "✅ Rollback complete"
```

---

## Security Checklist

### Application Security
- [ ] API rate limiting enabled
- [ ] CORS configured correctly
- [ ] SQL injection prevention (parameterized queries)
- [ ] Input validation on all endpoints
- [ ] Authentication tokens secured
- [ ] Secrets stored in environment variables
- [ ] HTTPS/TLS enabled

### Database Security
- [ ] PostgreSQL SSL/TLS enabled
- [ ] Strong passwords (16+ characters)
- [ ] Least-privilege user access
- [ ] Regular backups configured
- [ ] Backup encryption enabled
- [ ] Connection pooling limits set

### Service Security
- [ ] Docker images scanned for vulnerabilities
- [ ] Network segmentation configured
- [ ] Internal services not exposed publicly
- [ ] API keys rotated regularly
- [ ] Audit logging enabled

---

## Performance Optimization

### Database Optimization

```sql
-- Analyze and optimize
ANALYZE web_provenance;
VACUUM ANALYZE web_provenance;

-- Update statistics
UPDATE pg_stat_user_tables 
SET n_mod_since_analyze = 0 
WHERE relname = 'web_provenance';

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'web_provenance'
ORDER BY idx_scan DESC;
```

### Connection Pooling

```typescript
// Optimized pool configuration
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  
  // Production settings
  min: 5,           // Minimum connections
  max: 50,          // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  
  // SSL/TLS
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});
```

### Caching Strategy

```typescript
// Redis cache for frequent queries
import Redis from 'ioredis';

const cache = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// Cache query results
async function queryWithCache(params) {
  const cacheKey = `query:${JSON.stringify(params)}`;
  
  // Check cache
  const cached = await cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Execute query
  const result = await queryWebContent(context, params);
  
  // Cache for 5 minutes
  await cache.setex(cacheKey, 300, JSON.stringify(result));
  
  return result;
}
```

---

## Disaster Recovery

### Backup Strategy

```bash
#!/bin/bash
# backup.sh - Run daily

BACKUP_DIR=/backups/$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# PostgreSQL backup
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  -F custom -f $BACKUP_DIR/postgres.dump

# Qdrant snapshot
curl -X POST "$QDRANT_URL/collections/*/snapshots" \
  -o $BACKUP_DIR/qdrant-snapshots.json

# Upload to S3
aws s3 sync $BACKUP_DIR s3://claude-context-backups/$(date +%Y%m%d)/

# Cleanup old backups (keep 30 days)
find /backups -type d -mtime +30 -exec rm -rf {} \;
```

### Restore Procedure

```bash
#!/bin/bash
# restore.sh

BACKUP_DATE=$1  # e.g., 20251104

# Download from S3
aws s3 sync s3://claude-context-backups/$BACKUP_DATE/ /tmp/restore/

# Restore PostgreSQL
pg_restore -h $POSTGRES_HOST -U $POSTGRES_USER \
  -d $POSTGRES_DB --clean --if-exists \
  /tmp/restore/postgres.dump

# Restore Qdrant
# Import snapshots via Qdrant API

echo "✅ Restore complete from $BACKUP_DATE"
```

---

## Monitoring Alerts

### Alert Rules

```yaml
# alerts.yml
groups:
  - name: claude_context_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
      
      - alert: SlowQueries
        expr: query_latency_p95_seconds > 1.0
        for: 10m
        annotations:
          summary: "Query latency exceeding 1s"
      
      - alert: ServiceDown
        expr: up{job="claude-context-api"} == 0
        for: 2m
        annotations:
          summary: "Service is down"
      
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 8000
        for: 10m
        annotations:
          summary: "Memory usage above 8GB"
```

---

## Post-Deployment Validation

### Smoke Tests

```bash
#!/bin/bash
# smoke-tests.sh

echo "🧪 Running smoke tests..."

# Test 1: Health check
curl -sf http://production.example.com/health || exit 1

# Test 2: Simple ingestion
curl -X POST http://production.example.com/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"], "project": "smoke-test"}' \
  || exit 1

# Test 3: Simple query
curl -X POST http://production.example.com/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "project": "smoke-test"}' \
  || exit 1

echo "✅ Smoke tests passed!"
```

---

## Runbooks

### Common Issues

#### Issue: High Memory Usage

**Symptoms**: Memory usage >80%

**Solution**:
```bash
# 1. Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Restart API server
docker-compose restart api-server

# 3. Clear cache if using Redis
redis-cli FLUSHDB
```

#### Issue: Slow Queries

**Symptoms**: P95 latency >500ms

**Solution**:
```sql
-- Check slow queries
SELECT pid, query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state != 'idle'
AND query_start < NOW() - INTERVAL '5 seconds';

-- Kill slow queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active' 
AND query_start < NOW() - INTERVAL '1 minute';
```

---

## Final Checklist

Before marking deployment complete:

- [ ] All services healthy
- [ ] Smoke tests passing
- [ ] Monitoring dashboards showing green
- [ ] Backup systems operational
- [ ] Alerts configured
- [ ] Team notified
- [ ] Documentation updated
- [ ] Runbooks accessible

---

**Deployment Status**: Ready for Production ✅  
**Last Updated**: November 4, 2025
