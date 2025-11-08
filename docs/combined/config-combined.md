# Combined Files from config

*Generated on: Thu Nov  6 09:52:37 AM EST 2025*

---

## File: configuration.md

**Path:** `configuration.md`

```markdown
# Configuration Guide

This guide explains all environment variables and configuration options for claude-context-core.

## LLM Configuration (Smart Query)

The Smart Query feature uses a Large Language Model (LLM) to enhance queries and synthesize answers.

### Required Variables

```bash
# Your LLM API key (required for smart query to work)
LLM_API_KEY=your-api-key-here
```

### Optional LLM Variables

```bash
# LLM API Base URL
# Default: https://api.minimax.io/v1
# Change this if using a different OpenAI-compatible API
LLM_API_BASE=https://api.minimax.io/v1

# Model name to use
# Default: LLM
# Examples: MiniMax-M2, gpt-4, gpt-4-turbo, claude-3-opus
MODEL_NAME=MiniMax-M2

# Maximum tokens for LLM responses
# Default: 16384 (16k tokens)
# Controls how long/detailed smart query answers can be
# - Increase for more comprehensive, detailed answers
# - Decrease for faster responses and lower costs
# Common values: 4096, 8192, 16384, 32768
LLM_MAX_TOKENS=16384

# Temperature for LLM responses
# Default: 0.2
# Range: 0.0 (deterministic) to 1.0 (creative)
# - Lower values (0.0-0.3): More factual, consistent, focused
# - Higher values (0.7-1.0): More creative, varied responses
LLM_TEMPERATURE=0.2
```

### How LLM_MAX_TOKENS Affects Answers

The `LLM_MAX_TOKENS` setting directly controls the length and detail of smart query answers:

| Max Tokens | Answer Length | Use Case |
|------------|---------------|----------|
| 1024 | Short, concise | Quick facts, simple queries |
| 4096 | Medium length | Standard queries, balanced detail |
| 8192 | Detailed | Complex queries, multiple aspects |
| **16384** | **Comprehensive** | **Default - thorough analysis** |
| 32768 | Very detailed | Deep dives, extensive documentation |

**Example: Effect on Answer Quality**

With `LLM_MAX_TOKENS=1024` (old default):
```
Short answer: "EmbeddingMonster is an embedding provider that uses GTE and CodeRank models."
```

With `LLM_MAX_TOKENS=16384` (new default):
```
Comprehensive answer with:
- Detailed explanation of what EmbeddingMonster is
- Key characteristics and capabilities
- Configuration options with examples
- Integration details
- Code snippets and references
- Assumptions and context
```

### Legacy Variable Support

These older variable names are still supported for backward compatibility:

```bash
# Legacy names (deprecated - use LLM_* versions above)
MINIMAX_API_KEY=your-api-key-here
MINIMAX_API_BASE=https://api.minimax.io/v1
MINIMAX_MODEL=MiniMax-M2
MINIMAX_MAX_TOKENS=16384
MINIMAX_TEMPERATURE=0.2
```

## Database Configuration

```bash
# PostgreSQL connection string
POSTGRES_URL=postgres://postgres:password@localhost:5533/claude_context

# Qdrant vector database URL
QDRANT_URL=http://localhost:6333
```

## Embedding Configuration

### Provider Selection

```bash
# Choose your embedding provider
# Options: embeddingmonster, openai, gemini, ollama, voyageai
EMBEDDING_PROVIDER=embeddingmonster

# Model selection (depends on provider)
EMBEDDING_MODEL=auto
```

### Provider-Specific Configuration

#### EmbeddingMonster (Local)

```bash
# Ports for local embedding services
STELLA_PORT=30001
CODERANK_PORT=30002

# Performance tuning
EMBEDDING_CONCURRENCY=16
EMBEDDING_BATCH_SIZE_PER_REQUEST=50
```

#### OpenAI

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

#### Gemini

```bash
GOOGLE_API_KEY=your-key
GEMINI_API_KEY=your-key
EMBEDDING_MODEL=models/text-embedding-004
```

#### Ollama

```bash
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
```

#### VoyageAI

```bash
VOYAGEAI_API_KEY=your-key
EMBEDDING_MODEL=voyage-2
```

## API Server Configuration

```bash
# API server port
PORT=3030

