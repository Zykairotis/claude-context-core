import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface McpDefaults {
  project?: string;
  dataset?: string;
}

export interface McpConfig {
  currentProject?: string;
  projects: {
    [projectName: string]: {
      project: string;
      dataset?: string;
      addedAt: string;
      lastUsed: string;
    };
  };
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
 * Load full MCP config from disk (multiple projects).
 */
async function loadMcpConfig(): Promise<McpConfig> {
  try {
    const { file } = resolvePaths();
    const content = await fs.promises.readFile(file, 'utf-8');
    const data = JSON.parse(content.trim());
    
    // Handle old format (single project)
    if (!data.projects && (data.project || data.dataset)) {
      return {
        currentProject: data.project,
        projects: {
          [data.project]: {
            project: data.project,
            dataset: data.dataset,
            addedAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
          }
        }
      };
    }
    
    return data as McpConfig;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return { projects: {} };
    }
    console.warn(`[McpConfig] ⚠️  Failed to load config: ${error.message ?? error}`);
    return { projects: {} };
  }
}

/**
 * Load MCP defaults from disk (current active project).
 * Returns undefined for missing file, empty object for invalid JSON.
 */
export async function loadMcpDefaults(): Promise<McpDefaults> {
  const config = await loadMcpConfig();
  
  if (config.currentProject && config.projects[config.currentProject]) {
    const proj = config.projects[config.currentProject];
    return {
      project: proj.project,
      dataset: proj.dataset
    };
  }
  
  return {};
}

/**
 * Persist MCP defaults to disk (manages multiple projects).
 * Returns info about whether project already existed.
 */
export async function saveMcpDefaults(defaults: McpDefaults): Promise<{isNew: boolean, previousDataset?: string}> {
  const cleaned: McpDefaults = {
    project: defaults.project?.trim() || undefined,
    dataset: defaults.dataset?.trim() || undefined
  };
  
  if (!cleaned.project) {
    throw new Error('Project name is required');
  }

  // Load existing config
  const config = await loadMcpConfig();
  
  // Check if project already exists
  const existingProject = config.projects[cleaned.project];
  const isNew = !existingProject;
  const previousDataset = existingProject?.dataset;
  
  // Add or update project
  config.projects[cleaned.project] = {
    project: cleaned.project,
    dataset: cleaned.dataset,
    addedAt: existingProject?.addedAt || new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };
  
  // Set as current project
  config.currentProject = cleaned.project;

  // Save updated config
  const { dir, file } = resolvePaths();
  await fs.promises.mkdir(dir, { recursive: true });
  const content = JSON.stringify(config, null, 2);
  await fs.promises.writeFile(file, content, 'utf-8');
  
  return { isNew, previousDataset };
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

/**
 * List all configured projects.
 */
export async function listProjects(): Promise<{
  current?: string;
  projects: Array<{
    name: string;
    dataset?: string;
    isCurrent: boolean;
    addedAt: string;
    lastUsed: string;
  }>;
}> {
  const config = await loadMcpConfig();
  const projectList = Object.entries(config.projects).map(([name, proj]) => ({
    name,
    dataset: proj.dataset,
    isCurrent: name === config.currentProject,
    addedAt: proj.addedAt,
    lastUsed: proj.lastUsed
  }));
  
  return {
    current: config.currentProject,
    projects: projectList.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
  };
}

/**
 * Switch to a different project.
 */
export async function switchProject(projectName: string): Promise<boolean> {
  const config = await loadMcpConfig();
  
  if (!config.projects[projectName]) {
    return false;
  }
  
  config.currentProject = projectName;
  config.projects[projectName].lastUsed = new Date().toISOString();
  
  const { dir, file } = resolvePaths();
  await fs.promises.mkdir(dir, { recursive: true });
  const content = JSON.stringify(config, null, 2);
  await fs.promises.writeFile(file, content, 'utf-8');
  
  return true;
}
