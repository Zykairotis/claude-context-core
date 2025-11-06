# Claude Context UI - User Guide

## Overview

Claude Context provides a visual node-based interface for building knowledge pipelines. Connect data sources (GitHub repos, web crawlers) to vector databases, rerankers, and LLMs to create powerful context-aware workflows.

---

## Getting Started

### First Launch

When you first open the UI, you'll see an empty canvas with a welcome message:

- 🎯 **Right-click** on canvas to add nodes
- 🔗 **Drag** between nodes to connect them
- ⌨️ **Delete/Backspace** to remove selected nodes
- 🖱️ **Mouse wheel** to zoom in/out

---

## Node Types

### 1. GitHub Repo 🐙
**Purpose**: Index code repositories for semantic search

**Status Indicators**:
- **Idle** (gray): Ready to run
- **Queued** (orange): Waiting to start
- **Running** (blue): Currently indexing
- **OK** (green): Successfully completed
- **Failed** (red): Error occurred

**Actions**:
- ▶️ **Run**: Start indexing the repository
- ⏹️ **Stop**: Cancel running job
- ⚙️ **Settings**: Configure repository settings
- 🗑️ **Delete**: Remove node

### 2. Web Crawler 🌐
**Purpose**: Crawl and index web pages

**Actions**: Same as GitHub Repo

### 3. Vector DB 💾
**Purpose**: Store and query embeddings

**Actions**: Same as GitHub Repo

### 4. Reranker 🎯
**Purpose**: Re-rank search results for better relevance

**Actions**: Same as GitHub Repo

### 5. LLM 🤖
**Purpose**: Large Language Model for generation

**Actions**: Same as GitHub Repo

### 6. Dashboard 📊
**Purpose**: View metrics and insights

**Actions**: Same as GitHub Repo

---

## Working with Nodes

### Creating Nodes

**Method 1: Context Menu**
1. Right-click on empty canvas space
2. Select node type from menu
3. Node appears at click position

**Method 2: Drag from Palette** (if available)
1. Drag node type from side palette
2. Drop onto canvas
3. Node appears at drop position

### Moving Nodes

1. Click and hold on a node
2. Drag to new position
3. Release to place
4. Position auto-saves after 300ms

### Connecting Nodes

1. Hover over node edge (handles appear)
2. Click and drag from **right handle** (source)
3. Drop on **left handle** (target) of another node
4. Edge is created automatically

### Node Actions

**Hover Behavior**:
- Action buttons slide up from bottom
- Buttons appear with stagger animation
- Each button glows on hover

**Button Colors**:
- 🟢 **Green**: Run/Start action
- 🟠 **Orange**: Stop/Warning action
- 🟡 **Amber**: Settings/Configure
- 🔴 **Red**: Delete/Remove

**Loading States**:
- Spinner replaces icon during operation
- Button disabled until complete
- Other buttons disabled during delete

### Deleting Nodes

1. Click **Delete** button (🗑️) on node
2. Confirm deletion when prompted
3. Node and connected edges removed

**Keyboard Shortcut**:
- Select node → Press **Delete** or **Backspace**

---

## Canvas Controls

### Navigation

**Zoom**:
- Mouse wheel up/down
- Controls panel: `+` and `-` buttons

**Pan**:
- Click and drag on empty space
- Arrow keys (when canvas focused)

**Fit View**:
- Click fit-view button in controls
- Right-click → "Fit View" in context menu

### Selection

**Single Node**:
- Click on node

**Multiple Nodes** (future feature):
- Hold **Shift** + Click nodes
- Or drag selection box

### Context Menus

**Canvas Menu** (right-click empty space):
- Add Node → [Node Types]
- Fit View
- Select All

**Node Menu** (right-click node):
- Copy
- Duplicate
- Delete

---

## Real-Time Updates

### WebSocket Connection

The UI maintains a live connection to the backend:

