# 🧪 Middleware Testing Guide

## Quick Start: Access the UI

**UI is running at:** http://localhost:3455

### What to Test First

#### 1. **Check Connection Status** ✅
- Look at top-right of the page
- Toggle between "Mock data" and "Live API"
- Should show: `Connected` when in Live mode
- Should show: `Disconnected` when in Mock mode

#### 2. **Set API URL**
```
When in "Live API" mode, you should see:
- Input field with default: http://localhost:3030
- If not showing, enter it manually
```

#### 3. **Switch to Live API** 🔄
1. Click dropdown: **Mock data** → **Live API**
2. Verify it says **Connected** 🟢
3. Click **Sync Telemetry** button
4. Wait 2-3 seconds for data to load

#### 4. **Real-Time Updates** 📊
- Metrics panel updates automatically every ~500ms
- Shows:
  - **Datasets**: Active datasets
  - **Chunks**: Indexed chunks
  - **Web Pages**: Crawled pages
  - **Vectors**: Qdrant points

#### 5. **Test WebSocket Messages** 📡
Open browser DevTools (F12) → Console

You should see logs like:
```javascript
[WebSocket] Connected
[WebSocket] Client subscribed to project: Atlas
```

---

## Advanced Testing

### Test Raw API Endpoints

#### Health Check
```bash
curl -i http://localhost:3030/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-01T18:06:59.271Z",
  "services": {
    "postgres": "connected",
    "qdrant": "http://qdrant:6333",
    "crawl4ai": "http://crawl4ai:7070"
  }
}
```

#### Get Available Tools
```bash
curl http://localhost:3030/tools
```

Expected response:
```json
[
  "claudeContext.index",
  "claudeContext.search",
  "claudeContext.query",
  "claudeContext.share",
  "claudeContext.listProjects",
  "claudeContext.listDatasets"
]
```

---

### Test WebSocket Connection

#### Using wscat (if installed)
```bash
npm install -g wscat
wscat -c ws://localhost:3030/ws
```

Then send:
```json
{
  "action": "subscribe",
  "project": "TestProject",
  "topics": ["postgres:stats", "crawl:progress", "qdrant:stats", "error"]
}
```

#### Or use browser console
```javascript
const ws = new WebSocket('ws://localhost:3030/ws');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({
  action: "subscribe",
  project: "TestProject",
  topics: ["postgres:stats", "crawl:progress", "qdrant:stats", "error"]
}));
```

---

### Monitor Service Logs

#### API Server Logs
```bash
docker logs -f claude-context-api-server --tail 50
```

Watch for:
- ✅ `[WebSocket] Client connected`
- ✅ `[WebSocket] Client subscribed to project:`
- ⚠️ `[QdrantMonitor] Failed to list collections` (Non-critical)

#### PostgreSQL Logs
```bash
docker logs -f claude-context-postgres --tail 20
```

#### Crawl4AI Logs
```bash
docker logs -f claude-context-crawl4ai --tail 20
```

---

## Data Flow Verification

### Flow 1: UI → API → Database

**Step 1: UI makes request**
```
Browser: GET http://localhost:3030/health
```

**Step 2: Check middleware**
```bash
curl -v http://localhost:3030/health 2>&1 | grep -A 5 "HTTP/"
```

**Step 3: Verify database**
```bash
psql -h localhost -p 5533 -U postgres -d claude_context \
  -c "SELECT COUNT(*) FROM claude_context.projects;"
```

### Flow 2: API → WebSocket → UI

**Step 1: Subscribe via WebSocket**
- Done automatically by UI in Live mode

**Step 2: Check broadcasts**
- Monitor: `docker logs -f claude-context-api-server`
- Should show `[WebSocket] Client connected`
- Should show subscription messages

**Step 3: Receive updates**
- Check browser console: F12 → Console
- Should see WebSocket messages

---

## Common Issues & Solutions

### Issue: `Disconnected` in Live API mode

**Check 1: API Server Running**
```bash
curl -i http://localhost:3030/health
```
Should return HTTP 200

**Check 2: API URL Correct**
In UI, verify URL is: `http://localhost:3030`

**Check 3: Network Access**
```bash
netstat -tuln | grep 3030
# Should show: tcp ... LISTEN
```

---

### Issue: No Real-Time Updates

**Check 1: WebSocket Connected**
```
Browser Console: Should show "[WebSocket] Connected"
```

**Check 2: Subscription Active**
```bash
docker logs claude-context-api-server | grep "subscribed to project"
```

**Check 3: Monitor Services Running**
```bash
docker ps | grep claude-context
# All 4 containers should be UP
```

---

### Issue: Empty Metrics

**Check 1: Database Has Data**
```bash
psql -h localhost -p 5533 -U postgres -d claude_context \
  -c "SELECT project, COUNT(*) as chunks FROM chunks GROUP BY project;"
```

**Check 2: PostgreSQL Monitor Running**
```bash
docker logs claude-context-api-server | grep "PostgresMonitor"
```

**Check 3: Create Sample Data**
- Use GitHub ingestion form in UI
- Or use Crawl4AI form to create data

---

## Performance Testing

### Load Testing the WebSocket

```javascript
// In browser console
const clients = [];
for (let i = 0; i < 10; i++) {
  const ws = new WebSocket('ws://localhost:3030/ws');
  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: "subscribe",
      project: `Project${i}`,
      topics: ["postgres:stats", "crawl:progress"]
    }));
  };
  clients.push(ws);
}

// Check API logs:
// Should show "10 clients connected"
```

---

## Integration Testing Checklist

- [ ] UI Server responds to requests (port 3455)
- [ ] API Middleware responds to health checks (port 3030)
- [ ] WebSocket endpoint accessible (ws://localhost:3030/ws)
- [ ] PostgreSQL connected and responsive
- [ ] Qdrant vector database responding
- [ ] Crawl4AI service healthy
- [ ] Real-time metrics updating in UI
- [ ] Error messages displayed in error panel
- [ ] Project switching works
- [ ] Mode switching (Mock ↔ Live) works
- [ ] Connection status indicator accurate
- [ ] CORS requests succeed
- [ ] WebSocket reconnection works on disconnect
- [ ] All MCP tools listed in API response

---

## Success Criteria

✅ **All systems operational when:**

1. ✅ UI shows "Connected" in Live API mode
2. ✅ Metrics panel shows non-zero values
3. ✅ Browser console shows no errors
4. ✅ API server logs show active client connections
5. ✅ WebSocket messages flowing every ~500ms
6. ✅ All Docker containers healthy
7. ✅ Database queries return results

---

## Debugging Tips

### Enable Verbose Logging

**API Server:**
```bash
docker exec claude-context-api-server \
  npm run dev  # Restart in dev mode
```

**UI Console Tricks:**
```javascript
// Monitor all WebSocket messages
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(msg) {
  console.log('📤 Sending:', JSON.parse(msg));
  return originalSend.call(this, msg);
};

// Monitor all incoming messages
addEventListener('message', (e) => {
  console.log('📥 Received:', JSON.parse(e.data));
});
```

---

**Happy Testing! 🚀**

For issues, check the logs:
- API: `docker logs -f claude-context-api-server`
- UI: Browser DevTools (F12)
- DB: `docker logs -f claude-context-postgres`
