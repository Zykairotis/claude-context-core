# Auto-Scoping API Integration Plan

**Version:** 1.0  
**Status:** 🎯 DESIGN PHASE  
**Challenge:** API server in Docker, no filesystem access

---

## 🚧 The Challenge

### Problem
API server runs in Docker container with:
- ❌ No access to client filesystem
- ❌ Cannot hash client paths
- ❌ Cannot verify folder names
- ✅ Can only work with data sent via HTTP

### Example Scenario
```
Client Machine:
├── /home/user/my-project/  ← Client wants to index this
│   └── src/

API Server (Docker):
└── Cannot see /home/user/my-project!
```

---

## 💡 Solution Strategy

### **Recommended: Client-Side Generation**

**Concept:** Client generates project ID before API call

**Flow:**
```
1. Client: Generate project ID from local path
   → AutoScoping.generateProjectId('/home/user/my-project')
   → Returns: 'Wx4aB-my-project-Ty8cD'

2. Client: Send to API with generated ID
   → POST /projects/Wx4aB-my-project-Ty8cD/ingest/local
   → Body: { path: '/home/user/my-project', ... }

3. API: Use provided project ID
   → Creates/finds project with exact ID
   → Indexes into proper collection
```

**Benefits:**
- ✅ Deterministic (same client path = same ID)
- ✅ No filesystem access needed
- ✅ Works across all clients
- ✅ Simple to implement

---

## 📋 Implementation Plan

### Phase 1: Client-Side Library (MCP API Server)

**File:** `mcp-api-server.js`

**Add auto-scoping before API calls:**

