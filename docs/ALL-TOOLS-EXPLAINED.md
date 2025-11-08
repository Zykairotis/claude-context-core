# Complete Claude-Context MCP Tools Guide

**Total Tools:** 24 (20 active + 4 deprecated/legacy)  
**Namespace:** `claudeContext`

---

## 📋 **Configuration Tools** (3)

### 1. `claudeContext.init` ⚙️
**Set Default Project & Dataset**

Saves default project/dataset to `~/.context/claude-mcp.json` so you don't have to specify them every time. Supports auto-detection from file paths.

**When to use:** First time setup, or when switching between projects

**Example:**
```javascript
// Manual setup
claudeContext.init({ 
  project: "my-app", 
  dataset: "backend" 
});

// Auto-detect from path
claudeContext.init({ 
  path: "/home/user/projects/my-app" 
});
// → Generates project ID and dataset automatically
```

---

### 2. `claudeContext.defaults` 📄
**Show Current Defaults**

Displays what project/dataset will be used when you don't specify them.

**When to use:** Check what defaults are currently set

**Example:**
```javascript
claudeContext.defaults();
// → { project: "my-app", dataset: "backend", configPath: "~/.context/claude-mcp.json" }
```

---

### 3. `claudeContext.autoScope` 🔍
**Preview Auto-Scoping**

Shows what project ID and dataset name would be auto-generated from a path WITHOUT actually indexing.

**When to use:** Test auto-scoping before indexing

**Example:**
```javascript
claudeContext.autoScope({ 
  path: "/home/user/projects/my-app" 
});
// → { projectId: "a1b2c3d4-my-app-e5f6g7h8", dataset: "local", ... }
```

---

## 📥 **Indexing Tools** (4 + 1 deprecated)

### 4. `claudeContext.index` 📦
**Index Local Codebase**

Indexes code from a local directory. Auto-detects project/dataset from path, chunks code, generates embeddings, and stores in vector database.

**When to use:** Index your local project for semantic search

**Features:**
- Auto-scoping (generates project/dataset from path)
- Symbol extraction (functions, classes, imports)
- Parallel embedding (GTE for text, CodeRank for code)
- Incremental sync (only indexes changed files)

**Example:**
```javascript
claudeContext.index({ 
  path: "/home/user/projects/my-app" 
});
// → Indexes all code files, creates embeddings, stores chunks
```

---

### 5. `claudeContext.indexGitHub` 🌐
**Index GitHub Repository**

Clones and indexes a GitHub repository. Runs asynchronously with job queue.

**When to use:** Index external repos (dependencies, reference code, libraries)

**Features:**
- Async job queue (pg-boss)
- Private repo support (GITHUB_TOKEN)
- Force reindex option
- Wait for completion or return immediately

**Example:**
```javascript
claudeContext.indexGitHub({ 
  repo: "github.com/vercel/next.js",
  branch: "canary",
  project: "frameworks",
  waitForCompletion: true
});
```

---

### 6. `claudeContext.ingestCrawl` 🕷️
**Ingest Crawl4AI Pages**

