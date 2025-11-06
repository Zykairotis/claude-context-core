# Auto-Scoping User Guide

**Version:** 1.0  
**Status:** 📖 DRAFT  
**Audience:** End users, MCP clients

---

## 🎯 What is Auto-Scoping?

**Auto-Scoping** automatically generates project and dataset names based on your file paths. No more manual naming!

### The Old Way (Manual) 😫

```javascript
// Step 1: Think of a name
claudeContext.init({
  project: "my-awesome-app",  // What should I call this?
  dataset: "backend"           // And this?
});

// Step 2: Index
claudeContext.index({
  path: "/home/user/projects/my-awesome-app"
});

// Step 3: Query
claudeContext.query({query: "auth middleware"});
```

**Problems:**
- ❌ Have to think of names
- ❌ Might misspell later
- ❌ Different names across machines
- ❌ Requires `init` call

### The New Way (Auto) 🚀

```javascript
// Just index - everything automatic!
claudeContext.index({
  path: "/home/user/projects/my-awesome-app"
});
// ✅ Auto-generates: Wx4aB-my-awesome-app-Ty8cD / local

// Query automatically scoped
claudeContext.query({query: "auth middleware"});
// ✅ Searches only: Wx4aB-my-awesome-app-Ty8cD
```

**Benefits:**
- ✅ Zero configuration
- ✅ Deterministic (same path = same name)
- ✅ No typos possible
- ✅ Works across all machines

---

## 🏗️ How It Works

### Project ID Generation

**Format:**
```
{prefix-hash}-{folder-name}-{suffix-hash}
```

**Example:**
```
Path: /home/user/projects/my-app
Project ID: Wx4aBcDe-my-app-Ty8cDeFg
            └──┬───┘ └──┬───┘ └──┬───┘
            prefix   folder   suffix
           (8 chars) (name)  (8 chars)
```

**Why This Format?**

| Component | Purpose | Example |
|-----------|---------|---------|
| **Prefix Hash** | Uniqueness | `Wx4aBcDe` (8 chars) |
| **Folder Name** | Readability | `my-app` |
| **Suffix Hash** | Collision detection | `Ty8cDeFg` (8 chars) |

**Properties:**
- ✅ **Readable:** You can see the folder name
- ✅ **Unique:** Hash prevents collisions
- ✅ **Deterministic:** Same path → same ID
- ✅ **URL-Safe:** Base58 encoding (no special chars)

---

### Dataset Name Generation

**Patterns:**

| Source | Pattern | Example |
|--------|---------|---------|
| **Local** | `local` | `local` |
| **GitHub** | `github-{owner}-{repo}` | `github-nodejs-node` |
| **Web Crawl** | `crawl-{domain}` | `crawl-docs-nodejs-org` |
| **Manual** | `manual-{name}` | `manual-experiments` |

**Examples:**

```javascript
// Local indexing
claudeContext.index({path: "/path/to/project"})
// → Project: Wx4aB-project-Ty8cD
// → Dataset: local

// GitHub indexing  
claudeContext.indexGitHub({repo: "nodejs/node"})
// → Project: (from current directory or default)
// → Dataset: github-nodejs-node

// Web crawling
claudeContext.crawl({url: "https://docs.nodejs.org"})
// → Project: (from current directory or default)
// → Dataset: crawl-docs-nodejs-org
```

---

## 📚 Usage Examples

### Example 1: Single Project

```javascript
// Index your project
claudeContext.index({
  path: "/home/user/my-app"
});
// ✅ Creates: Wx4aBcDe-my-app-Ty8cDeFg / local

// Query searches only your project
claudeContext.query({query: "authentication"});
// ✅ Searches: Wx4aB-my-app-Ty8cD / local

// Add GitHub reference docs
claudeContext.indexGitHub({repo: "nodejs/node"});
// ✅ Creates dataset: Wx4aB-my-app-Ty8cD / github-nodejs-node

// Add web docs
claudeContext.crawl({url: "https://docs.example.com"});
// ✅ Creates dataset: Wx4aB-my-app-Ty8cD / crawl-docs-example-com

// Query searches ALL datasets in project
claudeContext.query({query: "http server"});
// ✅ Searches across: local, github-nodejs-node, crawl-docs-example-com
```

