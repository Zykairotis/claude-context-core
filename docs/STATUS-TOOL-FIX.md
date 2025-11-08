# Status Tool Fix - Timeout Protection ✅

## Problem

The `claudeContext.status` tool was **hanging indefinitely** when:
- PostgreSQL database is not running
- Database connection is slow
- Network issues preventing database access

This caused the entire MCP tool to get stuck with "Running PreToolUse hooks..." forever.

---

## Fix Applied

Added **10-second timeout** to the status tool with helpful error messages.

### File Modified
- **`/mcp-server.js`** (lines 817-820, 912-915, 955-974)

### Changes Made

**1. Added Timeout Wrapper:**
```javascript
// Add timeout to prevent hanging
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Status check timed out after 10 seconds. Database may not be running.')), 10000)
);

const statusPromise = (async () => {
  // ... actual status check logic
})();

// Race between status check and timeout
return await Promise.race([statusPromise, timeoutPromise]);
```

**2. Improved Error Message:**
```javascript
return {
  content: [{
    type: 'text',
    text: `⏱️ Status check timed out after 10 seconds.

This usually means:
• PostgreSQL database is not running
• Database is slow or overloaded
• Network connection issue

Check if Docker PostgreSQL is running:
docker ps | grep postgres

Or check if indexing is still in progress (look at console logs).`
  }],
  isError: true
};
```

---

## How to Use Status Tool Properly

### 1. Check PostgreSQL is Running

```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Should show:
# claude-context-postgres   Up 2 hours   5533->5432/tcp
```

**If not running:**
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Or start all services
docker-compose up -d
```

### 2. Use Status Tool

```javascript
// Check status for specific dataset
await claudeContext.status({
  project: "HiFtoPyW-claude-context-core-k83QFf7B",
  dataset: "main"
});

// Check status for all datasets in project
await claudeContext.status({
  project: "HiFtoPyW-claude-context-core-k83QFf7B"
});
```

### 3. Monitor Console Logs Instead

Since indexing now runs in background, **watch the MCP server console** for real-time status:

```bash
# You'll see:
[Index] ✅ Completed: my-project/main - 1234 chunks
# or
[Index] ❌ Failed: my-project/main - Error message
```

---

## Alternative: Check Without Database

If you just indexed and want to know if it completed, check the **console logs** where you're running the MCP server:

```bash
# Terminal where you ran: node mcp-server.js

# Look for:
[Index] ✅ Completed: claude-context-core/main - 856 chunks

# Or errors:
[Index] ❌ Failed: claude-context-core/main - Connection timeout
```

---

## Why Status Was Hanging

The status tool queries PostgreSQL database to get indexing statistics:

```sql
SELECT dc.collection_name, dc.point_count, dc.last_indexed_at, d.name as dataset_name
FROM claude_context.dataset_collections dc
JOIN claude_context.datasets d ON dc.dataset_id = d.id
JOIN claude_context.projects p ON d.project_id = p.id
WHERE p.name = $1 AND d.name = $2
```

**Without PostgreSQL running:**
- Connection hangs waiting for database
- No timeout = infinite wait
- Tool never returns
- Cascade/Claude gets stuck

**With timeout (now fixed):**
- Waits max 10 seconds
- Returns helpful error message
- User can diagnose the issue
- Tool doesn't hang forever

---

## Quick Troubleshooting

### Problem: "Status check timed out"

**Solution 1: Start PostgreSQL**
```bash
docker-compose up -d postgres
```

**Solution 2: Check if services are healthy**
```bash
docker-compose ps
```

**Solution 3: Look at console logs**
- Indexing completion is logged to console
- Don't need database to see if indexing finished

### Problem: "No index found for project"

**Solution:** The project hasn't been indexed yet, or indexing failed.

**Check console logs:**
```bash
# Look for completion message
[Index] ✅ Completed: ...

# Or error message
[Index] ❌ Failed: ...
```

---

## Summary

✅ **Status tool now has 10-second timeout**  
✅ **Returns helpful error when database unavailable**  
✅ **Won't hang indefinitely anymore**  
✅ **Console logs show indexing completion without needing database**  
✅ **Restart MCP server to apply changes**  

**Best Practice:** Watch console logs for indexing status instead of querying database.

---

**Date:** 2025-01-07  
**Status:** ✅ Fixed - Restart MCP server to apply
