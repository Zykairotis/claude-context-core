# ✨ Your Real-time Glass Cockpit is READY!

## 🎯 What Just Happened

You now have a **complete real-time monitoring system** running:

✅ **API Middleware** - Port 3030 (WebSocket + REST)  
✅ **Postgres** - Port 5533 (being monitored)  
✅ **Qdrant** - Port 6333 (being monitored)  
✅ **Crawl4AI** - Port 7070 (being monitored)  

## 🚀 Start the UI (Final Step)

```bash
cd ui
npm install
npm run dev
```

Then open: **http://localhost:3455**

## 🔄 Switch to Live Mode

1. In the UI, find the mode dropdown
2. Switch from **"Mock data"** to **"Live API"**
3. Watch the connection status turn **🟢 green**
4. Real-time updates start flowing!

## ✨ What You'll See

### Real-time Updates Every 1-5 Seconds:
- **Metrics**: Datasets, chunks, pages auto-update
- **Pipeline Progress**: Live crawl phase percentages
- **Job History**: New crawls appear automatically
- **Operations**: Events stream as they happen
- **Connection Status**: Live indicator (green/yellow/red)

### Interactive Features:
- **Trigger Crawls**: Use the Crawl4AI form
- **Error Cards**: Color-coded by source (Postgres/Crawl4AI/Qdrant)
- **Dismiss Errors**: Click X to remove
- **Reconnect**: Button appears if disconnected

## 🧪 Test It Out

### 1. Trigger a Test Crawl

In the UI:
1. Click "Ingestion Control" → "Crawl4AI" tab
2. Enter URL: `https://docs.python.org/3/tutorial/`
3. Max pages: `10`
4. Click "Launch Crawl session"

### 2. Watch Real-time Magic

- Pipeline progress bars animate
- Job appears in history
- Metrics increment
- All without refreshing!

## 📡 WebSocket is Active

Your UI is now connected to:
```
ws://localhost:3030/ws
```

Receiving updates:
- `postgres:stats` - Every 2 seconds
- `crawl:progress` - Every 1 second (during crawls)
- `qdrant:stats` - Every 5 seconds
- `error` - Instantly when errors occur

## 🛠️ Useful Commands

```bash
# View API logs
docker-compose -f services/docker-compose.yml logs -f api-server

# Check health
curl http://localhost:3030/health

# Stop everything
docker-compose -f services/docker-compose.yml down

# Restart API server
docker-compose -f services/docker-compose.yml restart api-server

# Rebuild after changes
docker-compose -f services/docker-compose.yml build api-server
docker-compose -f services/docker-compose.yml up -d api-server
```

## 📚 Documentation

- **Quick Start**: `ui/QUICKSTART_COCKPIT.md`
- **Full Guide**: `ui/REAL_TIME_COCKPIT.md`
- **GitHub Ingestion**: `ingestion/github/GITHUB_INGESTION_GUIDE.md`
- **API Docs**: `services/api-server/README.md`

## 🎨 Connection Status Colors

| Color | Status | Action |
|-------|--------|--------|
| 🟢 Green | Connected & Live | Receiving updates |
| 🟡 Yellow | Connecting... | Establishing connection |
| 🔴 Red | Disconnected | Click "Reconnect" |

## 🔍 Error Display

Errors appear as cards in top-right:
- 🔵 **Blue** = Postgres errors
- 🟠 **Orange** = Crawl4AI errors
- 🟣 **Purple** = Qdrant errors
- 🔴 **Red** = API/connection errors

## 🎉 You're All Set!

Your glass cockpit is fully operational. Just start the UI and switch to Live API mode!

**Questions?** Check the docs or logs mentioned above.

---

## 🎯 End-to-End Validation Checklist

Before considering the cockpit fully operational, validate these key features:

### ✅ 1. WebSocket Connection
- [ ] UI shows **🟢 green heartbeat** dot when connected
- [ ] Connection status badge says "Live"
- [ ] Last update timestamp refreshes every 1-5 seconds
- [ ] Browser console shows `[WebSocket] Connected`

### ✅ 2. Real-time Metrics
- [ ] Datasets/Chunks/Pages counts update automatically (no refresh needed)
- [ ] Numbers match what you see in database
- [ ] Trend indicators (up/steady/down arrows) work correctly
- [ ] Metrics update within 2-5 seconds of database changes

### ✅ 3. Pipeline Progress
- [ ] All 4 pipeline phases visible with completion percentages
- [ ] Phase labels change color based on completion:
  - Grey (0-15%): Discovery
  - Blue (20-60%): Crawling
  - Violet (70-80%): Summarizing  
  - Green (98-100%): Done
- [ ] Progress bars animate smoothly (no jumpy updates)
- [ ] Throughput numbers update during active crawls

### ✅ 4. Crawl Triggering & Monitoring
- [ ] "Launch Crawl session" button works
- [ ] New crawl appears in job history within 2-3 seconds
- [ ] Pipeline phase 1 shows live crawl progress
- [ ] Throughput shows `current/total` pages
- [ ] Completion percentage updates every 0.5-1 second

### ✅ 5. Error Handling
- [ ] Errors appear as dismissable cards in top-right
- [ ] Error cards are color-coded by source:
  - Blue: Postgres errors
  - Orange: Crawl4AI errors
  - Purple: Qdrant errors
  - Red: API/connection errors
- [ ] Click X to dismiss error cards
- [ ] Errors show timestamp and source

### ✅ 6. UI Interactions
- [ ] Mode dropdown switches between "Mock data" and "Live API"
- [ ] Cards have subtle hover effects (lift + glow)
- [ ] Buttons show liquid shimmer on hover
- [ ] Tabs switch content smoothly
- [ ] All forms are responsive

### ✅ 7. Performance
- [ ] UI remains responsive during high-frequency updates
- [ ] No memory leaks after 5+ minutes of use
- [ ] Browser DevTools shows 40-110 WebSocket msgs/min (normal)
- [ ] Page loads in < 2 seconds
- [ ] Smooth 60fps animations on cards/buttons

### ✅ 8. Multi-Crawl Isolation
- [ ] Trigger 2 crawls simultaneously
- [ ] Each crawl tracked separately in logs
- [ ] Progress updates don't interfere with each other
- [ ] Job history shows both crawls distinctly

### 🔍 Quick Validation Commands

```bash
# 1. Check all services are healthy
cd services && docker-compose ps

# 2. Test API health
curl http://localhost:3030/health

# 3. Monitor WebSocket messages
websocat ws://localhost:3030/ws

# 4. Watch API logs
docker-compose -f services/docker-compose.yml logs -f api-server

# 5. Check database connection
docker-compose -f services/docker-compose.yml exec postgres psql -U postgres -d claude_context -c "SELECT COUNT(*) FROM claude_context.projects;"
```

### 🐛 Common Issues & Fixes

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Red dot, "Disconnected" | API server not running | `docker-compose up -d api-server` |
| Metrics not updating | Wrong mode selected | Switch to "Live API" in dropdown |
| "Connection Error" | Wrong baseUrl | Check UI uses `http://localhost:3030` |
| No crawl progress | Crawl4AI down | `docker-compose restart crawl4ai` |
| Jumpy progress bars | Debouncing disabled | Verify `DEBOUNCE_INTERVAL_MS = 500` in app.tsx |

---

**Next:** `cd ui && npm run dev` then open http://localhost:3455
