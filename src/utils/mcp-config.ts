import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface McpDefaults {
  project?: string;
  dataset?: string;
}

function resolvePaths() {
  const baseDir = process.env.CLAUDE_CONTEXT_HOME || os.homedir();
  const dir = path.join(baseDir, '.context');
  return {
    dir,
    file: path.join(dir, 'claude-mcp.json')
  };
}

/**
 * Load stored MCP defaults (project/dataset). Returns empty object when unset.
 */
export async function loadMcpDefaults(): Promise<McpDefaults> {
  try {
    const { file } = resolvePaths();
    const content = await fs.promises.readFile(file, 'utf-8');
    const parsed = JSON.parse(content) as McpDefaults;
    return {
      project: parsed.project?.trim() || undefined,
      dataset: parsed.dataset?.trim() || undefined
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    console.warn(`[McpConfig] ⚠️  Failed to read defaults: ${error.message ?? error}`);
    return {};
  }
}

/**
 * Persist MCP defaults to disk.
 */
export async function saveMcpDefaults(defaults: McpDefaults): Promise<void> {
  const cleaned: McpDefaults = {
    project: defaults.project?.trim() || undefined,
    dataset: defaults.dataset?.trim() || undefined
  };

  const { dir, file } = resolvePaths();
  await fs.promises.mkdir(dir, { recursive: true });
  const content = JSON.stringify(cleaned, null, 2);
  await fs.promises.writeFile(file, content, 'utf-8');
}

/**
 * Clear stored defaults.
 */
export async function clearMcpDefaults(): Promise<void> {
  try {
    const { file } = resolvePaths();
    await fs.promises.unlink(file);
    console.log('[McpConfig] 🧹 Cleared stored MCP defaults');
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn(`[McpConfig] ⚠️  Failed to clear defaults: ${error.message ?? error}`);
    }
  }
}

/**
 * Expose config path for diagnostic purposes.
 */
export function getMcpConfigPath(): string {
  return resolvePaths().file;
}
