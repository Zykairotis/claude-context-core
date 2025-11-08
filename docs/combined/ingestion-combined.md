# Combined Files from ingestion

*Generated on: Thu Nov  6 09:52:37 AM EST 2025*

---

## File: INGESTION_ARCHITECTURE.md

**Path:** `INGESTION_ARCHITECTURE.md`

```markdown
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


```

---

## File: INGESTION_FLOW.md

**Path:** `INGESTION_FLOW.md`

```markdown
# Ingestion Flow Diagrams

## GitHub Repository Ingestion Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User / MCP Client                                                      │
│                                                                          │
│  claudeContext.index({                                                   │
│    path: "/path/to/repo",                                                │
│    project: "my-project",                                                │
│    dataset: "backend",                                                   │
│    repo: "org/repo",                                                     │
│    branch: "main"                                                        │
│  })                                                                      │
└─────────────────────┬────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MCP Server (mcp-server.js)                                             │
│  ↓                                                                       │
│  ingestGithubRepository(context, request)                               │
└─────────────────────┬────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Context.indexWithProject()                                              │
│                                                                          │
│  [1] Resolve Project Context                                            │
│      └─> getOrCreateProject() → project_id (UUID)                       │
│      └─> getOrCreateDataset() → dataset_id (UUID)                       │
│                                                                          │
│  [2] Load Ignore Patterns                                               │
│      └─> .gitignore, .contextignore, DEFAULT_IGNORE_PATTERNS            │
│                                                                          │
│  [3] Scan Code Files                                                    │
│      └─> Walk directory tree                                            │
│      └─> Filter by extensions (.ts, .js, .py, etc.)                     │
│      └─> Apply ignore patterns                                          │
│                                                                          │
│  [4] Process Each File                                                  │
│      ┌────────────────────────────────────────────┐                     │
│      │  For each file:                           │                     │
│      │                                           │                     │
│      │  a) Read file content                    │                     │
│      │  b) Detect language from extension       │                     │
│      │  c) Split into chunks                    │                     │
│      │     └─> AstCodeSplitter (tree-sitter)    │                     │
│      │     └─> Default: 1000 chars, 100 overlap │                     │
│      │  d) Add metadata                          │                     │
│      │     └─> filePath, chunkIndex             │                     │
│      │     └─> startLine, endLine               │                     │
│      └────────────────────────────────────────────┘                     │
│                                                                          │
│  [5] Batch Processing (16 chunks per batch, 1 concurrent batch)        │
│      ┌────────────────────────────────────────────┐                     │
│      │  processChunkBatch()                      │                     │
│      │                                           │                     │
│      │  Parallel:                                │                     │
│      │  ┌─────────────────────────────────────┐  │                     │
│      │  │ Dense Embedding (AutoEmbeddingMonster) │                     │
│      │  │ ├─> GTE for text chunks            │  │                     │
│      │  │ └─> CodeRank for code chunks       │  │                     │
│      │  │ Result: 768-dim vectors            │  │                     │
│      │  └─────────────────────────────────────┘  │                     │
│      │  ┌─────────────────────────────────────┐  │                     │
│      │  │ Sparse Vectors (SPLADE)             │  │                     │
│      │  │ └─> http://splade-runner:8000      │  │                     │
│      │  │ Result: {indices: [], values: []}  │  │                     │
│      │  └─────────────────────────────────────┘  │                     │
│      │                                           │                     │
│      │  Create VectorDocument:                   │                     │
│      │  {                                         │                     │
│      │    id: hash(path+line+content),           │                     │
│      │    content: chunk.content,                │                     │
│      │    vector: denseVector,                   │                     │
│      │    sparse: sparseVector,                  │                     │
│      │    relativePath,                          │                     │
│      │    startLine, endLine,                    │                     │
│      │    projectId, datasetId,                  │                     │
│      │    repo, branch, sha,                     │                     │
│      │    lang, fileExtension,                   │                     │
│      │    metadata                               │                     │
│      │  }                                         │                     │
│      └────────────────────────────────────────────┘                     │
└─────────────────────┬────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PostgresDualVectorDatabase.insertHybrid()                              │
│                                                                          │
│  INSERT INTO hybrid_code_chunks_{hash} (                                │
│    id, vector, content, relative_path, start_line, end_line,           │
│    file_extension, project_id, dataset_id, repo, branch, sha,          │
│    lang, sparse_vector, metadata, created_at                           │
│  ) VALUES (...)                                                          │
│                                                                          │
│  Indexes:                                                                │
│  - ivfflat (vector) for similarity search                              │
│  - btree (project_id, dataset_id) for filtering                        │
└─────────────────────────────────────────────────────────────────────────┘

## Crawl4AI Web Content Ingestion Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User / MCP Client                                                      │
│                                                                          │
│  claudeContext.crawl({                                                   │
│    url: "https://docs.example.com",                                      │
│    project: "my-project",                                                │
│    dataset: "documentation",                                             │
│    scope: "local",                                                       │
│    mode: "recursive",                                                    │
│    max_depth: 2                                                          │
│  })                                                                      │
└─────────────────────┬────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MCP Server (mcp-server.js)                                             │
│  ↓                                                                       │
│  POST http://localhost:7070/crawl                                       │
└─────────────────────┬────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Crawl4AI Service (Python FastAPI)                                      │
│                                                                          │
│  [1] Crawling Phase (20-60%)                                            │
│      ┌────────────────────────────────────────────┐                     │
│      │  CrawlingService.orchestrate_crawl()      │                     │
│      │                                           │                     │
│      │  a) Discovery (optional)                 │                     │
│      │     └─> Check for llms.txt, sitemap.xml │                     │
│      │                                           │                     │
│      │  b) Execute Crawl Strategy               │                     │
│      │     ├─> Single: one page                 │                     │
│      │     ├─> Batch: multiple pages            │                     │
│      │     ├─> Recursive: follow links          │                     │
│      │     └─> Sitemap: parse XML               │                     │
│      │                                           │                     │
│      │  c) Playwright Headless Browser          │                     │
│      │     └─> Render JavaScript                │                     │
│      │     └─> Extract readable content         │                     │
│      │     └─> Convert to Markdown              │                     │
│      │                                           │                     │
│      │  Result: List[PageResult]                │                     │
│      │  {                                         │                     │
│      │    url, title,                            │                     │
│      │    markdown_content,                      │                     │
│      │    html_content,                          │                     │
│      │    word_count, char_count,                │                     │
│      │    discovered_links                       │                     │
│      │  }                                         │                     │
│      └────────────────────────────────────────────┘                     │
│                                                                          │
│  [2] Chunking Phase (60-70%)                                            │
│      ┌────────────────────────────────────────────┐                     │
│      │  SmartChunker.chunk_text()                │                     │
│      │                                           │                     │
│      │  For each page:                           │                     │
│      │                                           │                     │
│      │  a) RecursiveTextSplitter                │                     │
│      │     └─> Split into chunks                │                     │
│      │     └─> Default: 1000 chars, 200 overlap │                     │
│      │                                           │                     │
│      │  b) CodeDetector (tree-sitter)           │                     │
│      │     └─> Detect code vs text              │                     │
│      │     └─> Identify language                │                     │
│      │     └─> Confidence score                 │                     │
│      │                                           │                     │
│      │  c) Model Routing                        │                     │
│      │     ├─> is_code=true → model='coderank'  │                     │
│      │     └─> is_code=false → model='gte'      │                     │
│      │                                           │                     │
│      │  Result: List[Chunk]                     │                     │
│      │  {                                         │                     │
│      │    text, is_code, language,               │                     │
│      │    start_char, end_char,                  │                     │
│      │    chunk_index, confidence,               │                     │
│      │    source_path, model_hint                │                     │
│      │  }                                         │                     │
│      └────────────────────────────────────────────┘                     │
│                                                                          │
│  [3] Summarization Phase (70-80%)                                       │
│      ┌────────────────────────────────────────────┐                     │
│      │  MiniMaxSummaryProvider.summarize()      │                     │
│      │                                           │                     │
│      │  For each chunk:                          │                     │
│      │  └─> LLM API call                         │                     │
│      │  └─> Model: MiniMax-M2                    │                     │
│      │  └─> Max length: 200 chars                │                     │
│      │                                           │                     │
│      │  Result: List[str] (summaries)           │                     │
│      └────────────────────────────────────────────┘                     │
│                                                                          │
│  [4] Embedding Phase (80-92%)                                           │
│      ┌────────────────────────────────────────────┐                     │
│      │  EmbeddingMonsterClient.embed_batch()    │                     │
│      │                                           │                     │
│      │  Route by model_hint:                     │                     │
│      │  ├─> GTE chunks                           │                     │
│      │  │   └─> POST http://host.docker.internal:30001/embed │         │
│      │  └─> CodeRank chunks                      │                     │
│      │      └─> POST http://host.docker.internal:30002/embed │         │
│      │                                           │                     │
│      │  Batch size: 32 chunks                    │                     │
│      │  Result: 768-dimensional vectors          │                     │
│      └────────────────────────────────────────────┘                     │
│                                                                          │
│  [5] Storage Phase (92-98%)                                             │
│      ┌────────────────────────────────────────────┐                     │
│      │  PostgresVectorStore.insert_chunks()     │                     │
│      │                                           │                     │
│      │  a) Resolve Scope                        │                     │
│      │     └─> ScopeManager.resolve_scope()     │                     │
│      │     └─> ScopeManager.get_collection_name()│                     │
│      │                                           │                     │
│      │  b) Create Collection (if not exists)    │                     │
│      │     └─> Table: chunks_{collection_name}  │                     │
│      │                                           │                     │
│      │  c) Create StoredChunk objects           │                     │
│      │     {                                      │                     │
│      │       id: UUID,                           │                     │
│      │       chunk_text: text,                   │                     │
│      │       summary: summary,                   │                     │
│      │       vector: embedding,                  │                     │
│      │       is_code: boolean,                   │                     │
│      │       language: string,                   │                     │
│      │       relative_path: url,                 │                     │
│      │       chunk_index,                        │                     │
│      │       start_char, end_char,               │                     │
│      │       model_used: 'gte'/'coderank',       │                     │
│      │       project_id: UUID,                   │                     │
│      │       dataset_id: UUID,                   │                     │
│      │       scope: 'global'/'project'/'local',  │                     │
│      │       metadata: JSON                      │                     │
│      │     }                                      │                     │
│      │                                           │                     │
│      │  d) Batch Insert                          │                     │
│      │     └─> INSERT INTO chunks_...           │                     │
│      │     └─> Batch size: 100 chunks           │                     │
│      └────────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘

## Unified Retrieval Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User / MCP Client                                                      │
│                                                                          │
│  claudeContext.search({                                                  │
│    query: "how to authenticate users",                                   │
│    project: "my-project",                                                │
│    dataset: "backend",                                                   │
│    topK: 10                                                              │
│  })                                                                      │
└─────────────────────┬────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  queryProject() in src/api/query.ts                                     │
│                                                                          │
│  [1] Resolve Project & Datasets                                         │
│      └─> Get project_id from project name                               │
│      └─> Get accessible dataset_ids                                     │
│           (includes global if includeGlobal=true)                       │
│                                                                          │
│  [2] Generate Query Vectors                                             │
│      Parallel:                                                           │
│      ┌─────────────────────────────────────┐                            │
│      │ Dense Embedding                     │                            │
│      │ └─> embedding.embed(query)          │                            │
│      │ Result: 768-dim vector              │                            │
│      └─────────────────────────────────────┘                            │
│      ┌─────────────────────────────────────┐                            │
│      │ Sparse Vector (if hybrid enabled)   │                            │
│      │ └─> spladeClient.computeSparse(query)│                           │
│      │ Result: {indices, values}           │                            │
│      └─────────────────────────────────────┘                            │
│                                                                          │
│  [3] Search Vector Database                                             │
│      ┌────────────────────────────────────────────┐                     │
│      │  For each collection:                     │                     │
│      │                                           │                     │
│      │  If hybrid enabled:                       │                     │
│      │    ├─> vectorDb.hybridQuery()             │                     │
│      │    │   (combines dense + sparse scores)   │                     │
│      │    └─> Use RRF fusion                     │                     │
│      │  Else:                                     │                     │
│      │    └─> vectorDb.search()                  │                     │
│      │       (dense only)                        │                     │
│      │                                           │                     │
│      │  Filters:                                  │                     │
│      │  - dataset_ids IN (...)                   │                     │
│      │  - project_id = X (if not "all")          │                     │
│      │  - repo = Y (optional)                    │                     │
│      │  - lang = Z (optional)                    │                     │
│      │  - path prefix (optional)                 │                     │
│      │                                           │                     │
│      │  Initial K: 150 (if rerank enabled)       │                     │
│      │  Final K: 10 (user requested)             │                     │
│      └────────────────────────────────────────────┘                     │
│                                                                          │
│  [4] Reranking (if enabled)                                             │
│      ┌────────────────────────────────────────────┐                     │
│      │  RerankerClient.rerank()                  │                     │
│      │                                           │                     │
│      │  └─> Cross-encoder model                  │                     │
│      │  └─> http://host.docker.internal:30003   │                     │
│      │  └─> Limit: 20 candidates                 │                     │
│      │  └─> Max text: 4000 chars per chunk       │                     │
│      │                                           │                     │
│      │  Re-score and re-rank results             │                     │
│      └────────────────────────────────────────────┘                     │
│                                                                          │
│  [5] Return Results                                                     │
│      {                                                                   │
│        requestId: UUID,                                                 │
│        results: [                                                       │
│          {                                                               │
│            id, chunk, file, lineSpan,                                   │
│            scores: {                                                    │
│              vector: 0.85,                                              │
│              sparse: 0.75,                                              │
│              rerank: 0.92,                                              │
│              final: 0.92                                                │
│            },                                                            │
│            projectId, datasetId, repo, lang                             │
│          }                                                               │
│        ],                                                                │
│        metadata: {                                                      │
│          retrievalMethod: 'hybrid+rerank',                              │
│          featuresUsed: { hybridSearch, reranking },                     │
│          timingMs: { embedding, search, reranking, total }              │
│        }                                                                 │
│      }                                                                   │
└─────────────────────────────────────────────────────────────────────────┘

## Current Issue: Schema Mismatch

┌─────────────────────────────────────────────────────────────────────────┐
│  GitHub Chunks Table                                                    │
│  Table: hybrid_code_chunks_{hash}                                       │
│                                                                          │
│  ✓ vector (dense 768d)                                                  │
│  ✓ sparse_vector (JSONB)                                                │
│  ✓ content (full text)                                                  │
│  ✓ start_line, end_line                                                 │
│  ✓ project_id, dataset_id                                               │
│  ✓ repo, branch, sha                                                    │
│  ✓ lang, file_extension                                                 │
│  ✗ summary (not stored)                                                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Crawl4AI Chunks Table                                                  │
│  Table: chunks_{scope_collection_name}                                  │
│                                                                          │
│  ✓ vector (dense 768d)                                                  │
│  ✗ sparse_vector (not implemented)                                      │
│  ✓ chunk_text (full text)                                               │
│  ✓ summary (AI-generated)                                               │
│  ✓ start_char, end_char (not lines!)                                    │
│  ✓ project_id, dataset_id                                               │
│  ✓ scope (global/project/local)                                         │
│  ✓ is_code, language                                                    │
│  ✗ repo, branch, sha (not applicable)                                   │
└─────────────────────────────────────────────────────────────────────────┘

Impact on queryProject():
- Expects columns: content, start_line, end_line, sparse_vector
- Crawl4AI has: chunk_text, start_char, end_char, no sparse_vector
- Result: SQL queries fail or return inconsistent data
```


