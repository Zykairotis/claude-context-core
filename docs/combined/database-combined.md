# Combined Files from database

*Generated on: Thu Nov  6 09:52:37 AM EST 2025*

---

## File: DATABASE_INTEGRATION_ANALYSIS.md

**Path:** `DATABASE_INTEGRATION_ANALYSIS.md`

```markdown
# Database Integration Analysis: Claude-Context ↔ Cognee

> **Date:** 2025-11-06  
> **Status:** Both systems operational, sharing infrastructure

---

## 🏗️ Current Architecture

### Shared Infrastructure
- **PostgreSQL Server**: `localhost:5533` (shared)
- **Qdrant Server**: `localhost:6333` (shared)
- **Neo4j**: `localhost:7474` (Cognee only)

### Separate Databases

#### 1. **claude_context** (Claude-Context Project)
**Schema:** 17 tables
```
✓ chunks                 - Code/text chunks with embeddings
✓ documents              - Source files and metadata  
✓ projects               - Project/codebase management
✓ datasets               - Dataset isolation
✓ web_pages              - Crawled web content
✓ mesh_nodes/edges       - Graph structure
✓ collections_metadata   - Vector DB collection tracking
✓ github_jobs            - GitHub integration
✓ crawl_sessions         - Web crawling state
+ 8 more utility tables
```

**Qdrant Collections:** (Need to check)

**Purpose:**
- Code search and indexing
- AST-aware chunking
- Hybrid search (dense + sparse vectors)
- Web content indexing
- GitHub repository analysis

---

#### 2. **cognee_db** (Cognee Project)
**Schema:** 17 tables
```
✓ data                   - Raw data storage
✓ datasets               - Dataset management
✓ pipeline_runs          - Processing pipeline tracking
✓ queries                - Search query history
✓ results                - Search results cache
✓ graph_metrics          - Graph analytics
✓ graph_relationship_ledger - Relationship tracking
✓ acls/permissions/roles - Access control
✓ notebooks              - Jupyter-like notebooks
+ 8 more tables
```

**Qdrant Collections:** 6 collections
```
✓ TextSummary_text       - Document summaries
✓ DocumentChunk_text     - Text chunks
✓ Entity_name            - Extracted entities
✓ TextDocument_name      - Full documents
✓ EdgeType_relationship_name - Relationship types
✓ EntityType_name        - Entity type definitions
```

**Neo4j Graph:** Knowledge graph storage

**Purpose:**
- Knowledge graph construction
- Entity extraction & relationships
- Graph-based reasoning
- Multi-modal data support
- Advanced search types (15 types!)

---

## 🤔 Should You Merge or Keep Separate?

### ❌ **DO NOT Merge** - Here's Why:

1. **Different Schemas, Different Purposes**
   - Claude-Context: Optimized for **code search** (AST chunks, symbol extraction)
   - Cognee: Optimized for **knowledge graphs** (entities, relationships, reasoning)

2. **Different Data Models**
   - Claude-Context: Document → Chunks → Vectors (search-first)
   - Cognee: Document → Entities → Graph → Vectors (graph-first)

3. **Different Query Patterns**
   - Claude-Context: Fast vector similarity, hybrid search, reranking
   - Cognee: Graph traversal, relationship queries, chain-of-thought

4. **Maintenance Complexity**
   - Merging would require custom schema reconciliation
   - Updates to either system would break the other
   - Different upgrade paths

---

## ✅ **Better Approach: Complementary Usage**

### Strategy: Use Both for Different Strengths

```
┌─────────────────────────────────────────────────────┐
│                  Your Codebase                      │
│         /home/mewtwo/Zykairotis/crypto-depth        │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
               │                      │
       ┌───────▼────────┐     ┌──────▼───────────┐
       │ Claude-Context │     │     Cognee       │
       │                │     │                  │
       │ • Fast Search  │     │ • Knowledge Graph│
       │ • Code Chunks  │     │ • Entities       │
       │ • Symbols      │     │ • Relationships  │
       │ • Hybrid Rank  │     │ • Reasoning      │
       └────────────────┘     └──────────────────┘
               │                      │
               │                      │
               └──────────┬───────────┘
                          │
                    ┌─────▼─────┐
                    │   Your    │
                    │    API    │
                    │  Gateway  │
                    └───────────┘
