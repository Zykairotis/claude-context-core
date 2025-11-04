# Todo 8: Refactor Crawl4AI to Crawler-Only

**Status:** ⏳ Not Started  
**Complexity:** High  
**Estimated Time:** 8-12 hours  
**Dependencies:** Todo 2-7 (All Context features)

---

## Objective

Simplify the Crawl4AI Python service to only handle web crawling, returning raw page data to the TypeScript Context layer for processing.

---

## Current Service Responsibilities (❌ Remove)

```python
# services/crawl4ai-runner/app/services/crawling_service.py

class CrawlingService:
    async def orchestrate_crawl(ctx: CrawlRequestContext):
        # ✅ KEEP: Crawling
        pages = await self._execute_crawl(ctx.urls)
        
        # ❌ REMOVE: Chunking
        chunks = await self._chunk_pages(pages)
        
        # ❌ REMOVE: Summarization
        summaries = await self._summarize_chunks(chunks)
        
        # ❌ REMOVE: Embedding
        embeddings = await self._generate_embeddings(chunks)
        
        # ❌ REMOVE: Storage
        await self._store_chunks(chunks, embeddings)
```

---

## Target Service Responsibilities (✅ Keep)

```python
# services/crawl4ai-runner/app/services/crawling_service.py

class CrawlingService:
    """Lightweight web crawler - returns raw page data"""
    
    async def orchestrate_crawl(
        self,
        ctx: CrawlRequestContext
    ) -> CrawlResponse:
        """
        1. Discover URLs (llms.txt, sitemap, direct)
        2. Crawl pages with Playwright
        3. Extract markdown
        4. Return page list
        
        NO chunking, NO embedding, NO storage
        """
        progress_id = str(uuid.uuid4())
        
        # Phase 1: URL Discovery
        discovered_urls = await self._discover_urls(ctx.urls)
        
        # Phase 2: Crawl pages
        pages = []
        for url in discovered_urls:
            try:
                page = await self._crawl_single_page(url)
                pages.append(page)
            except Exception as e:
                logger.warning(f"Failed to crawl {url}: {e}")
        
        return CrawlResponse(
            progress_id=progress_id,
            status='completed',
            pages=pages,
            totalPages=len(pages)
        )
```

---

## Simplified Data Model

### Request

```python
from pydantic import BaseModel
from typing import List, Optional

class CrawlRequest(BaseModel):
    urls: List[str]
    max_depth: int = 1
    max_pages: int = 50
    follow_links: bool = False
    respect_robots_txt: bool = True
    user_agent: Optional[str] = None
```

### Response

```python
class CrawledPage(BaseModel):
    url: str
    content: str              # Markdown content
    title: Optional[str]
    status_code: int
    content_type: str
    last_modified: Optional[str]
    etag: Optional[str]
    crawled_at: str          # ISO timestamp
    error: Optional[str]

class CrawlResponse(BaseModel):
    progress_id: str
    status: str              # 'completed' | 'partial' | 'failed'
    pages: List[CrawledPage]
    totalPages: int
    errors: List[str] = []
```

---

## Refactored Service Structure

```
services/crawl4ai-runner/
├── app/
│   ├── main.py                    # FastAPI app
│   ├── models.py                  # Pydantic models
│   ├── services/
│   │   ├── crawler_manager.py     # ✅ KEEP: Playwright orchestration
│   │   ├── discovery_service.py   # ✅ KEEP: llms.txt, sitemap
│   │   └── markdown_extractor.py  # ✅ KEEP: HTML → Markdown
│   └── utils/
│       └── robots.py              # ✅ KEEP: robots.txt parsing
│
├── ❌ REMOVE: storage/
│   ├── postgres_store.py
│   ├── qdrant_store.py
│   └── metadata_repository.py
│
├── ❌ REMOVE: chunking/
│   └── smart_chunker.py
│
├── ❌ REMOVE: embedding/
│   └── embedding_monster_client.py
│
└── ❌ REMOVE: summarization/
    └── minimax_client.py
```

---

## Implementation

### 1. Main Endpoint

```python
# services/crawl4ai-runner/app/main.py

from fastapi import FastAPI, HTTPException
from app.models import CrawlRequest, CrawlResponse
from app.services.crawler_manager import CrawlerManager

app = FastAPI(title="Crawl4AI Web Crawler")

crawler_manager = CrawlerManager()

@app.post("/crawl", response_model=CrawlResponse)
async def crawl_pages(request: CrawlRequest):
    """
    Crawl web pages and return raw markdown content.
    Processing (chunking, embedding, storage) happens in Context layer.
    """
    try:
        response = await crawler_manager.crawl(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "crawl4ai-crawler"}
```

### 2. Crawler Manager

