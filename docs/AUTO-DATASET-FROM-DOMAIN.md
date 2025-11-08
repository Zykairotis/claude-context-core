# Auto-Generate Dataset Names from Domain ✅

## What Changed

The `claudeContext.crawl` tool now **automatically generates dataset names from the URL domain** instead of using a generic "crawled" default.

**Before:**
```javascript
claudeContext.crawl({ 
  url: "https://docs.example.com"
});
// → dataset: "crawled" ❌ Generic, not helpful
```

**After:**
```javascript
claudeContext.crawl({ 
  url: "https://docs.example.com"
});
// → dataset: "docs-example-com" ✅ Descriptive, domain-based!
```

---

## How It Works

### Domain Extraction Logic

**File:** `/mcp-server.js` (lines 1239-1241)

```javascript
// Extract domain from URL for dataset suggestion
const urlObj = new URL(url);
const domainName = urlObj.hostname.replace(/^www\./, '').replace(/\./g, '-');
```

**Process:**
1. Parse the URL
2. Extract hostname
3. Remove `www.` prefix if present
4. Replace dots (`.`) with hyphens (`-`)

### Examples

| URL | Extracted Domain | Dataset Name |
|-----|------------------|--------------|
| `https://docs.example.com` | `docs.example.com` | `docs-example-com` |
| `https://www.github.com/docs` | `github.com` | `github-com` |
| `https://api.inceptionlabs.ai` | `api.inceptionlabs.ai` | `api-inceptionlabs-ai` |
| `https://docs.python.org/3/` | `docs.python.org` | `docs-python-org` |

---

## Usage Examples

### Auto-Generated (Default Behavior)

```javascript
// Simple crawl - dataset auto-generated
claudeContext.crawl({ 
  url: "https://docs.inceptionlabs.ai/api/auth"
});
// → dataset: "docs-inceptionlabs-ai"

// Sitemap crawl - dataset auto-generated
claudeContext.crawl({ 
  url: "https://docs.python.org/sitemap.xml",
  mode: "sitemap"
});
// → dataset: "docs-python-org"

// Recursive crawl - dataset auto-generated
claudeContext.crawl({ 
  url: "https://api.github.com",
  mode: "recursive",
  maxDepth: 2
});
// → dataset: "api-github-com"
```

### Override When Needed

You can still provide a custom dataset name:

```javascript
// Custom dataset name
claudeContext.crawl({ 
  url: "https://docs.example.com",
  dataset: "example-api-docs"  // ✅ Override auto-generation
});
// → dataset: "example-api-docs"

// More descriptive name
claudeContext.crawl({ 
  url: "https://docs.python.org/3/library/",
  dataset: "python3-stdlib-docs",
  mode: "recursive"
});
// → dataset: "python3-stdlib-docs"
```

---

## Benefits

### 1. **Better Organization** 📁
Datasets are now automatically named based on the source domain, making them easy to identify:

```
my-project/
  ├── docs-example-com/      ✅ Clear what this is
  ├── api-github-com/         ✅ Clear what this is
  └── docs-python-org/        ✅ Clear what this is
```

vs old way:
```
my-project/
  ├── crawled/  ❌ What's in here?
  ├── crawled/  ❌ Can't have duplicates
  └── crawled/  ❌ Confusing
```

### 2. **No Name Collisions** ⚡
Each domain gets a unique dataset name automatically:

```javascript
// Different domains = different datasets
claudeContext.crawl({ url: "https://docs.react.dev" });
// → dataset: "docs-react-dev"

claudeContext.crawl({ url: "https://docs.vue.dev" });
// → dataset: "docs-vue-dev"

claudeContext.crawl({ url: "https://docs.angular.dev" });
// → dataset: "docs-angular-dev"
```

### 3. **Easier Querying** 🔍
Search specific domains easily:

```javascript
// Search only React docs
claudeContext.search({
  query: "hooks",
  dataset: "docs-react-dev"
});

// Search only Vue docs
claudeContext.search({
  query: "composition api",
  dataset: "docs-vue-dev"
});
```