```

---

## 🎯 Recommended Integration Patterns

### Pattern 1: **Dual Indexing** (Index same codebase in both)

**Benefits:**
- Use Claude-Context for fast code search
- Use Cognee for architectural understanding
- Cross-reference results

**Implementation:**
```bash
# Index in Claude-Context (existing)
npm run mcp:dev  # or your indexing command

# Index in Cognee (you just did this!)
python3 /tmp/upload_to_cognee.py
python3 /tmp/cognify_dataset.py
```

**Use Cases:**
- **"Find function X"** → Use Claude-Context (faster)
- **"How does X relate to Y?"** → Use Cognee (graph-aware)
- **"Explain architecture"** → Use Cognee (graph + LLM)
- **"Find similar code"** → Use Claude-Context (optimized)

---

### Pattern 2: **Query Federation** (Query both, merge results)

Create a unified API that:
1. Sends query to both systems
2. Merges and deduplicates results
3. Returns ranked combined results

**Example:**
```typescript
// pseudo-code
async function federatedSearch(query: string) {
  const [claudeResults, cogneeResults] = await Promise.all([
    claudeContext.search(query),
    cognee.search(query, { searchType: "CHUNKS" })
  ]);
  
  return mergeAndRank(claudeResults, cogneeResults);
}
```

---

### Pattern 3: **Specialized Routing** (Smart query routing)

Route queries based on intent:

```typescript
async function smartSearch(query: string) {
  const intent = detectIntent(query);
  
  switch(intent) {
    case 'code_search':
      return claudeContext.search(query);
    
    case 'architecture':
    case 'relationships':
      return cognee.search(query, { 
        searchType: "GRAPH_COMPLETION" 
      });
    
    case 'explanation':
      return cognee.search(query, { 
        searchType: "RAG_COMPLETION" 
      });
    
    case 'reasoning':
      return cognee.search(query, { 
        searchType: "GRAPH_COMPLETION_COT" 
      });
    
    default:
      return federatedSearch(query);
  }
}
```

---

### Pattern 4: **Cross-System Enrichment**

Use one system to enhance the other:

1. **Search in Claude-Context** → Get code chunks
2. **Send chunk IDs to Cognee** → Get entity relationships
3. **Combine** → Rich contextual results

```typescript
// Find code
const code = await claudeContext.search("MemoryPool");

// Get relationships from graph
const relationships = await cognee.cypher(`
  MATCH (n:Entity {name: "MemoryPool"})-[r]->(m)
  RETURN n, r, m
`);

return { code, relationships };
```

---

## 🛠️ Practical Implementation Options

### Option A: **Keep Separate, Use as Needed**
**Complexity:** ⭐ Low  
**Flexibility:** ⭐⭐⭐ High

- Use Claude-Context for daily code search
- Use Cognee when you need graph/reasoning
- Manual switching based on task

**Best for:** Experimentation, understanding capabilities

---

### Option B: **Build Thin API Gateway**
**Complexity:** ⭐⭐ Medium  
**Flexibility:** ⭐⭐⭐⭐ Very High

Create `/api/unified-search` that:
- Accepts standard query
- Routes to appropriate backend(s)
- Merges results
- Adds cross-references

**Best for:** Production use, team environments

---

### Option C: **Qdrant Collection Aliasing**
**Complexity:** ⭐⭐⭐ Medium-High  
**Flexibility:** ⭐⭐ Medium

Create Qdrant collection aliases that point to both systems:
```python
# Point to Claude-Context collections
qdrant.create_alias("unified_chunks", "claude_context_chunks")

# Point to Cognee collections  
qdrant.create_alias("unified_entities", "cognee_entities")
```

**Best for:** Unified vector search only

---

### Option D: **PostgreSQL Views** (Advanced)
**Complexity:** ⭐⭐⭐⭐ High  
**Flexibility:** ⭐⭐⭐⭐⭐ Maximum

Create cross-database views:
```sql
-- In claude_context
CREATE FOREIGN DATA WRAPPER postgres_fdw;