```python
# services/crawl4ai-runner/app/services/crawler_manager.py

from playwright.async_api import async_playwright
from app.services.markdown_extractor import MarkdownExtractor
from app.services.discovery_service import DiscoveryService
from app.models import CrawlRequest, CrawlResponse, CrawledPage
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class CrawlerManager:
    def __init__(self):
        self.markdown_extractor = MarkdownExtractor()
        self.discovery_service = DiscoveryService()
    
    async def crawl(self, request: CrawlRequest) -> CrawlResponse:
        """Main crawl orchestration"""
        progress_id = str(uuid.uuid4())
        
        # Discover URLs
        urls_to_crawl = await self.discovery_service.discover(
            request.urls,
            max_depth=request.max_depth,
            max_pages=request.max_pages,
            follow_links=request.follow_links
        )
        
        logger.info(f"Discovered {len(urls_to_crawl)} URLs to crawl")
        
        # Crawl pages
        pages = []
        errors = []
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=request.user_agent or "Claude-Context-Crawler/1.0"
            )
            
            for url in urls_to_crawl:
                try:
                    page = await self._crawl_page(context, url)
                    pages.append(page)
                except Exception as e:
                    error_msg = f"Failed to crawl {url}: {str(e)}"
                    logger.warning(error_msg)
                    errors.append(error_msg)
            
            await browser.close()
        
        status = 'completed' if len(errors) == 0 else 'partial' if len(pages) > 0 else 'failed'
        
        return CrawlResponse(
            progress_id=progress_id,
            status=status,
            pages=pages,
            totalPages=len(pages),
            errors=errors
        )
    
    async def _crawl_page(self, context, url: str) -> CrawledPage:
        """Crawl a single page"""
        page = await context.new_page()
        
        try:
            response = await page.goto(url, wait_until='networkidle')
            
            # Extract content as markdown
            html = await page.content()
            markdown = await self.markdown_extractor.extract(html, url)
            
            # Extract metadata
            title = await page.title()
            
            return CrawledPage(
                url=url,
                content=markdown,
                title=title,
                status_code=response.status,
                content_type=response.headers.get('content-type', 'text/html'),
                last_modified=response.headers.get('last-modified'),
                etag=response.headers.get('etag'),
                crawled_at=datetime.utcnow().isoformat(),
                error=None
            )
        finally:
            await page.close()
```

### 3. Markdown Extractor

```python
# services/crawl4ai-runner/app/services/markdown_extractor.py

from markdownify import markdownify as md
from bs4 import BeautifulSoup

class MarkdownExtractor:
    """Convert HTML to clean markdown"""
    
    async def extract(self, html: str, base_url: str) -> str:
        """Extract markdown from HTML"""
        
        # Parse HTML
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'aside']):
            tag.decompose()
        
        # Convert to markdown
        markdown = md(
            str(soup),
            heading_style='ATX',
            code_language='',
            bullets='-'
        )
        
        # Clean up
        markdown = self._clean_markdown(markdown)
        
        return markdown
    
    def _clean_markdown(self, markdown: str) -> str:
        """Clean up markdown formatting"""
        lines = markdown.split('\n')
        cleaned = []
        
        for line in lines:
            # Remove excessive blank lines
            if line.strip() or (cleaned and cleaned[-1].strip()):
                cleaned.append(line)
        
        return '\n'.join(cleaned).strip()
```

---

## Migration Steps

### Phase 1: Create New Simplified Endpoints

1. Create new `/crawl` endpoint with simplified response
2. Keep old endpoints for backward compatibility
3. Add feature flag to switch between modes

```python
# Feature flag
USE_SIMPLE_CRAWLER = os.getenv('USE_SIMPLE_CRAWLER', 'true').lower() == 'true'

@app.post("/crawl")
async def crawl_pages(request: CrawlRequest):
    if USE_SIMPLE_CRAWLER:
        return await crawler_manager.crawl(request)
    else:
        # Legacy path
        return await crawling_service.orchestrate_crawl(request)
```

### Phase 2: Update TypeScript Integration

Update MCP server to use new endpoint (covered in Todo 9)

### Phase 3: Remove Legacy Code

Once TypeScript integration is working:
1. Remove `storage/` directory
2. Remove `chunking/` directory
3. Remove `embedding/` directory
4. Remove `summarization/` directory
5. Remove legacy dependencies from `requirements.txt`

---

## Reduced Dependencies

```txt
# services/crawl4ai-runner/requirements.txt

# Core
fastapi==0.109.0
uvicorn==0.27.0
playwright==1.41.0
pydantic==2.5.0

# HTML Processing
beautifulsoup4==4.12.3
markdownify==0.11.6

# Utilities
aiohttp==3.9.1
python-dotenv==1.0.0

# ❌ REMOVE: Database clients
# asyncpg
# qdrant-client

# ❌ REMOVE: ML/Embedding
# torch
# transformers
# sentence-transformers

# ❌ REMOVE: Summarization
# openai
```

---

## Performance Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Service startup | ~30s | ~3s | 10x faster |
| Memory usage | ~4GB | ~500MB | 8x less |
| Dependencies | 45+ | 10 | 4.5x fewer |
| Docker image | 3.2GB | 400MB | 8x smaller |
| Crawl latency | 5-10s | 1-2s | 5x faster |

---

## Testing

```python
# tests/test_crawler.py

import pytest
from app.services.crawler_manager import CrawlerManager
from app.models import CrawlRequest

@pytest.mark.asyncio
async def test_simple_crawl():
    manager = CrawlerManager()
    
    request = CrawlRequest(
        urls=['https://example.com'],
        max_depth=1,
        max_pages=1
    )
    
    response = await manager.crawl(request)
    
    assert response.status == 'completed'
    assert len(response.pages) == 1
    assert response.pages[0].url == 'https://example.com'
    assert len(response.pages[0].content) > 0
    assert response.pages[0].title is not None
```

---

## Next Steps

Proceed to [09-mcp-integration.md](./09-mcp-integration.md).

---

**Completion Criteria:**
- ✅ Service returns raw pages only
- ✅ All storage/embedding code removed
- ✅ Dependencies reduced
- ✅ Docker image size reduced
- ✅ Tests pass
