# Claude Context Ingestion Architecture

## Overview

This document describes the complete ingestion pipeline for both GitHub repositories and web content (via crawl4ai), ensuring unified retrieval across all data sources.

## Architecture Components

### Core Components

1. **Context Engine** (`src/context.ts`)
   - Main orchestration layer for indexing
   - Handles project-aware metadata
   - Manages embedding and vector storage

2. **Vector Database** (`src/vectordb/`)
   - PostgresDualVectorDatabase: Stores vectors in PostgreSQL with pgvector
   - QdrantVectorDatabase: Alternative vector storage (optional)
   - Supports both dense (semantic) and sparse (SPLADE) vectors

3. **Embedding Providers** (`src/embedding/`)
   - AutoEmbeddingMonster: Dual-model routing (GTE for text, CodeRank for code)
   - OpenAI, Gemini, Ollama, VoyageAI: Alternative providers

4. **Crawl4AI Service** (`services/crawl4ai-runner/`)
   - Python FastAPI service for web crawling
   - Integrated chunking, code detection, and AI summarization
   - Direct PostgreSQL storage with scope management

## Ingestion Flows

### Flow 1: GitHub Repository Ingestion

**Entry Point**: `ingestGithubRepository()` in `src/api/ingest.ts`

```typescript
const result = await ingestGithubRepository(context, {
  project: 'my-project',
  dataset: 'my-dataset',
  repo: 'owner/repo',
  codebasePath: '/path/to/repo',
  branch: 'main',
  sha: 'abc123',
  forceReindex: false,
  onProgress: (progress) => console.log(progress)
});
```

**Pipeline**:

1. **Project Resolution** (`Context.resolveProject()`)
   ```
   Creates or retrieves:
   - project_id (UUID)
   - dataset_id (UUID)
   - Stores in claude_context.projects and claude_context.datasets tables
   ```

2. **File Scanning** (`Context.getCodeFiles()`)
   ```
   - Walks directory tree
   - Filters by supported extensions (.ts, .js, .py, etc.)
   - Applies ignore patterns (node_modules, .git, etc.)
   ```

3. **Code Splitting** (`AstCodeSplitter.split()`)
   ```
   - Uses tree-sitter for AST-based splitting
   - Fallback to LangChain splitter for unsupported languages
   - Generates chunks with metadata (startLine, endLine, language)
   - Default: 1000 chars with 100 char overlap
   ```

4. **Batch Processing** (`Context.processChunkBatch()`)
   ```
   a. Dense Embedding Generation (parallel)
      - AutoEmbeddingMonster routes to GTE (text) or CodeRank (code)
      - Batch size: 50 chunks per request
      - Concurrency: 16 parallel requests
   
   b. Sparse Vector Generation (parallel, if ENABLE_HYBRID_SEARCH=true)
      - SPLADE service generates sparse vectors for hybrid search
      - Uses distilled model (rasyosef/splade-small)
   
   c. Vector Document Creation
      - Combines dense + sparse vectors
      - Adds project metadata (projectId, datasetId, repo, branch, sha)
      - Includes provenance (relativePath, startLine, endLine, lang)
   ```

5. **Vector Storage** (`PostgresDualVectorDatabase.insertHybrid()`)
   ```
   Stores in PostgreSQL table structure:
   
   Table: hybrid_code_chunks_{hash}
   Columns:
   - id: TEXT (unique chunk identifier)
   - vector: vector(768) (dense embedding)
   - content: TEXT (full chunk text)
   - relative_path: TEXT
   - start_line, end_line: INTEGER
   - file_extension: TEXT
   - project_id, dataset_id: UUID
   - repo, branch, sha: TEXT (provenance)
   - lang: TEXT
   - sparse_vector: JSONB {indices: [], values: []}
   - metadata: JSONB (additional fields)
   ```

### Flow 2: Web Content Ingestion (Crawl4AI)

**Entry Point**: `POST /crawl` on crawl4ai service (port 7070)

```bash
curl -X POST http://localhost:7070/crawl \
  -H 'Content-Type: application/json' \
  -d '{
    "urls": ["https://docs.example.com"],
    "project": "my-project",
    "dataset": "docs",
    "scope": "local",
    "mode": "recursive",
    "max_depth": 2,
    "extract_code_examples": true
  }'
```