```

---

## File: INGESTION_STATUS_SUMMARY.md

**Path:** `INGESTION_STATUS_SUMMARY.md`

```markdown
# Claude Context Ingestion Status Summary

**Date**: November 3, 2025  
**Author**: Claude (AI Assistant)

## Executive Summary

### ✅ What Works

1. **GitHub Repository Ingestion** - FULLY WORKING
   - Entry point: `ingestGithubRepository()` via MCP server
   - Pipeline: scan → chunk → embed → store
   - Storage: PostgreSQL with pgvector (dense) + SPLADE (sparse)
   - Retrieval: `queryProject()` with hybrid search + reranking
   - **Status**: Production-ready, actively used

2. **Crawl4AI Web Crawling** - WORKING  
   - Service: Python FastAPI on port 7070
   - Features: headless browser, markdown conversion, code detection
   - **Status**: Crawling and content extraction works

3. **Crawl4AI Processing Pipeline** - WORKING
   - Chunking: SmartChunker with tree-sitter code detection
   - Summarization: MiniMax LLM generates summaries
   - Embedding: Routes to GTE (text) or CodeRank (code)
   - **Status**: All processing stages complete successfully

4. **Basic Retrieval** - WORKING
   - Test file: `test-working-retrieval.js`
   - Works for GitHub-indexed repositories
   - Uses local EmbeddingMonster services
   - **Status**: Confirmed working with test results

