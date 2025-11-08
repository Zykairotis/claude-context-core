# Claude-Context Tools - Quick Reference Card

**Total:** 24 tools (20 active + 4 deprecated)

---

## ⚙️ **Configuration (3)**

| Tool | What It Does | One-Liner |
|------|--------------|-----------|
| `init` | Set defaults | Save project/dataset so you don't repeat them |
| `defaults` | Show defaults | See what project/dataset is currently set |
| `autoScope` | Preview auto-detection | Test path → project/dataset conversion |

---

## 📦 **Indexing (5)**

| Tool | What It Does | One-Liner |
|------|--------------|-----------|
| `index` | Index local code | Scan folder, chunk code, create embeddings |
| `indexGitHub` | Index GitHub repo | Clone + index remote repository |
| `ingestCrawl` | Batch insert pages | Manually upsert web pages to DB |
| `index_web_pages` | Index web content | Index web pages with hybrid search |
| `reindex` ⚠️ | Legacy reindex | **DEPRECATED** - Use `index` instead |

---

## 🔍 **Search (7)**

| Tool | What It Does | One-Liner |
|------|--------------|-----------|
| `search` | Semantic search | Find code with natural language |
| `listDatasetPatterns` | List patterns | Show available semantic aliases |
| `previewDatasetPattern` | Preview pattern | See what datasets a pattern matches |
| `getDatasetStats` | Dataset stats | Get chunk counts, sizes, timestamps |
| `searchChunks` | Advanced search | Search with code/text/scope filters |
| `getChunk` | Get chunk by ID | Retrieve specific chunk content |
| `listScopes` | List scopes | Show all available scopes |

---

## 🕸️ **Web Crawling (3)**

| Tool | What It Does | One-Liner |
|------|--------------|-----------|
| `crawl` | Crawl websites | Fetch, chunk, embed, store web pages |
| `crawlStatus` | Check progress | Monitor running crawl |
| `cancelCrawl` | Stop crawl | Cancel in-progress crawl |

---

## 📄 **Web Content (3)**

| Tool | What It Does | One-Liner |
|------|--------------|-----------|
| `index_web_pages` | Index pages | Store web pages with hybrid search |
| `query_web_content` | Search web | Query indexed web content |
| `smart_query_web` | AI-powered query | LLM-enhanced answers with sources |

---

## 🛠️ **Management (4)**

| Tool | What It Does | One-Liner |
|------|--------------|-----------|
| `status` | Check index status | See indexing progress (real-time) |
| `clear` | Delete index | Remove project/dataset collections |
| `legacyStatus` ⚠️ | Old status | **DEPRECATED** - Use `status` instead |
| `oldClear` 🔄 | Old clear | **DUPLICATE** - Use `clear` instead |

---

## 🎯 **Most Common Workflows**

### Setup & Index
```javascript
claudeContext.init({ path: "/path/to/project" })  // 1. Set defaults
claudeContext.index({ path: "/path/to/project" }) // 2. Index code
claudeContext.status()                             // 3. Check progress
```

### Search Code
```javascript
claudeContext.search({ query: "auth middleware" })           // Simple
claudeContext.search({ query: "API", dataset: "github-*" })  // Pattern
claudeContext.search({ query: "tests", dataset: "src:code" }) // Semantic
```

### Crawl Docs
```javascript
claudeContext.crawl({ url: "https://docs.example.com" })             // Single page
claudeContext.crawl({ url: "https://docs.example.com", mode: "recursive" }) // Site
claudeContext.crawl({ url: "https://docs.example.com/sitemap.xml", mode: "sitemap" }) // Full
```

### Index GitHub
```javascript
claudeContext.indexGitHub({ repo: "github.com/vercel/next.js" })
```

---

## 🔥 **Power Features**

### Multi-Dataset Search
```javascript
dataset: ["local", "docs", "github-main"]  // Array
dataset: "github-*"                        // Glob
dataset: "env:dev"                         // Semantic (all dev)
dataset: "src:code"                        // Semantic (all code repos)
dataset: "*"                               // All datasets
```

### Semantic Aliases
```javascript
env:dev      // All dev/staging datasets
env:prod     // All production datasets
src:code     // All code repositories
src:docs     // All documentation
ver:latest   // Latest versions only
branch:main  // Main/master branches
```

---

## 📊 **Tool Count by Category**

```
Configuration:  3 tools
Indexing:       5 tools (1 deprecated)
Search:         7 tools
Web Crawling:   3 tools
Web Content:    3 tools
Management:     4 tools (2 deprecated/duplicate)
---
Total:         24 tools (20 active, 4 deprecated)
```

---

## ✨ **Top 10 Most-Used Tools**

1. **`search`** - Semantic code search
2. **`index`** - Index local codebase
3. **`crawl`** - Crawl websites
4. **`init`** - Set defaults
5. **`status`** - Check progress
6. **`indexGitHub`** - Index GitHub repos
7. **`getDatasetStats`** - Dataset info
8. **`searchChunks`** - Advanced search
9. **`clear`** - Delete index
10. **`query_web_content`** - Search web pages

---

## 🚫 **Avoid These (Deprecated)**

- ❌ `reindex` → Use `index` instead
- ❌ `legacyStatus` → Use `status` instead
- ❌ `oldClear` → Use `clear` instead

---

## 📚 **Learn More**

- **Full Guide:** `/docs/ALL-TOOLS-EXPLAINED.md` (detailed explanations)
- **Reference:** `/cc-tools.md` (complete reference)
- **Examples:** Each tool has examples in documentation

---

**Quick Help:**
```javascript
// See all defaults
claudeContext.defaults()

// Preview auto-scoping
claudeContext.autoScope({ path: "/path/to/project" })

// List dataset patterns
claudeContext.listDatasetPatterns()

// Get stats for all datasets
claudeContext.getDatasetStats({ project: "my-app", dataset: "*" })
```

---

**Last Updated:** 2025-01-07  
**Namespace:** `claudeContext`  
**Total Tools:** 24