**Result:**
```
Project: Wx4aBcDe-my-app-Ty8cDeFg
├── local                    (your code)
├── github-nodejs-node      (Node.js reference)
└── crawl-docs-example-com  (docs)
```

---

### Example 2: Multiple Projects

```javascript
// Project A
claudeContext.index({
  path: "/home/user/project-a"
});
// → Wx4aB-project-a-Ty8cD / local

claudeContext.query({query: "user model"});
// → Searches only project-a

// Project B  
claudeContext.index({
  path: "/home/user/project-b"
});
// → Kj7xC-project-b-Pm2yF / local

claudeContext.query({query: "user model"});
// → Searches only project-b (isolated!)
```

**Result:**
```
Projects:
├── Wx4aB-project-a-Ty8cD
│   └── local
└── Kj7xC-project-b-Pm2yF
    └── local

✅ Perfect isolation - no cross-contamination!
```

---

### Example 3: Same Folder Name, Different Locations

```javascript
// Company A's my-app
claudeContext.index({
  path: "/projects/company-a/my-app"
});
// → Wx4aB-my-app-Ty8cD

// Company B's my-app
claudeContext.index({
  path: "/projects/company-b/my-app"
});
// → Kj7xC-my-app-Pm2yF

// ✅ Different hashes prevent collision!
```

---

## 🎛️ Manual Overrides

### When to Use Manual Names

**Auto-scoping is great for most cases, but you can override when needed:**

- 🎯 **Team sharing:** Everyone uses same custom name
- 🎯 **Migration:** Keep existing project names
- 🎯 **Branding:** Use company/product name

### How to Override

**Method 1: Per-call override**
```javascript
claudeContext.index({
  path: "/home/user/my-app",
  project: "acme-backend",     // Custom project name
  dataset: "production"         // Custom dataset name
});
```

**Method 2: Set as default**
```javascript
// Traditional init (still works!)
claudeContext.init({
  project: "acme-backend",
  dataset: "production"
});

// Subsequent calls use defaults
claudeContext.index({path: "/home/user/my-app"});
// → Uses: acme-backend / production
```

**Method 3: Path-specific override**
```javascript
// Set override for specific path
claudeContext.setOverride({
  path: "/home/user/my-app",
  project: "acme-backend",
  dataset: "production"
});

// Future indexes of this path use override
claudeContext.index({path: "/home/user/my-app"});
// → Uses: acme-backend / production
```

---

## 🔍 Inspecting Auto-Generated Names

### Preview Without Indexing

```javascript
// See what would be generated
claudeContext.autoScope({
  path: "/home/user/my-app",
  sourceType: "local"
});

// Output:
// 🔍 Auto-Detection Results:
//
// Project ID: Wx4aB-my-app-Ty8cD
// Dataset: local
// Source: detected
// Path: /home/user/my-app
```

### Check Current Defaults

```javascript
claudeContext.defaults();

// Output:
// Project: Wx4aB-my-app-Ty8cD
// Dataset: local
// Config Path: /home/user/.context/claude-mcp.json
```

### View Auto-Scoping History

```javascript
claudeContext.history();

// Output:
// Recent Auto-Scoped Projects:
// 1. Wx4aB-my-app-Ty8cD (local) - /home/user/my-app
// 2. Kj7xC-other-app-Pm2yF (local) - /home/user/other-app
// 3. ...
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Enable/disable auto-scoping (default: true)
export AUTO_SCOPE_ENABLED=true

# Hash length (default: 5)
export AUTO_SCOPE_HASH_LENGTH=5

# Auto-save as defaults on first index (default: true)
export AUTO_SCOPE_AUTO_SAVE=true
```

### Config File

**Location:** `~/.context/auto-scope.json`

```json
{
  "enabled": true,
  "hashLength": 8,
  "autoSave": true,
  "overrides": {
    "/home/user/special-project": {
      "project": "custom-name",
      "dataset": "main"
    }
  },
  "history": [
    {
      "path": "/home/user/my-app",
      "projectId": "Wx4aB-my-app-Ty8cD",
      "timestamp": "2025-11-05T14:00:00Z"
    }
  ]
}
```

---

