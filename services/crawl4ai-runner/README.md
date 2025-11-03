# Crawl4AI Runner Service

A lightweight containerized crawler that fetches web pages, extracts readable content, converts it to Markdown, and exposes the results via a REST API. It is designed to work with the Phase A ingest pipeline (`ingestCrawlPages`) so crawled pages can be stored and indexed immediately.

## Capabilities

- **Single page** and **batch** crawling (default).
- **Recursive crawl** with configurable depth, page limit, and same-domain restriction.
- **Sitemap ingestion** (`mode="sitemap"`) for quickly harvesting large documentation sites.
- Optional link capture (`include_links=true`) so downstream jobs can queue follow-up crawls.

These map to the strategies used in the original Archon crawler (single, batch, recursive, sitemap).

## Endpoints

- `GET /health` — basic readiness probe.
- `POST /crawl` — accepts a JSON payload with `project`, `dataset`, and an array of `urls`. Returns the extracted Markdown/HTML and content statistics for each page.

Example request:

### Single / Batch example

```bash
curl -X POST http://localhost:7070/crawl \
  -H 'Content-Type: application/json' \
  -d '{
        "project": "testx",
        "dataset": "documentation",
        "urls": ["https://example.com/docs/intro"],
        "mode": "single"
      }'
```

### Recursive example

```bash
curl -X POST http://localhost:7070/crawl \
  -H 'Content-Type: application/json' \
  -d '{
        "project": "testx",
        "dataset": "documentation",
        "urls": ["https://example.com/docs/"],
        "mode": "recursive",
        "max_depth": 2,
        "max_pages": 30,
        "same_domain_only": true,
        "include_links": true
      }'
```

## Running via Docker Compose

Start the service (alongside Postgres) using the dedicated profile:

```bash
cd services
docker compose --profile crawl4ai up crawl4ai
```

The API will be available on `http://localhost:7070`.

## Integrating with the Ingest Pipeline

1. Call the `/crawl` endpoint with the target URLs.
2. Feed the returned page payloads into `ingestCrawlPages()` to persist metadata in Postgres.
3. Use the Markdown content to generate chunks and embeddings via the existing `Context` pipeline so the pages are searchable.

This mirrors the workflow used by the legacy Archon crawler but keeps control in this repository and avoids external dependencies.
