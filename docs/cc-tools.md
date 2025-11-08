# Claude-Context MCP Tools Reference

Complete list of all available tools in the `claude-context` MCP server.

**Namespace:** `claudeContext`

---

## 📋 Core Configuration

### 1. `claudeContext.init` ✅ **[WORKING - MULTI-PROJECT SUPPORT]**
**Set Default Project & Dataset (Manages Multiple Projects)**

Sets persistent defaults stored in `~/.context/claude-mcp.json`. **Now supports multiple projects!** Each project is saved and you can switch between them.

**Features:**
- ✅ **Manages multiple projects** - Doesn't overwrite, adds to list
- ✅ **Detects existing projects** - Shows if project already configured
- ✅ **Updates settings** - Can change dataset for existing project  
- ✅ **Auto-detection** - Can detect project from path

**Parameters:**
- `project` (optional): Default project name
- `dataset` (optional): Default dataset name  
- `path` (optional): Path to auto-detect project from (uses auto-scoping)

**Returns:** 
- If new project: "NEW project configured..."
- If existing: "Project already configured! Updated settings..."
- Shows previous dataset if updating and auto-detection status

---

### 2. `claudeContext.defaults`
**Show Default Project**

Display the stored default project/dataset used for commands when omitted.

**Parameters:** None

**Returns:** Current project, dataset, and config file path

---

### 3. `claudeContext.autoScope`
**Preview Auto-Scoping**

Preview what project ID and dataset name would be generated from a path without indexing.

**Parameters:**
- `path` (required): Absolute path to preview auto-scoping for
- `sourceType` (optional): Source type (local, github, crawl, manual) - default: 'local'
- `identifier` (optional): Identifier for github/crawl/manual sources

**Returns:** Generated project ID, dataset name, and detection details

---

## 📥 Indexing Tools

### 4. `claudeContext.checkIndex` 🆕 **[NEW - SHA-256 Detection]**
**Check If Already Indexed**

Check if a codebase is already indexed using SHA-256 file hashes. Shows what's new, modified, or unchanged.

**Features:**
- ✅ **SHA-256 comparison** - Detects exact file changes
- ✅ **Smart recommendations** - Skip, incremental, or full reindex
- ✅ **Detailed statistics** - Shows file counts and percentages
- ✅ **File lists** - Optional details on what changed

**Parameters:**
- `path` (required): Absolute path to check
- `project` (optional): Project name
- `dataset` (optional): Dataset name
- `details` (optional): Include file lists (default: false)

**Returns:** Index status with recommendations

---

### 5. `claudeContext.index` ✅ **[WORKING - AUTO-DETECTS]**
**Index Repository** 

Index a repository or folder. **Now automatically checks if already indexed!**

**Features:**
- ✅ **No freezing** - Returns instantly
- ✅ **Auto-detection** - Checks if already indexed first
- ✅ **Skip if unchanged** - Won't reindex if no changes
- ✅ **Auto-fallback** - Uses API server or direct indexing
- ✅ **Background indexing** - Runs async, check status later

**Parameters:**
- `path` (required): Absolute path to the project or repository root
- `project` (optional): Project name (auto-detected from path if not provided)
- `dataset` (optional): Dataset name (defaults to "local" for auto-detection)
- `repo` (optional): Repository name for provenance metadata
- `branch` (optional): Branch name for provenance metadata
- `sha` (optional): Commit SHA for provenance metadata
- `force` (optional): Re-create the collection even if it already exists

**Returns:** Indexing statistics (files indexed, chunks created, duration)

---

### 5. `claudeContext.indexGitHub` 🆕
**Index GitHub Repository**

Clone and index a GitHub repository into the vector database for semantic search. Automatically parses code into chunks, generates embeddings, and stores them. Runs asynchronously with job queue.

