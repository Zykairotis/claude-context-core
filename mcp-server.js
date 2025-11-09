#!/usr/bin/env node

/**
 * Local development MCP server that wires the claude-context core library into
 * the Model Context Protocol so you can iterate on the implementation without
 * publishing to npm. The server exposes a small set of tools (index, reindex,
 * search, status, clear) that map directly to the `Context` APIs.
 */

const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const { Pool } = require('pg');

const sdkCjsRoot = path.join(__dirname, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs');
const { McpServer } = require(path.join(sdkCjsRoot, 'server', 'mcp.js'));
const { StdioServerTransport } = require(path.join(sdkCjsRoot, 'server', 'stdio.js'));

const pkg = require('./package.json');
const {
  Context,
  AutoEmbeddingMonster,
  EmbeddingMonster,
  OpenAIEmbedding,
  GeminiEmbedding,
  OllamaEmbedding,
  VoyageAIEmbedding,
  PostgresDualVectorDatabase,
  QdrantVectorDatabase,
  ingestGithubRepository,
  ingestCrawlPages,
  queryProject,
  getOrCreateProject,
  getOrCreateDataset,
  loadMcpDefaults,
  saveMcpDefaults,
  getMcpConfigPath,
  // Web ingestion and query APIs
  ingestWebPages,
  queryWebContent,
  smartQueryWebContent
} = require('./dist/core');

// Import auto-scoping utilities
const { AutoScoping } = require('./dist/utils/auto-scoping');
const { AutoScopeConfig } = require('./dist/utils/mcp-auto-config');

// ============================================================================
// FILE LOGGING SETUP
// ============================================================================
const LOG_FILE = path.join(__dirname, 'logs', 'mcp-server.log');
const DEBUG_LOG_FILE = path.join(__dirname, 'logs', 'mcp-debug.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create write streams for log files
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const debugStream = fs.createWriteStream(DEBUG_LOG_FILE, { flags: 'a' });

// Enhanced logging function
function log(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  
  // Write to console (for backward compatibility)
  console[level === 'ERROR' ? 'error' : 'log'](...args);
  
  // Write to main log file
  logStream.write(logLine);
  
  // Write debug logs to separate file
  if (level === 'DEBUG' || level === 'ERROR') {
    debugStream.write(logLine);
  }
}

// Override console methods to use file logging
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  logStream.write(`[${timestamp}] [INFO] ${message}\n`);
  originalConsoleLog(...args);
};

console.error = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  logStream.write(`[${timestamp}] [ERROR] ${message}\n`);
  debugStream.write(`[${timestamp}] [ERROR] ${message}\n`);
  originalConsoleError(...args);
};

console.warn = (...args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  logStream.write(`[${timestamp}] [WARN] ${message}\n`);
  originalConsoleWarn(...args);
};

// Log startup
console.log('='.repeat(80));
console.log('MCP SERVER STARTING');
console.log(`Log files: ${LOG_FILE}`);
console.log(`Debug logs: ${DEBUG_LOG_FILE}`);
console.log('='.repeat(80));

// Auto-start TypeScript compiler in watch mode for development
let watchProcess = null;
if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_AUTO_WATCH !== 'true') {
  const { spawn } = require('child_process');
  const fs = require('fs');
  
  // Check if we're in development (tsconfig.json exists)
  const tsconfigPath = path.join(__dirname, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    console.error('[MCP] 🔧 Starting TypeScript watch mode for auto-compilation...');
    
    watchProcess = spawn('npx', ['tsc', '--watch', '--preserveWatchOutput'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    // Log compilation status
    watchProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Found 0 errors') || output.includes('Watching for file changes')) {
        console.error('[MCP] ✅ TypeScript compilation successful');
      }
    });
    
    watchProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('error TS')) {
        console.error('[MCP] ⚠️  TypeScript compilation error:', output.split('\n')[0]);
      }
    });
    
    // Cleanup on exit
    process.on('exit', () => {
      if (watchProcess) {
        watchProcess.kill();
      }
    });
    
    console.error('[MCP] 📝 TypeScript watch mode active - changes will auto-compile');
  }
}