### ⚠️ What's Missing

1. **Unified Retrieval for Crawl4AI Chunks** - NOT IMPLEMENTED
   - **Problem**: Different database schemas between GitHub and Crawl4AI
   - **Impact**: `queryProject()` can't query Crawl4AI chunks
   - **Status**: CRITICAL GAP

2. **Hybrid Search for Web Content** - NOT IMPLEMENTED
   - **Problem**: Crawl4AI doesn't generate SPLADE sparse vectors
   - **Impact**: Web content doesn't benefit from hybrid ranking
   - **Status**: Missing feature

3. **Schema Alignment** - NOT ALIGNED
   - **Problem**: Column names, types, and table structure differ
   - **Impact**: Can't write unified query logic
   - **Status**: Requires architecture decision

## Detailed Analysis

### GitHub Ingestion Architecture

```
User Request
    ↓
MCP Server (mcp-server.js)
    ↓
ingestGithubRepository() 
    ↓
Context.indexWithProject()
    ├─> 1. Resolve project/dataset IDs in PostgreSQL
    ├─> 2. Scan files (.ts, .js, .py, etc.)
    ├─> 3. Chunk with AstCodeSplitter (tree-sitter)
    ├─> 4. Generate embeddings (AutoEmbeddingMonster)
    │   ├─> Dense: GTE (text) or CodeRank (code)  [768d]
    │   └─> Sparse: SPLADE service               [variable]
    └─> 5. Store in hybrid_code_chunks_{hash}

Storage Schema (PostgreSQL):
- id, vector (768d dense)
- content (full text)
- start_line, end_line
- sparse_vector (JSONB)
- project_id, dataset_id (UUID)
- repo, branch, sha
- lang, file_extension
- metadata (JSONB)

Retrieval: queryProject()
- Filters by: project_id, dataset_id, repo, lang
- Hybrid search: combines dense + sparse scores (RRF fusion)
- Reranking: cross-encoder for top 20 candidates
- Returns: scored chunks with full metadata
```

