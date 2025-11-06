# Migration Plan

**Shard**: 10  
**Dependencies**: All implementation shards  
**Blocks**: Production rollout

---

## Overview

This plan outlines a **5-phase, 4-week migration** from the current UI to the Material Mesh Command Center. Each phase has clear deliverables, acceptance criteria, and rollback procedures.

---

## Phase 1: Foundation & Setup

**Duration**: Week 1 (Days 1-5)  
**Focus**: Infrastructure, dependencies, and core architecture

### Tasks

#### Day 1: Dependencies
- [ ] **Install packages** (see 01-tech-stack.md)
  ```bash
  npm install @mui/material @mui/icons-material \
              @emotion/react @emotion/styled \
              reactflow zustand @tanstack/react-query \
              recharts nanoid date-fns
  ```
- [ ] **Configure Vite** (`vite.config.ts`)
  - Add path aliases (`@`, `@components`, `@store`, `@lib`)
  - Setup proxy for `/api` and `/ws`
  - Configure build optimization
- [ ] **Update tsconfig.json**
  - Enable strict mode
  - Add path mappings
  - Configure JSX settings

#### Day 2: Theme & Styling
- [ ] **Create MUI theme** (`src/theme.ts`)
  - Define palette (dark mode, cyan/purple accents)
  - Configure typography (Inter font)
  - Set component overrides (liquid glass effects)
  - Test backdrop-filter support
- [ ] **Add global styles** (CssBaseline)
  - Scrollbar customization
  - Reset defaults
  - Focus outlines

#### Day 3: State Management
- [ ] **Setup Zustand store** (`src/store/realtime.ts`)
  - Define state shape (nodes, edges, events, charts)
  - Implement actions (apply, setConnection, clearNode)
  - Add devtools middleware
  - Write unit tests for reducers
- [ ] **Setup React Query** (`src/lib/api.ts`)
  - Configure QueryClient
  - Add default options
  - Setup cache persistence

#### Day 4: WebSocket Hook
- [ ] **Create useWS hook** (`src/lib/useWS.ts`)
  - Connection management
  - Reconnection logic with exponential backoff
  - Message parsing and validation
  - Error handling
  - Test connection stability

#### Day 5: Data Models
- [ ] **Define TypeScript types** (`src/types/index.ts`)
  - MeshNode, MeshEdge
  - WsMessage envelopes
  - NodeKind, Status enums
  - API request/response shapes
- [ ] **Write type tests**
  - Type safety checks
  - Discriminated unions

### Acceptance Criteria
- ✅ All dependencies installed, no version conflicts
- ✅ Vite dev server runs without errors
- ✅ Theme renders correctly in Storybook
- ✅ Zustand store passes unit tests
- ✅ WebSocket connects and reconnects properly
- ✅ TypeScript compiles with zero errors

### Rollback
If issues arise, revert to current UI. No backend changes at this phase.

---

## Phase 2: Layout & Shell

**Duration**: Week 1-2 (Days 6-10)  
**Focus**: Three-panel layout, navigation, and responsive design

### Tasks

#### Day 6: App Shell
- [ ] **Create App component** (`src/app/App.tsx`)
  - ThemeProvider wrapper
  - Layout structure (AppBar + Grid)
  - WebSocket initialization
- [ ] **Build AppBar** (`src/components/AppBar.tsx`)
  - Project switcher
  - Connection status badge
  - User actions menu

#### Day 7: Left Drawer
- [ ] **Create drawer component** (`src/components/LeftDrawer/index.tsx`)
  - Permanent variant (desktop)
  - Temporary variant (mobile)
  - Collapse/expand toggle
- [ ] **Build Palette** (`src/components/LeftDrawer/Palette.tsx`)
  - Category sections (Sources, Storage, Processing, Outputs)
  - Palette items with icons
- [ ] **Add Filters** (`src/components/LeftDrawer/Filters.tsx`)
  - Project filter
  - Tag filter
  - Environment filter

