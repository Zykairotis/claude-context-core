# Database Scripts - Cognee Integration Update

## 🎯 Summary

Updated all database maintenance scripts to handle **BOTH** claude-context and Cognee databases:

### Databases Managed:
1. **PostgreSQL**:
   - `claude_context` schema (existing)
   - `cognee_db` database (new - Cognee's database)

2. **Qdrant**: Vector storage (shared between both systems)

3. **Neo4j**: Knowledge graph database (used by Cognee)

---

## ✅ Updated Scripts

### 1. `db-clean.sh` - Clean All Data
**What it does:**
- Truncates ALL tables in `claude_context` schema
- Truncates ALL tables in `cognee_db` database
- Deletes ALL Qdrant collections
- Deletes ALL Neo4j graph nodes and relationships

**Usage:**
```bash
# With confirmation prompt
./scripts/db-clean.sh

# Force mode (no prompt)
./scripts/db-clean.sh --force

# Without colors
./scripts/db-clean.sh --no-color
```

**What it preserves:**
- Database schemas
- Extensions (pgvector, uuid-ossp, etc.)
- Docker containers

---

### 2. `db-reinit.sh` - Full Database Reset
**What it does:**
- Drops and recreates `claude_context` schema
- Drops and recreates `cognee_db` database (with extensions)
- Deletes all Qdrant collections
- Cleans Neo4j graph data
- Runs init scripts and migrations
- Automatically restarts API server for pg-boss tables

**Usage:**
```bash
# Database-only reset (keeps containers running)
./scripts/db-reinit.sh --force

# Nuclear option: recreate containers + volumes
./scripts/db-reinit.sh --with-containers --force
```

**What it recreates:**
- PostgreSQL schemas and extensions
- cognee_db database with vector and uuid extensions
- All init scripts
- All migrations

---

### 3. `db-inspect.sh` - Inspect All Databases
**What it shows:**
- PostgreSQL `claude_context` schema (tables, sizes, metadata)
- PostgreSQL `cognee_db` database (tables, structure)
- Qdrant collections (point counts, vector counts)
- Neo4j graph (node count, relationship count, node types)

**Usage:**
```bash
# Quick overview
./scripts/db-inspect.sh

# Detailed inspection (shows table schemas)
./scripts/db-inspect.sh --full

# Without colors
./scripts/db-inspect.sh --no-color
```

---

## 🗄️ Database Configuration

### Environment Variables
```bash
# PostgreSQL
POSTGRES_CONTAINER=claude-context-postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5533
POSTGRES_USER=postgres
POSTGRES_DB=claude_context
COGNEE_DB=cognee_db
POSTGRES_PASSWORD=code-context-secure-password

# Qdrant
QDRANT_URL=http://localhost:6333

# Neo4j
NEO4J_CONTAINER=claude-context-neo4j
NEO4J_USER=neo4j
NEO4J_PASSWORD=secure-graph-password
```

---

## 📊 Database Architecture

```
┌─────────────────────────────────────────┐
│      PostgreSQL (Port 5533)             │
├─────────────────────────────────────────┤
│                                          │
│  📂 claude_context (schema)              │
│     • projects, datasets, chunks         │
│     • collections_metadata               │
│     • github_jobs, web_provenance        │
│     • mesh_nodes                         │
│                                          │
│  📂 cognee_db (database)                 │
│     • Cognee's tables                    │
│     • Extensions: vector, uuid-ossp      │
│                                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Qdrant (Port 6333)                 │
├─────────────────────────────────────────┤
│  • Vector collections (shared)           │
│  • Claude-Context collections            │
│  • Cognee collections                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Neo4j (Ports 7474/7687)            │
├─────────────────────────────────────────┤
│  • Knowledge graph nodes                 │
│  • Relationships                         │
│  • Used by Cognee for graph storage      │
└─────────────────────────────────────────┘
```

---

## 🧪 Testing Workflow

### Recommended sequence for testing:

1. **Inspect current state:**
   ```bash
   ./scripts/db-inspect.sh --full
   ```

2. **Clean all data (preserves structure):**
   ```bash
   ./scripts/db-clean.sh --force
   ```

3. **Verify clean state:**
   ```bash
   ./scripts/db-inspect.sh
   ```

4. **Full reset (if needed):**
   ```bash
   ./scripts/db-reinit.sh --force
   ```

5. **Verify reinit:**
   ```bash
   ./scripts/db-inspect.sh --full
   ```

---

## ⚠️ Important Notes

### Safety Features:
- All scripts require confirmation unless `--force` is used
- `db-clean.sh` preserves schemas/extensions
- `db-reinit.sh` fully drops and recreates everything
- API server automatically restarts to recreate pg-boss tables

### What Gets Cleaned:
✅ **db-clean.sh** (data only):
- Table data (TRUNCATE)
- Qdrant collections
- Neo4j graph data

✅ **db-reinit.sh** (structure + data):
- DROP/CREATE schema
- DROP/CREATE database
- Recreate extensions
- Run init scripts
- Clean all vectors and graphs

### Dependencies:
- `docker` - Required for all scripts
- `curl` - Required for Qdrant operations
- `jq` - Recommended for JSON parsing (optional)

---

## 🎯 Quick Reference

| Task | Command | Preserves Structure |
|------|---------|-------------------|
| **Inspect** | `./scripts/db-inspect.sh` | N/A |
| **Clean Data** | `./scripts/db-clean.sh --force` | ✅ Yes |
| **Full Reset** | `./scripts/db-reinit.sh --force` | ❌ No |
| **Reset + Containers** | `./scripts/db-reinit.sh --with-containers --force` | ❌ No |

---

## 🔍 Troubleshooting

### "cognee_db database does not exist"
- Normal if you haven't started Cognee yet
- Will be created automatically by `db-reinit.sh`

### "Neo4j container not running"
- Start it: `cd services && docker compose up -d neo4j`

### "Unable to reach Qdrant"
- Check container: `docker ps | grep qdrant`
- Start it: `cd services && docker compose up -d qdrant`

### "PostgreSQL container not running"
- Start all services: `cd services && docker compose up -d postgres qdrant neo4j`

---

## 📝 Change Log

### 2025-01-06
- ✅ Added `cognee_db` database support to all scripts
- ✅ Added Neo4j graph database support
- ✅ Updated `db-clean.sh` to clean both databases + Neo4j
- ✅ Updated `db-reinit.sh` to recreate cognee_db with extensions
- ✅ Updated `db-inspect.sh` to show all databases
- ✅ Added comprehensive help text
- ✅ Added environment variable documentation

---

**Status**: Ready for testing ✅  
**Compatibility**: Claude-Context + Cognee MCP  
**Services**: PostgreSQL, Qdrant, Neo4j