### Crawl4AI Ingestion Architecture

```
User Request
    ↓
MCP Server (mcp-server.js)
    ↓
POST http://localhost:7070/crawl
    ↓
Crawl4AI Service (Python FastAPI)
    ├─> 1. Crawl pages (Playwright headless browser)
    ├─> 2. Convert HTML to Markdown
    ├─> 3. Chunk with SmartChunker
    │   ├─> RecursiveTextSplitter (1000 chars, 200 overlap)
    │   └─> CodeDetector (tree-sitter) → is_code flag
    ├─> 4. Summarize chunks (MiniMax LLM)
    ├─> 5. Generate embeddings (EmbeddingMonsterClient)
    │   ├─> GTE for text (is_code=false)
    │   └─> CodeRank for code (is_code=true)
    └─> 6. Store in chunks_{scope_collection}

Storage Schema (PostgreSQL):
- id, vector (768d dense)
- chunk_text (full text)
- summary (AI-generated)
- start_char, end_char
- is_code, language
- project_id, dataset_id (UUID)
- scope (global/project/local)
- model_used (gte/coderank)
- metadata (JSONB)

Retrieval: ???
- Currently: Direct SQL queries in crawl4ai service
- Missing: Integration with queryProject()
- Gap: No hybrid search or reranking
```

