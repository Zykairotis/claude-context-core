"""High level orchestration for crawl requests."""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

from ..crawler import CrawlerManager, crawler_manager
from ..helpers import ensure_https, is_llms_variant, is_sitemap
from ..schemas import CrawlMode
from ..strategies import (
    PageResult,
    crawl_batch_with_progress,
    crawl_recursive_with_progress,
    crawl_single_page,
    parse_sitemap,
)
from .code_extraction_service import (
    CodeExample,
    CodeExtractionService,
    DocumentSnapshot,
)
from .discovery_service import DiscoveredFile, DiscoveryService
from .minimax_summary_provider import MiniMaxSummaryProvider
from .streaming_pipeline import StreamingPipeline

from ..storage import (
    CanonicalMetadataStore,
    EmbeddingMonsterClient,
    PostgresVectorStore,
    QdrantVectorStore,
    StoredChunk,
    ScopeManager,
)
from ..chunking import SmartChunker, Chunk
import os
import time


LOGGER = logging.getLogger(__name__)

# Parallel embedding configuration
ENABLE_PARALLEL_EMBEDDING = os.getenv("ENABLE_PARALLEL_EMBEDDING", "true").lower() == "true"
MAX_EMBEDDING_CONCURRENCY = int(os.getenv("MAX_EMBEDDING_CONCURRENCY", "2"))
EMBEDDING_METRICS_ENABLED = os.getenv("EMBEDDING_METRICS_ENABLED", "true").lower() == "true"

# Streaming pipeline configuration
ENABLE_STREAMING_PIPELINE = os.getenv("ENABLE_STREAMING_PIPELINE", "true").lower() == "true"
STREAMING_CHUNK_WORKERS = int(os.getenv("STREAMING_CHUNK_WORKERS", "4"))
STREAMING_EMBED_WORKERS = int(os.getenv("STREAMING_EMBED_WORKERS", "2"))
STREAMING_STORE_WORKERS = int(os.getenv("STREAMING_STORE_WORKERS", "2"))

# Hybrid batch-stream configuration
PROCESSING_MODE = os.getenv("PROCESSING_MODE", "hybrid")
HYBRID_CRAWL_BATCH = int(os.getenv("HYBRID_CRAWL_BATCH", "50"))
HYBRID_PROCESS_BATCH = int(os.getenv("HYBRID_PROCESS_BATCH", "10"))
HYBRID_MAX_MEMORY_PAGES = int(os.getenv("HYBRID_MAX_MEMORY_PAGES", "100"))


@dataclass
class ProgressState:
    status: str = "running"
    progress: int = 0
    log: str = ""
    current_url: Optional[str] = None
    total_pages: Optional[int] = None
    processed_pages: int = 0
    chunks_stored: int = 0
    code_examples_found: int = 0
    documents: List[PageResult] = field(default_factory=list)
    code_examples: List[CodeExample] = field(default_factory=list)
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    requested_mode: Optional[CrawlMode] = None
    project: Optional[str] = None
    dataset: Optional[str] = None
    # Real-time progress tracking fields
    current_phase: str = "idle"
    phase_detail: Optional[str] = None
    chunks_total: int = 0
    chunks_processed: int = 0
    summaries_generated: int = 0
    embeddings_generated: int = 0
    last_progress_percentage: int = 0


@dataclass
class CrawlRequestContext:
    urls: List[str]
    auto_discovery: bool
    max_depth: int
    max_pages: int
    same_domain_only: bool
    include_links: bool
    extract_code_examples: bool
    knowledge_type: Optional[str]
    tags: Optional[List[str]]
    provider: Optional[str]
    mode: CrawlMode
    project: Optional[str]
    dataset: Optional[str]
    scope: Optional[str]
    max_concurrent: Optional[int] = None  # Maximum concurrent requests = None


