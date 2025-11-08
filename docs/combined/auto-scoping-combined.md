# Combined Files from auto-scoping

*Generated on: Thu Nov  6 09:52:37 AM EST 2025*

---

## File: 01-ARCHITECTURE.md

**Path:** `01-ARCHITECTURE.md`

```markdown
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

```

---

## File: 02-IMPLEMENTATION.md

**Path:** `02-IMPLEMENTATION.md`

```markdown
# Auto-Scoping Implementation Plan

**Version:** 1.0  
**Status:** 🔨 READY TO BUILD  
**Estimated Effort:** 3-4 days

---

## 📋 Phase 1: Core Utilities (Day 1)

### File: `src/utils/auto-scoping.ts`

**Create new utility module for auto-scoping logic**

```typescript
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

// =============================================================================
// Types
// =============================================================================

export interface ProjectId {
  /** Full project ID: Wx4aB-my-app-Ty8cD */
  id: string;
  /** Original folder name: my-app */
  folderName: string;
  /** Prefix hash: Wx4aB */
  prefix: string;
  /** Suffix hash: Ty8cD */
  suffix: string;
  /** Full path hash (for collision detection) */
  pathHash: string;
  /** Absolute path used for generation */
  absolutePath: string;
}

export interface DatasetName {
  /** Full dataset name: local, github-nodejs-node, crawl-docs-nodejs-org */
  name: string;
  /** Source type: local, github, crawl, manual */
  source: 'local' | 'github' | 'crawl' | 'manual';
  /** Optional identifier */
  identifier?: string;
}

export interface AutoScopeContext {
  /** Generated project ID */
  projectId: string;
  /** Generated dataset name */
  datasetName: string;
  /** Source of scope */
  source: 'detected' | 'override' | 'manual';
  /** Path that triggered detection */
  detectedFrom?: string;
  /** Timestamp */
  timestamp: string;
}

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  /** Hash length for prefix/suffix */
  HASH_LENGTH: 8,
  /** Character set for base58 (Bitcoin alphabet, no 0OIl) */
  BASE58_ALPHABET: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  /** Max folder name length before truncation */
  MAX_FOLDER_LENGTH: 50,
  /** Separator between components */
  SEPARATOR: '-',
  /** Environment variable override */
  ENV_AUTO_SCOPE: 'AUTO_SCOPE_ENABLED'
};

// =============================================================================
// Path Hashing
// =============================================================================

/**
 * Generate base58-encoded hash from string
 * Uses SHA256 for collision resistance, then base58 for URL-safety
 * 
 * @param input Input string to hash
 * @param length Desired output length (default: 8)
 * @returns Base58-encoded string of specified length
 */
function hashToBase58(input: string, length: number = CONFIG.HASH_LENGTH): string {
  // SHA256 hash
  const hash = crypto.createHash('sha256').update(input).digest();
  
  // Convert to base58 using standard library
  const bs58 = require('bs58');
  const encoded = bs58.encode(hash);
  
  // Take first N characters
  // With 8 chars from SHA256→Base58, collision probability is 1/(58^8) ≈ 1/128 trillion
  return encoded.slice(0, length);
}

/**
 * Normalize path for consistent hashing
 * - Resolves to absolute path
 * - Removes trailing slashes
 * - Converts to lowercase (for case-insensitive systems)
 */
async function normalizePath(inputPath: string): Promise<string> {
  // Resolve to absolute path
  const absolute = path.resolve(inputPath);
  
  // Verify path exists
  try {
    await fs.access(absolute);
  } catch (error) {
    throw new Error(`Path does not exist: ${absolute}`);
  }
  
  // Remove trailing slash, normalize separators
  return absolute.replace(/\/+$/, '').replace(/\\/g, '/');
}

/**
 * Sanitize folder name for use in project ID
 * - Lowercase
 * - Replace special chars with dashes
 * - Remove consecutive dashes
 * - Truncate if too long
 */
function sanitizeFolderName(folderName: string): string {
  return folderName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, CONFIG.SEPARATOR)  // Replace special chars
    .replace(/-+/g, CONFIG.SEPARATOR)           // Remove consecutive dashes
    .replace(/^-+|-+$/g, '')                    // Remove leading/trailing dashes
    .slice(0, CONFIG.MAX_FOLDER_LENGTH);        // Truncate if needed
}

// =============================================================================
// Project ID Generation
// =============================================================================

/**
 * Generate deterministic project ID from absolute path
 * 
 * Format: {prefix-hash}-{folder-name}-{suffix-hash}
 * Example: Wx4aB-my-app-Ty8cD
 * 
 * @param absolutePath Absolute path to project directory
 * @returns ProjectId object with all components
 */
