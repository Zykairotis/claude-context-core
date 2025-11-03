# @zilliz/claude-context-core
![](../../assets/claude-context.png)

The core indexing engine for Claude Context - a powerful tool for semantic search and analysis of codebases using vector embeddings and AI.

## Phase A Updates (Project-Aware Storage)

- ✅ **PostgreSQL dual-vector adapter** (`PostgresDualVectorDatabase`) is now the default local backend. The Docker compose file ships with a pgvector service and an optional Qdrant profile for Phase B work.
- ✅ **Project-aware ingest + query APIs** are available via `ingestGithubRepository`, `ingestCrawlPages`, and `queryProject`. They wire into the existing `Context` and orchestrator schema (projects, datasets, shares).
- ✅ **MCP server tools** now accept `project`, `dataset`, and provenance metadata. Use `claudeContext.index`/`search` for project-aware runs and `claudeContext.ingestCrawl` for Crawl4AI upserts.
- ✅ **Persistent defaults**: run `claudeContext.init` once to store a default project/dataset (written to `~/.context/claude-mcp.json`). Subsequent MCP commands automatically fall back to those values when `project`/`dataset` are omitted (`claudeContext.defaults` shows the current settings).
- ✅ **Dockerized crawler**: launch `docker compose --profile crawl4ai up crawl4ai` to fetch pages via the new REST service (`services/crawl4ai-runner`). Feed the results into `ingestCrawlPages()` + the `Context` chunker to index web content immediately.
- ✅ **Native Qdrant integration**: set `VECTOR_DATABASE_PROVIDER=qdrant`, point `QDRANT_URL` at your cluster (defaults to `http://localhost:6333`), and keep `POSTGRES_CONNECTION_STRING` configured for metadata. Hybrid retrieval now runs against Qdrant with RRF fusion, while Postgres continues to track projects/datasets.
- ✅ **Tests** were added under `src/api/__tests__` covering ingest/query flows with mocked Postgres clients. Run them with `npm run test`.

Everything remains usable without project metadata—omit the `project` argument and the legacy single-collection workflow still works.

