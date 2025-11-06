# Auto-Scoping System Architecture

**Version:** 1.0  
**Status:** 🎯 DESIGN PHASE  
**Goal:** Zero-configuration project/dataset isolation

---

## 🎯 Problem Statement

**Current Issues:**
1. Users must manually call `claudeContext.init` with project/dataset
2. No automatic detection from workspace context
3. Risk of typos creating duplicate projects
4. Manual coordination across multiple MCP sessions

**Desired Experience:**
```javascript
// Just index - everything auto-scoped!
claudeContext.index({path: "/home/user/my-project"})
// → Auto creates: Wx4aB-my-project-Ty8cD / localindex

claudeContext.query({query: "auth middleware"})
// → Auto queries only: Wx4aB-my-project-Ty8cD scope
```

---

## 🏗️ System Design

### Core Concept: Deterministic Project IDs

**Format:**
```
{prefix-hash}-{folder-name}-{suffix-hash}
```

**Components:**
- `prefix-hash`: 8 chars from path hash (for uniqueness)
- `folder-name`: Sanitized folder name (for readability)
- `suffix-hash`: 8 chars from path hash (for collision detection)

**| Component | Purpose | Example |
|-----------|---------|---------|
| **Prefix Hash** | Uniqueness | `Wx4aBcDe` |
| **Folder Name** | Readability | `my-app` |
| **Suffix Hash** | Collision detection | `Ty8cDeFg` |

**Example:**
```
Path: /home/mewtwo/Zykairotis/claude-context-core
Folder: claude-context-core
Project ID: Wx4aBcDe-claude-context-core-Ty8cDeFg
```

**Why this format?**
- ✅ **Readable:** Folder name in middle
- ✅ **Deterministic:** Same path → same ID
- ✅ **Unique:** 8-char hashes provide 58^8 ≈ 128 trillion combinations per segment
- ✅ **URL-safe:** Base58 encoding (no special chars, no 0/O/I/l confusion)
- ✅ **Collision-resistant:** Combined 58^16 ≈ 3.36e28 effective space
- ✅ **Reasonable length:** 16 extra chars vs folder name

---

## 🗂️ Dataset Naming Convention

### Pattern

**Format:**
```
{source-type}-{identifier}
```

**Source Types:**
- `local` - Local codebase indexing
- `github` - GitHub repository
- `crawl` - Web crawling
- `manual` - User-specified

### Examples

```
Project: Wx4aB-my-app-Ty8cD

Datasets:
├── local                          # Default local index
├── github-nodejs-node             # GitHub: nodejs/node
├── github-microsoft-typescript    # GitHub: microsoft/typescript
├── crawl-docs-nodejs-org         # Crawl: docs.nodejs.org
└── manual-experiments             # User-created
```

**Benefits:**
- ✅ Clear source identification
- ✅ No collisions between sources
- ✅ Easy to list by type
- ✅ Descriptive without being verbose

---

## 🔧 Implementation Components

### 1. Path Hash Generator

**File:** `src/utils/auto-scoping.ts`

**Functions:**
```typescript
interface ProjectId {
  id: string;           // Full ID: Wx4aB-my-app-Ty8cD
  folderName: string;   // Original: my-app
  pathHash: string;     // Full hash for verification
  prefix: string;       // Wx4aB
  suffix: string;       // Ty8cD
}

// Generate project ID from absolute path
function generateProjectId(absolutePath: string): ProjectId

// Generate dataset name from source
function generateDatasetName(
  source: 'local' | 'github' | 'crawl' | 'manual',
  identifier?: string
): string

// Verify project ID matches path (collision detection)
function verifyProjectId(projectId: ProjectId, path: string): boolean
```

---

### 2. Auto-Init System

**File:** `src/utils/mcp-auto-init.ts`

**Logic:**
```typescript
interface AutoScopeContext {
  projectId: string;
  datasetName: string;
  source: 'detected' | 'override' | 'default';
  detectedFrom?: string; // Path that triggered detection
}

// Detect project/dataset from path
async function autoDetectScope(
  path: string,
  sourceType: 'local' | 'github' | 'crawl',
  override?: { project?: string; dataset?: string }
): Promise<AutoScopeContext>

// Save auto-detected scope as default
async function saveAutoScope(context: AutoScopeContext): Promise<void>

// Check if current defaults match path
async function validateScopeForPath(path: string): Promise<boolean>
```

