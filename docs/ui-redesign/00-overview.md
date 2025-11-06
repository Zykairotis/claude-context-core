# Material Mesh Command Center - Overview

**Status**: Planning  
**Started**: 2025-11-04  
**Target**: Complete UI redesign with Material UI, drag-and-drop mesh, and real-time updates

---

## Vision

Transform the current Claude Context Core UI into a **Material Mesh Command Center**: a Material UI-themed canvas where users drag knowledge sources onto a playground, wire them together, and watch everything update in real-time.

### Core Principles

1. **Visual Mesh Paradigm**: Knowledge sources, pipelines, and outputs as draggable nodes on a canvas
2. **Real-time Everything**: WebSocket-driven updates for all state changes, metrics, and logs
3. **Material UI Foundation**: Consistent, accessible, production-grade components
4. **Liquid Glass Aesthetic**: Translucent, blurred surfaces with cyan/purple accents
5. **Information Architecture**: Three-panel layout (Palette → Canvas → Inspector)

---

## What This Replaces

### Current UI (to be replaced)
- **Location**: `/src/ui/app.tsx` (1702 lines)
- **Style**: Custom glass theme with red/blue accents
- **Layout**: Dock navigation + scrolling sections
- **State**: React hooks + WebSocket
- **Sections**: Overview, Ingest, Retrieval, Scopes, Telemetry, Operations

### New UI Architecture
- **Style**: Material UI with liquid glass theme
- **Layout**: AppBar + Left Drawer (palette) + Canvas (mesh) + Right Drawer (inspector) + Bottom Shelf (logs)
- **State**: Zustand (realtime) + React Query (HTTP)
- **Paradigm**: Node-based visual programming

---

## Key Features

### 1. Drag-and-Drop Mesh Canvas
- Drag knowledge sources from palette → canvas
- Wire nodes together with typed edges (data/trigger/control)
- Live status updates on nodes and edges
- React Flow-powered graph visualization

### 2. Real-time Updates
- WebSocket connection per project
- Live node status changes (idle → queued → running → ok/failed)
- Live metrics charts (ingestion rate, latency P95, throughput)
- Live log streaming per node
- Live event feed in bottom shelf

### 3. Three-Panel Inspector
- **Left**: Palette + filters + mini stats
- **Main**: Canvas with zoom/pan/layout controls
- **Right**: Selected node/edge details with tabs:
  - Overview: metadata, status, config
  - Metrics: sparklines, throughput, errors
  - Logs: live tail with pause/search
  - Artifacts: links to outputs, datasets, reports
  - Actions: Run, Stop, Retry, Delete, Open in GitHub

### 4. Material UI Components
- Consistent theming across all components
- Accessible by default (ARIA, keyboard nav)
- DataGrid for job tables
- Charts for metrics visualization
- Responsive layout with MUI Grid

---

## Implementation Shards

This redesign is broken into 11 implementation shards:

1. **[00-overview.md]** ← You are here
2. **[01-tech-stack.md]** - Dependencies, build tools, dev setup
3. **[02-data-models.md]** - TypeScript types, envelopes, state shape
4. **[03-realtime-system.md]** - WebSocket architecture, Zustand store, hooks
5. **[04-layout-components.md]** - Three-panel layout, AppBar, Drawers, Shelf
6. **[05-drag-drop-system.md]** - Palette items, canvas drop zones, React Flow integration
7. **[06-material-theme.md]** - Liquid glass theme, component overrides, variants
8. **[07-node-types.md]** - GitHub, Crawler, Vector DB, Reranker, LLM, Dashboard nodes
9. **[08-api-contract.md]** - HTTP endpoints, request/response shapes
10. **[09-user-flows.md]** - Step-by-step interaction patterns
11. **[10-migration-plan.md]** - How to migrate from current UI, rollout strategy

---

## Success Metrics

### Before (Current UI)
- Single-page app with 6 sections
- Form-based interactions
- Limited visual feedback
- WebSocket updates for stats only

### After (Material Mesh)
- Visual programming paradigm
- Drag-and-drop workflow creation
- Real-time node/edge status updates
- Live metrics and log streaming
- Consistent Material UI design language

---

## Next Steps

1. Review all shards in sequence
2. Approve tech stack and dependencies → [01-tech-stack.md]
3. Implement Zustand realtime store → [03-realtime-system.md]
4. Build layout shell with MUI → [04-layout-components.md]
5. Implement drag-and-drop → [05-drag-drop-system.md]
6. Create node components → [07-node-types.md]
7. Wire up WebSocket → [03-realtime-system.md]
8. Build API integration → [08-api-contract.md]
9. Test user flows → [09-user-flows.md]
10. Migrate incrementally → [10-migration-plan.md]

---

**Read next**: [01-tech-stack.md](./01-tech-stack.md)