#### Day 8: Right Inspector
- [ ] **Create inspector shell** (`src/components/RightDrawer/index.tsx`)
  - Tab system (Overview, Metrics, Logs, Artifacts, Actions)
  - Empty state ("Select a node")
  - Responsive sizing
- [ ] **Build tabs** (`src/components/RightDrawer/Inspector.tsx`)
  - Overview tab (metadata display)
  - Metrics tab (charts placeholder)
  - Logs tab (virtualized list)

#### Day 9: Bottom Shelf
- [ ] **Create activity feed** (`src/components/BottomShelf/index.tsx`)
  - Collapsible panel
  - Event list with icons
  - Auto-scroll with pause
  - Filter by severity
- [ ] **Add log streaming** (`src/components/BottomShelf/ActivityFeed.tsx`)
  - Real-time event display
  - Click to focus node
  - Export logs button

#### Day 10: Responsive Testing
- [ ] **Test breakpoints**
  - Desktop (1920x1080)
  - Laptop (1440x900)
  - Tablet (1024x768)
  - Mobile (375x667)
- [ ] **Fix layout issues**
- [ ] **Add mobile navigation**

### Acceptance Criteria
- ✅ Layout renders on all screen sizes
- ✅ Drawers open/close smoothly
- ✅ AppBar shows connection status
- ✅ Bottom shelf collapses/expands
- ✅ No layout shift or jank
- ✅ Passes accessibility audit

### Rollback
Feature flag can hide new layout, show old UI.

---

## Phase 3: Canvas & Nodes

**Duration**: Week 2-3 (Days 11-15)  
**Focus**: React Flow integration, drag-and-drop, node components

### Tasks

#### Day 11: React Flow Setup
- [ ] **Install React Flow** (`reactflow`)
- [ ] **Create canvas component** (`src/components/Canvas/ReactFlowCanvas.tsx`)
  - ReactFlowProvider wrapper
  - Background grid
  - MiniMap
  - Controls (zoom, fit view)
- [ ] **Configure node types**
  - Register KnowledgeNode
  - Set default styles

#### Day 12: Drag & Drop
- [ ] **Implement palette drag** (`src/components/LeftDrawer/PaletteItem.tsx`)
  - onDragStart handler
  - dataTransfer payload
  - Ghost image
- [ ] **Implement canvas drop** (`src/components/Canvas/ReactFlowCanvas.tsx`)
  - onDrop handler
  - Coordinate projection
  - Optimistic node creation
- [ ] **Test drag-and-drop**
  - All node types
  - Edge cases (invalid drops)
  - Keyboard accessibility

#### Day 13: Node Components
- [ ] **Build KnowledgeNode** (`src/components/Canvas/nodes/KnowledgeNode.tsx`)
  - Card layout
  - Status-based styling
  - Connection handles
  - Action buttons (Run, Stop, Settings, Delete)
- [ ] **Add node icons** (`src/components/Canvas/nodes/nodeIcons.tsx`)
  - Map NodeKind → MUI Icon
  - Color coding by status
- [ ] **Test node interactions**
  - Click to select
  - Hover effects
  - Action button clicks

#### Day 14: Edge Components
- [ ] **Build DataEdge** (`src/components/Canvas/edges/DataEdge.tsx`)
  - Bezier path calculation
  - Color by edge kind
  - Animated when active
  - Stats label overlay
- [ ] **Test edge creation**
  - Connect nodes
  - Delete edges
  - Edge selection

#### Day 15: Canvas Toolbar
- [ ] **Build toolbar** (`src/components/Canvas/CanvasToolbar.tsx`)
  - Zoom controls
  - Fit view button
  - Layout algorithm selector
  - Save/load mesh
- [ ] **Add keyboard shortcuts**
  - Delete (Del key)
  - Select all (Cmd+A)
  - Undo/Redo (Cmd+Z/Cmd+Shift+Z)

