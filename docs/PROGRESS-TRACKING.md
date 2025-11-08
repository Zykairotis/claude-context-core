# Progress Tracking System

## Overview
The API server now includes a comprehensive progress tracking system that monitors and reports the status of long-running operations like indexing, ingestion, and analysis tasks.

## Architecture

### Components

1. **ProgressTracker Service** (`services/api-server/src/services/progress-tracker.ts`)
   - Singleton service that manages operation tracking
   - In-memory storage with TTL cleanup (1 hour for completed operations)
   - Supports multiple concurrent operations
   - Automatic cleanup of old entries

2. **REST API Endpoints** (`services/api-server/src/routes/projects.ts`)
   - `GET /projects/:project/progress` - Get progress for a project
   - Query parameters:
     - `operationId` - Get specific operation details
     - `active=true` - Get only active operations
   - `GET /projects/all/progress` - Get all operations across projects

3. **Integration Points**
   - Local ingestion tracking
   - GitHub repository ingestion tracking
   - Web crawling progress (via existing crawl monitor)
   - Custom operation tracking

## Data Model

```typescript
interface ProgressUpdate {
  operationId: string;         // Unique ID (UUID or custom)
  operation: string;            // Operation type (local-ingest, github-ingest, etc)
  project: string;              // Project name
  dataset?: string;             // Dataset name (optional)
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  phase: string;                // Current phase description
  progress: number;             // 0-100 percentage
  message: string;              // Status message
  details?: any;                // Additional context
  startedAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp
  completedAt?: string;        // ISO timestamp (when finished)
  error?: string;              // Error message if failed
}
```

## Usage Examples

### Start Tracking an Operation
```javascript
const progressTracker = getProgressTracker();
const operationId = progressTracker.startOperation(
  'custom-operation',    // operation type
  'my-project',         // project name
  'my-dataset'          // optional dataset
);
```

### Update Progress
```javascript
progressTracker.updateProgress(operationId, {
  status: 'in_progress',
  phase: 'Processing files',
  progress: 45,
  message: 'Processed 45 of 100 files'
});
```

### Complete an Operation
```javascript
progressTracker.completeOperation(operationId, {
  totalFiles: 100,
  totalChunks: 500,
  duration: 12345
});
```

### Fail an Operation
```javascript
progressTracker.failOperation(
  operationId,
  'Connection timeout to database',
  { lastFile: 'src/index.ts' }
);
```

## REST API Usage

### Get All Operations for a Project
```bash
curl -X GET "http://localhost:3030/projects/my-project/progress" | jq
```

### Get Active Operations Only
```bash
curl -X GET "http://localhost:3030/projects/my-project/progress?active=true" | jq
```

### Get Specific Operation Details
```bash
curl -X GET "http://localhost:3030/projects/my-project/progress?operationId=abc-123" | jq
```

### Monitor All Active Operations (Real-time)
```bash
watch -n 1 'curl -s http://localhost:3030/projects/all/progress?active=true | jq'
```

## WebSocket Integration
Progress updates are also broadcast via WebSocket for real-time monitoring:

```javascript
// WebSocket message format
{
  type: 'web:ingest:progress',
  project: 'my-project',
  timestamp: '2025-11-08T09:28:41.930Z',
  data: {
    operationId: 'abc-123',
    dataset: 'my-dataset',
    source: 'local',
    phase: 'Indexing',
    percentage: 45,
    detail: 'Processing file 45 of 100'
  }
}
```

## Integrated Operations

### 1. Local Ingestion
- **Endpoint**: `POST /projects/:project/ingest/local`
- **Tracking**: Automatic
- **Phases**: Initializing → Scanning → Indexing → Complete
- **Returns**: `operationId` in response

### 2. GitHub Ingestion
- **Endpoint**: `POST /projects/:project/ingest/github`
- **Tracking**: Automatic via worker
- **Phases**: Cloning → Loading → Indexing → Complete
- **Uses**: Job ID as operation ID

### 3. Web Crawling
- **Endpoint**: `POST /projects/:project/crawl`
- **Tracking**: Via existing crawl monitor
- **Integration**: Compatible with progress tracker

## Testing

### Test Scripts
1. **Basic Test** (`test-progress-api.sh`)
   - Tests all progress endpoints
   - Starts sample operations
   - Verifies tracking

2. **Demo Script** (`demo-progress.sh`)
   - Interactive demo with progress bar
   - Shows real-time tracking
   - Includes example commands

### Running Tests
```bash
# Make scripts executable
chmod +x test-progress-api.sh demo-progress.sh

# Run basic tests
./test-progress-api.sh

# Run interactive demo
./demo-progress.sh
```

## Implementation Details

### Memory Management
- In-memory Map storage for fast access
- TTL-based cleanup (1 hour for completed operations)
- Active operations never expire
- Cleanup runs every 5 minutes

### Performance
- O(1) operation lookup by ID
- O(n) project filtering (optimized with early exit)
- Minimal overhead (~1-2ms per update)
- No database dependencies

### Error Handling
- Graceful handling of missing operations
- Automatic error capture and storage
- Failed operations retained for debugging

## Future Enhancements

### Potential Improvements
1. **Persistence Layer**
   - Optional PostgreSQL storage for history
   - Redis for distributed tracking
   - Recovery after server restart

2. **Advanced Features**
   - Operation queuing and scheduling
   - Progress aggregation for batch operations
   - Dependency tracking between operations
   - Resource usage monitoring

3. **UI Integration**
   - Progress bars in web UI
   - Real-time dashboard
   - Historical analytics

4. **Metrics & Monitoring**
   - Prometheus metrics export
   - Operation duration histograms
   - Success/failure rates
   - Performance bottleneck detection

## Troubleshooting

### Common Issues

1. **Operation Not Found**
   - Check operation ID is correct
   - Verify operation hasn't expired (1 hour TTL)
   - Ensure project name matches

2. **No Progress Updates**
   - Verify API server is running
   - Check WebSocket connection
   - Ensure operation is actually running

3. **Progress Stuck**
   - Check for errors in operation
   - Verify worker processes are healthy
   - Check resource availability

### Debug Commands
```bash
# Check API health
curl http://localhost:3030/health

# Get all operations (last 100)
curl http://localhost:3030/projects/all/progress | jq '.operations | length'

# Check specific project
curl "http://localhost:3030/projects/PROJECT_NAME/progress" | jq

# Monitor WebSocket messages (requires wscat)
wscat -c ws://localhost:3030/ws
```

## API Reference

### GET /projects/:project/progress

Get progress information for a project.

**Parameters:**
- `project` (path) - Project name or "all" for all projects
- `operationId` (query) - Specific operation ID to retrieve
- `active` (query) - Set to "true" to get only active operations

**Response:**
```json
{
  "operations": [
    {
      "operationId": "uuid",
      "operation": "local-ingest",
      "project": "my-project",
      "dataset": "my-dataset",
      "status": "in_progress",
      "phase": "Indexing",
      "progress": 45,
      "message": "Processing files",
      "startedAt": "2025-11-08T09:00:00.000Z",
      "updatedAt": "2025-11-08T09:00:30.000Z"
    }
  ]
}
```

Or for specific operation:
```json
{
  "operationId": "uuid",
  "operation": "local-ingest",
  // ... full operation details
}
```

**Status Codes:**
- 200: Success
- 404: Operation not found (when querying specific ID)
- 500: Server error