CREATE SERVER cognee_db_server
FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'postgres', dbname 'cognee_db', port '5432');

CREATE FOREIGN TABLE cognee_entities (...)
SERVER cognee_db_server
OPTIONS (schema_name 'public', table_name 'data');

-- Now can join across databases
SELECT 
  cc.chunk_text,
  ce.entity_name
FROM claude_context.chunks cc
JOIN cognee_entities ce ON cc.document_id = ce.data_id;
```

**Best for:** Complex analytics, reporting

---

## 📊 Performance Considerations

### Current Setup (Shared Infrastructure)

| Resource | Claude-Context | Cognee | Shared? |
|----------|----------------|--------|---------|
| PostgreSQL CPU | ~5% | ~3% | ✅ Yes |
| PostgreSQL Memory | ~200MB | ~150MB | ✅ Yes |
| Qdrant Memory | Varies | Varies | ✅ Yes |
| Disk I/O | Separate | Separate | ⚠️ Same disk |

**Recommendations:**
1. ✅ Keep sharing PostgreSQL (plenty of capacity)
2. ✅ Keep sharing Qdrant (collection isolation)
3. ⚠️ Monitor disk I/O if both systems index heavily
4. 💡 Consider separate Qdrant collections for complete isolation

---

## 🎯 My Recommendation

### **Use Pattern 1 + Pattern 3: Dual Indexing with Specialized Routing**

**Why:**
1. Index your codebase in **both** systems
2. Use each for its strengths:
   - **Claude-Context**: Fast code search, symbol lookup
   - **Cognee**: Architecture queries, explanations, reasoning
3. Keep databases separate (as they are)
4. Build a simple wrapper that routes queries intelligently

**Implementation:**
```typescript
// Simple unified wrapper
class UnifiedSearch {
  async search(query: string, options?: SearchOptions) {
    // Check query intent
    if (options?.type === 'code' || this.isCodeQuery(query)) {
      return this.claudeContext.search(query);
    }
    
    if (options?.type === 'graph' || this.isArchitectureQuery(query)) {
      return this.cognee.search(query, { 
        searchType: "GRAPH_COMPLETION" 
      });
    }
    
    // Default: try both, return best
    return this.federatedSearch(query);
  }
  
  private isCodeQuery(q: string): boolean {
    return /function|class|method|import|variable/.test(q);
  }
  
  private isArchitectureQuery(q: string): boolean {
    return /how|why|relate|connect|architecture|design/.test(q);
  }
}
```

---

## 🚀 Next Steps

### Immediate (No changes needed)
1. ✅ Continue using both systems as-is
2. ✅ Index same codebase in both
3. ✅ Use each for different query types

### Short-term (Optional)
1. Create simple query router script
2. Document query patterns for your team
3. Add examples of when to use each system

### Long-term (If needed)
1. Build unified API gateway
2. Add result fusion/ranking
3. Create monitoring dashboard
4. Consider PostgreSQL foreign tables for analytics

---

## 📝 Key Takeaways

### ✅ **KEEP SEPARATE**
- Different schemas → Different purposes
- Shared infrastructure → No wasted resources
- Complementary strengths → Better together

### 🎯 **USE BOTH**
- Claude-Context: Code search, fast retrieval
- Cognee: Knowledge graphs, reasoning, explanations

### 🔄 **INTEGRATE SMARTLY**
- Dual indexing: Same data, different views
- Query routing: Right tool for the job
- Cross-enrichment: Best of both worlds

### 🚫 **DON'T MERGE**
- Maintenance nightmare
- Loss of specialized optimizations
- Fragile and complex

---

## 📚 Reference Commands

### Index in Both Systems
```bash
# Claude-Context
cd /home/mewtwo/Zykairotis/claude-context-core
npm run index:codebase

# Cognee
cd /home/mewtwo/Zykairotis/claude-context-core/services
python3 /tmp/upload_to_cognee.py
python3 /tmp/cognify_dataset.py
```

### Query Both Systems
```bash
# Claude-Context (via MCP)
# Use your existing tools

