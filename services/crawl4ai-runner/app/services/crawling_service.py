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
from .code_extraction_service import CodeExample, CodeExtractionService, DocumentSnapshot
from .discovery_service import DiscoveredFile, DiscoveryService
from .minimax_summary_provider import MiniMaxSummaryProvider

from ..storage import (
    EmbeddingMonsterClient,
    PostgresVectorStore,
    QdrantVectorStore,
    StoredDocument,
    StoredChunk,
    ScopeManager,
)
from ..chunking import SmartChunker, Chunk


LOGGER = logging.getLogger(__name__)


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
    scope: Optional[str] = None


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

    async def _async_orchestrate_crawl(self, progress_id: str, ctx: CrawlRequestContext) -> None:
        state = self._states[progress_id]
        try:
            await self.crawler.initialize()

            urls = [ensure_https(url) for url in ctx.urls]
            discovered: Optional[DiscoveredFile] = None
            if ctx.auto_discovery:
                self._update_progress(progress_id, progress=5, log="Running discovery")
                discovered = await self.discovery.discover_files(urls)
                self._update_progress(progress_id, progress=15, log="Discovery complete")

            crawl_urls = await self._determine_urls(ctx, urls, discovered)
            state.total_pages = len(crawl_urls)
            self._update_progress(progress_id, progress=20, log="Starting crawl", current_url=None)

            # Phase 3: Crawling (20-60%)
            documents = await self._execute_crawl(progress_id, ctx, crawl_urls)
            state.documents = documents
            self._update_progress(progress_id, progress=60, log="Crawling complete")

            # Phase 4-7: Chunking, Summarization, Embedding, Storage
            if documents and (ctx.project or ctx.dataset):
                # Phase 4: Chunking (60-70%)
                try:
                    chunks = await self._chunk_documents(progress_id, documents)
                except Exception as exc:
                    LOGGER.error("Chunking failed, using fallback: %s", exc)
                    chunks = []  # Continue with empty chunks
                    self._update_progress(progress_id, progress=70, log=f"Chunking failed: {exc}")
                
                # Phase 5: Summarization (70-80%)
                try:
                    summaries = await self._summarize_chunks(progress_id, chunks) if chunks else []
                except Exception as exc:
                    LOGGER.error("Summarization failed, using fallback: %s", exc)
                    summaries = [chunk.text[:100] + "..." for chunk in chunks]  # Fallback
                    self._update_progress(progress_id, progress=80, log=f"Summarization failed: {exc}")
                
                # Phase 6: Embedding (80-92%)
                try:
                    embeddings = await self._embed_chunks(progress_id, chunks) if chunks else []
                except Exception as exc:
                    LOGGER.error("Embedding failed: %s", exc)
                    embeddings = []
                    self._update_progress(progress_id, progress=92, log=f"Embedding failed: {exc}")
                
                # Phase 7: Storage (92-98%)
                try:
                    chunks_stored = 0
                    if chunks and summaries and embeddings:
                        chunks_stored = await self._store_chunks(
                            progress_id, ctx, chunks, summaries, embeddings
                        )
                        state.chunks_stored = chunks_stored
                        self._update_progress(progress_id, progress=98, log=f"Stored {chunks_stored} chunks")
                    else:
                        self._update_progress(progress_id, progress=98, log="Skipped storage (no valid data)")
                except Exception as exc:
                    LOGGER.error("Storage failed: %s", exc)
                    self._update_progress(progress_id, progress=98, log=f"Storage failed: {exc}")

            self._update_progress(progress_id, progress=100, status="completed", log="Crawl finished")
        except asyncio.CancelledError:
            self._update_progress(progress_id, status="cancelled", log="Crawl cancelled")
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
            urls = [line.strip() for line in discovered.content.splitlines() if line.strip().startswith("http")]
            return urls or list(base_urls)

        if is_sitemap(discovered.url):
            urls = await parse_sitemap(discovered.url)
            return urls or list(base_urls)

        return list(base_urls)

    async def _execute_crawl(
        self,
        progress_id: str,
        ctx: CrawlRequestContext,
        urls: List[str],
    ) -> List[PageResult]:
        state = self._states[progress_id]
        cancel_event = state.cancel_event
        processed: List[PageResult] = []

        async def progress_callback(done: int, total: int, current_url: Optional[str]) -> None:
            state.processed_pages = done
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
            max_concurrency=min(len(urls), 10),
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
        
        self._update_progress(progress_id, progress=60, log="Chunking documents")
        
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
            new_percentage = 60 + int(10 * (state.chunks_processed / state.chunks_total))
            if new_percentage != state.last_progress_percentage:
                state.last_progress_percentage = new_percentage
                self._update_progress(
                    progress_id,
                    progress=new_percentage,
                    log=f"Chunked {state.chunks_processed}/{state.chunks_total} documents",
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
        
        self._update_progress(progress_id, progress=70, log="Generating summaries")
        
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
            new_percentage = 70 + int(10 * (state.summaries_generated / state.chunks_total))
            if new_percentage != state.last_progress_percentage:
                state.last_progress_percentage = new_percentage
                self._update_progress(
                    progress_id,
                    progress=new_percentage,
                    log=f"Summarized {state.summaries_generated}/{state.chunks_total} chunks",
                )
        
        LOGGER.info("Generated %d summaries", len(summaries))
        return summaries

    async def _embed_chunks(
        self,
        progress_id: str,
        chunks: List[Chunk],
    ) -> List[List[float]]:
        """
        Generate embeddings for chunks, routing to GTE or CodeRank.
        
        Phase 6 (80-92%): Embedding with model routing.
        """
        state = self._states[progress_id]
        state.current_phase = "embedding"
        state.embeddings_generated = 0
        state.last_progress_percentage = 80
        
        self._update_progress(progress_id, progress=80, log="Generating embeddings")
        
        embedding_client = EmbeddingMonsterClient()
        
        # Separate chunks by model
        gte_chunks = [(i, chunk) for i, chunk in enumerate(chunks) if chunk.model_hint == "gte"]
        coderank_chunks = [(i, chunk) for i, chunk in enumerate(chunks) if chunk.model_hint == "coderank"]
        
        # Initialize embeddings array
        embeddings = [None] * len(chunks)
        
        # Generate GTE embeddings
        if gte_chunks:
            state.phase_detail = "Content embeddings"
            gte_texts = [chunk.text for _, chunk in gte_chunks]
            LOGGER.info("Generating %d GTE embeddings", len(gte_texts))
            gte_embeddings = await embedding_client.embed_batch(gte_texts, model="gte")
            for (idx, _), embedding in zip(gte_chunks, gte_embeddings):
                embeddings[idx] = embedding
            state.embeddings_generated += len(gte_chunks)
            
            # Update progress only on percentage change
            new_percentage = 80 + int(6 * (state.embeddings_generated / len(chunks)))
            if new_percentage != state.last_progress_percentage:
                state.last_progress_percentage = new_percentage
                self._update_progress(progress_id, progress=new_percentage, log=f"Embedded {len(gte_chunks)} text chunks")
        
        # Generate CodeRank embeddings
        if coderank_chunks:
            state.phase_detail = "Code embeddings"
            coderank_texts = [chunk.text for _, chunk in coderank_chunks]
            LOGGER.info("Generating %d CodeRank embeddings", len(coderank_texts))
            coderank_embeddings = await embedding_client.embed_batch(coderank_texts, model="coderank")
            for (idx, _), embedding in zip(coderank_chunks, coderank_embeddings):
                embeddings[idx] = embedding
            state.embeddings_generated += len(coderank_chunks)
            
            # Update progress only on percentage change
            new_percentage = 80 + int(12 * (state.embeddings_generated / len(chunks)))
            if new_percentage != state.last_progress_percentage:
                state.last_progress_percentage = new_percentage
                self._update_progress(progress_id, progress=new_percentage, log=f"Embedded {len(coderank_chunks)} code chunks")
        
        LOGGER.info("Generated %d total embeddings", len([e for e in embeddings if e]))
        return embeddings

    async def _store_chunks(
        self,
        progress_id: str,
        ctx: CrawlRequestContext,
        chunks: List[Chunk],
        summaries: List[str],
        embeddings: List[List[float]],
    ) -> int:
        """
        Store chunks with summaries and embeddings in Postgres and Qdrant.
        
        Phase 7 (92-98%): Storage with scope management.
        """
        import uuid as uuid_lib
        
        state = self._states[progress_id]
        state.current_phase = "storing"
        state.phase_detail = "Preparing chunks"
        state.last_progress_percentage = 92
        
        self._update_progress(progress_id, progress=92, log="Storing chunks")
        
        # Initialize scope manager
        scope_manager = ScopeManager()
        scope = scope_manager.resolve_scope(ctx.project, ctx.dataset, ctx.scope)
        collection_name = scope_manager.get_collection_name(ctx.project, ctx.dataset, scope)
        project_id = scope_manager.get_project_id(ctx.project)
        dataset_id = scope_manager.get_dataset_id(ctx.dataset)
        
        LOGGER.info(
            "Storing %d chunks in scope=%s, collection=%s",
            len(chunks),
            scope.value,
            collection_name,
        )
        
        # Initialize storage clients
        postgres_store = PostgresVectorStore()
        qdrant_store = QdrantVectorStore()
        
        try:
            # Determine dimension from first embedding
            dimension = len(embeddings[0]) if embeddings and embeddings[0] else 768
            
            # Initialize collections
            await postgres_store.initialize()
            await qdrant_store.initialize()
            await postgres_store.create_chunks_collection(collection_name, dimension)
            await qdrant_store.create_collection(collection_name, dimension)
            
            # Prepare stored chunks
            stored_chunks = []
            for chunk, summary, embedding in zip(chunks, summaries, embeddings):
                if embedding is None:
                    LOGGER.warning("Skipping chunk without embedding")
                    continue
                
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
                    metadata={
                        "confidence": chunk.confidence,
                    },
                )
                stored_chunks.append(stored_chunk)
            
            # Store in both databases independently (don't fail one if the other fails)
            postgres_count = 0
            qdrant_count = 0
            
            # Try Postgres first
            try:
                state.phase_detail = "Postgres"
                new_percentage = 94
                if new_percentage != state.last_progress_percentage:
                    state.last_progress_percentage = new_percentage
                    self._update_progress(progress_id, progress=new_percentage, log="Inserting into Postgres")
                postgres_count = await postgres_store.insert_chunks(collection_name, stored_chunks)
                LOGGER.info("Postgres: Stored %d chunks", postgres_count)
            except Exception as pg_exc:
                LOGGER.error("Postgres storage failed: %s", pg_exc, exc_info=True)
            
            # Try Qdrant (even if Postgres failed)
            try:
                state.phase_detail = "Qdrant"
                new_percentage = 96
                if new_percentage != state.last_progress_percentage:
                    state.last_progress_percentage = new_percentage
                    self._update_progress(progress_id, progress=new_percentage, log="Inserting into Qdrant")
                qdrant_count = await qdrant_store.insert_chunks(collection_name, stored_chunks)
                LOGGER.info("Qdrant: Stored %d chunks", qdrant_count)
            except Exception as qd_exc:
                LOGGER.error("Qdrant storage failed: %s", qd_exc, exc_info=True)
            
            LOGGER.info(
                "Storage complete: Total=%d, Postgres=%d, Qdrant=%d",
                len(stored_chunks),
                postgres_count,
                qdrant_count,
            )
            
            # Return total successfully stored (in either database)
            return postgres_count + qdrant_count if qdrant_count > 0 else postgres_count
        
        except Exception as exc:
            LOGGER.error("Storage failed: %s", exc, exc_info=True)
            return 0
        finally:
            await postgres_store.close()
            await qdrant_store.close()

    def _update_progress(
        self,
        progress_id: str,
        *,
        progress: Optional[int] = None,
        status: Optional[str] = None,
        log: Optional[str] = None,
        current_url: Optional[str] = None,
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


__all__ = ["CrawlingService", "crawling_service", "ProgressState", "CrawlRequestContext"]
