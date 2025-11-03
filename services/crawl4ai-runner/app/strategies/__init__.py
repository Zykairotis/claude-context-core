"""Crawling strategies."""

from .batch import ProgressCallback, crawl_batch_with_progress
from .recursive import crawl_recursive_with_progress
from .single_page import PageResult, crawl_single_page
from .sitemap import parse_sitemap

__all__ = [
    "PageResult",
    "ProgressCallback",
    "crawl_batch_with_progress",
    "crawl_recursive_with_progress",
    "crawl_single_page",
    "parse_sitemap",
]