export async function generateProjectId(absolutePath: string): Promise<ProjectId> {
  // Normalize path
  const normalized = await normalizePath(absolutePath);
  
  // Extract folder name
  const folderName = path.basename(normalized);
  const sanitized = sanitizeFolderName(folderName);
  
  // Generate hashes
  const pathHash = crypto.createHash('sha256').update(normalized).digest('hex');
  const prefix = hashToBase58(normalized + ':prefix', CONFIG.HASH_LENGTH);
  const suffix = hashToBase58(normalized + ':suffix', CONFIG.HASH_LENGTH);
  
  // Construct project ID
  const id = `${prefix}${CONFIG.SEPARATOR}${sanitized}${CONFIG.SEPARATOR}${suffix}`;
  
  return {
    id,
    folderName,
    prefix,
    suffix,
    pathHash,
    absolutePath: normalized
  };
}

/**
 * Verify that a project ID matches the expected path
 * Useful for collision detection
 * 
 * @param projectId The project ID to verify
 * @param testPath Path to test against
 * @returns True if the path generates the same project ID
 */
export async function verifyProjectId(
  projectId: ProjectId,
  testPath: string
): Promise<boolean> {
  const generated = await generateProjectId(testPath);
  
  // Check both the formatted ID and the full hash for maximum safety
  // With 8-char segments (58^16 space), collisions are virtually impossible
  return generated.id === projectId.id && generated.pathHash === projectId.pathHash;
}

/**
 * Parse project ID back into components (for display/debugging)
 */
export function parseProjectId(projectId: string): {
  prefix: string;
  folderName: string;
  suffix: string;
} | null {
  const parts = projectId.split(CONFIG.SEPARATOR);
  if (parts.length !== 3) {
    return null;
  }
  return {
    prefix: parts[0],
    folderName: parts[1],
    suffix: parts[2]
  };
}

// =============================================================================
// Dataset Name Generation
// =============================================================================

/**
 * Generate dataset name from source type and identifier
 * 
 * Patterns:
 * - local → "local"
 * - github + "owner/repo" → "github-owner-repo"
 * - crawl + "docs.nodejs.org" → "crawl-docs-nodejs-org"
 * - manual + "experiments" → "manual-experiments"
 */
export function generateDatasetName(
  source: 'local' | 'github' | 'crawl' | 'manual',
  identifier?: string
): DatasetName {
  let name: string;
  
  switch (source) {
    case 'local':
      // Local indexing uses simple "local"
      name = 'local';
      break;
      
    case 'github':
      // GitHub: extract owner/repo, sanitize
      if (!identifier) {
        throw new Error('GitHub source requires repository identifier');
      }
      // Extract from URL or use as-is
      const repoMatch = identifier.match(/github\.com\/([^\/]+\/[^\/]+)/);
      const repo = repoMatch ? repoMatch[1] : identifier;
      const sanitizedRepo = repo.replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      name = `github-${sanitizedRepo}`;
      break;
      
    case 'crawl':
      // Crawl: extract domain, sanitize
      if (!identifier) {
        throw new Error('Crawl source requires URL identifier');
      }
      // Extract domain
      const urlMatch = identifier.match(/(?:https?:\/\/)?([^\/]+)/);
      const domain = urlMatch ? urlMatch[1] : identifier;
      const sanitizedDomain = domain.replace(/\./g, '-').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      name = `crawl-${sanitizedDomain}`;
      break;
      
    case 'manual':
      // Manual: user-provided name, sanitized
      if (!identifier) {
        throw new Error('Manual source requires dataset name');
      }
      const sanitizedManual = identifier.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      name = `manual-${sanitizedManual}`;
      break;
      
    default:
      throw new Error(`Unknown source type: ${source}`);
  }
  
  return {
    name,
    source,
    identifier
  };
}

// =============================================================================
// Auto-Detection Logic
// =============================================================================

/**
 * Auto-detect project and dataset from path and source type
 * 
 * @param path Absolute path to index
 * @param sourceType Type of indexing operation
 * @param override Manual overrides (optional)
 * @returns Auto-scope context with generated IDs
 */
