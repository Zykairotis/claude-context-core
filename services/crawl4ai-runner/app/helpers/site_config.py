"""Helpers for inferring documentation site behaviour.

The crawling strategies lean on coarse heuristics to tune how aggressively we
wait for client-side rendering or prune navigation elements. These heuristics do
not need to be perfect – they simply tilt the defaults towards the common
frameworks we encounter in practice.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

from bs4 import BeautifulSoup
from markdownify import markdownify as html_to_markdown


_DOC_KEYWORDS = (
    "readthedocs",
    "docusaurus",
    "vitepress",
    "gitbook",
    "mkdocs",
    "docsify",
    "nextra",
    "nuxt-content",
    "sphinx",
    "storybook",
)

_DOC_PATH_HINTS = (
    "/docs/",
    "/documentation",
    "/guide",
    "/handbook",
    "/kb/",
)

_NAVIGATION_SELECTORS = (
    "nav",
    "header",
    "aside",
    "[role='navigation']",
    "[data-testid='sidebar']",
    ".sidebar",
    ".toc",
    ".table-of-contents",
)


@dataclass
class MarkdownGenerator:
    """Thin wrapper around markdownify so we can plug in behaviour switches."""

    prune_navigation: bool = False

    def __call__(self, html: str) -> str:
        if not html:
            return ""
        soup = BeautifulSoup(html, "lxml")
        if self.prune_navigation:
            for selector in _NAVIGATION_SELECTORS:
                for node in soup.select(selector):
                    node.decompose()
        for script in soup(["script", "style", "noscript"]):
            script.decompose()
        cleaned = str(soup)
        return html_to_markdown(cleaned, strip="\n")


def is_documentation_site(url: Optional[str], html: Optional[str]) -> bool:
    """Heuristic detection of documentation frameworks."""

    if not url and not html:
        return False

    lower_url = (url or "").lower()
    if any(keyword in lower_url for keyword in _DOC_KEYWORDS):
        return True
    if any(hint in lower_url for hint in _DOC_PATH_HINTS):
        return True

    if html:
        soup = BeautifulSoup(html, "lxml")
        possible = []
        metas = soup.find_all("meta")
        for meta in metas:
            content = " ".join(filter(None, [meta.get("content"), meta.get("name"), meta.get("property")]))
            possible.append(content.lower())
        for text in possible:
            if any(keyword in text for keyword in _DOC_KEYWORDS):
                return True

        body_classes = " ".join(soup.body.get("class", []) if soup.body else []).lower()
        if any(keyword in body_classes for keyword in _DOC_KEYWORDS):
            return True

        if soup.select_one("[data-theme='docs']"):
            return True

        if soup.select_one(".theme-doc-markdown"):
            return True

    return False


def get_markdown_generator(prune_navigation: bool = False) -> MarkdownGenerator:
    return MarkdownGenerator(prune_navigation=prune_navigation)


def get_link_pruning_markdown_generator() -> MarkdownGenerator:
    return MarkdownGenerator(prune_navigation=True)


__all__ = [
    "MarkdownGenerator",
    "get_link_pruning_markdown_generator",
    "get_markdown_generator",
    "is_documentation_site",
]

