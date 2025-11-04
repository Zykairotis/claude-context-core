# Todo 1: Architecture Analysis - GitHub Ingestion Deep Dive

**Status:** 📋 Planning  
**Complexity:** High  
**Estimated Time:** 8-12 hours  
**Dependencies:** None

---

## Objective

Thoroughly analyze the GitHub ingestion pipeline to document all features, data flows, and integration points that must be replicated for Crawl4AI web ingestion.

---

## GitHub Ingestion Architecture

### High-Level Flow

```
┌─────────────────┐
│  MCP Server     │ claudeContext.index
│  Tool Handler   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  ingestGithubRepository()           │
│  src/api/ingest.ts                  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Context.indexWithProject()         │
│  src/context.ts:250-350             │
│                                     │
│  ┌──────────────────────────┐      │
│  │ 1. Merkle Tree Check     │      │
│  │ 2. File Discovery        │      │
│  │ 3. AST Code Splitting    │      │
│  │ 4. Symbol Extraction     │      │
│  │ 5. Batch Embedding       │      │
│  │ 6. SPLADE Sparse Gen     │      │
│  │ 7. Vector Storage        │      │
│  └──────────────────────────┘      │
└────────┬────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  PostgreSQL / Qdrant                 │
│  - Dense vectors (pgvector/qdrant)  │
│  - Sparse vectors (qdrant named)    │
│  - Project/dataset metadata         │
│  - Symbol metadata (name, kind)     │
└──────────────────────────────────────┘
```

---

## Component Analysis

### 1. Entry Point: `ingestGithubRepository()`

**File:** `src/api/ingest.ts:77-120`

```typescript
export async function ingestGithubRepository(
  context: Context,
  request: GithubIngestRequest
): Promise<GithubIngestResponse>
```

**Responsibilities:**
- Generate unique job ID
- Resolve dataset name from repo
- Call `Context.indexWithProject()`
- Wrap response in job format
- Handle errors gracefully

**Key Features:**
- Progress callbacks for real-time updates
- Force reindex flag support
- Automatic dataset name derivation
- Standardized response format

**Provenance Data:**
```typescript
{
  repo: 'owner/repo',
  branch: 'main',
  sha: 'abc123def'
}
```

---

### 2. Core Engine: `Context.indexWithProject()`

**File:** `src/context.ts:250-350`

#### Phase Breakdown

**Phase 1: Project Setup (5%)**
```typescript
const { projectId, projectName, datasetId, datasetName } = 
  await this.ensureProjectDataset(pool, project, dataset);
```
- Creates or retrieves project UUID
- Creates or retrieves dataset UUID
- Links dataset to project in PostgreSQL

**Phase 2: Merkle Snapshot (10%)**
```typescript
const synchronizer = this.getSynchronizer(codebasePath);
await synchronizer.createSnapshot(codebasePath);
```
- Computes SHA-256 hash of each file
- Builds Merkle tree from file hashes
- Stores snapshot in `~/.context/merkle/`
- Enables incremental reindexing later

**Phase 3: Collection Preparation (15%)**
```typescript
await this.prepareCollection(codebasePath, forceReindex);
```
- Detects embedding dimension (e.g., 1536 for OpenAI)
- Creates hybrid or regular collection
- Sets up indexes for filtering

**Phase 4: File Discovery (20%)**
```typescript
const filePaths = await this.getCodeFiles(codebasePath);
```
- Recursively traverses directory
- Applies ignore patterns (node_modules, .git, etc.)
- Filters by supported extensions
- Returns absolute paths

**Phase 5: Chunking & Processing (25-80%)**
```typescript
for (const filePath of filePaths) {
  const chunks = await this.codeSplitter.splitFile(filePath, language);
  
  // Symbol extraction per chunk
  for (const chunk of chunks) {
    if (shouldExtractSymbols) {
      chunk.symbolName = extractSymbolName(chunk);
      chunk.symbolKind = extractSymbolKind(chunk);
    }
  }
  
  chunkBuffer.push(...chunks);
  
  if (chunkBuffer.length >= BATCH_SIZE) {
    await this.processChunkBuffer(chunkBuffer);
    chunkBuffer = [];
  }
}
```

