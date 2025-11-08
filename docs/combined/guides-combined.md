# Combined Files from guides

*Generated on: Thu Nov  6 09:52:37 AM EST 2025*

---

## File: QUICK_START.md

**Path:** `QUICK_START.md`

```markdown
# Claude Context Quick Start Guide

## TL;DR

**What works**: GitHub ingestion → chunking → embedding → storage → retrieval ✅  
**What's missing**: Crawl4AI ingestion can't be retrieved via unified API ⚠️  
**Why**: Different database schemas between GitHub and Crawl4AI chunks  
**Fix**: Align schemas (recommended) or build adapter layer

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                             │
│          (mcp-server.js on stdio transport)                 │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             ▼                                ▼
  ┌──────────────────────┐        ┌──────────────────────┐
  │  GitHub Ingestion    │        │ Crawl4AI Ingestion   │
  │  ✅ WORKING          │        │ ⚠️  PARTIAL          │
  └──────────┬───────────┘        └──────────┬───────────┘
             │                                │
             │                                │
  ┌──────────▼───────────────────────────────▼───────────┐
  │            PostgreSQL + pgvector                      │
  │                                                       │
  │  GitHub: hybrid_code_chunks_{hash}                   │
  │  Crawl4AI: chunks_{scope_collection}                 │
  │                                                       │
  │  ❌ Schemas don't match → can't unify retrieval      │
  └───────────────────────────────────────────────────────┘
```

## What You Can Do Right Now

### 1. Index a GitHub Repository

```bash
# Via MCP (Claude Desktop or other MCP client)
claudeContext.index({
  "path": "/home/user/my-project",
  "project": "my-project",
  "dataset": "backend",
  "repo": "org/repo",
  "branch": "main"
})

# Result: Indexed 150 files, 3,247 chunks in 2m 35s
```

### 2. Search the Indexed Code

```bash
# Via MCP
claudeContext.search({
  "query": "authentication middleware",
  "project": "my-project",
  "topK": 10
})

# Result: Returns top 10 matching code chunks with scores
```

### 3. Crawl Web Content

```bash
# Via MCP
claudeContext.crawl({
  "url": "https://docs.example.com",
  "project": "my-project",
  "dataset": "docs",
  "mode": "recursive",
  "max_depth": 2
})

# Result: Crawled 25 pages, stored 487 chunks
```

### 4. What Doesn't Work Yet

```bash
# This WILL NOT work because crawl4ai chunks aren't discoverable
claudeContext.search({
  "query": "how to configure API",
  "project": "my-project",  # Will only search GitHub chunks!
  "includeGlobal": true
})

# Fix required: Schema alignment or adapter layer
```

## The Problem

### GitHub Chunks Schema

```sql
hybrid_code_chunks_a1b2c3d4 (
  id TEXT,
  vector vector(768),
  content TEXT,              -- ← called 'content'
  start_line INT,            -- ← line numbers
  end_line INT,
  sparse_vector JSONB,       -- ← has sparse vectors
  project_id UUID,
  dataset_id UUID,
  repo TEXT,
  ...
)
```

### Crawl4AI Chunks Schema

```sql
chunks_project_myproj_dataset_docs (
  id TEXT,
  vector vector(768),
  chunk_text TEXT,           -- ← called 'chunk_text' ❌
  start_char INT,            -- ← character positions ❌
  end_char INT,
  -- NO sparse_vector!       -- ← missing ❌
  summary TEXT,              -- ← extra field
  is_code BOOLEAN,           -- ← extra field
  project_id UUID,
  dataset_id UUID,
  scope TEXT,
  ...
)
```

### Why This Breaks Retrieval

```typescript
// queryProject() expects:
const results = await vectorDb.search(collectionName, queryVector, {
  filter: { datasetIds, projectId }
});

// Returns rows with:
// - result.content ← GitHub has this
// - result.chunk_text ← Crawl4AI has this
// - result.start_line ← GitHub has this
// - result.start_char ← Crawl4AI has this

// Result: Can't map columns → query fails or returns wrong data
```