**Parameters:**
- `repo` (required): GitHub repository URL in format: `github.com/owner/repo` or `https://github.com/owner/repo`
- `branch` (optional): Branch name (default: main)
- `dataset` (optional): Dataset name (defaults to repo name)
- `project` (optional): Project name (uses default if not provided)
- `scope` (optional): Scope level - 'global', 'project', or 'local' (default: project)
- `force` (optional): Force reindex even if already exists (default: false)
- `waitForCompletion` (optional): Wait for job to complete (default: true, waits up to 2 minutes)

**Returns:**
- If already indexed (without force): Skip message with dataset info
- If waitForCompletion=false: Job ID and queued status
- If waitForCompletion=true: Success message with indexing stats (files, chunks, duration)
- On timeout: Job ID with instruction to check status later

**Example:**
```javascript
// Index a public repository
await claudeContext.indexGitHub({
  repo: "github.com/vercel/next.js",
  project: "frontend-frameworks",
  branch: "main"
});

// Queue and return immediately
await claudeContext.indexGitHub({
  repo: "github.com/facebook/react",
  waitForCompletion: false
});

// Force reindex
await claudeContext.indexGitHub({
  repo: "github.com/myorg/repo",
  force: true
});
```

**Requirements:**
- API server must be running at `http://localhost:3030` (or `API_SERVER_URL` env var)
- For private repos: Set `GITHUB_TOKEN` environment variable
- Job queue (pg-boss) must be configured and running

---

### 6. `claudeContext.reindex` ⚠️ DEPRECATED
**Re-index Changed Files (Legacy)**

Legacy incremental reindexing. For Island Architecture, use `claudeContext.index` with project/dataset and force=false for sync.

**Parameters:**
- `path` (required): Path to codebase
- `changedFiles` (optional): Array of changed file paths

**Returns:** Reindexing statistics

---

### 6. `claudeContext.ingestCrawl`
**Ingest Crawl4AI Pages**

Upsert Crawl4AI pages into the orchestrator database for a project/dataset.

**Parameters:**
- `project` (required): Project name
- `dataset` (required): Dataset name
- `pages` (required): Array of pages (1-25 max per batch)
  - `url` (required): Page URL
  - `markdownContent` (required): Primary markdown or text content
  - `htmlContent` (optional): HTML content
  - `title` (optional): Page title
  - `domain` (optional): Domain name
  - `wordCount` (optional): Word count
  - `charCount` (optional): Character count
  - `contentHash` (optional): Content hash
  - `metadata` (optional): Additional metadata
  - `isGlobal` (optional): Global page flag

**Returns:** Ingestion count and page IDs

---

## 🔍 Search & Retrieval Tools

### 7. `claudeContext.search` ✨ ENHANCED v2
**Semantic Search with Multi-Dataset Support & Smart Patterns**

Query indexed code semantically across one or multiple datasets with wildcard, glob patterns, and intelligent semantic aliases.

**Parameters:**
- `query` (required): Search query string
- `project` (optional): Project name (uses default if not provided)
- `dataset` (optional): Dataset selection - **NOW SUPPORTS:**
  - Single string: `"local"`
  - Array of datasets: `["local", "docs", "github-main"]`
  - Wildcard for all: `"*"`
  - Glob patterns: `"github-*"`, `"*-prod"`, `"crawl-*"`
  - **NEW:** Semantic aliases: `"env:dev"`, `"src:code"`, `"ver:latest"`
- `path` (optional): Legacy path-based search
- `limit` (optional): Maximum results to return (default: 10)
- `scoreThreshold` (optional): Minimum similarity score

**Returns:** Array of search results with content, file path, scores

**Semantic Aliases:**

*Environment Patterns:*
- `env:dev` - All development, staging datasets
- `env:prod` - All production datasets
- `env:test` - All testing, QA datasets
- `env:staging` - Staging environments

