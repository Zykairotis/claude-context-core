# Drag & Drop System

**Shard**: 05  
**Dependencies**: 02-data-models, 04-layout-components  
**Blocks**: 07-node-types, Canvas implementation

---

## Architecture Overview

```
Palette (Left Drawer)          Canvas (React Flow)
┌──────────────────┐          ┌─────────────────────┐
│ [GitHub Repo]    │          │                     │
│ [Web Crawler]    │  Drag    │    Drop Zone        │
│ [Vector DB]      │  ────>   │                     │
│ [LLM]            │          │  • Project coords   │
│ [Dashboard]      │          │  • Create node      │
└──────────────────┘          │  • POST to API      │
                              └─────────────────────┘
```

---

## Palette Component

**File**: `src/components/LeftDrawer/Palette.tsx`

```typescript
import { Stack, Typography, Divider } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageIcon from '@mui/icons-material/Language';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PsychologyIcon from '@mui/icons-material/Psychology';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { PaletteItem } from './PaletteItem';
import type { NodeKind } from '../../types';

const PALETTE_ITEMS: Array<{ kind: NodeKind; label: string; icon: React.ReactNode; category: string }> = [
  { kind: 'github', label: 'GitHub Repo', icon: <GitHubIcon />, category: 'Sources' },
  { kind: 'crawler', label: 'Web Crawler', icon: <LanguageIcon />, category: 'Sources' },
  { kind: 'file', label: 'File Upload', icon: <UploadFileIcon />, category: 'Sources' },
  
  { kind: 'dataset', label: 'Dataset', icon: <StorageIcon />, category: 'Storage' },
  { kind: 'vector', label: 'Vector DB', icon: <StorageIcon />, category: 'Storage' },
  
  { kind: 'reranker', label: 'Reranker', icon: <AutoFixHighIcon />, category: 'Processing' },
  { kind: 'llm', label: 'LLM', icon: <PsychologyIcon />, category: 'Processing' },
  
  { kind: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, category: 'Outputs' }
];

export function Palette() {
  const categories = Array.from(new Set(PALETTE_ITEMS.map(item => item.category)));
  
  return (
    <Stack spacing={2}>
      <Typography variant="overline" sx={{ px: 1, opacity: 0.7 }}>
        Knowledge Sources
      </Typography>
      
      {categories.map((category) => (
        <Stack key={category} spacing={1}>
          <Typography variant="caption" sx={{ px: 1, fontWeight: 600, opacity: 0.8 }}>
            {category}
          </Typography>
          
          {PALETTE_ITEMS
            .filter(item => item.category === category)
            .map((item) => (
              <PaletteItem
                key={item.kind}
                kind={item.kind}
                label={item.label}
                icon={item.icon}
              />
            ))}
          
          {category !== categories[categories.length - 1] && <Divider />}
        </Stack>
      ))}
    </Stack>
  );
}
```

---

## Palette Item (Draggable)

**File**: `src/components/LeftDrawer/PaletteItem.tsx`

```typescript
import { Card, CardContent, Stack, Typography, alpha } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import type { NodeKind } from '../../types';

interface PaletteItemProps {
  kind: NodeKind;
  label: string;
  icon: React.ReactNode;
}

export function PaletteItem({ kind, label, icon }: PaletteItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ kind, label })
    );
    e.dataTransfer.effectAllowed = 'move';
    
    // Optional: Add ghost image
    const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
    ghost.style.opacity = '0.5';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      sx={{
        cursor: 'grab',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateX(4px)',
          bgcolor: alpha('#7dd3fc', 0.1),
          borderColor: 'primary.main'
        },
        '&:active': {
          cursor: 'grabbing',
          transform: 'scale(0.98)'
        }
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Stack
            sx={{
              color: 'primary.main',
              opacity: 0.8,
              '& > svg': { fontSize: 20 }
            }}
          >
            {icon}
          </Stack>
          
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
            {label}
          </Typography>
          
          <DragIndicatorIcon sx={{ fontSize: 16, opacity: 0.4 }} />
        </Stack>
      </CardContent>
    </Card>
  );
}
```

---

## React Flow Canvas with Drop Zone

**File**: `src/components/Canvas/ReactFlowCanvas.tsx`

