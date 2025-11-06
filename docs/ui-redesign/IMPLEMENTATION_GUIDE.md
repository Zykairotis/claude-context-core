# Material Mesh Command Center - Implementation Guide

**Quick Start Guide for Developers**

---

## Overview

This guide walks you through implementing the Material Mesh Command Center UI redesign. The complete plan is broken into 11 shards (00-10) covering every aspect from architecture to deployment.

---

## Prerequisites

- Node.js 18+
- TypeScript 5.3+
- Familiarity with React 18, Material UI, and WebSocket
- Access to the existing API server (port 3030)

---

## Quick Start (15 minutes)

### 1. Read Core Documents

Start with these 3 shards to understand the vision:
1. **[00-overview.md](./00-overview.md)** - Vision, features, architecture (5 min)
2. **[01-tech-stack.md](./01-tech-stack.md)** - Dependencies and setup (5 min)
3. **[10-migration-plan.md](./10-migration-plan.md)** - 5-phase rollout strategy (5 min)

### 2. Install Dependencies

```bash
cd /path/to/claude-context-core

# Install all dependencies at once
npm install @mui/material@^5.15.0 @mui/icons-material@^5.15.0 \
            @emotion/react@^11.11.0 @emotion/styled@^11.11.0 \
            reactflow@^11.10.0 \
            zustand@^4.5.0 \
            @tanstack/react-query@^5.17.0 \
            recharts@^2.10.0 \
            nanoid@^5.0.0 \
            date-fns@^3.0.0
```

### 3. Setup Project Structure

```bash
# Create new UI directory structure
mkdir -p src/ui-mesh/{app,components,store,lib,types}
mkdir -p src/ui-mesh/components/{AppBar,LeftDrawer,RightDrawer,BottomShelf,Canvas}
mkdir -p src/ui-mesh/components/Canvas/{nodes,edges}
```

### 4. Start with Phase 1

Follow **[10-migration-plan.md](./10-migration-plan.md)** Phase 1 checklist:
- Day 1: Configure Vite and TypeScript
- Day 2: Create MUI theme
- Day 3: Setup Zustand store
- Day 4: Implement WebSocket hook
- Day 5: Define TypeScript types

---

## Implementation Order

### Week 1: Foundation
1. **Day 1-2**: Setup (01-tech-stack.md)
2. **Day 3**: State & Data Models (02-data-models.md, 03-realtime-system.md)
3. **Day 4-5**: Layout Shell (04-layout-components.md)

### Week 2: Core Features
1. **Day 6-8**: Drag & Drop (05-drag-drop-system.md)
2. **Day 9-10**: Theming (06-material-theme.md)
3. **Day 11-12**: Nodes & Edges (07-node-types.md)

### Week 3: Integration
1. **Day 13-15**: API Integration (08-api-contract.md)
2. **Day 16-17**: Real-time Updates (03-realtime-system.md)
3. **Day 18**: Testing (09-user-flows.md)

### Week 4: Polish & Deploy
1. **Day 19-21**: Bug fixes and polish
2. **Day 22-23**: Documentation and handoff
3. **Day 24+**: Gradual rollout (10-migration-plan.md)

---

## Key Implementation Files

### Must Create First
```
src/ui-mesh/
├── theme.ts                 # MUI theme (06-material-theme.md)
├── types/index.ts           # TypeScript types (02-data-models.md)
├── store/realtime.ts        # Zustand store (03-realtime-system.md)
└── lib/
    ├── useWS.ts            # WebSocket hook (03-realtime-system.md)
    └── api.ts              # React Query hooks (08-api-contract.md)
```

### Build Second
```
src/ui-mesh/components/
├── AppBar.tsx              # (04-layout-components.md)
├── LeftDrawer/
│   ├── index.tsx
│   ├── Palette.tsx         # (05-drag-drop-system.md)
│   └── PaletteItem.tsx
├── Canvas/
│   ├── ReactFlowCanvas.tsx # (05-drag-drop-system.md)
│   └── nodes/
│       ├── KnowledgeNode.tsx   # (07-node-types.md)
│       └── nodeIcons.tsx
└── RightDrawer/
    └── Inspector.tsx
```

### Build Third
```
src/ui-mesh/app/
└── App.tsx                 # Main app component
```

---

## Code Snippets

### Minimal Working Example

**1. Theme Setup** (`src/ui-mesh/theme.ts`):
```typescript
import { createTheme, alpha } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#7dd3fc' },
    secondary: { main: '#a78bfa' }
  }
});
```

**2. Zustand Store** (`src/ui-mesh/store/realtime.ts`):
```typescript
import { create } from 'zustand';

export const useRealtime = create<State>((set) => ({
  nodes: {},
  edges: {},
  status: 'connecting',
  apply: (msg) => { /* handle WS message */ }
}));
```

**3. WebSocket Hook** (`src/ui-mesh/lib/useWS.ts`):
```typescript
export function useWS(url: string) {
  const apply = useRealtime(s => s.apply);
  // ... connection logic
}
```

