import { simpleGit, SimpleGit, SimpleGitProgressEvent } from 'simple-git';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export interface CloneOptions {
  branch?: string;
  depth?: number;
  auth?: {
    username: string;
    token: string;
  };
  onProgress?: (progress: RepositoryProgress) => void;
}

export interface RepositoryProgress {
  method: string;
  stage: string;
  progress: number;
  processed?: number;
  total?: number;
}

export class RepositoryManager {
  private git: SimpleGit;
  private tempDir: string;

  constructor(tempDir?: string) {
    this.tempDir = tempDir || join(tmpdir(), 'claude-context-repos');
    
    this.git = simpleGit({
      baseDir: process.cwd(),
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: false
    });
  }

  /**
   * Clone a repository to a temporary directory
   */
  async clone(repoUrl: string, options: CloneOptions = {}): Promise<string> {
    const { branch = 'main', depth = 1, auth, onProgress } = options;

    // Create unique directory for this clone
    const repoId = this.generateRepoId(repoUrl);
    const localPath = join(this.tempDir, repoId);

    // Ensure temp directory exists
    await mkdir(this.tempDir, { recursive: true });

    // Prepare authenticated URL if credentials provided
    const authenticatedUrl = auth 
      ? this.addAuthToUrl(repoUrl, auth.username, auth.token)
      : repoUrl;

    // Configure git with progress tracking
    const gitWithProgress = simpleGit({
      baseDir: process.cwd(),
      binary: 'git',
      progress: ({ method, stage, progress: percent, processed, total }: SimpleGitProgressEvent) => {
        if (onProgress) {
          onProgress({
            method,
            stage,
            progress: percent,
            processed,
            total
          });
        }
      }
    });

    try {
      console.log(`[RepositoryManager] Cloning ${repoUrl} to ${localPath}`);
      
      // Disable credential prompting via environment variables (fixes public repo cloning in Docker)
      const cloneEnv = {
        ...process.env,
        GIT_ASKPASS: '',
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'credential.helper',
        GIT_CONFIG_VALUE_0: ''
      };
      
      await gitWithProgress.env(cloneEnv).clone(authenticatedUrl, localPath, {
        '--depth': depth,
        '--single-branch': null,
        '--branch': branch,
        '--no-tags': null
      });

      console.log(`[RepositoryManager] Successfully cloned ${repoUrl}`);
      return localPath;
    } catch (error: any) {
      console.error(`[RepositoryManager] Clone failed:`, error);
      
      // Clean up partial clone on failure
      await this.cleanup(localPath).catch(() => {});
      
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Pull latest changes for an existing repository
   */
  async pull(localPath: string, branch: string = 'main'): Promise<void> {
    try {
      const git = simpleGit(localPath);
      await git.pull('origin', branch, { '--rebase': 'false' });
      console.log(`[RepositoryManager] Pulled latest changes for ${localPath}`);
    } catch (error: any) {
      throw new Error(`Failed to pull repository: ${error.message}`);
    }
  }

  /**
   * Check if a directory is a git repository
   */
  async isRepository(localPath: string): Promise<boolean> {
    try {
      const git = simpleGit(localPath);
      return await git.checkIsRepo();
    } catch {
      return false;
    }
  }

  /**
   * Get current commit SHA
   */
  async getCurrentSha(localPath: string): Promise<string> {
    try {
      const git = simpleGit(localPath);
      const log = await git.log(['-1']);
      return log.latest?.hash || '';
    } catch (error: any) {
      throw new Error(`Failed to get current SHA: ${error.message}`);
    }
  }

  /**
   * Clean up cloned repository
   */
  async cleanup(localPath: string): Promise<void> {
    try {
      await rm(localPath, { recursive: true, force: true });
      console.log(`[RepositoryManager] Cleaned up ${localPath}`);
    } catch (error: any) {
      console.error(`[RepositoryManager] Cleanup failed for ${localPath}:`, error);
      throw new Error(`Failed to cleanup repository: ${error.message}`);
    }
  }

  /**
   * Clean up all temporary repositories
   */
  async cleanupAll(): Promise<void> {
    try {
      await rm(this.tempDir, { recursive: true, force: true });
      console.log(`[RepositoryManager] Cleaned up all temporary repositories`);
    } catch (error: any) {
      console.error(`[RepositoryManager] Failed to cleanup all:`, error);
    }
  }

  /**
   * Parse repository URL to extract org and name
   */
  parseRepoUrl(repoUrl: string): { org: string; name: string; url: string } {
    // Handle various GitHub URL formats
    // https://github.com/org/repo
    // github.com/org/repo
    // git@github.com:org/repo.git
    
    let cleanUrl = repoUrl.trim();
    
    // Remove git@ prefix and convert to https
    if (cleanUrl.startsWith('git@')) {
      cleanUrl = cleanUrl.replace('git@', 'https://').replace(':', '/');
    }
    
    // Ensure https:// prefix
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    
    // Remove .git suffix
    cleanUrl = cleanUrl.replace(/\.git$/, '');
    
    // Extract org and repo name
    const match = cleanUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+)/);
    
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
    
    return {
      org: match[1],
      name: match[2],
      url: cleanUrl
    };
  }

  private addAuthToUrl(repoUrl: string, username: string, token: string): string {
    const url = new URL(repoUrl.startsWith('http') ? repoUrl : `https://${repoUrl}`);
    url.username = username;
    url.password = token;
    return url.toString();
  }

  private generateRepoId(repoUrl: string): string {
    const { org, name } = this.parseRepoUrl(repoUrl);
    const timestamp = Date.now();
    return `${org}-${name}-${timestamp}`;
  }
}