**Pipeline**:

1. **Crawling Phase** (20-60% progress)
   ```
   - Uses Playwright headless browser
   - Converts HTML to Markdown (readability extraction)
   - Captures links for recursive crawling
   - Extracts code blocks using tree-sitter
   ```

2. **Chunking Phase** (60-70% progress)
   ```python
   SmartChunker.chunk_text():
   - RecursiveTextSplitter splits into chunks (default: 1000 chars, 200 overlap)
   - CodeDetector uses tree-sitter to identify code vs text
   - Routes chunks to appropriate models:
     * is_code=true → model_hint='coderank'
     * is_code=false → model_hint='gte'
   - Generates Chunk objects with metadata
   ```

3. **Summarization Phase** (70-80% progress)
   ```
   - MiniMaxSummaryProvider generates summaries for each chunk
   - API: LLM_API_BASE (default: https://api.minimax.io/v1)
   - Model: MODEL_NAME (default: MiniMax-M2)
   - Summary max length: 200 characters
   ```

4. **Embedding Phase** (80-92% progress)
   ```python
   EmbeddingMonsterClient.embed_batch():
   - Connects to EmbeddingMonster services via host.docker.internal
   - GTE endpoint: http://host.docker.internal:30001
   - CodeRank endpoint: http://host.docker.internal:30002
   - Batch size: 32 chunks per request
   - Returns 768-dimensional vectors
   ```

5. **Storage Phase** (92-98% progress)
   ```python
   PostgresVectorStore.insert_chunks():
   - Resolves scope (global/project/local) using ScopeManager
   - Creates collection: chunks_{scope_collection_name}
   
   Table: chunks_project_{project}_dataset_{dataset}
   Columns:
   - id: TEXT (UUID)
   - chunk_text: TEXT
   - summary: TEXT (AI-generated)
   - vector: vector(768)
   - is_code: BOOLEAN
   - language: TEXT
   - relative_path: TEXT
   - chunk_index: INTEGER
   - start_char, end_char: INTEGER
   - model_used: TEXT (gte/coderank)
   - project_id, dataset_id: UUID
   - scope: TEXT (global/project/local)
   - metadata: JSONB
   ```

## Schema Comparison

### GitHub Chunks (TypeScript Context)

