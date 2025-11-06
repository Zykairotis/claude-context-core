# Layout & Core Components

**Shard**: 04  
**Dependencies**: 01-tech-stack, 02-data-models, 03-realtime-system  
**Blocks**: 05-drag-drop-system

---

## Three-Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│ AppBar: Project | Connection | Actions                 │
├────────┬───────────────────────────────┬────────────────┤
│        │                               │                │
│ Left   │     Main Canvas               │  Right         │
│ Drawer │     (React Flow)              │  Inspector     │
│        │                               │                │
│ 240px  │     Flexible                  │  320px         │
│        │                               │                │
├────────┴───────────────────────────────┴────────────────┤
│ Bottom Shelf: Activity Feed (collapsible)              │
└─────────────────────────────────────────────────────────┘
```

---

## App Shell

**File**: `src/app/App.tsx`

```typescript
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { theme } from '../theme';
import { AppBar } from '../components/AppBar';
import { LeftDrawer } from '../components/LeftDrawer';
import { MainCanvas } from '../components/Canvas/MainCanvas';
import { RightDrawer } from '../components/RightDrawer';
import { BottomShelf } from '../components/BottomShelf';
import { useWS } from '../lib/useWS';

export function App() {
  const project = 'default';
  const wsUrl = `ws://localhost:3030/ws?project=${project}`;
  useWS(wsUrl);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar project={project} />
        
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <LeftDrawer />
          <MainCanvas />
          <RightDrawer />
        </Box>
        
        <BottomShelf />
      </Box>
    </ThemeProvider>
  );
}
```

---

## AppBar Component

**File**: `src/components/AppBar.tsx`

```typescript
import MuiAppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { useRealtime } from '../store/realtime';

export function AppBar({ project }: { project: string }) {
  const status = useRealtime((s) => s.status);
  
  const statusColor = {
    open: 'success',
    connecting: 'warning',
    closed: 'default',
    error: 'error'
  }[status] as any;

  return (
    <MuiAppBar position="static" elevation={0}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Claude Context · {project}
        </Typography>
        
        <Chip 
          label={status} 
          color={statusColor} 
          size="small"
          variant="outlined"
        />
      </Toolbar>
    </MuiAppBar>
  );
}
```

---

## Left Drawer (Palette)

**File**: `src/components/LeftDrawer/index.tsx`

```typescript
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import { Palette } from './Palette';
import { Filters } from './Filters';
import { StatsMini } from './StatsMini';

const DRAWER_WIDTH = 240;

export function LeftDrawer() {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          top: 64, // AppBar height
          height: 'calc(100vh - 64px)'
        }
      }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Palette />
        <Filters />
        <StatsMini />
      </Box>
    </Drawer>
  );
}
```

---

## Right Drawer (Inspector)

**File**: `src/components/RightDrawer/index.tsx`

```typescript
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Inspector } from './Inspector';
import { useRealtime } from '../store/realtime';

const DRAWER_WIDTH = 320;

export function RightDrawer() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  return (
    <Drawer
      variant="permanent"
      anchor="right"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          top: 64,
          height: 'calc(100vh - 64px)'
        }
      }}
    >
      <Box sx={{ p: 2 }}>
        {selectedNode ? (
          <Inspector nodeId={selectedNode} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a node to inspect
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
```

---

## Main Canvas

**File**: `src/components/Canvas/MainCanvas.tsx`

```typescript
import Box from '@mui/material/Box';
import { ReactFlowProvider } from 'reactflow';
import { ReactFlowCanvas } from './ReactFlowCanvas';
import { CanvasToolbar } from './CanvasToolbar';

export function MainCanvas() {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}
    >
      <ReactFlowProvider>
        <CanvasToolbar />
        <ReactFlowCanvas />
      </ReactFlowProvider>
    </Box>
  );
}
```

---

## Bottom Shelf (Activity Feed)

**File**: `src/components/BottomShelf/index.tsx`

```typescript
import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ActivityFeed } from './ActivityFeed';

export function BottomShelf() {
  const [expanded, setExpanded] = useState(true);
  const height = expanded ? 200 : 40;

  return (
    <Paper
      elevation={8}
      sx={{
        height,
        transition: 'height 0.3s',
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 0.5,
          borderBottom: expanded ? 1 : 0,
          borderColor: 'divider'
        }}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Activity
        </Typography>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>
      
      {expanded && <ActivityFeed />}
    </Paper>
  );
}
```

---

## Responsive Breakpoints

```typescript
// theme.ts
breakpoints: {
  values: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  }
}

// Responsive drawer behavior
const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

<Drawer
  variant={isDesktop ? 'permanent' : 'temporary'}
  // ...
/>
```

---

**Read next**: [05-drag-drop-system.md](./05-drag-drop-system.md)