## Schema Comparison

| Feature | GitHub Chunks | Crawl4AI Chunks |
|---------|--------------|-----------------|
| **Table Name** | `hybrid_code_chunks_{hash}` | `chunks_{scope_collection}` |
| **Content Field** | `content` | `chunk_text` |
| **Position** | `start_line`, `end_line` | `start_char`, `end_char` |
| **Dense Vector** | ✅ `vector(768)` | ✅ `vector(768)` |
| **Sparse Vector** | ✅ `sparse_vector` (JSONB) | ❌ Not implemented |
| **Summary** | ❌ Not stored | ✅ `summary` (TEXT) |
| **Code Detection** | ❌ Implicit (by extension) | ✅ `is_code` (BOOLEAN) |
| **Provenance** | `repo`, `branch`, `sha` | N/A (web content) |
| **Scope** | N/A | `scope` (global/project/local) |
| **Model Tracking** | Implicit | ✅ `model_used` (gte/coderank) |

## Critical Issues

### Issue 1: Schema Incompatibility

**Description**: GitHub and Crawl4AI use different column names and data types.

**Examples**:
- Content: `content` vs `chunk_text`
- Position: `start_line`/`end_line` vs `start_char`/`end_char`
- Missing fields: No `sparse_vector` in Crawl4AI, no `summary` in GitHub

