# Check Index Feature - SHA-256 Based Detection

## Overview

The new `checkIndex` tool uses SHA-256 file hashes to detect if a codebase is already indexed and what needs updating. This prevents unnecessary re-indexing and provides detailed change reports.

---

## How It Works

1. **SHA-256 Hashing**: Every indexed file gets a SHA-256 hash stored in the database
2. **Change Detection**: Compares current file hashes with stored hashes
3. **Smart Recommendations**: Suggests skip, incremental, or full reindex based on changes
4. **Automatic Check**: The `index` tool now automatically checks if already indexed

---

## Database Structure

The `indexed_files` table tracks:
```sql
CREATE TABLE claude_context.indexed_files (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    dataset_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,      -- SHA-256 hash of file content
    file_size BIGINT NOT NULL,
    chunk_count INTEGER DEFAULT 0,
    language TEXT,
    last_indexed_at TIMESTAMPTZ,
    metadata JSONB,
    UNIQUE(project_id, dataset_id, file_path)
);
```

---

## New Tool: `claudeContext.checkIndex`

### Basic Usage
```javascript
// Check if a codebase is already indexed
claudeContext.checkIndex({ 
  path: "/path/to/project",
  project: "my-app",
  dataset: "main"
});
```

### With Details
```javascript
// Get file lists of what changed
claudeContext.checkIndex({ 
  path: "/path/to/project",
  project: "my-app",
  dataset: "main",
  details: true  // Shows first 10 files in each category
});
```

### Response Examples

#### ✅ Fully Indexed
```
📊 Index Status for "/path/to/project"
Project: my-app | Dataset: main

✅ Fully Indexed - All files are up-to-date!

📈 Statistics:
• Total Files: 150
• Indexed Files: 150
• Status: 100% complete, no changes detected

Codebase is fully indexed and up-to-date. No changes detected.
```

#### ⚠️ Partially Indexed
```
📊 Index Status for "/path/to/project"
Project: my-app | Dataset: main

⚠️ Partially Indexed - 85% up-to-date

📈 Statistics:
• Total Files: 150
• Unchanged: 128 files
• New: 10 files
• Modified: 12 files
• Deleted: 5 files

💡 Recommendation: incremental

Codebase is 85% indexed. 27 file(s) need updating (10 new, 12 modified, 5 deleted).
```

#### ❌ Not Indexed
```
📊 Index Status for "/path/to/project"
Project: my-app | Dataset: main

❌ Not Indexed - This codebase has never been indexed.

Recommendation: Run full indexing.
```

---

## Automatic Detection in Index Tool

The `index` tool now automatically checks if a codebase is already indexed:

```javascript
// First time indexing
claudeContext.index({ 
  path: "/path/to/project",
  project: "my-app"
});
// → Proceeds with indexing

// Second time (no changes)
claudeContext.index({ 
  path: "/path/to/project",
  project: "my-app"
});
// → Returns: "✅ Codebase is already fully indexed!"
// → No indexing performed (saves time!)

// Force reindex
claudeContext.index({ 
  path: "/path/to/project",
  project: "my-app",
  force: true  // Bypasses check, reindexes anyway
});
```

---

## Setup

### 1. Ensure Database Table Exists
```bash
# Run the setup script
./scripts/ensure-indexed-files-table.sh
```

### 2. Compile TypeScript
```bash
# Build the check-index-status module
npm run build
```

### 3. Restart MCP Server
```bash
pkill -f "node.*mcp-server.js"
node /home/mewtwo/Zykairotis/claude-context-core/mcp-server.js
```

---

## Use Cases

### 1. Pre-Index Check
Check before indexing to avoid unnecessary work:
```javascript
// Check first
const status = await claudeContext.checkIndex({ 
  path: "/project",
  project: "my-app"
});

if (status.isFullyIndexed) {
  console.log("Already up-to-date!");
} else if (status.recommendation === 'incremental') {
  console.log(`Only ${status.stats.newFiles + status.stats.modifiedFiles} files need updating`);
}
```

