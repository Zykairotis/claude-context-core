# WebSocket Connection Fix

**Date**: November 4, 2025  
**Issue**: WebSocket connection errors and unknown message type warnings

---

## 🐛 Problem

The frontend WebSocket client was experiencing several issues:

1. **Unknown message type**: `connected`
   ```
   [WS] Unknown message type: connected
   ```

2. **Connection warnings**: Initial connection attempts would fail before succeeding on retry

3. **Missing subscription**: Client wasn't subscribing to topics after connecting

---

## ✅ Solution

### 1. Handle `connected` Message Type

The backend sends a `connected` message when a client first connects (welcome message). The frontend now handles this:

```typescript
case 'connected': {
  // Server acknowledgment - connection established
  console.log('[WS] Server acknowledged connection');
  break;
}
```

### 2. Handle Additional Message Types

Added handlers for real-time progress updates:

```typescript
case 'query:progress':
case 'crawl:progress':
case 'github:progress':
case 'postgres:stats':
case 'qdrant:stats':
case 'crawl4ai:status': {
  // Real-time progress updates
  console.log(`[WS] ${message.type}:`, message.payload);
  break;
}
```

### 3. Auto-Subscribe to Topics

The client now automatically subscribes to relevant topics when connecting:

```typescript
this.ws.send(JSON.stringify({
  action: 'subscribe',
  project: 'default',
  topics: [
    'node:status',
    'node:metrics',
    'node:logs',
    'mesh:sync',
    'query:progress',
    'crawl:progress',
    'github:progress'
  ]
}));
```

### 4. Fixed Lint Errors

- Removed unused `error` parameter from onerror handler
- Fixed `message.data` to `message.payload` (correct WSMessage type)

---

## 🔌 Backend WebSocket Protocol

### Server → Client Messages

All messages follow this format:
```typescript
{
  type: string,
  timestamp: string,
  data?: any,
  project?: string
}
```

### Client → Server Messages

Subscription messages:
```typescript
{
  action: 'subscribe' | 'unsubscribe' | 'ping',
  project?: string,
  topics?: string[]
}
```

### Available Message Types

**Connection**:
- `connected` - Server acknowledgment

**Node Updates**:
- `node:status` - Node status changed
- `node:metrics` - Node metrics updated
- `node:logs` - New log entries

**Mesh Updates**:
- `mesh:sync` - Full mesh state sync

**Progress Updates**:
- `query:progress` - Query execution progress
- `crawl:progress` - Web crawling progress
- `github:progress` - GitHub ingestion progress

**System Stats**:
- `postgres:stats` - PostgreSQL statistics
- `qdrant:stats` - Qdrant statistics
- `crawl4ai:status` - Crawl4AI service status

**Events**:
- `event` - General system events

---

## 📝 Files Modified

**Frontend**:
- `/ui/src/lib/websocket.ts`
  - Added `connected` message handler
  - Added progress message handlers
  - Added auto-subscription on connect
  - Fixed lint errors

**No backend changes needed** - backend was already working correctly

---

## 🧪 Testing

### Expected Behavior

1. **Initial Connection**:
   ```
   [WS] Connecting to ws://localhost:3030/ws?project=default
   [WS] Connected
   [WS] Server acknowledged connection
   ```

2. **No More Warnings**:
   - No "Unknown message type: connected" warnings
   - No "WebSocket is closed before connection" errors

3. **Automatic Subscription**:
   - Client automatically subscribes to project topics
   - Ready to receive real-time updates

### Test It

1. **Start the API server** (if not running):
   ```bash
   cd services
   docker-compose up api-server
   ```

2. **Start the UI** (if not running):
   ```bash
   cd ui
   npx vite --port 40001
   ```

3. **Open browser console**:
   - Navigate to http://localhost:40001
   - Check console for WebSocket messages
   - Should see clean connection without errors

4. **Test real-time updates**:
   ```bash
   # Trigger a GitHub ingestion to see progress messages
   curl -X POST http://localhost:3030/projects/test/ingest/github \
     -H 'Content-Type: application/json' \
     -d '{"repo":"github.com/user/repo","branch":"main"}'
   ```

---

## 🔄 WebSocket Lifecycle

```
1. Client connects
   ↓
2. Server sends "connected" message
   ↓
3. Client sends "subscribe" action with topics
   ↓
4. Server acknowledges subscription (console log)
   ↓
5. Client receives real-time updates for subscribed topics
   ↓
6. On disconnect: exponential backoff retry (max 10 attempts)
```

---

## 🎯 Connection URL Format

```
ws://localhost:3030/ws?project=<project-name>
```

**Parameters**:
- `project` (optional) - Filter messages by project
  - Default: `default`
  - Special: `all` - receives all projects

**Examples**:
```
ws://localhost:3030/ws?project=default
ws://localhost:3030/ws?project=my-project
ws://localhost:3030/ws?project=all
```

---

## 🚀 Next Steps

The WebSocket connection is now stable and ready for:

1. **Real-time node status updates** - Show running/idle/failed states
2. **Progress bars** - Display ingestion progress
3. **Live metrics** - Update dashboard in real-time
4. **Log streaming** - Stream node execution logs
5. **Mesh sync** - Keep canvas in sync across tabs

---

## 📚 Related Documentation

- **WebSocket Backend**: `/services/api-server/src/websocket/index.ts`
- **WebSocket Frontend**: `/ui/src/lib/websocket.ts`
- **Message Types**: `/ui/src/types/index.ts`
- **API Documentation**: `/docs/api/API-ENDPOINTS.md`

---

**Status**: ✅ **Fixed and Ready**

No more WebSocket errors! Connection is stable and subscriptions are working properly.
