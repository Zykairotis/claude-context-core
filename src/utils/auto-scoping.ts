/**
 * Auto-Scoping System - Core Implementation
 * 
 * Automatically generates deterministic project IDs and dataset names from paths.
 * Format: {8-char-hash}-{folder-name}-{8-char-hash}
 * Example: Wx4aBcDe-my-project-Ty8cDeFg
 */

import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import bs58 from 'bs58';

// =============================================================================
// Types
// =============================================================================

export interface ProjectId {
  /** Full project ID: Wx4aBcDe-my-app-Ty8cDeFg */
  id: string;
  /** Original folder name: my-app */
  folderName: string;
  /** Prefix hash: Wx4aBcDe (8 chars) */
  prefix: string;
  /** Suffix hash: Ty8cDeFg (8 chars) */
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
  /** Hash length for prefix/suffix (8 for better collision resistance) */
  HASH_LENGTH: 8,
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
  
  // Convert to base58 using bs58 library
  const encoded = bs58.encode(hash);
  
  // Take first N characters
  // With 8 chars from SHA256→Base58, collision probability is 1/(58^8) ≈ 1/128 trillion
  return encoded.slice(0, length);
}

/**
 * Normalize path for consistent hashing
 * - Resolves to absolute path
 * - Removes trailing slashes
 * - Normalizes separators
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
 * Example: Wx4aBcDe-my-app-Ty8cDeFg
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
  
  // Generate hashes with different salts to ensure independence
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
  
  if (parts.length < 3) {
    return null;
  }
  
  // Handle case where folder name contains dashes
  const prefix = parts[0];
  const suffix = parts[parts.length - 1];
  const folderName = parts.slice(1, -1).join(CONFIG.SEPARATOR);
  
  // Validate hash segments
  if (prefix.length !== CONFIG.HASH_LENGTH || suffix.length !== CONFIG.HASH_LENGTH) {
    return null;
  }
  
  return { prefix, folderName, suffix };
}

// =============================================================================
// Dataset Name Generation
// =============================================================================

/**
 * Generate dataset name based on source type
 * 
 * Patterns:
 * - local → "local"
 * - github → "github-{owner}-{repo}"
 * - crawl → "crawl-{domain}"
 * - manual → "manual-{identifier}"
 */
export function generateDatasetName(
  source: 'local' | 'github' | 'crawl' | 'manual',
  identifier?: string
): DatasetName {
  let name: string;
  
  switch (source) {
    case 'local':
      name = 'local';
      break;
      
    case 'github':
      if (!identifier) {
        throw new Error('GitHub dataset requires repo identifier (owner/repo)');
      }
      // Convert owner/repo to owner-repo
      const sanitizedRepo = identifier.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      name = `github-${sanitizedRepo}`;
      break;
      
    case 'crawl':
      if (!identifier) {
        throw new Error('Crawl dataset requires URL identifier');
      }
      // Extract domain and sanitize
      const urlParts = identifier.replace(/^https?:\/\//, '').split('/')[0];
      const sanitizedDomain = urlParts.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      name = `crawl-${sanitizedDomain}`;
      break;
      
    case 'manual':
      if (!identifier) {
        throw new Error('Manual dataset requires identifier');
      }
      const sanitizedIdentifier = identifier.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      name = `manual-${sanitizedIdentifier}`;
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
// Auto-Scope Detection
// =============================================================================

/**
 * Automatically detect project and dataset from path
 * 
 * @param inputPath Path to detect from
 * @param sourceType Type of source (local, github, crawl, manual)
 * @param overrides Optional manual overrides
 * @returns AutoScopeContext with detected or overridden values
 */
export async function autoDetectScope(
  inputPath: string,
  sourceType: 'local' | 'github' | 'crawl' | 'manual',
  overrides?: {
    project?: string;
    dataset?: string;
    identifier?: string;
  }
): Promise<AutoScopeContext> {
  let projectId: string;
  let datasetName: string;
  let source: 'detected' | 'override' | 'manual';
  
  // Project detection
  if (overrides?.project) {
    projectId = overrides.project;
    source = 'override';
  } else {
    const generated = await generateProjectId(inputPath);
    projectId = generated.id;
    source = 'detected';
  }
  
  // Dataset detection
  if (overrides?.dataset) {
    datasetName = overrides.dataset;
  } else {
    const datasetInfo = generateDatasetName(sourceType, overrides?.identifier);
    datasetName = datasetInfo.name;
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
// Export for Static Access
// =============================================================================

export const AutoScoping = {
  generateProjectId,
  verifyProjectId,
  parseProjectId,
  generateDatasetName,
  autoDetectScope,
  CONFIG
};
