# Local Codebase Indexing Guide

## Quick Start

### 1. Configure Docker Volumes (IMPORTANT!)

The API server runs in Docker and needs access to your filesystem. Edit `services/docker-compose.yml`:

```yaml
  api-server:
    # ... existing config ...
    volumes:
      - /home/YOUR_USERNAME:/home/YOUR_USERNAME:ro  # Add this line
```

Replace `YOUR_USERNAME` with your actual username.

### 2. Rebuild API Server

The new local indexing endpoint requires rebuilding the API server:

```bash
cd /home/mewtwo/Zykairotis/claude-context-core/services
docker-compose up -d --build api-server
```

### 3. Verify API Server

```bash
# Check container is running
docker ps | grep api-server

# Check logs
docker logs claude-context-api-server
```

### 4. Use the New Tool

```typescript
// Initialize project
claudeContext.init({ 
  project: "claude-context-core",
  dataset: "main"
})

// Index this codebase
claudeContext.indexLocal({
  path: "/home/mewtwo/Zykairotis/claude-context-core"
})

// Search your code
claudeContext.query({
  query: "web crawling implementation"
})
```

---

## What Changed

### ✅ New API Endpoint

**POST** `/projects/:project/ingest/local`

Indexes a local codebase directory through the API server.

**Request**:
```json
{
  "path": "/absolute/path/to/codebase",
  "dataset": "my-dataset",
  "repo": "my-repo",
  "branch": "main",
  "scope": "project",
  "force": false
}
```

**Response**:
```json
{
  "status": "completed",
  "message": "Local codebase indexed successfully",
  "project": "my-project",
  "dataset": "my-dataset",
  "path": "/absolute/path/to/codebase",
  "stats": {
    "indexedFiles": 150,
    "totalChunks": 3200
  },
  "durationMs": 45000
}
```

### ✅ New MCP Tool

**claudeContext.indexLocal**

Available in the MCP API wrapper (`mcp-api-server.js`).

**Parameters**:
- `path` (required) - Absolute path to codebase
- `dataset` (optional) - Dataset name (defaults to directory name)
- `project` (optional) - Project name (uses default if set)
- `repo` (optional) - Repository name for metadata
- `branch` (optional) - Branch name for metadata
- `sha` (optional) - Commit SHA for metadata
- `scope` (optional) - Scope level: global, project, or local
- `force` (optional) - Force reindex

**Example**:
```typescript
claudeContext.indexLocal({
  path: "/home/mewtwo/Zykairotis/claude-context-core",
  dataset: "main",
  repo: "claude-context-core",
  branch: "main",
  scope: "project"
})
```

---

## Features

### ✅ Real-time Progress Updates

Progress updates broadcast via WebSocket:

```json
{
  "type": "ingest:progress",
  "project": "my-project",
  "dataset": "main",
  "source": "local",
  "data": {
    "phase": "Parsing files...",
    "percentage": 45,
    "detail": "Processing src/api/routes.ts"
  }
}
```

### ✅ Synchronous Operation

Unlike GitHub ingestion (which uses job queues), local indexing:
- Runs synchronously
- Returns immediately on completion
- No polling required
- Perfect for interactive development

### ✅ Auto-dataset Creation

If dataset doesn't exist:
- Automatically created
- Named after directory (if not specified)
- Marked as active

### ✅ Path Validation

- Validates absolute paths
- Rejects relative paths
- Clear error messages

---

## Comparison: Local vs GitHub vs Crawl

| Feature | indexLocal | indexGitHub | crawl |
|---------|-----------|-------------|-------|
| **Source** | Local filesystem | GitHub clone | Web pages |
| **Execution** | Synchronous | Async (job queue) | Async (job queue) |
| **Wait for completion** | Always | Optional | Optional |
| **Progress updates** | WebSocket | WebSocket | WebSocket |
| **Path requirement** | Absolute | GitHub URL | Web URL |
| **Use case** | Dev/local code | Remote repos | Documentation |

---

## Usage Examples

### Example 1: Index This Codebase

```typescript
claudeContext.init({ project: "claude-context-core" })

claudeContext.indexLocal({
  path: "/home/mewtwo/Zykairotis/claude-context-core"
})

// Wait ~30-60 seconds for completion
// Then query:
claudeContext.query({
  query: "API server initialization",
  topK: 5
})
```

### Example 2: Index Multiple Projects

```typescript
// Project 1
claudeContext.init({ project: "frontend" })
claudeContext.indexLocal({
  path: "/home/user/projects/my-app-frontend",
  dataset: "main"
})

// Project 2
claudeContext.init({ project: "backend" })
claudeContext.indexLocal({
  path: "/home/user/projects/my-app-backend",
  dataset: "main"
})

// Search across all projects
claudeContext.query({
  project: "all",
  query: "authentication"
})
```

### Example 3: Force Reindex

```typescript
// Reindex after major changes
claudeContext.indexLocal({
  path: "/home/mewtwo/Zykairotis/claude-context-core",
  force: true
})
```

### Example 4: With Metadata

```typescript
claudeContext.indexLocal({
  path: "/home/user/projects/my-app",
  dataset: "feature-branch",
  repo: "my-app",
  branch: "feature/new-auth",
  sha: "abc123def456"
})
```

---

## Troubleshooting

### Path must be absolute

**Error**: `path must be an absolute path (starting with /)`

**Solution**: Use absolute paths:
```typescript
// ❌ Wrong
claudeContext.indexLocal({ path: "." })
claudeContext.indexLocal({ path: "../my-app" })

// ✅ Correct
claudeContext.indexLocal({ path: "/home/user/projects/my-app" })
claudeContext.indexLocal({ path: process.cwd() })  // If available
```

### API Server not responding

**Check API server status**:
```bash
docker ps | grep api-server
docker logs claude-context-api-server
```

**Restart API server**:
```bash
docker-compose restart api-server
```

**Rebuild if code changed**:
```bash
docker-compose up -d --build api-server
```

### Indexing takes too long

- Large codebases (>50k files) may take several minutes
- Check progress via WebSocket messages
- Monitor API server logs for issues
- Consider indexing subdirectories separately

### Permission denied

**Error**: `EACCES: permission denied`

**Solution**: Ensure Docker container has read access:
```bash
# Check file permissions
ls -la /path/to/codebase

# Ensure files are readable
chmod -R +r /path/to/codebase
```

---

## Migration from Direct MCP

If you were using `mcp-server.js` with `claudeContext.index`:

### Before (Direct MCP):
```typescript
claudeContext.index({
  path: "/home/user/projects/my-app",
  project: "my-project",
  dataset: "main"
})
```

### After (API Wrapper):
```typescript
// Same syntax!
claudeContext.indexLocal({
  path: "/home/user/projects/my-app",
  project: "my-project",
  dataset: "main"
})
```

The API is nearly identical, just renamed for clarity.

---

## Next Steps

1. **Rebuild API server** (if not done already)
2. **Restart Claude Desktop** to reload MCP configuration
3. **Test indexing** with a small codebase first
4. **Monitor progress** via WebSocket or API server logs
5. **Query your code** with semantic search

Happy indexing! 🚀