**Connection Status**:
- 🟢 Connected: Real-time updates active
- 🟡 Connecting: Attempting to connect
- 🔴 Disconnected: Offline mode

**Auto-Updates**:
- Node status changes
- Job progress
- Log entries
- Metrics updates

**Reconnection**:
- Automatic retry on disconnect
- Exponential backoff
- Visual indicator in UI

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Delete** / **Backspace** | Delete selected nodes |
| **Space** + Drag | Pan canvas |
| **Mouse Wheel** | Zoom in/out |
| **Ctrl/Cmd + Z** | Undo (future) |
| **Ctrl/Cmd + Y** | Redo (future) |
| **Ctrl/Cmd + A** | Select all (future) |
| **Ctrl/Cmd + D** | Duplicate (future) |

---

## Error Handling

### Toast Notifications

**Success Messages** (green):
- Node created successfully
- Operation completed

**Warning Messages** (orange):
- Server offline, saved locally
- Non-critical issues

**Error Messages** (red):
- Failed to create node
- API errors
- Validation failures

### Offline Mode

**When Server Unavailable**:
- ✅ Create nodes (saved locally)
- ✅ Move nodes (saved locally)
- ✅ Delete nodes (saved locally)
- ❌ Run/Stop (requires server)
- 🔄 Auto-sync when reconnected

**User Experience**:
- Single warning notification
- Operations continue optimistically
- Changes persist until sync

---

## Best Practices

### Pipeline Design

1. **Start with Sources**: GitHub, Crawler
2. **Add Processing**: Vector DB, Reranker
3. **Connect to LLM**: For generation
4. **Monitor with Dashboard**: Track metrics

### Performance Tips

- Limit canvas to <100 nodes
- Use minimap for large pipelines
- Zoom out for overview
- Delete unused nodes

### Workflow

1. **Design**: Plan pipeline on canvas
2. **Configure**: Set node settings
3. **Connect**: Link data flow
4. **Run**: Execute pipeline
5. **Monitor**: Watch status and logs

---

## Troubleshooting

### "Cannot connect to server"

**Cause**: API server not running

**Solution**:
```bash
# Start API server
cd services/api-server
npm run dev

# Or via Docker
docker-compose up api-server
```

**Workaround**: UI works in offline mode with local state

### "Failed to create node"

**Cause**: Validation error or server issue

**Solution**:
1. Check console for details
2. Verify node configuration
3. Retry operation

### Nodes not updating

**Cause**: WebSocket disconnected

**Solution**:
1. Check connection indicator
2. Wait for auto-reconnect
3. Refresh page if needed

### Canvas performance slow

**Cause**: Too many nodes or complex layout

**Solution**:
1. Delete unused nodes
2. Simplify connections
3. Use multiple projects

---

## Tips & Tricks

### Quick Actions

- **Double-click node**: Open settings (future)
- **Right-click canvas**: Quick add menu
- **Shift + Click**: Multi-select (future)

### Visual Cues

- **Node border thickness**: Selected = 2px
- **Node shadow**: Running = animated glow
- **Edge thickness**: Selected = 3px
- **Edge color**: Type-based (data/trigger/control)

### Productivity

- Use keyboard shortcuts
- Right-click for context menus
- Watch status colors
- Monitor toast notifications

---

## Support

### Getting Help

- **Documentation**: `/docs/ui-redesign/`
- **API Docs**: `/docs/` (root)
- **Issues**: GitHub Issues
- **Console**: Check browser console for errors

### Reporting Bugs

Include:
1. Steps to reproduce
2. Expected vs actual behavior
3. Browser console errors
4. Screenshot if relevant

---

## Version History

**v1.0.0** (Current)
- Node-based canvas interface
- Real-time WebSocket updates
- Optimistic UI updates
- Offline mode support
- Error handling with toast notifications
- Debounced position updates
- Empty state with hints
- Keyboard shortcuts
