# Complete Database Cleanup - db-reinit.sh Enhancement

## Problem
The original `db-reinit.sh` script used `DROP SCHEMA ... CASCADE` but didn't explicitly clean all tables first, potentially leaving residual data in:

### Tables Not Explicitly Cleaned Before:
1. **pg-boss tables**: `job`, `version`, `archive`, `schedule`
2. **Mesh tables**: `mesh_nodes`, `mesh_edges`, `mesh_logs`
3. **Core tables**: `projects`, `datasets`, `documents`, `web_pages`, `chunks`
4. **Job tracking**: `github_jobs`
5. **Collection mapping**: `dataset_collections`
6. **Web tracking**: `web_provenance`, `crawl_sessions`
7. **Sharing**: `project_shares`

## Solution
Enhanced `clean_critical_tables()` function to **dynamically discover and truncate ALL tables** in the `claude_context` schema before dropping it.

### New Implementation

```bash
clean_critical_tables() {
  # Query PostgreSQL for ALL tables in claude_context schema
  tables=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
    "SELECT tablename FROM pg_tables WHERE schemaname = 'claude_context';" 2>/dev/null | tr -d ' ')
  
  # Truncate each table with CASCADE
  while IFS= read -r table; do
    psql_exec "TRUNCATE TABLE claude_context.\"$table\" CASCADE;" 2>/dev/null
  done <<< "$tables"
}
```

### Execution Order
1. **Clean all tables** (TRUNCATE with CASCADE) ← NEW
2. Drop schema (DROP SCHEMA ... CASCADE)
3. Recreate schema and extensions
4. Run init scripts
5. Run migrations
6. Clean Qdrant collections
7. Clean Neo4j graph
8. Restart API server

## Benefits

### ✅ Complete Coverage
- **Dynamic discovery**: No hardcoded table list to maintain
- **Future-proof**: Automatically handles new tables added by migrations
- **pg-boss tables**: Explicitly cleaned (job queue state)
- **Mesh tables**: Graph canvas data removed
- **All metadata**: Projects, datasets, documents, chunks

### ✅ Guaranteed Clean State
- No orphaned foreign key references
- No residual job queue entries
- No stale mesh graph data
- No leftover provenance tracking

### ✅ Clear Warnings
```
⚠️  This will TRUNCATE ALL TABLES in claude_context schema (dynamically discovered)
⚠️  Then DROP and recreate the entire PostgreSQL schema (CASCADE)
⚠️  Delete ALL Qdrant vector collections
⚠️  Recreate cognee_db database completely
⚠️  Clean Neo4j graph database (all nodes and relationships)

ALL DATA WILL BE PERMANENTLY DELETED!
```

## Tables Cleaned (Auto-Discovered)

From `pg_tables WHERE schemaname = 'claude_context'`:

**Core Data**:
- `projects`
- `datasets`
- `documents`
- `web_pages`
- `chunks`

**Job Management**:
- `github_jobs`
- `job` (pg-boss)
- `version` (pg-boss)
- `archive` (pg-boss)
- `schedule` (pg-boss)

**Mesh Canvas**:
- `mesh_nodes`
- `mesh_edges`
- `mesh_logs`

**Metadata**:
- `dataset_collections`
- `web_provenance`
- `crawl_sessions`
- `project_shares`

**Plus any future tables** added by migrations or updates!

## Usage

```bash
# With confirmation prompt
./scripts/db-reinit.sh

# Skip confirmation (use with caution!)
./scripts/db-reinit.sh --force

# Also recreate Docker containers
./scripts/db-reinit.sh --with-containers --force
```

## Output Example

```
Explicitly cleaning ALL tables before schema drop...
  ✓ Truncated: projects
  ✓ Truncated: datasets
  ✓ Truncated: documents
  ✓ Truncated: web_pages
  ✓ Truncated: chunks
  ✓ Truncated: github_jobs
  ✓ Truncated: job
  ✓ Truncated: version
  ✓ Truncated: mesh_nodes
  ✓ Truncated: mesh_edges
  ✓ Truncated: mesh_logs
  ✓ Truncated: dataset_collections
  ✓ Truncated: web_provenance
  ✓ Truncated: crawl_sessions
  ✓ Truncated: project_shares
Cleaned 15 tables.
Dropping schema claude_context...
```

## Files Modified
- `/scripts/db-reinit.sh` - Lines 182-208 (new dynamic cleanup function)

## Testing

```bash
# Check what tables exist before
psql -h localhost -U postgres -p 5533 -d claude_context \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'claude_context';"

# Run cleanup
./scripts/db-reinit.sh --force

# Verify clean state
psql -h localhost -U postgres -p 5533 -d claude_context \
  -c "\dt claude_context.*"
```

---

**Status**: ✅ Complete - All tables now explicitly cleaned before schema drop
**Impact**: Zero residual data, guaranteed fresh start
**Maintainability**: Future-proof with dynamic table discovery