### Acceptance Criteria
- ✅ Can drag nodes from palette to canvas
- ✅ Nodes render with correct status colors
- ✅ Edges connect nodes properly
- ✅ Toolbar controls work
- ✅ Keyboard shortcuts functional
- ✅ No memory leaks with many nodes

### Rollback
Disable canvas route, show old UI forms.

---

## Phase 4: Real-time Updates

**Duration**: Week 3 (Days 16-18)  
**Focus**: WebSocket integration, live updates, charts

### Tasks

#### Day 16: WebSocket Integration
- [ ] **Connect useWS hook** in App component
- [ ] **Wire Zustand apply()** to message handler
- [ ] **Test message flow**
  - node-upsert → updates UI
  - node-status → changes color
  - edge-stats → updates labels
  - event → appears in Bottom Shelf

#### Day 17: Live Charts
- [ ] **Build chart components** (`src/components/Cards/`)
  - IngestRateCard (line chart)
  - LatencyCard (area chart)
  - ErrorRateCard (bar chart)
- [ ] **Integrate Recharts**
  - Responsive containers
  - Tooltips
  - Real-time data updates
- [ ] **Add to Inspector Metrics tab**

#### Day 18: Log Streaming
- [ ] **Build log viewer** (`src/components/RightDrawer/LogsTab.tsx`)
  - Virtualized list (react-window)
  - Auto-scroll toggle
  - Search/filter
  - Level badges (info, warn, error)
- [ ] **Connect to WebSocket**
  - Subscribe to log-chunk messages
  - Buffer per-node logs
  - Limit to 1000 lines

### Acceptance Criteria
- ✅ Node status updates in <100ms
- ✅ Charts update smoothly (no flicker)
- ✅ Logs stream without lag
- ✅ Bottom shelf shows events instantly
- ✅ No WebSocket disconnections
- ✅ Reconnects automatically if dropped

### Rollback
Disconnect WebSocket, use polling fallback.

---

## Phase 5: API Integration & Polish

**Duration**: Week 4 (Days 19-23)  
**Focus**: CRUD operations, optimistic updates, error handling

### Tasks

#### Day 19: API Hooks
- [ ] **Implement React Query hooks** (`src/lib/api.ts`)
  - useMesh (GET /mesh)
  - useCreateNode (POST /nodes)
  - useCreateEdge (POST /edges)
  - useRunNode (POST /nodes/:id/run)
  - useNodeLogs (GET /nodes/:id/logs)
- [ ] **Add error handling**
  - Toast notifications
  - Retry logic
  - Offline support

#### Day 20: Optimistic Updates
- [ ] **Node creation**
  - Add to canvas immediately
  - Rollback if API fails
- [ ] **Edge creation**
  - Show edge instantly
  - Sync with backend
- [ ] **Node updates**
  - Debounce position changes
  - Batch API calls

#### Day 21: Polish & Animations
- [ ] **Add micro-interactions**
  - Node hover effects
  - Edge glow on select
  - Button press feedback
- [ ] **Loading states**
  - Skeleton screens
  - Spinners
  - Progress indicators
- [ ] **Empty states**
  - "No nodes yet" message
  - "Drag from palette" hint

#### Day 22: Testing & Bug Fixes
- [ ] **Manual testing**
  - All user flows (from 09-user-flows.md)
  - Edge cases
  - Error scenarios
- [ ] **Performance testing**
  - 100+ nodes on canvas
  - 1000+ log lines
  - High-frequency WebSocket messages
- [ ] **Fix issues**

#### Day 23: Documentation & Handoff
- [ ] **User guide**
  - Screenshot walkthrough
  - Video tutorial
  - Keyboard shortcuts reference
- [ ] **Developer docs**
  - Architecture diagram
  - API documentation
  - Deployment guide

