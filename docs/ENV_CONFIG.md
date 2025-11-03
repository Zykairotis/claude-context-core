# Environment Configuration Guide

This document describes all environment variables used by the Claude Context Core system.

## Quick Start

Copy this configuration to your `.env` file:

```bash
# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
POSTGRES_URL=postgres://postgres:code-context-secure-password@localhost:5533/claude_context
POSTGRES_PASSWORD=code-context-secure-password
QDRANT_URL=http://localhost:6333

# ============================================================================
# EMBEDDING SERVICES
# ============================================================================
STELLA_HOST=localhost
STELLA_PORT=30001
CODERANK_HOST=localhost
CODERANK_PORT=30002
EMBEDDING_BATCH_SIZE=100
EMBEDDING_BATCH_SIZE_PER_REQUEST=32
EMBEDDING_CONCURRENCY=16

# ============================================================================
# RERANKING (Cross-Encoder)
# ============================================================================
ENABLE_RERANKING=false
RERANKER_URL=http://localhost:30003
RERANK_INITIAL_K=150
RERANK_FINAL_K=20

# ============================================================================
# HYBRID SEARCH (Dense + Sparse Vectors)
# ============================================================================
ENABLE_HYBRID_SEARCH=false
SPLADE_URL=http://localhost:30004
HYBRID_DENSE_WEIGHT=0.6
HYBRID_SPARSE_WEIGHT=0.4

# ============================================================================
# SMART RETRIEVAL (LLM-POWERED)
# ============================================================================
LLM_API_KEY=sk-your-key
LLM_API_BASE=https://api.minimax.io/v1
MODEL_NAME=MiniMax-M2

# ============================================================================
# AST SYMBOL EXTRACTION
# ============================================================================
ENABLE_SYMBOL_EXTRACTION=true
```

## Configuration Sections

### Database

- `POSTGRES_URL`: Full connection string for PostgreSQL with pgvector
- `POSTGRES_PASSWORD`: Password for PostgreSQL user
- `QDRANT_URL`: URL for Qdrant vector database

### Embedding Services

- `STELLA_HOST`, `STELLA_PORT`: Stella embedding model service
- `CODERANK_HOST`, `CODERANK_PORT`: CodeRank code embedding service
- `EMBEDDING_BATCH_SIZE`: Number of chunks to embed in a single batch
- `EMBEDDING_BATCH_SIZE_PER_REQUEST`: Chunks per API request
- `EMBEDDING_CONCURRENCY`: Parallel embedding requests

### Reranking

Boosts precision by reranking results with a cross-encoder model.

- `ENABLE_RERANKING`: Set to `true` to enable reranking
- `RERANKER_URL`: URL of TEI reranker service (BAAI/bge-reranker-v2-m3)
- `RERANK_INITIAL_K`: Number of results to fetch before reranking (default: 150)
- `RERANK_FINAL_K`: Number of results to return after reranking (default: 20)

**Requirements:** TEI reranker service must be running at port 30003

### Hybrid Search

Combines dense embeddings with sparse vectors for better recall.

- `ENABLE_HYBRID_SEARCH`: Set to `true` to enable hybrid search
- `SPLADE_URL`: URL of SPLADE sparse vector service
- `HYBRID_DENSE_WEIGHT`: Weight for dense vector scores (0.0-1.0)
- `HYBRID_SPARSE_WEIGHT`: Weight for sparse vector scores (0.0-1.0)

**Requirements:** SPLADE service must be running (included in docker-compose)

**Tuning:** Adjust weights based on your use case:
- More dense (0.7/0.3): Better for semantic/conceptual queries
- Balanced (0.5/0.5): Good starting point
- More sparse (0.3/0.7): Better for keyword/exact-match queries

### Smart Retrieval (LLM)

Used by the smart query feature (MiniMax M2 by default) to enhance queries and synthesize answers.

- `LLM_API_KEY`: API key for the LLM provider (required)
- `LLM_API_BASE`: Base URL for the LLM endpoint (default: `https://api.minimax.io/v1`)
- `MODEL_NAME`: Model identifier, e.g. `MiniMax-M2`
- Optional legacy fallbacks: `MINIMAX_API_KEY`, `MINIMAX_API_BASE`, `MINIMAX_MODEL`
- Optional tuning overrides: `LLM_MAX_TOKENS`, `LLM_TEMPERATURE` (fallback to `MINIMAX_MAX_TOKENS` / `MINIMAX_TEMPERATURE`)

### AST Symbol Extraction

Extracts rich metadata from code (function names, signatures, docstrings).

- `ENABLE_SYMBOL_EXTRACTION`: Set to `true` to enable (default: true)

## Feature Combinations

### Baseline (No Advanced Features)
```bash
ENABLE_RERANKING=false
ENABLE_HYBRID_SEARCH=false
ENABLE_SYMBOL_EXTRACTION=true
```

### Reranking Only (Fast, High Precision)
```bash
ENABLE_RERANKING=true
ENABLE_HYBRID_SEARCH=false
ENABLE_SYMBOL_EXTRACTION=true
```

### Hybrid Only (Best Recall)
```bash
ENABLE_RERANKING=false
ENABLE_HYBRID_SEARCH=true
ENABLE_SYMBOL_EXTRACTION=true
```

### Full Stack (Maximum Quality)
```bash
ENABLE_RERANKING=true
ENABLE_HYBRID_SEARCH=true
ENABLE_SYMBOL_EXTRACTION=true
```

## Service Requirements

| Feature | Service | Port | Required |
|---------|---------|------|----------|
| Baseline | Stella | 30001 | Yes |
| Baseline | CodeRank | 30002 | Yes |
| Reranking | TEI Reranker | 30003 | Optional |
| Hybrid | SPLADE | 30004 | Optional |

## Performance Impact

| Feature | Indexing Time | Query Time | Storage |
|---------|---------------|------------|---------|
| Baseline | 1x | 1x | 1x |
| + Reranking | 1x | +30-50ms | 1x |
| + Hybrid | +20-30% | +20-30ms | +10-15% |
| + Full Stack | +20-30% | +50-80ms | +10-15% |

## Troubleshooting

### Reranking not working
1. Check reranker service is running: `curl http://localhost:30003/health`
2. Verify `ENABLE_RERANKING=true` in environment
3. Check logs for connection errors

### Hybrid search not working
1. Check SPLADE service is running: `curl http://localhost:30004/health`
2. Verify `ENABLE_HYBRID_SEARCH=true` in environment
3. Reindex data (hybrid requires sparse vectors during indexing)

### Symbol extraction not working
1. Verify `ENABLE_SYMBOL_EXTRACTION=true`
2. Check file language is supported (ts, js, py, java, cpp, go, rust, cs)
3. View logs for Tree-sitter parsing errors