function toInt(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function toFloat(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

// API Server Configuration for GitHub ingestion
const API_BASE_URL = process.env.API_SERVER_URL || 'http://localhost:3030';

/**
 * Make HTTP request to API server for GitHub ingestion
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
 * Poll for GitHub job completion
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

function createEmbedding() {
  const provider = (process.env.EMBEDDING_PROVIDER || 'embeddingmonster').toLowerCase();
  const model = process.env.EMBEDDING_MODEL || 'auto';

  switch (provider) {
    case 'embeddingmonster':
    case 'autoembeddingmonster':
    case 'auto':
      return new AutoEmbeddingMonster({
        gtePort: toInt(process.env.STELLA_PORT, 30001),
        coderankPort: toInt(process.env.CODERANK_PORT, 30002),
        concurrency: toInt(process.env.EMBEDDING_CONCURRENCY, 16),
        batchSizePerRequest: toInt(process.env.EMBEDDING_BATCH_SIZE_PER_REQUEST, 50)
      });

    case 'embeddingmonster-single':
    case 'monster':
      return new EmbeddingMonster({
        model: model === 'coderank' ? 'coderank' : 'gte',
        gtePort: toInt(process.env.STELLA_PORT, 30001),
        coderankPort: toInt(process.env.CODERANK_PORT, 30002)
      });

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai');
      }
      return new OpenAIEmbedding({
        apiKey,
        model: model === 'auto' ? 'text-embedding-3-small' : model,
        baseURL: process.env.OPENAI_BASE_URL
      });
    }

    case 'gemini': {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY (or GOOGLE_API_KEY) is required when EMBEDDING_PROVIDER=gemini');
      }
      return new GeminiEmbedding({
        apiKey,
        model: model === 'auto' ? 'models/text-embedding-004' : model
      });
    }

    case 'ollama': {
      const ollamaModel = model === 'auto' ? 'nomic-embed-text' : model;
      return new OllamaEmbedding({
        model: ollamaModel,
        host: process.env.OLLAMA_HOST
      });
    }

    case 'voyageai': {
      const apiKey = process.env.VOYAGEAI_API_KEY;
      if (!apiKey) {
        throw new Error('VOYAGEAI_API_KEY is required when EMBEDDING_PROVIDER=voyageai');
      }
      return new VoyageAIEmbedding({
        apiKey,
        model: model === 'auto' ? 'voyage-code-3' : model
      });
    }

    default:
      throw new Error(`Unsupported EMBEDDING_PROVIDER: ${provider}`);
  }
}

function createVectorDatabase() {
  const provider = (process.env.VECTOR_DATABASE_PROVIDER || 'postgres').toLowerCase();
  const connectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('POSTGRES_CONNECTION_STRING is required for metadata storage');
  }

  const maxConnections = toInt(process.env.POSTGRES_MAX_CONNECTIONS, undefined);
  const batchSize = toInt(process.env.POSTGRES_BATCH_SIZE, undefined);
  const pool = new Pool({
    connectionString,
    max: maxConnections || 10,
    idleTimeoutMillis: 30000
  });

  switch (provider) {
    case 'postgres':
    case 'pg': {
      const vectorDatabase = new PostgresDualVectorDatabase({
        connectionString,
        maxConnections,
        batchSize
      });
      return { vectorDatabase, pool };
    }

    case 'qdrant': {
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      const qdrantApiKey = process.env.QDRANT_API_KEY;
      const vectorDatabase = new QdrantVectorDatabase({
        url: qdrantUrl,
        apiKey: qdrantApiKey
      });
      return { vectorDatabase, pool };
    }

    default:
      throw new Error(`Unsupported VECTOR_DATABASE_PROVIDER: ${provider}`);
  }
}

function formatIndexStats(path, stats, durationMs) {
  const durationSec = (durationMs / 1000).toFixed(2);
  return `Indexed "${path}" in ${durationSec}s\n` +
    `Files indexed: ${stats.indexedFiles}\n` +
    `Total chunks: ${stats.totalChunks}\n` +
    `Status: ${stats.status}`;
}

function formatSearchResults(results) {
  if (!results.length) {
    return 'No matches found.';
  }
  return results
    .map((result, idx) => {
      const location = `${result.relativePath}:${result.startLine}-${result.endLine}`;
      const score = typeof result.score === 'number' ? result.score.toFixed(4) : 'n/a';
      return `#${idx + 1} ${location}\nScore: ${score}\n${result.content.trim()}`;
    })
    .join('\n\n');
}

async function main() {
  const embedding = createEmbedding();
  const { vectorDatabase, pool: postgresPool } = createVectorDatabase();
  const context = new Context({ embedding, vectorDatabase, postgresPool });
  let mcpDefaults = await loadMcpDefaults();

  // In-memory indexing progress tracker (no database needed)
  const indexingProgress = new Map(); // key: "project/dataset", value: { expected, stored, status, startTime }

  const instructions = 'Real-time MCP server wrapping the local claude-context-core build with Island Architecture support.\n\n' +
    '🏝️ ISLAND ARCHITECTURE:\n' +
    'All indexing and search now uses project/dataset scoping for proper isolation and 5-10x faster queries.\n' +
    'Set defaults once with claudeContext.init, then omit project/dataset in future calls.\n\n' +
    '🧠 COGNEE KNOWLEDGE GRAPH TOOLS:\n' +
    '  • cognee.add - Add files/URLs to datasets\n' +
    '  • cognee.cognify - Transform datasets into knowledge graphs\n' +
    '  • cognee.search - Search with 12 strategies (CHUNKS, INSIGHTS, RAG_COMPLETION, etc.)\n' +
    '  • cognee.datasets - Manage datasets (list, create, delete, share)\n' +
    '  • cognee.codePipeline - Index and retrieve code repositories\n\n' +
    'Core Tools:\n' +
    '  • claudeContext.init - Set default project/dataset\n' +
    '  • claudeContext.index - Index codebase (auto-checks if already indexed)\n' +
    '  • claudeContext.search - Semantic search (DEFAULT - use this for all searches)\n' +
    '  • claudeContext.status - Check index status & operation progress (with showOperations: true)\n' +
    '  • claudeContext.listDatasets - List all datasets in a project\n' +
    '  • claudeContext.ingestCrawl - Ingest crawl4ai pages\n' +
    '  • claudeContext.indexGitHub - Index GitHub repositories\n\n' +
    'Web Crawling Tools: claudeContext.crawl, claudeContext.crawlStatus, claudeContext.cancelCrawl\n' +
    'Scope Tools: claudeContext.listScopes\n\n' +
    '🔍 SEARCH GUIDANCE:\n' +
    '  • Use claudeContext.search for ALL code searches (fast, hybrid search with reranking)\n' +
    '  • Use cognee.search for knowledge graph queries with advanced strategies\n\n' +
    'Set environment variables (embedding + database + PostgreSQL) before launching.';

  const mcpServer = new McpServer({
    name: 'claude-context-core-dev',
    version: pkg.version
  }, {
    instructions
  });

  // Phase 00-01: Register Cognee MCP Tools
  const { registerCogneeToolsRefined } = require('./cognee-mcp-tools-refined');
  registerCogneeToolsRefined(mcpServer, z);
  console.log('✅ Registered 5 Cognee MCP tools with project/dataset support');

  const toolNamespace = 'claudeContext';

  mcpServer.registerTool(`${toolNamespace}.init`, {
    title: 'Set Default Project',
    description: 'Persist a default project (and optional dataset) for subsequent commands. Can auto-detect from path with auto-scoping.',
    inputSchema: {
      project: z.string().min(1).optional().describe('Default project to use when none is provided (auto-detected if path provided)'),
      dataset: z.string().optional().describe('Optional default dataset for the project'),
      path: z.string().optional().describe('Path to auto-detect project from (uses auto-scoping)')
    }
  }, async ({ project, dataset, path: detectionPath }) => {
    try {
      let finalProject = project;
      let finalDataset = dataset?.trim();
      let autoDetected = false;

      // Auto-detect if path provided (always prefer auto-detection over manual project)
      if (detectionPath) {
        const autoScope = await AutoScoping.autoDetectScope(detectionPath, 'local');
        finalProject = autoScope.projectId;
        finalDataset = finalDataset || autoScope.datasetName;
        autoDetected = true;
        console.log(`[Auto-Scope] Detected: ${finalProject} / ${finalDataset}`);
        
        // Warn if user provided manual project that differs from auto-detected
        if (project && project !== finalProject) {
          console.warn(`[Auto-Scope] ⚠️  Ignoring manual project "${project}" in favor of auto-detected "${finalProject}"`);
        }
      }

      if (!finalProject) {
        throw new Error('Project required. Provide project name or path for auto-detection.');
      }

      const poolInstance = context.getPostgresPool();
      if (!poolInstance) {
        throw new Error('PostgreSQL pool not configured. Cannot verify project.');
      }

      const client = await poolInstance.connect();
      try {
        const projectRecord = await getOrCreateProject(client, finalProject);

        if (finalDataset) {
          await getOrCreateDataset(client, projectRecord.id, finalDataset);
        }

        const saveResult = await saveMcpDefaults({ project: finalProject, dataset: finalDataset });
        mcpDefaults = { project: finalProject, dataset: finalDataset };
        
        // Save to auto-scope history if auto-detected
        if (autoDetected && detectionPath) {
          await AutoScopeConfig.addToHistory(detectionPath, finalProject);
        }

        let message = '';
        if (!saveResult.isNew) {
          // Project already existed
          message = `Project already configured! Updated settings.\n\nProject: ${finalProject}\nPrevious Dataset: ${saveResult.previousDataset || 'not set'}\nNew Dataset: ${finalDataset ?? 'not set'}\nStored at: ${getMcpConfigPath()}`;
          if (autoDetected) {
            message += `\n\nAuto-detection based on path: ${detectionPath}`;
          }
        } else {
          // New project
          message = autoDetected 
            ? `Auto-detected and saved NEW project!\nProject: ${finalProject}\nDataset: ${finalDataset ?? 'not set'}\nStored at: ${getMcpConfigPath()}\n\nAuto-detection based on path: ${detectionPath}`
            : `NEW project configured.\nProject: ${finalProject}\nDataset: ${finalDataset ?? 'not set'}\nStored at: ${getMcpConfigPath()}`;
        }
        
        return {
          content: [{
            type: 'text',
            text: message
          }],
          structuredContent: {
            defaults: mcpDefaults,
            configPath: getMcpConfigPath(),
            autoDetected,
            isNew: saveResult.isNew,
            previousDataset: saveResult.previousDataset
          }
        };
      } finally {
        client.release();
      }
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


  mcpServer.registerTool(`${toolNamespace}.autoScope`, {
    title: 'Preview Auto-Scoping',
    description: 'Preview what project ID and dataset name would be generated from a path without indexing',
    inputSchema: {
      path: z.string().describe('Absolute path to analyze'),
      sourceType: z.enum(['local', 'github', 'crawl', 'manual']).optional().describe('Source type (default: local)'),
      identifier: z.string().optional().describe('Identifier for github/crawl/manual sources')
    }
  }, async ({ path: targetPath, sourceType = 'local', identifier }) => {
    try {
      // Check if auto-scoping is enabled
      const isEnabled = await AutoScopeConfig.isEnabled();
      
      // Generate project ID
      const projectId = await AutoScoping.generateProjectId(targetPath);
      
      // Generate dataset name
      const datasetInfo = AutoScoping.generateDatasetName(sourceType, identifier);
      
      // Check history
      const historyProjectId = await AutoScopeConfig.getFromHistory(targetPath);
      
      // Check for overrides
      const override = await AutoScopeConfig.getOverride(targetPath);
      
      return {
        content: [{
          type: 'text',
          text: `Auto-Scoping Preview for: ${targetPath}\n\n` +
                `Status: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
                `Generated Project ID: ${projectId.id}\n` +
                `  Prefix: ${projectId.prefix} (8 chars)\n` +
                `  Folder: ${projectId.folderName}\n` +
                `  Suffix: ${projectId.suffix} (8 chars)\n\n` +
                `Generated Dataset: ${datasetInfo.name}\n` +
                `  Source: ${datasetInfo.source}\n` +
                `  Identifier: ${datasetInfo.identifier || 'N/A'}\n\n` +
                `History: ${historyProjectId ? `Found in history as ${historyProjectId}` : 'Not in history'}\n` +
                `Override: ${override ? `Project: ${override.project || 'none'}, Dataset: ${override.dataset || 'none'}` : 'No overrides'}\n\n` +
                `Full Detection:\n` +
                `  Project: ${override?.project || projectId.id}\n` +
                `  Dataset: ${override?.dataset || datasetInfo.name}`
        }],
        structuredContent: {
          enabled: isEnabled,
          projectId: projectId,
          dataset: datasetInfo,
          historyProjectId,
          override,
          finalProject: override?.project || projectId.id,
          finalDataset: override?.dataset || datasetInfo.name
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Auto-scope preview failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.ingestCrawl`, {
    title: 'Ingest Crawl4AI Pages',
    description: 'Upsert Crawl4AI pages into the orchestrator database for a project/dataset',
    inputSchema: {
      project: z.string().min(1).describe('Project name'),
      dataset: z.string().min(1).describe('Dataset name'),
      pages: z.array(z.object({
        url: z.string().url().describe('Page URL'),
        markdownContent: z.string().describe('Primary markdown or text content'),
        htmlContent: z.string().optional(),
        title: z.string().optional(),
        domain: z.string().optional(),
        wordCount: z.number().int().optional(),
        charCount: z.number().int().optional(),
        contentHash: z.string().optional(),
        metadata: z.record(z.any()).optional(),
        isGlobal: z.boolean().optional()
      })).min(1).max(25).describe('Pages to upsert in this batch')
    }
  }, async ({ project, dataset, pages }) => {
    try {
      const projectName = project || mcpDefaults.project;
      const datasetName = dataset || mcpDefaults.dataset;

      if (!projectName) {
        throw new Error('Project is required (set a default via claudeContext.init or pass project explicitly).');
      }

      if (!datasetName) {
        throw new Error('Dataset is required (set a default via claudeContext.init or pass dataset explicitly).');
      }

      const response = await ingestCrawlPages(context, {
        project: projectName,
        dataset: datasetName,
        pages
      });
      if (response.status === 'failed') {
        throw new Error(response.error || 'Crawl ingest failed');
      }
      return {
        content: [{
          type: 'text',
          text: `Ingested ${response.ingestedCount} pages for project "${projectName}" / dataset "${datasetName}".`
        }],
        structuredContent: {
          project: projectName,
          dataset: datasetName,
          ingestedCount: response.ingestedCount,
          pageIds: response.pageIds
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Crawl ingest failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.index`, {
    title: 'Index Codebase',
    description: 'Index a repository or folder with auto-scoping support. Automatically detects project/dataset from path if not provided.',
    inputSchema: {
      path: z.string().describe('Absolute path to the project or repository root'),
      project: z.string().min(1).optional().describe('Project name (auto-detected from path if not provided)'),
      dataset: z.string().min(1).optional().describe('Dataset name (defaults to "local" for auto-detection)'),
      repo: z.string().optional().describe('Repository name for provenance metadata'),
      branch: z.string().optional().describe('Branch name for provenance metadata'),
      sha: z.string().optional().describe('Commit SHA for provenance metadata'),
      force: z.boolean().optional().describe('Re-create the collection even if it already exists')
    }
  }, async ({ path: codebasePath, project, dataset, repo, branch, sha, force }, extra) => {
    try {
      // CRITICAL FIX: Always ensure we have a project name
      // Priority: 1) explicit project param, 2) mcp defaults, 3) auto-detect from path
      let projectName = project || mcpDefaults.project;
      
      // If still no project name, auto-detect from path (Island Architecture requirement)
      if (!projectName) {
        const { autoScopeConfig } = await import('./dist/utils/auto-scoping.js');
        const autoScoped = autoScopeConfig(codebasePath, 'local');
        projectName = autoScoped.project;
        console.log(`[Index] Auto-detected project from path: ${projectName}`);
      }
      
      const datasetName = dataset || mcpDefaults.dataset || 'local';
      const finalDataset = datasetName || repo || 'local';
      const progressKey = `${projectName}/${finalDataset}`;
      
      console.log(`[Index] 🏝️ Island Architecture: project="${projectName}", dataset="${finalDataset}"`);
      
      // Initialize progress tracking immediately
      indexingProgress.set(progressKey, {
        expected: 0,
        stored: 0,
        status: 'starting',
        startTime: Date.now()
      });
      
      // Check if already indexed (only if not forcing)
      if (!force && projectName && codebasePath) {
        try {
          const pool = context.getPostgresPool();
          if (pool) {
            const { checkIndexStatus } = await import('./dist/api/check-index-status.js');
            const indexCheck = await checkIndexStatus(pool, codebasePath, projectName, finalDataset, false);
            
            if (indexCheck.isFullyIndexed) {
              // Already fully indexed
              indexingProgress.set(progressKey, {
                expected: indexCheck.stats.indexedFiles,
                stored: indexCheck.stats.indexedFiles,
                status: 'completed',
                startTime: Date.now(),
                endTime: Date.now()
              });
              
              return {
                content: [{
                  type: 'text',
                  text: `✅ Codebase is already fully indexed!\n\nProject: ${projectName}\nDataset: ${finalDataset}\nFiles: ${indexCheck.stats.totalFiles}\n\nNo changes detected. Use force: true to reindex anyway.`
                }],
                structuredContent: {
                  path: codebasePath,
                  project: projectName,
                  dataset: finalDataset,
                  status: 'already-indexed',
                  stats: indexCheck.stats
                }
              };
            } else if (indexCheck.isIndexed && indexCheck.recommendation === 'incremental') {
              // Partially indexed - show what needs updating
              console.log(`[Index] Codebase partially indexed: ${indexCheck.stats.percentIndexed}% up-to-date`);
            }
          }
        } catch (err) {
          // Ignore check errors, proceed with indexing
          console.log(`[Index] Could not check existing index: ${err.message}`);
        }
      }
      
      // Check if API server is available - try different URLs
      const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3030';
      const useApiServer = process.env.USE_API_SERVER !== 'false';
      
      if (projectName && useApiServer) {
        // Try to use API endpoint first
        const fetch = (await import('node-fetch')).default;
        
        // Fire and forget - don't await!
        fetch(`${API_SERVER_URL}/projects/${projectName}/ingest/local`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: codebasePath,
            dataset: finalDataset,
            repo: repo || finalDataset,
            branch,
            sha,
            scope: 'project',
            force: force || false
          }),
          timeout: 5000 // Add timeout to prevent hanging
        }).then(response => response.json()).then(result => {
          // Update progress on completion (silent)
          console.log(`[Index] API response for ${progressKey}:`, result);
          if (result.status === 'completed') {
            const chunks = result.stats?.totalChunks || 0;
            indexingProgress.set(progressKey, {
              expected: chunks,
              stored: chunks,
              status: 'completed',
              startTime: indexingProgress.get(progressKey)?.startTime || Date.now(),
              endTime: Date.now()
            });
          } else if (result.status === 'failed') {
            indexingProgress.set(progressKey, {
              expected: 0,
              stored: 0,
              status: 'failed',
              error: result.error,
              startTime: indexingProgress.get(progressKey)?.startTime || Date.now(),
              endTime: Date.now()
            });
          }
        }).catch(error => {
          // If API server fails, fall back to direct indexing
          console.warn(`[Index] API server not available (${error.message}), using direct indexing`);
          
          // Fall back to direct indexing with setImmediate
          setImmediate(async () => {
            try {
              const result = await ingestGithubRepository(context, {
                project: projectName,
                dataset: finalDataset,
                repo: repo || finalDataset,
                codebasePath,
                branch,
                sha,
                forceReindex: force === true,
                onProgress: (progress) => {
                  const current = indexingProgress.get(progressKey);
                  if (current) {
                    indexingProgress.set(progressKey, {
                      ...current,
                      expected: progress.total || current.expected,
                      stored: progress.current || current.stored,
                      status: 'indexing',
                      phase: progress.phase
                    });
                  }
                }
              });
              
              if (result.status === 'completed') {
                const chunks = result.stats?.totalChunks || 0;
                indexingProgress.set(progressKey, {
                  expected: chunks,
                  stored: chunks,
                  status: 'completed',
                  startTime: indexingProgress.get(progressKey)?.startTime || Date.now(),
                  endTime: Date.now()
                });
              } else {
                indexingProgress.set(progressKey, {
                  expected: 0,
                  stored: 0,
                  status: 'failed',
                  error: result.error,
                  startTime: indexingProgress.get(progressKey)?.startTime || Date.now(),
                  endTime: Date.now()
                });
              }
            } catch (err) {
              indexingProgress.set(progressKey, {
                expected: 0,
                stored: 0,
                status: 'error',
                error: err.message,
                startTime: indexingProgress.get(progressKey)?.startTime || Date.now(),
                endTime: Date.now()
              });
            }
          });
        });
      } else if (projectName && !useApiServer) {
        // Direct indexing mode (when API server is disabled)
        setImmediate(async () => {
          try {
            const result = await ingestGithubRepository(context, {
              project: projectName,
              dataset: finalDataset,
              repo: repo || finalDataset,
              codebasePath,
              branch,
              sha,
              forceReindex: force === true,
              onProgress: (progress) => {
                const current = indexingProgress.get(progressKey);
                if (current) {
                  indexingProgress.set(progressKey, {
                    ...current,
                    expected: progress.total || current.expected,
                    stored: progress.current || current.stored,
                    status: 'indexing',
                    phase: progress.phase
                  });
                }
              }
            });
            
            if (result.status === 'completed') {
              const chunks = result.stats?.totalChunks || 0;
              indexingProgress.set(progressKey, {
                expected: chunks,
                stored: chunks,
                status: 'completed',
                startTime: indexingProgress.get(progressKey)?.startTime || Date.now(),
                endTime: Date.now()
              });
            } else {
              indexingProgress.set(progressKey, {
                expected: 0,
                stored: 0,
                status: 'failed',
                error: result.error,
                startTime: indexingProgress.get(progressKey)?.startTime || Date.now(),
                endTime: Date.now()
              });
            }
          } catch (err) {
            indexingProgress.set(progressKey, {
              expected: 0,
              stored: 0,
              status: 'error',
              error: err.message,
              startTime: indexingProgress.get(progressKey)?.startTime || Date.now(),
              endTime: Date.now()
            });
          }
        });
      } else {
        // This should never happen - projectName should always be set by auto-detection
        console.error('[Index] ❌ CRITICAL: No projectName provided! This causes legacy MD5 collection names.');
        console.error('[Index] ❌ Dataset collections table will NOT be populated!');
        console.error('[Index] ❌ Project:', projectName, 'Dataset:', finalDataset);
        
        return {
          content: [{
            type: 'text',
            text: `❌ Internal Error: No project name detected. This is a bug in the MCP server.\n\n` +
                  `Project: ${projectName}\n` +
                  `Dataset: ${finalDataset}\n\n` +
                  `Please report this error with the above details.`
          }],
          isError: true
        };
      }

      // Return IMMEDIATELY - before any async work starts
      return {
        content: [{
          type: 'text',
          text: projectName 
            ? `Indexing started for project "${projectName}" in dataset "${finalDataset}"\n\nUse claudeContext.status to check progress.`
            : `Indexing started for "${codebasePath}"\n\nUse claudeContext.status to check progress.`
        }],
        structuredContent: {
          path: codebasePath,
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


  mcpServer.registerTool(`${toolNamespace}.search`, {
    title: 'Semantic Search',
    description: 'Query indexed code semantically (project-aware when project supplied)',
    inputSchema: {
      path: z.string().describe('Absolute path to the indexed project'),
      query: z.string().describe('Natural language search query'),
      project: z.string().min(1).optional().describe('Project name for project-aware retrieval'),
      dataset: z.union([z.string(), z.array(z.string())]).optional().describe('Dataset(s) to search: single name, array, "*" for all, or glob patterns like "github-*"'),
      includeGlobal: z.boolean().optional().describe('Include global datasets (default true)'),
      topK: z.number().int().min(1).max(50).optional().describe('Maximum number of matches to return'),
      threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (0-1)'),
      repo: z.string().optional().describe('Filter by repository'),
      lang: z.string().optional().describe('Filter by language'),
      pathPrefix: z.string().optional().describe('Filter by relative path prefix'),
      filter: z.string().optional().describe('Legacy vector-database filter expression (non-project searches)')
    }
  }, async ({ path: codebasePath, query, project, dataset, includeGlobal, topK, threshold, repo, lang, pathPrefix, filter }) => {
    try {
      const projectName = project || mcpDefaults.project;
      const datasetDefault = projectName ? mcpDefaults.dataset : undefined;
      const datasetName = dataset || datasetDefault;

      if (projectName) {
        const progressUpdates = [];
        const results = await queryProject(context, {
          project: projectName,
          dataset: datasetName,
          includeGlobal,
          query,
          codebasePath,
          repo,
          lang,
          pathPrefix,
          topK,
          threshold
        }, (phase, percentage, detail) => {
          progressUpdates.push({ phase, percentage, detail, timestamp: new Date().toISOString() });
          console.log(`[Query Progress] ${phase}: ${percentage}% - ${detail}`);
        });

        if (!results.results.length) {
          return {
            content: [{
              type: 'text',
              text: `No matches found for project "${projectName}".`
            }],
            structuredContent: {
              path: codebasePath,
              project: projectName,
              query,
              results: []
            }
          };
        }

        const formatted = results.results.map((result, idx) => {
          const span = `${result.lineSpan.start}-${result.lineSpan.end}`;
          const score = (result.scores.final ?? result.scores.vector).toFixed(4);
          return `#${idx + 1} ${result.file}:${span}\nScore: ${score}\nRepo: ${result.repo ?? 'n/a'}\n${result.chunk.trim()}`;
        }).join('\n\n');

        return {
          content: [{
            type: 'text',
            text: formatted
          }],
          structuredContent: {
            path: codebasePath,
            project: projectName,
            dataset: datasetName ?? null,
            query,
            results: results.results
          }
        };
      }

      const results = await context.semanticSearch(codebasePath, query, topK, threshold, filter);
      return {
        content: [{
          type: 'text',
          text: formatSearchResults(results)
        }],
        structuredContent: {
          path: codebasePath,
          query,
          results
        }
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

  mcpServer.registerTool(`${toolNamespace}.checkIndex`, {
    title: 'Check If Already Indexed',
    description: 'Check if a codebase is already indexed by comparing SHA-256 hashes. Shows what files are new, modified, or unchanged.',
    inputSchema: {
      path: z.string().describe('Absolute path to the codebase to check'),
      project: z.string().optional().describe('Project name'),
      dataset: z.string().optional().describe('Dataset name'),
      details: z.boolean().optional().describe('Include file lists in response (default: false)')
    }
  }, async ({ path: codebasePath, project, dataset, details }) => {
    try {
      const projectName = project || mcpDefaults.project;
      const datasetName = dataset || mcpDefaults.dataset || 'local';
      
      if (!projectName) {
        return {
          content: [{
            type: 'text',
            text: 'Project name required. Use claudeContext.init to set defaults or provide project parameter.'
          }],
          isError: true
        };
      }
      
      // Get PostgreSQL pool
      const pool = context.getPostgresPool();
      if (!pool) {
        return {
          content: [{
            type: 'text',
            text: 'PostgreSQL connection not available. Cannot check index status.'
          }],
          isError: true
        };
      }
      
      // Dynamic import of check function
      const { checkIndexStatus } = await import('./dist/api/check-index-status.js');
      
      // Check the index status
      const result = await checkIndexStatus(
        pool,
        codebasePath,
        projectName,
        datasetName,
        details === true
      );
      
      // Format the response
      let response = `📊 Index Status for "${codebasePath}"\n`;
      response += `Project: ${projectName} | Dataset: ${datasetName}\n\n`;
      
      if (!result.isIndexed) {
        response += `❌ Not Indexed - This codebase has never been indexed.\n`;
        response += `\nRecommendation: Run full indexing.\n`;
      } else if (result.isFullyIndexed) {
        response += `✅ Fully Indexed - All files are up-to-date!\n`;
        response += `\n📈 Statistics:\n`;
        response += `• Total Files: ${result.stats.totalFiles}\n`;
        response += `• Indexed Files: ${result.stats.indexedFiles}\n`;
        response += `• Status: 100% complete, no changes detected\n`;
      } else {
        response += `⚠️  Partially Indexed - ${result.stats.percentIndexed}% up-to-date\n`;
        response += `\n📈 Statistics:\n`;
        response += `• Total Files: ${result.stats.totalFiles}\n`;
        response += `• Unchanged: ${result.stats.unchangedFiles} files\n`;
        response += `• New: ${result.stats.newFiles} files\n`;
        response += `• Modified: ${result.stats.modifiedFiles} files\n`;
        response += `• Deleted: ${result.stats.deletedFiles} files\n`;
        response += `\n💡 Recommendation: ${result.recommendation}\n`;
      }
      
      response += `\n${result.message}\n`;
      
      // Add file details if requested
      if (details && result.details) {
        if (result.details.newFiles && result.details.newFiles.length > 0) {
          response += `\n📄 New Files (first 10):\n`;
          result.details.newFiles.forEach(f => response += `  + ${f}\n`);
        }
        
        if (result.details.modifiedFiles && result.details.modifiedFiles.length > 0) {
          response += `\n📝 Modified Files (first 10):\n`;
          result.details.modifiedFiles.forEach(f => response += `  ~ ${f}\n`);
        }
        
        if (result.details.deletedFiles && result.details.deletedFiles.length > 0) {
          response += `\n🗑️ Deleted Files (first 10):\n`;
          result.details.deletedFiles.forEach(f => response += `  - ${f}\n`);
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: response
        }],
        structuredContent: result
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to check index status: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.listDatasets`, {
    title: 'List Project Datasets',
    description: 'List all datasets in a project with their chunk counts and Qdrant status',
    inputSchema: {
      project: z.string().optional().describe('Project name (uses default if not provided)')
    }
  }, async ({ project }) => {
    try {
      const projectName = project || mcpDefaults.project;
      
      if (!projectName) {
        return {
          content: [{
            type: 'text',
            text: 'Project name is required. Either pass project parameter or set default with claudeContext.init'
          }],
          isError: true
        };
      }

      const pool = context.getPostgresPool();
      if (!pool) {
        return {
          content: [{
            type: 'text',
            text: 'PostgreSQL pool not configured'
          }],
          isError: true
        };
      }

      // Get project ID
      const projectResult = await pool.query(
        'SELECT id, name FROM claude_context.projects WHERE name = $1',
        [projectName]
      );

      if (projectResult.rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `Project not found: ${projectName}`
          }],
          structuredContent: {
            project: projectName,
            found: false
          }
        };
      }

      const projectId = projectResult.rows[0].id;

      // Get all datasets for this project with collection info
      const datasetsResult = await pool.query(
        `SELECT 
          d.id,
          d.name,
          d.description,
          d.status,
          d.created_at,
          COUNT(c.id) as chunk_count,
          dc.collection_name,
          dc.point_count as stored_point_count
        FROM claude_context.datasets d
        LEFT JOIN claude_context.chunks c ON d.id = c.dataset_id
        LEFT JOIN claude_context.dataset_collections dc ON d.id = dc.dataset_id
        WHERE d.project_id = $1
        GROUP BY d.id, d.name, d.description, d.status, d.created_at, dc.collection_name, dc.point_count
        ORDER BY d.created_at DESC`,
        [projectId]
      );

      if (datasetsResult.rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No datasets found for project: ${projectName}`
          }],
          structuredContent: {
            project: projectName,
            datasets: []
          }
        };
      }

      // Check Qdrant for vectors
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      let qdrantCollections = [];
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${qdrantUrl}/collections`);
        const data = await response.json();
        qdrantCollections = data?.result?.collections || [];
      } catch (err) {
        console.warn(`[listDatasets] Could not fetch Qdrant collections: ${err.message}`);
      }

      // Format output
      const datasetInfos = await Promise.all(datasetsResult.rows.map(async row => {
        console.log(`[listDatasets] 🔍 Processing dataset: ${row.name}, collection_name from DB: ${row.collection_name}`);
        
        let vectorCount = 0;
        let actualCollectionName = row.collection_name || 'none';
        
        // If we have a collection name from dataset_collections table, use it
        if (row.collection_name) {
          // Find the actual Qdrant collection
          const matchingCollection = qdrantCollections.find(col => 
            col.name === row.collection_name
          );
          
          if (matchingCollection) {
            // Get fresh count from Qdrant
            try {
              const fetch = (await import('node-fetch')).default;
              const response = await fetch(`${qdrantUrl}/collections/${row.collection_name}`);
              const data = await response.json();
              vectorCount = data?.result?.vectors_count || data?.result?.points_count || 0;
            } catch (err) {
              // Fall back to cached count
              vectorCount = matchingCollection.points_count || matchingCollection.vectors_count || 0;
            }
          }
        } else {
          // Legacy: try to find by pattern (for backward compatibility)
          const datasetPattern = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          const projectPattern = projectName.replace(/-/g, '_');
          const expectedName = `project_${projectPattern}_dataset_${datasetPattern}`;
          
          const matchingCollection = qdrantCollections.find(col => 
            col.name === expectedName ||
            (col.name && col.name.includes(projectPattern) && col.name.includes(datasetPattern))
          );
          
          if (matchingCollection) {
            actualCollectionName = matchingCollection.name;
            vectorCount = matchingCollection.points_count || matchingCollection.vectors_count || 0;
          }
        }

        const chunkCount = row.chunk_count ? parseInt(row.chunk_count) : 0;

        return {
          name: row.name || 'unnamed',
          description: row.description || '',
          status: row.status || 'unknown',
          chunks_in_postgres: chunkCount,
          vectors_in_qdrant: vectorCount,
          qdrant_collection: actualCollectionName,
          created_at: row.created_at
        };
      }));

      const message = [
        `📊 Datasets in project: ${projectName}`,
        '',
        ...datasetInfos.map(ds => 
          `• ${ds.name}:\n` +
          `  Status: ${ds.status}\n` +
          `  PostgreSQL: ${ds.chunks_in_postgres.toLocaleString()} chunks\n` +
          `  Qdrant: ${ds.vectors_in_qdrant.toLocaleString()} vectors\n` +
          `  Collection: ${ds.qdrant_collection}\n` +
          `  Created: ${new Date(ds.created_at).toLocaleString()}`
        ),
        '',
        `Total datasets: ${datasetInfos.length}`
      ].join('\n');

      return {
        content: [{
          type: 'text',
          text: message
        }],
        structuredContent: {
          project: projectName,
          datasets: datasetInfos,
          total: datasetInfos.length
        }
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to list datasets: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.status`, {
    title: 'Check Index Status & Progress',
    description: 'Check indexing status and track operation progress. Shows active operations, completed indexes, and recent operations.',
    inputSchema: {
      project: z.string().optional().describe('Project name (defaults to MCP config or "all" for all operations)'),
      dataset: z.string().optional().describe('Dataset name (defaults to MCP config)'),
      operationId: z.string().optional().describe('Specific operation ID to check'),
      showOperations: z.boolean().optional().describe('Show recent operations (default: false)'),
      activeOnly: z.boolean().optional().describe('Only show active operations (default: false)')
    }
  }, async ({ project, dataset, operationId, showOperations, activeOnly }) => {
    try {
      const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3030';
      const useApiServer = process.env.USE_API_SERVER !== 'false';
      
      // Handle operation tracking requests
      if (showOperations || operationId || activeOnly || project === 'all') {
        const fetch = (await import('node-fetch')).default;
        const targetProject = project || mcpDefaults.project || 'all';
        
        // Build URL with query parameters
        let url = `${API_SERVER_URL}/projects/${targetProject}/progress`;
        const params = new URLSearchParams();
        if (operationId) params.append('operationId', operationId);
        if (activeOnly) params.append('active', 'true');
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;
        
        console.log(`[Status] Checking operations: ${url}`);
        
        try {
          const response = await fetch(url, { timeout: 5000 });
          if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Handle single operation
          if (operationId && data.operationId) {
            const op = data;
            const progressBar = '\u2588'.repeat(Math.floor(op.progress / 5)) + 
                               '\u2591'.repeat(20 - Math.floor(op.progress / 5));
            
            const statusEmoji = op.status === 'completed' ? '\u2705' :
                               op.status === 'failed' ? '\u274c' :
                               op.status === 'in_progress' ? '\ud83d\udd04' : '\ud83c\udfc1';
            
            const message = [
              `${statusEmoji} Operation Details: ${op.operationId}`,
              '',
              `Type: ${op.operation}`,
              `Project: ${op.project}`,
              op.dataset ? `Dataset: ${op.dataset}` : null,
              `Status: ${op.status}`,
              `Phase: ${op.phase}`,
              `Progress: [${progressBar}] ${op.progress}%`,
              `Message: ${op.message}`,
              '',
              `Started: ${new Date(op.startedAt).toLocaleString()}`,
              `Updated: ${new Date(op.updatedAt).toLocaleString()}`,
              op.completedAt ? `Completed: ${new Date(op.completedAt).toLocaleString()}` : null,
              op.error ? `Error: ${op.error}` : null
            ].filter(Boolean).join('\n');
            
            return {
              content: [{ type: 'text', text: message }],
              structuredContent: op
            };
          }
          
          // Handle multiple operations
          const operations = data.operations || [];
          if (operations.length === 0) {
            return {
              content: [{
                type: 'text',
                text: activeOnly ? 
                  `No active operations found` :
                  `No operations found`
              }],
              structuredContent: { operations: [] }
            };
          }
          
          // Format operations list
          const operationLines = operations.slice(0, 10).map(op => {
            const progressBar = '\u2588'.repeat(Math.floor(op.progress / 10)) + 
                               '\u2591'.repeat(10 - Math.floor(op.progress / 10));
            const statusEmoji = op.status === 'completed' ? '\u2705' :
                                op.status === 'failed' ? '\u274c' :
                                op.status === 'in_progress' ? '\ud83d\udd04' : '\ud83c\udfc1';
            
            return [
              `${statusEmoji} ${op.operation} - ${op.project}/${op.dataset || 'default'}`,
              `   [${progressBar}] ${op.progress}% - ${op.phase}`,
              `   ${op.message}`,
              `   ID: ${op.operationId.substring(0, 8)}...`
            ].join('\n');
          });
          
          const header = activeOnly ?
            `\ud83d\udd04 Active Operations:` :
            `\ud83d\udcca Recent Operations:`;
          
          return {
            content: [{ type: 'text', text: [header, '', ...operationLines].join('\n') }],
            structuredContent: { operations }
          };
        } catch (error) {
          console.log(`[Status] Could not fetch operations: ${error.message}`);
        }
      }
      
      // Regular status check for specific project/dataset
      const projectName = project || mcpDefaults.project;
      
      if (!projectName) {
        return {
          content: [{
            type: 'text',
            text: 'Project name is required. Either pass project parameter or set default with claudeContext.init'
          }],
          isError: true
        };
      }
      
      // Try API server first - check both progress tracking and status endpoints
      if (API_SERVER_URL) {
        try {
          const fetch = (await import('node-fetch')).default;
          
          // First check for active operations via progress tracking
          const progressUrl = `${API_SERVER_URL}/projects/${projectName}/progress?active=true`;
          console.log(`[Status] Checking progress tracking: ${progressUrl}`);
          
          const progressResponse = await fetch(progressUrl, { timeout: 5000 });
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            const operations = progressData.operations || [];
            
            // Look for operations matching this dataset
            const activeOp = operations.find(op => 
              (!dataset || op.dataset === dataset) && 
              (op.status === 'started' || op.status === 'in_progress')
            );
            
            if (activeOp) {
              // Show active operation progress
              const progressBar = '█'.repeat(Math.floor(activeOp.progress / 5)) + 
                                 '░'.repeat(20 - Math.floor(activeOp.progress / 5));
              
              const message = [
                `⏳ Active Operation: ${projectName}/${activeOp.dataset || dataset}`,
                '',
                `Operation: ${activeOp.operation}`,
                `Status: ${activeOp.status}`,
                `Phase: ${activeOp.phase}`,
                `Progress: [${progressBar}] ${activeOp.progress}%`,
                `Message: ${activeOp.message}`,
                `Started: ${new Date(activeOp.startedAt).toLocaleTimeString()}`,
                activeOp.operationId ? `ID: ${activeOp.operationId}` : ''
              ].filter(Boolean).join('\n');
              
              return {
                content: [{ type: 'text', text: message }],
                structuredContent: {
                  project: projectName,
                  dataset: activeOp.dataset || dataset,
                  activeOperation: activeOp
                }
              };
            }
          }
          
          // Then check the status endpoint for completed/stored status
          const url = `${API_SERVER_URL}/projects/${projectName}/status?dataset=${encodeURIComponent(dataset)}`;
          console.log(`[Status] Checking status API: ${url}`);
          
          const response = await fetch(url, { timeout: 5000 });
          const data = await response.json();
          
          if (response.ok && data.status !== 'not_found') {
            // API server returned valid status
            const percentage = data.percentage || 0;
            const statusEmoji = data.status === 'completed' ? '✅' : 
                               data.status === 'indexing' ? '⏳' : 
                               data.status === 'empty' ? '📭' : '❓';
            
            const message = [
              `${statusEmoji} Indexing Status: ${projectName}/${dataset}`,
              '',
              `Status: ${data.status}`,
              `Progress: ${data.stored.toLocaleString()} / ${data.expected.toLocaleString()} chunks (${percentage}%)`,
              `PostgreSQL: ${data.chunks_in_postgres.toLocaleString()} chunks`,
              `Qdrant: ${data.vectors_in_qdrant.toLocaleString()} vectors`,
              `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`
            ].join('\n');
            
            return {
              content: [{ type: 'text', text: message }],
              structuredContent: {
                project: projectName,
                dataset,
                ...data
              }
            };
          }
        } catch (err) {
          console.log(`[Status] API server unavailable, falling back to in-memory: ${err.message}`);
        }
      }
      
      // Fallback to in-memory tracker
      if (dataset) {
        const progressKey = `${projectName}/${dataset}`;
        let progress = indexingProgress.get(progressKey);
        
        // Try case-insensitive lookup if exact match fails
        if (!progress) {
          const lowerKey = progressKey.toLowerCase();
          for (const [key, value] of indexingProgress.entries()) {
            if (key.toLowerCase() === lowerKey) {
              progress = value;
              break;
            }
          }
        }
        
        // Debug: log all available keys
        console.log(`[Status] Looking for key: ${progressKey}`);
        console.log(`[Status] Available keys: ${Array.from(indexingProgress.keys()).join(', ')}`);
        
        if (!progress) {
          // Also check if completed indexing exists in DB
          const pool = context?.getPostgresPool?.();
          if (pool) {
            try {
              const result = await pool.query(`
                SELECT COUNT(c.id) as chunk_count
                FROM claude_context.chunks c
                JOIN claude_context.datasets d ON c.dataset_id = d.id
                JOIN claude_context.projects p ON d.project_id = p.id
                WHERE p.name = $1 AND d.name = $2
              `, [projectName, dataset]);
              
              const chunkCount = parseInt(result.rows[0]?.chunk_count || 0);
              console.log(`[Status] DB query result: ${chunkCount} chunks for ${projectName}/${dataset}`);
              if (chunkCount > 0) {
                // Found in database, create synthetic progress
                progress = {
                  expected: chunkCount,
                  stored: chunkCount,
                  status: 'completed',
                  startTime: Date.now() - 1000,
                  endTime: Date.now()
                };
                // Cache it for future lookups
                indexingProgress.set(progressKey, progress);
              }
            } catch (err) {
              console.log(`[Status] Could not check DB: ${err.message}`);
            }
          }
          
          if (!progress) {
            // Last resort: check Qdrant directly via HTTP API
            try {
              const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
              const fetch = (await import('node-fetch')).default;
              
              // List collections
              const collectionsResp = await fetch(`${qdrantUrl}/collections`);
              const collectionsData = await collectionsResp.json();
              
              // Get first collection (hybrid_code_chunks_*)
              const collection = collectionsData?.result?.collections?.[0];
              if (collection && collection.name) {
                // Get collection details
                const statsResp = await fetch(`${qdrantUrl}/collections/${collection.name}`);
                const statsData = await statsResp.json();
                const pointsCount = statsData?.result?.points_count || 0;
                
                console.log(`[Status] Qdrant collection ${collection.name}: ${pointsCount} points`);
                if (pointsCount > 0) {
                  // Found data in Qdrant, create synthetic progress
                  progress = {
                    expected: pointsCount,
                    stored: pointsCount,
                    status: 'completed',
                    startTime: Date.now() - 60000, // Assume completed 1 minute ago
                    endTime: Date.now() - 1000
                  };
                  // Cache it
                  indexingProgress.set(progressKey, progress);
                }
              }
            } catch (err) {
              console.log(`[Status] Could not check Qdrant: ${err.message}`);
            }
            
            if (!progress) {
              return {
                content: [{
                  type: 'text',
                  text: `No indexing in progress or completed for "${projectName}/${dataset}"\nAvailable progress keys: ${Array.from(indexingProgress.keys()).join(', ')}`
                }],
                structuredContent: {
                  project: projectName,
                  dataset,
                  found: false,
                  availableKeys: Array.from(indexingProgress.keys())
                }
              };
            }
          }
        }
        
        const percentage = progress.expected > 0 
          ? Math.round((progress.stored / progress.expected) * 100) 
          : 0;
        
        const duration = progress.endTime 
          ? ((progress.endTime - progress.startTime) / 1000).toFixed(1)
          : ((Date.now() - progress.startTime) / 1000).toFixed(1);
        
        let statusEmoji = '⏳';
        if (progress.status === 'completed') statusEmoji = '✅';
        else if (progress.status === 'failed' || progress.status === 'error') statusEmoji = '❌';
        
        const message = [
          `${statusEmoji} Indexing Status: ${projectName}/${dataset}`,
          '',
          `Status: ${progress.status}`,
          `Progress: ${progress.stored.toLocaleString()} / ${progress.expected.toLocaleString()} chunks (${percentage}%)`,
          `Duration: ${duration}s`,
          progress.phase ? `Phase: ${progress.phase}` : null,
          progress.error ? `Error: ${progress.error}` : null
        ].filter(Boolean).join('\n');
        
        return {
          content: [{ type: 'text', text: message }],
          structuredContent: {
            project: projectName,
            dataset,
            ...progress,
            percentage,
            duration: parseFloat(duration)
          }
        };
      }
      
      // Show all datasets for project
      const allProgress = [];
      for (const [key, progress] of indexingProgress.entries()) {
        if (key.startsWith(`${projectName}/`)) {
          const datasetName = key.split('/')[1];
          const percentage = progress.expected > 0 
            ? Math.round((progress.stored / progress.expected) * 100) 
            : 0;
          allProgress.push({ dataset: datasetName, ...progress, percentage });
        }
      }
      
      if (allProgress.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No indexing in progress or completed for project "${projectName}"`
          }],
          structuredContent: {
            project: projectName,
            datasets: []
          }
        };
      }
      
      const lines = allProgress.map(p => {
        let emoji = '⏳';
        if (p.status === 'completed') emoji = '✅';
        else if (p.status === 'failed' || p.status === 'error') emoji = '❌';
        return `${emoji} ${p.dataset}: ${p.stored.toLocaleString()}/${p.expected.toLocaleString()} chunks (${p.percentage}%) - ${p.status}`;
      });
      
      const message = [
        `📊 Indexing Status for Project "${projectName}"`,
        '',
        `Active/Completed: ${allProgress.length} dataset(s)`,
        '',
        ...lines
      ].join('\n');
      
      return {
        content: [{ type: 'text', text: message }],
        structuredContent: {
          project: projectName,
          datasets: allProgress
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Status check failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });




  // Crawl4AI Service Tools
  mcpServer.registerTool(`${toolNamespace}.crawl`, {
    title: 'Crawl Web Pages',
    description: 'Trigger crawl4ai service to crawl and index web pages. Modes: single (1 page), batch (multiple URLs), recursive (follow links up to maxDepth, stays within same URL path), sitemap (parse sitemap.xml). Dataset auto-generated from domain (e.g., docs-example-com). Defaults: scope="project", mode="recursive", maxPages=0 (unlimited), maxDepth=2',
    inputSchema: {
      url: z.string().url().describe('URL to crawl'),
      project: z.string().optional().describe('Project name for storage isolation'),
      dataset: z.string().optional().describe('Dataset name (default: auto-generated from domain, e.g., "docs-example-com")'),
      scope: z.enum(['global', 'local', 'project']).optional().describe('Knowledge scope - global: shared across projects, local: local only, project: project-scoped (default: "project")'),
      mode: z.enum(['single', 'batch', 'recursive', 'sitemap']).optional().describe('Crawling mode - single: one page, batch: multiple URLs, recursive: follow links (stays in same URL path), sitemap: parse sitemap.xml (default: "recursive")'),
      maxPages: z.number().optional().describe('Maximum number of pages to crawl, 0 for unlimited (default: 0)'),
      maxDepth: z.number().optional().describe('Maximum depth for recursive crawling (default: 2)'),
      autoDiscovery: z.boolean().optional().describe('Auto-discover llms.txt and sitemaps (default: false)'),
      extractCode: z.boolean().optional().describe('Extract code examples (default: true)')
    }
  }, async ({ url, project, dataset, scope, mode, maxPages, maxDepth, autoDiscovery, extractCode }) => {
    try {
      const fetch = (await import('node-fetch')).default;
      
      // Extract domain from URL for dataset suggestion
      const urlObj = new URL(url);
      const domainName = urlObj.hostname.replace(/^www\./, '').replace(/\./g, '-');
      
      // Use project or default
      const projectName = project || mcpDefaults.project || 'default';
      const datasetName = dataset || domainName;  // Default to domain name (e.g., "docs-example-com")
      
      // Call API server endpoint (which handles all the proper mapping and new features)
      const crawlRequest = {
        start_url: url,
        crawl_type: mode || 'recursive',
        max_pages: maxPages !== undefined ? maxPages : 0,  // Default to unlimited
        depth: maxDepth !== undefined ? maxDepth : 2,
        dataset: datasetName,
        scope: scope || 'project'
      };

      const apiServerUrl = `http://localhost:3030/projects/${projectName}/ingest/crawl`;
      const startResponse = await fetch(apiServerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crawlRequest)
      });

      if (!startResponse.ok) {
        throw new Error(`Crawl start failed: ${startResponse.statusText}`);
      }

      const { jobId } = await startResponse.json();
      
      // Resolved values
      const actualMode = mode || 'recursive';
      const actualMaxPages = maxPages !== undefined ? maxPages : 0;
      const actualMaxDepth = maxDepth !== undefined ? maxDepth : 2;
      const actualScope = scope || 'project';
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Crawl started successfully!\n\n📋 Details:\n  • Job ID: ${jobId}\n  • URL: ${url}\n  • Project: ${projectName}\n  • Dataset: ${datasetName}\n  • Scope: ${actualScope}\n  • Mode: ${actualMode}\n  • Max Pages: ${actualMaxPages === 0 ? 'Unlimited' : actualMaxPages}\n  • Max Depth: ${actualMaxDepth}\n  • Path Filtering: ✅ Enabled (stays within same URL path)\n\n🔍 Track progress:\n  claudeContext.status({ project: "${projectName}", dataset: "${datasetName}", showOperations: true })`
          }
        ],
        structuredContent: {
          jobId,
          url,
          project: projectName,
          dataset: datasetName,
          scope: actualScope,
          mode: actualMode,
          maxPages: actualMaxPages,
          maxDepth: actualMaxDepth,
          pathFiltering: true,
          status: 'started',
          message: `Use claudeContext.status to check progress`
        }
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Crawl failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.crawlStatus`, {
    title: 'Check Crawl Status',
    description: 'Check the status of a running crawl operation',
    inputSchema: {
      progressId: z.string().describe('Progress ID from crawl start')
    }
  }, async ({ progressId }) => {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(`http://localhost:7070/progress/${progressId}`);
      if (!response.ok) {
        throw new Error(`Progress check failed: ${response.statusText}`);
      }

      const progress = await response.json();
      
      return {
        content: [
          {
            type: 'text',
            text: `Crawl Status: ${progress.status}\nProgress: ${progress.progress}%\nLog: ${progress.log}\nCurrent URL: ${progress.current_url || 'N/A'}\nProcessed: ${progress.processed_pages || 0}/${progress.total_pages || 0}\nChunks stored: ${progress.chunks_stored || 0}`
          }
        ],
        structuredContent: progress
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Status check failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.cancelCrawl`, {
    title: 'Cancel Crawl',
    description: 'Cancel a running crawl operation',
    inputSchema: {
      progressId: z.string().describe('Progress ID from crawl start')
    }
  }, async ({ progressId }) => {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(`http://localhost:7070/cancel/${progressId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Cancel failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        content: [
          {
            type: 'text',
            text: `Crawl cancelled successfully. Progress ID: ${progressId}`
          }
        ],
        structuredContent: result
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Cancel failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });



  mcpServer.registerTool(`${toolNamespace}.listScopes`, {
    title: 'List Scopes',
    description: 'List available scopes with chunk statistics',
    inputSchema: {
      project: z.string().optional().describe('Filter by project name')
    }
  }, async ({ project }) => {
    try {
      const fetch = (await import('node-fetch')).default;
      
      let url = 'http://localhost:7070/scopes';
      if (project) {
        url += `?project=${encodeURIComponent(project)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`List scopes failed: ${response.statusText}`);
      }

      const scopes = await response.json();
      
      let resultText = `Available Scopes (${scopes.length}):\n\n`;
      
      scopes.forEach((scope) => {
        const codeRatio = scope.chunk_count > 0 
          ? (scope.code_chunks / scope.chunk_count * 100).toFixed(1) 
          : 0;
        
        resultText += `Collection: ${scope.collection_name}\n`;
        resultText += `Scope: ${scope.scope}\n`;
        resultText += `Total Chunks: ${scope.chunk_count}\n`;
        resultText += `  - Code: ${scope.code_chunks} (${codeRatio}%)\n`;
        resultText += `  - Text: ${scope.text_chunks} (${(100 - parseFloat(codeRatio)).toFixed(1)}%)\n\n`;
      });
      
      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ],
        structuredContent: scopes
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `List scopes failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });


  // =============================================================================
  // GitHub Ingestion Tool
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
      const projectName = project || getCurrentProject();
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
            text: `Job still running after 2 minutes.\nJob ID: ${response.jobId}\nCheck status with claudeContext.listDatasets`
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

  const transport = new StdioServerTransport();

  async function shutdown(signal) {
    try {
      await mcpServer.sendLoggingMessage({
        level: 'info',
        logger: 'claude-context:shutdown',
        data: `Received ${signal}, closing connections`
      });
      if (vectorDatabase && typeof vectorDatabase.close === 'function') {
        await vectorDatabase.close();
      }
      if (postgresPool) {
        await postgresPool.end();
      }
    } catch (error) {
      console.error('Shutdown error:', error);
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await mcpServer.connect(transport);
  console.error('claude-context MCP development server is running (stdio transport)');
}

main().catch(error => {
  console.error('Failed to start claude-context MCP server:', error);
  process.exit(1);
});