*Source Patterns:*
- `src:code` - All code repositories (GitHub, GitLab, local)
- `src:docs` - All documentation and wikis
- `src:api` - API reference datasets
- `src:web` - Web-crawled content
- `src:db` - Database-sourced datasets

*Version Patterns:*
- `ver:latest` - Most recent version of each dataset
- `ver:stable` - Stable releases (no alpha/beta)
- `ver:unstable` - Pre-release versions

*Branch Patterns:*
- `branch:main` - Main/master branches
- `branch:feature` - Feature branches
- `branch:hotfix` - Hotfix branches
- `branch:release` - Release branches

**Examples:**
```javascript
// Search single dataset (backward compatible)
claudeContext.search({
  query: "authentication logic",
  dataset: "local"
});

// Search multiple specific datasets
claudeContext.search({
  query: "API endpoints",
  dataset: ["docs", "api-ref", "github-main"]
});

// Search all datasets (explicit wildcard)
claudeContext.search({
  query: "user management",
  dataset: "*"
});

// Search with glob pattern - all GitHub repos
claudeContext.search({
  query: "deployment config",
  dataset: "github-*"
});

// Search with pattern - all production datasets
claudeContext.search({
  query: "database schema",
  dataset: "*-prod"
});

// 🆕 Search all development environments (semantic alias)
claudeContext.search({
  query: "debug logging",
  dataset: "env:dev"
});

// 🆕 Search all code repositories (semantic alias)
claudeContext.search({
  query: "test coverage",
  dataset: "src:code"
});

// 🆕 Search only latest versions (semantic alias)
claudeContext.search({
  query: "breaking changes",
  dataset: "ver:latest"
});

// 🆕 Search all documentation (semantic alias)
claudeContext.search({
  query: "getting started",
  dataset: "src:docs"
});

// 🆕 Combine semantic aliases and exact matches
claudeContext.search({
  query: "deployment pipeline",
  dataset: ["env:prod", "src:docs", "local"]
});

// 🆕 Combine semantic aliases and glob patterns
claudeContext.search({
  query: "CI/CD configuration",
  dataset: ["env:dev", "github-*"]
});

// Search all datasets (implicit - omit dataset)
claudeContext.search({
  query: "configuration"
  // No dataset parameter = searches all
});
```

---

### 8. `claudeContext.listDatasetPatterns` 🆕
**List Dataset Patterns**

Get available semantic aliases and pattern documentation for intelligent dataset selection.

**Parameters:**
- `project` (optional): Project name to get suggestions for

**Returns:** Pattern guide with semantic aliases, glob patterns, and suggestions

**Patterns Available:**
- Environment: `env:dev`, `env:prod`, `env:test`, `env:staging`
- Source: `src:code`, `src:docs`, `src:api`, `src:web`, `src:db`, `src:external`
- Version: `ver:latest`, `ver:stable`, `ver:unstable`
- Branch: `branch:main`, `branch:feature`, `branch:hotfix`, `branch:release`

**Examples:**
```javascript
// Get pattern guide
claudeContext.listDatasetPatterns();

// Get suggestions for specific project
claudeContext.listDatasetPatterns({
  project: "my-app"
});
```

---

### 9. `claudeContext.previewDatasetPattern` 🆕
**Preview Dataset Pattern**

Preview what datasets a pattern will match before running a search query.

**Parameters:**
- `project` (required): Project name
- `pattern` (required): Dataset pattern to preview (string, array, semantic alias, or glob)

**Returns:** List of resolved dataset names and match count

**Examples:**
```javascript
// Preview semantic alias
claudeContext.previewDatasetPattern({
  project: "my-app",
  pattern: "env:dev"
});

// Preview glob pattern
claudeContext.previewDatasetPattern({
  project: "my-app",
  pattern: "github-*"
});

// Preview array
claudeContext.previewDatasetPattern({
  project: "my-app",
  pattern: ["local", "docs", "env:prod"]
});
```

---