export async function autoDetectScope(
  inputPath: string,
  sourceType: 'local' | 'github' | 'crawl',
  override?: { project?: string; dataset?: string; identifier?: string }
): Promise<AutoScopeContext> {
  // Check if auto-scoping is enabled
  if (process.env[CONFIG.ENV_AUTO_SCOPE] === 'false') {
    throw new Error('Auto-scoping is disabled. Set AUTO_SCOPE_ENABLED=true or provide project/dataset manually.');
  }
  
  // Generate project ID (unless overridden)
  let projectId: string;
  let source: 'detected' | 'override' | 'manual';
  
  if (override?.project) {
    projectId = override.project;
    source = 'override';
  } else {
    const generated = await generateProjectId(inputPath);
    projectId = generated.id;
    source = 'detected';
  }
  
  // Generate dataset name (unless overridden)
  let datasetName: string;
  
  if (override?.dataset) {
    datasetName = override.dataset;
    source = 'override';
  } else {
    const dataset = generateDatasetName(sourceType, override?.identifier);
    datasetName = dataset.name;
  }
  
  return {
    projectId,
    datasetName,
    source,
    detectedFrom: inputPath,
    timestamp: new Date().toISOString()
  };
}

// =============================================================================
// Validation & Utilities
// =============================================================================

/**
 * Check if a project ID format is valid
 */
export function isValidProjectId(projectId: string): boolean {
  const parsed = parseProjectId(projectId);
  return parsed !== null && 
         parsed.prefix.length === CONFIG.HASH_LENGTH &&
         parsed.suffix.length === CONFIG.HASH_LENGTH;
}

/**
 * Extract project folder name from project ID (for display)
 */
export function extractFolderName(projectId: string): string | null {
  const parsed = parseProjectId(projectId);
  return parsed ? parsed.folderName : null;
}

// =============================================================================
// Exports
// =============================================================================

export const AutoScoping = {
  generateProjectId,
  verifyProjectId,
  parseProjectId,
  generateDatasetName,
  autoDetectScope,
  isValidProjectId,
  extractFolderName,
  CONFIG
};
```

---

## 📋 Phase 2: MCP Config Extension (Day 1-2)

### File: `src/utils/mcp-auto-config.ts`

**Extend MCP config to store auto-scope history**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AutoScopeContext } from './auto-scoping';

// =============================================================================
// Types
// =============================================================================

export interface AutoScopeConfig {
  /** Is auto-scoping enabled */
  enabled: boolean;
  /** Hash length (8 recommended for collision resistance) */
  hashLength: number;
  /** Auto-save defaults on first index */
  autoSave: boolean;
  /** Path overrides (manual project names) */
  overrides: Record<string, { project?: string; dataset?: string }>;
  /** History of auto-detected scopes */
  history: Array<{
    path: string;
    projectId: string;
    datasetName: string;
    timestamp: string;
  }>;
}

// =============================================================================
// Config Persistence
// =============================================================================

function getConfigPath(): string {
  const baseDir = process.env.CLAUDE_CONTEXT_HOME || os.homedir();
  return path.join(baseDir, '.context', 'auto-scope.json');
}

/**
 * Load auto-scope configuration
 */
export async function loadAutoScopeConfig(): Promise<AutoScopeConfig> {
  try {
    const configPath = getConfigPath();
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Return defaults
      return {
        enabled: true,
        hashLength: 8,
        autoSave: true,
        overrides: {},
        history: []
      };
    }
    throw error;
  }
}

/**
 * Save auto-scope configuration
 */
export async function saveAutoScopeConfig(config: AutoScopeConfig): Promise<void> {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  
  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });
  
  // Write config
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Add entry to auto-scope history
 */
export async function addToHistory(context: AutoScopeContext): Promise<void> {
  const config = await loadAutoScopeConfig();
  
  // Add to history (limit to 100 entries)
  config.history.unshift({
    path: context.detectedFrom || '',
    projectId: context.projectId,
    datasetName: context.datasetName,
    timestamp: context.timestamp
  });
  
  config.history = config.history.slice(0, 100);
  
  await saveAutoScopeConfig(config);
}

/**
 * Get override for path (if any)
 */
export async function getOverrideForPath(
  inputPath: string
): Promise<{ project?: string; dataset?: string } | null> {
  const config = await loadAutoScopeConfig();
  const normalized = path.resolve(inputPath);
  return config.overrides[normalized] || null;
}

/**
 * Set override for path
 */
export async function setOverrideForPath(
  inputPath: string,
  override: { project?: string; dataset?: string }
): Promise<void> {
  const config = await loadAutoScopeConfig();
  const normalized = path.resolve(inputPath);
  config.overrides[normalized] = override;
  await saveAutoScopeConfig(config);
}
```

---

## 📋 Phase 3: MCP Server Integration (Day 2-3)

### File: `mcp-server.js`

**Update MCP server to use auto-scoping**

#### Changes Required

**1. Import auto-scoping utilities:**

```javascript
// Add at top of file
const { AutoScoping } = require('./dist/utils/auto-scoping');
const {
  loadAutoScopeConfig,
  addToHistory,
  getOverrideForPath
} = require('./dist/utils/mcp-auto-config');
```