---

### 3. MCP Integration

**Update:** `mcp-server.js`

**Changes:**
1. **Auto-init on first index:**
   ```javascript
   // If no defaults + path provided → auto-init
   if (!mcpDefaults.project && path) {
     const autoScope = await autoDetectScope(path, 'local');
     await saveAutoScope(autoScope);
     mcpDefaults = {
       project: autoScope.projectId,
       dataset: autoScope.datasetName
     };
   }
   ```

2. **Scope validation on query:**
   ```javascript
   // Warn if querying different project
   if (path && mcpDefaults.project) {
     const matches = await validateScopeForPath(path);
     if (!matches) {
       console.warn('[MCP] ⚠️ Current defaults don\'t match path');
     }
   }
   ```

3. **New tool: `autoScope`:**
   ```javascript
   mcpServer.registerTool('claudeContext.autoScope', {
     title: 'Auto-Detect Project Scope',
     description: 'Automatically detect and set project/dataset from path',
     inputSchema: {
       path: z.string(),
       sourceType: z.enum(['local', 'github', 'crawl']),
       setAsDefault: z.boolean().optional()
     }
   }, async ({path, sourceType, setAsDefault}) => {
     // Auto-detect and optionally save
   });
   ```

---

## 🔐 Hash Algorithm

### Requirements
- Fast computation
- Collision-resistant
- URL-safe output
- 8 characters per segment

### Recommended: Base58 + SHA256

**Why?**
- **SHA256:** Cryptographically strong, excellent distribution
- **Base58:** URL-safe (no special chars, no 0/O/I/l), Bitcoin-style
- **8 chars:** Provides 58^8 ≈ 128 trillion combinations per segment
- **Two segments:** Combined space of 58^16 ≈ 3.36e28 (virtually no collisions)

**Implementation:**
```typescript
import * as crypto from 'crypto';
import bs58 from 'bs58';

function hashPath(absolutePath: string, salt: string): string {
  // Normalize path (resolve symlinks, trailing slashes)
  const normalized = path.resolve(absolutePath);
  
  // SHA256 hash with salt
  const hash = crypto.createHash('sha256')
    .update(normalized + salt)
    .digest();
  
  // Base58 encode
  const encoded = bs58.encode(hash);
  
  // Take first 8 chars
  return encoded.slice(0, 8);
}

// Example:
const prefix = hashPath('/home/user/my-project', ':prefix');
const suffix = hashPath('/home/user/my-project', ':suffix');
// → prefix: "Wx4aBcDe" (8 chars)
// → suffix: "Ty8cDeFg" (8 chars from independent salt)
// → Full ID: "Wx4aBcDe-my-project-Ty8cDeFg"
```

---

## 🎛️ Configuration

### Environment Variables

```bash
# Enable auto-scoping (default: true for MCP, false for API)
AUTO_SCOPE_ENABLED=true

# Hash length (default: 5)
AUTO_SCOPE_HASH_LENGTH=5

# Auto-save defaults on first index (default: true)
AUTO_SCOPE_AUTO_SAVE=true

# Collision check (default: true)
AUTO_SCOPE_VERIFY_COLLISIONS=true
```