## The Solution (3 Options)

### Option A: Schema Unification ⭐ RECOMMENDED

**Approach**: Modify Crawl4AI to store chunks in the same format as GitHub.

**Changes**:
1. Rename `chunk_text` → `content`
2. Calculate `start_line`, `end_line` from char positions
3. Add SPLADE sparse vector generation
4. Store `summary` in `metadata->summary`
5. Use same table naming: `hybrid_code_chunks_{hash}`

**Pros**:
- Single retrieval path
- Consistent schema
- Enable hybrid search for web content
- Easier to maintain

**Cons**:
- Requires Crawl4AI service changes
- Need to regenerate existing crawl data

**Effort**: 4-6 hours

**Files to Change**:
- `services/crawl4ai-runner/app/storage/postgres_store.py`
- `services/crawl4ai-runner/app/services/crawling_service.py`

### Option B: Adapter Layer

**Approach**: Detect table type and map columns during queries.

**Changes**:
1. Add schema detection in `queryProject()`
2. Map column names: `chunk_text` ↔ `content`
3. Normalize line/char positions
4. Handle missing sparse vectors

**Pros**:
- Preserves both implementations
- No service changes needed

**Cons**:
- Complex query logic
- Performance overhead
- Hard to maintain

**Effort**: 3-4 hours

**Files to Change**:
- `src/api/query.ts`
- `src/vectordb/postgres-dual-vectordb.ts`

### Option C: Separate Retrieval

**Approach**: Create dedicated function for Crawl4AI.

**Changes**:
1. New function: `queryCrawlChunks()`
2. Query Crawl4AI collections separately
3. Merge results at application layer

**Pros**:
- Clean separation
- Optimized per source

**Cons**:
- Code duplication
- Complex result merging
- Two retrieval APIs

**Effort**: 5-6 hours

**Files to Create**:
- `src/api/query-crawl.ts`

## Recommended Implementation (Option A)

### Step 1: Update Crawl4AI Schema (2 hours)

```python
# services/crawl4ai-runner/app/storage/postgres_store.py

async def create_chunks_collection(self, collection_name: str, dimension: int):
    table_name = f"{self.schema}.hybrid_code_chunks_{collection_name}"  # ← rename
    
    await conn.execute(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id TEXT PRIMARY KEY,
            vector vector({dimension}),
            content TEXT,                    -- ← rename from chunk_text
            summary TEXT,                    -- ← keep but also add to metadata
            start_line INTEGER,              -- ← calculate from start_char
            end_line INTEGER,                -- ← calculate from end_char
            sparse_vector JSONB,             -- ← add for hybrid search
            project_id UUID,
            dataset_id UUID,
            repo TEXT,                       -- ← use URL as repo
            lang TEXT,
            metadata JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
```

### Step 2: Add SPLADE Integration (2 hours)

```python
# services/crawl4ai-runner/app/services/crawling_service.py

async def _embed_chunks(self, chunks):
    # Dense embeddings
    embeddings = await embedding_client.embed_batch(texts, model=model)
    
    # Sparse embeddings (NEW)
    sparse_vectors = []
    if os.getenv('ENABLE_HYBRID_SEARCH') == 'true':
        splade_client = SpladeClient(url='http://splade-runner:8000')
        sparse_vectors = await splade_client.compute_sparse_batch(texts)
    
    return embeddings, sparse_vectors
```

### Step 3: Update queryProject() (2 hours)

```typescript
// src/api/query.ts

// Discover all hybrid collections (both GitHub and Crawl4AI)
const collections = await vectorDb.listCollections();
const hybridCollections = collections.filter(name => 
  name.startsWith('hybrid_code_chunks_')
);

// Query all collections and aggregate
for (const collection of hybridCollections) {
  const results = await vectorDb.hybridQuery(
    collection,
    queryVector,
    querySparse,
    { filter: { datasetIds, projectId }, topK }
  );
  aggregatedResults.push(...results);
}

// Rank and return
return rankResults(aggregatedResults);
```