**2. Update `index` tool to auto-detect:**

```javascript
mcpServer.registerTool(`${toolNamespace}.index`, {
  title: 'Index Codebase',
  description: 'Index codebase with AUTO-SCOPING: project/dataset auto-detected from path!',
  inputSchema: {
    path: z.string().describe('Absolute path to codebase'),
    project: z.string().optional().describe('Project name (auto-detected if omitted)'),
    dataset: z.string().optional().describe('Dataset name (auto-detected if omitted)'),
    repo: z.string().optional(),
    branch: z.string().optional(),
    sha: z.string().optional(),
    force: z.boolean().optional()
  }
}, async ({ path, project, dataset, repo, branch, sha, force }) => {
  try {
    // === AUTO-SCOPING LOGIC ===
    let finalProject = project;
    let finalDataset = dataset;
    let autoDetected = false;
    
    // Check if we need auto-detection
    if (!finalProject || !finalDataset) {
      console.log(`[MCP] 🔍 Auto-detecting project/dataset from path: ${path}`);
      
      // Check for manual override
      const override = await getOverrideForPath(path);
      
      // Auto-detect scope
      const autoScope = await AutoScoping.autoDetectScope(path, 'local', {
        project: override?.project || project,
        dataset: override?.dataset || dataset
      });
      
      finalProject = autoScope.projectId;
      finalDataset = autoScope.datasetName;
      autoDetected = true;
      
      // Save to history
      await addToHistory(autoScope);
      
      // Auto-save as defaults (if enabled)
      const config = await loadAutoScopeConfig();
      if (config.autoSave && !mcpDefaults.project) {
        await saveMcpDefaults({
          project: finalProject,
          dataset: finalDataset
        });
        mcpDefaults = { project: finalProject, dataset: finalDataset };
        console.log(`[MCP] 💾 Auto-saved defaults: ${finalProject} / ${finalDataset}`);
      }
      
      console.log(`[MCP] ✅ Auto-detected: ${finalProject} / ${finalDataset}`);
    }
    
    // Continue with normal indexing...
    const stats = await context.indexWithProject(path, finalProject, finalDataset, {
      repo,
      branch,
      sha,
      forceReindex: force,
      progressCallback: (prog) => {
        console.log(`[Index] ${prog.phase} - ${prog.percentage.toFixed(1)}%`);
      }
    });
    
    const message = autoDetected
      ? `✅ Indexed with AUTO-SCOPING!\n\n` +
        `Project: ${finalProject}\n` +
        `Dataset: ${finalDataset}\n` +
        `(Auto-detected from path)\n\n` +
        `Files: ${stats.indexedFiles}\n` +
        `Chunks: ${stats.totalChunks}`
      : `✅ Indexed successfully!\n\n` +
        `Project: ${finalProject}\n` +
        `Dataset: ${finalDataset}\n\n` +
        `Files: ${stats.indexedFiles}\n` +
        `Chunks: ${stats.totalChunks}`;
    
    return {
      content: [{ type: 'text', text: message }],
      structuredContent: {
        project: finalProject,
        dataset: finalDataset,
        autoDetected,
        stats
      }
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Index failed: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});
```

**3. Add new `autoScope` tool:**

```javascript
mcpServer.registerTool(`${toolNamespace}.autoScope`, {
  title: 'Auto-Detect Scope',
  description: 'Manually trigger auto-detection of project/dataset from path. Useful for inspecting what would be generated.',
  inputSchema: {
    path: z.string().describe('Absolute path to analyze'),
    sourceType: z.enum(['local', 'github', 'crawl']).describe('Source type for dataset naming'),
    identifier: z.string().optional().describe('Identifier for github/crawl (repo URL or domain)'),
    setAsDefault: z.boolean().optional().describe('Save as MCP defaults after detection')
  }
}, async ({ path, sourceType, identifier, setAsDefault }) => {
  try {
    // Check for overrides
    const override = await getOverrideForPath(path);
    
    // Auto-detect
    const autoScope = await AutoScoping.autoDetectScope(path, sourceType, {
      identifier,
      project: override?.project,
      dataset: override?.dataset
    });
    
    // Optionally save as default
    if (setAsDefault) {
      await saveMcpDefaults({
        project: autoScope.projectId,
        dataset: autoScope.datasetName
      });
      mcpDefaults = {
        project: autoScope.projectId,
        dataset: autoScope.datasetName
      };
    }
    
    const message = `🔍 Auto-Detection Results:\n\n` +
      `Project ID: ${autoScope.projectId}\n` +
      `Dataset: ${autoScope.datasetName}\n` +
      `Source: ${autoScope.source}\n` +
      `Path: ${path}\n\n` +
      (setAsDefault ? `✅ Saved as defaults` : `(Not saved - use setAsDefault:true to save)`);
    
    return {
      content: [{ type: 'text', text: message }],
      structuredContent: autoScope
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Auto-detection failed: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
});
```