# Environment
NODE_ENV=development

# Crawl4AI service URL (for web crawling)
CRAWL4AI_URL=http://localhost:7070
```

## Advanced Configuration

### Claude Context Home

```bash
# Custom directory for Claude Context configuration
# Defaults to user's home directory
CLAUDE_CONTEXT_HOME=/path/to/config
```

## Configuration Priority

Environment variables are resolved in this order:

1. **Explicit options** passed to constructors
2. **New environment variables** (e.g., `LLM_API_KEY`)
3. **Legacy environment variables** (e.g., `MINIMAX_API_KEY`)
4. **Default values**

Example for API key:
```typescript
apiKey = options.apiKey           // 1. Constructor option
      || process.env.LLM_API_KEY   // 2. New env var
      || process.env.MINIMAX_API_KEY // 3. Legacy env var
      || undefined                 // 4. No default (error)
```

## Common Configuration Scenarios

### Scenario 1: Basic Setup (Local Embeddings + MiniMax LLM)

```bash
# Smart Query
LLM_API_KEY=sk-your-minimax-key
LLM_MAX_TOKENS=16384

# Local embeddings
EMBEDDING_PROVIDER=embeddingmonster
STELLA_PORT=30001
CODERANK_PORT=30002

# Database
POSTGRES_URL=postgres://postgres:password@localhost:5533/claude_context
QDRANT_URL=http://localhost:6333
```

### Scenario 2: All OpenAI

```bash
# Smart Query with OpenAI
LLM_API_KEY=sk-your-openai-key
LLM_API_BASE=https://api.openai.com/v1
MODEL_NAME=gpt-4-turbo
LLM_MAX_TOKENS=16384

# OpenAI embeddings
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
EMBEDDING_MODEL=text-embedding-3-large

# Database
POSTGRES_URL=postgres://postgres:password@localhost:5533/claude_context
QDRANT_URL=http://localhost:6333
```

### Scenario 3: Custom LLM (OpenAI-compatible)

```bash
# Custom LLM endpoint
LLM_API_KEY=your-custom-key
LLM_API_BASE=http://your-llm-server:8000/v1
MODEL_NAME=your-model-name
LLM_MAX_TOKENS=32768  # Higher for detailed answers

# Local embeddings
EMBEDDING_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
```

## Troubleshooting

### Smart Query Returns Short Answers

**Problem**: Answers are too brief or cut off.

**Solution**: Increase `LLM_MAX_TOKENS`:
```bash
LLM_MAX_TOKENS=16384  # Default (recommended)
# or
LLM_MAX_TOKENS=32768  # For very detailed answers
```

### "Unable to generate an answer" Error

**Check these in order**:

1. **API Key**: Verify `LLM_API_KEY` is set and valid
   ```bash
   echo $LLM_API_KEY  # Should show your key
   ```

2. **API Base URL**: Ensure it's correct for your provider
   ```bash
   # MiniMax
   LLM_API_BASE=https://api.minimax.io/v1
   
   # OpenAI
   LLM_API_BASE=https://api.openai.com/v1
   ```

3. **Check server logs**: Look for specific error messages with context

### Authentication Errors

**Error**: "LLM API authentication failed"

**Solutions**:
- Verify API key is correct and not expired
- Check if you have API credits/quota remaining
- Ensure no extra spaces in the `.env` file:
  ```bash
  LLM_API_KEY=sk-xxx  # Good
  LLM_API_KEY = sk-xxx  # Bad (spaces)
  ```

### Slow Response Times

**Problem**: Smart queries take too long.

**Solutions**:
1. Reduce max tokens:
   ```bash
   LLM_MAX_TOKENS=8192  # Faster than 16384
   ```

2. Adjust temperature for faster inference:
   ```bash
   LLM_TEMPERATURE=0.0  # Fastest, most deterministic
   ```

3. Check LLM provider status/latency

## Environment File Location

The API server loads environment variables from:
```
/home/mewtwo/Zykairotis/claude-context-core/.env
```

Make sure this file exists and contains your configuration.

To verify the API server is using the correct `.env`:
```bash
cd services/api-server
npm run dev
# Check the startup logs for configuration values
```


```

---

## File: ENV_CONFIG.md

**Path:** `ENV_CONFIG.md`

```markdown
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


```

---