```typescript
import { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Connection,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nanoid } from 'nanoid';
import { Box, Snackbar, Alert } from '@mui/material';
import { KnowledgeNode } from './nodes/KnowledgeNode';
import { useRealtime } from '../../store/realtime';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { MeshNode, MeshEdge } from '../../types';

const nodeTypes = { knowledge: KnowledgeNode };

export function ReactFlowCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();
  
  // Sync with realtime store
  const meshNodes = useRealtime((s) => s.nodes);
  const meshEdges = useRealtime((s) => s.edges);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState<string | null>(null);

  // Sync realtime store → React Flow
  useEffect(() => {
    const flowNodes: Node[] = Object.values(meshNodes).map((node) => ({
      id: node.id,
      type: 'knowledge',
      position: node.position,
      data: {
        kind: node.kind,
        label: node.label,
        status: node.status,
        meta: node.meta
      }
    }));
    setNodes(flowNodes);
  }, [meshNodes, setNodes]);

  useEffect(() => {
    const flowEdges: Edge[] = Object.values(meshEdges).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: edge.status === 'running',
      data: { kind: edge.kind, stats: edge.stats }
    }));
    setEdges(flowEdges);
  }, [meshEdges, setEdges]);

  // Create node mutation
  const createNodeMutation = useMutation({
    mutationFn: (payload: { kind: string; label: string; position: { x: number; y: number } }) =>
      api.createNode('default', payload),
    onSuccess: (node) => {
      console.log('[Canvas] Node created:', node);
    },
    onError: (err) => {
      setError('Failed to create node');
      console.error(err);
    }
  });

  // Handle drop from palette
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      
      if (!containerRef.current) return;
      
      const payload = e.dataTransfer.getData('application/reactflow');
      if (!payload) return;
      
      try {
        const { kind, label } = JSON.parse(payload);
        const bounds = containerRef.current.getBoundingClientRect();
        
        // Convert screen coords → canvas coords
        const position = rf.project({
          x: e.clientX - bounds.left,
          y: e.clientY - bounds.top
        });

        // Optimistic update
        const id = nanoid();
        const newNode: Node = {
          id,
          type: 'knowledge',
          position,
          data: { kind, label, status: 'idle', meta: {} }
        };
        
        setNodes((nds) => [...nds, newNode]);
        
        // Persist to backend
        createNodeMutation.mutate({ kind, label, position });
        
      } catch (err) {
        setError('Invalid drop data');
      }
    },
    [rf, setNodes, createNodeMutation]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle edge creation
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: nanoid(),
        type: 'smoothstep',
        animated: true,
        data: { kind: 'data' }
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      
      // Persist to backend
      if (connection.source && connection.target) {
        api.createEdge('default', {
          source: connection.source,
          target: connection.target,
          kind: 'data'
        }).catch((err) => {
          setError('Failed to create edge');
          console.error(err);
        });
      }
    },
    [setEdges]
  );

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: 'background.default',
        '& .react-flow__node': {
          cursor: 'pointer'
        },
        '& .react-flow__edge': {
          cursor: 'pointer'
        }
      }}
    >
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={2}
      >
        <Background variant="dots" gap={16} size={1} />
        <MiniMap
          nodeColor={(node) => {
            const status = node.data?.status;
            return {
              idle: '#64748b',
              running: '#3b82f6',
              ok: '#22c55e',
              failed: '#ef4444'
            }[status] || '#64748b';
          }}
        />
        <Controls />
      </ReactFlow>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
```

---

## Keyboard Accessibility

**Enhanced Palette Item with Keyboard Support**

```typescript
export function PaletteItem({ kind, label, icon }: PaletteItemProps) {
  const [isPickedUp, setIsPickedUp] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsPickedUp(true);
      // Show instruction overlay: "Click canvas to place node"
    }
    
    if (e.key === 'Escape' && isPickedUp) {
      setIsPickedUp(false);
    }
  };

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Add ${label} to canvas`}
      sx={{ /* ... */ }}
    >
      {/* ... */}
    </Card>
  );
}
```

---

## Testing Drag & Drop

**File**: `src/components/Canvas/__tests__/drag-drop.spec.tsx`

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { ReactFlowCanvas } from '../ReactFlowCanvas';

describe('Drag & Drop', () => {
  it('creates node on drop', async () => {
    const { container } = render(
      <ReactFlowProvider>
        <ReactFlowCanvas />
      </ReactFlowProvider>
    );

    const canvas = container.querySelector('.react-flow');
    
    const dropEvent = new DragEvent('drop', {
      clientX: 100,
      clientY: 100,
      dataTransfer: new DataTransfer()
    });
    
    dropEvent.dataTransfer?.setData(
      'application/reactflow',
      JSON.stringify({ kind: 'github', label: 'GitHub Repo' })
    );

    fireEvent(canvas!, dropEvent);

    await waitFor(() => {
      expect(container.querySelector('.react-flow__node')).toBeInTheDocument();
    });
  });
});
```

---

**Read next**: [06-material-theme.md](./06-material-theme.md)