**Impact**:
- `queryProject()` expects specific column names
- Can't write unified SQL queries without adapter
- Hybrid search won't work on Crawl4AI chunks
- Result formatting will fail

**Solution Options**:

1. **Option A: Unify Schemas** (RECOMMENDED)
   - Modify Crawl4AI to match GitHub schema
   - Rename `chunk_text` → `content`
   - Calculate `start_line`/`end_line` from char positions
   - Add SPLADE sparse vector generation
   - Use same table naming convention
   - Store `summary` in metadata JSON
   
   **Pros**: Clean, maintainable, enables unified retrieval
   **Cons**: Requires Crawl4AI service changes

2. **Option B: Adapter Layer**
   - Keep both schemas as-is
   - Add schema detection in `queryProject()`
   - Map column names during queries
   - Normalize results in application layer
   
   **Pros**: Preserves existing implementations
   **Cons**: Complex, performance overhead, error-prone

3. **Option C: Separate Retrieval**
   - Create `queryCrawlChunks()` function
   - Keep GitHub and Crawl4AI completely separate
   - Merge results at API layer
   
   **Pros**: Clear separation, optimized per source
   **Cons**: Code duplication, complex merging

### Issue 2: Missing Hybrid Search for Web Content

**Description**: Crawl4AI chunks don't have SPLADE sparse vectors.

**Impact**:
- Web content uses only dense embeddings
- Misses lexical/keyword matching benefits
- Lower quality results for keyword-heavy queries
- Inconsistent retrieval quality across sources

**Solution**:
- Integrate SPLADE service into Crawl4AI pipeline
- Generate sparse vectors during embedding phase
- Store in `sparse_vector` JSONB column
- Enable hybrid query mode in retrieval

### Issue 3: Collection Discovery

**Description**: `queryProject()` doesn't know about Crawl4AI tables.

**Current Logic**:
```typescript
// queryProject() looks for collections named:
const collectionName = context.getCollectionName(codebasePath);
// e.g., hybrid_code_chunks_a1b2c3d4

// But Crawl4AI creates:
// chunks_project_{project}_dataset_{dataset}
// These aren't discovered!
```

**Solution**:
- List all collections matching patterns
- Query both GitHub and Crawl4AI collections
- Aggregate results by document ID
- Rank combined results