## Testing the Fix

### Before Fix

```bash
# Index GitHub repo
claudeContext.index({ 
  path: "/code/repo", 
  project: "test", 
  dataset: "code" 
})
# ✅ Works: 100 files, 2000 chunks

# Crawl docs
claudeContext.crawl({ 
  url: "https://docs.test.com", 
  project: "test", 
  dataset: "docs" 
})
# ✅ Works: 50 pages, 800 chunks

# Search across both
claudeContext.search({ 
  query: "authentication", 
  project: "test" 
})
# ❌ Only returns GitHub results!
```

### After Fix

```bash
# Same indexing and crawling...

# Search across both
claudeContext.search({ 
  query: "authentication", 
  project: "test" 
})
# ✅ Returns results from BOTH sources!
# - 3 results from code (repo chunks)
# - 2 results from docs (crawl chunks)
# All ranked by relevance
```

## Performance Expectations

### Ingestion

| Source | Speed | Bottleneck |
|--------|-------|------------|
| GitHub | 20-30 files/sec | Embedding generation |
| Crawl4AI | 2-5 pages/sec | Page rendering (Playwright) |

### Retrieval

| Configuration | Latency (p95) |
|---------------|---------------|
| Dense only | 100-150ms |
| Hybrid (dense + sparse) | 150-250ms |
| + Reranking | 300-500ms |

### Resource Usage

| Service | Memory | CPU |
|---------|--------|-----|
| PostgreSQL | 2-4 GB | 2-4 cores |
| Qdrant (optional) | 1-2 GB | 1-2 cores |
| GTE embedding | 3 GB VRAM | GPU |
| CodeRank embedding | 3 GB VRAM | GPU |
| SPLADE | 4 GB VRAM | GPU |
| Reranker | 2 GB VRAM | GPU |
| Crawl4AI | 4 GB | 2 cores |

## Common Issues

### "No collections found"

**Cause**: Nothing indexed yet  
**Fix**: Run `claudeContext.index()` on a repository first

### "Search returns empty results"

**Cause**: Collection from different repository path  
**Fix**: Use same path for index and search, or use project-aware search

### "Embedding service connection refused"

**Cause**: EmbeddingMonster services not running  
**Fix**: Start GTE and CodeRank services on ports 30001/30002

### "Crawl hangs at 60%"

**Cause**: JavaScript-heavy page timing out  
**Fix**: Increase timeout or skip problematic pages

### "Hybrid search slower than expected"

**Cause**: Missing indexes or large result sets  
**Fix**: Create pgvector ivfflat indexes, tune list count

## File Reference

### Key Source Files

```
src/
├── context.ts               # Main Context class, indexing logic
├── api/
│   ├── ingest.ts           # GitHub ingestion API
│   └── query.ts            # Unified retrieval (needs Crawl4AI integration)
├── embedding/
│   └── auto-embedding-monster.ts  # Dual-model router
└── vectordb/
    └── postgres-dual-vectordb.ts  # PostgreSQL + pgvector storage

services/crawl4ai-runner/app/
├── main.py                 # FastAPI routes
├── services/
│   └── crawling_service.py # Orchestrates crawl → chunk → embed → store
├── storage/
│   └── postgres_store.py   # Database storage (needs schema update)
└── chunking/
    └── smart_chunker.py    # Chunk with code detection
```

### Configuration Files

```
.env                        # Main environment variables
.env.crawl4ai              # Crawl4AI-specific config
services/docker-compose.yml # Service definitions
mcp-server.js              # MCP protocol server
```

## Next Steps

1. **Choose an approach**: Review options A, B, C above
2. **Implement changes**: Follow step-by-step guide for chosen option
3. **Test integration**: Use test queries across both sources
4. **Deploy to production**: Update services and monitor

## Getting Help

### Documentation

- Full architecture: `docs/ingestion/INGESTION_ARCHITECTURE.md`
- Flow diagrams: `docs/ingestion/INGESTION_FLOW.md`
- Status summary: `docs/ingestion/INGESTION_STATUS_SUMMARY.md`

