from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl, NonNegativeInt


class CrawlMode(str, Enum):
    SINGLE = "single"
    BATCH = "batch"
    RECURSIVE = "recursive"
    SITEMAP = "sitemap"


class ScopeLevel(str, Enum):
    GLOBAL = "global"
    PROJECT = "project"
    LOCAL = "local"


class CrawlRequest(BaseModel):
    project: Optional[str] = Field(None, description="Project name for downstream storage")
    dataset: Optional[str] = Field(None, description="Dataset name for downstream storage")
    scope: Optional[ScopeLevel] = Field(None, description="Knowledge scope: global, project, or local")
    urls: List[HttpUrl] = Field(..., description="Seed URLs for the crawl")
    mode: CrawlMode = Field(CrawlMode.SINGLE, description="Crawling strategy to use")
    max_depth: Optional[NonNegativeInt] = Field(1, description="Maximum depth for recursive crawling")
    max_pages: Optional[NonNegativeInt] = Field(20, description="Maximum pages to fetch")
    same_domain_only: bool = Field(True, description="Restrict recursive crawling to the seed domain")
    include_links: bool = Field(False, description="Return discovered links from each page")
    auto_discovery: bool = Field(True, description="Auto-discover llms.txt and sitemaps")
    max_concurrent: Optional[NonNegativeInt] = Field(None, description="Maximum concurrent fetches")
    extract_code_examples: bool = Field(True, description="Extract code examples from crawled pages")
    knowledge_type: Optional[str] = Field(None, description="Optional knowledge classification for storage")
    tags: Optional[List[str]] = Field(None, description="List of tags to associate with stored chunks")
    provider: Optional[str] = Field(None, description="AI provider to use for code summaries")


class CrawledPagePayload(BaseModel):
    url: HttpUrl
    source_url: Optional[HttpUrl] = Field(None, description="Parent page that linked to this URL")
    title: Optional[str]
    markdown_content: str
    html_content: str
    word_count: int
    char_count: int
    discovered_links: Optional[List[HttpUrl]] = None


class CrawlResponse(BaseModel):
    project: Optional[str]
    dataset: Optional[str]
    mode: CrawlMode
    total_pages: int
    pages: List[CrawledPagePayload]


class CrawlStartResponse(BaseModel):
    progress_id: str
    status: str


class CrawlProgress(BaseModel):
    progress_id: str
    status: str
    progress: int
    log: str
    current_url: Optional[str]
    total_pages: Optional[int]
    processed_pages: Optional[int]
    chunks_stored: Optional[int]
    code_examples_found: Optional[int]
    # Real-time progress tracking fields
    current_phase: Optional[str] = Field(None, description="Current operation phase (e.g., chunking, summarizing, embedding, storing)")
    phase_detail: Optional[str] = Field(None, description="Sub-phase detail (e.g., Content embeddings, Code embeddings)")
    chunks_total: Optional[int] = Field(None, description="Total chunks to process")
    chunks_processed: Optional[int] = Field(None, description="Chunks completed in current phase")
    summaries_generated: Optional[int] = Field(None, description="Summaries completed")
    embeddings_generated: Optional[int] = Field(None, description="Embeddings completed")