## Recommendations

### Immediate Actions (Priority 1)

1. **Schema Unification** ✅ RECOMMENDED APPROACH
   - Modify `postgres_store.py` in crawl4ai-runner
   - Match column names to GitHub schema
   - Add sparse vector generation
   - Test round-trip ingestion

2. **Collection Registration**
   - Add crawl4ai collections to collection list
   - Update `queryProject()` to discover all collections
   - Test cross-source retrieval

3. **Integration Testing**
   - Index GitHub repo: `claude-context-core`
   - Crawl web docs: `https://docs.python.org/3/`
   - Query both: "how to handle errors"
   - Verify unified results

### Short-term Improvements (Priority 2)

4. **SPLADE Integration**
   - Add sparse vector generation to Crawl4AI
   - Call SPLADE service after dense embedding
   - Store in same JSONB format as GitHub
   - Enable hybrid search

5. **Scope-aware Retrieval**
   - Support global/project/local filtering
   - Add scope to GitHub chunks (default: 'local')
   - Unified scope query logic

6. **Result Quality**
   - Add reranking for Crawl4AI results
   - Cross-encoder scoring
   - Consistent ranking across sources

### Long-term Enhancements (Priority 3)

7. **Monitoring & Observability**
   - Track ingestion metrics per source
   - Retrieval latency by collection type
   - Quality metrics (click-through, relevance)

8. **Performance Optimization**
   - Batch processing for large crawls
   - Connection pooling
   - Query result caching

9. **Additional Sources**
   - PDF documents
   - Video transcripts
   - Slack/Discord archives
   - Email threads

## Implementation Plan

### Phase 1: Schema Alignment (Est. 4-6 hours)

**Tasks**:
1. Update `PostgresVectorStore` schema in `postgres_store.py`
2. Rename columns: `chunk_text` → `content`, etc.
3. Add `sparse_vector` JSONB column
4. Update insert logic to match GitHub format
5. Add `start_line`/`end_line` calculation from char positions
6. Store `summary` in `metadata->summary`

**Files to Modify**:
- `services/crawl4ai-runner/app/storage/postgres_store.py`
- `services/crawl4ai-runner/app/services/crawling_service.py`

**Testing**:
- Crawl a sample page
- Verify schema matches GitHub format
- Check all columns populated correctly

### Phase 2: SPLADE Integration (Est. 2-3 hours)

**Tasks**:
1. Add SPLADE client to Crawl4AI
2. Generate sparse vectors after dense embeddings
3. Store in `sparse_vector` JSONB column
4. Test hybrid retrieval

**Files to Modify**:
- `services/crawl4ai-runner/app/services/crawling_service.py`
- Add `splade_client.py` similar to TypeScript version

**Testing**:
- Verify sparse vectors generated
- Check format matches GitHub sparse vectors
- Test hybrid query

### Phase 3: Unified Retrieval (Est. 3-4 hours)

**Tasks**:
1. Update `queryProject()` to discover both collection types
2. Query GitHub and Crawl4AI collections
3. Merge and rank results
4. Test cross-source queries

**Files to Modify**:
- `src/api/query.ts`
- `src/vectordb/postgres-dual-vectordb.ts`

**Testing**:
- Index GitHub repo
- Crawl web pages
- Query across both
- Verify results ranked correctly

## Testing Checklist

### GitHub Ingestion
- [x] Index repository via MCP
- [x] Verify chunks in database
- [x] Search and retrieve results
- [x] Hybrid search works
- [x] Reranking improves results

### Crawl4AI Ingestion
- [x] Crawl web pages
- [x] Chunks stored in database
- [ ] Schema matches GitHub format
- [ ] Sparse vectors generated
- [ ] Basic retrieval works

### Unified Retrieval
- [ ] Query across both sources
- [ ] Results from GitHub
- [ ] Results from Crawl4AI
- [ ] Consistent ranking
- [ ] Correct metadata
- [ ] Scope filtering works
- [ ] Reranking improves quality

## Environment Setup

### Required Services

