# Implementation Notes

## Project Filter Resolver (SQL)

```sql
-- Build accessible_dataset_ids
WITH
  project_datasets AS (
    SELECT dataset_id
    FROM datasets
    WHERE project_id = $1
  ),
  global_datasets AS (
    SELECT dataset_id
    FROM datasets
    WHERE is_global = true
  ),
  shared_datasets AS (
    SELECT resource_id as dataset_id
    FROM project_shares
    WHERE from_project_id = $1
      AND resource_type = 'dataset'
      AND (expires_at IS NULL OR expires_at > NOW())
  )
SELECT dataset_id
FROM (
  SELECT dataset_id FROM project_datasets
  UNION
  SELECT dataset_id FROM global_datasets
  UNION
  SELECT dataset_id FROM shared_datasets
) accessible;
```

## Qdrant Filter

```json
{
  "must": [
    { "key": "dataset_id", "match": { "any": [list_of_ids] } }
  ],
  "should": [
    { "key": "repo", "match": { "value": "repo_name" } },
    { "key": "lang", "match": { "value": "language" } }
  ]
}
```

## Rerank Logging

```sql
INSERT INTO rerank_results (
  search_session_id,
  query_text,
  candidate_rank,
  candidate_id,
  vector_score,
  sparse_score,
  rerank_score,
  final_rank,
  project_id,
  created_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
);
```

## Crawl Health Monitoring

From `crawl_sessions`:
- `status`: running|completed|failed
- `pages_crawled`: success count
- `pages_failed`: error count
- `duration_ms`: total time

Dashboard queries:
```sql
-- Success rate by project
SELECT
  p.name,
  COUNT(*) FILTER (WHERE cs.status = 'completed') * 100.0 / COUNT(*) as success_rate,
  AVG(cs.pages_crawled) as avg_pages,
  AVG(cs.duration_ms) as avg_duration
FROM crawl_sessions cs
JOIN datasets d ON cs.dataset_id = d.dataset_id
JOIN projects p ON d.project_id = p.project_id
GROUP BY p.name;
```

## Idempotency Strategy

**Keys:** `source:sha:relpath:chunk_index:content_hash`

**On ingest:**
```sql
-- Check if chunk already exists
SELECT chunk_id
FROM chunks
WHERE content_hash = $1
  AND (document_id = $2 OR web_page_id = $3);

-- Only upsert if new or changed
```

**On web crawl:**
```sql
-- Dedup by url + content_hash
SELECT web_page_id
FROM web_pages
WHERE url = $1
  AND content_hash = $2;
```

## Reindex Strategy

- **GitHub:** Only chunks with changed `content_hash`
- **Web pages:** Dedup by `url + content_hash`
- **Differential updates:** Use diff to identify changed files only

## Access Control Pattern

1. **Query time:** Resolve accessible dataset IDs in SQL
2. **Pass only IDs** to Qdrant filters
3. **Before return:** Re-check access with `is_resource_accessible(project, type, id)`

## Context Packing Algorithm

```python
def pack_context(chunks):
    # Group by file
    by_file = group_by(chunks, lambda c: c.file)

    result = []
    for file, file_chunks in by_file.items():
        # Sort by position
        sorted_chunks = sorted(file_chunks, key=lambda c: c.start_line)

        # Merge adjacent chunks
        merged = []
        for chunk in sorted_chunks:
            if merged and chunk.start_line <= merged[-1].end_line + 1:
                # Extend previous chunk
                merged[-1].text += "\n" + chunk.text
                merged[-1].end_line = chunk.end_line
            else:
                merged.append(chunk)

        # Include macro once if multiple chunks from file
        if len(merged) > 1:
            result.append({
                "type": "macro",
                "file": file,
                "text": get_file_macro(file)
            })

        result.extend(merged)

    return result
```

## Liquid Glass Frontend Console

- **Location:** `src/ui` exposes a shadcn-inspired React console (`App`) with glassmorphism styling injected via `ShadcnGlassStyles`.
- **Data Contracts:** `src/ui/api/client.ts` mirrors the ingestion/query/share endpoints (`/projects/{name}/ingest/github|crawl`, `/projects/{name}/query`, `/projects/{name}/share`, `/projects/{name}/stats`) and falls back to rich mocks for local demos.
- **Scope Coordination:** `Tabs` components render global/project/local islands with badge chips for `is_global`, MiniMax macros, and Crawl4AI deltas to match the project isolation model.
- **Pipeline Telemetry:** `mockPipelinePhases` encodes chunking → summarizer → embeddings → storage sync metrics, aligning throughputs with tree-sitter (~100 chunks/sec), MiniMax (~10 chunks/sec), and embedding rates (~40 chunks/sec).
- **Operations View:** Timeline overlays hybrid search SLOs, storage pressure, crawl incidents, and dataset shares so ops/SRE can confirm the workflows defined in `plan/04-retrieval.md` and `plan/03-pipelines.md`.
