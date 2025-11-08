"""Batch crawling strategy with concurrency control."""

from __future__ import annotations

import asyncio
import logging
from typing import Callable, Iterable, List, Optional, Sequence

from ..crawler import CrawlerManager
from .single_page import PageResult, crawl_single_page


ProgressCallback = Callable[[int, int, Optional[str]], None]


async def crawl_batch_with_progress(
    crawler: CrawlerManager,
    urls: Sequence[str],
    *,
    include_links: bool = False,
    max_concurrency: int = 10,
    progress_callback: Optional[ProgressCallback] = None,
    cancel_event: Optional[asyncio.Event] = None,
    logger: Optional[logging.Logger] = None,
) -> List[PageResult]:
    logger = logger or logging.getLogger(__name__)
    semaphore = asyncio.Semaphore(max(1, min(max_concurrency, 50)))
    total = len(urls)
    completed = 0
    results: List[PageResult] = []

    async def crawl_single(target_url: str) -> None:
        nonlocal completed
        if cancel_event and cancel_event.is_set():
            return
        async with semaphore:
            try:
                page = await crawl_single_page(
                    crawler,
                    target_url,
                    include_links=include_links,
                    cancel_event=cancel_event,
                    logger=logger,
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("Batch crawl failed for %s: %s", target_url, exc)
                completed += 1
                if progress_callback:
                    await progress_callback(completed, total, target_url)
                return

            results.append(page)
            completed += 1
            if progress_callback:
                await progress_callback(completed, total, page.url)

    tasks = [asyncio.create_task(crawl_single(url)) for url in urls]

    try:
        await asyncio.gather(*tasks)
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()

    return results


__all__ = ["crawl_batch_with_progress", "ProgressCallback"]

