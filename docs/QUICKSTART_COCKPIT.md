# Quick Start: Real-time Glass Cockpit

## 60-Second Setup

```bash
# 1. Start backend services
cd services
./start-cockpit.sh

# 2. Start UI (in new terminal)
cd ui
npm install
npm run dev

# 3. Open browser
# http://localhost:3455

# 4. Switch to "Live API" mode
# Connection status will turn green ✅
```

## Test Real-time Updates

### Trigger a Test Crawl

1. Click **Ingestion Control** card
2. Select **Crawl4AI** tab
3. Fill in:
   - Start URL: `https://docs.python.org/3/tutorial/`
   - Max pages: `10`
   - Depth: `2`
4. Click **Launch Crawl session**

### Watch Live Updates

- **Pipeline Telemetry**: Progress bars update in real-time
- **Recent jobs**: New crawl appears automatically
- **Metrics**: Chunks/pages count increments
- **Operations**: Events stream in as they happen

## WebSocket Connection

When in "Live API" mode, the UI automatically:

1. Connects to `ws://localhost:3030/ws`
2. Subscribes to your project (e.g., "Atlas")
3. Receives real-time updates every 1-5 seconds
4. Shows connection status in top bar

## Connection Status Indicators

| Indicator | Meaning |
|-----------|---------|
| 🟢 **Live** | Connected, receiving updates |
| 🟡 **Connecting...** | Establishing connection |
| 🔴 **Offline** | Disconnected, click Reconnect |
| 🔴 **Error** | Connection error, check logs |

## Troubleshooting

### Can't connect to API server?

```bash
# Check if API server is running
curl http://localhost:3030/health

# View logs
docker-compose logs api-server

# Restart
docker-compose restart api-server
```

### No updates appearing?

1. Verify connection status is green
2. Check project name matches database
3. Open browser console (F12)
4. Look for WebSocket messages

### Services not starting?

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs

# Rebuild
docker-compose up --build -d
```

## Architecture Diagram

```
┌─────────────┐
│ React UI    │ :3455
│ (Vite)      │
└──────┬──────┘
       │ WS + HTTP
┌──────▼──────────┐
│ API Middleware  │ :3030
│ (Express + WS)  │
└──┬────┬────┬────┘
   │    │    │
   │    │    └─────┐
   │    │          │
┌──▼──┐ ┌──▼──┐ ┌──▼────┐
│PG   │ │Qdrant│ │Crawl4AI│
│:5533│ │:6333 │ │:7070   │
└─────┘ └──────┘ └────────┘
```

## Key Files

### Backend
- `services/api-server/src/server.ts` - Main server
- `services/api-server/src/routes/projects.ts` - REST endpoints
- `services/api-server/src/monitors/` - Polling agents
- `services/api-server/src/websocket/` - WebSocket server

### Frontend
- `src/ui/hooks/useWebSocket.ts` - WebSocket hook
- `src/ui/components/connection-status.tsx` - Status indicator
- `src/ui/components/error-display.tsx` - Error cards
- `src/ui/app.tsx` - Main UI component

### Docker
- `services/docker-compose.yml` - All services
- `services/api-server/Dockerfile` - API server image

## Common Commands

```bash
# Start everything
cd services && ./start-cockpit.sh

# Stop services
docker-compose down

# View logs (follow)
docker-compose logs -f api-server

# Rebuild after changes
docker-compose up --build -d api-server

# Reset everything
docker-compose down -v  # WARNING: Deletes data
docker-compose up -d

# Check health
curl http://localhost:3030/health
```

## REST API Quick Reference

```bash
# Get project stats
curl http://localhost:3030/projects/Atlas/stats

# Get scopes
curl http://localhost:3030/projects/Atlas/scopes

# Trigger crawl
curl -X POST http://localhost:3030/projects/Atlas/ingest/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "start_url": "https://example.com",
    "max_pages": 10,
    "crawl_type": "breadth-first"
  }'

# Query search
curl -X POST http://localhost:3030/projects/Atlas/query \
  -H "Content-Type: application/json" \
  -d '{
    "q": "how to implement caching",
    "k": 10
  }'

# List operations
curl http://localhost:3030/projects/Atlas/operations

# Get tools
curl http://localhost:3030/tools
```

## Environment Variables

Create `services/api-server/.env`:

```env
POSTGRES_URL=postgres://postgres:code-context-secure-password@localhost:5533/claude_context
QDRANT_URL=http://localhost:6333
CRAWL4AI_URL=http://localhost:7070
PORT=3030
NODE_ENV=development
```

## Next Steps

1. **Customize**: Edit polling intervals in `config.ts`
2. **Extend**: Add new monitors in `monitors/`
3. **Integrate**: Connect to your existing Context API
4. **Visualize**: Add charts with Recharts or ECharts
5. **Deploy**: Production deployment guide in `REAL_TIME_COCKPIT.md`

## Support

- **Logs**: `docker-compose logs -f <service>`
- **Health**: `http://localhost:3030/health`
- **Documentation**: `REAL_TIME_COCKPIT.md`
- **API Docs**: `services/api-server/README.md`

## Success Indicators

✅ All Docker containers show "Up (healthy)"  
✅ API health endpoint returns 200  
✅ UI connection status is green  
✅ Metrics update every few seconds  
✅ Errors appear as dismissable cards  
✅ Pipeline progress bars animate during crawls  

🎉 **Your real-time glass cockpit is operational!**

