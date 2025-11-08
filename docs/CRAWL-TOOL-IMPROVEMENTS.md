# Crawl Tool Improvements ✅

## What Changed

Updated `claudeContext.crawl` tool to:
1. **Set better defaults** - dataset="crawled", scope="project"
2. **List all modes** in description - single, batch, recursive, sitemap
3. **List all scopes** in description - global, local, project
4. **Add detailed examples** to documentation

---

## Files Modified

1. **`/mcp-server.js`** (lines 1222-1244)
   - Updated tool description with mode explanations
   - Set `dataset` default to `"crawled"`
   - Set `scope` default to `"project"`
   - Added detailed parameter descriptions

2. **`/cc-tools.md`** (lines 420-509)
   - Complete mode comparison table
   - Scope options table
   - Usage examples for each mode

---

## New Defaults

### Before
```javascript
await claudeContext.crawl({
  url: "https://docs.example.com",
  project: "my-app",
  dataset: "docs",  // ❌ Required
  scope: "local"    // ❌ Had to specify
});
```

### After
```javascript
await claudeContext.crawl({
  url: "https://docs.example.com"
  // ✅ dataset: "crawled" (automatic)
  // ✅ scope: "project" (automatic)
  // ✅ mode: "single" (automatic)
});
```

---

## Crawl Modes

### 1. `single` (Default)
**Use:** Crawl one page only

**Example:**
```javascript
claudeContext.crawl({ 
  url: "https://docs.example.com/api/auth"
});
```

**Best For:**
- Single documentation page
- Blog post
- API reference page
- Quick content capture

---

### 2. `batch`
**Use:** Crawl multiple specific URLs

**Example:**
```javascript
claudeContext.crawl({ 
  url: "https://docs.example.com",
  mode: "batch"
  // Provide multiple URLs via crawl4ai service
});
```

**Best For:**
- Several related pages
- Multiple API endpoints
- Specific documentation sections
- Curated page list

---

### 3. `recursive`
**Use:** Follow links and crawl discovered pages

**Example:**
```javascript
claudeContext.crawl({ 
  url: "https://docs.example.com",
  mode: "recursive",
  maxDepth: 3  // Follow links 3 levels deep
});
```

**Best For:**
- Entire docs site section
- Related pages
- Documentation tree
- Connected content

**Settings:**
- `maxDepth: 1` - Only linked pages (default)
- `maxDepth: 2` - Links + their links
- `maxDepth: 3` - 3 levels deep (careful - can be many pages!)

---

### 4. `sitemap`
**Use:** Parse sitemap.xml and crawl all URLs

**Example:**
```javascript
claudeContext.crawl({ 
  url: "https://docs.example.com/sitemap.xml",
  mode: "sitemap"
});
```

**Best For:**
- Full website crawl
- Complete documentation site
- All indexed pages
- Bulk content import

**Note:** Most efficient for large sites with sitemaps

---

## Scope Options

### 1. `project` (Default)
**Visibility:** Project-scoped

**Use Case:**
- Project-specific documentation
- Project dependencies docs
- Team knowledge base
- Project tutorials

**Example:**
```javascript
claudeContext.crawl({ 
  url: "https://docs.myframework.com",
  scope: "project"  // Only visible in this project
});
```

---

### 2. `global`
**Visibility:** Shared across all projects

**Use Case:**
- Company-wide knowledge
- Common libraries
- Shared resources
- Organization docs

**Example:**
```javascript
claudeContext.crawl({ 
  url: "https://internal-wiki.company.com",
  scope: "global"  // Available to all projects
});
```

---

### 3. `local`
**Visibility:** Local environment only

**Use Case:**
- Personal notes
- Draft content
- Experimental docs
- Private research

**Example:**
```javascript
claudeContext.crawl({ 
  url: "https://my-blog.com/draft",
  scope: "local"  // Only on this machine
});
```

---

## Complete Examples

### Simple Documentation Page
```javascript
// Minimal - uses all defaults
claudeContext.crawl({ 
  url: "https://docs.example.com/getting-started"
});

// Equivalent to:
// dataset: "crawled"
// scope: "project"
// mode: "single"
// autoDiscovery: true
// extractCode: true
```

### API Documentation Site
```javascript
// Recursive crawl with custom dataset
claudeContext.crawl({ 
  url: "https://api.example.com/docs",
  mode: "recursive",
  maxDepth: 2,
  dataset: "example-api",
  extractCode: true
});
```

### Full Website via Sitemap
```javascript
// Complete site crawl
claudeContext.crawl({ 
  url: "https://docs.example.com/sitemap.xml",
  mode: "sitemap",
  dataset: "example-complete",
  scope: "global"
});
```

### Personal Blog Article
```javascript
// Single page, local scope
claudeContext.crawl({ 
  url: "https://myblog.com/article/123",
  scope: "local",
  dataset: "blog-research"
});
```

---

## Tool Description

The tool now includes all mode and scope information in its description:

```
Trigger crawl4ai service to crawl and index web pages. 

Modes: 
  • single (1 page)
  • batch (multiple URLs)
  • recursive (follow links)
  • sitemap (parse sitemap.xml)

Defaults: 
  • dataset="crawled"
  • scope="project"
  • mode="single"
```

This makes it **self-documenting** when used in AI assistants like Claude.

---

## Parameter Reference

### Required
- `url` - URL to crawl (string)

### Optional (with defaults)
- `project` - Project name (defaults to MCP config)
- `dataset` - Dataset name (default: **"crawled"**)
- `scope` - Knowledge scope (default: **"project"**)
- `mode` - Crawling mode (default: **"single"**)
- `maxDepth` - Max depth for recursive (default: 1)
- `autoDiscovery` - Auto-discover llms.txt/sitemaps (default: true)
- `extractCode` - Extract code examples (default: true)

---

## Quick Reference Table

| Mode | Pages Crawled | Speed | Use Case |
|------|---------------|-------|----------|
| `single` | 1 | Fastest | Single page |
| `batch` | Multiple (specified) | Fast | Curated list |
| `recursive` | Discovered (depth-limited) | Medium | Connected pages |
| `sitemap` | All in sitemap | Varies | Full site |

| Scope | Visible To | Use Case |
|-------|-----------|----------|
| `local` | This machine only | Personal notes |
| `project` | This project | Project docs (default) |
| `global` | All projects | Company knowledge |

---

## Migration Guide

### Old Way (verbose)
```javascript
claudeContext.crawl({ 
  url: "https://docs.example.com",
  project: "my-app",
  dataset: "docs",
  scope: "project",
  mode: "single"
});
```

### New Way (minimal)
```javascript
claudeContext.crawl({ 
  url: "https://docs.example.com"
});
// Same result! Uses smart defaults
```

### Override Defaults When Needed
```javascript
// Different dataset
claudeContext.crawl({ 
  url: "https://docs.example.com",
  dataset: "example-docs"
});

// Recursive mode
claudeContext.crawl({ 
  url: "https://docs.example.com",
  mode: "recursive",
  maxDepth: 3
});

// Global scope
claudeContext.crawl({ 
  url: "https://internal-wiki.com",
  scope: "global"
});
```

---

## Summary

✅ **Better defaults** - dataset="crawled", scope="project"  
✅ **All modes listed** - single, batch, recursive, sitemap  
✅ **All scopes listed** - global, local, project  
✅ **Self-documenting** - descriptions include all options  
✅ **Examples added** - clear usage patterns  
✅ **Table reference** - quick mode/scope comparison  

**Restart MCP server to use:**
```bash
node mcp-server.js
```

---

**Date:** 2025-01-07  
**Status:** ✅ Complete - Documentation and defaults improved!