**4. Update instructions:**

```javascript
const instructions = 'Real-time MCP server with AUTO-SCOPING enabled!\n\n' +
  '🎯 AUTO-SCOPING:\n' +
  'No more manual project/dataset names! Just provide a path and we auto-generate:\n' +
  '  • Project: {hash}-{folder-name}-{hash} (deterministic, unique)\n' +
  '  • Dataset: local, github-{repo}, crawl-{domain}\n\n' +
  'Core Tools:\n' +
  '  • claudeContext.index - Just provide path, auto-scopes!\n' +
  '  • claudeContext.autoScope - Preview auto-detection\n' +
  '  • claudeContext.search - Uses current project scope\n' +
  '  • claudeContext.init - Manual override (if needed)\n\n' +
  'Examples:\n' +
  '  claudeContext.index({path: "/home/user/my-app"})\n' +
  '  → Auto-creates: Wx4aB-my-app-Ty8cD / local\n\n' +
  '  claudeContext.query({query: "auth"})\n' +
  '  → Searches only: Wx4aB-my-app-Ty8cD scope\n\n' +
  '⚙️ Features:\n' +
  '  • Zero config - just start indexing\n' +
  '  • Deterministic - same path = same ID\n' +
  '  • Isolated - perfect project separation\n' +
  '  • Override - manual names still supported\n\n';
```

---

## 📋 Phase 4: Testing (Day 3-4)

### File: `src/utils/__tests__/auto-scoping.spec.ts`

**Comprehensive test suite**

```typescript
import { AutoScoping } from '../auto-scoping';
import * as path from 'path';
import * as os from 'os';

describe('AutoScoping', () => {
  describe('generateProjectId', () => {
    it('should generate deterministic project ID with 8-char hashes', async () => {
      const testPath = path.join(os.tmpdir(), 'test-project');
      const id1 = await AutoScoping.generateProjectId(testPath);
      const id2 = await AutoScoping.generateProjectId(testPath);
      
      expect(id1.id).toBe(id2.id);
      expect(id1.pathHash).toBe(id2.pathHash);
      expect(id1.prefix).toHaveLength(8);
      expect(id1.suffix).toHaveLength(8);
    });
    
    it('should include folder name in ID', async () => {
      const testPath = path.join(os.tmpdir(), 'my-awesome-project');
      const id = await AutoScoping.generateProjectId(testPath);
      
      expect(id.folderName).toBe('my-awesome-project');
      expect(id.id).toContain('my-awesome-project');
    });
    
    it('should generate different IDs for different paths', async () => {
      const path1 = path.join(os.tmpdir(), 'project-a');
      const path2 = path.join(os.tmpdir(), 'project-b');
      
      const id1 = await AutoScoping.generateProjectId(path1);
      const id2 = await AutoScoping.generateProjectId(path2);
      
      expect(id1.id).not.toBe(id2.id);
    });
    
    it('should sanitize special characters', async () => {
      const testPath = path.join(os.tmpdir(), 'my!@#$%project');
      const id = await AutoScoping.generateProjectId(testPath);
      
      expect(id.id).toMatch(/^[A-Za-z0-9-]+$/);
    });
  });
  
  describe('generateDatasetName', () => {
    it('should generate "local" for local source', () => {
      const dataset = AutoScoping.generateDatasetName('local');
      expect(dataset.name).toBe('local');
    });
    
    it('should generate github dataset name', () => {
      const dataset = AutoScoping.generateDatasetName('github', 'owner/repo');
      expect(dataset.name).toBe('github-owner-repo');
    });
    
    it('should handle GitHub URLs', () => {
      const dataset = AutoScoping.generateDatasetName(
        'github',
        'https://github.com/nodejs/node'
      );
      expect(dataset.name).toBe('github-nodejs-node');
    });
    
    it('should generate crawl dataset name', () => {
      const dataset = AutoScoping.generateDatasetName(
        'crawl',
        'https://docs.nodejs.org/api/'
      );
      expect(dataset.name).toBe('crawl-docs-nodejs-org');
    });
  });
  
  describe('autoDetectScope', () => {
    it('should detect project and dataset from path', async () => {
      const testPath = path.join(os.tmpdir(), 'my-project');
      const scope = await AutoScoping.autoDetectScope(testPath, 'local');
      
      expect(scope.projectId).toContain('my-project');
      expect(scope.datasetName).toBe('local');
      expect(scope.source).toBe('detected');
    });
    
    it('should respect project override', async () => {
      const testPath = path.join(os.tmpdir(), 'my-project');
      const scope = await AutoScoping.autoDetectScope(testPath, 'local', {
        project: 'custom-project'
      });
      
      expect(scope.projectId).toBe('custom-project');
      expect(scope.source).toBe('override');
    });
  });
});
```

