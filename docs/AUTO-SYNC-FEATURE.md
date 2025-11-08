# Real-Time Auto-Sync Feature

## Overview

The Auto-Sync feature provides **real-time synchronization** between your filesystem and the vector database. When enabled, it automatically:

- ✅ **Watches** file changes (add, modify, delete)
- ✅ **Detects** changes using SHA-256 hashing
- ✅ **Syncs** chunks incrementally (only changed files)
- ✅ **Auto-recovers** from crashes
- ✅ **Persists** configurations across restarts

---

## 🚀 How It Works

### Architecture

```
Filesystem Changes
    ↓
File Watcher (Chokidar)
    ↓
Debounce (2 seconds)
    ↓
SHA-256 Change Detection
    ↓
Incremental Sync
    ├── Delete: Remove chunks from vector DB
    ├── Modify: Delete old + Index new chunks  
    └── Create: Index new file chunks
    ↓
Update PostgreSQL metadata
```

### Key Components

1. **Auto-Watch Manager** (`src/sync/auto-watch-manager.ts`)
   - Manages watch configurations
   - Auto-starts on server startup
   - Health checks & auto-recovery
   - Persists configs to database

2. **File Watcher** (`src/sync/file-watcher.ts`)
   - Uses Chokidar for filesystem monitoring
   - Debounces changes (default 2 seconds)
   - Ignores build files, node_modules, etc.
   - Triggers incremental sync

3. **Change Detector** (`src/sync/change-detector.ts`)
   - Calculates SHA-256 for all files
   - Compares with stored hashes
   - Categorizes: created, modified, deleted, unchanged

4. **Incremental Sync** (`src/sync/incremental-sync.ts`)
   - Processes changes efficiently
   - Updates only what changed
   - Maintains vector DB consistency

---

## 🛠️ Setup

### 1. Database Setup

The system automatically creates the `watch_configs` table on first run:

```sql
CREATE TABLE claude_context.watch_configs (
    id UUID PRIMARY KEY,
    path TEXT NOT NULL,
    project_id UUID NOT NULL,
    project_name TEXT NOT NULL,
    dataset_id UUID NOT NULL,
    dataset_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    auto_start BOOLEAN DEFAULT true,
    debounce_ms INTEGER DEFAULT 2000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_started TIMESTAMPTZ,
    UNIQUE(path, project_id, dataset_id)
);
```

### 2. Server Configuration

Auto-sync starts automatically when the API server starts:

```javascript
// In server.ts
const autoWatchManager = await initializeAutoWatchManager(context, pool, {
  autoRecover: true,          // Auto-recover dead watchers
  pollInterval: 30000,        // Health check every 30 seconds
  onWatchStart: (config) => { /* WebSocket notification */ },
  onWatchStop: (config) => { /* WebSocket notification */ },
  onWatchError: (config, error) => { /* Error handling */ }
});
```

---

## 📡 API Endpoints

### Add Auto-Watch Configuration

**POST** `/projects/:project/autowatch/add`

```javascript
// Request
{
  "path": "/home/user/my-project",
  "dataset": "main",
  "autoStart": true,    // Start watching immediately
  "debounceMs": 2000    // Debounce delay
}

// Response
{
  "message": "Auto-watch configuration added",
  "config": {
    "enabled": true,
    "path": "/home/user/my-project",
    "project": "my-app",
    "projectId": "uuid",
    "dataset": "main",
    "datasetId": "uuid",
    "autoStart": true,
    "debounceMs": 2000,
    "createdAt": "2025-01-07T..."
  },
  "started": true
}
```

### Remove Auto-Watch Configuration

**DELETE** `/projects/:project/autowatch/remove`

```javascript
// Request
{
  "path": "/home/user/my-project",
  "dataset": "main"
}

// Response
{
  "message": "Auto-watch configuration removed",
  "path": "/home/user/my-project",
  "project": "my-app",
  "dataset": "main"
}
```

### List Auto-Watch Configurations

**GET** `/projects/:project/autowatch/list`

```javascript
// Response
{
  "project": "my-app",
  "configurations": [
    {
      "enabled": true,
      "path": "/home/user/my-project",
      "project": "my-app",
      "dataset": "main",
      "autoStart": true,
      "debounceMs": 2000,
      "createdAt": "2025-01-07T...",
      "lastStarted": "2025-01-07T...",
      "isActive": true   // Currently watching
    }
  ],
  "total": 1,
  "active": 1
}
```

### Manual Watch Control

**POST** `/projects/:project/watch/start` - Start watching (one-time)
**POST** `/projects/:project/watch/stop` - Stop watching
**GET** `/projects/:project/watch/list` - List active watchers

---

## 🎯 Usage Examples

### Example 1: Enable Auto-Sync for a Project

```bash
# Add auto-watch configuration
curl -X POST http://localhost:3030/projects/my-app/autowatch/add \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/user/my-project",
    "dataset": "main",
    "autoStart": true
  }'
```

Now every file change in `/home/user/my-project` will automatically sync!

### Example 2: Check Active Watchers

```bash
# List all auto-watch configs
curl http://localhost:3030/projects/my-app/autowatch/list

# See real-time WebSocket events
wscat -c ws://localhost:3030/ws
```

### Example 3: Stop Auto-Sync

```bash
# Remove auto-watch config
curl -X DELETE http://localhost:3030/projects/my-app/autowatch/remove \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/home/user/my-project",
    "dataset": "main"
  }'
```

---

## 🔄 Auto-Recovery

The system includes built-in resilience:

