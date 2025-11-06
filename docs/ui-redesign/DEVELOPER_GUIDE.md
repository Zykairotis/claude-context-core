# Claude Context UI - Developer Guide

## Project Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── nodes/
│   │   │   │   └── KnowledgeNode.tsx    # Custom node component
│   │   │   ├── edges/
│   │   │   │   └── DataEdge.tsx         # Custom edge component
│   │   │   ├── MeshCanvas.tsx           # Main React Flow canvas
│   │   │   ├── ContextMenu.tsx          # Right-click menu
│   │   │   └── Inspector.tsx            # Node details panel
│   │   ├── layout/
│   │   │   └── MainCanvas.tsx           # Layout container
│   │   └── sidebar/
│   │       └── Sidebar.tsx              # Left sidebar
│   ├── lib/
│   │   ├── api.ts                       # React Query hooks
│   │   ├── theme.ts                     # Material-UI theme
│   │   ├── toast.tsx                    # Toast notifications
│   │   ├── websocket.ts                 # WebSocket manager
│   │   └── utils.ts                     # Utility functions
│   ├── store/
│   │   └── index.ts                     # Zustand store
│   ├── types/
│   │   └── index.ts                     # TypeScript types
│   └── App.tsx                          # Root component
├── index.html
├── main.tsx                             # Entry point
├── package.json
└── tsconfig.json
```

---

## Technology Stack

### Core
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server

### UI Components
- **Material-UI (MUI)**: Component library
- **React Flow**: Node-based canvas
- **Lucide React**: Icon library

### State Management
- **Zustand**: Global state (real-time data)
- **React Query**: Server state (API caching)

### Real-Time
- **WebSocket**: Live updates from backend
- **Custom WebSocket Manager**: Reconnection logic

### Styling
- **MUI System**: sx prop for inline styles
- **Theme System**: Centralized theme configuration
- **CSS-in-JS**: Component-scoped styles

---

## Key Concepts

### 1. Optimistic UI Updates

All mutations update the UI immediately before the API call completes:

```typescript
// Example: Creating a node
const createNodeMutation = useMutation({
  mutationFn: (node) => apiClient.createNode(node),
  
  onMutate: async (newNode) => {
    // 1. Create temporary node in store
    const tempId = `temp-${Date.now()}`;
    addNode({ ...newNode, id: tempId });
    return { tempId };
  },
  
  onSuccess: (response, _, context) => {
    // 2. Replace temp with real node
    deleteNode(context.tempId);
    addNode(response.node);
  },
  
  onError: (error, _, context) => {
    // 3. Rollback on error
    deleteNode(context.tempId);
    toast.error('Failed to create node');
  },
});
```

### 2. Debounced Position Updates

Node dragging is debounced to reduce API calls:

```typescript
const positionUpdateTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

const onNodesChange = useCallback((changes) => {
  changes.forEach((change) => {
    if (change.type === 'position') {
      // Clear existing timeout
      const existing = positionUpdateTimeouts.current.get(change.id);
      if (existing) clearTimeout(existing);
      
      // Debounce API call by 300ms
      const timeout = setTimeout(() => {
        updateNodeMutation.mutate({
          nodeId: change.id,
          updates: { position: change.position }
        });
      }, 300);
      
      positionUpdateTimeouts.current.set(change.id, timeout);
    }
  });
}, [updateNodeMutation]);
```

### 3. WebSocket Integration

Real-time updates flow through WebSocket → Store → UI:

```typescript
// websocket.ts
export class WebSocketManager {
  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }
  
  private handleMessage(message: WSMessage) {
    const store = useRealtimeStore.getState();
    
    switch (message.type) {
      case 'node:status':
        store.updateNodeStatus(message.nodeId, message.status);
        break;
      case 'node:log':
        store.addLog(message.nodeId, message.log);
        break;
      // ... other message types
    }
  }
}
```

### 4. Type Safety

Strict TypeScript types throughout:

```typescript
// types/index.ts
export type NodeType = 
  | 'github' 
  | 'crawler' 
  | 'vectordb' 
  | 'reranker' 
  | 'llm' 
  | 'dashboard';

export type NodeStatus = 
  | 'idle' 
  | 'queued' 
  | 'running' 
  | 'ok' 
  | 'failed' 
  | 'warning';