# Cognee
curl -X POST "http://localhost:8340/api/v1/search" \
  -H "Authorization: Bearer local-development-only" \
  -H "Content-Type: application/json" \
  -d '{"searchType": "CHUNKS", "query": "your query", ...}'
```

---

**Conclusion:** Keep them separate, use both strategically! 🎉

```

---

## File: DBEAVER_CONNECTION_GUIDE.md

**Path:** `DBEAVER_CONNECTION_GUIDE.md`

```markdown
# 🔌 DBeaver Connection Guide for PostgreSQL

**Database:** claude_context  
**Location:** Docker container (claude-context-postgres)

---

## 📋 Connection Details

### **Basic Connection Information**

```
Host:        localhost
Port:        5533
Database:    claude_context
Username:    postgres
Password:    code-context-secure-password
```

### **Full Connection URL**
```
jdbc:postgresql://localhost:5533/claude_context
```

**With credentials:**
```
jdbc:postgresql://localhost:5533/claude_context?user=postgres&password=code-context-secure-password
```

---

## 🚀 Quick Setup in DBeaver

### **Step 1: Create New Database Connection**

1. Open DBeaver
2. Click **Database** → **New Database Connection** (or `Ctrl+Shift+D`)
3. Select **PostgreSQL** from the list
4. Click **Next**

### **Step 2: Enter Connection Details**

In the **Main** tab:

| Field | Value |
|-------|-------|
| **Host:** | `localhost` |
| **Port:** | `5533` |
| **Database:** | `claude_context` |
| **Username:** | `postgres` |
| **Password:** | `code-context-secure-password` |
| **Show all databases:** | ✅ (Optional, to see other DBs) |

### **Step 3: Test Connection**

1. Click **Test Connection** button
2. If prompted to download PostgreSQL driver, click **Download**
3. You should see: **Connected** ✅

### **Step 4: Save and Connect**

1. Click **Finish**
2. The connection will appear in the **Database Navigator**
3. Expand it to see schemas and tables

---

## 🔧 Advanced Configuration

### **Connection URL (Manual)**

If you prefer to use the connection URL directly:

1. In DBeaver, select your PostgreSQL connection
2. Right-click → **Edit Connection**
3. Go to **Main** tab
4. Click **Use URL** checkbox
5. Enter:
   ```
   jdbc:postgresql://localhost:5533/claude_context
   ```

---

## 📊 Schema Information

### **Default Schema**
The database uses the `claude_context` schema (not `public`).

### **Key Tables (Once Created)**
- `chunks_*` - Vector chunks for different collections
- `projects` - Project metadata
- `datasets` - Dataset information
- `web_pages` - Crawled web pages
- `ingestion_jobs` - Job tracking

### **View Schema in DBeaver**

1. Connect to the database
2. Expand: `claude_context` → `Schemas` → `claude_context`
3. Expand `Tables` to see all tables
4. Expand `Views` to see all views
5. Expand `Functions` to see stored procedures

---

## 🔍 Quick Queries to Explore

### **1. List All Tables**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'claude_context'
ORDER BY table_name;
```

### **2. Check pgvector Extension**
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### **3. View Table Structures**
```sql
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'claude_context'
ORDER BY table_name, ordinal_position;
```

### **4. Count Records by Project**
```sql
SELECT 
    project,
    COUNT(*) as chunk_count
FROM claude_context.chunks_atlas
GROUP BY project;
```

### **5. Check Recent Ingestion Jobs**
```sql
SELECT 
    id,
    project,
    dataset,
    status,
    started_at,
    completed_at
FROM claude_context.ingestion_jobs
ORDER BY started_at DESC
LIMIT 10;
```

---

## 🛠️ Troubleshooting

### **Issue: Connection Refused**

**Check if container is running:**
```bash
docker ps | grep postgres
```

**Should show:**
```
claude-context-postgres   Up ...   0.0.0.0:5533->5432/tcp
```

**If not running, start it:**
```bash
cd services
docker-compose up -d postgres
```

---

### **Issue: Authentication Failed**

**Verify the password:**
```bash
docker exec claude-context-postgres psql -U postgres -d claude_context -c "SELECT version();"
```

**If this works, the password is correct.**

