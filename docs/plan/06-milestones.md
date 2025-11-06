# Milestones - Phased Implementation

## Phase A — Project-aware Ingest & Storage (2–3 days)

### Deliverables
- [ ] Wire ingest endpoints to require `project` name
- [ ] Use **`get_or_create_project`** to create/resolve project on write paths
- [ ] Crawl4AI: switch to **`upsert_web_page_v3(project, dataset, …)`**
- [ ] Verify new pages appear in **`web_pages`** with correct project/dataset
- [ ] GitHub indexer: tag chunks with `project_id` (via dataset)
- [ ] Add provenance columns (`repo`, `branch`, `sha`, `relpath`, `lang`, `symbol`)
- [ ] Metrics: `project_statistics` shows datasets/pages/chunks by project

### Exit Criteria
✅ Project-scoped data visible in stats views
✅ Old queries work with project default

---

## Phase B — Qdrant Collections & Hybrid Search (2 days)

### Deliverables
- [ ] Create `code_context` & `web_context` with **named vectors + sparse**
- [ ] Upsert content+summary+sparse vectors
- [ ] Write **`vector_metadata`** rows for each vector
- [ ] Implement hybrid search (dense + sparse)
- [ ] Payload filters for accessible set (project ∪ shares ∪ global)

### Exit Criteria
✅ `/projects/{p}/query` returns top-100 candidates
✅ Consistent filters across all projects

---

## Phase C — Rerank + Context Packing (1–2 days)

### Deliverables
- [ ] Add cross-encoder rerank@100
- [ ] Log **`rerank_results`** (query text, vector/bm25/rerank scores, final ranks)
- [ ] Implement macro-aware context packing
  - Merge adjacent spans
  - Include macro once when multiple chunks from same file
- [ ] Return "**why**" evidence
  - Scores + file:line spans + project/dataset IDs

### Exit Criteria
✅ Measurable MRR uplift (>+15%) on gold set
✅ p95 latency stays under target

---

## Phase D — Crawl Observability & Sharing UX (1 day)

### Deliverables
- [ ] Surface **`crawl_session_summary`** to UI
- [ ] Show success rate/durations per project
- [ ] Implement `/projects/{from}/share` using `share_resource`
- [ ] Add audit metadata

### Exit Criteria
✅ Admins can share datasets across projects
✅ Crawl sessions monitored per project

---

## Phase E — Hardening & Evaluation (Ongoing)

### Deliverables
- [ ] Nightly snapshot/restore drills
- [ ] Expand gold query set (50→100 queries)
- [ ] Track MRR/nDCG weekly from **`rerank_results`**
- [ ] Optional: Add **graph-lite adjacency table** (callers/imports)
  - Nudge scores
  - Graduate to Neo4j later if needed

### Exit Criteria
✅ DR procedures tested and documented
✅ Weekly quality metrics tracking in place

---

## Success Metrics & Expected Deltas

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Search Latency (Top-100)** | Baseline | 1.5–4× faster | ~300% |
| **End-to-End Latency** | Baseline | ~2× faster | ~100% |
| **MRR@10** | Baseline | +15–35% improvement | Quality uplift |
| **nDCG@10** | Baseline | +15–35% improvement | Quality uplift |
| **Cross-Project Isolation** | N/A | Zero leakage | Security |

## Phasing Rationale

- **Phase A-B**: Core infrastructure (project isolation + search)
- **Phase C**: Quality improvements (reranking + context packing)
- **Phase D**: Operations (monitoring + sharing)
- **Phase E**: Long-term hardening and evaluation