export interface NodeMetadata {
  id: string;
  type: NodeType;
  label: string;
  status: NodeStatus;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

---

## Development Workflow

### Setup

```bash
# Install dependencies
npm install

# Start dev server (port 40001)
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

### Environment Variables

```bash
# .env.local
VITE_API_URL=http://localhost:3030
VITE_WS_URL=ws://localhost:3030
```

### Running with API Server

**Option 1: Docker Compose** (Recommended)
```bash
docker-compose up api-server
```

**Option 2: Local Development**
```bash
# Terminal 1: API Server
cd services/api-server
npm run dev

# Terminal 2: UI
npm run dev
```

---

## Component Architecture

### Node Component (KnowledgeNode)

Custom React Flow node with:
- Type-based icon and color
- Status indicator
- Expandable action buttons
- Hover animations
- Loading states

```typescript
export const KnowledgeNode = memo(({ data, selected }: NodeProps<NodeMetadata>) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // API hooks
  const runNode = useRunNode();
  const stopNode = useStopNode();
  const deleteNode = useDeleteNode(data.project);
  
  // Render with animations
  return (
    <Box onMouseEnter={() => setIsHovered(true)}>
      <Card>
        {/* Header with icon, label, status */}
        {/* Metadata display */}
        {/* Expandable action buttons */}
      </Card>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </Box>
  );
});
```

### Canvas Component (MeshCanvas)

Main React Flow wrapper with:
- Node/edge CRUD operations
- Context menus
- Keyboard shortcuts
- Empty state
- Debounced updates

```typescript
export function MeshCanvas() {
  // Store hooks
  const nodes = useRealtimeStore((state) => state.nodes);
  const edges = useRealtimeStore((state) => state.edges);
  
  // API hooks
  const createNode = useCreateNode('default');
  const createEdge = useCreateEdge('default');
  const updateNode = useUpdateNode();
  
  // Convert to React Flow format
  const flowNodes = nodes.map(node => ({
    id: node.id,
    type: 'knowledge',
    position: node.position,
    data: node,
  }));
  
  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onConnect={onConnect}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

---

## API Integration

### React Query Setup

```typescript
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      cacheTime: 300000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainCanvas />
      <ToastContainer />
    </QueryClientProvider>
  );
}
```

### API Hooks Pattern

```typescript
// lib/api.ts
export function useCreateNode(project: string) {
  const queryClient = useQueryClient();
  const addNode = useRealtimeStore((state) => state.addNode);
  const deleteNode = useRealtimeStore((state) => state.deleteNode);
  
  return useMutation({
    mutationFn: (node: Omit<NodeMetadata, 'id'>) =>
      apiClient.createNode(project, node),
    
    onMutate: async (newNode) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['mesh', project] });
      
      // Optimistic update
      const optimisticNode = {
        ...newNode,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addNode(optimisticNode);
      
      return { optimisticNode };
    },
    
    onSuccess: (response, _, context) => {
      // Replace temp with real
      if (context?.optimisticNode) {
        deleteNode(context.optimisticNode.id);
      }
      addNode(response.node);
      
      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['mesh', project] });
    },
    
    onError: (error, _, context) => {
      // Rollback
      if (context?.optimisticNode) {
        deleteNode(context.optimisticNode.id);
      }
      toast.error(`Failed to create node: ${error.message}`);
    },
  });
}
```

---

## State Management

### Zustand Store

```typescript
// store/index.ts
interface RealtimeState {
  // Data
  nodes: NodeMetadata[];
  edges: EdgeMetadata[];
  selectedNodeId: string | null;
  
  // Actions
  addNode: (node: NodeMetadata) => void;
  updateNode: (id: string, updates: Partial<NodeMetadata>) => void;
  deleteNode: (id: string) => void;
  updateNodeStatus: (id: string, status: NodeStatus, message?: string) => void;
  
  // Edge actions
  addEdge: (edge: EdgeMetadata) => void;
  deleteEdge: (id: string) => void;
  
  // Selection
  setSelectedNodeId: (id: string | null) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  
  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),
  
  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, ...updates } : n
      ),
    })),
  
  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    })),
  
  // ... other actions
}));
```

### When to Use Each Store

**Zustand (Real-time Store)**:
- Real-time data from WebSocket
- UI state (selection, hover)
- Optimistic updates
- Fast, synchronous access

**React Query (Server State)**:
- Initial data fetch
- Cache management
- Mutations with retry
- Background refetch

---

## Theming & Styling

### Theme Configuration

```typescript
// lib/theme.ts
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#cd853f' },      // Amber/gold
    background: {
      default: '#0a0a0a',              // Near-black
      paper: 'rgba(0, 0, 0, 0.9)',     // Black glass
    },
  },
  
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
  },
});
```

### Style Patterns

**Glass Effect**:
```typescript
sx={{
  backgroundColor: alpha('#000', 0.9),
  backdropFilter: 'blur(20px) saturate(180%)',
  border: `1px solid ${alpha('#fff', 0.1)}`,
}}
```

**Glow Effect**:
```typescript
sx={{
  boxShadow: `0 0 20px ${alpha(color, 0.4)}`,
  filter: `drop-shadow(0 0 8px ${alpha(color, 0.6)})`,
}}
```

**Smooth Transitions**:
```typescript
sx={{
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  transform: isHovered ? 'translateY(0)' : 'translateY(-10px)',
}}
```

---

## Testing Strategy

### Unit Tests (Future)
```typescript
// components/__tests__/KnowledgeNode.test.tsx
describe('KnowledgeNode', () => {
  it('renders node with correct status color', () => {
    render(<KnowledgeNode data={{ status: 'running', ... }} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeEnabled();
  });
  
  it('shows loading spinner when running', () => {
    const { rerender } = render(<KnowledgeNode data={{ status: 'idle', ... }} />);
    fireEvent.click(screen.getByRole('button', { name: /run/i }));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

### Integration Tests (Future)
```typescript
// integration/canvas.test.tsx
describe('MeshCanvas', () => {
  it('creates node via context menu', async () => {
    render(<MeshCanvas />);
    
    // Right-click canvas
    fireEvent.contextMenu(screen.getByRole('application'));
    
    // Select "Add GitHub Repo"
    fireEvent.click(screen.getByText(/github repo/i));
    
    // Node appears
    await waitFor(() => {
      expect(screen.getByText('GitHub Repo')).toBeInTheDocument();
    });
  });
});
```

### E2E Tests (Future)
```typescript
// e2e/workflow.spec.ts (Playwright)
test('create pipeline end-to-end', async ({ page }) => {
  await page.goto('http://localhost:40001');
  
  // Add GitHub node
  await page.click('body', { button: 'right' });
  await page.click('text=GitHub Repo');
  
  // Add Vector DB node
  await page.click('body', { button: 'right', position: { x: 400, y: 300 } });
  await page.click('text=Vector DB');
  
  // Connect nodes
  // ... drag between handles
  
  // Verify edge created
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});
```

---

## Performance Optimization

### React Flow Best Practices

```typescript
// 1. Memoize node components
export const KnowledgeNode = memo(({ data, selected }) => {
  // ...
}, (prev, next) => {
  // Custom comparison for better performance
  return prev.data.id === next.data.id &&
         prev.data.status === next.data.status &&
         prev.selected === next.selected;
});

// 2. Use node/edge types registry
const nodeTypes = useMemo(() => ({
  knowledge: KnowledgeNode,
}), []);

// 3. Debounce expensive operations
const debouncedUpdate = useMemo(
  () => debounce((nodeId, position) => {
    updateNodeMutation.mutate({ nodeId, updates: { position } });
  }, 300),
  [updateNodeMutation]
);
```

### Bundle Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'reactflow-vendor': ['reactflow'],
        },
      },
    },
  },
});
```

---

## Debugging

### Dev Tools

```typescript
// Enable React Query DevTools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainCanvas />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Logging

```typescript
// Structured logging
console.log('[API] Creating node:', {
  type: node.type,
  label: node.label,
  timestamp: new Date().toISOString(),
});

// WebSocket debug
if (import.meta.env.DEV) {
  ws.addEventListener('message', (event) => {
    console.log('[WS] Message:', JSON.parse(event.data));
  });
}
```

### Error Boundaries

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('[React Error]:', error, errorInfo);
    sendToAnalytics('react_error', { error, errorInfo });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

---

## Deployment

### Build for Production

```bash
# Build UI
npm run build

# Output: dist/
# - index.html
# - assets/*.js (code-split chunks)
# - assets/*.css
```

### Docker Integration

The UI is served by the API server container:

```dockerfile
# services/api-server/Dockerfile
FROM node:18-alpine
WORKDIR /app

# Build UI
COPY ui/ ./ui/
RUN cd ui && npm install && npm run build

# Copy UI build to public
RUN mkdir -p public && cp -r ui/dist/* public/

# Serve via Express
EXPOSE 3030
CMD ["npm", "start"]
```

### Environment Configuration

```typescript
// Handle different environments
const API_URL = 
  import.meta.env.VITE_API_URL || 
  window.ENV?.VITE_API_URL || 
  'http://localhost:3030';
```

---

## Contributing

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Use MUI `sx` prop for styling
- Memoize expensive components
- Add JSDoc for complex functions

### Git Workflow

```bash
# Feature branch
git checkout -b feature/node-settings-panel

# Commit with conventional commits
git commit -m "feat(ui): add node settings panel"

# Push and create PR
git push origin feature/node-settings-panel
```

### PR Checklist

- [ ] TypeScript types updated
- [ ] Error handling added
- [ ] Loading states implemented
- [ ] Toast notifications added
- [ ] Console errors resolved
- [ ] Tested in dev environment
- [ ] Documentation updated

---

## Resources

### Documentation
- [React Flow Docs](https://reactflow.dev/)
- [Material-UI Docs](https://mui.com/)
- [React Query Docs](https://tanstack.com/query)
- [Zustand Docs](https://zustand-demo.pmnd.rs/)

### Internal Docs
- [Architecture Overview](./00-overview.md)
- [Data Models](./02-data-models.md)
- [User Flows](./09-user-flows.md)
- [Migration Plan](./10-migration-plan.md)

### API Reference
- `/docs/api.md` - Backend API endpoints
- `/docs/websocket.md` - WebSocket protocol
- `/src/types/index.ts` - TypeScript types