[![npm version](https://img.shields.io/npm/v/@zilliz/claude-context-core.svg)](https://www.npmjs.com/package/@zilliz/claude-context-core)
[![npm downloads](https://img.shields.io/npm/dm/@zilliz/claude-context-core.svg)](https://www.npmjs.com/package/@zilliz/claude-context-core)

> 📖 **New to Claude Context?** Check out the [main project README](../../README.md) for an overview and quick start guide.

## Installation

```bash
npm install @zilliz/claude-context-core
```

### Prepare Environment Variables
#### OpenAI API key
See [OpenAI Documentation](https://platform.openai.com/docs/api-reference) for more details to get your API key.
```bash
OPENAI_API_KEY=your-openai-api-key
```

#### Zilliz Cloud configuration
Get a free Milvus vector database on Zilliz Cloud. 

Claude Context needs a vector database. You can [sign up](https://cloud.zilliz.com/signup?utm_source=github&utm_medium=referral&utm_campaign=2507-codecontext-readme) on Zilliz Cloud to get a free Serverless cluster.

![](../../assets/signup_and_create_cluster.jpeg)

After creating your cluster, open your Zilliz Cloud console and copy both the **public endpoint** and your **API key**.  
These will be used as `your-zilliz-cloud-public-endpoint` and `your-zilliz-cloud-api-key` in the configuration examples.

![Zilliz Cloud Dashboard](../../assets/zilliz_cloud_dashboard.jpeg)

Keep both values handy for the configuration steps below.

If you need help creating your free vector database or finding these values, see the [Zilliz Cloud documentation](https://docs.zilliz.com/docs/create-cluster) for detailed instructions.

```bash
MILVUS_ADDRESS=your-zilliz-cloud-public-endpoint
MILVUS_TOKEN=your-zilliz-cloud-api-key
``` 

> 💡 **Tip**: For easier configuration management across different usage scenarios, consider using [global environment variables](../../docs/getting-started/environment-variables.md).

## Quick Start

```typescript
import { 
  Context, 
  OpenAIEmbedding, 
  MilvusVectorDatabase 
} from '@zilliz/claude-context-core';

// Initialize embedding provider
const embedding = new OpenAIEmbedding({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
  model: 'text-embedding-3-small'
});

// Initialize vector database
const vectorDatabase = new MilvusVectorDatabase({
  address: process.env.MILVUS_ADDRESS || 'localhost:19530',
  token: process.env.MILVUS_TOKEN || ''
});

// Create context instance
const context = new Context({
  embedding,
  vectorDatabase
});

// Index a codebase
const stats = await context.indexCodebase('./my-project', (progress) => {
  console.log(`${progress.phase} - ${progress.percentage}%`);
});

console.log(`Indexed ${stats.indexedFiles} files with ${stats.totalChunks} chunks`);

// Search the codebase
const results = await context.semanticSearch(
  './my-project',
  'function that handles user authentication',
  5
);

results.forEach(result => {
  console.log(`${result.relativePath}:${result.startLine}-${result.endLine}`);
  console.log(`Score: ${result.score}`);
  console.log(result.content);
});
```

## Liquid Glass Frontend Console

The repository now ships a shadcn-inspired glassmorphism control plane under `src/ui`. Mount the `App` component inside your preferred React / Vite / Next.js shell to orchestrate ingestion, hybrid retrieval, and scope management visually.

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, MockContextApiClient, ShadcnGlassStyles } from '@zilliz/claude-context-core';

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ShadcnGlassStyles />
    <App />
  </React.StrictMode>
);
```

- **Mock vs live data:** Switch the mode selector to `Live API` and provide your backend base URL to call the REST endpoints defined in `plan/05-api.md`. Leave it on `Mock data` to explore the full pipeline using the curated sample telemetry.
- **Focus areas:** GitHub & Crawl4AI ingestion orchestration, hybrid query playground, global/project/local scope explorer, pipeline throughput telemetry, and operations timeline.
- **Styling:** The UI uses shadcn component patterns (`Button`, `Tabs`, `Card`) paired with glassmorphism CSS injected via `ShadcnGlassStyles`, so no Tailwind build step is required for the showcase.

## Features

- **Multi-language Support**: Index TypeScript, JavaScript, Python, Java, C++, and many other programming languages
- **Semantic Search**: Find code using natural language queries powered by AI embeddings
- **Flexible Architecture**: Pluggable embedding providers and vector databases
- **Smart Chunking**: Intelligent code splitting that preserves context and structure
- **Batch Processing**: Efficient processing of large codebases with progress tracking
- **Pattern Matching**: Built-in ignore patterns for common build artifacts and dependencies
- **Incremental File Synchronization**: Efficient change detection using Merkle trees to only re-index modified files

## Embedding Providers

- **OpenAI Embeddings** (`text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`)
- **VoyageAI Embeddings** - High-quality embeddings optimized for code (`voyage-code-3`, `voyage-3.5`, etc.)
- **Gemini Embeddings** - Google's embedding models (`gemini-embedding-001`)
- **Ollama Embeddings** - Local embedding models via Ollama

## Vector Database Support

- **Milvus/Zilliz Cloud** - High-performance vector database

## Code Splitters

- **AST Code Splitter** - AST-based code splitting with automatic fallback (default)
- **LangChain Code Splitter** - Character-based code chunking

## Configuration

### ContextConfig

```typescript
interface ContextConfig {
  embedding?: Embedding;           // Embedding provider
  vectorDatabase?: VectorDatabase; // Vector database instance (required)
  codeSplitter?: Splitter;        // Code splitting strategy
  supportedExtensions?: string[]; // File extensions to index
  ignorePatterns?: string[];      // Patterns to ignore
  customExtensions?: string[];    // Custom extensions from MCP
  customIgnorePatterns?: string[]; // Custom ignore patterns from MCP
}
```

### Supported File Extensions (Default)

```typescript
[
  // Programming languages
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
  '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.m', '.mm',
  // Text and markup files  
  '.md', '.markdown', '.ipynb'
]
```

### Default Ignore Patterns

- Build and dependency directories: `node_modules/**`, `dist/**`, `build/**`, `out/**`, `target/**`
- Version control: `.git/**`, `.svn/**`, `.hg/**`
- IDE files: `.vscode/**`, `.idea/**`, `*.swp`, `*.swo`
- Cache directories: `.cache/**`, `__pycache__/**`, `.pytest_cache/**`, `coverage/**`
- Minified files: `*.min.js`, `*.min.css`, `*.bundle.js`, `*.map`
- Log and temp files: `logs/**`, `tmp/**`, `temp/**`, `*.log`
- Environment files: `.env`, `.env.*`, `*.local`

## API Reference

### Context

#### Methods

- `indexCodebase(path, progressCallback?, forceReindex?)` - Index an entire codebase
- `reindexByChange(path, progressCallback?)` - Incrementally re-index only changed files
- `semanticSearch(path, query, topK?, threshold?, filterExpr?)` - Search indexed code semantically
- `hasIndex(path)` - Check if codebase is already indexed
- `clearIndex(path, progressCallback?)` - Remove index for a codebase
- `updateIgnorePatterns(patterns)` - Update ignore patterns
- `addCustomIgnorePatterns(patterns)` - Add custom ignore patterns
- `addCustomExtensions(extensions)` - Add custom file extensions
- `updateEmbedding(embedding)` - Switch embedding provider
- `updateVectorDatabase(vectorDB)` - Switch vector database
- `updateSplitter(splitter)` - Switch code splitter

### Search Results

```typescript
interface SemanticSearchResult {
  content: string;      // Code content
  relativePath: string; // File path relative to codebase root
  startLine: number;    // Starting line number
  endLine: number;      // Ending line number
  language: string;     // Programming language
  score: number;        // Similarity score (0-1)
}
```


## Examples

### Using VoyageAI Embeddings

```typescript
import { Context, MilvusVectorDatabase, VoyageAIEmbedding } from '@zilliz/claude-context-core';

// Initialize with VoyageAI embedding provider
const embedding = new VoyageAIEmbedding({
  apiKey: process.env.VOYAGEAI_API_KEY || 'your-voyageai-api-key',
  model: 'voyage-code-3'
});

const vectorDatabase = new MilvusVectorDatabase({
  address: process.env.MILVUS_ADDRESS || 'localhost:19530',
  token: process.env.MILVUS_TOKEN || ''
});

const context = new Context({
  embedding,
  vectorDatabase
});
```

### Custom File Filtering

```typescript
const context = new Context({
  embedding,
  vectorDatabase,
  supportedExtensions: ['.ts', '.js', '.py', '.java'],
  ignorePatterns: [
    'node_modules/**',
    'dist/**',
    '*.spec.ts',
    '*.test.js'
  ]
});
```

## File Synchronization Architecture

Claude Context implements an intelligent file synchronization system that efficiently tracks and processes only the files that have changed since the last indexing operation. This dramatically improves performance when working with large codebases.

![File Synchronization Architecture](../../assets/file_synchronizer.png)

### How It Works

The file synchronization system uses a **Merkle tree-based approach** combined with SHA-256 file hashing to detect changes:

#### 1. File Hashing
- Each file in the codebase is hashed using SHA-256
- File hashes are computed based on file content, not metadata
- Hashes are stored with relative file paths for consistency across different environments

#### 2. Merkle Tree Construction
- All file hashes are organized into a Merkle tree structure
- The tree provides a single root hash that represents the entire codebase state
- Any change to any file will cause the root hash to change

#### 3. Snapshot Management
- File synchronization state is persisted to `~/.context/merkle/` directory
- Each codebase gets a unique snapshot file based on its absolute path hash
- Snapshots contain both file hashes and serialized Merkle tree data

#### 4. Change Detection Process
1. **Quick Check**: Compare current Merkle root hash with stored snapshot
2. **Detailed Analysis**: If root hashes differ, perform file-by-file comparison
3. **Change Classification**: Categorize changes into three types:
   - **Added**: New files that didn't exist before
   - **Modified**: Existing files with changed content
   - **Removed**: Files that were deleted from the codebase

#### 5. Incremental Updates
- Only process files that have actually changed
- Update vector database entries only for modified chunks
- Remove entries for deleted files
- Add entries for new files


## Contributing

This package is part of the Claude Context monorepo. Please see:
- [Main Contributing Guide](../../CONTRIBUTING.md) - General contribution guidelines
- [Core Package Contributing](CONTRIBUTING.md) - Specific development guide for this package

## Related Packages

- **[@claude-context/mcp](../mcp)** - MCP server that uses this core engine
- **[VSCode Extension](../vscode-extension)** - VSCode extension built on this core


## License

MIT - See [LICENSE](../../LICENSE) for details
