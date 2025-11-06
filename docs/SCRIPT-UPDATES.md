# Database Scripts Updated for New Tables ✅

**Date**: November 4, 2025  
**Status**: Complete  
**Reason**: Added mesh canvas and web provenance tables

---

## New Database Tables Added

### 1. Mesh Canvas Tables (`mesh_tables.sql`)
- **mesh_nodes** - Stores node metadata (type, position, status, data)
- **mesh_edges** - Stores connections between nodes
- **mesh_logs** - Stores node execution logs

**Purpose**: Backend storage for the mesh canvas UI

### 2. Web Provenance Table (`web_provenance.sql`)
- **web_provenance** - Tracks web page indexing history and changes

**Purpose**: Incremental re-indexing and change detection for web content

---

## Scripts Updated

### ✅ 1. `db-reinit.sh` - Database Reinitialization

**Changes Made**:
- Added `run_migrations()` call after `run_init_scripts()`
- Migrations now applied in order:
  1. `web_provenance.sql` 
  2. `mesh_tables.sql`

**What It Does Now**:
```bash
./scripts/db-reinit.sh

# Flow:
1. Drop schema
2. Create schema + extensions
3. Run init scripts (01, 02, 03)
4. Run migrations (NEW: web_provenance, mesh_tables)
5. Clean Qdrant collections
6. Restart API server
7. Show summary
```

**Migration Function** (lines 185-207):
```bash
run_migrations() {
  local migrations_dir="$ROOT_DIR/services/migrations"
  
  if [[ ! -d "$migrations_dir" ]]; then
    say "$YELLOW" "No migrations directory found, skipping migrations."
    return
  fi

  local migrations=(
    "$migrations_dir/web_provenance.sql"
    "$migrations_dir/mesh_tables.sql"
  )

  for migration in "${migrations[@]}"; do
    if [[ ! -f "$migration" ]]; then
      say "$YELLOW" "Migration not found: $migration (skipping)"
      continue
    fi

    say "$YELLOW" "Running migration: $(basename "$migration")"
    docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$migration"
  done
}
```

---

### ✅ 2. `db-inspect.sh` - Database Inspection

**Changes Made**:
- Added **Mesh Nodes Summary** section
- Added **Web Provenance Summary** section

**New Output Sections**:
```bash
./scripts/db-inspect.sh

# Now shows:
...
Mesh Nodes Summary
- Groups by project, type, status
- Shows count per combination

Web Provenance Summary  
- Groups by domain
- Shows page count and last indexed time
- Top 10 domains by page count
```

**Lines Added** (135-141):
```bash
echo
say "$MAGENTA" "Mesh Nodes Summary"
psql_exec -c "SELECT project, type, status, COUNT(*) as count 
              FROM claude_context.mesh_nodes 
              GROUP BY project, type, status 
              ORDER BY project, type;" || true

echo
say "$MAGENTA" "Web Provenance Summary"
psql_exec -c "SELECT domain, COUNT(*) as pages, MAX(last_indexed_at) as last_indexed 
              FROM claude_context.web_provenance 
              GROUP BY domain 
              ORDER BY pages DESC 
              LIMIT 10;" || true
```

---

### ✅ 3. `db-clean.sh` - Database Cleanup

**Status**: No changes needed! ✅

**Why**: The script auto-discovers all tables:
```bash
truncate_postgres() {
  # This query finds ALL tables in claude_context schema
  qualified_tables=$(psql_sql "SELECT string_agg(format('claude_context.%I', tablename), ', ') 
                                FROM pg_tables 
                                WHERE schemaname = 'claude_context';")
  
  # Truncates everything (including new mesh and web tables)
  psql_exec "TRUNCATE $qualified_tables RESTART IDENTITY CASCADE;"
}
```

**Result**: New tables automatically cleaned on `./scripts/db-clean.sh`

---

## Files Created

### 1. Migration File
**File**: `/services/migrations/web_provenance.sql` (NEW)

**Contents**:
- Creates `web_provenance` table
- Adds indexes on domain, last_indexed, version
- Adds GIN index on metadata JSONB
- Creates auto-update trigger for `updated_at`
- Grants permissions
- Adds documentation comments

**Schema**:
```sql
CREATE TABLE web_provenance (
  url TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  first_indexed_at TIMESTAMPTZ NOT NULL,
  last_indexed_at TIMESTAMPTZ NOT NULL,
  last_modified_at TIMESTAMPTZ,
  content_hash TEXT,
  version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

### 2. Existing Migration
**File**: `/services/migrations/mesh_tables.sql` (already created)

**Contents**:
- Creates `mesh_nodes`, `mesh_edges`, `mesh_logs` tables
- Adds foreign key constraints
- Creates indexes for performance
- Adds auto-update triggers
- Includes sample data for testing

---

## Testing the Updates

### Test 1: Reinitialize Database

```bash
# Full reinitialization with new tables
./scripts/db-reinit.sh --force

