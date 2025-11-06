# User Flows

**Shard**: 09  
**Dependencies**: All implementation shards  
**Blocks**: User acceptance testing

---

## Flow 1: Add GitHub Repository Source

### Goal
Ingest a GitHub repository into the knowledge mesh.

### Steps

1. **Open Palette**
   - Left drawer shows categorized knowledge sources
   - "Sources" category contains "GitHub Repo" tile

2. **Drag to Canvas**
   - Click and hold "GitHub Repo" tile
   - Drag cursor over canvas area
   - Visual feedback: ghost image follows cursor

3. **Drop on Canvas**
   - Release mouse over desired location
   - Node appears instantly (optimistic update)
   - Status: `idle`, position recorded
   - API call persists node to backend

4. **Configure Node**
   - Click node → Right Inspector opens
   - "Overview" tab shows:
     - Label (editable)
     - Kind: `github`
     - Status: `idle`
   - Fill in metadata:
     - Repository: `github.com/user/repo`
     - Branch: `main` (optional)
     - Dataset: `repo-data` (optional)

5. **Run Ingestion**
   - Click "Run" button in node or Inspector
   - Status changes: `idle` → `queued` → `running`
   - WebSocket sends progress updates:
     - "Fetching repository..."
     - "Chunking files: 45/120"
     - "Generating embeddings..."
     - "Storing to vector DB..."
   - Status changes to `ok` when complete

6. **Verify Completion**
   - Inspector "Metrics" tab shows:
     - Files processed: 120
     - Chunks created: 1,543
     - Duration: 2m 34s
   - Bottom shelf event: "✅ GitHub ingestion complete: repo-data"

### Expected Behavior
- Node border pulses blue while `running`
- Logs stream in Inspector "Logs" tab
- Progress percentage shown on node
- Errors trigger `failed` status with red border

---

## Flow 2: Connect Nodes (Pipeline Creation)

### Goal
Create a data flow from GitHub → Vector DB → Reranker.

### Steps

1. **Add Nodes**
   - Already have GitHub node from Flow 1
   - Drag "Vector DB" from palette → drop at x:400, y:100
   - Drag "Reranker" from palette → drop at x:700, y:100