---

## 📋 Phase 5: Documentation Updates (Day 4)

### File: `docs/auto-scoping/03-USER-GUIDE.md`

**Create user-facing documentation**

(Content to be created showing examples, benefits, and how to use)

### File: `docs/mcp/MCP-ISLAND-ARCHITECTURE.md`

**Update existing docs to mention auto-scoping**

---

## ✅ Implementation Checklist

### Day 1: Core Utilities
- [ ] Create `src/utils/auto-scoping.ts`
- [ ] Implement path hashing (base58)
- [ ] Implement project ID generation
- [ ] Implement dataset name generation
- [ ] Create `src/utils/mcp-auto-config.ts`
- [ ] Add config persistence
- [ ] Write unit tests

### Day 2: MCP Integration
- [ ] Update `mcp-server.js` imports
- [ ] Modify `index` tool for auto-detection
- [ ] Add `autoScope` tool
- [ ] Update server instructions
- [ ] Test auto-detection flow

### Day 3: Query Integration
- [ ] Update `search` tool to validate scope
- [ ] Add scope mismatch warnings
- [ ] Test project isolation
- [ ] Integration tests

### Day 4: Polish & Docs
- [ ] Performance testing
- [ ] User documentation
- [ ] Migration guide
- [ ] Example workflows
- [ ] Beta release prep

---

## 🎯 Success Criteria

- [ ] **Zero-config indexing works** - `index({path})` auto-generates project/dataset
- [ ] **Deterministic** - Same path always generates same ID
- [ ] **Fast** - < 10ms overhead for auto-detection
- [ ] **Safe** - No collisions in testing (10,000 random paths)
- [ ] **Backwards compatible** - Manual `init` still works
- [ ] **Well-tested** - 95%+ code coverage
- [ ] **Documented** - Clear user guide and examples

---

**Status:** ✅ READY TO IMPLEMENT  
**Next:** Begin Day 1 tasks  
**Review:** Implementation plan approved

```

---

## File: 03-API-INTEGRATION.md

**Path:** `03-API-INTEGRATION.md`

```markdown
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

```

---

## File: 04-USER-GUIDE.md

**Path:** `04-USER-GUIDE.md`

```markdown
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

```

---

## File: README.md

**Path:** `README.md`

```markdown
# Auto-Scoping System Documentation

**Version:** 1.0  
**Status:** 🎯 DESIGN COMPLETE  
**Implementation:** Ready to start

---

## 🎯 Overview

**Auto-Scoping** eliminates manual project/dataset naming by automatically generating deterministic, readable identifiers from file paths.

### The Problem
```javascript
// Today: Manual naming required
claudeContext.init({project: "???", dataset: "???"});  // What names?
claudeContext.index({path: "/home/user/my-app"});
```

### The Solution
```javascript
// Tomorrow: Zero configuration
claudeContext.index({path: "/home/user/my-app"});
// ✅ Auto-generates: Wx4aB-my-app-Ty8cD / local
```

---

## 📚 Documentation Index

### 1. [Architecture Design](./01-ARCHITECTURE.md)
**What you'll learn:**
- System architecture and design decisions
- Project ID format: `{hash}-{name}-{hash}`
- Dataset naming patterns
- Hash algorithm (Base58 + SHA256)
- Configuration options
- Migration strategy

**Read this if:** You want to understand HOW it works

---

### 2. [Implementation Plan](./02-IMPLEMENTATION.md)
**What you'll learn:**
- 4-day implementation timeline
- Core utilities (`auto-scoping.ts`, `mcp-auto-config.ts`)
- MCP server integration
- Testing strategy
- Code examples

**Read this if:** You're implementing the system

---

### 3. [API Integration](./03-API-INTEGRATION.md)
**What you'll learn:**
- Client-side generation strategy
- MCP API server updates
- Docker/filesystem challenges
- API compatibility
- End-to-end flow

**Read this if:** You're working with the API server

---

### 4. [User Guide](./04-USER-GUIDE.md)
**What you'll learn:**
- How to use auto-scoping
- Examples and workflows
- Manual overrides
- Troubleshooting
- Best practices

**Read this if:** You're an end user

---

## 🚀 Quick Start

### For Users

