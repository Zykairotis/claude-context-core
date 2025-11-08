# MCP API Server Wrapper

A lightweight MCP server that proxies to the running API server instead of directly using the core library.

## Architecture

```
Claude Desktop
    ↓
mcp-api-server.js (MCP Protocol)
    ↓
HTTP Requests
    ↓
API Server (localhost:3030)
    ↓
Docker Services (Postgres, Qdrant, Crawl4AI, TEI)
```

## Advantages

✅ **No service configuration needed** - API server handles everything  
✅ **Simpler setup** - Just point to API server URL  
✅ **Job queuing built-in** - pg-boss handles background jobs  
✅ **WebSocket support** - Real-time progress updates  
✅ **Single source of truth** - All operations go through API server  
✅ **Easier debugging** - Can monitor API server logs  

## Configuration

### 1. Ensure API Server is Running

```bash
# In the services directory
docker-compose up -d

# Verify API server is accessible
curl http://localhost:3030/health
```

### 2. Add to Claude Desktop

```bash
claude mcp add-json claude-context '{
  "command": "node",
  "args": ["/home/mewtwo/Zykairotis/claude-context-core/mcp-api-server.js"],
  "env": {
    "API_SERVER_URL": "http://localhost:3030"
  }
}'
```

That's it! No embedding configuration, no database connection strings needed.

## Available Tools

### Configuration
- `claudeContext.init` - Set default project/dataset
- `claudeContext.defaults` - Show current defaults

### Ingestion
- `claudeContext.indexLocal` - Index local codebase directory
- `claudeContext.indexGitHub` - Index GitHub repositories
- `claudeContext.crawl` - Crawl and index web pages

### Query
- `claudeContext.query` - Semantic search with hybrid search & reranking
- `claudeContext.smartQuery` - LLM-enhanced query with answer generation

### Info & Status
- `claudeContext.stats` - Project statistics
- `claudeContext.listScopes` - List all datasets/scopes
- `claudeContext.history` - View ingestion job history

## Example Usage

### Initialize default project
```
claudeContext.init({ project: "my-project", dataset: "main" })
```

### Index a local codebase
```
claudeContext.indexLocal({ 
  path: "/home/user/projects/my-app",
  dataset: "main"
})
```

### Index a GitHub repository
```
claudeContext.indexGitHub({ 
  repo: "github.com/user/repo",
  branch: "main"
})
```

### Crawl documentation
```
claudeContext.crawl({
  url: "https://docs.example.com",
  crawlType: "recursive",
  maxPages: 100
})
```

### Search code
```
claudeContext.query({
  query: "how to authenticate users",
  topK: 10
})
```

### Smart query with LLM
```
claudeContext.smartQuery({
  query: "Explain how the authentication system works",
  answerType: "technical"
})
```

## Comparison with Direct MCP Server

### mcp-server.js (Direct)
- ❌ Needs PostgreSQL connection string
- ❌ Needs embedding service ports (30001, 30002)
- ❌ Needs vector database configuration
- ❌ No job queuing (blocking operations)
- ❌ No progress updates
- ✅ Slightly faster (no HTTP overhead)

### mcp-api-server.js (API Wrapper) ⭐
- ✅ Only needs API server URL
- ✅ All services managed by Docker
- ✅ Job queuing with pg-boss
- ✅ Real-time progress updates
- ✅ Consistent with UI operations
- ❌ Slight HTTP overhead (~5-10ms)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_SERVER_URL` | `http://localhost:3030` | API server base URL |

## Troubleshooting

### "Connection refused" error
```bash
# Check if API server is running
docker ps | grep api-server

# Check API server logs
docker logs claude-context-api-server
```

### API server not accessible
```bash
# Restart API server
docker-compose restart api-server

# Or rebuild if code changed
docker-compose up -d --build api-server
```

### Jobs stuck in "queued" status
```bash
# Check job queue logs
docker logs claude-context-api-server | grep "pg-boss"

# Restart API server to restart job workers
docker-compose restart api-server
```

## Development

To test the MCP server locally:

```bash
# Run directly (not via Claude Desktop)
node mcp-api-server.js

# It will wait for MCP protocol messages on stdin
# Press Ctrl+C to exit
```

## Migration from Direct MCP Server

If you're currently using `mcp-server.js`, simply:

1. Stop using the old configuration
2. Add the new configuration (above)
3. Restart Claude Desktop

Your stored defaults (`~/.context/claude-mcp.json`) will be preserved.