---

## Real-World Examples

### Documentation Sites

```javascript
// Python docs
claudeContext.crawl({ 
  url: "https://docs.python.org/3/sitemap.xml",
  mode: "sitemap"
});
// → dataset: "docs-python-org"

// React docs
claudeContext.crawl({ 
  url: "https://react.dev",
  mode: "recursive",
  maxDepth: 2
});
// → dataset: "react-dev"

// MDN Web Docs
claudeContext.crawl({ 
  url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  mode: "recursive"
});
// → dataset: "developer-mozilla-org"
```

### API Documentation

```javascript
// Stripe API
claudeContext.crawl({ 
  url: "https://docs.stripe.com/api"
});
// → dataset: "docs-stripe-com"

// GitHub API
claudeContext.crawl({ 
  url: "https://docs.github.com/rest"
});
// → dataset: "docs-github-com"

// OpenAI API
claudeContext.crawl({ 
  url: "https://platform.openai.com/docs/api-reference"
});
// → dataset: "platform-openai-com"
```

### Company Internal Docs

```javascript
// Internal wiki
claudeContext.crawl({ 
  url: "https://wiki.company.com",
  scope: "global"  // Company-wide
});
// → dataset: "wiki-company-com"

// Team docs
claudeContext.crawl({ 
  url: "https://docs.team.company.com"
});
// → dataset: "docs-team-company-com"
```

---

## Migration Guide

### Old Workflow

```javascript
// ❌ Had to manually specify dataset every time
claudeContext.crawl({ 
  url: "https://docs.example.com",
  dataset: "example-docs"  // Required to avoid "crawled"
});

claudeContext.crawl({ 
  url: "https://api.example.com",
  dataset: "example-api"  // Required
});
```

### New Workflow

```javascript
// ✅ Just provide URL, dataset auto-generated
claudeContext.crawl({ 
  url: "https://docs.example.com"
});
// → dataset: "docs-example-com"

claudeContext.crawl({ 
  url: "https://api.example.com"
});
// → dataset: "api-example-com"
```

---

## Special Cases

### Subdomain Handling

```javascript
claudeContext.crawl({ 
  url: "https://api.v2.example.com"
});
// → dataset: "api-v2-example-com"
// ✅ Keeps full subdomain structure
```

### www Prefix Removed

```javascript
claudeContext.crawl({ 
  url: "https://www.example.com"
});
// → dataset: "example-com"
// ✅ www. automatically stripped
```

### Port Numbers Ignored

```javascript
claudeContext.crawl({ 
  url: "https://localhost:3000/docs"
});
// → dataset: "localhost"
// ✅ Port number not included
```

---

## Files Modified

1. **`/mcp-server.js`** (lines 1239-1241, 1224, 1228)
   - Domain extraction logic
   - Updated tool description
   - Updated parameter description

2. **`/cc-tools.md`** (lines 430, 463-494)
   - Updated documentation
   - New examples showing auto-generation
   - Override examples

---

## Backward Compatibility

✅ **100% Compatible**

- If you provide `dataset`, it uses your value
- If you omit `dataset`, it auto-generates from domain
- No breaking changes to existing code

```javascript
// Old code still works
claudeContext.crawl({ 
  url: "https://docs.example.com",
  dataset: "my-custom-name"
});
// → dataset: "my-custom-name" ✅ Still works!

// New default is smarter
claudeContext.crawl({ 
  url: "https://docs.example.com"
});
// → dataset: "docs-example-com" ✅ Better default!
```

---

## Summary

✅ **Dataset names auto-generated from domain**  
✅ **Better organization and discoverability**  
✅ **No manual naming required**  
✅ **Still customizable when needed**  
✅ **Zero breaking changes**  
✅ **Works with all crawl modes**  

**Restart MCP server to use:**
```bash
node mcp-server.js
```

---

**Date:** 2025-01-07  
**Status:** ✅ Complete - Much better defaults!
