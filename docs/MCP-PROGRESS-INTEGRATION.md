# MCP Server Progress Tracking Integration

## Overview
The MCP server now integrates with the API server's progress tracking system to provide real-time visibility into indexing and ingestion operations.

## Changes Made

### 1. Enhanced claudeContext.status Tool

The status tool now checks for active operations before showing static status:

```javascript
// Old behavior: Only showed completed index status
claudeContext.status({ project: "my-project", dataset: "my-dataset" })
// Output: ✅ Indexing Status: my-project/my-dataset
//         Status: completed
//         Progress: 1000 / 1000 chunks (100%)

// New behavior: Shows active operations with progress
claudeContext.status({ project: "my-project", dataset: "my-dataset" })
// Output: ⏳ Active Operation: my-project/my-dataset
//         Operation: local-ingest
//         Status: in_progress
//         Phase: Indexing
//         Progress: [████████░░░░░░░░░░░░] 40%
//         Message: Processing file 40 of 100
//         Started: 10:30:45 AM
//         ID: abc123...
```

### 2. New claudeContext.progress Tool

A dedicated tool for tracking operations:

```javascript
// Get all operations for a project
claudeContext.progress({ 
  project: "my-project" 
})

// Get only active operations across all projects
claudeContext.progress({ 
  activeOnly: true 
})

// Get specific operation details
claudeContext.progress({ 
  operationId: "7d3b7e1b-ac01-4898-b609-614f19fac1a9" 
})

// Limit results
claudeContext.progress({ 
  project: "all",
  limit: 5 
})
```

## Output Format

### Status Tool (Active Operation)
```
⏳ Active Operation: my-project/my-dataset

Operation: github-ingest
Status: in_progress
Phase: Cloning
Progress: [██████░░░░░░░░░░░░░░] 30%
Message: Cloning repository from GitHub
Started: 10:30:45 AM
ID: 7d3b7e1b-ac01-4898-b609-614f19fac1a9
```

### Progress Tool (Multiple Operations)
```
🔄 Active Operations (All Projects):

✅ local-ingest - demo-project/demo-dataset
   [██████████] 100% - Complete
   Operation completed successfully
   Started 2m ago | ID: aca0d8d0...

🔄 github-ingest - test-project/linux-kernel
   [████░░░░░░] 40% - Indexing
   Processing file 400 of 1000
   Started 5m ago | ID: 7d3b7e1b...

❌ crawl - web-project/docs
   [██░░░░░░░░] 20% - Failed
   Connection timeout
   Started 10m ago | ID: 9b2c8f3d...
```

### Progress Tool (Single Operation)
```
✅ Operation Details: 7d3b7e1b-ac01-4898-b609-614f19fac1a9

Type: github-ingest
Project: test-project
Dataset: linux-kernel
Status: completed
Phase: Complete
Progress: [████████████████████] 100%
Message: Operation completed successfully

Started: 11/8/2024, 10:30:45 AM
Updated: 11/8/2024, 10:35:12 AM
Completed: 11/8/2024, 10:35:12 AM
```

## Status Indicators

- 🏁 `started` - Operation just started
- 🔄 `in_progress` - Operation running
- ✅ `completed` - Operation finished successfully
- ❌ `failed` - Operation failed with error

## Progress Bar Visualization

The tools use Unicode characters for progress bars:
- `█` (U+2588) - Filled portion
- `░` (U+2591) - Empty portion

Examples:
- `[░░░░░░░░░░░░░░░░░░░░] 0%` - Just started
- `[██████░░░░░░░░░░░░░░] 30%` - 30% complete
- `[██████████░░░░░░░░░░] 50%` - Half way
- `[████████████████████] 100%` - Complete

## API Integration

The MCP server makes HTTP requests to the API server:

1. **Check Active Operations**
   ```
   GET http://localhost:3030/projects/{project}/progress?active=true
   ```

2. **Get All Operations**
   ```
   GET http://localhost:3030/projects/{project}/progress
   ```

3. **Get Specific Operation**
   ```
   GET http://localhost:3030/projects/{project}/progress?operationId={id}
   ```

## Configuration

The MCP server uses these environment variables:
- `API_SERVER_URL` - API server base URL (default: `http://localhost:3030`)
- `USE_API_SERVER` - Set to `false` to disable API integration

## Testing

### Test Script
Run the provided test script:
```bash
./test-mcp-progress.sh
```

### Manual Testing with MCP Inspector
```bash
# Start MCP inspector
npx @modelcontextprotocol/inspector mcp-server.js

# Open browser to http://localhost:6277
# Test the tools with the JSON examples above
```

### Expected Behavior

1. **During Indexing:**
   - Status tool shows active operation with progress
   - Progress tool lists operation as "in_progress"
   - Real-time updates as operation progresses

2. **After Completion:**
   - Status tool shows completed status from database
   - Progress tool shows operation as "completed"
   - Operation retained for 1 hour

3. **On Failure:**
   - Status tool may fall back to database status
   - Progress tool shows "failed" with error message
   - Error details available in operation details

## Troubleshooting

### No Active Operations Shown
- Verify API server is running: `curl http://localhost:3030/health`
- Check for operations: `curl http://localhost:3030/projects/all/progress`
- Ensure operations are being tracked properly

### Progress Not Updating
- Check WebSocket connection in API server logs
- Verify progress tracker is updating (check API logs)
- Ensure operation ID is correct

### API Connection Failed
- Check `API_SERVER_URL` environment variable
- Verify API server is accessible from MCP server
- Check network/firewall settings

## Benefits

1. **Real-time Visibility**: See operations as they happen
2. **Progress Tracking**: Know exactly how far along operations are
3. **Error Detection**: Immediately see when operations fail
4. **Operation History**: Recent operations retained for review
5. **Cross-Project View**: Monitor all projects at once

## Future Enhancements

Potential improvements:
- WebSocket integration for live updates
- Operation cancellation support
- ETA calculation based on progress rate
- Operation queuing and priorities
- Resource usage monitoring