### Acceptance Criteria
- ✅ All CRUD operations work
- ✅ Optimistic updates smooth
- ✅ No visual bugs
- ✅ Performance acceptable
- ✅ Documentation complete
- ✅ Passes QA checklist

### Rollback
Feature flag switches to old UI.

---

## Rollout Strategy

### Option A: Feature Flag (Recommended)

**Implementation**:
```typescript
// Check URL param
const useMeshUI = new URLSearchParams(window.location.search).get('ui') === 'mesh';

// Or localStorage
const useMeshUI = localStorage.getItem('ui') === 'mesh';

// Render conditionally
return useMeshUI ? <MeshApp /> : <OldApp />;
```

**Rollout**:
1. Week 1: Internal team only (`?ui=mesh`)
2. Week 2: Beta users opt-in
3. Week 3: Default for new users
4. Week 4: Default for all users (old UI via `?ui=legacy`)
5. Week 6: Remove old UI

**Advantages**:
- Safe incremental rollout
- Easy rollback
- A/B testing possible
- User choice during transition

---

### Option B: Separate Route

**Implementation**:
```typescript
// routes.tsx
<Routes>
  <Route path="/" element={<OldApp />} />
  <Route path="/mesh" element={<MeshApp />} />
</Routes>
```

**Rollout**:
1. Deploy `/mesh` route
2. Announce new UI to users
3. Collect feedback
4. Redirect `/` → `/mesh` after 2 weeks
5. Remove old route

**Advantages**:
- Clear separation
- Both UIs accessible
- Easy comparison

---

### Option C: Full Replace (Not Recommended)

**Implementation**:
Replace `/src/ui/app.tsx` entirely.

**Rollout**:
1. Deploy with feature flag OFF
2. Enable for 10% of users
3. Monitor errors
4. Gradually increase to 100%

**Risks**:
- No easy rollback
- All users affected at once

---

## Monitoring & Metrics

### Key Metrics

**Performance**:
- Initial load time (<3s target)
- Time to Interactive (<5s target)
- FPS during node drag (>30 target)
- WebSocket latency (<100ms target)

**Engagement**:
- Daily active users
- Nodes created per session
- Pipelines built per week
- Feature adoption rate

**Errors**:
- JavaScript errors (target: <0.1%)
- API errors (target: <1%)
- WebSocket disconnects (target: <5%)

### Monitoring Setup

```typescript
// Error tracking
window.addEventListener('error', (event) => {
  sendToAnalytics('error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno
  });
});

// Performance tracking
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    sendToAnalytics('performance', {
      name: entry.name,
      duration: entry.duration
    });
  }
});
observer.observe({ entryTypes: ['measure', 'navigation'] });
```

---

## Success Criteria

### Phase 1 ✅
- Dependencies installed
- Theme working
- State management ready

### Phase 2 ✅
- Layout renders
- Responsive design
- All panels functional

### Phase 3 ✅
- Drag-and-drop working
- Nodes render correctly
- Edges connect properly

### Phase 4 ✅
- WebSocket connected
- Live updates flowing
- Charts updating

### Phase 5 ✅
- API integration complete
- All features working
- Documentation ready

### Production ✅
- Deployed to production
- Metrics tracking
- User feedback positive

---

## Checklist Before Go-Live

### Technical
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Security audit passed
- [ ] Browser compatibility tested
- [ ] Mobile responsiveness verified

### Content
- [ ] User documentation complete
- [ ] Video tutorials recorded
- [ ] Changelog published
- [ ] Migration guide written
- [ ] FAQ answered

### Operations
- [ ] Monitoring dashboard setup
- [ ] Error alerts configured
- [ ] Rollback procedure documented
- [ ] Team trained on new UI
- [ ] Support tickets prepared

---

**Complete!** You now have a comprehensive plan to migrate to the Material Mesh Command Center.

**Start here**: [00-overview.md](./00-overview.md)
