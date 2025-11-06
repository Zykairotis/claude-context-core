# Cognee Docker Setup Guide

## Summary of Fixes Applied

### Problems Identified
1. **Wrong Provider**: Used `EMBEDDING_PROVIDER=ollama` for TEI (Text Embeddings Inference) service
2. **Wrong Endpoint**: Used `/api/embed` instead of OpenAI-compatible `/v1/embeddings`
3. **Cloud API Errors**: Missing `COGNEE_API_KEY` environment variable
4. **LLM Provider**: Used `custom` instead of `openai` for Groq

### Solutions Applied

#### Fixed Configuration (.env)
```bash
# LLM - Groq (OpenAI-compatible)
LLM_PROVIDER=openai
LLM_MODEL=openai/gpt-oss-120b
LLM_ENDPOINT=https://api.groq.com/openai/v1
LLM_API_KEY=your_groq_api_key_here

# Embeddings - TEI (OpenAI-compatible)
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=Alibaba-NLP/gte-base-en-v1.5
EMBEDDING_ENDPOINT=http://tei-gte:80/v1
EMBEDDING_API_KEY=dummy
EMBEDDING_DIMENSIONS=768
HUGGINGFACE_TOKENIZER=Alibaba-NLP/gte-base-en-v1.5

# Cloud API bypass
COGNEE_API_KEY=local-development-only

# Database defaults
VECTOR_DB_PROVIDER=lancedb
DB_PROVIDER=sqlite
GRAPH_DATABASE_PROVIDER=networkx
```

#### Docker Networking
```yaml
networks:
  embedding-network:
    external: true
    name: embedding-network
```

This allows Cognee to access TEI services by hostname (`tei-gte`, `tei-code`).

## Key Concepts

### TEI vs Ollama

**TEI (Text Embeddings Inference)** - Hugging Face's inference server:
- Uses OpenAI-compatible API: `/v1/embeddings`
- Requires `EMBEDDING_PROVIDER=openai` in Cognee
- Supports models: GTE, BGE, E5, Nomic Embed, etc.
- Endpoint format: `http://service:port/v1`

**Ollama** - Local LLM server:
- Different API format: `/api/embed`
- Requires `EMBEDDING_PROVIDER=ollama` in Cognee
- Endpoint format: `http://localhost:11434/api/embed`

### Provider Mapping in Cognee

From the codebase analysis:
- `EMBEDDING_PROVIDER=openai` → Uses `LiteLLMEmbeddingEngine` (OpenAI-compatible APIs)
- `EMBEDDING_PROVIDER=ollama` → Uses `OllamaEmbeddingEngine` (Ollama-specific API)
- `EMBEDDING_PROVIDER=fastembed` → Uses local FastEmbed models

## Available TEI Services

Your setup has three TEI services on the `embedding-network`:

1. **tei-gte** (Port 30001)
   - Model: `Alibaba-NLP/gte-base-en-v1.5`
   - Dimensions: 768
   - Use case: General text embeddings

2. **tei-code** (Port 30002)
   - Model: `nomic-uiuc/CodeEmbed`
   - Dimensions: 768
   - Use case: Code embeddings

3. **tei-reranker** (Port 30003)
   - Model: Reranking model
   - Use case: Result reranking

## Testing Cognee

### 1. Check Service Health
```bash
# Check Cognee is running
docker ps | grep cognee

# View logs
docker logs cognee --tail 50

# Should see "Starting server..." without errors
```

### 2. Test Embeddings from Host
```bash
# Test GTE embeddings (port 30001)
curl -X POST http://localhost:30001/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"gte","input":"test query"}' | jq '.data[0].embedding[:5]'
```

### 3. Python Test Script
```python
import asyncio
import cognee

async def test_cognee():
    # Add sample text
    text = "Cognee is an AI memory framework that uses embeddings."
    
    await cognee.add(text, dataset_name="test")
    print("✅ Text added successfully")
    
    # Process with embeddings
    await cognee.cognify(["test"])
    print("✅ Cognify completed")
    
    # Search
    results = await cognee.search("What is Cognee?")
    print(f"✅ Search results: {len(results)} items")
    
    # Cleanup
    await cognee.prune_data(dataset_name="test")
    print("✅ Cleanup done")

asyncio.run(test_cognee())
```