## 🚨 Troubleshooting

### Problem: "Auto-scoping disabled"

**Cause:** `AUTO_SCOPE_ENABLED=false` in environment

**Solution:**
```bash
export AUTO_SCOPE_ENABLED=true
# Or manually provide project/dataset
claudeContext.init({project: "my-project"})
```

---

### Problem: Different IDs on different machines

**Cause:** Paths differ between machines

**Example:**
```
Machine A: /home/alice/projects/my-app → Wx4aB-my-app-Ty8cD
Machine B: /home/bob/projects/my-app   → Kj7xC-my-app-Pm2yF
                                           (different hash!)
```

**Solution 1: Use manual override (team sharing)**
```javascript
// Everyone uses same name
claudeContext.init({project: "team-app"});
```

**Solution 2: Path override config**
```javascript
// Set override to use same ID as Machine A
claudeContext.setOverride({
  path: "/home/bob/projects/my-app",
  project: "Wx4aB-my-app-Ty8cD"  // Use Machine A's ID
});
```

---

### Problem: Want to rename auto-generated project

**Can't rename (hash-based), but can override:**

```javascript
// Option 1: Set new default
claudeContext.init({project: "better-name"});

// Option 2: Migrate data (manual)
// 1. Export from old project
// 2. Import to new project
// 3. Delete old project
```

---

## 📊 Best Practices

### ✅ Do

- **Let auto-scoping work** - Don't override unless necessary
- **One project per codebase** - Each git repo = one project
- **Multiple datasets** - Use datasets for different sources
- **Preview first** - Use `autoScope` to see what's generated
- **Check defaults** - Use `defaults` to verify current state

### ❌ Don't

- **Don't manually create project IDs** - Let system generate
- **Don't use same name for different paths** - Causes confusion
- **Don't disable auto-save** - You'll have to set defaults every time
- **Don't ignore isolation** - Each project should be separate

---

## 🎯 Migration from Manual Names

### If you have existing projects with manual names:

**Option 1: Keep existing (recommended)**
```javascript
// Continue using manual names
claudeContext.init({project: "existing-project"});
claudeContext.index({path: "/path"});
// → Still works! No migration needed
```

**Option 2: Gradually migrate**
```javascript
// New projects use auto-scoping
claudeContext.index({path: "/new/project"});
// → Auto-generates: Wx4aB-project-Ty8cD

// Old projects keep manual names
claudeContext.init({project: "old-project"});
claudeContext.index({path: "/old/project"});
// → Uses: old-project
```

**Option 3: Full migration**
1. Export data from old project
2. Re-index with auto-scoping
3. Delete old project
4. Update team

---

## 🎉 Benefits Summary

### For Individual Users

- ✅ **Zero config** - Just start coding
- ✅ **No naming decisions** - System decides
- ✅ **No typos** - Generated names are consistent
- ✅ **Fast** - No thinking required

### For Teams

- ✅ **Deterministic** - Same path → same ID (with overrides)
- ✅ **Isolated** - Each project separate
- ✅ **Scalable** - Works for hundreds of projects
- ✅ **Flexible** - Can override when needed

### For Multi-Workspace

- ✅ **Consistent** - Works across machines
- ✅ **Shareable** - Team members align easily
- ✅ **Maintainable** - Clear naming pattern
- ✅ **Future-proof** - Scales with growth

---

## 📞 Support

### Questions?

- **Documentation:** See `docs/auto-scoping/`
- **Examples:** See `docs/auto-scoping/examples/`
- **Issues:** Report bugs on GitHub

### Common Questions

**Q: Can I use emoji in project names?**  
A: No, auto-generated IDs use alphanumeric only. Use manual override for custom names.

**Q: What if two paths have same hash?**  
A: Virtually impossible with 8-char segments (~1 in 128 trillion per segment, 1 in 3.36e28 combined). System detects collisions and regenerates with incremented salt if needed.

**Q: Can I share project across team?**  
A: Yes! Use manual override so everyone uses same name.

**Q: Does it work with API server?**  
A: Yes! MCP client generates ID, sends to API.

---

**Status:** ✅ USER GUIDE COMPLETE  
**Ready for:** Beta testing  
**Feedback:** Welcome!