### Testing

- GitHub ingestion test: `test-working-retrieval.js`
- Basic retrieval test: `test-retrieval.js`

### Monitoring

```bash
# Check service health
docker compose ps

# View logs
docker compose logs -f crawl4ai
docker compose logs -f postgres

# Query database directly
psql -h localhost -p 5533 -U postgres -d claude_context
```

### Common SQL Queries

```sql
-- List all collections
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'claude_context' 
AND (table_name LIKE 'hybrid_code_chunks_%' OR table_name LIKE 'chunks_%');

-- Count chunks per collection
SELECT 'hybrid_code_chunks_abc123' as collection, COUNT(*) as chunks
FROM claude_context.hybrid_code_chunks_abc123
UNION ALL
SELECT 'chunks_project_x_dataset_y' as collection, COUNT(*) as chunks
FROM claude_context.chunks_project_x_dataset_y;

-- Check recent ingestions
SELECT project_id, dataset_id, COUNT(*) as chunks, MAX(created_at) as last_updated
FROM claude_context.hybrid_code_chunks_abc123
GROUP BY project_id, dataset_id;
```

## Support

For issues or questions:
1. Check existing documentation in `docs/`
2. Review test files for usage examples
3. Check Docker logs for errors
4. Verify environment variables are set correctly

```

---

## File: WHICH_SYSTEM_TO_USE.md

**Path:** `WHICH_SYSTEM_TO_USE.md`

```markdown
# Which System Should I Use? 🤔

## Quick Decision Tree

```
                    Start Here
                        ↓
            ┌───────────────────────┐
            │   What do you need?   │
            └───────────┬───────────┘
                        │
        ┌───────────────┴───────────────┐
        ↓                               ↓
   [Find Code]                    [Understand Code]
        │                               │
        ↓                               ↓
  Claude-Context                     Cognee
```

---

## 🔍 Use **Claude-Context** When...

### ✅ You want to FIND things:
- **"Where is function X?"**
- **"Find all uses of variable Y"**
- **"Show me similar code to this snippet"**
- **"What files import module Z?"**

### ✅ You want FAST results:
- Quick code search
- Symbol lookup
- File navigation
- Chunk retrieval

### ✅ You're doing:
- Code reviews
- Bug hunting
- Refactoring
- Finding implementations

**Example Queries:**
```
"Find the MemoryPool class"
"Where is allocate() called?"
"Show me all error handlers"
"Find TypeScript files with 'cache'"
```

---

## 🧠 Use **Cognee** When...

### ✅ You want to UNDERSTAND things:
- **"How does X relate to Y?"**
- **"Explain the architecture"**
- **"Why is this designed this way?"**
- **"What are the main components?"**

### ✅ You want REASONING:
- Explanations with context
- Chain-of-thought answers
- Graph-based understanding
- Relationship discovery

### ✅ You're doing:
- Architecture review
- Onboarding new developers
- Documentation generation
- Impact analysis

**Example Queries:**
```
"How does the cache system interact with memory pool?"
"Explain the performance monitoring architecture"
"What components depend on the garbage collector?"
"Walk me through how batch processing works step-by-step"
```

---

## 📊 Feature Comparison

| Feature | Claude-Context | Cognee |
|---------|---------------|--------|
| **Speed** | ⚡⚡⚡ Very Fast | ⚡⚡ Fast |
| **Code Search** | ✅ Optimized | ⚠️ Basic |
| **Symbol Extraction** | ✅ Yes | ❌ No |
| **AST-Aware** | ✅ Yes | ❌ No |
| **Hybrid Search** | ✅ Yes | ⚠️ Limited |
| **Reranking** | ✅ Yes | ❌ No |
| **Knowledge Graph** | ❌ No | ✅ Yes (Neo4j) |
| **Entity Extraction** | ❌ No | ✅ Yes |
| **Relationships** | ⚠️ Basic | ✅ Advanced |
| **LLM Explanations** | ❌ No | ✅ Yes (15 types!) |
| **Chain-of-Thought** | ❌ No | ✅ Yes |
| **Graph Queries** | ❌ No | ✅ Yes (Cypher) |

