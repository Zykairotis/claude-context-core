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