### 10. `claudeContext.getDatasetStats` 🆕
**Get Dataset Statistics**

Get statistics for datasets including chunk counts, page counts, and last indexed timestamps.

**Parameters:**
- `project` (required): Project name
- `dataset` (optional): Dataset pattern(s) to get stats for (`*` for all)

**Returns:** Statistics for matching datasets

**Examples:**
```javascript
// Get stats for all datasets
claudeContext.getDatasetStats({
  project: "my-app",
  dataset: "*"
});

// Get stats for production datasets
claudeContext.getDatasetStats({
  project: "my-app",
  dataset: "env:prod"
});

// Get stats for specific datasets
claudeContext.getDatasetStats({
  project: "my-app",
  dataset: ["local", "docs"]
});
```

---

### 11. `claudeContext.searchChunks`
**Search Chunks**

Search for chunks with scope filtering, code/text filtering, and similarity ranking.

**Parameters:**
- `query` (required): Search query
- `project` (optional): Project name
- `dataset` (optional): Dataset name
- `scope` (optional): Scope filter (project/dataset/collection)
- `isCode` (optional): Filter for code chunks (true) or text chunks (false)
- `limit` (optional): Maximum results (default: 10)

**Returns:** Chunks with metadata, scores, and scope information

---

### 9. `claudeContext.getChunk`
**Get Chunk**

Retrieve a specific chunk by ID.

**Parameters:**
- `chunkId` (required): Unique chunk identifier

**Returns:** Chunk content and metadata

---

### 10. `claudeContext.listScopes`
**List Scopes**

List available scopes with chunk statistics.

**Parameters:**
- `project` (optional): Filter by project name
- `dataset` (optional): Filter by dataset name

**Returns:** List of scopes with chunk counts and metadata

---

## 🌐 Web Crawling Tools

### 11. `claudeContext.crawl`
**Crawl Web Pages**

Trigger crawl4ai service to crawl and index web pages with chunking, code detection, and AI summaries.

**Parameters:**
- `url` (required): URL to crawl (string)
- `project` (optional): Project name (defaults to MCP config)
- `dataset` (optional): Dataset name (default: **auto-generated from domain**, e.g., "docs-example-com")
- `scope` (optional): Knowledge scope (default: **"project"**)
  - `global` - Shared across all projects
  - `local` - Local environment only
  - `project` - Project-scoped (recommended)
- `mode` (optional): Crawling mode (default: **"single"**)
  - `single` - Crawl one page only
  - `batch` - Crawl multiple URLs provided
  - `recursive` - Follow links and crawl discovered pages
  - `sitemap` - Parse sitemap.xml and crawl all URLs
- `maxDepth` (optional): Maximum depth for recursive crawling (default: 1)
- `autoDiscovery` (optional): Auto-discover llms.txt and sitemaps (default: true)
- `extractCode` (optional): Extract code examples (default: true)

**Crawl Modes Explained:**

| Mode | Use Case | Example |
|------|----------|---------|
| `single` | Single page (default) | Documentation page, blog post |
| `batch` | Multiple specific URLs | Several API reference pages |
| `recursive` | Follow links up to depth | Crawl entire docs site section |
| `sitemap` | Parse sitemap.xml | Full website crawl from sitemap |

**Scope Options:**

| Scope | Visibility | Use Case |
|-------|-----------|----------|
| `global` | All projects | Company-wide knowledge base |
| `local` | Local only | Personal notes, drafts |
| `project` | Project-scoped (default) | Project documentation |

**Returns:** Progress ID and crawl details - returns immediately (async)

