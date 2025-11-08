# Incremental Sync - Quick Start Guide

> **Fast, efficient codebase updates using SHA256 change detection**

## What Is It?

Incremental Sync tracks file changes and only re-indexes what changed instead of processing the entire codebase every time.

### Performance

| Scenario | Full Reindex | Incremental Sync | Speedup |
|----------|--------------|------------------|---------|
| 3 files changed (out of 1000) | 30s | 450ms | **67x faster** |
| 20 files changed | 30s | 2.5s | **12x faster** |
| 200 files changed | 30s | 8s | **3.75x faster** |

### Cost Savings

- **Full reindex**: 1000 files × 20 chunks = 20,000 embedding API calls
- **Incremental (3 files)**: 3 files × 20 chunks = 60 embedding API calls
- **Savings**: **99.7% fewer API calls** 💰

---

## Setup (One-Time)

### 1. Run Migration

```bash
cd /path/to/claude-context-core
./scripts/migrate-add-indexed-files.sh
```

This creates the `indexed_files` table for tracking file metadata.

### 2. Initial Full Index

```typescript
// First time: full index (populates file metadata)
claudeContext.indexLocal({
    path: "/home/user/my-project",
    project: "my-project"
});

// ✅ All 1000 files indexed (~30 seconds)
// ✅ File metadata stored in database
```

---

## Daily Usage

### Fast Incremental Sync

```typescript
// Edit 3 files, create 1 new file, delete 1 old file

claudeContext.syncLocal({
    path: "/home/user/my-project"
});

// ✅ Only 5 files processed (~500ms)
// ✅ Database automatically updated
```

### Output Example

```
✅ Sync completed in 487ms

Files:
  • Created: 1
  • Modified: 3
  • Deleted: 1
  • Unchanged: 995

Chunks:
  • Added: 42
  • Removed: 18
  • Total: 19,524
```

---

## How It Works

### 1. Change Detection

```typescript
// SHA256 hash calculated for each file
const hash = crypto.createHash('sha256')
    .update(fileContent)
    .digest('hex');

// Compare with stored hash
if (currentHash !== storedHash) {
    // File changed! Re-index it
}
```

### 2. CRUD Operations

| Change Type | Action |
|-------------|--------|
| **Created** | Index new file → Store chunks → Record metadata |
| **Modified** | Delete old chunks → Index new version → Update metadata |
| **Deleted** | Delete all chunks → Remove metadata |
| **Unchanged** | Skip (no processing needed) |

---

## API Reference

### claudeContext.syncLocal

```typescript
claudeContext.syncLocal({
    path: string,           // Required: absolute path to codebase
    project?: string,       // Optional: uses default if not provided
    dataset?: string,       // Optional: defaults to directory name
    force?: boolean         // Optional: treat all files as changed (default: false)
})
```

### Response

```typescript
{
    status: "completed",
    stats: {
        filesScanned: 1000,
        filesCreated: 1,
        filesModified: 3,
        filesDeleted: 1,
        filesUnchanged: 995,
        chunksAdded: 42,
        chunksRemoved: 18,
        durationMs: 487
    },
    changes: {
        created: ["src/new-feature.ts"],
        modified: ["src/config.ts", "README.md", "package.json"],
        deleted: ["src/old-code.ts"]
    }
}
```

---

## Use Cases

### Active Development

```bash
# Morning: Start fresh
claudeContext.syncLocal({ path: "/home/user/project" })

# Throughout the day: quick syncs after changes
claudeContext.syncLocal({ path: "/home/user/project" })
claudeContext.syncLocal({ path: "/home/user/project" })
claudeContext.syncLocal({ path: "/home/user/project" })

# Each sync: <1 second for small changes
```

### After Git Pull

```bash
# Pulled 15 changed files
git pull origin main

# Quick sync to update index
claudeContext.syncLocal({ path: "/home/user/project" })
# ✅ 15 files updated in ~2 seconds
```

### Major Refactoring

```bash
# Refactored 200 files
mv src/old-structure src/new-structure
# ... massive changes ...

# Force full re-scan if needed
claudeContext.syncLocal({ 
    path: "/home/user/project",
    force: true  // Treats all files as changed
})
```

---

## CLI Usage (Direct API)

```bash
# Incremental sync via API
curl -X POST http://localhost:3030/projects/my-project/ingest/local/sync \
  -H "Content-Type: application/json" \
  -d '{"path":"/home/user/project"}'

# Response
{
  "status": "completed",
  "stats": {
    "filesScanned": 1000,
    "filesCreated": 1,
    "filesModified": 3,
    "filesDeleted": 1,
    "filesUnchanged": 995,
    "chunksAdded": 42,
    "chunksRemoved": 18,
    "durationMs": 487
  }
}
```

---

## Troubleshooting

### "Table 'indexed_files' does not exist"

Run the migration script:
```bash
./scripts/migrate-add-indexed-files.sh
```

### "All files showing as changed"

First run after migration is a full index. Subsequent runs will be incremental.

### Files not being detected

Check that:
1. Docker volume is mounted: `/home/user:/home/user:ro` in docker-compose.yml
2. Paths are absolute (start with `/`)
3. API server has been restarted after volume mount changes

### Sync is slow

Check how many files changed:
- 1-20 files: Should be <2 seconds
- 20-100 files: Should be <5 seconds
- 100+ files: Consider using `force: true` for full reindex

---

## Database Details

### indexed_files Table Schema

```sql
CREATE TABLE claude_context.indexed_files (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    dataset_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,        -- Content hash for change detection
    file_size BIGINT NOT NULL,
    last_indexed_at TIMESTAMPTZ,
    chunk_count INTEGER,
    language TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(project_id, dataset_id, file_path)
);
```

### Query File Metadata

```sql
-- Show indexed files for a project
SELECT 
    relative_path,
    language,
    chunk_count,
    last_indexed_at,
    file_size
FROM claude_context.indexed_files
WHERE project_id = (SELECT id FROM claude_context.projects WHERE name = 'my-project')
ORDER BY last_indexed_at DESC
LIMIT 20;
```

---

## Migration from indexLocal

No breaking changes! Both tools work:

```typescript
// Old way (still works): full reindex every time
claudeContext.indexLocal({ path: "/path" })

// New way: incremental updates
claudeContext.syncLocal({ path: "/path" })
```

**Recommendation**: Use `indexLocal` once, then `syncLocal` for updates.

---

## What's Next?

### Planned Features

1. **File Watching** - Auto-sync on file changes using `chokidar`
2. **Rename Detection** - Detect file renames (same content, different path)
3. **Batch Optimization** - Parallel processing for large changesets
4. **Smart Scheduling** - Auto-sync during idle periods

### See Also

- **Full Documentation**: [`docs/incremental-sync/INCREMENTAL-SYNC.md`](./INCREMENTAL-SYNC.md)
- **Scripts Reference**: [`scripts/README.md`](../scripts/README.md)
- **Local Indexing Guide**: [`docs/deployment/LOCAL-INDEXING-GUIDE.md`](../deployment/LOCAL-INDEXING-GUIDE.md)
- **Docker Volume Setup**: [`docs/deployment/DOCKER-VOLUME-SETUP.md`](../deployment/DOCKER-VOLUME-SETUP.md)

---

## Summary

✅ **One-time setup**: Run migration script  
✅ **First index**: Use `indexLocal` to populate metadata  
✅ **Daily usage**: Use `syncLocal` for fast updates  
✅ **Result**: 10-67x faster indexing for typical changes  

**Happy coding!** 🚀
