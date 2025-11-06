#!/usr/bin/env node

/**
 * Local development MCP server that wires the claude-context core library into
 * the Model Context Protocol so you can iterate on the implementation without
 * publishing to npm. The server exposes a small set of tools (index, reindex,
 * search, status, clear) that map directly to the `Context` APIs.
 */

const path = require('path');
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

  const instructions = 'Real-time MCP server wrapping the local claude-context-core build with Island Architecture support.\n\n' +
    '🏝️ ISLAND ARCHITECTURE:\n' +
    'All indexing and search now uses project/dataset scoping for proper isolation and 5-10x faster queries.\n' +
    'Set defaults once with claudeContext.init, then omit project/dataset in future calls.\n\n' +
    'Core Tools:\n' +
    '  • claudeContext.init - Set default project/dataset\n' +
    '  • claudeContext.defaults - Show current defaults\n' +
    '  • claudeContext.index - Index codebase (project-aware)\n' +
    '  • claudeContext.search - Semantic search (DEFAULT - use this for all searches)\n' +
    '  • claudeContext.status - Check index status\n' +
    '  • claudeContext.clear - Delete collections\n' +
    '  • claudeContext.ingestCrawl - Ingest crawl4ai pages\n\n' +
    'Web Crawling Tools: claudeContext.crawl, claudeContext.crawlStatus, claudeContext.cancelCrawl\n' +
    'Chunk Retrieval Tools: claudeContext.searchChunks, claudeContext.getChunk, claudeContext.listScopes\n\n' +
    '🔍 SEARCH GUIDANCE:\n' +
    '  • Use claudeContext.search for ALL code searches (fast, hybrid search with reranking)\n' +
    '  • Only use claudeContext.smartQuery when user explicitly asks for:\n' +
    '    - "Explain how X works"\n' +
    '    - "Summarize the codebase"\n' +
    '    - Questions requiring LLM-generated answers with reasoning\n\n' +
    '⚠️  Legacy path-based tools (claudeContext.reindex) are deprecated.\n' +
    'Set environment variables (embedding + database + PostgreSQL) before launching.';

  const mcpServer = new McpServer({
    name: 'claude-context-core-dev',
    version: pkg.version
  }, {
    instructions
  });

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

      // Auto-detect if path provided but no project
      if (detectionPath && !project) {
        const autoScope = await AutoScoping.autoDetectScope(detectionPath, 'local');
        finalProject = autoScope.projectId;
        finalDataset = finalDataset || autoScope.datasetName;
        autoDetected = true;
        console.log(`[Auto-Scope] Detected: ${finalProject} / ${finalDataset}`);
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

        await saveMcpDefaults({ project: finalProject, dataset: finalDataset });
        mcpDefaults = { project: finalProject, dataset: finalDataset };
        
        // Save to auto-scope history if auto-detected
        if (autoDetected && detectionPath) {
          await AutoScopeConfig.addToHistory(detectionPath, finalProject);
        }

        const message = autoDetected 
          ? `Auto-detected and saved defaults!\nProject: ${finalProject}\nDataset: ${finalDataset ?? 'not set'}\nStored at: ${getMcpConfigPath()}\n\nAuto-detection based on path: ${detectionPath}`
          : `Defaults updated.\nProject: ${finalProject}\nDataset: ${finalDataset ?? 'not set'}\nStored at: ${getMcpConfigPath()}`;
        
        return {
          content: [{
            type: 'text',
            text: message
          }],
          structuredContent: {
            defaults: mcpDefaults,
            configPath: getMcpConfigPath(),
            autoDetected
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

  mcpServer.registerTool(`${toolNamespace}.defaults`, {
    title: 'Show Default Project',
    description: 'Display the stored default project/dataset used for commands when omitted',
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
    const start = Date.now();
    try {
      let projectName = project || mcpDefaults.project;
      let datasetName = dataset || (projectName ? mcpDefaults.dataset : undefined);
      let autoDetected = false;
      
      // Auto-detect if no project specified
      if (!projectName && (await AutoScopeConfig.isEnabled())) {
        const autoScope = await AutoScoping.autoDetectScope(codebasePath, 'local');
        projectName = autoScope.projectId;
        datasetName = datasetName || autoScope.datasetName;
        autoDetected = true;
        
        // Auto-save defaults if enabled
        if (await AutoScopeConfig.load().then(c => c.autoSave)) {
          await AutoScopeConfig.saveAutoScope(autoScope);
          mcpDefaults = await loadMcpDefaults();
        }
        
        console.log(`[Auto-Scope] Using: ${projectName} / ${datasetName}`);
      }

      if (projectName) {
        const ingestResult = await ingestGithubRepository(context, {
          project: projectName,
          dataset: datasetName,
          repo: repo || datasetName || path.basename(codebasePath),
          codebasePath,
          branch,
          sha,
          forceReindex: force === true,
          onProgress: progress => {
            mcpServer.sendLoggingMessage({
              level: 'info',
              logger: 'claude-context:index',
              data: {
                project: projectName,
                dataset: datasetName || repo || path.basename(codebasePath),
                path: codebasePath,
                phase: progress.phase,
                current: progress.current,
                total: progress.total,
                percentage: progress.percentage
              }
            }, extra.sessionId);
          }
        });

        if (ingestResult.status === 'failed') {
          throw new Error(ingestResult.error || 'Project ingest failed');
        }

        const duration = Date.now() - start;
        const stats = ingestResult.stats;
        const message = autoDetected
          ? `✅ Auto-Scoped Index Complete!\n\n` +
            `Project: ${projectName} (auto-detected)\n` +
            `Dataset: ${datasetName || repo || path.basename(codebasePath)}\n` +
            `Duration: ${(duration / 1000).toFixed(2)}s\n` +
            `Files indexed: ${stats?.indexedFiles ?? 0}\n` +
            `Chunks: ${stats?.totalChunks ?? 0}\n` +
            `Status: ${stats?.status ?? 'completed'}`
          : `Project ${projectName} indexed in ${(duration / 1000).toFixed(2)}s\n` +
            `Dataset: ${datasetName || repo || path.basename(codebasePath)}\n` +
            `Files indexed: ${stats?.indexedFiles ?? 0}\n` +
            `Chunks: ${stats?.totalChunks ?? 0}\n` +
            `Status: ${stats?.status ?? 'completed'}`;
        
        return {
          content: [{
            type: 'text',
            text: message
          }],
          structuredContent: {
            path: codebasePath,
            project: projectName,
            dataset: datasetName || repo || path.basename(codebasePath),
            durationMs: duration,
            stats
          }
        };
      }

      const stats = await context.indexCodebase(codebasePath, progress => {
        mcpServer.sendLoggingMessage({
          level: 'info',
          logger: 'claude-context:index',
          data: {
            path: codebasePath,
            phase: progress.phase,
            current: progress.current,
            total: progress.total,
            percentage: progress.percentage
          }
        }, extra.sessionId);
      }, force === true);

      const duration = Date.now() - start;
      return {
        content: [{
          type: 'text',
          text: formatIndexStats(codebasePath, stats, duration)
        }],
        structuredContent: {
          path: codebasePath,
          durationMs: duration,
          ...stats
        }
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

  mcpServer.registerTool(`${toolNamespace}.reindex`, {
    title: 'Re-index Changed Files (Legacy)',
    description: '⚠️ DEPRECATED: Legacy incremental reindexing. For Island Architecture, use claudeContext.index with project/dataset and force=false for sync.',
    inputSchema: {
      path: z.string().describe('Absolute path to the project or repository root'),
      project: z.string().optional().describe('Project name (for Island Architecture sync)'),
      dataset: z.string().optional().describe('Dataset name')
    }
  }, async ({ path, project, dataset }) => {
    try {
      const projectName = project || mcpDefaults.project;
      
      if (projectName) {
        return {
          content: [{
            type: 'text',
            text: `⚠️  Island Architecture Detected\n\nFor incremental sync with Island Architecture, use:\n  claudeContext.index with:\n    - path: ${path}\n    - project: ${projectName}\n    - dataset: ${dataset || mcpDefaults.dataset || 'your-dataset'}\n    - force: false\n\nThis will automatically detect and sync only changed files.`
          }],
          structuredContent: {
            deprecated: true,
            useInstead: 'claudeContext.index',
            project: projectName,
            path
          }
        };
      }
      
      // Legacy mode
      console.warn('[MCP] Legacy reindexByChange is deprecated');
      const changes = await context.reindexByChange(path);
      return {
        content: [{
          type: 'text',
          text: `⚠️  Legacy reindex completed\n\nAdded: ${changes.added}\nModified: ${changes.modified}\nRemoved: ${changes.removed}\n\nNote: Consider migrating to Island Architecture for better project isolation.`
        }],
        structuredContent: {
          path,
          legacy: true,
          ...changes
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Reindex failed: ${error instanceof Error ? error.message : String(error)}`
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
      dataset: z.string().optional().describe('Limit search to a specific dataset'),
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

  mcpServer.registerTool(`${toolNamespace}.status`, {
    title: 'Index Status',
    description: 'Check index status for a project/dataset or legacy path. With Island Architecture, checks project-scoped collections.',
    inputSchema: {
      path: z.string().optional().describe('Absolute path (legacy mode)'),
      project: z.string().optional().describe('Project name for Island Architecture status'),
      dataset: z.string().optional().describe('Dataset name (optional, shows all datasets if omitted)')
    }
  }, async ({ path, project, dataset }) => {
    try {
      const vectorDatabase = context.getVectorDatabase();
      const poolInstance = context.getPostgresPool();
      const supportsStats = typeof vectorDatabase.getCollectionStats === 'function';
      
      const projectName = project || mcpDefaults.project;
      
      // Island Architecture mode (project-based)
      if (projectName && poolInstance) {
        const client = await poolInstance.connect();
        try {
          const datasetName = dataset || mcpDefaults.dataset;
          
          // Get all collections for this project (and dataset if specified)
          let query, params;
          if (datasetName) {
            query = `
              SELECT dc.collection_name, dc.point_count, dc.last_indexed_at, d.name as dataset_name
              FROM claude_context.dataset_collections dc
              JOIN claude_context.datasets d ON dc.dataset_id = d.id
              JOIN claude_context.projects p ON d.project_id = p.id
              WHERE p.name = $1 AND d.name = $2
              ORDER BY dc.last_indexed_at DESC
            `;
            params = [projectName, datasetName];
          } else {
            query = `
              SELECT dc.collection_name, dc.point_count, dc.last_indexed_at, d.name as dataset_name
              FROM claude_context.dataset_collections dc
              JOIN claude_context.datasets d ON dc.dataset_id = d.id
              JOIN claude_context.projects p ON d.project_id = p.id
              WHERE p.name = $1
              ORDER BY d.name, dc.last_indexed_at DESC
            `;
            params = [projectName];
          }
          
          const result = await client.query(query, params);
          
          if (result.rows.length === 0) {
            return {
              content: [{
                type: 'text',
                text: datasetName 
                  ? `No index found for project "${projectName}" / dataset "${datasetName}"`
                  : `No indices found for project "${projectName}"`
              }],
              structuredContent: {
                project: projectName,
                dataset: datasetName,
                collections: []
              }
            };
          }
          
          const collections = [];
          let totalChunks = 0;
          
          for (const row of result.rows) {
            const exists = await vectorDatabase.hasCollection(row.collection_name);
            if (exists) {
              collections.push({
                name: row.collection_name,
                dataset: row.dataset_name,
                entityCount: row.point_count || 0,
                lastIndexed: row.last_indexed_at
              });
              totalChunks += (row.point_count || 0);
            }
          }
          
          const collectionLines = collections.map(col => 
            `• ${col.dataset}: ${col.name} (${col.entityCount.toLocaleString()} chunks, last indexed: ${new Date(col.lastIndexed).toLocaleString()})`
          );
          
          const summary = [
            `📊 Index Status for Project "${projectName}"${datasetName ? ` / Dataset "${datasetName}"` : ''}`,
            '',
            `Total Collections: ${collections.length}`,
            `Total Chunks: ${totalChunks.toLocaleString()}`,
            '',
            'Collections:',
            ...collectionLines
          ].join('\n');
          
          return {
            content: [{ type: 'text', text: summary }],
            structuredContent: {
              project: projectName,
              dataset: datasetName,
              totalCollections: collections.length,
              totalChunks,
              collections
            }
          };
        } finally {
          client.release();
        }
      }
      
      // Legacy mode (path-based) - deprecated
      if (path) {
        console.warn('[MCP] Legacy path-based status check is deprecated. Use project/dataset instead.');
        const collectionName = context.getCollectionName(path);
        const hasIndex = await vectorDatabase.hasCollection(collectionName);
        
        if (!hasIndex) {
          return {
            content: [{
              type: 'text',
              text: `⚠️  No legacy index found for ${path}\n\nNote: Path-based indexing is deprecated. Use Island Architecture with project/dataset instead.`
            }],
            structuredContent: { path, hasIndex: false, legacy: true }
          };
        }
        
        let entityCount = null;
        if (supportsStats) {
          const stats = await vectorDatabase.getCollectionStats(collectionName);
          entityCount = stats?.entityCount ?? null;
        }
        
        return {
          content: [{
            type: 'text',
            text: `⚠️  Legacy index exists for ${path}\n• ${collectionName}: ${entityCount ? `${entityCount.toLocaleString()} chunks` : 'stats unavailable'}\n\nNote: Path-based indexing is deprecated. Migrate to Island Architecture with project/dataset.`
          }],
          structuredContent: {
            path,
            hasIndex: true,
            legacy: true,
            collections: [{ name: collectionName, entityCount }]
          }
        };
      }
      
      throw new Error('Either project or path is required');
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

  mcpServer.registerTool(`${toolNamespace}.clear`, {
    title: 'Clear Index',
    description: 'Delete collections for a project/dataset or legacy path. With Island Architecture, deletes project-scoped collections and database records.',
    inputSchema: {
      path: z.string().optional().describe('Absolute path (legacy mode)'),
      project: z.string().optional().describe('Project name'),
      dataset: z.string().optional().describe('Dataset name (if omitted, clears all project datasets)'),
      dryRun: z.boolean().optional().describe('Report what would happen without deleting data')
    }
  }, async ({ path, project, dataset, dryRun }) => {
    try {
      const projectName = project || mcpDefaults.project;
      const poolInstance = context.getPostgresPool();
      const vectorDatabase = context.getVectorDatabase();
      
      // Island Architecture mode
      if (projectName && poolInstance) {
        const client = await poolInstance.connect();
        try {
          const datasetName = dataset || mcpDefaults.dataset;
          
          // Get collections to delete
          let query, params;
          if (datasetName) {
            query = `
              SELECT dc.collection_name
              FROM claude_context.dataset_collections dc
              JOIN claude_context.datasets d ON dc.dataset_id = d.id
              JOIN claude_context.projects p ON d.project_id = p.id
              WHERE p.name = $1 AND d.name = $2
            `;
            params = [projectName, datasetName];
          } else {
            query = `
              SELECT dc.collection_name
              FROM claude_context.dataset_collections dc
              JOIN claude_context.datasets d ON dc.dataset_id = d.id
              JOIN claude_context.projects p ON d.project_id = p.id
              WHERE p.name = $1
            `;
            params = [projectName];
          }
          
          const result = await client.query(query, params);
          const collections = result.rows.map(r => r.collection_name);
          
          if (collections.length === 0) {
            return {
              content: [{
                type: 'text',
                text: `No collections found for project "${projectName}"${datasetName ? ` / dataset "${datasetName}"` : ''}`
              }],
              structuredContent: {
                project: projectName,
                dataset: datasetName,
                collectionsDeleted: 0
              }
            };
          }
          
          if (dryRun) {
            return {
              content: [{
                type: 'text',
                text: `🔍 Dry run - would delete:\n\nProject: ${projectName}${datasetName ? `\nDataset: ${datasetName}` : ''}\n\nCollections (${collections.length}):\n${collections.map(c => `  • ${c}`).join('\n')}`
              }],
              structuredContent: {
                dryRun: true,
                project: projectName,
                dataset: datasetName,
                collections
              }
            };
          }
          
          // Delete collections from vector database
          let deletedCount = 0;
          for (const collectionName of collections) {
            try {
              if (await vectorDatabase.hasCollection(collectionName)) {
                await vectorDatabase.dropCollection(collectionName);
                deletedCount++;
              }
            } catch (err) {
              console.error(`Failed to drop collection ${collectionName}:`, err);
            }
          }
          
          // Delete from database
          if (datasetName) {
            await client.query(`
              DELETE FROM claude_context.dataset_collections
              WHERE collection_name = ANY($1)
            `, [collections]);
          } else {
            await client.query(`
              DELETE FROM claude_context.dataset_collections dc
              USING claude_context.datasets d, claude_context.projects p
              WHERE dc.dataset_id = d.id
                AND d.project_id = p.id
                AND p.name = $1
            `, [projectName]);
          }
          
          return {
            content: [{
              type: 'text',
              text: `✅ Cleared ${deletedCount} collection(s)\n\nProject: ${projectName}${datasetName ? `\nDataset: ${datasetName}` : ''}\n\nDeleted collections:\n${collections.map(c => `  • ${c}`).join('\n')}`
            }],
            structuredContent: {
              project: projectName,
              dataset: datasetName,
              collectionsDeleted: deletedCount,
              collections
            }
          };
        } finally {
          client.release();
        }
      }
      
      // Legacy mode
      if (path) {
        if (dryRun) {
          return {
            content: [{
              type: 'text',
              text: `⚠️  Dry run (legacy mode): would clear embeddings for ${path}\n\nNote: Path-based indexing is deprecated. Use project/dataset instead.`
            }],
            structuredContent: { path, dryRun: true, legacy: true }
          };
        }
        
        console.warn('[MCP] Legacy clearIndex is deprecated');
        await context.clearIndex(path);
        return {
          content: [{
            type: 'text',
            text: `⚠️  Cleared embeddings for ${path} (legacy mode)\n\nNote: Path-based indexing is deprecated. Migrate to Island Architecture.`
          }],
          structuredContent: { path, cleared: true, legacy: true }
        };
      }
      
      throw new Error('Either project or path is required');
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Clear failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  // Crawl4AI Service Tools
  mcpServer.registerTool(`${toolNamespace}.crawl`, {
    title: 'Crawl Web Pages',
    description: 'Trigger crawl4ai service to crawl and index web pages with chunking, code detection, and AI summaries',
    inputSchema: {
      url: z.string().url().describe('URL to crawl'),
      project: z.string().optional().describe('Project name for storage isolation'),
      dataset: z.string().optional().describe('Dataset name for storage isolation'),
      scope: z.enum(['global', 'local', 'project']).optional().describe('Knowledge scope (default: local)'),
      mode: z.enum(['single', 'batch', 'recursive', 'sitemap']).optional().describe('Crawling mode (default: single)'),
      maxDepth: z.number().optional().describe('Maximum depth for recursive crawling (default: 1)'),
      autoDiscovery: z.boolean().optional().describe('Auto-discover llms.txt and sitemaps (default: true)'),
      extractCode: z.boolean().optional().describe('Extract code examples (default: true)')
    }
  }, async ({ url, project, dataset, scope, mode, maxDepth, autoDiscovery, extractCode }) => {
    try {
      const fetch = (await import('node-fetch')).default;
      
      // Start crawl
      const crawlRequest = {
        urls: [url],
        project: project || mcpDefaults.project,
        dataset: dataset || mcpDefaults.dataset,
        scope,
        mode: mode || 'single',
        max_depth: maxDepth || 1,
        auto_discovery: autoDiscovery !== false,
        extract_code_examples: extractCode !== false
      };

      const startResponse = await fetch('http://localhost:7070/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crawlRequest)
      });

      if (!startResponse.ok) {
        throw new Error(`Crawl start failed: ${startResponse.statusText}`);
      }

      const { progress_id, status } = await startResponse.json();

      // Poll progress until complete
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const progressResponse = await fetch(`http://localhost:7070/progress/${progress_id}`);
        if (!progressResponse.ok) {
          throw new Error(`Progress check failed: ${progressResponse.statusText}`);
        }

        const progress = await progressResponse.json();
        
        if (progress.status === 'completed') {
          return {
            content: [
              {
                type: 'text',
                text: `Crawl completed successfully!\n\nProject: ${project || 'default'}\nDataset: ${dataset || 'default'}\nScope: ${scope || 'local'}\n\nProcessed: ${progress.processed_pages || 0} pages\nChunks stored: ${progress.chunks_stored || 0}\nProgress: ${progress.progress}%`
              }
            ],
            structuredContent: {
              progress_id,
              status: progress.status,
              chunks_stored: progress.chunks_stored,
              processed_pages: progress.processed_pages
            }
          };
        }
        
        if (progress.status === 'failed' || progress.status === 'cancelled') {
          throw new Error(`Crawl ${progress.status}: ${progress.log}`);
        }
        
        attempts++;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Crawl still running after 2 minutes. Progress ID: ${progress_id}. Use crawlStatus to check progress.`
          }
        ],
        structuredContent: {
          progress_id,
          status: 'running',
          timeout: true
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

  // Retrieval Tools
  mcpServer.registerTool(`${toolNamespace}.searchChunks`, {
    title: 'Search Chunks',
    description: 'Search for chunks with scope filtering, code/text filtering, and similarity ranking',
    inputSchema: {
      query: z.string().describe('Search query'),
      project: z.string().optional().describe('Project name for filtering'),
      dataset: z.string().optional().describe('Dataset name for filtering'),
      scope: z.enum(['global', 'local', 'project', 'all']).optional().describe('Scope level for filtering'),
      filterCode: z.boolean().optional().describe('Only return code chunks'),
      filterText: z.boolean().optional().describe('Only return text chunks'),
      limit: z.number().optional().describe('Maximum results (default: 10)')
    }
  }, async ({ query, project, dataset, scope, filterCode, filterText, limit }) => {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const searchRequest = {
        query,
        project: project || mcpDefaults.project,
        dataset: dataset || mcpDefaults.dataset,
        scope,
        filter_code: filterCode,
        filter_text: filterText,
        limit: limit || 10
      };

      const response = await fetch('http://localhost:7070/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchRequest)
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Format results
      let resultText = `Found ${data.total} chunks for query: "${data.query}"\n\n`;
      
      data.results.forEach((chunk, idx) => {
        resultText += `[${idx + 1}] ${chunk.is_code ? 'CODE' : 'TEXT'} (${chunk.language}) - Score: ${chunk.similarity_score.toFixed(3)}\n`;
        resultText += `Source: ${chunk.relative_path}\n`;
        resultText += `Summary: ${chunk.summary}\n`;
        resultText += `Content (first 200 chars): ${chunk.chunk_text.substring(0, 200)}...\n`;
        resultText += `Scope: ${chunk.scope} | Model: ${chunk.model_used}\n\n`;
      });
      
      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ],
        structuredContent: data
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Search failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.getChunk`, {
    title: 'Get Chunk',
    description: 'Retrieve a specific chunk by ID',
    inputSchema: {
      chunkId: z.string().describe('Chunk ID'),
      includeContext: z.boolean().optional().describe('Include surrounding chunks (not yet implemented)')
    }
  }, async ({ chunkId, includeContext }) => {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(`http://localhost:7070/chunk/${chunkId}`);

      if (!response.ok) {
        throw new Error(`Get chunk failed: ${response.statusText}`);
      }

      const chunk = await response.json();
      
      const resultText = `Chunk ID: ${chunk.id}\n` +
        `Type: ${chunk.is_code ? 'CODE' : 'TEXT'} (${chunk.language})\n` +
        `Source: ${chunk.relative_path} (chunk ${chunk.chunk_index})\n` +
        `Scope: ${chunk.scope} | Model: ${chunk.model_used}\n\n` +
        `Summary:\n${chunk.summary}\n\n` +
        `Full Content:\n${chunk.chunk_text}`;
      
      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ],
        structuredContent: chunk
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Get chunk failed: ${error instanceof Error ? error.message : String(error)}`
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

  // ==================================================================================
  // Web Content Tools
  // ==================================================================================

  mcpServer.registerTool(`${toolNamespace}.index_web_pages`, {
    title: 'Index Web Pages',
    description: 'Index web pages into the knowledge graph with full text + vector + SPLADE hybrid search',
    inputSchema: {
      urls: z.array(z.string()).describe('URLs to crawl and index'),
      project: z.string().optional().describe('Project name (defaults to MCP config)'),
      dataset: z.string().optional().describe('Dataset name (defaults to MCP config)'),
      forceReindex: z.boolean().optional().describe('Force re-indexing even if pages already exist')
    }
  }, async ({ urls, project, dataset, forceReindex }) => {
    try {
      const projectName = project || mcpDefaults.project;
      const datasetName = dataset || mcpDefaults.dataset;

      if (!projectName) {
        return {
          content: [{
            type: 'text',
            text: 'Error: No project specified and no default project configured. Use set_defaults tool first.'
          }],
          isError: true
        };
      }

      // Crawl pages using Crawl4AI service
      const crawlClient = context.getCrawl4AIClient && context.getCrawl4AIClient();
      if (!crawlClient) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Crawl4AI client not configured. Set CRAWL4AI_URL environment variable.'
          }],
          isError: true
        };
      }

      const progressUpdates = [];
      const pages = await crawlClient.crawlPages(urls);

      // Ingest pages using unified pipeline
      const result = await ingestWebPages(context, {
        project: projectName,
        dataset: datasetName,
        pages,
        forceReindex
      }, (phase, percentage, detail) => {
        progressUpdates.push({ phase, percentage, detail, timestamp: new Date().toISOString() });
        console.log(`[Web Ingest] ${phase}: ${percentage}% - ${detail}`);
      });

      const summary = [
        `✅ Indexed ${result.stats.processedPages} web pages`,
        `📄 Generated ${result.stats.totalChunks} chunks`,
        `🎯 Project: ${projectName}`,
        datasetName ? `📦 Dataset: ${datasetName}` : '',
        `⏱️ Duration: ${result.metadata.timing.total}ms`
      ].filter(Boolean).join('\n');

      return {
        content: [{
          type: 'text',
          text: summary
        }],
        structuredContent: {
          project: projectName,
          dataset: datasetName,
          urls,
          stats: result.stats,
          progress: progressUpdates
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Web indexing failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.query_web_content`, {
    title: 'Query Web Content',
    description: 'Search indexed web content with hybrid dense + sparse vector search',
    inputSchema: {
      query: z.string().describe('Search query'),
      project: z.string().optional().describe('Project name (defaults to MCP config)'),
      dataset: z.string().optional().describe('Dataset name (defaults to MCP config)'),
      topK: z.number().optional().describe('Number of results to return (default: 10)'),
      useReranking: z.boolean().optional().describe('Apply cross-encoder reranking (default: true)')
    }
  }, async ({ query, project, dataset, topK, useReranking }) => {
    try {
      const projectName = project || mcpDefaults.project;
      const datasetName = dataset || mcpDefaults.dataset;

      if (!projectName) {
        return {
          content: [{
            type: 'text',
            text: 'Error: No project specified and no default project configured.'
          }],
          isError: true
        };
      }

      const result = await queryWebContent(context, {
        project: projectName,
        dataset: datasetName,
        query,
        topK: topK || 10,
        useReranking: useReranking !== false
      });

      if (!result.results.length) {
        return {
          content: [{
            type: 'text',
            text: `No web content found for query: "${query}"`
          }],
          structuredContent: {
            project: projectName,
            query,
            results: []
          }
        };
      }

      const formatted = result.results.map((r, idx) => {
        const scoreInfo = [];
        if (r.scores.dense) scoreInfo.push(`Dense: ${r.scores.dense.toFixed(3)}`);
        if (r.scores.sparse) scoreInfo.push(`Sparse: ${r.scores.sparse.toFixed(3)}`);
        if (r.scores.rerank) scoreInfo.push(`Rerank: ${r.scores.rerank.toFixed(3)}`);
        scoreInfo.push(`Final: ${r.scores.final.toFixed(3)}`);

        return [
          `#${idx + 1} ${r.title || r.url}`,
          `URL: ${r.url}`,
          `Scores: ${scoreInfo.join(' | ')}`,
          `Domain: ${r.domain}`,
          `\n${r.content.substring(0, 300)}${r.content.length > 300 ? '...' : ''}`
        ].join('\n');
      }).join('\n\n---\n\n');

      return {
        content: [{
          type: 'text',
          text: formatted
        }],
        structuredContent: {
          project: projectName,
          dataset: datasetName,
          query,
          results: result.results,
          metadata: result.metadata
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Web query failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.smart_query_web`, {
    title: 'Smart Query Web Content',
    description: 'Query web content with LLM-enhanced retrieval and answer generation',
    inputSchema: {
      query: z.string().describe('Natural language question'),
      project: z.string().optional().describe('Project name (defaults to MCP config)'),
      dataset: z.string().optional().describe('Dataset name (defaults to MCP config)'),
      strategies: z.array(z.enum(['hypothetical_document', 'multi_query', 'step_back'])).optional()
        .describe('Query enhancement strategies to apply'),
      answerType: z.enum(['paragraph', 'list', 'table', 'code', 'concise']).optional()
        .describe('Desired answer format (default: paragraph)')
    }
  }, async ({ query, project, dataset, strategies, answerType }) => {
    try {
      const projectName = project || mcpDefaults.project;
      const datasetName = dataset || mcpDefaults.dataset;

      if (!projectName) {
        return {
          content: [{
            type: 'text',
            text: 'Error: No project specified and no default project configured.'
          }],
          isError: true
        };
      }

      const result = await smartQueryWebContent(context, {
        project: projectName,
        dataset: datasetName,
        query,
        strategies,
        answerType
      });

      const sources = result.retrievals.map((r, idx) => 
        `[${idx + 1}] ${r.title || r.url} (score: ${r.scores.final.toFixed(3)})`
      ).join('\n');

      const output = [
        `🤖 Answer:`,
        result.answer.content,
        ``,
        `📚 Sources:`,
        sources,
        ``,
        `⏱️ Query Time: ${result.metadata.timing.total}ms`
      ].join('\n');

      return {
        content: [{
          type: 'text',
          text: output
        }],
        structuredContent: {
          project: projectName,
          dataset: datasetName,
          query,
          answer: result.answer.content,
          sources: result.retrievals,
          metadata: result.metadata
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Smart web query failed: ${error instanceof Error ? error.message : String(error)}`
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