## Docker Compose Management

### Start Services
```bash
cd services/cognee
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### Restart After Config Changes
```bash
docker compose down && docker compose up -d
```

### View Logs
```bash
# Follow logs
docker logs cognee -f

# Last 100 lines
docker logs cognee --tail 100

# Filter for errors
docker logs cognee 2>&1 | grep -i error
```

## Troubleshooting

### Cloud API Errors
**Error**: `CloudApiKeyMissingError: Failed to connect to the cloud service`

**Solution**: Add to `.env`:
```bash
COGNEE_API_KEY=local-development-only
```

### Embedding Connection Errors
**Error**: `InternalServerError: OpenAI Connection error`

**Checklist**:
1. ✅ Correct provider: `EMBEDDING_PROVIDER=openai` for TEI
2. ✅ Correct endpoint: `http://tei-gte:80/v1` (ends with `/v1`)
3. ✅ Network configured: Cognee on `embedding-network`
4. ✅ TEI service running: `docker ps | grep tei`

### Model Not Found Errors
**Error**: `The model X does not exist`

**Solution**: Use exact model name from TEI:
```bash
# Check running model
docker exec tei-gte cat /data/config.json | grep _name_or_path
```

### Network Issues
**Error**: `Cannot resolve hostname tei-gte`

**Solution**: Ensure docker-compose.yaml has:
```yaml
networks:
  embedding-network:
    external: true
    name: embedding-network
```

## Best Practices

1. **Always use OpenAI provider for TEI services**
   - TEI implements OpenAI-compatible API
   - Use `EMBEDDING_PROVIDER=openai`

2. **Match model names exactly**
   - `EMBEDDING_MODEL` should match the actual model in TEI
   - `HUGGINGFACE_TOKENIZER` should match for proper tokenization

3. **Use Docker service names for endpoints**
   - Inside containers: `http://tei-gte:80/v1`
   - From host: `http://localhost:30001/v1`

4. **Monitor logs after changes**
   ```bash
   docker logs cognee -f
   ```

5. **Test embeddings independently**
   ```bash
   curl -X POST http://localhost:30001/v1/embeddings \
     -H "Content-Type: application/json" \
     -d '{"model":"gte","input":"test"}'
   ```

## Configuration Reference

### Complete .env Template
```bash
# ===== LLM Configuration =====
LLM_PROVIDER=openai
LLM_MODEL=openai/gpt-oss-120b
LLM_ENDPOINT=https://api.groq.com/openai/v1
LLM_API_KEY=your-groq-key

# ===== Embedding Configuration =====
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=Alibaba-NLP/gte-base-en-v1.5
EMBEDDING_ENDPOINT=http://tei-gte:80/v1
EMBEDDING_API_KEY=dummy
EMBEDDING_DIMENSIONS=768
EMBEDDING_BATCH_SIZE=32
HUGGINGFACE_TOKENIZER=Alibaba-NLP/gte-base-en-v1.5

# ===== Cloud Service =====
COGNEE_API_KEY=local-development-only

# ===== Database Configuration =====
VECTOR_DB_PROVIDER=lancedb
DB_PROVIDER=sqlite
GRAPH_DATABASE_PROVIDER=networkx

# ===== Optional: Rate Limiting =====
EMBEDDING_RATE_LIMIT_ENABLED=false
EMBEDDING_RATE_LIMIT_REQUESTS=10
EMBEDDING_RATE_LIMIT_INTERVAL=5

# ===== Optional: Monitoring =====
MOCK_EMBEDDING=false
```

## Next Steps

1. **Test the setup**:
   ```bash
   docker logs cognee --tail 50
   ```

2. **Run the Python test script** (see section above)

3. **Try different TEI services**:
   - For code: Change endpoint to `http://tei-code:80/v1`
   - Update model to `nomic-uiuc/CodeEmbed`

4. **Explore Cognee features**:
   - Knowledge graph visualization
   - Semantic search
   - Multi-dataset management

## References

- Cognee GitHub: https://github.com/topoteretes/cognee
- TEI Documentation: https://huggingface.co/docs/text-embeddings-inference
- OpenAI Embeddings API: https://platform.openai.com/docs/api-reference/embeddings
