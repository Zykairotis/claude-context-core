"""Recursive crawling strategy using breadth-first traversal."""

from __future__ import annotations

import asyncio
from collections import deque
from typing import Deque, Iterable, List, Optional, Set, Tuple

from ..crawler import CrawlerManager
from ..helpers import is_binary_file, normalize_url
from .single_page import PageResult, crawl_single_page


QueueItem = Tuple[str, Optional[str], int]


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
) -> List[PageResult]:
    queue: Deque[QueueItem] = deque([(normalize_url(url), None, 0) for url in seed_urls])
    visited: Set[str] = set()
    results: List[PageResult] = []
    total_processed = 0

    seed_domains = {normalize_url(url).split("//", 1)[-1].split("/", 1)[0] for url in seed_urls}

    # max_pages=0 means unlimited
    while queue and (max_pages == 0 or len(results) < max_pages):
        if cancel_event and cancel_event.is_set():
            raise asyncio.CancelledError()

        url, parent, depth = queue.popleft()
        if url in visited:
            continue
        visited.add(url)

        try:
            page = await crawl_single_page(
                crawler,
                url,
                source_url=parent,
                include_links=include_links,
                cancel_event=cancel_event,
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            continue

        results.append(page)
        total_processed += 1
        if progress_callback:
            # For unlimited (max_pages=0), report current count without limit
            progress_callback(total_processed, max_pages if max_pages > 0 else total_processed, page.url)

        if depth >= max_depth:
            continue

        next_depth = depth + 1
        for link in page.discovered_links:
            normalized = normalize_url(link)
            if normalized in visited:
                continue
            if is_binary_file(normalized):
                continue
            if same_domain_only:
                domain = normalized.split("//", 1)[-1].split("/", 1)[0]
                if domain not in seed_domains:
                    continue
            queue.append((normalized, page.url, next_depth))

    return results


__all__ = ["crawl_recursive_with_progress"]

