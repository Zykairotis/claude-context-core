# Operations

## Sizing & Performance

### Qdrant
- **Snapshots:** Nightly automated
- **WAL:** Always on
- **`memmap_threshold`:** Tune for large collections (e.g., >1M vectors)
- **RAM:** Monitor usage, scale with collection size

### Payload Discipline
- Keep payloads **tiny** (minimal metadata only)
- Store full blobs/macros in object store
- Reference in DB/Qdrant payloads

### Caching
```yaml
Query Cache:
  - Time-to-live: 2-5 minutes
  - Strategy: Cache query → top-M results
  - Purpose: Amortize rerank on repeated questions
  - Cache key: query + filters + accessible_datasets
```

### Dashboards
Use existing views:
- **`project_statistics`** - ingest coverage
- **`dataset_statistics`** - dataset health
- **`crawl_session_summary`** - crawl health

## Security & Access Control

### Project Visibility Enforcement

1. **SQL First:** Resolve accessible `dataset_id` set
2. **Filter Pass:** Send **only IDs** to Qdrant
3. **Re-check:** Verify access before returning context

```sql
-- Access check before response
SELECT is_resource_accessible($1, 'chunk', $2) as allowed;
```

### Global Content Management
- Keep **global** content in `global` project
- Share tactical datasets via **`project_shares`**
- Audit all share operations

### Audit Trail
Track:
- Share operations (who, when, what)
- Query patterns (if needed)
- Access violations (if any)

## Evaluation & Tuning

### Ground Truth Queries
Build set of **50–100 "real" queries:**
- How-to questions
- Where-is questions
- Why-broke questions

### A/B Testing
Compare:
- **Baseline:** pgvector-only
- **New:** Qdrant hybrid

**Log to `rerank_results`:**
- Vector scores
- BM25 scores
- Rerank scores
- Final ranks

**Compute:**
- **MRR@10** (Mean Reciprocal Rank)
- **nDCG@10** (Normalized Discounted Cumulative Gain)

### Latency Tracking (p50/p95)

1. **Qdrant search** (top-100)
2. **Cross-encoder rerank**
3. **End-to-end API**

### Tuning Knobs
- **Candidate K:** 50→100 (more candidates = better quality, slower)
- **α for fusion:** Dense vs sparse weight
- **RRF:** Reciprocal Rank Fusion parameters
- **Project filter breadth:** project-only vs project+global

## Monitoring & Alerts

### Key Metrics
- **p50/p95 latency** by endpoint
- **Error rates** (4xx, 5xx)
- **Qdrant RAM usage**
- **Crawl success rate** from `crawl_session_summary`

### Thresholds (Example)
```yaml
Latency:
  p95_query: 2000ms
  p95_ingest: 10000ms

Errors:
  5xx_rate: 1%
  crawl_failure_rate: 5%

Resources:
  qdrant_memory: 80%
  postgres_connections: 80%
```

### Daily Health Checks
- Verify snapshot integrity
- Test restore procedures
- Review error logs
- Check crawl success rates

## Backup & Recovery

### Postgres
- **Daily** full backup
- **WAL archiving** continuous
- **Weekly** restore test

### Qdrant
- **Daily** snapshots
- **Retention:** 30 days
- **Weekly** restore drill

### Object Store
- **Versioned** macros and blobs
- **Cross-region** replication (if available)

## Maintenance

### Weekly Tasks
- [ ] Review quality metrics (MRR/nDCG)
- [ ] Analyze slow queries
- [ ] Check disk space (Postgres, Qdrant, object store)
- [ ] Review access logs

### Monthly Tasks
- [ ] Expand evaluation query set
- [ ] Re-tune search parameters
- [ ] Review project sharing settings
- [ ] Capacity planning

### Quarterly Tasks
- [ ] Full DR test (restore from backup)
- [ ] Security audit
- [ ] Architecture review
- [ ] User feedback assessment
