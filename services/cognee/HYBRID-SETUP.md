# Cognee + Claude-Context Hybrid Setup

## 🎯 Overview

This setup integrates Cognee with Claude-Context's existing infrastructure:
- **Shared PostgreSQL** (with pgvector) - Relational & vector storage
- **Shared Qdrant** - High-performance vector search
- **New Neo4j** - Knowledge graph for Cognee
- **Shared GTE Embeddings** - 768-dim embeddings on host:30001

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Docker Network                         │
│              claude-context-network                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  PostgreSQL  │  │    Qdrant    │  │    Neo4j     │ │
│  │   :5432      │  │    :6333     │  │  :7474/:7687 │ │
│  │  (shared)    │  │   (shared)   │  │    (new)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
│  ┌─────────────────────────┴──────────────────────────┐│
│  │              Cognee Container                       ││
│  │                  :8340                              ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴────────┐
                    │  Host Services  │
                    │  GTE: 30001     │
                    │  CodeRank: 30002│
                    │  Reranker: 30003│
                    └─────────────────┘
```

## 📋 Prerequisites

1. **Main services running**:
   ```bash
   cd /home/mewtwo/Zykairotis/claude-context-core/services
   docker compose up -d postgres qdrant neo4j
   ```

2. **Host embedding services** (TEI on ports 30001, 30002):
   - Should already be running from Claude-Context setup
   - Verify: `curl http://localhost:30001/health`

## 🚀 Quick Start

### Option 1: Use the automated startup script (recommended)

```bash
cd /home/mewtwo/Zykairotis/claude-context-core/services
./start-hybrid.sh
```

### Option 2: Manual startup

```bash
cd /home/mewtwo/Zykairotis/claude-context-core/services

# First time: Build custom Cognee image with Qdrant adapter
docker compose build cognee

# Start all services at once (includes Cognee)
docker compose up -d

# Or start core services first, then Cognee
docker compose up -d postgres qdrant neo4j
docker compose up -d cognee

# Check logs
docker logs -f cognee
```

**Note**: The first build will take a few minutes as it downloads the base Cognee image and installs the Qdrant community adapter.

## 🔍 Verification

### 1. Check all services are healthy

```bash
# PostgreSQL
docker exec claude-context-postgres psql -U postgres -c "SELECT version();"

# Qdrant
curl http://localhost:6333/collections

# Neo4j
curl http://localhost:7474

# Cognee
curl http://localhost:8340/health
```

### 2. Check Cognee database connections

```bash
# View Cognee logs
docker logs cognee

# Should see:
# ✅ Connected to PostgreSQL: cognee_db
# ✅ Connected to Qdrant: qdrant:6333
# ✅ Connected to Neo4j: bolt://neo4j:7687
```

### 3. Test Cognee API

```bash
# Health check
curl http://localhost:8340/api/v1/health

# Add test data
curl -X POST http://localhost:8340/api/v1/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{"data": "Cognee is now connected to shared infrastructure!"}'

# Cognify (process data)
curl -X POST http://localhost:8340/api/v1/cognify \
  -H "Authorization: Bearer local-development-only"

# Search
curl -X POST http://localhost:8340/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-development-only" \
  -d '{"query": "shared infrastructure"}'
```

## 📊 Database Inspection

### PostgreSQL

```bash
# Connect to PostgreSQL
docker exec -it claude-context-postgres psql -U postgres -d cognee_db

# List Cognee tables
\dt

# Check data
SELECT COUNT(*) FROM data;
SELECT COUNT(*) FROM dataset;
```

### Qdrant

```bash
# List all collections
curl http://localhost:6333/collections | jq

# Check Cognee collection
curl http://localhost:6333/collections/cognee | jq
```

### Neo4j

```bash
# Open Neo4j Browser
open http://localhost:7474

# Cypher query to see nodes
MATCH (n) RETURN n LIMIT 25;

# Check Cognee graph
MATCH (n:CogneeNode) RETURN COUNT(n);
```

## 🔧 Configuration Details

### Environment Variables (.env)

```bash
# LLM - MiniMax M2
LLM_PROVIDER=openai
LLM_MODEL=MiniMax-M2
LLM_ENDPOINT=https://api.minimax.io/v1

# Embeddings - Shared GTE (768 dims)
EMBEDDING_PROVIDER=openai
EMBEDDING_ENDPOINT=http://host.docker.internal:30001/v1
EMBEDDING_DIMENSIONS=768

# PostgreSQL (shared)
DB_PROVIDER=postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cognee_db
DB_USERNAME=postgres
DB_PASSWORD=code-context-secure-password

# Qdrant (shared)
VECTOR_DB_PROVIDER=qdrant
QDRANT_HOST=qdrant
QDRANT_PORT=6333

# Neo4j (new)
GRAPH_DATABASE_PROVIDER=neo4j
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=secure-graph-password
```

### Port Mapping

| Service | Internal | External | Purpose |
|---------|----------|----------|---------|
| PostgreSQL | 5432 | 5533 | Database |
| Qdrant | 6333 | 6333 | Vector store |
| Neo4j HTTP | 7474 | 7474 | Web UI |
| Neo4j Bolt | 7687 | 7687 | Graph queries |
| Cognee API | 8000 | 8340 | REST API |

## 🐛 Troubleshooting

### Cognee can't connect to PostgreSQL

```bash
# Check if postgres is in the same network
docker network inspect claude-context-network | grep postgres

# Test connection from Cognee container
docker exec cognee ping postgres
```

### Cognee can't connect to Neo4j

```bash
# Check Neo4j is running
docker ps | grep neo4j

# Check Neo4j logs
docker logs claude-context-neo4j

# Test from Cognee
docker exec cognee nc -zv neo4j 7687
```

### Embedding service not accessible

```bash
# Check GTE is running on host
curl http://localhost:30001/health

# From inside Cognee container
docker exec cognee curl http://host.docker.internal:30001/health
```

### Reset Cognee data

```bash
# Drop Cognee database
docker exec -it claude-context-postgres psql -U postgres -c "DROP DATABASE IF EXISTS cognee_db;"
docker exec -it claude-context-postgres psql -U postgres -c "CREATE DATABASE cognee_db;"

# Clear Qdrant collections
curl -X DELETE http://localhost:6333/collections/cognee

# Clear Neo4j (open browser at localhost:7474)
MATCH (n) DETACH DELETE n;

# Restart Cognee
docker compose restart cognee
```

## 📈 Performance Tuning

### PostgreSQL

Already optimized in main docker-compose.yml:
- 200 max connections
- 256MB shared buffers
- Parallel workers enabled

### Qdrant

- On-disk payload enabled for memory efficiency
- HNSW index for fast similarity search

### Neo4j

- 2GB heap size
- 1GB page cache
- APOC and GDS plugins enabled

## 🔗 Next Steps

1. **Test the hybrid plan**: Follow Phase 2 (Database Schema Unification)
2. **Run migration scripts**: Transfer existing CC chunks to Cognee
3. **Set up sync service**: Phase 7 (Chunk Synchronization)
4. **Implement query router**: Phase 10 (Query Router Implementation)

## 📚 References

- [Cognee PostgreSQL Setup](https://docs.cognee.ai/setup-configuration/relational-databases#postgres)
- [Cognee Qdrant Setup](https://docs.cognee.ai/setup-configuration/community-maintained/qdrant)
- [Cognee Neo4j Setup](https://docs.cognee.ai/setup-configuration/graph-stores#neo4j)
- [Hybrid Plan Documentation](../../docs/hybrid-plan/)

---

**Last Updated**: December 2024  
**Status**: ✅ Ready for testing
