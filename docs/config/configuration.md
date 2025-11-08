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