```bash
# PostgreSQL with pgvector
docker compose up postgres

# Qdrant (optional, if using instead of Postgres)
docker compose up qdrant

# Embedding services (on host)
# Terminal 1: GTE service (port 30001)
# Terminal 2: CodeRank service (port 30002)

# SPLADE service (hybrid search)
docker compose up splade-runner

# Reranker service (on host, port 30003)

# Crawl4AI service
docker compose up crawl4ai

# API server (optional, for HTTP API)
docker compose up api-server
```

### Environment Variables

```bash
# Core
POSTGRES_CONNECTION_STRING=postgresql://postgres:password@localhost:5533/claude_context
VECTOR_DATABASE_PROVIDER=postgres

# Embeddings
EMBEDDING_PROVIDER=embeddingmonster
STELLA_PORT=30001
CODERANK_PORT=30002

# Hybrid Search
ENABLE_HYBRID_SEARCH=true
SPLADE_URL=http://localhost:30004

# Reranking
ENABLE_RERANKING=true
RERANKER_URL=http://localhost:30003
RERANK_INITIAL_K=150
RERANK_FINAL_K=20

# Crawl4AI
CRAWL4AI_URL=http://localhost:7070
DEFAULT_SCOPE=local
```

## Usage Examples

### Index GitHub Repository

```typescript
const { Context, AutoEmbeddingMonster, PostgresDualVectorDatabase, Pool } = require('./dist/index.js');

const pool = new Pool({
  connectionString: 'postgresql://postgres:password@localhost:5533/claude_context'
});

const context = new Context({
  embedding: new AutoEmbeddingMonster(),
  vectorDatabase: new PostgresDualVectorDatabase({ connectionString: '...' }),
  postgresPool: pool
});

// Index with project awareness
const result = await context.indexWithProject(
  '/path/to/repo',
  'my-project',
  'backend',
  {
    repo: 'org/repo',
    branch: 'main',
    onProgress: (p) => console.log(`${p.phase}: ${p.percentage}%`)
  }
);

console.log(`Indexed ${result.indexedFiles} files, ${result.totalChunks} chunks`);
```

### Crawl Web Content

```bash
curl -X POST http://localhost:7070/crawl \
  -H 'Content-Type: application/json' \
  -d '{
    "urls": ["https://docs.python.org/3/tutorial/"],
    "project": "my-project",
    "dataset": "python-docs",
    "scope": "local",
    "mode": "recursive",
    "max_depth": 2,
    "max_pages": 50
  }'

# Returns: { "progress_id": "abc123", "status": "running" }

# Check progress
curl http://localhost:7070/progress/abc123
```

### Search Across Both Sources

```typescript
const { queryProject } = require('./dist/api/query.js');

const results = await queryProject(context, {
  project: 'my-project',
  query: 'how to handle exceptions',
  topK: 10,
  includeGlobal: true
});

console.log(`Found ${results.results.length} results:`);
results.results.forEach(r => {
  console.log(`${r.file}:${r.lineSpan.start} (score: ${r.scores.final})`);
  console.log(r.chunk.substring(0, 200));
});
```

## Next Steps

1. **User Decision Required**: Choose schema alignment approach
   - Option A (recommended): Unify schemas
   - Option B: Adapter layer
   - Option C: Separate retrieval

2. **Implementation**: Once decision made, proceed with Phase 1-3

3. **Testing**: Comprehensive end-to-end tests

4. **Documentation**: Update user guides with examples

## Conclusion

**Current State**: 
- GitHub ingestion: ✅ Production-ready
- Crawl4AI ingestion: ⚠️ Partially working (no unified retrieval)
- Retrieval: ✅ Works for GitHub, ❌ Not integrated with Crawl4AI

**Critical Gap**: Schema mismatch prevents unified retrieval

**Recommended Fix**: Schema unification (Option A) - cleanest and most maintainable

**Timeline**: 9-13 hours of development work across 3 phases

**Risk**: Low - changes are isolated to Crawl4AI service and query logic

**Value**: High - enables true unified semantic search across code and documentation


```

---

