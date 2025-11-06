"""Crawler manager that backs the strategies with HTTP + browser fetching."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

try:  # pragma: no cover - optional dependency during tests
    from crawl4ai import AsyncWebCrawler, CacheMode, CrawlerRunConfig, MemoryAdaptiveDispatcher
except ImportError:  # pragma: no cover
    AsyncWebCrawler = None  # type: ignore
    CacheMode = None  # type: ignore
    CrawlerRunConfig = None  # type: ignore
    MemoryAdaptiveDispatcher = None  # type: ignore


LOGGER = logging.getLogger(__name__)


@dataclass
class FetchResult:
    final_url: str
    html: str
    status_code: int
    metadata: dict[str, Any] = field(default_factory=dict)


class CrawlerManager:
    """Coordinates crawl4ai browser sessions and lightweight HTTP fetches."""

    def __init__(self, *, http_timeout: float = 30.0, browser_concurrency: int = 20):
        self.http_timeout = http_timeout
        self.browser_concurrency = browser_concurrency
        self._http_client: Optional[httpx.AsyncClient] = None
        self._crawler: Optional[Any] = None
        self._init_lock = asyncio.Lock()

    async def initialize(self) -> None:
        async with self._init_lock:
            if self._http_client is None:
                # Use HTTP/2 and connection pooling for better parallelism
                limits = httpx.Limits(max_keepalive_connections=100, max_connections=200)
                self._http_client = httpx.AsyncClient(
                    timeout=self.http_timeout, 
                    follow_redirects=True,
                    limits=limits,
                    http2=True  # Enable HTTP/2 for multiplexing
                )
            if AsyncWebCrawler and self._crawler is None:
                self._crawler = AsyncWebCrawler(
                    browser_type="chromium",
                    headless=True,
                    verbose=False,
                    max_concurrent=self.browser_concurrency,
                )
                await self._crawler.start()

    async def cleanup(self) -> None:
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        if self._crawler:
            # AsyncWebCrawler cleanup happens automatically
            # Just clear the reference
            self._crawler = None

    async def fetch_with_httpx(self, url: str) -> FetchResult:
        if self._http_client is None:
            await self.initialize()
        assert self._http_client is not None
        response = await self._http_client.get(url, headers={"User-Agent": "crawl4ai-runner"})
        response.raise_for_status()
        return FetchResult(
            final_url=str(response.url),
            html=response.text,
            status_code=response.status_code,
            metadata={
                "content_type": response.headers.get("content-type"),
                "from_browser": False,
            },
        )

    async def fetch_with_browser(
        self,
        url: str,
        *,
        wait_selector: Optional[str] = None,
        cache_mode: str = "ENABLED",
    ) -> FetchResult:
        if not AsyncWebCrawler:
            LOGGER.warning("crawl4ai is unavailable; falling back to httpx for %s", url)
            return await self.fetch_with_httpx(url)

        if self._crawler is None:
            await self.initialize()

        if not CacheMode or not CrawlerRunConfig:
            LOGGER.warning("crawl4ai cache configuration unavailable; using httpx for %s", url)
            return await self.fetch_with_httpx(url)

        try:
            cache = CacheMode[cache_mode] if cache_mode in CacheMode.__members__ else CacheMode.ENABLED
            run_config = CrawlerRunConfig(
                wait_for_selector=wait_selector,
                cache_mode=cache,
            )
            result = await self._crawler.arun(url=url, config=run_config)
        except Exception as exc:  # pragma: no cover - defensive fallback
            LOGGER.warning("Browser crawl failed (%s); falling back to httpx", exc)
            return await self.fetch_with_httpx(url)

        html = getattr(result, "html", "") or ""
        final_url = getattr(result, "url", url) or url
        status = getattr(result, "status", 200) or 200
        metadata = {
            "from_browser": True,
            "timings": getattr(result, "timings", {}),
        }
        return FetchResult(final_url=final_url, html=html, status_code=status, metadata=metadata)

    async def crawl_many(
        self,
        urls: list[str],
        *,
        config: Optional[Any] = None,
        dispatcher: Optional[Any] = None,
    ):
        """
        Crawl multiple URLs in parallel using crawl4ai's arun_many.
        
        Args:
            urls: List of URLs to crawl
            config: Optional CrawlerRunConfig
            dispatcher: Optional MemoryAdaptiveDispatcher for memory management
            
        Returns:
            Async iterator of crawl results
        """
        if not AsyncWebCrawler:
            LOGGER.error("crawl4ai is unavailable; cannot use parallel crawling")
            return
            
        if self._crawler is None:
            await self.initialize()
            
        # arun_many returns a coroutine that yields an async generator
        # We need to await it first, then iterate
        batch_results = await self._crawler.arun_many(urls=urls, config=config, dispatcher=dispatcher)
        
        # Now iterate over the async generator
        async for result in batch_results:
            yield result


crawler_manager = CrawlerManager()


__all__ = ["crawler_manager", "CrawlerManager", "FetchResult"]
