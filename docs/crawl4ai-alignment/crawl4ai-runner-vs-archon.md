# Crawl4AI Runner vs. Archon Crawler

## Executive Summary

- **Deployment model**: Crawl4AI Runner ships as a standalone REST microservice with typed inputs and streaming storage, whereas Archon’s crawler is baked into the Archon web stack and coupled to Supabase utilities.
- **Pipeline depth**: Runner integrates smart chunking, parallel embeddings, code extraction, and MiniMax summaries out of the box. Archon focuses on markdown quality and Supabase document/page records, with richer doc-site heuristics but no native vector store output.
- **Performance posture**: Runner leans on HTTP/2 pools, async concurrency, and optional streaming batches to keep GPUs busy. Archon uses crawl4ai’s streaming `arun` but makes blocking discovery calls and stores sequentially via Supabase.
- **Operational control**: Runner exposes knobs through `.env.crawl4ai` (processing mode, batching, embeddings, reranking). Archon hard-codes most behaviour across services/modules and expects credential-service orchestration.
- **Current gaps**: Runner’s hybrid mode bypasses recursive crawling today and discovery heuristics are simpler. Archon lacks direct Qdrant/Postgres chunk integration and reuses legacy Supabase schema assumptions.

## Feature Comparison

| Area | Crawl4AI Runner (`services/crawl4ai-runner/…`) | Archon Crawler (`Archmine/old_reference-code/…`) |
| --- | --- | --- |
| **Interface** | `POST /crawl` REST API with `mode` enum (`single`, `batch`, `recursive`, `sitemap`), progress polling via `/progress/{id}` | Crawling services invoked inside Archon FastAPI app; progress tracked through `ProgressTracker` for Supabase-driven UI |
| **Discovery** | `DiscoveryService` checks `llms.txt` variants, sitemaps, robots (`app/services/discovery_service.py`) | Priority-based discovery with HTML meta parsing and more variants (`crawling/discovery_service.py`), but synchronous `requests` |
| **Fetching** | Async HTTP/2 client + optional Chromium via crawl4ai `AsyncWebCrawler` with concurrency caps (`app/crawler.py`) | crawl4ai `arun` with tailored wait selectors per doc framework (`strategies/single_page.py`), but per-request config |
| **Chunking** | Tree-sitter powered `SmartChunker`, chunk overlap tuning, streaming pipeline optional (`app/chunking/…`) | Markdown-first conversion; chunking happens during storage, less code-boundary awareness |
| **Code handling** | `CodeExtractionService` identifies code from HTML/Markdown/text and optionally summarizes via MiniMax (`app/services/code_extraction_service.py`) | Code extraction and summaries tightly integrated with Supabase storage, AI summaries configurable (`crawling/code_extraction_service.py`) |
| **Embeddings** | Parallel GTE + CodeRank embedding with metrics and batching control (`crawling_service.py`, env toggles) | No native embedding stage; relies on downstream processes once data lands in Supabase |
| **Storage** | Writes canonical metadata + chunks into Postgres + Qdrant unified schema (`app/services/crawling_service.py`, `app/storage/…`) | `DocumentStorageOperations` and `PageStorageOperations` target Supabase tables; summaries aggregated per source |
| **Throughput controls** | `.env.crawl4ai` toggles: `PROCESSING_MODE` (`sequential`, `hybrid`, `streaming`), batch sizes, concurrency, reranker flags | Concurrency and state spread across modules; cancellation uses shared `_active_orchestrations` registry |
| **Extensibility** | Modular microservice; external clients only need REST endpoint. Docker image builds Chromium, mounts sources for dev | Deeply tied to Archon config (`credential_service`, Supabase clients). Harder to lift into another project without refactoring |

## Performance Notes

- **Runner**: HTTP/2 pool (`max_connections=200`) + async concurrency enable dozens of in-flight pages. Parallel embedding batches (GTE + CodeRank) keep GPU utilization high with clear metrics. Hybrid/streaming pipelines minimize idle time when both crawling and storage run together.
- **Archon**: Single-page strategy squeezes high-quality markdown from tricky SPA docs via selector tuning and streaming HTML → Markdown, but discovery and storage are synchronous. Supabase writes are sequential, so throughput depends on Supabase latency.

## Operational Considerations

- Runner loads configuration from `.env.crawl4ai` (processing mode, chunk sizes, embedding concurrency, scope defaults). Restarting the container picks up new settings immediately. It also mounts source code during development for hot iteration.
- Archon expects Supabase credentials, Logfire logging, and progress tracking services. Removing it from the Archon stack requires stubbing these dependencies.

## Known Gaps & Opportunities

- **Runner**
  - Hybrid mode currently skips recursive crawling when `project`/`dataset` are set—needs guard to reinvoke the recursive walker.
  - Discovery heuristics could absorb Archon’s extended selector logic and HTML meta parsing for better doc coverage.
- **Archon**
  - No direct integration with the modern Postgres/Qdrant chunk schema; embedding/ingestion pipelines must run separately.
  - Env-driven tuning is limited; concurrency/batch sizes are scattered and harder to adjust in production.

## Recommendation

Use **Crawl4AI Runner** as the primary crawler for new ingestion work: it is faster end-to-end, writes directly into the unified vector stack, and is easier to operate via environment configuration. Keep **Archon’s crawler** as a reference when you need its advanced doc-site heuristics or Supabase-specific workflows, and selectively port those strengths (e.g., wait-selector mappings, discovery parsing) into the runner to close remaining gaps.