# Expected output:
# ✓ Dropping schema claude_context...
# ✓ Recreating schema and extensions...
# ✓ Running init script: 01-init-pgvector.sql
# ✓ Running init script: 02-init-schema.sql
# ✓ Running init script: 03-github-jobs.sql
# ✓ Running migration: web_provenance.sql       <-- NEW
# ✓ Running migration: mesh_tables.sql          <-- NEW
# ✓ Deleting Qdrant collections...
# ✓ Reinitialization complete.
```

### Test 2: Inspect Database

```bash
# Check new tables are visible
./scripts/db-inspect.sh

# Expected new sections:
# Mesh Nodes Summary
# (Shows sample data if present)
#
# Web Provenance Summary
# (Empty initially)
```

### Test 3: Clean Database

```bash
# Clean all data
./scripts/db-clean.sh --force

# Verify mesh and web tables are truncated
./scripts/db-inspect.sh

# Expected:
# Mesh Nodes Summary: (empty)
# Web Provenance Summary: (empty)
```

---

## Migration Management

### Current Migration Files

```
services/migrations/
├── web_provenance.sql   (NEW - web page tracking)
└── mesh_tables.sql      (NEW - mesh canvas backend)
```

### Adding Future Migrations

**Process**:
1. Create new `.sql` file in `services/migrations/`
2. Add filename to `run_migrations()` array in `db-reinit.sh`
3. Test with `./scripts/db-reinit.sh --force`
4. Update `db-inspect.sh` if new tables need monitoring

**Example**:
```bash
# Add new migration
echo "CREATE TABLE my_new_table ..." > services/migrations/my_feature.sql

# Update db-reinit.sh
# Add to migrations array:
local migrations=(
  "$migrations_dir/web_provenance.sql"
  "$migrations_dir/mesh_tables.sql"
  "$migrations_dir/my_feature.sql"    # <-- Add here
)
```

---

## Directory Structure

```
claude-context-core/
├── scripts/
│   ├── db-reinit.sh     ✅ Updated - runs migrations
│   ├── db-inspect.sh    ✅ Updated - shows new tables
│   ├── db-clean.sh      ✅ No change needed (auto-discovers)
│   └── README.md        (documents all scripts)
│
└── services/
    ├── init-scripts/    (Run during schema creation)
    │   ├── 01-init-pgvector.sql
    │   ├── 02-init-schema.sql
    │   └── 03-github-jobs.sql
    │
    └── migrations/      (Run after init, for new features)
        ├── web_provenance.sql  ✅ NEW
        └── mesh_tables.sql     ✅ NEW
```

---

## Backward Compatibility

### Existing Deployments

**Scenario**: Database already exists without new tables

**Solution**: Run migrations manually
```bash
# Option 1: Run specific migration
psql -h localhost -U postgres -d claude_context \
  -f services/migrations/web_provenance.sql

psql -h localhost -U postgres -d claude_context \
  -f services/migrations/mesh_tables.sql

# Option 2: Full reinit (DANGER: drops all data)
./scripts/db-reinit.sh
```

### New Deployments

**Scenario**: Fresh database setup

**Solution**: Reinit script handles everything
```bash
./scripts/db-reinit.sh --force
# All init scripts + migrations run automatically
```

---

## Summary

### What Changed
✅ Created `web_provenance.sql` migration  
✅ Updated `db-reinit.sh` to run migrations  
✅ Updated `db-inspect.sh` to show new tables  
✅ Verified `db-clean.sh` auto-handles new tables  

### What Didn't Change
✅ Init scripts remain unchanged  
✅ Core database structure preserved  
✅ Existing tables unaffected  

### Benefits
✅ Migrations now automatically applied on reinit  
✅ New tables visible in inspection output  
✅ Clean script works correctly  
✅ Easy to add future migrations  

---

## Quick Reference

```bash
# Reinitialize everything (with new tables)
./scripts/db-reinit.sh --force

# Inspect database (see new tables)
./scripts/db-inspect.sh

# Clean all data (including new tables)
./scripts/db-clean.sh --force

# Apply migrations manually (existing DB)
psql -h localhost -U postgres -d claude_context \
  -f services/migrations/web_provenance.sql \
  -f services/migrations/mesh_tables.sql
```

---

**Status**: ✅ **All Scripts Updated and Tested**

The database scripts now properly handle the new mesh canvas and web provenance tables!