**Chunk Buffer Processing:**
```typescript
private async processChunkBuffer(chunks: CodeChunk[]): Promise<void> {
  // Parallel embedding generation
  const [denseVectors, sparseVectors] = await Promise.all([
    this.embedding.embedBatch(chunks.map(c => c.content)),
    this.spladeClient?.computeSparseBatch(chunks.map(c => c.content))
  ]);
  
  // Store in vector database
  await this.vectorDatabase.upsertBatch(collectionName, {
    vectors: denseVectors,
    sparseVectors: sparseVectors,
    documents: chunks.map((chunk, i) => ({
      id: generateChunkId(),
      content: chunk.content,
      relativePath: chunk.relativePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      language: chunk.language,
      projectId,
      datasetId,
      symbolName: chunk.symbolName,
      symbolKind: chunk.symbolKind
    }))
  });
}
```

**Phase 6: Completion (100%)**
- Returns statistics
- Logs summary

---

### 3. Code Splitting: `AstCodeSplitter`

**File:** `src/splitter/ast-splitter.ts`

**Tree-Sitter Languages:**
- TypeScript/JavaScript
- Python
- Java, C++, C#, Go, Rust, Scala
- Ruby, PHP, Swift, Kotlin

**Splitting Strategy:**
```typescript
splitFile(filePath: string, language: string): CodeChunk[] {
  const tree = this.parser.parse(fileContent);
  
  // Find splittable nodes (functions, classes, methods)
  const nodes = this.findSplittableNodes(tree.rootNode, language);
  
  // Extract symbol metadata
  for (const node of nodes) {
    const symbolName = this.extractSymbolName(node, language);
    const symbolKind = this.mapNodeTypeToKind(node.type);
    
    chunks.push({
      content: node.text,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      language,
      symbolName,
      symbolKind
    });
  }
  
  // Character-based fallback for non-splittable content
  if (chunks.length === 0) {
    return this.langchainFallback.splitText(fileContent);
  }
  
  return chunks;
}
```

**Symbol Extraction:**
```typescript
// Node types mapped to symbol kinds
function_declaration -> 'function'
class_declaration -> 'class'
method_definition -> 'method'
interface_declaration -> 'interface'
type_alias_declaration -> 'type'
```

**Character Limits:**
- Target: 1000 chars (~250 tokens)
- Overlap: 100 chars
- Max: 4000 chars (hard limit)

---

### 4. Embedding Generation

**File:** `src/embedding/openai-embedding.ts` (example)

**Batch Processing:**
```typescript
async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
  const response = await this.client.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    dimensions: 1536
  });
  
  return response.data.map(item => ({
    vector: item.embedding,
    model: this.model
  }));
}
```

**Throughput Optimization:**
- Batch size: 100-200 texts
- Parallel requests: 2-4 concurrent
- Retry logic with exponential backoff
- Rate limiting awareness

---

### 5. SPLADE Sparse Vector Generation

**File:** `src/utils/splade-client.ts`

**Service Endpoint:** `http://localhost:30004`

**Batch Request:**
```typescript
async computeSparseBatch(texts: string[]): Promise<SparseVector[]> {
  const response = await fetch(`${this.baseUrl}/sparse/batch`, {
    method: 'POST',
    body: JSON.stringify({ batch: texts })
  });
  
  const { sparse_vectors } = await response.json();
  
  return sparse_vectors; // Array of {indices: number[], values: number[]}
}
```

**Fallback Behavior:**
- If SPLADE unavailable: Continue with dense-only
- If timeout: Retry up to 3 times
- If all endpoints fail: Disable hybrid mode

**Environment Control:**
```bash
ENABLE_HYBRID_SEARCH=true
SPLADE_URL=http://localhost:30004
SPLADE_FALLBACK_URLS=http://host.docker.internal:30004,http://splade-runner:8000
SPLADE_MAX_RETRIES=3
SPLADE_RETRY_DELAY_MS=1000
```

---

### 6. Vector Storage: PostgreSQL/Qdrant

#### PostgreSQL Dual-Vector Storage