class CrawlingService:
    def __init__(
        self,
        *,
        discovery_service: Optional[DiscoveryService] = None,
        code_extraction_service: Optional[CodeExtractionService] = None,
        crawler: Optional[CrawlerManager] = None,
    ) -> None:
        self.discovery = discovery_service or DiscoveryService()
        self.code_extractor = code_extraction_service or CodeExtractionService()
        self.crawler = crawler or crawler_manager
        self._states: Dict[str, ProgressState] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def orchestrate_crawl(self, ctx: CrawlRequestContext) -> str:
        progress_id = uuid.uuid4().hex
        state = ProgressState()
        state.requested_mode = ctx.mode
        state.project = ctx.project
        state.dataset = ctx.dataset
        async with self._lock:
            self._states[progress_id] = state
            task = asyncio.create_task(self._async_orchestrate_crawl(progress_id, ctx))
            self._tasks[progress_id] = task
        return progress_id

    async def _async_orchestrate_crawl(
        self, progress_id: str, ctx: CrawlRequestContext
    ) -> None:
        state = self._states[progress_id]
        try:
            await self.crawler.initialize()

            urls = [ensure_https(url) for url in ctx.urls]
            discovered: Optional[DiscoveredFile] = None
            if ctx.auto_discovery:
                self._update_progress(progress_id, progress=5, log="Running discovery", current_phase="crawling", phase_detail="Auto-discovery")
                discovered = await self.discovery.discover_files(urls)
                self._update_progress(
                    progress_id, progress=15, log="Discovery complete", current_phase="crawling", phase_detail="Discovery complete"
                )

            crawl_urls = await self._determine_urls(ctx, urls, discovered)
            state.total_pages = len(crawl_urls)
            self._update_progress(
                progress_id, progress=20, log="Starting crawl", current_url=None, current_phase="crawling", phase_detail="Fetching pages"
            )

            # Phase 3: Crawling & Processing (20-98%)
            if PROCESSING_MODE == "hybrid" and (ctx.project or ctx.dataset):
                # Hybrid: Process pages as they complete
                await self._hybrid_crawl_and_process(progress_id, ctx, crawl_urls)
                self._update_progress(progress_id, progress=98, log="Hybrid processing complete", current_phase="completed", phase_detail="Success")
            else:
                # Sequential: Crawl all then process all
                documents = await self._execute_crawl(progress_id, ctx, crawl_urls)
                state.documents = documents
                self._update_progress(progress_id, progress=60, log="Crawling complete", current_phase="crawling", phase_detail="Complete")

                # Phase 4-7: Chunking, Summarization, Embedding, Storage
                if documents and (ctx.project or ctx.dataset):
                    # Phase 4: Chunking (60-70%)
                    try:
                        chunks = await self._chunk_documents(progress_id, documents)
                    except Exception as exc:
                        LOGGER.error("Chunking failed, using fallback: %s", exc)
                        chunks = []  # Continue with empty chunks
                        self._update_progress(
                            progress_id, progress=70, log=f"Chunking failed: {exc}", current_phase="chunking", phase_detail="Failed"
                        )

                    # Phase 5: Summarization (70-80%)
                    try:
                        summaries = (
                            await self._summarize_chunks(progress_id, chunks)
                            if chunks
                            else []
                        )
                    except Exception as exc:
                        LOGGER.error("Summarization failed, using fallback: %s", exc)
                        summaries = [
                            chunk.text[:100] + "..." for chunk in chunks
                        ]  # Fallback
                        self._update_progress(
                            progress_id, progress=80, log=f"Summarization failed: {exc}", current_phase="summarizing", phase_detail="Failed"
                        )

                    # Phase 6: Embedding (80-92%)
                    try:
                        embeddings = (
                            await self._embed_chunks(progress_id, chunks) if chunks else []
                        )
                    except Exception as exc:
                        LOGGER.error("Embedding failed: %s", exc)
                        embeddings = []
                        self._update_progress(
                            progress_id, progress=92, log=f"Embedding failed: {exc}", current_phase="embedding", phase_detail="Failed"
                        )

                    # Phase 7: Storage (92-98%)
                    try:
                        chunks_stored = 0
                        if chunks and summaries and embeddings:
                            chunks_stored = await self._store_chunks(
                                progress_id, ctx, documents, chunks, summaries, embeddings
                            )
                            state.chunks_stored = chunks_stored
                            self._update_progress(
                                progress_id,
                                progress=98,
                                log=f"Stored {chunks_stored} chunks",
                                current_phase="storing",
                                phase_detail="Complete"
                            )
                        else:
                            self._update_progress(
                                progress_id,
                                progress=98,
                                log="Skipped storage (no valid data)",
                                current_phase="storing",
                                phase_detail="Skipped"
                            )
                    except Exception as exc:
                        LOGGER.error("Storage failed: %s", exc)
                        self._update_progress(
                            progress_id, progress=98, log=f"Storage failed: {exc}", current_phase="storing", phase_detail="Failed"
                        )

            self._update_progress(
                progress_id, progress=100, status="completed", log="Crawl finished", current_phase="completed", phase_detail="Success"
            )
        except asyncio.CancelledError:
            self._update_progress(
                progress_id, status="cancelled", log="Crawl cancelled"
            )
            raise
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.exception("Crawl failed: %s", exc)
            self._update_progress(progress_id, status="failed", log=str(exc))
        finally:
            async with self._lock:
                self._tasks.pop(progress_id, None)

    async def _determine_urls(
        self,
        ctx: CrawlRequestContext,
        base_urls: Sequence[str],
        discovered: Optional[DiscoveredFile],
    ) -> List[str]:
        if not discovered:
            if ctx.mode == CrawlMode.SITEMAP:
                urls: List[str] = []
                for sitemap_url in base_urls:
                    urls.extend(await parse_sitemap(sitemap_url))
                return urls or list(base_urls)
            return list(base_urls)

        if is_llms_variant(discovered.url):
            urls = [
                line.strip()
                for line in discovered.content.splitlines()
                if line.strip().startswith("http")
            ]
            return urls or list(base_urls)

        if is_sitemap(discovered.url):
            urls = await parse_sitemap(discovered.url)
            return urls or list(base_urls)

        return list(base_urls)

    async def _hybrid_crawl_and_process(
        self,
        progress_id: str,
        ctx: CrawlRequestContext,
        urls: List[str],
    ) -> None:
        """
        Hybrid batch-stream processing:
        1. Crawl pages in batches (async parallel)
        2. Process each batch immediately (chunk → embed → store)
        3. Keep memory under control with batch limits
        """
        state = self._states[progress_id]
        cancel_event = state.cancel_event
        total_urls = len(urls)
        state.total_pages = total_urls
        
        LOGGER.info(f"Hybrid processing: {total_urls} URLs in batches of {HYBRID_PROCESS_BATCH}")
        
        processed_count = 0
        
        # Process in batches
        for batch_start in range(0, total_urls, HYBRID_PROCESS_BATCH):
            if cancel_event.is_set():
                break
            
            batch_end = min(batch_start + HYBRID_PROCESS_BATCH, total_urls)
            batch_urls = urls[batch_start:batch_end]
            batch_size = len(batch_urls)
            
            LOGGER.info(f"Processing batch {batch_start//HYBRID_PROCESS_BATCH + 1}: URLs {batch_start+1}-{batch_end}")
            
            # Phase 1: Crawl this batch (parallel)
            crawl_progress = 20 + int(40 * batch_start / total_urls)
            self._update_progress(
                progress_id,
                progress=crawl_progress,
                log=f"Crawling batch {batch_start+1}-{batch_end}/{total_urls}",
                current_phase="crawling",
                phase_detail=f"Batch {batch_start//HYBRID_PROCESS_BATCH + 1}"
            )
            
            batch_documents = await self._execute_crawl_batch(batch_urls, cancel_event)
            processed_count += len(batch_documents)
            state.processed_pages = processed_count
            
            if not batch_documents:
                continue
            
            # Phase 2: Chunk this batch
            chunk_progress = 60 + int(10 * processed_count / total_urls)
            self._update_progress(
                progress_id,
                progress=chunk_progress,
                log=f"Chunking batch {processed_count}/{total_urls}",
                current_phase="chunking",
                phase_detail=f"Processing {len(batch_documents)} pages"
            )
            
            try:
                batch_chunks = await self._chunk_documents(progress_id, batch_documents)
            except Exception as exc:
                LOGGER.error(f"Batch chunking failed: {exc}")
                continue
            
            # Phase 3: Summarize this batch (fallback summaries)
            batch_summaries = [chunk.text[:100] + "..." for chunk in batch_chunks]
            
            # Phase 4: Embed this batch
            embed_progress = 70 + int(12 * processed_count / total_urls)
            self._update_progress(
                progress_id,
                progress=embed_progress,
                log=f"Embedding batch {processed_count}/{total_urls} ({len(batch_chunks)} chunks)",
                current_phase="embedding",
                phase_detail=f"{len(batch_chunks)} chunks"
            )
            
            try:
                batch_embeddings = await self._embed_chunks(progress_id, batch_chunks)
            except Exception as exc:
                LOGGER.error(f"Batch embedding failed: {exc}")
                continue
            
            # Phase 5: Store this batch
            store_progress = 82 + int(16 * processed_count / total_urls)
            self._update_progress(
                progress_id,
                progress=store_progress,
                log=f"Storing batch {processed_count}/{total_urls}",
                current_phase="storing",
                phase_detail=f"{len(batch_chunks)} chunks"
            )
            
            try:
                chunks_stored = await self._store_chunks(
                    progress_id, ctx, batch_documents,
                    batch_chunks, batch_summaries, batch_embeddings
                )
                state.chunks_stored += chunks_stored
                LOGGER.info(f"Batch complete: stored {chunks_stored} chunks ({processed_count}/{total_urls} pages)")
            except Exception as exc:
                LOGGER.error(f"Batch storage failed: {exc}")
        
        LOGGER.info(f"Hybrid processing complete: {processed_count}/{total_urls} pages, {state.chunks_stored} chunks stored")
    
    async def _execute_crawl_batch(
        self,
        urls: List[str],
        cancel_event: Optional[asyncio.Event],
    ) -> List[PageResult]:
        """Crawl a batch of URLs in parallel."""
        results: List[PageResult] = []
        
        async def crawl_one(url: str) -> Optional[PageResult]:
            if cancel_event and cancel_event.is_set():
                return None
            try:
                return await crawl_single_page(self.crawler, url, cancel_event=cancel_event)
            except Exception as exc:
                LOGGER.warning(f"Failed to crawl {url}: {exc}")
                return None
        
        # Crawl all URLs in this batch concurrently
        batch_results = await asyncio.gather(*[crawl_one(url) for url in urls], return_exceptions=True)
        
        for result in batch_results:
            if isinstance(result, PageResult):
                results.append(result)
        
        return results

    async def _execute_crawl(
        self,
        progress_id: str,
        ctx: CrawlRequestContext,
        urls: List[str],
    ) -> List[PageResult]:
        state = self._states[progress_id]
        cancel_event = state.cancel_event
        processed: List[PageResult] = []
        
        # Set initial total_pages
        state.total_pages = len(urls)

        async def progress_callback(
            done: int, total: int, current_url: Optional[str]
        ) -> None:
            state.processed_pages = done
            state.total_pages = total  # Update total as it may change (recursive)
            state.current_url = current_url
            self._update_progress(
                progress_id,
                progress=20 + int(40 * (done / max(1, total))),
                log=f"Crawled {done}/{total}",
                current_url=current_url,
            )

        if not urls:
            return []

        mode = ctx.mode

        if mode == CrawlMode.SINGLE or len(urls) == 1:
            page = await crawl_single_page(
                self.crawler,
                urls[0],
                include_links=ctx.include_links,
                cancel_event=cancel_event,
            )
            processed.append(page)
            await progress_callback(1, 1, page.url)
            return processed

        if mode == CrawlMode.RECURSIVE:
            recursive_results = await crawl_recursive_with_progress(
                self.crawler,
                urls,
                max_depth=ctx.max_depth,
                max_pages=ctx.max_pages,
                same_domain_only=ctx.same_domain_only,
                include_links=ctx.include_links,
                progress_callback=progress_callback,
                cancel_event=cancel_event,
            )
            processed.extend(recursive_results)
            return processed

        batch_results = await crawl_batch_with_progress(
            self.crawler,
            urls,
            include_links=ctx.include_links,
            max_concurrency=ctx.max_concurrent or min(len(urls), 50),  # Increased to 50 for faster parallel crawls
            progress_callback=progress_callback,
            cancel_event=cancel_event,
        )
        processed.extend(batch_results)

        if mode == CrawlMode.SITEMAP:
            return processed

        if ctx.max_depth > 1 and ctx.include_links:
            recursive_results = await crawl_recursive_with_progress(
                self.crawler,
                [page.url for page in batch_results],
                max_depth=ctx.max_depth - 1,
                max_pages=ctx.max_pages,
                same_domain_only=ctx.same_domain_only,
                include_links=ctx.include_links,
                max_concurrent=ctx.max_concurrent,  # Pass through max_concurrent
                progress_callback=progress_callback,
                cancel_event=cancel_event,
            )
            processed.extend(recursive_results)

        return processed

    async def _chunk_documents(
        self,
        progress_id: str,
        documents: List[PageResult],
    ) -> List[Chunk]:
        """
        Chunk documents using smart chunking with tree-sitter code detection.

        Phase 4 (60-70%): Chunking with overlap and code detection.
        """
        state = self._states[progress_id]
        state.current_phase = "chunking"
        state.chunks_total = len(documents)
        state.chunks_processed = 0
        state.last_progress_percentage = 60

        self._update_progress(progress_id, progress=60, log="Chunking documents", current_phase="chunking", phase_detail="Starting", chunks_total=len(documents), chunks_processed=0)

        chunker = SmartChunker()
        all_chunks: List[Chunk] = []

        for doc_idx, doc in enumerate(documents):
            # Chunk this document
            doc_chunks = chunker.chunk_text(
                text=doc.markdown_content,
                source_path=doc.url,
                language_hint=None,  # Let tree-sitter detect
            )
            all_chunks.extend(doc_chunks)
            state.chunks_processed = doc_idx + 1

            # Update progress only on percentage change
            new_percentage = 60 + int(
                10 * (state.chunks_processed / state.chunks_total)
            )
            if new_percentage != state.last_progress_percentage:
                state.last_progress_percentage = new_percentage
                self._update_progress(
                    progress_id,
                    progress=new_percentage,
                    log=f"Chunked {state.chunks_processed}/{state.chunks_total} documents",
                    current_phase="chunking",
                    phase_detail=f"{state.chunks_processed}/{state.chunks_total} docs",
                    chunks_processed=state.chunks_processed,
                    chunks_total=state.chunks_total
                )

        # Log chunking stats
        routing_info = chunker.get_routing_info(all_chunks)
        LOGGER.info(
            "Chunking complete: %d total chunks (%d text, %d code)",
            routing_info["total_chunks"],
            routing_info["gte_chunks"],
            routing_info["coderank_chunks"],
        )

        return all_chunks

    async def _summarize_chunks(
        self,
        progress_id: str,
        chunks: List[Chunk],
    ) -> List[str]:
        """
        Generate MiniMax summaries for each chunk.

        Phase 5 (70-80%): Per-chunk summarization.
        """
        state = self._states[progress_id]
        state.current_phase = "summarizing"
        state.chunks_total = len(chunks)
        state.summaries_generated = 0
        state.last_progress_percentage = 70

        self._update_progress(progress_id, progress=70, log="Generating summaries", current_phase="summarizing", phase_detail="Starting", chunks_total=len(chunks), chunks_processed=0)

        # Initialize MiniMax provider
        try:
            provider = MiniMaxSummaryProvider()
        except Exception as exc:
            LOGGER.warning("MiniMax unavailable, using fallback summaries: %s", exc)
            # Fallback: use first 100 chars as summary
            return [chunk.text[:100] + "..." for chunk in chunks]

        summaries = []
        batch_size = 10  # Process summaries in batches

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]

            # Generate summaries for this batch
            batch_summaries = []
            for chunk in batch:
                try:
                    summary = await provider.summarize(chunk.text, max_length=200)
                    batch_summaries.append(summary)
                except Exception as exc:
                    LOGGER.warning("Summary failed for chunk, using fallback: %s", exc)
                    batch_summaries.append(chunk.text[:100] + "...")

            summaries.extend(batch_summaries)
            state.summaries_generated = len(summaries)

            # Update progress only on percentage change
            new_percentage = 70 + int(
                10 * (state.summaries_generated / state.chunks_total)
            )
            if new_percentage != state.last_progress_percentage:
                state.last_progress_percentage = new_percentage
                self._update_progress(
                    progress_id,
                    progress=new_percentage,
                    log=f"Summarized {state.summaries_generated}/{state.chunks_total} chunks",
                    current_phase="summarizing",
                    phase_detail=f"{state.summaries_generated}/{state.chunks_total} chunks",
                    chunks_processed=state.summaries_generated,
                    chunks_total=state.chunks_total
                )

        LOGGER.info("Generated %d summaries", len(summaries))
        return summaries

    async def _embed_chunks(
        self,
        progress_id: str,
        chunks: List[Chunk],
    ) -> List[List[float]]:
        """
        Smart router for embedding strategy selection.
        
        Automatically selects optimal strategy:
        - Single model: Direct processing (no parallelization overhead)
        - Both models + parallel enabled: Unified parallel batching
        - Both models + parallel disabled: Sequential processing (fallback)
        
        Phase 6 (80-92%): Embedding with model routing.
        """
        state = self._states[progress_id]
        state.current_phase = "embedding"
        state.embeddings_generated = 0
        state.last_progress_percentage = 80

        self._update_progress(progress_id, progress=80, log="Generating embeddings", current_phase="embedding", phase_detail="Starting", chunks_total=len(chunks), chunks_processed=0)

        # Count chunks by model
        gte_count = sum(1 for c in chunks if c.model_hint == "gte")
        coderank_count = sum(1 for c in chunks if c.model_hint == "coderank")
        
        LOGGER.info(
            "Embedding phase: %d total chunks (%d GTE, %d CodeRank)",
            len(chunks), gte_count, coderank_count
        )

        # Strategy selection
        if gte_count == 0 or coderank_count == 0:
            # Single model only - no need for parallelization
            LOGGER.info("Single model detected, using direct processing")
            return await self._embed_single_model(progress_id, chunks)
        
        elif ENABLE_PARALLEL_EMBEDDING:
            # Both models needed and parallel enabled
            LOGGER.info("Using parallel unified batching strategy")
            return await self._embed_parallel_unified(progress_id, chunks)
        
        else:
            # Fallback to sequential processing
            LOGGER.info("Parallel embedding disabled, using sequential processing")
            return await self._embed_sequential(progress_id, chunks)

    async def _embed_parallel_unified(
        self,
        progress_id: str,
        chunks: List[Chunk],
    ) -> List[List[float]]:
        """
        Process embeddings with unified parallel batching.
        
        Processes both GTE and CodeRank batches in coordinated rounds,
        maximizing parallel utilization throughout the entire embedding phase.
        
        Strategy:
        - Round 1: GTE[0:32] + CodeRank[0:32] in parallel
        - Round 2: GTE[32:64] + CodeRank[32:64] in parallel
        - Continue until both queues exhausted
        """
        state = self._states[progress_id]
        embedding_client = EmbeddingMonsterClient()
        
        # Separate chunks by model
        gte_queue = [
            (i, chunk) for i, chunk in enumerate(chunks) if chunk.model_hint == "gte"
        ]
        coderank_queue = [
            (i, chunk) for i, chunk in enumerate(chunks) if chunk.model_hint == "coderank"
        ]
        
        # Initialize results
        embeddings = [None] * len(chunks)
        batch_size = embedding_client.batch_size
        round_num = 0
        overall_start = time.time()
        
        # Metrics tracking
        metrics = {}
        
        # Process in coordinated rounds
        while gte_queue or coderank_queue:
            round_num += 1
            round_start = time.time()
            tasks = []
            
            # Prepare GTE batch for this round
            if gte_queue:
                gte_batch = gte_queue[:batch_size]
                gte_queue = gte_queue[batch_size:]
                gte_texts = [chunk.text for _, chunk in gte_batch]
                
                tasks.append({
                    "model": "gte",
                    "batch": gte_batch,
                    "task": embedding_client.embed_batch(gte_texts, model="gte")
                })
            
            # Prepare CodeRank batch for this round
            if coderank_queue:
                coderank_batch = coderank_queue[:batch_size]
                coderank_queue = coderank_queue[batch_size:]
                coderank_texts = [chunk.text for _, chunk in coderank_batch]
                
                tasks.append({
                    "model": "coderank",
                    "batch": coderank_batch,
                    "task": embedding_client.embed_batch(coderank_texts, model="coderank")
                })
            
            # Execute round in parallel
            try:
                results = await asyncio.gather(
                    *[t["task"] for t in tasks],
                    return_exceptions=True
                )
                
                round_elapsed = time.time() - round_start
                
                # Process results
                for i, task_def in enumerate(tasks):
                    model = task_def["model"]
                    batch = task_def["batch"]
                    result = results[i]
                    
                    if isinstance(result, Exception):
                        LOGGER.error(f"Round {round_num} - {model} failed: {result}")
                        # Use zero vectors for failed batch
                        for idx, _ in batch:
                            embeddings[idx] = [0.0] * 768
                        
                        # Track error in metrics
                        if model not in metrics:
                            metrics[model] = {
                                "chunks": 0, "batches": 0, "time": 0, "errors": 0
                            }
                        metrics[model]["errors"] += 1
                    else:
                        # Populate successful results
                        for (idx, _), emb in zip(batch, result):
                            embeddings[idx] = emb
                        
                        # Update metrics
                        if model not in metrics:
                            metrics[model] = {
                                "chunks": 0, "batches": 0, "time": 0, "errors": 0
                            }
                        metrics[model]["chunks"] += len(batch)
                        metrics[model]["batches"] += 1
                        metrics[model]["time"] = time.time() - overall_start
                
                # Update progress
                state.embeddings_generated = sum(1 for e in embeddings if e is not None)
                new_percentage = 80 + int(12 * (state.embeddings_generated / len(chunks)))
                if new_percentage != state.last_progress_percentage:
                    state.last_progress_percentage = new_percentage
                    self._update_progress(
                        progress_id,
                        progress=new_percentage,
                        log=f"Embedded {state.embeddings_generated}/{len(chunks)} chunks",
                        current_phase="embedding",
                        phase_detail=f"Content: {state.embeddings_generated}/{len(chunks)}",
                        chunks_processed=state.embeddings_generated,
                        chunks_total=len(chunks)
                    )
                
                # Log round completion
                models_str = " + ".join([t["model"] for t in tasks])
                LOGGER.info(
                    f"Round {round_num}: {models_str} completed in {round_elapsed:.2f}s"
                )
                
            except Exception as exc:
                LOGGER.error(f"Round {round_num} failed completely: {exc}", exc_info=True)
                # Fill remaining with zeros
                for i, e in enumerate(embeddings):
                    if e is None:
                        embeddings[i] = [0.0] * 768
                break
        
        # Log final metrics
        total_time = time.time() - overall_start
        
        if EMBEDDING_METRICS_ENABLED:
            LOGGER.info("=" * 60)
            LOGGER.info("Parallel Embedding Metrics:")
            LOGGER.info(f"  Total chunks: {len(chunks)}")
            LOGGER.info(f"  Total rounds: {round_num}")
            LOGGER.info(f"  Total time: {total_time:.2f}s")
            LOGGER.info(f"  Throughput: {len(chunks) / total_time:.1f} chunks/sec")
            
            for model, m in metrics.items():
                throughput = m["chunks"] / m["time"] if m["time"] > 0 else 0
                LOGGER.info(
                    f"  [{model.upper()}] {m['chunks']} chunks, "
                    f"{m['batches']} batches, "
                    f"{m['time']:.2f}s, "
                    f"{throughput:.1f} chunks/sec, "
                    f"{m['errors']} errors"
                )
            LOGGER.info("=" * 60)
        
        return embeddings

    async def _embed_single_model(
        self,
        progress_id: str,
        chunks: List[Chunk],
    ) -> List[List[float]]:
        """
        Process embeddings for single model (all GTE or all CodeRank).
        
        Optimized path when no parallelization is needed.
        """
        state = self._states[progress_id]
        embedding_client = EmbeddingMonsterClient()
        
        # Determine which model
        model = chunks[0].model_hint if chunks else "gte"
        
        LOGGER.info(f"Processing {len(chunks)} chunks with {model.upper()} model")
        
        start_time = time.time()
        texts = [chunk.text for chunk in chunks]
        embeddings = await embedding_client.embed_batch(texts, model=model)
        elapsed = time.time() - start_time
        
        # Update progress
        state.embeddings_generated = len(embeddings)
        self._update_progress(
            progress_id,
            progress=92,
            log=f"Embedded {len(embeddings)} chunks with {model}"
        )
        
        # Log metrics
        throughput = len(embeddings) / elapsed if elapsed > 0 else 0
        LOGGER.info(
            f"[{model.upper()}] {len(embeddings)} chunks in {elapsed:.2f}s "
            f"({throughput:.1f} chunks/sec)"
        )
        
        return embeddings

    async def _embed_sequential(
        self,
        progress_id: str,
        chunks: List[Chunk],
    ) -> List[List[float]]:
        """
        Process embeddings sequentially (original behavior).
        
        Fallback when parallel embedding is disabled.
        """
        state = self._states[progress_id]
        embedding_client = EmbeddingMonsterClient()

        # Separate chunks by model
        gte_chunks = [
            (i, chunk) for i, chunk in enumerate(chunks) if chunk.model_hint == "gte"
        ]
        coderank_chunks = [
            (i, chunk)
            for i, chunk in enumerate(chunks)
            if chunk.model_hint == "coderank"
        ]

        # Initialize embeddings array
        embeddings = [None] * len(chunks)

        # Generate GTE embeddings
        if gte_chunks:
            state.phase_detail = "Content embeddings"
            gte_texts = [chunk.text for _, chunk in gte_chunks]
            LOGGER.info("Generating %d GTE embeddings", len(gte_texts))
            
            start = time.time()
            gte_embeddings = await embedding_client.embed_batch(gte_texts, model="gte")
            elapsed = time.time() - start
            
            for (idx, _), embedding in zip(gte_chunks, gte_embeddings):
                embeddings[idx] = embedding
            state.embeddings_generated += len(gte_chunks)
            
            LOGGER.info(f"[GTE] {len(gte_chunks)} chunks in {elapsed:.2f}s")

            # Update progress
            new_percentage = 80 + int(6 * (state.embeddings_generated / len(chunks)))
            if new_percentage != state.last_progress_percentage:
                state.last_progress_percentage = new_percentage
                self._update_progress(
                    progress_id,
                    progress=new_percentage,
                    log=f"Embedded {len(gte_chunks)} text chunks",
                )

        # Generate CodeRank embeddings
        if coderank_chunks:
            state.phase_detail = "Code embeddings"
            coderank_texts = [chunk.text for _, chunk in coderank_chunks]
            LOGGER.info("Generating %d CodeRank embeddings", len(coderank_texts))
            
            start = time.time()
            coderank_embeddings = await embedding_client.embed_batch(
                coderank_texts, model="coderank"
            )
            elapsed = time.time() - start
            
            for (idx, _), embedding in zip(coderank_chunks, coderank_embeddings):
                embeddings[idx] = embedding
            state.embeddings_generated += len(coderank_chunks)
            
            LOGGER.info(f"[CODERANK] {len(coderank_chunks)} chunks in {elapsed:.2f}s")

            # Update progress
            new_percentage = 80 + int(12 * (state.embeddings_generated / len(chunks)))
            if new_percentage != state.last_progress_percentage:
                state.last_progress_percentage = new_percentage
                self._update_progress(
                    progress_id,
                    progress=new_percentage,
                    log=f"Embedded {len(coderank_chunks)} code chunks",
                )

        LOGGER.info("Generated %d total embeddings", len([e for e in embeddings if e]))
        return embeddings

    async def _store_chunks(
        self,
        progress_id: str,
        ctx: CrawlRequestContext,
        documents: List[PageResult],
        chunks: List[Chunk],
        summaries: List[str],
        embeddings: List[List[float]],
    ) -> int:
        """
        Store chunks with summaries and embeddings in Postgres and Qdrant.
        Also sync canonical metadata tables so dashboards reflect crawl results.
        """
        import uuid as uuid_lib

        state = self._states[progress_id]
        state.current_phase = "storing"
        state.phase_detail = "Preparing chunks"
        state.last_progress_percentage = 92

        self._update_progress(progress_id, progress=92, log="Storing chunks", current_phase="storing", phase_detail="Postgres + Qdrant", chunks_total=len(chunks), chunks_processed=0)

        scope_manager = ScopeManager()
        scope = scope_manager.resolve_scope(ctx.project, ctx.dataset, ctx.scope)
        collection_name = scope_manager.get_collection_name(
            ctx.project, ctx.dataset, scope
        )

        # Sync relational metadata if possible
        metadata_store: Optional[CanonicalMetadataStore] = None
        canonical_page_ids: Dict[str, uuid.UUID] = {}
        canonical_project_id: Optional[uuid.UUID] = None
        canonical_dataset_id: Optional[uuid.UUID] = None

        if documents:
            try:
                metadata_store = CanonicalMetadataStore()
                await metadata_store.initialize()
                ingest_result = await metadata_store.upsert_web_pages(
                    ctx.project, ctx.dataset, documents
                )
                canonical_project_id = ingest_result.project_id
                canonical_dataset_id = ingest_result.dataset_id
                canonical_page_ids = ingest_result.page_ids
                LOGGER.info(
                    "Canonical store: upserted %d web pages",
                    len(canonical_page_ids),
                )
                
                # ✅ FIX: Also write chunks to canonical chunks table so frontend shows them
                try:
                    chunks_written = await metadata_store.upsert_chunks(
                        dataset_id=canonical_dataset_id,
                        page_ids=canonical_page_ids,
                        chunks=chunks,
                        summaries=summaries,
                        embeddings=embeddings,
                    )
                    LOGGER.info(
                        "Canonical store: upserted %d chunks to claude_context.chunks table",
                        chunks_written,
                    )
                except Exception as chunk_exc:
                    LOGGER.error(
                        "Canonical chunks ingestion failed: %s", chunk_exc, exc_info=True
                    )
            except Exception as meta_exc:
                LOGGER.error(
                    "Canonical web page ingestion failed: %s", meta_exc, exc_info=True
                )
                if metadata_store:
                    await metadata_store.close()
                    metadata_store = None

        project_id = (
            str(canonical_project_id)
            if canonical_project_id
            else scope_manager.get_project_id(ctx.project)
        )
        dataset_id = (
            str(canonical_dataset_id)
            if canonical_dataset_id
            else scope_manager.get_dataset_id(ctx.dataset)
        )

        LOGGER.info(
            "Storing %d chunks in scope=%s, collection=%s",
            len(chunks),
            scope.value,
            collection_name,
        )

        postgres_store = PostgresVectorStore()
        qdrant_store = QdrantVectorStore()

        try:
            dimension = len(embeddings[0]) if embeddings and embeddings[0] else 768

            await postgres_store.initialize()
            await qdrant_store.initialize()
            await postgres_store.create_chunks_collection(collection_name, dimension)
            await qdrant_store.create_collection(collection_name, dimension)

            stored_chunks = []
            for chunk, summary, embedding in zip(chunks, summaries, embeddings):
                if not embedding:
                    LOGGER.warning("Skipping chunk without embedding")
                    continue

                web_page_uuid = canonical_page_ids.get(chunk.source_path)
                metadata = {
                    "confidence": chunk.confidence,
                    "is_code": chunk.is_code,
                    "language": chunk.language,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                }
                if web_page_uuid:
                    metadata["web_page_id"] = str(web_page_uuid)

                stored_chunk = StoredChunk(
                    id=str(uuid_lib.uuid4()),
                    chunk_text=chunk.text,
                    summary=summary,
                    vector=embedding,
                    is_code=chunk.is_code,
                    language=chunk.language,
                    relative_path=chunk.source_path,
                    chunk_index=chunk.chunk_index,
                    start_char=chunk.start_char,
                    end_char=chunk.end_char,
                    model_used=chunk.model_hint,
                    project_id=project_id,
                    dataset_id=dataset_id,
                    scope=scope.value,
                    metadata=metadata,
                )
                stored_chunks.append(stored_chunk)

            postgres_count = 0
            qdrant_count = 0

            try:
                state.phase_detail = "Postgres"
                new_percentage = 94
                if new_percentage != state.last_progress_percentage:
                    state.last_progress_percentage = new_percentage
                    self._update_progress(
                        progress_id,
                        progress=new_percentage,
                        log="Inserting into Postgres",
                    )
                postgres_count = await postgres_store.insert_chunks(
                    collection_name, stored_chunks
                )
                LOGGER.info("Postgres: Stored %d chunks", postgres_count)
            except Exception as pg_exc:
                LOGGER.error("Postgres storage failed: %s", pg_exc, exc_info=True)

            try:
                state.phase_detail = "Qdrant"
                new_percentage = 96
                if new_percentage != state.last_progress_percentage:
                    state.last_progress_percentage = new_percentage
                    self._update_progress(
                        progress_id,
                        progress=new_percentage,
                        log="Inserting into Qdrant",
                    )
                qdrant_count = await qdrant_store.insert_chunks(
                    collection_name, stored_chunks
                )
                LOGGER.info("Qdrant: Stored %d chunks", qdrant_count)
            except Exception as qd_exc:
                LOGGER.error("Qdrant storage failed: %s", qd_exc, exc_info=True)

            if metadata_store and canonical_dataset_id and canonical_page_ids:
                try:
                    canonical_count = await metadata_store.upsert_chunks(
                        canonical_dataset_id,
                        canonical_page_ids,
                        chunks,
                        summaries,
                        embeddings,
                    )
                    LOGGER.info(
                        "Canonical store: upserted %d chunks into claude_context.chunks",
                        canonical_count,
                    )
                except Exception as meta_exc:
                    LOGGER.error(
                        "Canonical chunk ingestion failed: %s", meta_exc, exc_info=True
                    )

            LOGGER.info(
                "Storage complete: Total=%d, Postgres=%d, Qdrant=%d",
                len(stored_chunks),
                postgres_count,
                qdrant_count,
            )

            return postgres_count + qdrant_count if qdrant_count > 0 else postgres_count

        except Exception as exc:
            LOGGER.error("Storage failed: %s", exc, exc_info=True)
            return 0
        finally:
            await postgres_store.close()
            await qdrant_store.close()
            if metadata_store:
                await metadata_store.close()

    def _update_progress(
        self,
        progress_id: str,
        *,
        progress: Optional[int] = None,
        status: Optional[str] = None,
        log: Optional[str] = None,
        current_url: Optional[str] = None,
        current_phase: Optional[str] = None,
        phase_detail: Optional[str] = None,
        chunks_processed: Optional[int] = None,
        chunks_total: Optional[int] = None,
    ) -> None:
        state = self._states.get(progress_id)
        if not state:
            return
        if progress is not None:
            state.progress = max(state.progress, progress)
        if status is not None:
            state.status = status
        if log is not None:
            state.log = log
        if current_url is not None:
            state.current_url = current_url
        if current_phase is not None:
            state.current_phase = current_phase
        if phase_detail is not None:
            state.phase_detail = phase_detail
        if chunks_processed is not None:
            state.chunks_processed = chunks_processed
        if chunks_total is not None:
            state.chunks_total = chunks_total

    def get_progress(self, progress_id: str) -> Optional[ProgressState]:
        return self._states.get(progress_id)

    async def cancel(self, progress_id: str) -> bool:
        state = self._states.get(progress_id)
        if not state:
            return False
        state.cancel_event.set()
        task = self._tasks.get(progress_id)
        if task:
            task.cancel()
        return True


crawling_service = CrawlingService()


__all__ = [
    "CrawlingService",
    "crawling_service",
    "ProgressState",
    "CrawlRequestContext",
]