2. **Create First Edge**
   - Hover over GitHub node → handles appear (blue circles)
   - Click and drag from right handle (source)
   - Drag to Vector DB left handle (target)
   - Release → Edge created
   - Edge properties:
     - Type: `smoothstep` (curved line)
     - Color: cyan (#7dd3fc) for `data` kind
     - Animated: false (until data flows)

3. **Create Second Edge**
   - Drag from Vector DB right handle
   - Connect to Reranker left handle
   - Edge created with same styling

4. **Verify Connections**
   - Canvas shows: GitHub → Vector DB → Reranker
   - Click edge → Right Inspector shows:
     - Source: GitHub node
     - Target: Vector DB node
     - Kind: `data`
     - Stats: (empty until data flows)

5. **Run Pipeline**
   - Click "Run" on GitHub node
   - Data flows through edges:
     - GitHub → Vector DB: animated blue line
     - Stats update: "1,543 items/min"
     - Vector DB → Reranker: animated after processing
   - All nodes turn green when complete

### Expected Behavior
- Edges animate when data flows
- Stats appear on edge labels
- Failed nodes stop downstream execution
- Bottom shelf shows "Pipeline complete" event

---

## Flow 3: Monitor Real-time Progress

### Goal
Track long-running operations in real-time.

### Steps

1. **Start Long Operation**
   - Run web crawler node (takes 5-10 minutes)
   - Status: `running`
   - Node border pulses blue

2. **Watch Bottom Shelf**
   - Activity feed shows:
     - "Crawler started: 0/100 pages"
     - "Crawling page: https://example.com/docs"
     - "Chunking content: 12/100"
     - "Generating embeddings: 45%"
   - Auto-scrolls to latest
   - Pause button stops auto-scroll

3. **View Inspector Logs**
   - Click crawler node
   - Inspector "Logs" tab shows:
     ```
     [12:34:01] Starting crawler...
     [12:34:05] Fetched https://example.com
     [12:34:08] Found 23 links
     [12:34:12] Processing page 5/100...
     ```
   - Auto-scrolls with new entries
   - Search/filter available

4. **Check Metrics**
   - Inspector "Metrics" tab shows live charts:
     - Pages/minute (line chart)
     - Latency P95 (area chart)
     - Error rate (bar chart)
   - Updates every 5 seconds via WebSocket

5. **Operation Completes**
   - Status: `running` → `ok`
   - Border turns green
   - Bottom shelf: "✅ Crawler complete: 100 pages indexed"
   - Metrics tab shows final stats

### Expected Behavior
- No page refresh needed
- Logs stream smoothly
- Charts update without flickering
- Can pause/resume auto-scroll

---

## Flow 4: Investigate & Fix Failure

### Goal
Diagnose and retry a failed operation.

### Steps

1. **Failure Detected**
   - Node turns red (status: `failed`)
   - Border color: #ef4444
   - Box shadow: red glow
   - Bottom shelf: "❌ Error: GitHub ingestion failed"

2. **Click Failed Node**
   - Right Inspector opens
   - "Overview" tab shows:
     - Status: `failed`
     - Error: "Repository not found: 404"
     - Last run: "2 minutes ago"

3. **View Logs**
   - Switch to "Logs" tab
   - Filter: "level:error"
   - Logs show:
     ```
     [12:45:23] ERROR: Failed to fetch repository
     [12:45:23] ERROR: GitHub API returned 404
     [12:45:23] Details: Repository 'user/wrong-repo' not found
     ```

4. **Fix Configuration**
   - Switch to "Overview" tab
   - Edit repository field: `user/correct-repo`
   - Click "Save"
   - Node updates via WebSocket

5. **Retry Operation**
   - Click "Retry" action button
   - Status: `failed` → `queued` → `running`
   - Border changes: red → yellow → blue
   - Logs tab shows new attempt

6. **Success**
   - Status: `running` → `ok`
   - Border turns green
   - Bottom shelf: "✅ GitHub ingestion complete"
   - Metrics tab shows success stats

### Expected Behavior
- Error messages are clear and actionable
- Easy to edit configuration
- Retry doesn't require page refresh
- Logs preserve history (both failed and successful attempts)

---

## Flow 5: Build Complete Pipeline

### Goal
Create end-to-end knowledge pipeline with monitoring.

### Steps

1. **Add All Nodes**
   - GitHub Repo → Dataset → Vector DB → Reranker → Dashboard
   - Arrange horizontally on canvas

2. **Connect Pipeline**
   - GitHub → Dataset (stores raw data)
   - Dataset → Vector DB (indexes embeddings)
   - Vector DB → Reranker (improves search)
   - Reranker → Dashboard (visualization)

3. **Configure Each Node**
   - Click each node, fill metadata
   - Set appropriate parameters
   - Save configurations

4. **Run Pipeline**
   - Click "Run" on GitHub node
   - Watch cascade execution:
     - GitHub runs first
     - Dataset starts after GitHub completes
     - Vector DB starts after Dataset
     - And so on...
   - Each node shows progress independently

5. **Monitor Health**
   - All nodes green = healthy
   - Any yellow = degraded performance
   - Any red = failure (stops cascade)
   - Bottom shelf shows timeline of events

6. **View Dashboard**
   - Click Dashboard node
   - Inspector shows embedded visualization
   - Charts, tables, search interface
   - All data from Vector DB

### Expected Behavior
- Visual cascade of execution
- Clear dependency flow
- Easy to spot bottlenecks
- Dashboard updates in real-time

---

**Read next**: [10-migration-plan.md](./10-migration-plan.md)