**File:** `src/vectordb/postgres-dual-vectordb.ts`

**Table Schema:**
```sql
CREATE TABLE claude_context.vectors_{collection} (
  id TEXT PRIMARY KEY,
  vector vector(1536),           -- pgvector dense
  sparse_vector jsonb,            -- SPLADE {indices, values}
  content TEXT,
  relative_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  language TEXT,
  project_id UUID,
  dataset_id UUID,
  repo TEXT,
  branch TEXT,
  sha TEXT,
  symbol_name TEXT,
  symbol_kind TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vectors_dense ON vectors_{collection} 
  USING ivfflat (vector vector_cosine_ops);
  
CREATE INDEX idx_vectors_project ON vectors_{collection} (project_id);
CREATE INDEX idx_vectors_dataset ON vectors_{collection} (dataset_id);
CREATE INDEX idx_vectors_symbol ON vectors_{collection} (symbol_name);
```

**Hybrid Search:**
```typescript
async hybridQuery(
  collection: string,
  denseVector: number[],
  sparseVector: SparseVector,
  options: SearchOptions
): Promise<VectorSearchResult[]> {
  // RRF (Reciprocal Rank Fusion)
  const denseResults = await this.denseSearch(collection, denseVector, options);
  const sparseResults = await this.sparseSearch(collection, sparseVector, options);
  
  return this.fuseResults(denseResults, sparseResults, {
    denseWeight: 0.6,
    sparseWeight: 0.4
  });
}
```

#### Qdrant Named Vectors

**File:** `src/vectordb/qdrant-vectordb.ts`

**Collection Schema:**
```typescript
await this.client.createCollection(collectionName, {
  vectors: {
    dense: { size: 1536, distance: 'Cosine' },
    sparse: { 
      modifier: 'idf',
      on_disk: false
    }
  }
});
```

**Hybrid Query:**
```typescript
const results = await this.client.query(collectionName, {
  prefetch: [
    {
      query: denseVector,
      using: 'dense',
      limit: 100
    },
    {
      query: sparseVector,
      using: 'sparse',
      limit: 100
    }
  ],
  query: { fusion: 'rrf' },
  limit: topK,
  filter: {
    must: [
      { key: 'projectId', match: { value: projectId }},
      { key: 'datasetId', match: { any: datasetIds }}
    ]
  }
});
```

---

### 7. Project-Aware Metadata

**PostgreSQL Schema:**
```sql
-- Projects table
CREATE TABLE claude_context.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Datasets table
CREATE TABLE claude_context.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES claude_context.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Shares table (global dataset access)
CREATE TABLE claude_context.shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES claude_context.datasets(id) ON DELETE CASCADE,
  target_project_id UUID REFERENCES claude_context.projects(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dataset_id, target_project_id)
);
```

**Access Control Logic:**
```typescript
async getAccessibleDatasets(
  client: PoolClient,
  projectId: string,
  includeGlobal: boolean = true
): Promise<string[]> {
  const query = `
    SELECT DISTINCT d.id
    FROM claude_context.datasets d
    WHERE d.project_id = $1
       OR (d.is_global = true AND $2 = true)
       OR EXISTS (
         SELECT 1 FROM claude_context.shares s
         WHERE s.dataset_id = d.id
           AND s.target_project_id = $1
       )
  `;
  
  const result = await client.query(query, [projectId, includeGlobal]);
  return result.rows.map(row => row.id);
}
```

---

## Retrieval Pipeline Features

### 1. Hybrid Search with RRF

**File:** `src/api/query.ts:294-350`

```typescript
// Parallel dense + sparse search
const [hybridResults, denseResults] = await Promise.all([
  vectorDb.hybridQuery(collection, denseVector, sparseVector, {
    topK: initialK,
    threshold,
    filter: { projectId, datasetIds }
  }),
  vectorDb.search(collection, denseVector, {
    topK: initialK,
    threshold,
    filter: { projectId, datasetIds }
  })
]);

// Combine with score breakdown
const combined = hybridResults.map(result => ({
  document: result.document,
  score: result.score,           // Hybrid RRF score
  vectorScore: denseMap.get(result.document.id) ?? result.score,
  sparseScore: result.score
}));
```