```javascript
// 1. Just index - no setup needed!
claudeContext.index({path: "/home/user/my-project"});
// → Auto-creates: Wx4aB-my-project-Ty8cD / local

// 2. Query automatically scoped
claudeContext.query({query: "authentication"});
// → Searches only: Wx4aB-my-project-Ty8cD

// 3. Add reference docs
claudeContext.indexGitHub({repo: "nodejs/node"});
// → Creates: Wx4aB-my-project-Ty8cD / github-nodejs-node

// 4. Query across all datasets
claudeContext.query({query: "http server"});
// → Searches: local + github-nodejs-node
```

---

### For Developers

```bash
# 1. Implement core utilities
cd src/utils
# Create auto-scoping.ts (see 02-IMPLEMENTATION.md)

# 2. Update MCP server
cd ../../
# Modify mcp-server.js (see 02-IMPLEMENTATION.md)

# 3. Run tests
npm test src/utils/__tests__/auto-scoping.spec.ts

# 4. Build
npm run build

# 5. Try it out!
node mcp-server.js
```

---

## 🏗️ System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        USER                                  │
│  claudeContext.index({path: "/home/user/my-app"})          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   AUTO-SCOPING                              │
│  1. Hash path → Wx4aB...Ty8cD                              │
│  2. Extract folder name → "my-app"                          │
│  3. Combine → Wx4aB-my-app-Ty8cD                           │
│  4. Generate dataset → "local"                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP CONFIG                                │
│  Save defaults:                                             │
│  {                                                          │
│    project: "Wx4aB-my-app-Ty8cD",                          │
│    dataset: "local"                                        │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                ISLAND ARCHITECTURE                          │
│  Index into collection:                                     │
│  project_Wx4aB_my_app_Ty8cD_dataset_local                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Features

### 1. Deterministic Naming
- ✅ Same path always generates same ID
- ✅ Works across machines (with overrides)
- ✅ Perfect for team collaboration

### 2. Readable IDs
- ✅ Folder name visible: `Wx4aB-my-app-Ty8cD`
- ✅ Easy to identify projects
- ✅ No obscure UUIDs

### 3. Collision-Resistant
- ✅ Hash prefixes prevent collisions
- ✅ ~1 in 916M collision probability
- ✅ Automatic detection and resolution

### 4. Zero Configuration
- ✅ No `init` required
- ✅ Just start indexing
- ✅ Defaults auto-saved

### 5. Flexible Overrides
- ✅ Manual names still work
- ✅ Per-path overrides
- ✅ Team-shared names

---

## 📊 Project ID Format

### Structure
```
{prefix-hash}-{folder-name}-{suffix-hash}
     8 chars      variable        8 chars
```

### Example
```
Path: /home/mewtwo/Zykairotis/claude-context-core
         │          │         └─ Folder name
         │          └─────────── User
         └────────────────────── Home

Project ID: Wx4aBcDe-claude-context-core-Ty8cDeFg
            └──┬───┘ └──────┬───────┘ └──┬───┘
            prefix    folder name     suffix
          (8 chars)   (readable)    (8 chars)
```

### Properties
| Property | Value | Purpose |
|----------|-------|---------|
| **Prefix** | 8 chars (base58) | Uniqueness (58^8 ≈ 128T combinations) |
| **Name** | Folder name | Readability |
| **Suffix** | 8 chars (base58) | Collision detection (independent salt) |
| **Total** | ~18-70 chars | Depends on folder name |
| **Collision Resistance** | 58^16 ≈ 3.36e28 | Virtually impossible |

---

## Dataset Naming
## 🗂️ Dataset Naming

### Patterns

```
local                     → Local codebase
github-{owner}-{repo}     → GitHub repository
crawl-{domain}            → Web crawling
manual-{name}             → User-specified
```

### Examples

```javascript
// Local
"/home/user/my-app" → "local"

// GitHub
"nodejs/node" → "github-nodejs-node"
"https://github.com/microsoft/typescript" → "github-microsoft-typescript"

// Web
"https://docs.nodejs.org" → "crawl-docs-nodejs-org"

// Manual
"experiments" → "manual-experiments"
```

---

## 🔄 Implementation Timeline

### Phase 1: Core Utilities (Day 1)
- [x] Design architecture
- [ ] Create `auto-scoping.ts`
- [ ] Implement hashing
- [ ] Implement ID generation
- [ ] Unit tests

### Phase 2: MCP Integration (Day 2-3)
- [ ] Update `mcp-server.js`
- [ ] Add auto-detection
- [ ] Add `autoScope` tool
- [ ] Integration tests

### Phase 3: API Integration (Day 2-3)
- [ ] Update `mcp-api-server.js`
- [ ] Client-side generation
- [ ] End-to-end tests

### Phase 4: Polish & Release (Day 4)
- [ ] Performance testing
- [ ] User documentation
- [ ] Migration guide
- [ ] Beta release

**Total Effort:** 3-4 days

---

## 📈 Benefits

### Performance
- **No overhead** - Hash computed once
- **Fast queries** - Island Architecture still 5-10x faster
- **Scalable** - Handles thousands of projects

### User Experience
- **Zero config** - Just start indexing
- **No decisions** - System handles naming
- **No errors** - Can't misspell generated names
- **Consistent** - Works everywhere

### Developer Experience
- **Simple API** - No breaking changes
- **Backward compatible** - Manual names still work
- **Well-tested** - Comprehensive test suite
- **Documented** - Clear guides and examples

---

## 🧪 Testing

### Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| `auto-scoping.ts` | 20+ unit tests | 95%+ |
| `mcp-auto-config.ts` | 10+ unit tests | 95%+ |
| `mcp-server.js` | 15+ integration tests | 90%+ |
| End-to-end | 5+ workflow tests | 100% |

### Test Scenarios

- ✅ Deterministic ID generation
- ✅ Collision detection
- ✅ Manual overrides
- ✅ Multi-project isolation
- ✅ API integration
- ✅ Performance benchmarks

---

## 🚨 Known Limitations

### 1. Path-Dependent
- **Limitation:** Different paths → different IDs
- **Impact:** Team members need coordination
- **Solution:** Use manual overrides for teams

### 2. Rename Complexity
- **Limitation:** Can't rename auto-generated IDs
- **Impact:** Stuck with generated name
- **Solution:** Use manual override from start

### 3. Docker Filesystem
- **Limitation:** API server can't hash client paths
- **Impact:** Must use client-side generation
- **Solution:** MCP client generates ID (already designed)

---

## 📞 Getting Help

### Documentation
- **Architecture:** [01-ARCHITECTURE.md](./01-ARCHITECTURE.md)
- **Implementation:** [02-IMPLEMENTATION.md](./02-IMPLEMENTATION.md)
- **API Integration:** [03-API-INTEGRATION.md](./03-API-INTEGRATION.md)
- **User Guide:** [04-USER-GUIDE.md](./04-USER-GUIDE.md)

### Support
- **Issues:** GitHub Issues
- **Questions:** GitHub Discussions
- **Updates:** Release Notes

---

## 🎉 Next Steps

### For End Users
1. Wait for beta release
2. Read [User Guide](./04-USER-GUIDE.md)
3. Try it out!
4. Provide feedback

### For Developers
1. Read [Architecture](./01-ARCHITECTURE.md)
2. Review [Implementation Plan](./02-IMPLEMENTATION.md)
3. Start coding
4. Submit PRs

### For Team Leads
1. Review architecture
2. Plan team rollout
3. Set up overrides (if needed)
4. Train team

---

## ✅ Approval Checklist

- [x] **Architecture designed** - See 01-ARCHITECTURE.md
- [x] **Implementation planned** - See 02-IMPLEMENTATION.md
- [x] **API integration designed** - See 03-API-INTEGRATION.md
- [x] **User guide created** - See 04-USER-GUIDE.md
- [ ] **Core utilities implemented** - Day 1
- [ ] **MCP integration complete** - Day 2-3
- [ ] **Tests passing** - Day 3
- [ ] **Documentation finalized** - Day 4
- [ ] **Beta release** - Day 4

---

## 📊 Project Status

```
╔════════════════════════════════════════════╗
║   🎯 AUTO-SCOPING SYSTEM                  ║
╠════════════════════════════════════════════╣
║                                            ║
║  Status: 📖 DESIGN COMPLETE               ║
║  Phase: Ready to implement                ║
║  Effort: 3-4 days                         ║
║  Risk: Low                                ║
║                                            ║
║  Documentation:                            ║
║  ✅ Architecture (01)                      ║
║  ✅ Implementation (02)                    ║
║  ✅ API Integration (03)                   ║
║  ✅ User Guide (04)                        ║
║                                            ║
║  Implementation:                           ║
║  ⏳ Core utilities                         ║
║  ⏳ MCP integration                         ║
║  ⏳ API integration                         ║
║  ⏳ Testing & polish                        ║
║                                            ║
╚════════════════════════════════════════════╝
```

---

**Status:** ✅ **DESIGN PHASE COMPLETE**  
**Ready:** 🚀 **READY TO IMPLEMENT**  
**Timeline:** ⏱️ **3-4 DAYS**  
**Risk:** ✅ **LOW**

---

**Created:** November 5, 2025  
**Version:** 1.0  
**Author:** Claude (Windsurf Cascade)

```

---