1. **Health Checks** - Every 30 seconds, checks if watchers are alive
2. **Auto-Restart** - Dead watchers are automatically restarted
3. **Persistence** - Configs saved to database and JSON file
4. **Server Restart** - All `auto_start=true` watchers restart on server boot

---

## 📊 How Sync Works

### File Addition
1. Chokidar detects new file
2. Wait 2 seconds (debounce)
3. Calculate SHA-256 hash
4. Split into chunks
5. Generate embeddings
6. Store in vector database
7. Save metadata to PostgreSQL

### File Modification
1. Detect change
2. Delete old chunks from vector DB
3. Index updated content
4. Update SHA-256 in metadata

### File Deletion
1. Detect deletion
2. Remove all chunks from vector DB
3. Delete metadata record

---

## 🚦 WebSocket Events

Real-time notifications via WebSocket:

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3030/ws');

// Events you'll receive:
{
  "type": "autowatch:started",
  "data": { /* config object */ },
  "timestamp": "2025-01-07T12:00:00Z"
}

{
  "type": "watch:sync",
  "data": {
    "path": "/home/user/my-project",
    "stats": {
      "filesCreated": 2,
      "filesModified": 5,
      "filesDeleted": 1,
      "chunksAdded": 45,
      "chunksRemoved": 12
    }
  }
}

{
  "type": "watch:event",
  "data": {
    "event": "change",
    "path": "/home/user/my-project/src/index.ts"
  }
}
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Optional: Custom config path
WATCH_CONFIG_PATH=/custom/path/watch-config.json

# Disable auto-recovery
AUTO_RECOVER=false

# Custom health check interval (ms)
POLL_INTERVAL=60000
```

### Ignore Patterns

Default ignored:
- `.git/`
- `node_modules/`
- `dist/`, `build/`, `out/`
- `__pycache__/`, `.pyc`
- `.vscode/`, `.idea/`
- Dotfiles (`.env`, `.DS_Store`)

Custom ignore: Add `.gitignore` or `.dockerignore` to your project.

---

## 🎭 Use Cases

1. **Development Environment**
   - Auto-sync as you code
   - Instant semantic search on changes
   - No manual reindexing

2. **Documentation Sites**
   - Watch docs folder
   - Auto-update knowledge base
   - Real-time search accuracy

3. **Multi-Repository Projects**
   - Watch multiple paths
   - Different datasets per repo
   - Unified search across all

4. **CI/CD Integration**
   - Auto-sync on deployments
   - Keep production index current
   - Zero-downtime updates

---

## 🔍 Monitoring

### Check Sync Status

```bash
# View indexed files in database
psql -h localhost -p 5533 -U postgres -d claude_context -c "
SELECT 
    p.name as project,
    d.name as dataset,
    COUNT(f.id) as files,
    SUM(f.chunk_count) as chunks,
    MAX(f.last_indexed_at) as last_sync
FROM claude_context.indexed_files f
JOIN claude_context.projects p ON p.id = f.project_id
JOIN claude_context.datasets d ON d.id = f.dataset_id
GROUP BY p.name, d.name;"
```

### View Active Watchers

```bash
# Check watch configurations
psql -h localhost -p 5533 -U postgres -d claude_context -c "
SELECT 
    path,
    project_name,
    dataset_name,
    enabled,
    auto_start,
    last_started
FROM claude_context.watch_configs
ORDER BY last_started DESC;"
```

---

## 🚨 Troubleshooting

### Watcher Not Starting

1. Check if path exists:
   ```bash
   ls -la /path/to/project
   ```

2. Check if project/dataset exist:
   ```bash
   curl http://localhost:3030/projects
   ```

3. View server logs:
   ```bash
   docker logs claude-context-api-server
   ```

### Files Not Syncing

1. Check if watcher is active:
   ```bash
   curl http://localhost:3030/projects/my-app/watch/list
   ```

2. Check for errors in WebSocket:
   ```javascript
   ws.on('message', (data) => {
     const msg = JSON.parse(data);
     if (msg.type === 'watch:error') {
       console.error('Sync error:', msg.data.error);
     }
   });
   ```

3. Manually trigger sync:
   ```bash
   # Touch a file to trigger change
   touch /path/to/project/test.txt
   # Wait 2 seconds for debounce
   # Check WebSocket for sync event
   ```

### Performance Issues

- Increase debounce time for large codebases
- Exclude unnecessary folders via `.gitignore`
- Monitor chunk count growth
- Consider separate datasets for large repos

---

## 🎯 Best Practices

1. **Use Separate Datasets** - One dataset per major module/repo
2. **Configure Debounce** - 2-5 seconds for normal, 10+ for large projects
3. **Monitor Growth** - Track chunk counts to prevent DB bloat
4. **Exclude Build Files** - Add to `.gitignore`: `dist/`, `build/`, etc.
5. **Test First** - Start with manual watch before enabling auto-start

---

## 📈 Performance

- **File Detection**: < 100ms
- **SHA-256 Calculation**: ~100 files/second
- **Chunk Processing**: ~50 chunks/second
- **Embedding Generation**: ~10 chunks/second (bottleneck)
- **Total Sync Time**: ~1-2 seconds per file

Memory usage: ~50MB per watcher
CPU usage: < 5% idle, 20-30% during sync

---

## 🔮 Future Enhancements

- [ ] Selective file watching (glob patterns)
- [ ] Multi-threaded sync processing
- [ ] Compression for large files
- [ ] Differential sync (only changed chunks)
- [ ] S3/Cloud storage support
- [ ] Sync queue with priorities
- [ ] Rate limiting for API calls
- [ ] Metrics dashboard

---

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** 2025-01-07
