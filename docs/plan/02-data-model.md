# Data Model

## Qdrant Collections

### Collections
- `code_context` - GitHub code chunks
- `web_context` - Web page chunks

### Named Vectors
- `content_dense` - Main embedding (768/1024 dimensions)
- `summary_dense` - Embedding of micro-summary (≤256 tokens)
- `sparse` - BM25/SPLADE-like CSR payload for lexical boost

### Payload (Minimal, Fast-Filtering)
```json
{
  "project_id": "uuid",
  "dataset_id": "uuid",
  "source_type": "code|web_page|doc",
  "provenance": {
    "repo": "string",
    "branch": "string",
    "sha": "string",
    "relpath": "string",
    "lang": "string"
  },
  "OR": {
    "url": "string",
    "domain": "string"
  },
  "chunk_index": "int",
  "symbol": "jsonb",
  "summary_256": "string"
}
```

## Postgres Source of Truth

### Key Tables

**`chunks`**
- Already stores `content_vector_id`, `summary_vector_id`
- Links chunks to vector representations in Qdrant
- Has unique constraints per document/page
- Includes: `repo`, `branch`, `sha`, `relpath`, `lang`, `symbol`, `content_hash`

**`vector_metadata`**
- Model information, dimensions, payload snapshots
- Rerank scores
- Links to Qdrant point IDs
- Indexed by `vector_type`/`collection_name`

**`rerank_results`**
- Query text, vector/BM25/rerank scores
- Final ranks and session IDs
- For evaluation and monitoring

**`web_pages`**
- Content + metadata
- Links to crawl sessions

**`crawl_sessions`**
- Track jobs and metrics

### Project Isolation

**`projects`**
- Owns datasets
- Default projects: `default`, `global`

**`project_shares`**
- Explicit sharing between projects
- Audit metadata

**`project_statistics`, `dataset_statistics`, `crawl_session_summary`**
- Monitoring views
- Ingest coverage and crawl health

### Indexes

- `(repo, sha)`, `(relpath)`, `(lang)`
- Unique: `(document_id|web_page_id, chunk_index, content_hash)`

## Object Store

- **Macro summaries** per file and per repo
- Large blobs
- Referenced in DB payloads