### Config File: `.context/auto-scope.json`

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
      "lastUsed": "2025-11-05T14:00:00Z"
    }
  ]
}
```

---

## 🔄 Migration Strategy

### Phase 1: Opt-in (Safe)
- New tool: `claudeContext.autoScope`
- Existing `init` unchanged
- Users explicitly enable

### Phase 2: Auto-detect with Warning
- First `index` without defaults → auto-detect
- Show warning message
- Save as default

### Phase 3: Default Behavior
- Auto-scoping enabled by default
- Manual `init` still supported (override)
- Legacy projects unaffected

---

## 📊 Collision Handling

### Scenario: Two folders with same name

```
/home/user/project-a/my-app  → Wx4aBcDe-my-app-Ty8cDeFg
/home/user/project-b/my-app  → Kj7xCdEf-my-app-Pm2yFgHi
```

**8-char hashes ensure uniqueness!** ✅

### Scenario: Hash collision (virtually impossible)

```
/path/one/my-app → Wx4aBcDe-my-app-Ty8cDeFg (hash: full-sha256-1)
/path/two/my-app → Wx4aBcDe-my-app-Ty8cDeFg (hash: full-sha256-2)  ⚠️ COLLISION
```

**Solution:**
1. Store full SHA256 hash in metadata for verification
2. On collision detection, increment salt: `sha256(path + ':suffix#2')`
3. Generate new suffix: `Wx4aBcDe-my-app-Ky9dEfGh`
4. Log warning for monitoring

**Collision Probability:**
- **Single segment:** 58^8 ≈ 128 trillion combinations
  - Birthday bound: ~1.5e-9 probability at 1 million projects
- **Two segments (independent salts):** 58^16 ≈ 3.36e28 effective space
  - Birthday bound: ~1.5e-17 probability at 1 million projects
- **Conclusion:** Virtually impossible in practice

---

## 🚀 Benefits

### For Users
- ✅ **Zero config** - Just start indexing
- ✅ **No typos** - Generated automatically
- ✅ **Clear naming** - Folder name visible
- ✅ **Isolation** - Each project separate

### For Queries
- ✅ **Auto-scoped** - Queries use current project
- ✅ **Fast** - Only search relevant collections
- ✅ **Safe** - No cross-project contamination

### For Multi-workspace
- ✅ **Deterministic** - Same path = same ID everywhere
- ✅ **Shareable** - Team members get same IDs
- ✅ **Consistent** - Works across MCP servers

---

## ⚙️ API Server Integration

### Challenge
API server runs in Docker, no direct filesystem access

### Solutions

#### Option 1: Client-side generation (Recommended)
```javascript
// MCP client generates project ID before API call
const projectId = generateProjectId(localPath);

// Send to API with ID
fetch('/projects/${projectId}/ingest/local', {
  body: { path, projectId }
});
```

#### Option 2: Path hints
```javascript
// Send path hash to API
fetch('/projects/_auto/ingest/local', {
  body: { 
    path,
    pathHint: hashPath(path)  // API generates ID from hint
  }
});
```

#### Option 3: Manual override
```javascript
// User provides project name, API generates dataset
fetch('/projects/my-app/ingest/local', {
  body: { 
    path,
    autoDataset: true  // API generates "local"
  }
});
```

**Recommendation:** Option 1 - client generates full ID

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] Path hashing (collision resistance)
- [ ] Project ID generation (format validation)
- [ ] Dataset name generation (all source types)
- [ ] Override handling
- [ ] Collision detection

### Integration Tests
- [ ] Auto-init on first index
- [ ] Scope validation on query
- [ ] Multi-project isolation
- [ ] Config persistence
- [ ] Migration from manual names

### Edge Cases
- [ ] Symlinked paths
- [ ] Relative vs absolute paths
- [ ] Special characters in folder names
- [ ] Very long folder names (>100 chars)
- [ ] Root directory indexing
- [ ] Network paths (if supported)

---

## 📈 Rollout Plan

### Week 1: Core Implementation
- [ ] Create `auto-scoping.ts` utility
- [ ] Add hash generation
- [ ] Add project ID generation
- [ ] Add dataset naming
- [ ] Unit tests

### Week 2: MCP Integration
- [ ] Update `mcp-server.js` with auto-detect
- [ ] Add `autoScope` tool
- [ ] Add validation logic
- [ ] Integration tests
- [ ] Documentation

### Week 3: API Integration (if needed)
- [ ] Add client-side ID generation
- [ ] Update API endpoints
- [ ] Add path hint support
- [ ] End-to-end tests

### Week 4: Polish & Release
- [ ] Performance testing
- [ ] Collision testing
- [ ] Migration guide
- [ ] User documentation
- [ ] Beta release

---

## 🎯 Success Metrics

### User Experience
- **Zero-config rate:** % of users who never call `init`
- **Error rate:** Collisions per 1000 projects
- **Query accuracy:** No cross-project results

### Performance
- **Hash time:** < 1ms per path
- **Auto-init overhead:** < 50ms
- **Query speed:** No regression (still 5-10x fast)

### Adoption
- **Usage rate:** % of indexes using auto-scoping
- **Feedback score:** User satisfaction
- **Bug reports:** < 1 per 1000 uses

---

**Status:** ✅ ARCHITECTURE COMPLETE  
**Next:** Implementation plan  
**Review:** Ready for feedback
