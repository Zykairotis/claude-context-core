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

### File: `docs/MCP-ISLAND-ARCHITECTURE.md`

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