```javascript
// Import auto-scoping utilities
const { AutoScoping } = require('./dist/utils/auto-scoping');
const { loadAutoScopeConfig, getOverrideForPath } = require('./dist/utils/mcp-auto-config');

// ============================================================================
// Helper: Auto-detect project/dataset before API call
// ============================================================================

async function prepareApiScope(
  path,
  sourceType,
  overrides = {}
) {
  // Check if auto-scoping enabled
  const config = await loadAutoScopeConfig();
  if (!config.enabled) {
    return { project: overrides.project, dataset: overrides.dataset };
  }
  
  // Use provided values if available
  if (overrides.project && overrides.dataset) {
    return { project: overrides.project, dataset: overrides.dataset };
  }
  
  // Check for manual overrides
  const pathOverride = await getOverrideForPath(path);
  
  // Auto-detect
  const autoScope = await AutoScoping.autoDetectScope(path, sourceType, {
    project: pathOverride?.project || overrides.project,
    dataset: pathOverride?.dataset || overrides.dataset,
    identifier: overrides.identifier
  });
  
  console.log(`[MCP-API] 🔍 Auto-detected: ${autoScope.projectId} / ${autoScope.datasetName}`);
  
  return {
    project: autoScope.projectId,
    dataset: autoScope.datasetName,
    autoDetected: true
  };
}

// ============================================================================
// Update indexLocal tool
// ============================================================================

mcpServer.registerTool(`${toolNamespace}.indexLocal`, {
  title: 'Index Local Codebase',
  description: 'Index local codebase with AUTO-SCOPING enabled!',
  inputSchema: {
    path: z.string(),
    dataset: z.string().optional().describe('Dataset name (auto-detected if omitted)'),
    project: z.string().optional().describe('Project name (auto-detected if omitted)'),
    repo: z.string().optional(),
    branch: z.string().optional(),
    sha: z.string().optional(),
    force: z.boolean().optional()
  }
}, async ({ path, dataset, project, repo, branch, sha, force }) => {
  try {
    // === AUTO-SCOPING ===
    const scope = await prepareApiScope(path, 'local', { project, dataset });
    
    // Use defaults as fallback
    const finalProject = scope.project || mcpDefaults.project;
    const finalDataset = scope.dataset || mcpDefaults.dataset || 'local';
    
    if (!finalProject) {
      throw new Error('Project required. Auto-detection failed and no default set.');
    }
    
    // Call API with generated project ID
    const response = await apiRequest(`/projects/${finalProject}/ingest/local`, {
      method: 'POST',
      body: JSON.stringify({
        path,
        dataset: finalDataset,
        repo,
        branch,
        sha,
        force: force || false
      })
    });
    
    const message = scope.autoDetected
      ? `✅ Indexed with AUTO-SCOPING!\n\n` +
        `Project: ${finalProject}\n` +
        `Dataset: ${finalDataset}\n` +
        `(Auto-detected from path)\n\n` +
        `Files: ${response.stats?.indexedFiles || 0}\n` +
        `Chunks: ${response.stats?.totalChunks || 0}`
      : `✅ Indexed successfully!\n\n` +
        `Project: ${finalProject}\n` +
        `Dataset: ${finalDataset}\n\n` +
        `Files: ${response.stats?.indexedFiles || 0}\n` +
        `Chunks: ${response.stats?.totalChunks || 0}`;
    
    return {
      content: [{ type: 'text', text: message }],
      structuredContent: { ...response, autoDetected: scope.autoDetected }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Indexing failed: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});

// ============================================================================
// Update crawl tool
// ============================================================================

mcpServer.registerTool(`${toolNamespace}.crawl`, {
  title: 'Crawl Web Pages',
  description: 'Crawl and index web pages with AUTO-SCOPING for dataset names',
  inputSchema: {
    url: z.string().url(),
    crawlType: z.enum(['single', 'recursive', 'sitemap']).optional(),
    maxPages: z.number().optional(),
    depth: z.number().optional(),
    dataset: z.string().optional().describe('Dataset name (auto-detected from URL if omitted)'),
    project: z.string().optional().describe('Project name (uses default if omitted)'),
    force: z.boolean().optional(),
    waitForCompletion: z.boolean().optional()
  }
}, async ({ url, crawlType, maxPages, depth, dataset, project, force, waitForCompletion = true }) => {
  try {
    // === AUTO-SCOPING for dataset ===
    let finalDataset = dataset;
    let autoDetected = false;
    
    if (!finalDataset) {
      // Auto-generate dataset name from URL
      const datasetInfo = AutoScoping.generateDatasetName('crawl', url);
      finalDataset = datasetInfo.name;
      autoDetected = true;
      console.log(`[MCP-API] 🔍 Auto-detected dataset: ${finalDataset}`);
    }
    
    const finalProject = project || mcpDefaults.project;
    if (!finalProject) {
      throw new Error('Project required. Set default via claudeContext.init or pass explicitly.');
    }
    
    // Call API
    const response = await apiRequest(`/projects/${finalProject}/ingest/crawl`, {
      method: 'POST',
      body: JSON.stringify({
        start_url: url,
        crawl_type: crawlType || 'single',
        max_pages: maxPages || 50,
        depth: depth || 2,
        dataset: finalDataset,
        force: force || false
      })
    });
    
    // ... rest of crawl logic ...
    
    const message = autoDetected
      ? `✅ Crawl started with AUTO-SCOPING!\n\n` +
        `Dataset: ${finalDataset}\n` +
        `(Auto-detected from URL: ${url})\n\n` +
        `Session ID: ${response.jobId}`
      : `✅ Crawl started!\n\n` +
        `Dataset: ${finalDataset}\n` +
        `Session ID: ${response.jobId}`;
    
    return {
      content: [{ type: 'text', text: message }],
      structuredContent: { ...response, autoDetected }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Crawl failed: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});
```

---

### Phase 2: API Server Updates (Optional)

**If we want API server to also support auto-scoping:**

**File:** `services/api-server/src/routes/projects.ts`

**Option 1: Accept Client-Generated IDs (Recommended)**

```typescript
// API just uses whatever project ID client sends
// No changes needed - already works!

router.post('/projects/:projectName/ingest/local', async (req, res) => {
  const { projectName } = req.params;
  // projectName can be auto-generated ID like "Wx4aB-my-app-Ty8cD"
  // API doesn't care - just creates/uses it
  // ✅ Already works!
});
```

**Option 2: API Validates ID Format (Optional Safety)**

```typescript
// Validate that project ID looks correct
import { AutoScoping } from '../../utils/auto-scoping';

router.post('/projects/:projectName/ingest/local', async (req, res) => {
  const { projectName } = req.params;
  
  // Validate format if it looks like auto-generated ID
  if (projectName.includes('-') && projectName.split('-').length === 3) {
    if (!AutoScoping.isValidProjectId(projectName)) {
      return res.status(400).json({
        error: 'Invalid auto-generated project ID format'
      });
    }
  }
  
  // Continue with indexing...
});
```

**Option 3: API Auto-Detects from Path Hints (Advanced)**

```typescript
// Accept path hash as hint, generate project ID on server
router.post('/projects/_auto/ingest/local', async (req, res) => {
  const { pathHint, folderName } = req.body;
  
  // Reconstruct project ID from hints
  // (Client sends: pathHint = hash of path, folderName = "my-app")
  const projectId = `${pathHint.slice(0,5)}-${folderName}-${pathHint.slice(-5)}`;
  
  // Continue with indexing using generated ID...
});
```

