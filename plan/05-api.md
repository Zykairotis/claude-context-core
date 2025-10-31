# API Specification

## Endpoints

### Ingestion

**POST `/projects/{name}/ingest/github`**
```json
{
  "repo": "string",
  "sha": "string",
  "branch": "string"
}
```
- Triggers GitHub webhook processing
- Uses `get_or_create_project` to resolve project

**POST `/projects/{name}/ingest/crawl`**
```json
{
  "start_url": "string",
  "crawl_type": "string",
  "depth": "number",
  "max_pages": "number",
  "dataset": "string"
}
```
- Initiates Crawl4AI job
- Tracked in **`crawl_sessions`**

### Query

**POST `/projects/{name}/query`**
```json
{
  "q": "string",
  "repo": "string?",
  "path_prefix": "string?",
  "lang": "string?",
  "include_global": "boolean",
  "k": "number"
}
```
Returns:
```json
{
  "results": [
    {
      "chunk": "string",
      "file": "string",
      "line_span": {
        "start": "number",
        "end": "number"
      },
      "scores": {
        "vector": "number",
        "sparse": "number",
        "rerank": "number",
        "final": "number"
      },
      "project_id": "uuid",
      "dataset_id": "uuid"
    }
  ],
  "evidence": "string"
}
```

### Administration

**POST `/projects/{from}/share`**
```json
{
  "to_project": "string",
  "resource_type": "dataset|web_page|document",
  "resource_id": "uuid",
  "expires_at": "datetime?"
}
```
- Calls **`share_resource`** to expose datasets/docs/pages to another project
- Includes audit metadata

**GET `/projects/{name}/stats`**
```json
{
  "datasets": "number",
  "chunks": "number",
  "web_pages": "number",
  "crawl_sessions": [
    {
      "id": "uuid",
      "status": "string",
      "pages_crawled": "number",
      "pages_failed": "number",
      "duration_ms": "number"
    }
  ]
}
```
- Joins **`project_statistics`**, `dataset_statistics`, and `crawl_session_summary`