---

## 🎯 Practical Examples

### Scenario 1: "I need to fix a bug in the cache"

**Step 1:** Use **Claude-Context** to find the code
```
Query: "cache implementation"
→ Fast results showing all cache-related files
```

**Step 2:** Use **Cognee** to understand impact
```
Query: "What components depend on the cache system?"
→ Graph shows all relationships
```

---

### Scenario 2: "New developer needs onboarding"

**Use Cognee:**
```
1. "Explain the overall architecture"
   → High-level understanding

2. "What are the main optimization techniques?"
   → Graph-based summary with relationships

3. "How does performance monitoring work?"
   → Chain-of-thought explanation
```

---

### Scenario 3: "Refactoring memory management"

**Step 1:** Use **Claude-Context** to find all occurrences
```
Query: "memory allocation" 
→ All functions, files, symbols
```

**Step 2:** Use **Cognee** to understand relationships
```
Query: "What depends on memory allocation?"
→ Full dependency graph
```

**Step 3:** Use **Claude-Context** for similar patterns
```
Query: "Similar to MemoryPool.allocate()"
→ Find similar implementations
```

---

## 🚀 Pro Tips

### 1. Use Both Together
```typescript
// Find the code
const code = await claudeContext.search("MemoryPool");

// Understand relationships
const graph = await cognee.search({
  searchType: "GRAPH_COMPLETION",
  query: "What uses MemoryPool?"
});
```

### 2. Start with Claude-Context
- Always start with Claude-Context for speed
- Then use Cognee if you need deeper understanding

### 3. Index in Both
- Same codebase, indexed in both systems
- Different views, complementary strengths

---

## 🎓 Cheat Sheet

### Claude-Context = Google for Code
- **Fast**, **precise**, **code-focused**
- Like Ctrl+F on steroids
- Best for: "Find X"

### Cognee = ChatGPT for Code
- **Smart**, **contextual**, **reasoning**
- Like talking to a senior engineer
- Best for: "Explain X"

---

## 🔄 When to Switch Systems

| You're using... | Switch to other if... |
|----------------|----------------------|
| **Claude-Context** | You get results but don't understand them |
| | You need to know "why" not just "where" |
| | You want to see relationships |
| **Cognee** | Results are too slow |
| | You just need to find a specific function |
| | You need symbol-level precision |

---

## 💡 Real-World Workflow

```
Morning: Bug Report 🐛
├─ Claude-Context: Find the buggy function (30 seconds)
├─ Cognee: Understand what it affects (2 minutes)
├─ Claude-Context: Find all calls to it (30 seconds)
└─ Fix with confidence! ✅

Afternoon: New Feature 🚀
├─ Cognee: Understand existing architecture (5 minutes)
├─ Cognee: Find similar features (2 minutes)
├─ Claude-Context: Find exact implementations (1 minute)
└─ Build with context! ✅

Evening: Code Review 👀
├─ Claude-Context: Find changed functions (instant)
├─ Cognee: Check impact on other components (2 minutes)
├─ Claude-Context: Find test files (30 seconds)
└─ Review thoroughly! ✅
```

---

## 🎯 Bottom Line

**Quick Rule of Thumb:**
- Need to **FIND** something? → **Claude-Context** 🔍
- Need to **UNDERSTAND** something? → **Cognee** 🧠

**Even Better:**
- Use **BOTH**! They're designed to complement each other! 🤝

---

## 📞 Still Confused?

Ask yourself:
1. **"Do I know what I'm looking for?"**
   - ✅ Yes → Claude-Context
   - ❌ No → Cognee

2. **"Do I need an explanation?"**
   - ✅ Yes → Cognee
   - ❌ No → Claude-Context

3. **"Am I exploring or searching?"**
   - Exploring → Cognee
   - Searching → Claude-Context

---

**Remember:** There's no wrong choice! They both work, just optimized for different tasks. 🎉

```

---

