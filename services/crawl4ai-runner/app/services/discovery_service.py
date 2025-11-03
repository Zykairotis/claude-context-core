"""Auto-discovery logic for documentation auxiliary files.

The discovery workflow scans for llms.txt manifests, sitemaps, and robots.txt
files while defending against SSRF by pre-validating resolved IP addresses. The
service prefers explicit llms declarations but gracefully falls back through a
priority chain.
"""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple
from urllib.parse import urljoin, urlparse

import httpx

from ..helpers import (
    ensure_https,
    is_llms_variant,
    is_robots_txt,
    is_sitemap,
    sanitize_url,
)


_DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_MAX_RESPONSE_BYTES = 10 * 1024 * 1024


@dataclass
class DiscoveredFile:
    url: str
    content: str
    content_type: str


class DiscoveryError(Exception):
    pass


class DiscoveryService:
    priority_order: Tuple[str, ...] = (
        "llms.txt",
        "llms-full.txt",
        "sitemap.xml",
        "robots.txt",
    )

    def __init__(self, timeout: httpx.Timeout | None = None, max_bytes: int = _MAX_RESPONSE_BYTES):
        self.timeout = timeout or _DEFAULT_TIMEOUT
        self.max_bytes = max_bytes

    async def discover_files(self, urls: Sequence[str]) -> Optional[DiscoveredFile]:
        candidates: List[str] = []
        for url in urls:
            normalized = ensure_https(url)
            base_candidates = self._build_candidate_urls(normalized)
            candidates.extend(base_candidates)

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            for candidate in candidates:
                try:
                    result = await self._attempt_fetch(client, candidate)
                except DiscoveryError:
                    continue
                if result:
                    return result

        return None

    def _build_candidate_urls(self, base_url: str) -> List[str]:
        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        permutations = []
        permutations.extend(
            [
                urljoin(origin, "/llms.txt"),
                urljoin(origin, "/llms-full.txt"),
                urljoin(origin, "/.well-known/llms.txt"),
                urljoin(origin, "/.well-known/llms-full.txt"),
                urljoin(origin, "/sitemap.xml"),
                urljoin(origin, "/sitemap_index.xml"),
                urljoin(origin, "/robots.txt"),
                urljoin(origin, "/.well-known/robots.txt"),
            ]
        )
        return permutations

    async def _attempt_fetch(self, client: httpx.AsyncClient, url: str) -> Optional[DiscoveredFile]:
        safe_url = sanitize_url(url)
        if not safe_url:
            return None
        self._validate_hostname(safe_url)

        try:
            response = await client.get(safe_url, headers={"User-Agent": "crawl4ai-runner"})
        except httpx.HTTPError as exc:
            raise DiscoveryError from exc

        if response.status_code >= 400:
            return None

        content_length = int(response.headers.get("content-length", 0) or 0)
        if content_length and content_length > self.max_bytes:
            return None

        text = response.text
        if len(text.encode("utf-8", "ignore")) > self.max_bytes:
            return None

        content_type = response.headers.get("content-type", "text/plain")

        if is_llms_variant(safe_url):
            return DiscoveredFile(url=safe_url, content=text, content_type=content_type)

        if is_sitemap(safe_url):
            return DiscoveredFile(url=safe_url, content=text, content_type=content_type)

        if is_robots_txt(safe_url):
            sitemap_url = self._extract_sitemap_from_robots(text, safe_url)
            if sitemap_url:
                nested = await self._attempt_fetch(client, sitemap_url)
                if nested:
                    return nested
            return DiscoveredFile(url=safe_url, content=text, content_type=content_type)

        if "text/html" in content_type:
            sitemap_url = self._extract_meta_sitemap(text, safe_url)
            if sitemap_url:
                nested = await self._attempt_fetch(client, sitemap_url)
                if nested:
                    return nested

        return None

    def _validate_hostname(self, url: str) -> None:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            raise DiscoveryError("Invalid URL: missing hostname")

        if self._looks_like_ip(hostname):
            ip = ipaddress.ip_address(hostname)
            if not ip.is_global:
                raise DiscoveryError("Blocked private IP address")
            return

        try:
            infos = socket.getaddrinfo(hostname, None)
        except socket.gaierror as exc:
            raise DiscoveryError("Failed to resolve host") from exc

        for info in infos:
            sockaddr = info[4]
            if not sockaddr:
                continue
            resolved_ip = ipaddress.ip_address(sockaddr[0])
            if not resolved_ip.is_global:
                raise DiscoveryError("Blocked non-public IP")

    def _looks_like_ip(self, host: str) -> bool:
        try:
            ipaddress.ip_address(host)
        except ValueError:
            return False
        return True

    def _extract_sitemap_from_robots(self, robots_text: str, robots_url: str) -> Optional[str]:
        for line in robots_text.splitlines():
            if not line.lower().startswith("sitemap:"):
                continue
            sitemap_url = line.split(":", 1)[1].strip()
            if sitemap_url:
                return sitemap_url
        origin = robots_url.rsplit("/", 1)[0]
        return urljoin(origin + "/", "sitemap.xml")

    def _extract_meta_sitemap(self, html: str, base_url: str) -> Optional[str]:
        lower = html.lower()
        marker = "rel=\"sitemap\""
        if marker not in lower:
            return None
        # naïve extraction to avoid bringing in lxml here
        start = lower.find("href=")
        if start == -1:
            return None
        quote = lower[start + 5]
        end = lower.find(quote, start + 6)
        if end == -1:
            return None
        href = html[start + 6 : end]
        return urljoin(base_url, href)


__all__ = ["DiscoveryService", "DiscoveredFile", "DiscoveryError"]