```sql
CREATE TABLE hybrid_code_chunks_{hash} (
  id TEXT PRIMARY KEY,
  vector vector(768),
  content TEXT,
  relative_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  file_extension TEXT,
  project_id UUID,
  dataset_id UUID,
  repo TEXT,
  branch TEXT,
  sha TEXT,
  lang TEXT,
  sparse_vector JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Crawl4AI Chunks (Python Service)

```sql
CREATE TABLE chunks_{collection_name} (
  id TEXT PRIMARY KEY,
  chunk_text TEXT,
  summary TEXT,
  vector vector(768),
  is_code BOOLEAN,
  language TEXT,
  relative_path TEXT,
  chunk_index INTEGER,
  start_char INTEGER,
  end_char INTEGER,
  model_used TEXT,
  project_id UUID,
  dataset_id UUID,
  scope TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Issues Identified

### Issue 1: Schema Mismatch

**Problem**: GitHub and Crawl4AI use different table structures and column names.

- GitHub: `content` vs Crawl4AI: `chunk_text`
- GitHub: `start_line/end_line` vs Crawl4AI: `start_char/end_char`
- GitHub: No `summary` field
- Crawl4AI: No `sparse_vector` field
- Different table naming conventions

**Impact**: Unified retrieval via `queryProject()` expects consistent schema.

### Issue 2: Missing Hybrid Search for Crawl4AI

**Problem**: Crawl4AI chunks don't have sparse vectors for hybrid search.

**Impact**: Crawl4AI results won't benefit from hybrid ranking when ENABLE_HYBRID_SEARCH=true.

### Issue 3: Separate Collection Management

**Problem**: GitHub uses `hybrid_code_chunks_{hash}` while Crawl4AI uses `chunks_{scope}`.

**Impact**: `queryProject()` must query multiple collections with different schemas.

## Unified Retrieval

### Current Implementation: `queryProject()` in `src/api/query.ts`

```typescript
// Resolves project + dataset IDs
const projectContext = await getOrCreateProject(client, projectName);
const datasetIds = await getAccessibleDatasets(client, projectContext.id);

// Generates query embedding
const queryVector = await embedding.embed(query);

// Searches vector database with filters
const results = await vectorDb.search(collectionName, queryVector, {
  topK: 10,
  threshold: 0.4,
  filter: { datasetIds, projectId, repo, lang, pathPrefix }
});
```

**Current Status**: Works for GitHub ingestion via TypeScript Context.

**Gap**: Doesn't automatically discover or query Crawl4AI chunk tables.

## Recommendations

### Option 1: Unified Schema (Recommended)

**Action**: Modify Crawl4AI to store chunks in the same format as GitHub.

**Changes**:
1. Rename `chunk_text` → `content`
2. Add `start_line`, `end_line` (map from char positions)
3. Add `sparse_vector` field (integrate SPLADE service)
4. Use same table naming: `hybrid_code_chunks_{hash}`
5. Store `summary` in metadata JSON

**Benefits**:
- Single retrieval path
- Consistent hybrid search
- Simpler maintenance

### Option 2: Adapter Layer

**Action**: Create adapter in `queryProject()` to normalize results.

**Changes**:
1. Detect table type (GitHub vs Crawl4AI)
2. Map column names during query
3. Normalize results to common interface

**Benefits**:
- Preserves existing implementations
- Flexible for future sources

**Drawbacks**:
- More complex query logic
- Potential performance overhead

### Option 3: Separate Retrieval Paths

**Action**: Create dedicated `queryCrawlChunks()` function.

**Changes**:
1. Keep schemas separate
2. Merge results at application layer
3. Handle ranking/scoring differently

**Benefits**:
- Clear separation of concerns
- Optimized for each source

**Drawbacks**:
- Duplicate code
- Complex result merging

## Configuration Reference

### Environment Variables

```bash
# Core Settings
POSTGRES_CONNECTION_STRING=postgresql://...
VECTOR_DATABASE_PROVIDER=postgres  # or 'qdrant'

# Embedding Models
EMBEDDING_PROVIDER=embeddingmonster
STELLA_PORT=30001  # GTE service
CODERANK_PORT=30002  # CodeRank service

# Hybrid Search
ENABLE_HYBRID_SEARCH=true
SPLADE_URL=http://splade-runner:8000
HYBRID_DENSE_WEIGHT=0.6
HYBRID_SPARSE_WEIGHT=0.4

# Reranking
ENABLE_RERANKING=true
RERANKER_URL=http://host.docker.internal:30003
RERANK_INITIAL_K=150
RERANK_FINAL_K=20

# Chunking
CHUNK_CHAR_TARGET=1000
CHUNK_CHAR_OVERLAP=100
CHUNK_BATCH_SIZE=16
MAX_CONCURRENT_BATCHES=1

# Crawl4AI
CRAWL4AI_URL=http://localhost:7070
DEFAULT_SCOPE=local  # global/project/local
```

### Docker Services

```bash
# Start core services
docker compose up postgres qdrant

# Start embedding services (on host)
# - GTE: port 30001
# - CodeRank: port 30002  
# - Reranker: port 30003

# Start SPLADE service
docker compose up splade-runner

# Start Crawl4AI service
docker compose up crawl4ai

# Start API server
docker compose up api-server
```

## Testing Checklist

- [ ] GitHub ingestion with project/dataset
- [ ] Crawl4AI ingestion with project/dataset
- [ ] Unified retrieval across both sources
- [ ] Hybrid search with SPLADE
- [ ] Reranking with cross-encoder
- [ ] Scope isolation (global/project/local)
- [ ] Progress tracking and logging
- [ ] Error handling and recovery

## Next Steps

1. **Immediate**: Document current state (this file) ✅
2. **Short-term**: Choose schema unification approach
3. **Medium-term**: Implement unified retrieval
4. **Long-term**: Add more ingestion sources (PDFs, videos, etc.)

