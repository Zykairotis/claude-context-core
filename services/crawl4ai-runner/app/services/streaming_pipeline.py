"""
Streaming pipeline for concurrent crawl → chunk → embed → store.

This module implements a producer-consumer pattern where pages flow through
the pipeline stages in parallel, maximizing throughput and minimizing idle time.
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime

from ..strategies.single_page import PageResult
from ..chunking.smart_chunker import SmartChunker, Chunk
from ..storage.embedding_monster_client import EmbeddingMonsterClient


LOGGER = logging.getLogger(__name__)


@dataclass
class PipelineItem:
    """Item flowing through the pipeline."""
    page: Optional[PageResult] = None
    chunks: Optional[List[Chunk]] = None
    summaries: Optional[List[str]] = None
    embeddings: Optional[List[List[float]]] = None
    page_index: int = 0
    stage: str = "crawled"
    timestamp: float = 0.0


class StreamingPipeline:
    """
    Streaming pipeline for parallel processing.
    
    Architecture:
    - Crawl Queue → pages being fetched
    - Chunk Queue → pages waiting to be chunked
    - Embed Queue → chunks waiting to be embedded
    - Store Queue → embeddings waiting to be stored
    
    Workers run concurrently, processing items as they arrive.
    """
    
    def __init__(
        self,
        *,
        max_crawl_workers: int = 20,
        max_chunk_workers: int = 4,
        max_embed_workers: int = 2,
        max_store_workers: int = 2,
    ):
        """
        Initialize streaming pipeline.
        
        Args:
            max_crawl_workers: Concurrent crawl operations
            max_chunk_workers: Concurrent chunking operations
            max_embed_workers: Concurrent embedding operations
            max_store_workers: Concurrent storage operations
        """
        self.max_crawl_workers = max_crawl_workers
        self.max_chunk_workers = max_chunk_workers
        self.max_embed_workers = max_embed_workers
        self.max_store_workers = max_store_workers
        
        # Queues between stages
        self.crawl_queue: asyncio.Queue = asyncio.Queue()
        self.chunk_queue: asyncio.Queue = asyncio.Queue(maxsize=50)
        self.embed_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.store_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        
        # Results collection
        self.completed_items: List[PipelineItem] = []
        self.errors: List[Dict[str, Any]] = []
        
        # Progress tracking
        self.stats = {
            "pages_crawled": 0,
            "pages_chunked": 0,
            "pages_embedded": 0,
            "pages_stored": 0,
            "total_chunks": 0,
            "errors": 0,
        }
        
        # Components
        self.chunker = SmartChunker()
        self.embedding_client = EmbeddingMonsterClient()
        
        # Cancellation
        self.cancel_event = asyncio.Event()
    
    async def run(
        self,
        crawler_coro,
        storage_func,
        progress_callback=None,
    ) -> List[PipelineItem]:
        """
        Run the streaming pipeline.
        
        Args:
            crawler_coro: Async generator that yields crawled pages
            storage_func: Async function to store chunks (page, chunks, summaries, embeddings)
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of completed pipeline items
        """
        # Start all worker tasks
        workers = [
            asyncio.create_task(self._chunk_worker(progress_callback)),
            asyncio.create_task(self._chunk_worker(progress_callback)),
            asyncio.create_task(self._chunk_worker(progress_callback)),
            asyncio.create_task(self._chunk_worker(progress_callback)),
            
            asyncio.create_task(self._embed_worker(progress_callback)),
            asyncio.create_task(self._embed_worker(progress_callback)),
            
            asyncio.create_task(self._store_worker(storage_func, progress_callback)),
            asyncio.create_task(self._store_worker(storage_func, progress_callback)),
        ]
        
        try:
            # Feed crawled pages into chunk queue
            async for page_index, page in crawler_coro:
                if self.cancel_event.is_set():
                    break
                
                item = PipelineItem(
                    page=page,
                    page_index=page_index,
                    stage="crawled",
                    timestamp=asyncio.get_event_loop().time()
                )
                
                await self.chunk_queue.put(item)
                self.stats["pages_crawled"] += 1
                
                if progress_callback:
                    await progress_callback("crawl", self.stats)
            
            # Signal no more pages coming
            for _ in range(self.max_chunk_workers):
                await self.chunk_queue.put(None)
            
            # Wait for all workers to complete
            await asyncio.gather(*workers, return_exceptions=True)
            
        except Exception as exc:
            LOGGER.error(f"Pipeline error: {exc}", exc_info=True)
            self.cancel_event.set()
            raise
        finally:
            # Cancel any remaining workers
            for worker in workers:
                if not worker.done():
                    worker.cancel()
        
        return self.completed_items
    
    async def _chunk_worker(self, progress_callback=None):
        """Worker that chunks pages as they arrive."""
        while not self.cancel_event.is_set():
            try:
                item = await asyncio.wait_for(
                    self.chunk_queue.get(),
                    timeout=1.0
                )
                
                if item is None:  # Sentinel value
                    # Pass sentinel to next stage
                    await self.embed_queue.put(None)
                    break
                
                # Chunk the page
                chunks = self.chunker.chunk_text(
                    text=item.page.markdown_content,
                    source_path=item.page.url,
                    language_hint=None,
                )
                
                item.chunks = chunks
                item.stage = "chunked"
                self.stats["pages_chunked"] += 1
                self.stats["total_chunks"] += len(chunks)
                
                # Send to embedding queue
                await self.embed_queue.put(item)
                
                if progress_callback:
                    await progress_callback("chunk", self.stats)
                
            except asyncio.TimeoutError:
                continue
            except Exception as exc:
                LOGGER.error(f"Chunk worker error: {exc}", exc_info=True)
                self.stats["errors"] += 1
                self.errors.append({
                    "stage": "chunking",
                    "error": str(exc),
                    "page": item.page.url if item and item.page else "unknown"
                })
    
    async def _embed_worker(self, progress_callback=None):
        """Worker that embeds chunks as they arrive."""
        while not self.cancel_event.is_set():
            try:
                item = await asyncio.wait_for(
                    self.embed_queue.get(),
                    timeout=1.0
                )
                
                if item is None:  # Sentinel value
                    # Pass sentinel to next stage
                    await self.store_queue.put(None)
                    break
                
                # Embed the chunks
                embeddings = []
                
                # Group chunks by model
                gte_chunks = [(i, c) for i, c in enumerate(item.chunks) if c.model_hint == "gte"]
                coderank_chunks = [(i, c) for i, c in enumerate(item.chunks) if c.model_hint == "coderank"]
                
                # Initialize result array
                embeddings = [None] * len(item.chunks)
                
                # Embed both types in parallel
                tasks = []
                if gte_chunks:
                    gte_texts = [c.text for _, c in gte_chunks]
                    tasks.append(("gte", gte_chunks, self.embedding_client.embed_batch(gte_texts, model="gte")))
                
                if coderank_chunks:
                    code_texts = [c.text for _, c in coderank_chunks]
                    tasks.append(("coderank", coderank_chunks, self.embedding_client.embed_batch(code_texts, model="coderank")))
                
                # Execute in parallel
                results = await asyncio.gather(*[t[2] for t in tasks], return_exceptions=True)
                
                # Populate embeddings array
                for i, (model, chunks, _) in enumerate(tasks):
                    result = results[i]
                    if isinstance(result, Exception):
                        LOGGER.error(f"Embedding failed for {model}: {result}")
                        # Use zero vectors
                        for idx, _ in chunks:
                            embeddings[idx] = [0.0] * 768
                    else:
                        for (idx, _), emb in zip(chunks, result):
                            embeddings[idx] = emb
                
                item.embeddings = embeddings
                item.stage = "embedded"
                self.stats["pages_embedded"] += 1
                
                # Send to storage queue
                await self.store_queue.put(item)
                
                if progress_callback:
                    await progress_callback("embed", self.stats)
                
            except asyncio.TimeoutError:
                continue
            except Exception as exc:
                LOGGER.error(f"Embed worker error: {exc}", exc_info=True)
                self.stats["errors"] += 1
                self.errors.append({
                    "stage": "embedding",
                    "error": str(exc),
                    "page": item.page.url if item and item.page else "unknown"
                })
    
    async def _store_worker(self, storage_func, progress_callback=None):
        """Worker that stores chunks as they arrive."""
        while not self.cancel_event.is_set():
            try:
                item = await asyncio.wait_for(
                    self.store_queue.get(),
                    timeout=1.0
                )
                
                if item is None:  # Sentinel value
                    break
                
                # Store the chunks
                try:
                    # Generate dummy summaries for now
                    summaries = [f"Summary for chunk {i}" for i in range(len(item.chunks))]
                    item.summaries = summaries
                    
                    # Call storage function
                    await storage_func(item.page, item.chunks, summaries, item.embeddings)
                    
                    item.stage = "stored"
                    self.stats["pages_stored"] += 1
                    self.completed_items.append(item)
                    
                    if progress_callback:
                        await progress_callback("store", self.stats)
                    
                except Exception as store_exc:
                    LOGGER.error(f"Storage failed: {store_exc}", exc_info=True)
                    self.stats["errors"] += 1
                    self.errors.append({
                        "stage": "storage",
                        "error": str(store_exc),
                        "page": item.page.url if item and item.page else "unknown"
                    })
                
            except asyncio.TimeoutError:
                continue
            except Exception as exc:
                LOGGER.error(f"Store worker error: {exc}", exc_info=True)
                self.stats["errors"] += 1
