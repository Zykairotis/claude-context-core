"""Utility helpers for working with crawl URLs.

These helpers consolidate the URL munging logic that is shared across the
different crawling strategies and services. The goal is to keep the logic in
one place so that we can reason about security (e.g. binary detection) and
behavioural quirks (e.g. GitHub blob URLs) holistically.

The module intentionally has *zero* side effects so it can be imported from
both synchronous and asynchronous contexts without surprises.
"""

from __future__ import annotations

import hashlib
import ipaddress
import re
from dataclasses import dataclass
from typing import Iterable, Iterator, List, Optional, Sequence, Tuple
from urllib.parse import ParseResult, urljoin, urlparse


_GITHUB_BLOB_PATTERN = re.compile(r"^https://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/blob/(?P<branch>[^/]+?)/(?P<path>.+)$")
_MARKDOWN_LINK_PATTERN = re.compile(r"\[(?P<text>[^\]]+)\]\((?P<url>[^)]+)\)")
_WELL_KNOWN_PREFIXES = (
    "/.well-known/llms.txt",
    "/.well-known/llms-full.txt",
    "/.well-known/robots.txt",
)


# fmt: off
_BINARY_EXTENSIONS: Tuple[str, ...] = (
    # Archives
    ".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".rar", ".7z", ".iso",
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".svg", ".ico", ".webp",
    # Audio
    ".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a",
    # Video
    ".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv",
    # Documents / binaries
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
    ".exe", ".bin", ".dll", ".dmg", ".pkg", ".msi",
    # Fonts
    ".ttf", ".otf", ".woff", ".woff2",
    # Misc
    ".dat", ".img", ".class", ".pyc", ".wasm",
)
# fmt: on


@dataclass(frozen=True)
class MarkdownLink:
    """Representation of a markdown link extracted from text."""

    text: str
    url: str


def transform_github_url(url: str) -> str:
    """Transform GitHub blob URLs into raw file URLs.

    Crawl4AI works best when it can fetch the raw blob data instead of the HTML
    code viewer. We convert `https://github.com/org/repo/blob/<branch>/file` to
    `https://raw.githubusercontent.com/org/repo/<branch>/file`.

    Args:
        url: The original URL provided by the user or discovered during crawl.

    Returns:
        The transformed URL if it matched the GitHub blob pattern, otherwise the
        original URL.
    """

    match = _GITHUB_BLOB_PATTERN.match(url)
    if not match:
        return url

    owner = match.group("owner")
    repo = match.group("repo")
    branch = match.group("branch")
    path = match.group("path")
    return f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"


def is_sitemap(url: str) -> bool:
    return url.lower().endswith((".xml", "sitemap")) or "/sitemap" in url.lower()


def is_txt(url: str) -> bool:
    lower = url.lower()
    return lower.endswith(".txt") or lower.endswith(".text")


def is_markdown(url: str) -> bool:
    lower = url.lower()
    return lower.endswith(".md") or lower.endswith(".mdx")


def is_llms_variant(url: str) -> bool:
    lower = url.lower()
    if lower.endswith("llms.txt") or lower.endswith("llms-full.txt"):
        return True
    return any(lower.endswith(prefix) for prefix in _WELL_KNOWN_PREFIXES)


def is_robots_txt(url: str) -> bool:
    lower = url.lower()
    return lower.endswith("robots.txt") or lower.endswith("/.well-known/robots.txt")


def is_binary_file(url: str) -> bool:
    """Return True if the URL appears to reference a binary file."""

    path = urlparse(url).path
    return any(path.lower().endswith(ext) for ext in _BINARY_EXTENSIONS)


def extract_markdown_links_with_text(markdown: str) -> List[MarkdownLink]:
    """Extract markdown links preserving their visible text.

    Args:
        markdown: The markdown content to inspect.

    Returns:
        A list of MarkdownLink objects representing all matches.
    """

    links: List[MarkdownLink] = []
    for match in _MARKDOWN_LINK_PATTERN.finditer(markdown or ""):
        text = match.group("text").strip()
        url = match.group("url").strip()
        if not text or not url:
            continue
        links.append(MarkdownLink(text=text, url=url))
    return links


def generate_unique_source_id(url: str) -> str:
    """Generate a deterministic unique ID for a crawl source.

    The ID is used when deduplicating pages across different crawl sessions.
    """

    normalized = normalize_url(url)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return digest[:32]


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc
    path = parsed.path or "/"
    normalized = f"{scheme}://{netloc}{path}"
    if parsed.query:
        normalized = f"{normalized}?{parsed.query}"
    return normalized.rstrip("/")


def is_same_domain(url: str, other: str) -> bool:
    return urlparse(url).netloc == urlparse(other).netloc


def resolve_relative_url(base_url: str, link: str) -> str:
    return urljoin(base_url, link)


def sanitize_url(url: str) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(url)
    if not parsed.scheme:
        return None
    if parsed.scheme not in {"http", "https"}:
        return None
    return url


def is_public_ip(hostname: str) -> bool:
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return True
    return not (ip.is_private or ip.is_loopback or ip.is_link_local)


def iter_links_from_markdown(markdown: str) -> Iterator[str]:
    for link in extract_markdown_links_with_text(markdown):
        sanitized = sanitize_url(link.url)
        if sanitized:
            yield sanitized


def filter_same_domain_links(base_url: str, links: Iterable[str]) -> List[str]:
    return [link for link in links if is_same_domain(base_url, link)]


def ensure_https(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme == "https":
        return url
    return parsed._replace(scheme="https").geturl()  # type: ignore[attr-defined]


__all__ = [
    "MarkdownLink",
    "extract_markdown_links_with_text",
    "filter_same_domain_links",
    "generate_unique_source_id",
    "is_binary_file",
    "is_llms_variant",
    "is_markdown",
    "is_public_ip",
    "is_robots_txt",
    "is_same_domain",
    "is_sitemap",
    "is_txt",
    "iter_links_from_markdown",
    "normalize_url",
    "resolve_relative_url",
    "sanitize_url",
    "transform_github_url",
    "ensure_https",
]

