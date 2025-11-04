# Todo 12: Production Deployment

**Status:** ⏳ Not Started  
**Complexity:** Medium  
**Estimated Time:** 4-6 hours  
**Dependencies:** Todo 11 (Migration Guide)

---

## Objective

Deploy unified web ingestion pipeline to production with proper monitoring and rollback capabilities.

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (>80% coverage)
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Migration guide reviewed
- [ ] Rollback plan prepared
- [ ] Monitoring configured

### Services Required

- [ ] PostgreSQL 15+ with pgvector
- [ ] Qdrant 1.8+ (optional)
- [ ] SPLADE service (port 30004)
- [ ] Reranker TEI (port 30003)
- [ ] Crawl4AI (port 7070)
- [ ] MCP Server (port 3000)

---

## Docker Compose Update

```yaml
# services/docker-compose.yml

services:
  postgres:
    image: pgvector/pgvector:pg15
    ports:
      - "5533:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: claude_context
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready"]
      interval: 10s
  
  qdrant:
    image: qdrant/qdrant:v1.8.0
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
  
  splade:
    build: ./splade-runner
    ports:
      - "30004:8000"
    environment:
      MODEL_NAME: naver/splade-cocondenser-ensembledistil
      BATCH_SIZE: 32
    deploy:
      resources:
        limits:
          memory: 4G
  
  reranker:
    image: ghcr.io/huggingface/text-embeddings-inference:latest
    ports:
      - "30003:80"
    command: --model-id BAAI/bge-reranker-v2-m3
    deploy:
      resources:
        limits:
          memory: 2G
  
  crawl4ai:
    build: ./crawl4ai-runner
    ports:
      - "7070:8000"
    environment:
      USE_SIMPLE_CRAWLER: "true"
    deploy:
      resources:
        limits:
          memory: 1G

volumes:
  postgres_data:
  qdrant_data:
```

---

## Environment Configuration

```bash
# Production .env

# Database
POSTGRES_CONNECTION_STRING=postgresql://user:pass@postgres:5432/claude_context

# API Keys
OPENAI_API_KEY=${OPENAI_API_KEY}
LLM_API_KEY=${LLM_API_KEY}

# Feature Flags
ENABLE_HYBRID_SEARCH=true
ENABLE_RERANKING=true
ENABLE_SYMBOL_EXTRACTION=true

# Service Endpoints
SPLADE_URL=http://splade:8000
RERANKER_URL=http://reranker:80
CRAWL4AI_URL=http://crawl4ai:8000

# Performance
RERANK_INITIAL_K=150
RERANK_FINAL_K=10
EMBEDDING_BATCH_SIZE=100

# Migration
USE_UNIFIED_PIPELINE=true
```

---

## Deployment Steps

### 1. Build Images

```bash
cd services
docker-compose build --no-cache
```

### 2. Run Migrations

```bash
npm run migrate:up
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Health Checks

```bash
# Verify all services
docker-compose ps

# Check logs
docker-compose logs -f
```

### 5. Smoke Tests

```bash
npm run test:smoke
```

---

## Monitoring

### Metrics to Track

```typescript
// Add to Context class
private metrics = {
  webPagesIndexed: 0,
  chunksGenerated: 0,
  spladeSuccess: 0,
  spladeFailed: 0,
  rerankSuccess: 0,
  rerankFailed: 0,
  avgIndexTimeMs: 0,
  avgQueryTimeMs: 0
};
```

### Prometheus Metrics

```typescript
// metrics.ts
import client from 'prom-client';

export const webPagesIndexed = new client.Counter({
  name: 'web_pages_indexed_total',
  help: 'Total web pages indexed'
});

export const indexDuration = new client.Histogram({
  name: 'web_index_duration_seconds',
  help: 'Web page indexing duration',
  buckets: [0.5, 1, 2, 5, 10]
});
```

---

## Rollback Procedure

### If Critical Issue

```bash
# 1. Switch to legacy mode
export USE_UNIFIED_PIPELINE=false
docker-compose restart mcp-server

# 2. Verify services
curl http://localhost:3000/health

# 3. Check logs
docker-compose logs -f mcp-server
```

### If Data Corruption

```bash
# Restore from backup
pg_restore -d claude_context backup.dump
```

---

## Post-Deployment

### Week 1

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Fix critical bugs

### Week 2-4

- [ ] Optimize slow queries
- [ ] Tune batch sizes
- [ ] Remove feature flags
- [ ] Update documentation

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Uptime | >99.5% | - |
| Index latency (p95) | <5s | - |
| Query latency (p95) | <2s | - |
| Error rate | <0.1% | - |
| Test coverage | >80% | - |

---

## Documentation Updates

- [ ] README.md
- [ ] API documentation
- [ ] MCP tool descriptions
- [ ] Architecture diagrams
- [ ] Troubleshooting guide

---

**Completion Criteria:**
- ✅ All services deployed
- ✅ Health checks passing
- ✅ Monitoring active
- ✅ Documentation updated
- ✅ Team trained

---

## 🎉 Plan Complete!

All 12 todos documented. Ready for implementation.
