# Cognee with Qdrant Community Adapter

This directory contains a custom Cognee build that includes the community-maintained Qdrant adapter.

## 📦 What's Included

### Custom Files

1. **Dockerfile** - Custom build based on `cognee/cognee:main`
   - Installs `cognee-community-vector-adapter-qdrant`
   - Adds custom entrypoint for adapter registration

2. **register_qdrant.py** - Python script to register the Qdrant adapter
   - Imports and calls `register()` from the adapter package
   - Runs before Cognee API starts

3. **entrypoint.sh** - Custom startup script
   - Registers Qdrant adapter on container start
   - Launches Cognee API with uvicorn

4. **.env** - Configuration for shared services
   - PostgreSQL: `postgres:5432/cognee_db`
   - Qdrant: `qdrant:6333`
   - Neo4j: `neo4j:7687`
   - GTE Embeddings: `host.docker.internal:30001`

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         Custom Cognee Container             │
│                                             │
│  1. Start container                         │
│  2. Run register_qdrant.py                  │
│     └─> Import & register Qdrant adapter   │
│  3. Launch Cognee API (uvicorn)             │
│                                             │
│  Dependencies:                              │
│  - cognee/cognee:main (base)                │
│  - cognee-community-vector-adapter-qdrant   │
└─────────────────────────────────────────────┘
              │
              ├─> PostgreSQL (postgres:5432)
              ├─> Qdrant (qdrant:6333)
              ├─> Neo4j (neo4j:7687)
              └─> GTE Embeddings (host:30001)
```

## 🚀 Building & Running

### First Time Setup

```bash
cd /home/mewtwo/Zykairotis/claude-context-core/services

# Build the custom image
docker compose build cognee

# Start all services
docker compose up -d

# Check logs
docker logs -f cognee
```

### Expected Output

```
🚀 Starting Cognee with Qdrant adapter...
✅ Registering Qdrant community adapter...
✅ Qdrant adapter registered successfully!
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## 🔍 Verification

### 1. Check Qdrant Registration

```bash
docker exec cognee python -c "
from cognee.infrastructure.databases.vector.supported_databases import supported_databases
print('Supported databases:', list(supported_databases.keys()))
"
```

Expected: `['qdrant']`

### 2. Test Health Endpoint

```bash
curl http://localhost:8340/health
```

### 3. Check Qdrant Collections

```bash
curl http://localhost:6333/collections | jq
```

## 📝 Environment Variables

Required variables in `.env`:

```bash
# Vector Database
VECTOR_DB_PROVIDER=qdrant
VECTOR_DB_URL=http://qdrant:6333
VECTOR_DB_KEY=

# Database
DB_PROVIDER=postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cognee_db
DB_USERNAME=postgres
DB_PASSWORD=code-context-secure-password

# Graph
GRAPH_DATABASE_PROVIDER=neo4j
GRAPH_DATABASE_URL=bolt://neo4j:7687
GRAPH_DATABASE_USERNAME=neo4j
GRAPH_DATABASE_PASSWORD=secure-graph-password

# Embeddings
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_ENDPOINT=http://host.docker.internal:30001/v1
EMBEDDING_DIMENSIONS=768
```

## 🐛 Troubleshooting

### Adapter Not Registered

**Symptom**: Error `Unsupported graph database provider: qdrant`

**Solution**:
1. Check container logs: `docker logs cognee`
2. Look for `✅ Qdrant adapter registered successfully!`
3. If missing, rebuild: `docker compose build --no-cache cognee`

### Import Errors

**Symptom**: `ImportError: No module named 'cognee_community_vector_adapter_qdrant'`

**Solution**:
```bash
# Rebuild with no cache
docker compose build --no-cache cognee
docker compose up -d cognee
```

### Qdrant Connection Failed

**Symptom**: `Connection refused to qdrant:6333`

**Solution**:
1. Check Qdrant is running: `docker ps | grep qdrant`
2. Test connection: `curl http://localhost:6333/collections`
3. Check network: `docker network inspect claude-context-network`

## 🔄 Rebuilding

After modifying Dockerfile, entrypoint, or registration script:

```bash
# Stop container
docker compose stop cognee

# Rebuild
docker compose build --no-cache cognee

# Restart
docker compose up -d cognee

# Check logs
docker logs -f cognee
```

## 📚 References

- [Cognee Qdrant Docs](https://docs.cognee.ai/setup-configuration/community-maintained/qdrant)
- [Adapter Source](https://github.com/topoteretes/cognee-community/tree/main/packages/vector/qdrant)
- [Qdrant Documentation](https://qdrant.tech/documentation/)

---

**Status**: ✅ Ready for deployment  
**Last Updated**: December 2024