Manually upserts crawled web pages into the database (alternative to using the crawl tool's automatic storage).

**When to use:** Batch insert pre-crawled pages, custom crawl workflows

**Example:**
```javascript
claudeContext.ingestCrawl({
  project: "my-app",
  dataset: "docs",
  pages: [{
    url: "https://docs.example.com",
    markdownContent: "# Docs...",
    title: "Documentation"
  }]
});
```

---

### 7. `claudeContext.reindex` ⚠️ **DEPRECATED**
**Legacy Incremental Reindex**

Old path-based incremental indexing. Use `claudeContext.index` instead with `force=false` for sync.

---

## 🔍 **Search & Retrieval Tools** (7)

### 8. `claudeContext.search` 🎯
**Semantic Code Search**

Search indexed code using natural language. Supports multi-dataset search, glob patterns, and semantic aliases.

**When to use:** Find code snippets, functions, examples

**Powerful Features:**
- **Multi-dataset:** Search across multiple datasets at once
- **Glob patterns:** `"github-*"`, `"*-prod"`
- **Semantic aliases:** `"env:dev"`, `"src:code"`, `"ver:latest"`
- **Hybrid search:** Dense + sparse vectors
- **Reranking:** Cross-encoder for better relevance

**Examples:**
```javascript
// Simple search
claudeContext.search({ 
  query: "authentication middleware" 
});

// Search specific datasets
claudeContext.search({ 
  query: "API routes",
  dataset: ["local", "docs", "github-main"]
});

// Search all GitHub repos
claudeContext.search({ 
  query: "error handling",
  dataset: "github-*"
});

// Search all dev environments (semantic alias)
claudeContext.search({ 
  query: "debug logging",
  dataset: "env:dev"
});

// Search all code repositories (semantic alias)
claudeContext.search({ 
  query: "test coverage",
  dataset: "src:code"
});
```

---

### 9. `claudeContext.listDatasetPatterns` 📋
**List Dataset Patterns**

Shows all available semantic aliases and pattern documentation.

**When to use:** Discover what patterns you can use

**Example:**
```javascript
claudeContext.listDatasetPatterns();
// → Returns pattern guide with env:*, src:*, ver:*, branch:* aliases
```

---

### 10. `claudeContext.previewDatasetPattern` 👀
**Preview Pattern Matching**

See what datasets a pattern will match BEFORE searching.

**When to use:** Verify your pattern matches the right datasets

**Example:**
```javascript
claudeContext.previewDatasetPattern({
  project: "my-app",
  pattern: "env:dev"
});
// → ["local-dev", "staging", "test-env"]
```

---

### 11. `claudeContext.getDatasetStats` 📊
**Get Dataset Statistics**

Get chunk counts, page counts, and last indexed timestamps for datasets.

**When to use:** Understand dataset sizes, check indexing status

**Example:**
```javascript
claudeContext.getDatasetStats({
  project: "my-app",
  dataset: "*"  // All datasets
});
// → [{ dataset: "local", chunks: 1234, pages: 56, lastIndexed: "2025-01-07" }]
```

---

### 12. `claudeContext.searchChunks` 🔎
**Search Chunks with Filters**

Advanced chunk search with code/text filtering and scope filtering.

**When to use:** Find specific chunks with filters (code only, text only, specific scope)

**Example:**
```javascript
claudeContext.searchChunks({
  query: "React hooks",
  isCode: true,  // Only code chunks
  limit: 20
});
```

---

### 13. `claudeContext.getChunk` 📄
**Get Specific Chunk**

Retrieve a chunk by its ID.

**When to use:** Get full chunk content after finding chunk ID in search results

**Example:**
```javascript
claudeContext.getChunk({ 
  chunkId: "abc123..." 
});
```

---

### 14. `claudeContext.listScopes` 📚
**List Available Scopes**

Lists all scopes with chunk counts (project/dataset/collection level).

**When to use:** Explore what's indexed, understand scope structure

**Example:**
```javascript
claudeContext.listScopes({ 
  project: "my-app" 
});
```

---

## 🌐 **Web Crawling Tools** (3)

### 15. `claudeContext.crawl` 🕸️
**Crawl & Index Web Pages**

Crawls websites and indexes content. Supports 4 modes, auto-generates dataset from domain.

**When to use:** Index documentation sites, API references, blogs

**4 Crawl Modes:**
- **`single`** - Crawl one page only (default)
- **`batch`** - Crawl multiple specific URLs
- **`recursive`** - Follow links and crawl discovered pages (depth-limited)
- **`sitemap`** - Parse sitemap.xml and crawl all URLs

**Smart Features:**
- **Auto-dataset:** `docs.example.com` → `docs-example-com`
- **Code detection:** Detects code blocks and routes to CodeRank
- **Chunking:** Smart chunking with overlap
- **Embeddings:** Parallel GTE + CodeRank embedding
- **Auto-discovery:** Finds llms.txt and sitemaps automatically

**Examples:**
```javascript
// Single page (simple)
claudeContext.crawl({ 
  url: "https://docs.python.org/3/library/asyncio.html" 
});
// → dataset: "docs-python-org" (auto-generated)

// Recursive crawl (docs site)
claudeContext.crawl({ 
  url: "https://docs.react.dev",
  mode: "recursive",
  maxDepth: 3
});
// → Crawls entire docs site up to 3 levels deep

// Sitemap crawl (full site)
claudeContext.crawl({ 
  url: "https://docs.example.com/sitemap.xml",
  mode: "sitemap"
});
// → Parses sitemap, crawls all URLs
```

---

### 16. `claudeContext.crawlStatus` ⏳
**Check Crawl Progress**

Checks status of running crawl with progress percentage.

**When to use:** Monitor long-running crawls

**Example:**
```javascript
claudeContext.crawlStatus({ 
  progressId: "abc123..." 
});
// → { status: "running", progress: 45, processedPages: 23, chunksStored: 456 }
```

---

### 17. `claudeContext.cancelCrawl` ⛔
**Cancel Running Crawl**

Stops a crawl in progress.

**When to use:** Cancel crawls that are taking too long or crawling wrong content

**Example:**
```javascript
claudeContext.cancelCrawl({ 
  progressId: "abc123..." 
});
```

---

## 📄 **Web Content Tools** (3)

### 18. `claudeContext.index_web_pages` 📝
**Index Web Pages Manually**

Indexes web pages with full text + vector + SPLADE hybrid search.

**When to use:** Index pre-fetched web content, custom web scrapers

**Example:**
```javascript
claudeContext.index_web_pages({
  project: "my-app",
  dataset: "docs",
  pages: [{
    url: "https://docs.example.com",
    content: "# Markdown content...",
    title: "Documentation"
  }]
});
```

---

### 19. `claudeContext.query_web_content` 🔍
**Query Web Content**

Search indexed web content with hybrid search (dense + sparse vectors).

**When to use:** Search web pages you've indexed

**Example:**
```javascript
claudeContext.query_web_content({
  query: "installation steps",
  project: "my-app",
  dataset: "docs",
  rerank: true  // Better relevance
});
```

---

### 20. `claudeContext.smart_query_web` 🤖
**Smart Query with LLM**

Query web content with LLM-enhanced retrieval and answer generation.

**When to use:** Get AI-generated answers with source citations

**Example:**
```javascript
claudeContext.smart_query_web({
  query: "How do I deploy to production?",
  project: "my-app",
  dataset: "docs"
});
// → Generated answer with sources
```

---

## 🛠️ **Management Tools** (4 + 2 deprecated)

### 21. `claudeContext.status` ✅
**Check Index Status**

Shows indexing status with progress tracking (in-memory, no DB query).

**When to use:** Check if indexing is complete, see progress

**Features:**
- Real-time progress (expected vs stored chunks)
- No database queries (instant response)
- Works for single dataset or all datasets

**Example:**
```javascript
// Single dataset
claudeContext.status({ 
  project: "my-app",
  dataset: "local"
});

// All datasets
claudeContext.status({ 
  project: "my-app"
});
```

---

### 22. `claudeContext.clear` 🗑️
**Clear Index**

Deletes collections and database records for project/dataset.

**When to use:** Remove indexed content, start fresh

**Example:**
```javascript
claudeContext.clear({ 
  project: "my-app",
  dataset: "local"
});
```

---

### 23. `claudeContext.legacyStatus` ⚠️ **DEPRECATED**
**Legacy Path-Based Status**

Old path-based status check. Use `claudeContext.status` instead.

---

### 24. `claudeContext.oldClear` ⚠️ **DUPLICATE**
**Old Clear Tool**

Duplicate of `claudeContext.clear`. Use the main `clear` tool.

---

## 🎯 **Quick Reference by Use Case**

### Starting a New Project
```javascript
// 1. Initialize with auto-detection
claudeContext.init({ path: "/path/to/project" });

// 2. Index the codebase
claudeContext.index({ path: "/path/to/project" });

// 3. Check status
claudeContext.status();
```

### Adding External Documentation
```javascript
// Crawl documentation site
claudeContext.crawl({ 
  url: "https://docs.framework.com",
  mode: "recursive",
  maxDepth: 2
});
```

### Searching Across Everything
```javascript
// Search all code repositories
claudeContext.search({ 
  query: "authentication",
  dataset: "src:code"
});

// Search all docs
claudeContext.search({ 
  query: "getting started",
  dataset: "src:docs"
});

// Search everything
claudeContext.search({ 
  query: "deployment",
  dataset: "*"
});
```

---

## 📊 **Tool Categories**

### By Function
- **Setup (3):** init, defaults, autoScope
- **Indexing (4):** index, indexGitHub, ingestCrawl, index_web_pages
- **Search (7):** search, searchChunks, getChunk, listScopes, query_web_content, smart_query_web, listDatasetPatterns
- **Crawling (3):** crawl, crawlStatus, cancelCrawl
- **Management (2):** status, clear
- **Utilities (3):** previewDatasetPattern, getDatasetStats, defaults
- **Deprecated (2):** reindex, legacyStatus

### By Data Source
- **Code:** index, indexGitHub, search, searchChunks
- **Web:** crawl, index_web_pages, query_web_content, smart_query_web
- **Multi-source:** search (with patterns), listDatasetPatterns

---

## 🚀 **Power Features**

### 1. Auto-Scoping
Automatically generates project IDs and dataset names from file paths:
```
/home/user/projects/my-app → project: "a1b2-my-app-c3d4", dataset: "local"
```

### 2. Multi-Dataset Search
Search across multiple datasets in one query:
```javascript
dataset: ["local", "docs", "github-main"]
dataset: "github-*"  // Glob pattern
dataset: "env:dev"   // Semantic alias
```

### 3. Semantic Aliases
Intelligent dataset selection:
- `env:dev` - All dev/staging datasets
- `env:prod` - All production datasets
- `src:code` - All code repositories
- `src:docs` - All documentation
- `ver:latest` - Latest versions only

### 4. Hybrid Search
Combines 3 search methods:
- Dense vectors (GTE for text, CodeRank for code)
- Sparse vectors (SPLADE)
- Cross-encoder reranking (optional)

### 5. Island Architecture
Project/dataset scoping for 5-10x faster queries:
- Isolated collections per dataset
- No cross-contamination
- Parallel indexing support

---

## 📝 **Tool Status Summary**

✅ **Active:** 20 tools  
⚠️ **Deprecated:** 2 tools (reindex, legacyStatus)  
🔄 **Duplicate:** 2 tools (oldClear = clear)  
📦 **Total:** 24 tools

---

**Last Updated:** 2025-01-07  
**Version:** See package.json  
**Namespace:** `claudeContext`