---

## 🎯 Recommended Approach

### **Use Client-Side Generation (Option 1)**

**Why?**
- ✅ **Simplest** - No API changes needed
- ✅ **Works now** - API already accepts any project name
- ✅ **Deterministic** - Client controls ID generation
- ✅ **Flexible** - Supports manual overrides easily

**Implementation:**
1. MCP client generates project ID
2. Sends to API in URL path
3. API uses it as-is
4. Done!

---

## 📊 Comparison Table

| Approach | API Changes | Client Logic | Deterministic | Complexity |
|----------|-------------|--------------|---------------|------------|
| **Client-Side** | None | Moderate | ✅ Yes | Low |
| **Path Hints** | Moderate | High | ⚠️ Depends | Medium |
| **API Validation** | Minor | Moderate | ✅ Yes | Low |
| **API Auto-Detect** | Major | Low | ❌ No | High |

---

## 🚀 Implementation Steps

### Step 1: MCP API Server (Week 1)

- [x] Design client-side generation
- [ ] Add `prepareApiScope()` helper
- [ ] Update `indexLocal` tool
- [ ] Update `crawl` tool
- [ ] Update `indexGitHub` tool
- [ ] Test auto-detection
- [ ] Documentation

### Step 2: API Server Validation (Week 2, Optional)

- [ ] Add project ID format validation
- [ ] Add helpful error messages
- [ ] Test invalid IDs rejected
- [ ] Update API docs

### Step 3: End-to-End Testing (Week 2)

- [ ] Test MCP client → API flow
- [ ] Verify deterministic IDs
- [ ] Test project isolation
- [ ] Performance testing

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('API Auto-Scoping', () => {
  it('should generate project ID on client', async () => {
    const scope = await prepareApiScope('/home/user/my-app', 'local');
    expect(scope.project).toMatch(/^[A-Za-z0-9]+-my-app-[A-Za-z0-9]+$/);
  });
  
  it('should use manual overrides', async () => {
    const scope = await prepareApiScope('/path', 'local', {
      project: 'custom-project'
    });
    expect(scope.project).toBe('custom-project');
  });
});
```

### Integration Tests
```typescript
describe('MCP → API Auto-Scoping', () => {
  it('should index with auto-generated project ID', async () => {
    // Call MCP tool
    const result = await mcpClient.call('claudeContext.indexLocal', {
      path: '/test/path'
    });
    
    // Verify API received auto-generated ID
    expect(result.projectId).toMatch(/^[A-Za-z0-9]+-path-[A-Za-z0-9]+$/);
  });
});
```

---

## 📝 API Documentation Updates

### New Behavior

**Before:**
```bash
# User must provide project name
POST /projects/my-app/ingest/local
```

**After:**
```bash
# MCP client can send auto-generated ID
POST /projects/Wx4aB-my-app-Ty8cD/ingest/local
```

**API doesn't care!** It accepts both:
- ✅ Manual names: `my-app`
- ✅ Auto-generated: `Wx4aB-my-app-Ty8cD`

---

## ✅ Success Criteria

- [ ] **Client-side generation works** - MCP generates valid IDs
- [ ] **API accepts IDs** - Both manual and auto-generated
- [ ] **Deterministic** - Same path → same ID via API
- [ ] **Fast** - < 10ms overhead on client
- [ ] **Backwards compatible** - Manual names still work
- [ ] **Well-tested** - Integration tests pass

---

## 🎉 Benefits for API Users

### Before (Manual)
```javascript
// User must think of project name
claudeContext.init({project: "my-app"});
claudeContext.indexLocal({path: "/home/user/my-app"});
```

### After (Auto)
```javascript
// Just index - name auto-generated!
claudeContext.indexLocal({path: "/home/user/my-app"});
// → Creates: Wx4aB-my-app-Ty8cD / local
```

### Multi-Project
```javascript
// Each path gets unique project ID
claudeContext.indexLocal({path: "/projects/app-1"});
// → Wx4aB-app-1-Ty8cD

claudeContext.indexLocal({path: "/projects/app-2"});
// → Kj7xC-app-2-Pm2yF

// Queries auto-scoped to current project
claudeContext.query({query: "auth"});
// → Only searches current project
```

---

**Status:** ✅ DESIGN COMPLETE  
**Recommendation:** Client-side generation (simplest, works now)  
**Next:** Implement MCP API server updates
