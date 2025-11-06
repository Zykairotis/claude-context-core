"""Auto-discovery logic for documentation auxiliary files.

Enhanced discovery workflow with:
- Priority-based file discovery (llms.txt, sitemaps, robots.txt)
- HTML meta tag parsing for sitemap references
- Multiple location checking (root, .well-known, subdirectories)
- SSRF protection with IP validation and redirect checking
- Response size limiting to prevent memory exhaustion
- Async implementation for better performance
"""

from __future__ import annotations

import ipaddress
import logging
import socket
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import List, Optional, Sequence, Set, Tuple
from urllib.parse import urljoin, urlparse

import httpx

from ..helpers import (
    ensure_https,
    is_llms_variant,
    is_robots_txt,
    is_sitemap,
    sanitize_url,
)

LOGGER = logging.getLogger(__name__)


_DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_MAX_RESPONSE_BYTES = 10 * 1024 * 1024

# Known file extensions for path detection
_FILE_EXTENSIONS = {
    '.html', '.htm', '.xml', '.json', '.txt', '.md', '.csv',
    '.rss', '.yaml', '.yml', '.pdf', '.zip'
}


class SitemapHTMLParser(HTMLParser):
    """HTML parser for extracting sitemap references from link and meta tags."""

    def __init__(self):
        super().__init__()
        self.sitemaps: List[Tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        """Handle start tags to find sitemap references."""
        attrs_dict = {k.lower(): v for k, v in attrs if v is not None}

        # Check <link rel="sitemap" href="...">
        if tag == 'link':
            rel = attrs_dict.get('rel', '').lower()
            rel_values = rel.split() if rel else []
            if 'sitemap' in rel_values:
                href = attrs_dict.get('href')
                if href:
                    self.sitemaps.append(('link', href))

        # Check <meta name="sitemap" content="...">
        elif tag == 'meta':
            name = attrs_dict.get('name', '').lower()
            if name == 'sitemap':
                content = attrs_dict.get('content')
                if content:
                    self.sitemaps.append(('meta', content))


@dataclass
class DiscoveredFile:
    url: str
    content: str
    content_type: str


class DiscoveryError(Exception):
    pass


class DiscoveryService:
    """Service for discovering documentation auxiliary files with enhanced features."""
    
    # Priority order - most valuable files first
    priority_order: Tuple[str, ...] = (
        "llms.txt",
        "llms-full.txt",
        ".well-known/ai.txt",
        ".well-known/llms.txt",
        "sitemap.xml",
        "sitemap_index.xml",
        "robots.txt",
        ".well-known/sitemap.xml",
    )
    
    # Common subdirectories to check for discovery files
    common_subdirs: Tuple[str, ...] = (
        "docs", "doc", "documentation",
        "api", "static", "public", "assets",
        "sitemaps", "sitemap", "xml", "feed"
    )

    def __init__(self, timeout: httpx.Timeout | None = None, max_bytes: int = _MAX_RESPONSE_BYTES):
        self.timeout = timeout or _DEFAULT_TIMEOUT
        self.max_bytes = max_bytes
        self._checked_urls: Set[str] = set()  # Avoid duplicate checks

    async def discover_files(self, urls: Sequence[str]) -> Optional[DiscoveredFile]:
        """Discover auxiliary files with enhanced multi-location checking."""
        self._checked_urls.clear()
        candidates: List[str] = []
        
        for url in urls:
            normalized = ensure_https(url)
            base_candidates = self._build_candidate_urls(normalized)
            candidates.extend(base_candidates)
        
        LOGGER.info(f"Starting discovery for {len(urls)} base URL(s), checking {len(candidates)} candidates")

        async with httpx.AsyncClient(
            timeout=self.timeout, 
            follow_redirects=True,
            max_redirects=3,
            limits=httpx.Limits(max_connections=10)
        ) as client:
            # Try priority files first
            for candidate in candidates:
                if candidate in self._checked_urls:
                    continue
                self._checked_urls.add(candidate)
                
                try:
                    result = await self._attempt_fetch(client, candidate)
                except DiscoveryError as e:
                    LOGGER.debug(f"Discovery failed for {candidate}: {e}")
                    continue
                if result:
                    LOGGER.info(f"Discovery successful: {result.url}")
                    return result
            
            # Fallback: check HTML meta tags on base URLs
            for url in urls:
                normalized = ensure_https(url)
                if normalized in self._checked_urls:
                    continue
                self._checked_urls.add(normalized)
                
                try:
                    html_result = await self._check_html_meta_tags(client, normalized)
                    if html_result:
                        LOGGER.info(f"Discovery successful from HTML meta: {html_result.url}")
                        return html_result
                except Exception as e:
                    LOGGER.debug(f"HTML meta check failed for {normalized}: {e}")

        LOGGER.info("Discovery completed: no files found")
        return None

    def _build_candidate_urls(self, base_url: str) -> List[str]:
        """Build candidate URLs to check, including subdirectories."""
        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        base_dir = self._extract_directory(base_url)
        
        candidates = []
        
        # Priority 1: Root level files
        for filename in self.priority_order:
            candidates.append(urljoin(origin + "/", filename))
        
        # Priority 2: Same directory as base_url (if not root)
        if base_dir and base_dir != '/':
            for filename in ["llms.txt", "llms-full.txt", "sitemap.xml"]:
                candidates.append(urljoin(origin + base_dir + "/", filename))
        
        # Priority 3: Common subdirectories
        for subdir in self.common_subdirs:
            for filename in ["llms.txt", "sitemap.xml"]:
                candidates.append(urljoin(origin + "/", f"{subdir}/{filename}"))
        
        return candidates
    
    def _extract_directory(self, base_url: str) -> str:
        """Extract directory path from URL, handling both file URLs and directory URLs."""
        parsed = urlparse(base_url)
        base_path = parsed.path.rstrip('/')

        # Check if last segment is a file (has known extension)
        last_segment = base_path.split('/')[-1] if base_path else ''
        has_file_extension = any(last_segment.lower().endswith(ext) for ext in _FILE_EXTENSIONS)

        if has_file_extension:
            # Remove filename to get directory
            return '/'.join(base_path.split('/')[:-1])
        else:
            # Last segment is a directory
            return base_path

    async def _attempt_fetch(self, client: httpx.AsyncClient, url: str) -> Optional[DiscoveredFile]:
        """Attempt to fetch and validate a discovery file."""
        safe_url = sanitize_url(url)
        if not safe_url:
            return None
        
        # Validate hostname before making request
        try:
            self._validate_hostname(safe_url)
        except DiscoveryError:
            raise

        try:
            response = await client.get(
                safe_url, 
                headers={"User-Agent": "crawl4ai-runner/2.0 (Discovery)"}
            )
        except httpx.HTTPError as exc:
            raise DiscoveryError(f"HTTP error: {exc}") from exc

        if response.status_code >= 400:
            return None
        
        # Validate redirect destinations
        if response.history:
            LOGGER.debug(f"URL {url} had {len(response.history)} redirect(s)")
            final_url = str(response.url)
            try:
                self._validate_hostname(final_url)
            except DiscoveryError as e:
                LOGGER.warning(f"Redirect target blocked: {final_url} - {e}")
                return None

        # Check content length
        content_length = int(response.headers.get("content-length", 0) or 0)
        if content_length and content_length > self.max_bytes:
            LOGGER.debug(f"Content too large: {content_length} bytes > {self.max_bytes}")
            return None

        text = response.text
        if len(text.encode("utf-8", "ignore")) > self.max_bytes:
            LOGGER.debug(f"Content too large after decoding")
            return None

        content_type = response.headers.get("content-type", "text/plain")

        # Handle different file types
        if is_llms_variant(safe_url):
            LOGGER.debug(f"Found llms variant: {safe_url}")
            return DiscoveredFile(url=safe_url, content=text, content_type=content_type)

        if is_sitemap(safe_url):
            LOGGER.debug(f"Found sitemap: {safe_url}")
            return DiscoveredFile(url=safe_url, content=text, content_type=content_type)

        if is_robots_txt(safe_url):
            # Try to extract sitemap from robots.txt
            sitemap_url = self._extract_sitemap_from_robots(text, safe_url)
            if sitemap_url and sitemap_url not in self._checked_urls:
                self._checked_urls.add(sitemap_url)
                nested = await self._attempt_fetch(client, sitemap_url)
                if nested:
                    return nested
            return DiscoveredFile(url=safe_url, content=text, content_type=content_type)

        return None

    def _validate_hostname(self, url: str) -> None:
        """Validate hostname with enhanced SSRF protection."""
        parsed = urlparse(url)
        
        # Only allow HTTP/HTTPS
        if parsed.scheme not in ('http', 'https'):
            raise DiscoveryError(f"Blocked non-HTTP(S) scheme: {parsed.scheme}")
        
        hostname = parsed.hostname
        if not hostname:
            raise DiscoveryError("Invalid URL: missing hostname")

        # Check if hostname is an IP address
        if self._looks_like_ip(hostname):
            ip = ipaddress.ip_address(hostname)
            if not self._is_safe_ip(ip):
                raise DiscoveryError(f"Blocked unsafe IP address: {hostname}")
            return

        # Resolve hostname and check all IPs
        try:
            infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise DiscoveryError(f"Failed to resolve host: {hostname}") from exc

        for info in infos:
            sockaddr = info[4]
            if not sockaddr:
                continue
            resolved_ip = ipaddress.ip_address(sockaddr[0])
            if not self._is_safe_ip(resolved_ip):
                raise DiscoveryError(f"Hostname {hostname} resolves to unsafe IP {sockaddr[0]}")
    
    def _is_safe_ip(self, ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
        """Check if an IP address is safe for outbound requests."""
        # Block private networks
        if ip.is_private:
            return False
        # Block loopback (127.0.0.0/8, ::1)
        if ip.is_loopback:
            return False
        # Block link-local (169.254.0.0/16, fe80::/10)
        if ip.is_link_local:
            return False
        # Block multicast
        if ip.is_multicast:
            return False
        # Block reserved ranges
        if ip.is_reserved:
            return False
        # Explicit check for cloud metadata services
        if str(ip) == "169.254.169.254":
            return False
        return True

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

    async def _check_html_meta_tags(self, client: httpx.AsyncClient, base_url: str) -> Optional[DiscoveredFile]:
        """Check HTML page for sitemap meta tags using proper HTML parsing."""
        try:
            response = await client.get(
                base_url,
                headers={"User-Agent": "crawl4ai-runner/2.0 (Discovery)"},
                follow_redirects=True
            )
            
            if response.status_code != 200:
                return None
            
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type:
                return None
            
            html = response.text
            if len(html.encode("utf-8", "ignore")) > self.max_bytes:
                return None
            
            # Parse HTML for sitemap references
            parser = SitemapHTMLParser()
            try:
                parser.feed(html)
            except Exception as e:
                LOGGER.debug(f"HTML parsing error for {base_url}: {e}")
                return None
            
            # Try each discovered sitemap
            for tag_type, url in parser.sitemaps:
                sitemap_url = urljoin(base_url, url.strip())
                
                # Validate scheme
                parsed = urlparse(sitemap_url)
                if parsed.scheme not in ("http", "https"):
                    continue
                
                if sitemap_url in self._checked_urls:
                    continue
                self._checked_urls.add(sitemap_url)
                
                # Try to fetch the sitemap
                try:
                    result = await self._attempt_fetch(client, sitemap_url)
                    if result:
                        LOGGER.info(f"Found sitemap from HTML {tag_type} tag: {sitemap_url}")
                        return result
                except DiscoveryError:
                    continue
            
            return None
            
        except httpx.HTTPError as e:
            LOGGER.debug(f"HTTP error checking HTML meta tags for {base_url}: {e}")
            return None


__all__ = ["DiscoveryService", "DiscoveredFile", "DiscoveryError"]

