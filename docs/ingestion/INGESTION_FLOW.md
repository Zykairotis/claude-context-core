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