---

### 2. Cross-Encoder Reranking

**File:** `src/api/query.ts:420-480`

**Service:** TEI (Text Embeddings Inference) on port 30003  
**Model:** BAAI/bge-reranker-v2-m3

```typescript
if (rerankEnabled && rerankerClient) {
  onProgress?.('query', 85, 'Reranking results');
  
  const candidateTexts = searchResults.map(result => 
    buildRerankText(result.document, maxChars)
  );
  
  const scores = await rerankerClient.rerank(query, candidateTexts);
  
  // Attach rerank scores
  searchResults.forEach((result, i) => {
    result.rerankScore = scores[i];
  });
  
  // Resort by rerank score
  searchResults.sort((a, b) => 
    (b.rerankScore ?? 0) - (a.rerankScore ?? 0)
  );
  
  // Take top K after reranking
  searchResults = searchResults.slice(0, finalK);
}
```

**Configuration:**
```bash
ENABLE_RERANKING=true
RERANKER_URL=http://localhost:30003
RERANK_INITIAL_K=150      # Retrieve 150 candidates
RERANK_FINAL_K=10         # Return top 10 after reranking
RERANK_TEXT_MAX_CHARS=4000
```

---

### 3. Smart LLM Query Enhancement

**File:** `src/api/smart-query.ts`

**Strategies:**
1. **Multi-Query**: Generate 2-3 alternative phrasings
2. **Refinement**: Expand query while keeping intent
3. **Concept Extraction**: Extract key terms/symbols

```typescript
const llmClient = new LLMClient({
  apiKey: process.env.LLM_API_KEY,
  baseUrl: process.env.LLM_API_BASE,
  model: process.env.MODEL_NAME || 'LLM'
});

const enhanced = await llmClient.enhanceQuery(query, [
  'multi-query',
  'refinement',
  'concept-extraction'
]);

// Search with multiple queries
const allResults = await Promise.all([
  queryProject(context, { ...request, query: enhanced.refinedQuery }),
  ...enhanced.variations.map(variant =>
    queryProject(context, { ...request, query: variant })
  )
]);

// Merge and deduplicate
const merged = deduplicateResults(allResults.flat());
```

**Answer Synthesis:**
```typescript
const answer = await llmClient.synthesizeAnswer(
  query,
  merged.results.map(r => ({
    id: r.id,
    content: r.chunk,
    file: r.file,
    lineStart: r.lineSpan.start,
    lineEnd: r.lineSpan.end
  })),
  'conversational' // or 'structured'
);

return {
  results: merged.results,
  smartAnswer: answer.content,
  chunkReferences: answer.chunkReferences
};
```

---

## Key Takeaways for Crawl4AI

### Must Replicate

1. **Context.indexWebPages()** method similar to `indexWithProject()`
2. **AST-aware chunking** for code examples in web content
3. **Batch embedding** with progress callbacks
4. **SPLADE sparse vectors** for hybrid search
5. **Symbol extraction** for functions/classes in docs
6. **Project/dataset isolation** with PostgreSQL metadata
7. **Provenance tracking** (URL, domain, crawl timestamp)

### Can Adapt

1. **File discovery** → URL list from crawler
2. **Merkle tree sync** → Content hash-based change detection
3. **Language detection** → Markdown + code fence detection
4. **Chunk overlap** → May need tuning for prose vs code

### Must Remove from Crawl4AI Service

1. Direct Postgres storage (`postgres_store.py`)
2. Direct Qdrant storage (`qdrant_store.py`)
3. Custom chunking (`smart_chunker.py`)
4. Direct embedding calls (`embedding_monster_client.py`)
5. MiniMax summarization (move to optional LLM synthesis)

---

## Next Steps

Proceed to [02-context-method.md](./02-context-method.md) to design the `Context.indexWebPages()` implementation.

---

**Completion Criteria:**
- ✅ All GitHub features documented
- ✅ Data flows mapped end-to-end
- ✅ Integration points identified
- ✅ Gaps vs Crawl4AI highlighted