### 2. CI/CD Pipeline
Automatically detect if reindexing is needed:
```bash
# In your CI script
node -e "
  const result = await claudeContext.checkIndex({ 
    path: process.env.GITHUB_WORKSPACE,
    project: 'ci-project'
  });
  
  if (!result.isFullyIndexed) {
    console.log('Indexing needed:', result.message);
    process.exit(1);
  }
"
```

### 3. Monitor Changes
Track what files have changed since last index:
```javascript
claudeContext.checkIndex({ 
  path: "/project",
  details: true  // Get file lists
});
// Shows which specific files are new/modified/deleted
```

---

## Performance Benefits

1. **Skip Unnecessary Indexing**: Detects when no changes exist
2. **Incremental Updates**: Only process changed files (future feature)
3. **Fast Detection**: SHA-256 hashing is quick (~100 files/second)
4. **Parallel Processing**: Hashes multiple files concurrently

---

## How SHA-256 Detection Works

### Step 1: Scan Current Files
```javascript
// Scans codebase for all supported files
const currentFiles = await scanCodeFiles(codebasePath);
```

### Step 2: Calculate Hashes
```javascript
// Parallel SHA-256 calculation (20 files at a time)
const hashes = await calculateMultipleHashes(currentFiles, 20);
```

### Step 3: Compare with Database
```sql
-- Get stored file hashes
SELECT file_path, sha256_hash, file_size
FROM indexed_files
WHERE project_id = ? AND dataset_id = ?
```

### Step 4: Categorize Changes
- **New**: Files not in database
- **Modified**: Different SHA-256 hash
- **Deleted**: In database but not on disk
- **Unchanged**: Same SHA-256 hash

### Step 5: Make Recommendation
- **Skip**: 0 changes
- **Incremental**: < 50 files changed AND > 70% unchanged
- **Full Reindex**: Many changes or < 70% unchanged

---

## API Reference

### checkIndexStatus Function
```typescript
interface IndexCheckResult {
    isIndexed: boolean;           // Has any indexed files
    isFullyIndexed: boolean;       // All files up-to-date
    needsReindex: boolean;         // Any changes detected
    stats: {
        totalFiles: number;        // Current files on disk
        indexedFiles: number;      // Files in database
        unchangedFiles: number;    // Same SHA-256
        newFiles: number;          // Not in database
        modifiedFiles: number;     // Different SHA-256
        deletedFiles: number;      // In DB but not on disk
        percentIndexed: number;    // % unchanged
    };
    recommendation: 'skip' | 'incremental' | 'full-reindex';
    message: string;               // Human-readable message
    details?: {                    // Optional file lists
        newFiles?: string[];
        modifiedFiles?: string[];
        deletedFiles?: string[];
        unchangedFiles?: string[];
    };
}
```

---

## Future Enhancements

1. **Incremental Indexing**: Only index changed files
2. **Watch Mode**: Auto-detect file changes in real-time
3. **Batch Processing**: Index multiple projects in parallel
4. **Hash Cache**: Store hashes locally for faster checks
5. **Diff Preview**: Show what changed in modified files

---

## Troubleshooting

### Table doesn't exist
```bash
# Run the setup script
./scripts/ensure-indexed-files-table.sh
```

### Check fails with "PostgreSQL connection not available"
Ensure PostgreSQL is running and accessible:
```bash
psql -h localhost -p 5533 -U postgres -d claude_context
```

### SHA-256 hashes not being stored
Check if you're using the latest indexing functions that save file metadata.

---

## Summary

The SHA-256 based check feature provides:
- ✅ **Automatic detection** of already indexed codebases
- ✅ **Change tracking** at the file level
- ✅ **Smart recommendations** for indexing strategy
- ✅ **Performance optimization** by avoiding unnecessary work
- ✅ **Detailed reporting** of what needs updating

This ensures efficient indexing and prevents redundant processing of unchanged files.

---

**Date:** 2025-01-07  
**Status:** ✅ Implemented and ready to use
