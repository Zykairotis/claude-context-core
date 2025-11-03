"""Single page crawling strategy.

The strategy attempts lightweight HTTP fetches first and escalates to full
browser rendering when needed (e.g. documentation frameworks or JavaScript
heavy pages). It exposes a uniform `PageResult` structure consumed by the
caller.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

from bs4 import BeautifulSoup

from ..crawler import CrawlerManager, FetchResult
from ..helpers import (
    generate_unique_source_id,
    get_markdown_generator,
    is_binary_file,
    is_documentation_site,
    iter_links_from_markdown,
    normalize_url,
    transform_github_url,
)


LOGGER = logging.getLogger(__name__)


@dataclass
class PageResult:
    url: str
    source_url: Optional[str]
    title: Optional[str]
    html_content: str
    markdown_content: str
    word_count: int
    char_count: int
    discovered_links: List[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


class SinglePageError(Exception):
    pass


async def crawl_single_page(
    crawler: CrawlerManager,
    url: str,
    *,
    source_url: Optional[str] = None,
    include_links: bool = False,
    prefer_browser: bool = False,
    cancel_event: Optional[asyncio.Event] = None,
    logger: Optional[logging.Logger] = None,
) -> PageResult:
    """Fetch a single URL and convert it into Markdown."""

    logger = logger or LOGGER
    effective_url = transform_github_url(url)
    doc_site = is_documentation_site(effective_url, None)
    attempts = 3
    use_browser = prefer_browser or doc_site
    cache_modes = ["ENABLED", "BYPASS", "BYPASS"]

    for attempt_index in range(attempts):
        if cancel_event and cancel_event.is_set():
            raise asyncio.CancelledError()

        cache_mode = cache_modes[min(attempt_index, len(cache_modes) - 1)]

        try:
            fetch_result = await _fetch_page(
                crawler,
                effective_url,
                use_browser=use_browser,
                cache_mode=cache_mode,
                is_doc_site=doc_site,
                logger=logger,
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Single page fetch failed: %s", exc, exc_info=True)
            use_browser = True
            await asyncio.sleep(2 ** attempt_index)
            continue

        if len(fetch_result.html or "") < 50 and not use_browser:
            logger.debug("Escalating to browser for %s due to short HTML", effective_url)
            use_browser = True
            await asyncio.sleep(1.0)
            continue

        return _build_result(fetch_result, source_url=source_url, include_links=include_links)

    raise SinglePageError(f"Failed to crawl {effective_url} after {attempts} attempts")


async def _fetch_page(
    crawler: CrawlerManager,
    url: str,
    *,
    use_browser: bool,
    cache_mode: str,
    is_doc_site: bool,
    logger: logging.Logger,
) -> FetchResult:
    wait_selector: Optional[str] = None

    if use_browser:
        wait_selector = "main"
        if is_doc_site:
            wait_selector = "article, main, .markdown"  # favour doc layouts

    logger.debug(
        "Fetching page", extra={"url": url, "use_browser": use_browser, "cache_mode": cache_mode}
    )

    if use_browser:
        return await crawler.fetch_with_browser(url, wait_selector=wait_selector, cache_mode=cache_mode)
    return await crawler.fetch_with_httpx(url)


def _build_result(
    fetch_result: FetchResult,
    *,
    source_url: Optional[str],
    include_links: bool,
) -> PageResult:
    html = fetch_result.html or ""
    soup = BeautifulSoup(html, "lxml") if html else None
    title = _extract_title(soup)

    markdown_generator = get_markdown_generator()

    markdown = markdown_generator(html) if html else ""

    discovered_links: List[str] = []
    if include_links and markdown:
        for link in iter_links_from_markdown(markdown):
            if not is_binary_file(link):
                discovered_links.append(normalize_url(link))

    word_count = len(markdown.split()) if markdown else 0
    char_count = len(markdown)

    metadata = dict(fetch_result.metadata)
    metadata.update({"source_id": generate_unique_source_id(fetch_result.final_url)})

    return PageResult(
        url=fetch_result.final_url,
        source_url=source_url,
        title=title,
        html_content=html,
        markdown_content=markdown,
        word_count=word_count,
        char_count=char_count,
        discovered_links=discovered_links,
        metadata=metadata,
    )


def _extract_title(soup: Optional[BeautifulSoup]) -> Optional[str]:
    if not soup:
        return None
    title_tag = soup.find("title")
    if title_tag and title_tag.text:
        return title_tag.text.strip()
    heading = soup.find("h1")
    if heading and heading.text:
        return heading.text.strip()
    return None


__all__ = ["PageResult", "crawl_single_page", "SinglePageError"]