**4. App Component** (`src/ui-mesh/app/App.tsx`):
```typescript
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import { useWS } from '../lib/useWS';

export function App() {
  useWS('ws://localhost:3030/ws?project=default');
  
  return (
    <ThemeProvider theme={theme}>
      {/* Layout components */}
    </ThemeProvider>
  );
}
```

---

## Common Pitfalls

### ❌ Don't Do This
```typescript
// Don't mutate Zustand state directly
state.nodes[id] = newNode;

// Don't create nodes without position
const node = { kind: 'github', label: 'Repo' }; // Missing position!

// Don't forget WebSocket cleanup
useEffect(() => {
  const ws = new WebSocket(url);
  // Missing: return () => ws.close();
});
```

### ✅ Do This Instead
```typescript
// Use set() for state updates
set({ nodes: { ...state.nodes, [id]: newNode } });

// Always include position
const node = { kind: 'github', label: 'Repo', position: { x: 0, y: 0 } };

// Always cleanup WebSocket
useEffect(() => {
  const ws = new WebSocket(url);
  return () => ws.close();
}, [url]);
```

---

## Testing Strategy

### Unit Tests
```bash
# Test Zustand store
npm test src/store/realtime.spec.ts

# Test hooks
npm test src/lib/useWS.spec.ts
```

### Integration Tests
```bash
# Test drag-and-drop
npm test src/components/Canvas/__tests__/drag-drop.spec.tsx

# Test real-time updates
npm test src/components/__tests__/realtime.spec.tsx
```

### E2E Tests
Run all user flows from **[09-user-flows.md](./09-user-flows.md)** manually or with Playwright.

---

## Debugging Guide

### WebSocket Not Connecting
1. Check API server is running: `curl http://localhost:3030/api/health`
2. Check WebSocket endpoint: `wscat -c ws://localhost:3030/ws`
3. Check browser console for errors
4. Verify `useWS` hook is called with correct URL

### Nodes Not Updating
1. Check Zustand devtools (install Redux DevTools extension)
2. Verify WebSocket messages are received: `console.log` in `apply()`
3. Check React Flow is rendering: `console.log` in node component
4. Verify state is synced: compare Zustand state to React Flow nodes

### Drag-and-Drop Not Working
1. Check `draggable` attribute on palette items
2. Verify `onDragStart` sets correct data format
3. Check `onDrop` handler is receiving data
4. Verify `rf.project()` converts coordinates correctly

---

## Performance Optimization

### Lazy Load Heavy Components
```typescript
const DataGrid = lazy(() => import('@mui/x-data-grid'));
const Charts = lazy(() => import('./components/Charts'));
```

### Virtualize Long Lists
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={logs.length}
  itemSize={35}
>
  {({ index, style }) => <LogLine style={style} log={logs[index]} />}
</FixedSizeList>
```

### Debounce High-Frequency Updates
```typescript
const debouncedApply = useMemo(
  () => debounce((messages) => messages.forEach(apply), 250),
  [apply]
);
```

---

## Deployment Checklist

### Before Production
- [ ] All tests passing
- [ ] Performance benchmarks met (<3s load, >30 FPS)
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Cross-browser tested (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsive (375px - 1920px)
- [ ] Error tracking configured
- [ ] Feature flag implemented

### Deploy Options
1. **Feature Flag**: `?ui=mesh` for gradual rollout (recommended)
2. **Separate Route**: `/mesh` alongside old UI
3. **Full Replace**: Replace old UI entirely (risky)

---

## Getting Help

### Documentation
- **Architecture**: [00-overview.md](./00-overview.md)
- **Tech Stack**: [01-tech-stack.md](./01-tech-stack.md)
- **Data Models**: [02-data-models.md](./02-data-models.md)
- **User Flows**: [09-user-flows.md](./09-user-flows.md)
- **Migration**: [10-migration-plan.md](./10-migration-plan.md)

### Code Examples
Every shard (01-10) includes complete, copy-pastable code examples.

### Support
Open an issue in the repository with:
- Which shard you're implementing
- What you tried
- Error messages or screenshots
- Environment details (OS, Node version, browser)

---

## Success Metrics

Track these to measure success:

### Technical
- **Initial Load**: <3s (target)
- **Time to Interactive**: <5s (target)
- **FPS During Drag**: >30 (target)
- **WebSocket Latency**: <100ms (target)

### User
- **Node Creation Rate**: Avg nodes per session
- **Pipeline Completion**: % of started pipelines that finish
- **Error Rate**: <0.1% JS errors
- **User Satisfaction**: >4/5 rating

---

## What's Next?

1. ✅ Read [00-overview.md](./00-overview.md) for the vision
2. ✅ Install dependencies from [01-tech-stack.md](./01-tech-stack.md)
3. ✅ Follow [10-migration-plan.md](./10-migration-plan.md) Phase 1
4. 🚀 Start building!

---

**Last Updated**: 2025-11-04  
**Status**: Ready for implementation  
**Estimated Timeline**: 4 weeks