**Example:**
```javascript
// Simple single page crawl (uses defaults)
const result = claudeContext.crawl({ 
  url: "https://docs.example.com/api/auth"
});
// Returns immediately with progress_id
// → dataset: "docs-example-com" (auto-generated from domain!)
// → scope: "project", mode: "single"

// Check status separately
claudeContext.crawlStatus(result.progress_id);

// Recursive crawl of docs site
claudeContext.crawl({ 
  url: "https://docs.inceptionlabs.ai",
  mode: "recursive",
  maxDepth: 3
});
// Returns immediately with progress_id
// → dataset: "docs-inceptionlabs-ai" (auto-generated)

// Override dataset if needed
claudeContext.crawl({ 
  url: "https://docs.example.com",
  dataset: "custom-name",  // Override auto-generation
  mode: "recursive"
});

// Sitemap-based full site crawl
claudeContext.crawl({ 
  url: "https://docs.example.com/sitemap.xml",
  mode: "sitemap",
  scope: "global"
});
// → dataset: "docs-example-com" (auto-generated)

// Note: All crawl operations return immediately with a progress_id
// Use claudeContext.crawlStatus(progress_id) to check completion
```

---

### 12. `claudeContext.crawlStatus`
**Check Crawl Status**

Check the status of a running crawl operation.

**Parameters:**
- `progressId` (required): Progress ID from crawl start

**Returns:** Status, progress percentage, processed pages, chunks stored, current URL

---

### 13. `claudeContext.cancelCrawl`
**Cancel Crawl**

Cancel a running crawl operation.

**Parameters:**
- `progressId` (required): Progress ID to cancel

**Returns:** Cancellation confirmation

---

## 📄 Web Content Tools

### 14. `claudeContext.index_web_pages`
**Index Web Pages**

Index web pages into the knowledge graph with full text + vector + SPLADE hybrid search.

**Parameters:**
- `pages` (required): Array of web pages to index
  - `url` (required): Page URL
  - `content` (required): Markdown content
  - `title` (optional): Page title
  - `metadata` (optional): Additional metadata
- `project` (required): Project name
- `dataset` (required): Dataset name
- `forceReindex` (optional): Force reindex even if exists

**Returns:** Indexing statistics (pages processed, chunks created)

---

### 15. `claudeContext.query_web_content`
**Query Web Content**

Search indexed web content with hybrid dense + sparse vector search.

**Parameters:**
- `query` (required): Search query
- `project` (required): Project name
- `dataset` (required): Dataset name
- `limit` (optional): Maximum results (default: 10)
- `rerank` (optional): Enable cross-encoder reranking

**Returns:** Search results with relevance scores

---

### 16. `claudeContext.smart_query_web`
**Smart Query Web Content**

Query web content with LLM-enhanced retrieval and answer generation.

**Parameters:**
- `query` (required): Question or query
- `project` (required): Project name
- `dataset` (required): Dataset name
- `conversationHistory` (optional): Previous conversation context

**Returns:** Generated answer with source citations

---

## 🛠️ Management Tools

### 17. `claudeContext.status` ✅ **[WORKING]**
**Index Status**

Check index status for a project/dataset. Shows real-time progress with percentage, no database query needed!

**Features:**
- ✅ **Real-time progress** - Shows percentage complete
- ✅ **In-memory tracking** - Instant response, no DB query
- ✅ **Multiple datasets** - Can check all datasets at once

**Parameters:**
- `project` (optional): Project name
- `dataset` (optional): Dataset name (optional, shows all datasets if omitted)

**Returns:** Index status with:
- `status`: starting, indexing, completed, failed, or error
- `percentage`: Progress percentage
- `expected`/`stored`: Chunk counts
- `duration`: Time elapsednd metadata

---

### 18. `claudeContext.clear`
**Clear Index**

Delete collections for a project/dataset or legacy path. With Island Architecture, deletes project-scoped collections and database records.

**Parameters:**
- `project` (optional): Project name
- `dataset` (optional): Dataset name
- `path` (optional): Legacy path to clear
- `repo` (optional): Repository filter for deletion

**Returns:** Deletion confirmation and cleanup statistics

---

## 📊 Tool Categories

