"""Recursive crawling strategy using depth-based parallel batching."""

from __future__ import annotations

import asyncio
import os
from typing import Iterable, List, Optional, Set
from urllib.parse import urldefrag

try:
    from crawl4ai import CacheMode, CrawlerRunConfig, MemoryAdaptiveDispatcher
except ImportError:
    CacheMode = None
    CrawlerRunConfig = None
    MemoryAdaptiveDispatcher = None

from ..crawler import CrawlerManager
from ..helpers import is_binary_file, normalize_url
from .single_page import PageResult


async def crawl_recursive_with_progress(
    crawler: CrawlerManager,
    seed_urls: Iterable[str],
    *,
    max_depth: int = 2,
    max_pages: int = 50,
    same_domain_only: bool = True,
    include_links: bool = True,
    progress_callback=None,
    cancel_event: Optional[asyncio.Event] = None,
    max_concurrent: Optional[int] = None,
) -> List[PageResult]:
    """
    Recursively crawl internal links using depth-based parallel batching.
    
    This implementation uses:
    - Depth-level processing for better progress visibility
    - Parallel batch crawling with configurable concurrency
    - Memory-adaptive throttling to prevent OOM
    - Native link extraction from crawl4ai results
    """
    # Configuration from environment with safe defaults
    batch_size = max(1, int(os.getenv("CRAWL_BATCH_SIZE", "50")))
    if max_concurrent is None:
        max_concurrent = max(1, int(os.getenv("CRAWL_MAX_CONCURRENT", "10")))
    memory_threshold = min(99.0, max(10.0, float(os.getenv("MEMORY_THRESHOLD_PERCENT", "80"))))
    
    # Initialize tracking
    visited: Set[str] = set()
    results: List[PageResult] = []
    total_processed = 0
    total_discovered = 0
    
    def normalize(url: str) -> str:
        """Normalize URL by removing fragments"""
        return urldefrag(url)[0]
    
    # Start with normalized seed URLs
    current_urls = {normalize(url) for url in seed_urls}
    total_discovered = len(current_urls)
    seed_domains = {normalize(url).split("//", 1)[-1].split("/", 1)[0] for url in seed_urls}
    
    # Setup memory-adaptive dispatcher if available
    dispatcher = None
    if MemoryAdaptiveDispatcher:
        dispatcher = MemoryAdaptiveDispatcher(
            memory_threshold_percent=memory_threshold,
            check_interval=0.5,
            max_session_permit=max_concurrent,
        )
    
    # Setup crawler config if available
    run_config = None
    if CrawlerRunConfig and CacheMode:
        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            stream=True,
            page_timeout=int(os.getenv("CRAWL_PAGE_TIMEOUT", "30000")),
            wait_until=os.getenv("CRAWL_WAIT_STRATEGY", "domcontentloaded"),
        )
    
    # Crawl depth by depth
    for depth in range(max_depth):
        # Check cancellation at start of each depth
        if cancel_event and cancel_event.is_set():
            raise asyncio.CancelledError()
        
        # Get URLs to crawl at this depth (not yet visited)
        urls_to_crawl = [url for url in current_urls if url not in visited]
        if not urls_to_crawl:
            break
        
        # Respect max_pages limit
        if max_pages > 0 and len(results) >= max_pages:
            break
        
        # Report depth-level progress
        if progress_callback:
            depth_progress = int((depth / max(max_depth, 1)) * 100)
            await progress_callback(
                total_processed,
                total_discovered,
                f"Depth {depth + 1}/{max_depth}: {len(urls_to_crawl)} URLs to crawl"
            )
        
        next_level_urls: Set[str] = set()
        depth_successful = 0
        
        # Process URLs in batches for memory efficiency
        for batch_idx in range(0, len(urls_to_crawl), batch_size):
            # Check cancellation before each batch
            if cancel_event and cancel_event.is_set():
                raise asyncio.CancelledError()
            
            # Respect max_pages limit
            if max_pages > 0 and len(results) >= max_pages:
                break
            
            batch_urls = urls_to_crawl[batch_idx : batch_idx + batch_size]
            batch_end_idx = min(batch_idx + batch_size, len(urls_to_crawl))
            
            # Report batch progress
            if progress_callback:
                progress_within_depth = (batch_idx / len(urls_to_crawl)) if urls_to_crawl else 0
                overall_progress = int(((depth + progress_within_depth) / max_depth) * 100)
                await progress_callback(
                    total_processed,
                    total_discovered,
                    f"Crawling batch {batch_idx + 1}-{batch_end_idx}/{len(urls_to_crawl)} at depth {depth + 1}"
                )
            
            # Crawl batch in parallel using arun_many
            try:
                async for result in crawler.crawl_many(
                    urls=batch_urls,
                    config=run_config,
                    dispatcher=dispatcher,
                ):
                    # Check cancellation during streaming results
                    if cancel_event and cancel_event.is_set():
                        raise asyncio.CancelledError()
                    
                    # Respect max_pages limit
                    if max_pages > 0 and len(results) >= max_pages:
                        break
                    
                    norm_url = normalize(result.url)
                    visited.add(norm_url)
                    total_processed += 1
                    
                    # Only process successful results with content
                    if not result.success or not result.markdown:
                        continue
                    
                    # Extract title
                    title = None
                    if result.html:
                        import re
                        title_match = re.search(r'<title[^>]*>(.*?)</title>', result.html, re.IGNORECASE | re.DOTALL)
                        if title_match:
                            title = title_match.group(1).strip()
                    
                    # Get markdown content
                    markdown_content = getattr(result.markdown, "fit_markdown", None) or getattr(result.markdown, "raw_markdown", "")
                    
                    # Create PageResult
                    page = PageResult(
                        url=result.url,
                        source_url=None,  # We don't track parent in batch mode
                        title=title,
                        html_content=result.html or "",
                        markdown_content=markdown_content,
                        word_count=len(markdown_content.split()) if markdown_content else 0,
                        char_count=len(markdown_content) if markdown_content else 0,
                        discovered_links=[],  # Will populate if include_links
                        metadata={
                            "depth": depth,
                            "batch_idx": batch_idx,
                        },
                    )
                    
                    results.append(page)
                    depth_successful += 1
                    
                    # Extract links for next depth if enabled and not at max depth
                    if include_links and depth < max_depth - 1:
                        # Use native link extraction from crawl4ai
                        links = getattr(result, "links", {}) or {}
                        internal_links = links.get("internal", [])
                        
                        for link_obj in internal_links:
                            link_url = link_obj.get("href", "") if isinstance(link_obj, dict) else str(link_obj)
                            if not link_url:
                                continue
                            
                            next_url = normalize(link_url)
                            
                            # Skip if already visited or binary file
                            if next_url in visited or is_binary_file(next_url):
                                continue
                            
                            # Apply same-domain filter if enabled
                            if same_domain_only:
                                domain = next_url.split("//", 1)[-1].split("/", 1)[0]
                                if domain not in seed_domains:
                                    continue
                            
                            # Add to next level
                            if next_url not in next_level_urls:
                                next_level_urls.add(next_url)
                                total_discovered += 1
                                page.discovered_links.append(next_url)
            
            except asyncio.CancelledError:
                raise
            except Exception as e:
                # Log batch failure but continue with next batch
                import logging
                logging.getLogger(__name__).warning(f"Batch crawl failed: {e}")
                continue
        
        # Report depth completion
        if progress_callback:
            await progress_callback(
                total_processed,
                total_discovered,
                f"Depth {depth + 1} complete: {depth_successful} pages crawled, {len(next_level_urls)} URLs for next depth"
            )
        
        # Move to next depth level
        current_urls = next_level_urls
    
    # Report final completion
    if progress_callback:
        await progress_callback(
            total_processed,
            total_discovered,
            f"Recursive crawl complete: {len(results)} total pages across {max_depth} depths"
        )
    
    return results


__all__ = ["crawl_recursive_with_progress"]

