#!/usr/bin/env node

/**
 * MCP Server - API Wrapper
 * 
 * Lightweight MCP server that proxies to the running API server (localhost:3030).
 * No direct database or embedding service access - uses the API server as backend.
 */

const path = require('path');
const { z } = require('zod');

const sdkCjsRoot = path.join(__dirname, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs');
const { McpServer } = require(path.join(sdkCjsRoot, 'server', 'mcp.js'));
const { StdioServerTransport } = require(path.join(sdkCjsRoot, 'server', 'stdio.js'));

const pkg = require('./package.json');
const { loadMcpDefaults, saveMcpDefaults, getMcpConfigPath } = require('./dist/utils/mcp-config');

// Configuration
const API_BASE_URL = process.env.API_SERVER_URL || 'http://localhost:3030';

/**
 * Make HTTP request to API server
 */
async function apiRequest(endpoint, options = {}) {
  const fetch = (await import('node-fetch')).default;
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || response.statusText;
    } catch {
      errorMessage = errorText || response.statusText;
    }
    throw new Error(`API Error (${response.status}): ${errorMessage}`);
  }

  return response.json();
}

/**
 * Poll for job completion
 */
async function pollJobCompletion(jobId, project, maxAttempts = 120) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const history = await apiRequest(`/projects/${project}/ingest/history`);
    const job = history.find(j => j.id === jobId);
    
    if (job) {
      if (job.status === 'completed' || job.status === 'ok') {
        return { status: 'completed', job };
      }
      if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.summary || 'Unknown error'}`);
      }
    }
    
    attempts++;
  }
  
  return { status: 'timeout', message: 'Job still running after 2 minutes' };
}

async function main() {
  let mcpDefaults = await loadMcpDefaults();

  const instructions = 'MCP server wrapping the claude-context API server at localhost:3030 with Island Architecture.\n\n' +
    '🏝️ ISLAND ARCHITECTURE ENABLED:\n' +
    'All operations use project/dataset scoping for 5-10x faster queries and proper isolation.\n' +
    'Set defaults once with claudeContext.init to avoid passing project/dataset every time.\n\n' +
    'Quick Start:\n' +
    '  1. claudeContext.init({project: "my-app", dataset: "backend"})\n' +
    '  2. claudeContext.indexLocal({path: "/absolute/path"}) or indexGitHub({repo: "owner/repo"})\n' +
    '  3. claudeContext.query({query: "authentication logic"})\n\n' +
    'Indexing Tools:\n' +
    '  • claudeContext.indexLocal - Index local codebase\n' +
    '  • claudeContext.indexGitHub - Index GitHub repo (async)\n' +
    '  • claudeContext.syncLocal - Incremental sync (10-50x faster)\n' +
    '  • claudeContext.watchLocal - Auto-sync on file changes\n' +
    '  • claudeContext.crawl - Crawl web documentation\n\n' +
    'Query Tools:\n' +
    '  • claudeContext.query - Semantic search (DEFAULT - use for all code searches)\n' +
    '  • claudeContext.smartQuery - LLM answers (ONLY when user asks to "explain" or "summarize")\n\n' +
    '🔍 SEARCH GUIDANCE:\n' +
    '  ALWAYS use claudeContext.query for:\n' +
    '  • Finding code snippets, functions, classes\n' +
    '  • Searching for patterns, implementations\n' +
    '  • Any "where is X" or "find Y" questions\n' +
    '  • Fast retrieval with hybrid search + reranking\n\n' +
    '  ONLY use claudeContext.smartQuery when user explicitly asks:\n' +
    '  • "Explain how X works"\n' +
    '  • "Summarize the authentication flow"\n' +
    '  • "What does this codebase do?"\n' +
    '  • Questions requiring LLM reasoning and synthesis\n\n' +
    'Management Tools:\n' +
    '  • claudeContext.init - Set defaults\n' +
    '  • claudeContext.defaults - Show current defaults\n' +
    '  • claudeContext.stats - Project statistics\n' +
    '  • claudeContext.listScopes - List datasets\n' +
    '  • claudeContext.history - Ingestion history\n\n' +
    'API Server must be running at localhost:3030';

  const mcpServer = new McpServer({
    name: 'claude-context-api',
    version: pkg.version
  }, {
    instructions
  });

  const toolNamespace = 'claudeContext';

  // =============================================================================
  // Configuration Tools
  // =============================================================================

  mcpServer.registerTool(`${toolNamespace}.init`, {
    title: 'Set Default Project',
    description: 'Save a default project and dataset to avoid passing them in every command. Sets persistent defaults stored at ~/.context/claude-mcp.json. Use this once at the start, then omit project/dataset in future calls.',
    inputSchema: {
      project: z.string().min(1).describe('Project name to set as default (e.g., "my-app", "backend", "frontend")'),
      dataset: z.string().optional().describe('Dataset name to set as default (e.g., "main", "production", "staging"). Leave empty to not set a default dataset.')
    }
  }, async ({ project, dataset }) => {
    try {
      await saveMcpDefaults({ project, dataset: dataset?.trim() });
      mcpDefaults = { project, dataset: dataset?.trim() };

      return {
        content: [{
          type: 'text',
          text: `Defaults updated.\nProject: ${project}\nDataset: ${dataset ?? 'not set'}\nStored at: ${getMcpConfigPath()}`
        }],
        structuredContent: {
          defaults: mcpDefaults,
          configPath: getMcpConfigPath()
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to set defaults: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.defaults`, {
    title: 'Show Default Project',
    description: 'Display your currently saved default project and dataset. Shows what project/dataset will be used when you omit them from commands. Stored at ~/.context/claude-mcp.json',
    inputSchema: {}
  }, async () => {
    const project = mcpDefaults.project ?? null;
    const dataset = mcpDefaults.dataset ?? null;
    const summary = [
      `Project: ${project ?? 'not set'}`,
      `Dataset: ${dataset ?? 'not set'}`,
      `Config Path: ${getMcpConfigPath()}`
    ].join('\n');

    return {
      content: [{
        type: 'text',
        text: summary
      }],
      structuredContent: {
        defaults: mcpDefaults,
        configPath: getMcpConfigPath()
      }
    };
  });

  // =============================================================================
  // Ingestion Tools
  // =============================================================================

  mcpServer.registerTool(`${toolNamespace}.indexGitHub`, {
    title: 'Index GitHub Repository',
    description: 'Clone and index a GitHub repository into the vector database for semantic search. Automatically parses code into chunks, generates embeddings, and stores them. Runs asynchronously with job queue - use waitForCompletion to wait for results.',
    inputSchema: {
      repo: z.string().describe('GitHub repository URL in format: github.com/owner/repo or https://github.com/owner/repo'),
      branch: z.string().optional().describe('Branch name (default: main)'),
      dataset: z.string().optional().describe('Dataset name (defaults to repo name)'),
      project: z.string().optional().describe('Project name (uses default if not provided)'),
      scope: z.enum(['global', 'project', 'local']).optional().describe('Scope level (default: project)'),
      force: z.boolean().optional().describe('Force reindex even if already exists'),
      waitForCompletion: z.boolean().optional().describe('Wait for job to complete (default: true)')
    }
  }, async ({ repo, branch, dataset, project, scope, force, waitForCompletion = true }) => {
    try {
      const projectName = project || mcpDefaults.project;
      if (!projectName) {
        throw new Error('Project is required. Set a default via claudeContext.init or pass project explicitly.');
      }

      const response = await apiRequest(`/projects/${projectName}/ingest/github`, {
        method: 'POST',
        body: JSON.stringify({
          repo,
          branch: branch || 'main',
          dataset,
          scope: scope || 'project',
          force: force || false
        })
      });

      if (response.status === 'skipped') {
        return {
          content: [{
            type: 'text',
            text: `Repository already indexed.\nProject: ${response.project}\nDataset: ${response.dataset}\nRepository: ${response.repository}\n\nUse force: true to reindex.`
          }],
          structuredContent: response
        };
      }

      if (!waitForCompletion) {
        return {
          content: [{
            type: 'text',
            text: `GitHub ingestion job queued.\nJob ID: ${response.jobId}\nProject: ${response.project}\nDataset: ${response.dataset}\nRepository: ${response.repository}\nBranch: ${response.branch}`
          }],
          structuredContent: response
        };
      }

      // Wait for completion
      const result = await pollJobCompletion(response.jobId, projectName);
      
      if (result.status === 'timeout') {
        return {
          content: [{
            type: 'text',
            text: `Job still running after 2 minutes.\nJob ID: ${response.jobId}\nCheck status with claudeContext.history`
          }],
          structuredContent: { ...response, timeout: true }
        };
      }

      return {
        content: [{
          type: 'text',
          text: `✅ GitHub repository indexed successfully!\n\n${result.job.summary}\nDuration: ${result.job.duration}`
        }],
        structuredContent: { ...response, job: result.job }
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `GitHub indexing failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.indexLocal`, {
    title: 'Index Local Codebase',
    description: 'Index a local directory containing code into the vector database for semantic search. Scans all supported files, chunks them intelligently, generates embeddings, and stores them. Starts indexing asynchronously and returns immediately. Path must be absolute (start with /).',
    inputSchema: {
      path: z.string().describe('Absolute path to local codebase directory (e.g., "/home/user/projects/my-app"). Must start with / - relative paths not allowed.'),
      dataset: z.string().optional().describe('Dataset name (defaults to directory name)'),
      project: z.string().optional().describe('Project name (uses default if not provided)'),
      repo: z.string().optional().describe('Repository name for metadata'),
      branch: z.string().optional().describe('Branch name for metadata'),
      sha: z.string().optional().describe('Commit SHA for metadata'),
      scope: z.enum(['global', 'project', 'local']).optional().describe('Scope level (default: project)'),
      force: z.boolean().optional().describe('Force reindex even if already exists')
    }
  }, async ({ path, dataset, project, repo, branch, sha, scope, force }) => {
    try {
      const projectName = project || mcpDefaults.project;
      if (!projectName) {
        throw new Error('Project is required. Set a default via claudeContext.init or pass project explicitly.');
      }

      // Validate absolute path
      if (!path.startsWith('/')) {
        throw new Error('Path must be an absolute path (starting with /)');
      }

      const finalDataset = dataset || path.split('/').pop() || 'local';

      // Start indexing asynchronously (fire and forget)
      apiRequest(`/projects/${projectName}/ingest/local`, {
        method: 'POST',
        body: JSON.stringify({
          path,
          dataset,
          repo,
          branch,
          sha,
          scope: scope || 'project',
          force: force || false
        })
      }).then(response => {
        if (response.status === 'completed') {
          const stats = response.stats || {};
          console.log(`[Index] ✅ Completed: ${projectName}/${finalDataset} - ${stats.totalChunks || 0} chunks`);
        } else {
          console.error(`[Index] ❌ Failed: ${projectName}/${finalDataset} - ${response.error || 'Unknown error'}`);
        }
      }).catch(error => {
        console.error(`[Index] ❌ Error: ${projectName}/${finalDataset} - ${error.message}`);
      });

      // Return immediately
      return {
        content: [{
          type: 'text',
          text: `Indexing started for project "${projectName}" in dataset "${finalDataset}"\n\nUse claudeContext.status to check progress.`
        }],
        structuredContent: {
          path,
          project: projectName,
          dataset: finalDataset,
          status: 'started'
        }
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to start indexing: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.syncLocal`, {
    title: 'Sync Local Changes',
    description: 'Incrementally sync local codebase changes using SHA256 change detection. Only re-indexes files that were created, modified, or deleted since last sync. 10-50x faster than full re-indexing for small changes. Perfect for active development workflows.',
    inputSchema: {
      path: z.string().describe('Absolute path to local codebase (e.g., "/home/user/project"). Must start with /.'),
      project: z.string().optional().describe('Project name (uses default if not provided)'),
      dataset: z.string().optional().describe('Dataset name (defaults to directory name)'),
      force: z.boolean().optional().describe('Force full re-scan and treat all files as changed (default: false)')
    }
  }, async ({ path, project, dataset, force }) => {
    try {
      const projectName = project || mcpDefaults.project;
      if (!projectName) {
        throw new Error('Project is required. Set a default via claudeContext.init or pass project explicitly.');
      }
      
      const response = await apiRequest(`/projects/${projectName}/ingest/local/sync`, {
        method: 'POST',
        body: JSON.stringify({
          path,
          dataset,
          force: force || false
        })
      });
      
      if (response.status === 'failed' || response.error) {
        throw new Error(response.error || 'Sync failed');
      }
      
      const { stats } = response;
      const summary = [
        `✅ Sync completed in ${stats.durationMs}ms`,
        ``,
        `Files:`,
        `  • Scanned: ${stats.filesScanned}`,
        `  • Created: ${stats.filesCreated}`,
        `  • Modified: ${stats.filesModified}`,
        `  • Deleted: ${stats.filesDeleted}`,
        stats.filesRenamed > 0 ? `  • Renamed: ${stats.filesRenamed}` : null,
        `  • Unchanged: ${stats.filesUnchanged}`,
        ``,
        `Chunks:`,
        `  • Added: ${stats.chunksAdded}`,
        `  • Removed: ${stats.chunksRemoved}`,
        `  • Unchanged: ${stats.chunksUnchanged || 'N/A'}`,
        ``,
        `Performance:`,
        `  • Scan time: ${stats.scanDurationMs}ms`,
        `  • Sync time: ${stats.syncDurationMs}ms`,
        `  • Total time: ${stats.durationMs}ms`
      ].filter(line => line !== null).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: summary
        }],
        structuredContent: response
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Sync failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.watchLocal`, {
    title: 'Watch Local Directory (Auto-Sync)',
    description: 'Automatically watch a local directory for file changes and sync incrementally. Detects file creation, modification, and deletion in real-time. Changes are debounced (2s) and automatically synced. Perfect for active development - keeps your index always up-to-date without manual syncing.',
    inputSchema: {
      path: z.string().describe('Absolute path to directory to watch (e.g., "/home/user/project")'),
      project: z.string().optional().describe('Project name (uses default if not provided)'),
      dataset: z.string().optional().describe('Dataset name (defaults to directory name)')
    }
  }, async ({ path, project, dataset }) => {
    try {
      const projectName = project || mcpDefaults.project;
      if (!projectName) {
        throw new Error('Project is required. Set a default via claudeContext.init or pass project explicitly.');
      }
      
      const response = await apiRequest(`/projects/${projectName}/watch/start`, {
        method: 'POST',
        body: JSON.stringify({
          path,
          dataset
        })
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      return {
        content: [{
          type: 'text',
          text: `✅ Now watching ${path}\n\n` +
                `File changes will be automatically detected and synced every 2 seconds.\n\n` +
                `Project: ${response.project}\n` +
                `Dataset: ${response.dataset}\n` +
                `Started: ${new Date(response.startedAt).toLocaleString()}\n` +
                `Watcher ID: ${response.watcherId}\n\n` +
                `Use claudeContext.stopWatching to stop automatic sync.`
        }],
        structuredContent: response
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to start watching: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.stopWatching`, {
    title: 'Stop Watching Directory',
    description: 'Stop automatically watching a directory for changes. Stops the file watcher and disables automatic incremental syncing. You can still manually sync using syncLocal.',
    inputSchema: {
      path: z.string().describe('Absolute path to directory to stop watching'),
      project: z.string().optional().describe('Project name (uses default if not provided)'),
      dataset: z.string().optional().describe('Dataset name (defaults to directory name)')
    }
  }, async ({ path, project, dataset }) => {
    try {
      const projectName = project || mcpDefaults.project;
      if (!projectName) {
        throw new Error('Project is required. Set a default via claudeContext.init or pass project explicitly.');
      }
      
      const response = await apiRequest(`/projects/${projectName}/watch/stop`, {
        method: 'POST',
        body: JSON.stringify({
          path,
          dataset
        })
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      return {
        content: [{
          type: 'text',
          text: `✅ Stopped watching ${path}\n\n` +
                `Automatic sync disabled. You can still manually sync using claudeContext.syncLocal.`
        }],
        structuredContent: response
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to stop watching: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.listWatchers`, {
    title: 'List Active Watchers',
    description: 'Show all directories currently being watched for automatic syncing. Displays path, dataset, start time, last sync time, and sync count for each watcher.',
    inputSchema: {
      project: z.string().optional().describe('Project name (uses default if not provided)')
    }
  }, async ({ project }) => {
    try {
      const projectName = project || mcpDefaults.project;
      if (!projectName) {
        throw new Error('Project is required. Set a default via claudeContext.init or pass project explicitly.');
      }
      
      const response = await apiRequest(`/projects/${projectName}/watch/list`, {
        method: 'GET'
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (response.count === 0) {
        return {
          content: [{
            type: 'text',
            text: `No active watchers for project "${projectName}".\n\nUse claudeContext.watchLocal to start watching a directory.`
          }],
          structuredContent: response
        };
      }
      
      const watcherList = response.watchers.map((w, i) => {
        const lastSync = w.lastSyncAt ? new Date(w.lastSyncAt).toLocaleString() : 'Never';
        return `${i + 1}. ${w.path}\n` +
               `   Dataset: ${w.dataset}\n` +
               `   Started: ${new Date(w.startedAt).toLocaleString()}\n` +
               `   Last Sync: ${lastSync}\n` +
               `   Sync Count: ${w.syncCount}`;
      }).join('\n\n');
      
      return {
        content: [{
          type: 'text',
          text: `Active Watchers (${response.count}):\n\n${watcherList}`
        }],
        structuredContent: response
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to list watchers: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });
  
  mcpServer.registerTool(`${toolNamespace}.crawl`, {
    title: 'Crawl Web Pages',
    description: 'Crawl and index web documentation, blogs, or any web content. Supports single pages, recursive crawling, or sitemap-based crawling. Extracts markdown content, detects code examples, chunks intelligently, and indexes for semantic search. Runs asynchronously.',
    inputSchema: {
      url: z.string().url().describe('Starting URL to crawl (e.g., "https://docs.example.com", "https://example.com/api"). Must be a valid HTTP/HTTPS URL.'),
      crawlType: z.enum(['single', 'recursive', 'sitemap']).optional().describe('Crawl type (default: single)'),
      maxPages: z.number().optional().describe('Maximum pages to crawl (default: 50)'),
      depth: z.number().optional().describe('Maximum depth for recursive crawl (default: 2)'),
      dataset: z.string().optional().describe('Dataset name'),
      project: z.string().optional().describe('Project name (uses default if not provided)'),
      scope: z.enum(['global', 'project', 'local']).optional().describe('Scope level (default: project)'),
      force: z.boolean().optional().describe('Force recrawl even if already exists'),
      waitForCompletion: z.boolean().optional().describe('Wait for crawl to complete (default: true)')
    }
  }, async ({ url, crawlType, maxPages, depth, dataset, project, scope, force, waitForCompletion = true }) => {
    try {
      const projectName = project || mcpDefaults.project;
      if (!projectName) {
        throw new Error('Project is required. Set a default via claudeContext.init or pass project explicitly.');
      }

      const response = await apiRequest(`/projects/${projectName}/ingest/crawl`, {
        method: 'POST',
        body: JSON.stringify({
          start_url: url,
          crawl_type: crawlType || 'single',
          max_pages: maxPages || 50,
          depth: depth || 2,
          dataset: dataset || 'web-pages',
          scope: scope || 'project',
          force: force || false
        })
      });

      if (response.status === 'skipped') {
        return {
          content: [{
            type: 'text',
            text: `URL already crawled.\nUse force: true to recrawl.`
          }],
          structuredContent: response
        };
      }

      if (!waitForCompletion) {
        return {
          content: [{
            type: 'text',
            text: `Crawl session initiated.\nSession ID: ${response.jobId}\nProject: ${projectName}\nDataset: ${dataset || 'web-pages'}`
          }],
          structuredContent: response
        };
      }

      // Poll for completion via history endpoint
      let attempts = 0;
      const maxAttempts = 120;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const history = await apiRequest(`/projects/${projectName}/ingest/history`);
        const session = history.find(h => h.id === response.jobId && h.source === 'crawl4ai');
        
        if (session) {
          if (session.status === 'completed' || session.status === 'ok') {
            return {
              content: [{
                type: 'text',
                text: `✅ Crawl completed successfully!\n\n${session.summary}\nDuration: ${session.duration}`
              }],
              structuredContent: { ...response, session }
            };
          }
          if (session.status === 'failed') {
            throw new Error(`Crawl failed: ${session.summary || 'Unknown error'}`);
          }
        }
        
        attempts++;
      }

      return {
        content: [{
          type: 'text',
          text: `Crawl still running after 2 minutes.\nSession ID: ${response.jobId}\nCheck status with claudeContext.history`
        }],
        structuredContent: { ...response, timeout: true }
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

  // =============================================================================
  // Query Tools
  // =============================================================================

  mcpServer.registerTool(`${toolNamespace}.query`, {
    title: 'Semantic Search',
    description: 'Search indexed code and documents using natural language. Uses hybrid search (dense + sparse vectors) with optional reranking for best results. Returns ranked code snippets with file locations, scores, and context. Filter by project, dataset, repo, language, or path.',
    inputSchema: {
      query: z.string().describe('Natural language search query (e.g., "authentication middleware", "API endpoint for users", "error handling patterns")'),
      project: z.string().optional().describe('Project name (uses default if not provided)'),
      dataset: z.string().optional().describe('Limit search to specific dataset'),
      includeGlobal: z.boolean().optional().describe('Include global datasets (default: true)'),
      topK: z.number().int().min(1).max(50).optional().describe('Maximum results to return (default: 10)'),
      threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (default: 0.5)'),
      repo: z.string().optional().describe('Filter by repository name'),
      lang: z.string().optional().describe('Filter by language'),
      pathPrefix: z.string().optional().describe('Filter by path prefix')
    }
  }, async ({ query, project, dataset, includeGlobal, topK, threshold, repo, lang, pathPrefix }) => {
    try {
      const projectName = project || mcpDefaults.project || 'all';

      const response = await apiRequest(`/projects/${projectName}/query`, {
        method: 'POST',
        body: JSON.stringify({
          query,
          dataset,
          includeGlobal,
          topK: topK || 10,
          threshold: threshold || 0.5,
          repo,
          lang,
          pathPrefix
        })
      });

      if (!response.results || response.results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No results found for: "${query}"`
          }],
          structuredContent: response
        };
      }

      const formatted = response.results.map((result, idx) => {
        const location = result.relativePath 
          ? `${result.relativePath}:${result.startLine || 0}-${result.endLine || 0}`
          : 'N/A';
        const score = typeof result.score === 'number' ? result.score.toFixed(4) : 'n/a';
        const repo = result.repo || result.metadata?.repo || 'n/a';
        
        return `#${idx + 1} ${location}\nScore: ${score}\nRepo: ${repo}\n\n${(result.content || result.chunk || '').trim()}`;
      }).join('\n\n---\n\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${response.results.length} results for: "${query}"\n\n${formatted}\n\nLatency: ${response.latency_ms || response.metadata?.timingMs?.total || 0}ms`
        }],
        structuredContent: response
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Search failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.smartQuery`, {
    title: 'LLM-Enhanced Query',
    description: 'Ask questions about your code and get AI-generated answers with source citations. Uses LLM to understand your question, enhance the query, retrieve relevant code, and synthesize a comprehensive answer. Perfect for "how does X work?" or "explain Y" questions.',
    inputSchema: {
      query: z.string().describe('Natural language question about your code (e.g., "How does authentication work?", "Explain the user registration flow", "What are the main API endpoints?")'),
      project: z.string().optional().describe('Project name (uses default if not provided)'),
      dataset: z.string().optional().describe('Limit search to specific dataset'),
      includeGlobal: z.boolean().optional().describe('Include global datasets (default: true)'),
      topK: z.number().int().min(1).max(50).optional().describe('Maximum results to return (default: 10)'),
      strategies: z.array(z.enum(['multi-query', 'refinement', 'concept-extraction'])).optional(),
      answerType: z.enum(['conversational', 'technical', 'summary']).optional()
    }
  }, async ({ query, project, dataset, includeGlobal, topK, strategies, answerType }) => {
    try {
      const projectName = project || mcpDefaults.project || 'all';

      const response = await apiRequest(`/projects/${projectName}/smart-query`, {
        method: 'POST',
        body: JSON.stringify({
          query,
          dataset,
          includeGlobal,
          topK: topK || 10,
          strategies,
          answerType
        })
      });

      const answer = response.answer?.content || 'No answer generated';
      const confidence = response.answer?.confidence 
        ? `(confidence: ${(response.answer.confidence * 100).toFixed(1)}%)` 
        : '';

      let resultText = `📝 Answer ${confidence}:\n\n${answer}\n\n`;

      if (response.retrievals && response.retrievals.length > 0) {
        resultText += `\n📚 Sources (${response.retrievals.length}):\n\n`;
        response.retrievals.slice(0, 5).forEach((result, idx) => {
          const location = result.relativePath 
            ? `${result.relativePath}:${result.startLine || 0}`
            : 'N/A';
          resultText += `${idx + 1}. ${location} (score: ${(result.score || 0).toFixed(3)})\n`;
        });
      }

      resultText += `\n⏱️  Latency: ${response.latency_ms || 0}ms`;

      return {
        content: [{
          type: 'text',
          text: resultText
        }],
        structuredContent: response
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Smart query failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  // =============================================================================
  // Info & Status Tools
  // =============================================================================

  mcpServer.registerTool(`${toolNamespace}.stats`, {
    title: 'Project Statistics',
    description: 'View metrics for a project: datasets, indexed chunks, web pages, crawl sessions. Shows what content has been indexed and is available for search. Use project="all" to see stats across all projects.',
    inputSchema: {
      project: z.string().optional().describe('Project name or "all" (uses default if not provided)')
    }
  }, async ({ project }) => {
    try {
      const projectName = project || mcpDefaults.project || 'all';
      const response = await apiRequest(`/projects/${projectName}/stats`);

      const metricsSummary = response.metrics
        .map(m => `${m.label}: ${m.value} ${m.caption}`)
        .join('\n');

      return {
        content: [{
          type: 'text',
          text: `📊 Project Statistics: ${projectName}\n\n${metricsSummary}`
        }],
        structuredContent: response
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get stats: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.listScopes`, {
    title: 'List Scopes',
    description: 'Show all datasets (scopes) in a project organized by visibility: global (shared), project (team), local (private). Each dataset shows chunk counts and page counts. Helps you understand what content is indexed and searchable.',
    inputSchema: {
      project: z.string().optional().describe('Project name or "all" (uses default if not provided)')
    }
  }, async ({ project }) => {
    try {
      const projectName = project || mcpDefaults.project || 'all';
      const response = await apiRequest(`/projects/${projectName}/scopes`);

      const formatScopes = (scopes, level) => {
        if (!scopes || scopes.length === 0) return `  None`;
        return scopes.map(s => {
          const highlights = s.highlights?.join(', ') || '';
          return `  - ${s.name} (${highlights})`;
        }).join('\n');
      };

      const summary = [
        `📁 Scopes for project: ${projectName}\n`,
        `🌍 Global:`,
        formatScopes(response.global, 'global'),
        `\n📦 Project:`,
        formatScopes(response.project, 'project'),
        `\n📍 Local:`,
        formatScopes(response.local, 'local')
      ].join('\n');

      return {
        content: [{
          type: 'text',
          text: summary
        }],
        structuredContent: response
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to list scopes: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.history`, {
    title: 'Ingestion History',
    description: 'View recent indexing jobs (GitHub, web crawls, local indexing) with status, duration, and summaries. Shows what has been indexed, when, and whether jobs completed successfully or failed. Useful for tracking progress and debugging.',
    inputSchema: {
      project: z.string().optional().describe('Project name or "all" (uses default if not provided)')
    }
  }, async ({ project }) => {
    try {
      const projectName = project || mcpDefaults.project || 'all';
      const response = await apiRequest(`/projects/${projectName}/ingest/history`);

      if (!response || response.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No ingestion history found for project: ${projectName}`
          }],
          structuredContent: []
        };
      }

      const summary = response.map((job, idx) => {
        const status = job.status === 'completed' || job.status === 'ok' ? '✅' : 
                      job.status === 'failed' ? '❌' : 
                      job.status === 'running' || job.status === 'in_progress' ? '⏳' : '⏸️';
        
        return `${idx + 1}. ${status} ${job.source} - ${job.dataset}\n   ${job.summary}\n   ${job.startedAt} (${job.duration || 'in progress'})`;
      }).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `📜 Ingestion History: ${projectName}\n\n${summary}`
        }],
        structuredContent: response
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get history: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('[MCP] Claude Context API wrapper started');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
