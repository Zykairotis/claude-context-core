/**
 * MCP Auto-Scope Configuration Management
 * 
 * Manages configuration and overrides for the auto-scoping system.
 * Stores config in .context/auto-scope.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
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
  /** Manual overrides for specific paths */
  overrides: Record<string, {
    project?: string;
    dataset?: string;
  }>;
  /** History of auto-detected projects */
  history: Array<{
    path: string;
    projectId: string;
    lastUsed: string;
  }>;
}

export interface AutoScopeOverride {
  /** Override project name for a path */
  project?: string;
  /** Override dataset name for a path */
  dataset?: string;
}

// =============================================================================
// Configuration Paths
// =============================================================================

const CONFIG_DIR = '.context';
const CONFIG_FILE = 'auto-scope.json';

/**
 * Get the configuration file path
 * Looks for .context/auto-scope.json in current directory or parent directories
 */
async function getConfigPath(): Promise<string | null> {
  let currentDir = process.cwd();
  
  while (currentDir !== path.dirname(currentDir)) {
    const configPath = path.join(currentDir, CONFIG_DIR, CONFIG_FILE);
    
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      // Config doesn't exist here, try parent
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  // No config found, use current directory
  return path.join(process.cwd(), CONFIG_DIR, CONFIG_FILE);
}

// =============================================================================
// Configuration Loading
// =============================================================================

/**
 * Load auto-scope configuration
 * Creates default config if none exists
 */
export async function loadAutoScopeConfig(): Promise<AutoScopeConfig> {
  const configPath = await getConfigPath();
  
  if (!configPath) {
    // Return default config
    return {
      enabled: true,
      hashLength: 8,
      autoSave: true,
      overrides: {},
      history: []
    };
  }
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Config doesn't exist or is invalid, return defaults
    return {
      enabled: true,
      hashLength: 8,
      autoSave: true,
      overrides: {},
      history: []
    };
  }
}

/**
 * Save auto-scope configuration
 */
export async function saveAutoScopeConfig(config: AutoScopeConfig): Promise<void> {
  const configPath = await getConfigPath() || path.join(process.cwd(), CONFIG_DIR, CONFIG_FILE);
  
  // Ensure directory exists
  const configDir = path.dirname(configPath);
  await fs.mkdir(configDir, { recursive: true });
  
  // Save config with pretty formatting
  await fs.writeFile(
    configPath,
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}

// =============================================================================
// Override Management
// =============================================================================

/**
 * Get override for a specific path
 */
export async function getOverrideForPath(
  absolutePath: string
): Promise<AutoScopeOverride | null> {
  const config = await loadAutoScopeConfig();
  
  // Normalize the path
  const normalizedPath = path.resolve(absolutePath);
  
  // Check for exact match
  if (config.overrides[normalizedPath]) {
    return config.overrides[normalizedPath];
  }
  
  // Check for parent directory matches
  let currentPath = normalizedPath;
  while (currentPath !== path.dirname(currentPath)) {
    if (config.overrides[currentPath]) {
      return config.overrides[currentPath];
    }
    currentPath = path.dirname(currentPath);
  }
  
  return null;
}

/**
 * Set override for a specific path
 */
export async function setOverrideForPath(
  absolutePath: string,
  override: AutoScopeOverride
): Promise<void> {
  const config = await loadAutoScopeConfig();
  const normalizedPath = path.resolve(absolutePath);
  
  config.overrides[normalizedPath] = override;
  
  await saveAutoScopeConfig(config);
}

/**
 * Remove override for a specific path
 */
export async function removeOverrideForPath(absolutePath: string): Promise<void> {
  const config = await loadAutoScopeConfig();
  const normalizedPath = path.resolve(absolutePath);
  
  delete config.overrides[normalizedPath];
  
  await saveAutoScopeConfig(config);
}

// =============================================================================
// History Management
// =============================================================================

/**
 * Add project to history
 */
export async function addToHistory(
  absolutePath: string,
  projectId: string
): Promise<void> {
  const config = await loadAutoScopeConfig();
  const normalizedPath = path.resolve(absolutePath);
  
  // Remove existing entry if present
  config.history = config.history.filter(h => h.path !== normalizedPath);
  
  // Add new entry at the beginning
  config.history.unshift({
    path: normalizedPath,
    projectId,
    lastUsed: new Date().toISOString()
  });
  
  // Keep only last 50 entries
  config.history = config.history.slice(0, 50);
  
  await saveAutoScopeConfig(config);
}

/**
 * Get project ID from history
 */
export async function getFromHistory(
  absolutePath: string
): Promise<string | null> {
  const config = await loadAutoScopeConfig();
  const normalizedPath = path.resolve(absolutePath);
  
  const entry = config.history.find(h => h.path === normalizedPath);
  return entry?.projectId || null;
}

// =============================================================================
// Auto-Save Management
// =============================================================================

/**
 * Save auto-detected scope as default
 */
export async function saveAutoScope(context: AutoScopeContext): Promise<void> {
  const config = await loadAutoScopeConfig();
  
  // Only save if auto-save is enabled
  if (!config.autoSave) {
    return;
  }
  
  // Add to history
  if (context.detectedFrom) {
    await addToHistory(context.detectedFrom, context.projectId);
  }
  
  // Save MCP defaults
  await saveMcpDefaults({
    project: context.projectId,
    dataset: context.datasetName
  });
  
  console.log(`[Auto-Scope] ✅ Saved defaults: ${context.projectId} / ${context.datasetName}`);
}

// =============================================================================
// MCP Defaults Integration
// =============================================================================

// Import the CORRECT MCP defaults functions (uses ~/.context/claude-mcp.json)
import { loadMcpDefaults, saveMcpDefaults } from './mcp-config';

// =============================================================================
// Environment Check
// =============================================================================

/**
 * Check if auto-scoping is enabled
 */
export async function isAutoScopeEnabled(): Promise<boolean> {
  // Check environment variable
  const envEnabled = process.env.AUTO_SCOPE_ENABLED;
  if (envEnabled === 'false' || envEnabled === '0') {
    return false;
  }
  
  // Check config file
  const config = await loadAutoScopeConfig();
  return config.enabled;
}

// =============================================================================
// Export for Static Access
// =============================================================================

export const AutoScopeConfig = {
  load: loadAutoScopeConfig,
  save: saveAutoScopeConfig,
  getOverride: getOverrideForPath,
  setOverride: setOverrideForPath,
  removeOverride: removeOverrideForPath,
  addToHistory,
  getFromHistory,
  saveAutoScope,
  isEnabled: isAutoScopeEnabled,
  loadMcpDefaults,
  saveMcpDefaults
};