---

### **Issue: Database Does Not Exist**

**Check if database exists:**
```bash
docker exec claude-context-postgres psql -U postgres -l | grep claude_context
```

**If it doesn't exist, it will be created automatically on first ingestion.**

---

### **Issue: Can't See Tables**

**Check schema:**
1. In DBeaver, make sure you're looking at the `claude_context` schema
2. Not the `public` schema

**List schemas:**
```sql
SELECT schema_name FROM information_schema.schemata;
```

---

## 🎨 DBeaver Tips

### **1. Enable SQL Editor**
- Right-click database → **SQL Editor** → **New SQL Script**
- Or press `Ctrl+\`

### **2. View Table Data**
- Right-click table → **View Data**
- Or double-click the table

### **3. View Table Structure**
- Right-click table → **Properties** → **Columns** tab

### **4. Export Data**
- Right-click table → **Export Data**
- Choose format (CSV, JSON, SQL, etc.)

### **5. Import Data**
- Right-click table → **Import Data**
- Choose source file format

---

## 🔐 Security Note

**Default Password:** `code-context-secure-password`

**To Change Password:**

1. Check your `.env` file or environment variable:
   ```bash
   echo $POSTGRES_PASSWORD
   ```

2. Or check docker-compose:
   ```bash
   grep POSTGRES_PASSWORD services/docker-compose.yml
   ```

3. Update password in docker-compose.yml:
   ```yaml
   POSTGRES_PASSWORD: your-new-password
   ```

4. Restart container:
   ```bash
   docker-compose restart postgres
   ```

5. Update DBeaver connection with new password

---

## 📈 Useful DBeaver Views

### **Database Navigator Tree**
```
claude-context-postgres (PostgreSQL)
└── Databases
    └── claude_context
        ├── Schemas
        │   └── claude_context
        │       ├── Tables
        │       │   ├── chunks_*
        │       │   ├── projects
        │       │   ├── datasets
        │       │   └── ...
        │       ├── Views
        │       ├── Functions
        │       └── ...
        └── ...
```

### **ER Diagram**
1. Right-click database → **View Diagram**
2. Or select multiple tables → Right-click → **View ER Diagram**

---

## 🚀 Quick Connection Test

### **Using psql (CLI)**
```bash
psql -h localhost -p 5533 -U postgres -d claude_context
```

**Password:** `code-context-secure-password`

### **Using DBeaver SQL Editor**
```sql
-- Test connection
SELECT version();

-- List databases
\l

-- List schemas
\dn

-- List tables
\dt claude_context.*
```

---

## 📝 Connection Summary Card

```
╔════════════════════════════════════════════════╗
║  DBeaver PostgreSQL Connection Details        ║
╠════════════════════════════════════════════════╣
║  Host:     localhost                          ║
║  Port:     5533                               ║
║  Database: claude_context                     ║
║  User:     postgres                           ║
║  Password: code-context-secure-password        ║
║                                               ║
║  JDBC URL:                                    ║
║  jdbc:postgresql://localhost:5533/           ║
║               claude_context                  ║
╚════════════════════════════════════════════════╝
```

---

## ✅ Verification Checklist

Before connecting:
- [ ] Docker container is running (`docker ps | grep postgres`)
- [ ] Port 5533 is accessible
- [ ] PostgreSQL is healthy (`docker logs claude-context-postgres | tail -5`)
- [ ] Password is correct (default: `code-context-secure-password`)

After connecting:
- [ ] Can see database in navigator
- [ ] Can see `claude_context` schema
- [ ] Can execute test query (`SELECT version();`)
- [ ] Can browse tables (if any exist)

---

## 🎯 Next Steps

1. **Connect** to the database using DBeaver
2. **Explore** the `claude_context` schema
3. **Run queries** to inspect data
4. **Monitor** ingestion jobs and chunks
5. **Visualize** data relationships with ER diagrams

---

**Happy Database Exploration! 🚀**

For issues, check:
- Container logs: `docker logs claude-context-postgres`
- Connection test: `docker exec claude-context-postgres pg_isready -U postgres`
- Port access: `netstat -tuln | grep 5533`


```

---