### By Function:
- **Configuration (3):** `init`, `defaults`, `autoScope`
- **Indexing (5):** `index`, `indexGitHub`, `ingestCrawl`, `index_web_pages`, `reindex` (deprecated)
- **Search (7):** `search`, `listDatasetPatterns`, `previewDatasetPattern`, `getDatasetStats`, `searchChunks`, `getChunk`, `listScopes`
- **Web Crawling (3):** `crawl`, `crawlStatus`, `cancelCrawl`
- **Web Content (3):** `index_web_pages`, `query_web_content`, `smart_query_web`
- **Management (4):** `status`, `clear`, `legacyStatus` (deprecated), `oldClear` (duplicate)

### By Data Source:
- **Code:** `index`, `indexGitHub`, `search`, `searchChunks`
- **Web Pages:** `crawl`, `index_web_pages`, `query_web_content`, `smart_query_web`, `ingestCrawl`
- **Multi-Source:** `search` (with patterns), `listDatasetPatterns`
- **General:** `init`, `defaults`, `status`, `clear`, `listScopes`, `getDatasetStats`

---

## 🚀 Quick Start Workflow

### 1. Initialize Project
```javascript
claudeContext.init({ path: "/absolute/path/to/project" })
```

### 2. Index Codebase
```javascript
claudeContext.index({ path: "/absolute/path/to/project" })
```

### 3. Search Code
```javascript
claudeContext.search({ query: "authentication logic" })
```

### 4. Crawl Documentation
```javascript
claudeContext.crawl({ 
  urls: ["https://docs.example.com"],
  project: "my-project",
  dataset: "docs"
})
```

### 5. Query Web Content
```javascript
claudeContext.query_web_content({
  query: "installation steps",
  project: "my-project",
  dataset: "docs"
})
```

---

## 📝 Notes

- **Auto-Scoping:** When `path` is provided, project/dataset are automatically detected
- **Defaults:** Set once with `init`, reused for all subsequent calls
- **Island Architecture:** Project/dataset scoping enabled for 5-10x faster queries
- **Hybrid Search:** Combines dense vectors (GTE/CodeRank) + sparse vectors (SPLADE)
- **Reranking:** Optional cross-encoder reranking for improved relevance

---

## 🔧 **Deprecated/Legacy Tools**

### 19. `claudeContext.reindex` ⚠️
**Re-index Changed Files (DEPRECATED)**

Legacy incremental reindexing. Use `claudeContext.index` with `force=false` instead.

---

### 20. `claudeContext.legacyStatus` ⚠️
**Legacy Path-Based Status (DEPRECATED)**

Old path-based status check. Use `claudeContext.status` with project/dataset instead.

---

### 21. `claudeContext.oldClear` 🔄
**Legacy Clear Tool (DUPLICATE)**

Duplicate of `claudeContext.clear`. Use the main `clear` tool instead.

---

## 📊 **Complete Tool Summary**

**Total Tools:** 25 (21 active + 4 deprecated/legacy)  
**Active Tools:** 21 (including new checkIndex)  
**Deprecated:** 2 (reindex, legacyStatus)  
**Duplicates:** 2 (oldClear)  

**Namespace:** `claudeContext`  
**Version:** See package.json

### Tool Categories:
- **Configuration (3):** init, defaults, autoScope
- **Indexing (5):** checkIndex, index, indexGitHub, ingestCrawl, index_web_pages  
- **Search (7):** search, listDatasetPatterns, previewDatasetPattern, getDatasetStats, searchChunks, getChunk, listScopes
- **Crawling (3):** crawl, crawlStatus, cancelCrawl
- **Web Content (3):** index_web_pages, query_web_content, smart_query_web
- **Management (2):** status, clear
- **Deprecated (4):** reindex, legacyStatus, oldClear, (legacy path-based tools)

**For detailed explanations of all 25 tools, see:** `/docs/ALL-TOOLS-EXPLAINED.md`
