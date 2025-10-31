#!/usr/bin/env node

/**
 * Local development MCP server that wires the claude-context core library into
 * the Model Context Protocol so you can iterate on the implementation without
 * publishing to npm. The server exposes a small set of tools (index, reindex,
 * search, status, clear) that map directly to the `Context` APIs.
 */

const path = require('path');
const { z } = require('zod');

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
  PostgresDualVectorDatabase
} = require('./dist');

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

  switch (provider) {
    case 'postgres':
    case 'pg': {
      const connectionString = process.env.POSTGRES_CONNECTION_STRING;
      if (!connectionString) {
        throw new Error('POSTGRES_CONNECTION_STRING is required when VECTOR_DATABASE_PROVIDER=postgres');
      }
      return new PostgresDualVectorDatabase({
        connectionString,
        maxConnections: toInt(process.env.POSTGRES_MAX_CONNECTIONS, undefined),
        batchSize: toInt(process.env.POSTGRES_BATCH_SIZE, undefined)
      });
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
  const vectorDatabase = createVectorDatabase();
  const context = new Context({ embedding, vectorDatabase });

  const instructions = 'Real-time MCP server wrapping the local claude-context-core build.\n' +
    'Tools: claudeContext.index, claudeContext.reindex, claudeContext.search, claudeContext.clear, claudeContext.status.\n' +
    'Set environment variables (embedding + database) before launching.';

  const mcpServer = new McpServer({
    name: 'claude-context-core-dev',
    version: pkg.version
  }, {
    instructions
  });

  const toolNamespace = 'claudeContext';

  mcpServer.registerTool(`${toolNamespace}.index`, {
    title: 'Index Codebase',
    description: 'Index a repository or folder using the local claude-context core',
    inputSchema: {
      path: z.string().describe('Absolute path to the project or repository root'),
      force: z.boolean().optional().describe('Re-create the collection even if it already exists')
    }
  }, async ({ path, force }, extra) => {
    const start = Date.now();
    try {
      const stats = await context.indexCodebase(path, progress => {
        mcpServer.sendLoggingMessage({
          level: 'info',
          logger: 'claude-context:index',
          data: {
            path,
            phase: progress.phase,
            current: progress.current,
            total: progress.total,
            percentage: progress.percentage
          }
        }, extra.sessionId);
      }, force === true);

      const duration = Date.now() - start;
      return {
        content: [
          {
            type: 'text',
            text: formatIndexStats(path, stats, duration)
          }
        ],
        structuredContent: {
          path,
          durationMs: duration,
          ...stats
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Indexing failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.reindex`, {
    title: 'Re-index changed files',
    description: 'Runs incremental reindexing based on Merkle tree diff',
    inputSchema: {
      path: z.string().describe('Absolute path to the project or repository root')
    }
  }, async ({ path }) => {
    try {
      const changes = await context.reindexByChange(path);
      return {
        content: [
          {
            type: 'text',
            text: `Reindex completed. Added: ${changes.added}, Modified: ${changes.modified}, Removed: ${changes.removed}`
          }
        ],
        structuredContent: {
          path,
          ...changes
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Reindex failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });

  mcpServer.registerTool(`${toolNamespace}.search`, {
    title: 'Semantic Search',
    description: 'Query indexed code semantically',
    inputSchema: {
      path: z.string().describe('Absolute path to the indexed project'),
      query: z.string().describe('Natural language search query'),
      topK: z.number().int().min(1).max(50).optional().describe('Maximum number of matches to return'),
      threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (0-1)')
    }
  }, async ({ path, query, topK, threshold }) => {
    try {
      const results = await context.semanticSearch(path, query, topK, threshold);
      return {
        content: [
          {
            type: 'text',
            text: formatSearchResults(results)
          }
        ],
        structuredContent: {
          path,
          query,
          results
        }
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

  mcpServer.registerTool(`${toolNamespace}.status`, {
    title: 'Index Status',
    description: 'Check whether an index exists for a given path',
    inputSchema: {
      path: z.string().describe('Absolute path to the project')
    }
  }, async ({ path }) => {
    try {
      const vectorDatabase = context.getVectorDatabase();
      const supportsStats = typeof vectorDatabase.getCollectionStats === 'function';
      const collections = [];
      let totalChunks = 0;
      let hasIndex = false;

      const isDual = typeof context.isAutoEmbeddingMonster === 'function'
        ? context.isAutoEmbeddingMonster()
        : false;

      if (isDual) {
        const { text, code, textModel, codeModel } = context.getCollectionNames(path);
        const textExists = await vectorDatabase.hasCollection(text);
        const codeExists = await vectorDatabase.hasCollection(code);
        hasIndex = textExists || codeExists;

        if (textExists) {
          let entityCount = null;
          if (supportsStats) {
            const stats = await vectorDatabase.getCollectionStats(text);
            entityCount = stats?.entityCount ?? null;
            if (entityCount !== null) totalChunks += entityCount;
          }
          collections.push({
            name: text,
            model: textModel,
            entityCount
          });
        }

        if (codeExists) {
          let entityCount = null;
          if (supportsStats) {
            const stats = await vectorDatabase.getCollectionStats(code);
            entityCount = stats?.entityCount ?? null;
            if (entityCount !== null) totalChunks += entityCount;
          }
          collections.push({
            name: code,
            model: codeModel,
            entityCount
          });
        }
      }
      else {
        const collectionName = context.getCollectionName(path);
        hasIndex = await vectorDatabase.hasCollection(collectionName);
        if (hasIndex) {
          let entityCount = null;
          if (supportsStats) {
            const stats = await vectorDatabase.getCollectionStats(collectionName);
            entityCount = stats?.entityCount ?? null;
            if (entityCount !== null) totalChunks += entityCount;
          }
          collections.push({
            name: collectionName,
            entityCount
          });
        }
      }

      let summary;
      if (!hasIndex) {
        summary = `No index found for ${path}`;
      }
      else if (collections.length === 0) {
        summary = `Index exists for ${path}`;
      }
      else {
        const collectionLines = collections.map(col => {
          if (col.entityCount === null || col.entityCount === undefined) {
            return `• ${col.name}${col.model ? ` (${col.model})` : ''}`;
          }
          return `• ${col.name}${col.model ? ` (${col.model})` : ''}: ${col.entityCount.toLocaleString()} chunks`;
        });
        const totalLine = totalChunks > 0 ? `Total chunks stored: ${totalChunks.toLocaleString()}` : null;
        summary = [`Index exists for ${path}.`, ...collectionLines, totalLine].filter(Boolean).join('\n');
      }

      return {
        content: [
          {
            type: 'text',
            text: summary
          }
        ],
        structuredContent: {
          path,
          hasIndex,
          totalChunks: totalChunks || undefined,
          collections
        }
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

  mcpServer.registerTool(`${toolNamespace}.clear`, {
    title: 'Clear Index',
    description: 'Delete the stored embeddings for a project path',
    inputSchema: {
      path: z.string().describe('Absolute path to the project'),
      dryRun: z.boolean().optional().describe('Report what would happen without deleting data')
    }
  }, async ({ path, dryRun }) => {
    if (dryRun) {
      return {
        content: [
          {
            type: 'text',
            text: `Dry run: would clear embeddings for ${path}`
          }
        ],
        structuredContent: {
          path,
          dryRun: true
        }
      };
    }

    try {
      await context.clearIndex(path);
      return {
        content: [
          {
            type: 'text',
            text: `Cleared embeddings for ${path}`
          }
        ],
        structuredContent: {
          path,
          cleared: true
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Clear failed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
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

