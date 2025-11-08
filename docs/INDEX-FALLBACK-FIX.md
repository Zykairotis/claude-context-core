# Index Tool - Automatic Fallback Fix

## The Problem

"Socket hang up" error when API server is not reachable:
```
"error": "request to http://localhost:3030/projects/.../ingest/local failed, reason: socket hang up"
```

This happens when:
- API server is not running
- API server is in Docker but MCP is on host
- Network issues between MCP and API server
- API server is overloaded/crashed

---

## The Solution: Automatic Fallback

### How It Works Now

```
1. Try API Server First
   ↓
2a. If SUCCESS → Use API server (fast, non-blocking)
   ↓
2b. If FAIL → Fall back to direct indexing (still async)
   ↓
3. Return immediately either way
```

### The Code

```javascript
// Try API server first
fetch(`${API_SERVER_URL}/projects/${projectName}/ingest/local`, {
  // ... request config
  timeout: 5000  // 5 second timeout
}).then(/* handle success */)
.catch(error => {
  // API server failed - fall back!
  console.warn(`[Index] API server not available, using direct indexing`);
  
  // Use direct indexing instead (still async!)
  setImmediate(async () => {
    await ingestGithubRepository(context, { ... });
  });
});
```

---

## Configuration Options

### 1. Custom API Server URL
```bash
# If API server is on different host/port
export API_SERVER_URL=http://192.168.1.100:3030
node mcp-server.js
```

### 2. Disable API Server (Force Direct)
```bash
# Always use direct indexing (bypass API server)
export USE_API_SERVER=false
node mcp-server.js
```

### 3. Docker → Host Connection
```bash
# If API server is in Docker, MCP on host
export API_SERVER_URL=http://localhost:3030  # Default

# If both in Docker
export API_SERVER_URL=http://api-server:3030

# If MCP in Docker, API on host
export API_SERVER_URL=http://host.docker.internal:3030
```

---

## Benefits

✅ **Always Works** - Falls back if API server is down  
✅ **Still Async** - Never blocks, even in fallback  
✅ **Smart Routing** - Uses best available method  
✅ **No Manual Fix** - Automatic detection & fallback  
✅ **Configurable** - Can force either mode  

---

## Testing

### Test 1: With API Server Running
```javascript
// Start API server
npm run api:dev

// Index - will use API server
claudeContext.index({ 
  path: "/path/to/project",
  project: "my-app"
});
// → Uses API server (fast path)
```

### Test 2: Without API Server
```javascript
// Don't start API server (or kill it)

// Index - will fall back
claudeContext.index({ 
  path: "/path/to/project",
  project: "my-app"
});
// → Falls back to direct indexing
// → See console: "[Index] API server not available, using direct indexing"
```

### Test 3: Force Direct Mode
```bash
export USE_API_SERVER=false
node mcp-server.js
```
```javascript
// Always uses direct indexing
claudeContext.index({ path: "/path" });
// → Skips API server entirely
```

---

## Troubleshooting

### Still Getting Errors?

1. **Check if path exists:**
   ```javascript
   // Path must be absolute and exist
   claudeContext.index({ 
     path: "/absolute/path/that/exists"
   });
   ```

2. **Check project name:**
   ```javascript
   // Auto-generated project IDs might be too long
   // Use simpler names:
   claudeContext.index({ 
     path: "/path",
     project: "my-app",  // Simple name
     dataset: "main"
   });
   ```

3. **Check logs:**
   ```bash
   # You should see one of:
   # - "[Index] API server not available, using direct indexing"
   # - No error = API server worked
   ```

---

## How It's Different

### Old (Breaking)
```
API Server Down → Tool Fails → Error
```

### New (Resilient)
```
API Server Down → Auto Fallback → Still Works
```

---

## Summary

The index tool now has **automatic fallback**:
1. Tries API server first (fast, preferred)
2. Falls back to direct indexing if API fails
3. Both methods are async (no blocking)
4. Tool always works, regardless of API server status

**No more socket hang up errors!** 🎉

---

**Date:** 2025-01-07  
**Status:** ✅ Fixed with automatic fallback
