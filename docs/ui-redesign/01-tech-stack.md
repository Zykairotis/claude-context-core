# Tech Stack & Dependencies

**Shard**: 01  
**Dependencies**: None  
**Blocks**: All implementation shards

---

## Core Stack

### Runtime & Build
```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "vite": "^5.0.0",
  "typescript": "^5.3.0"
}
```

**Why Vite**: Fast HMR, built-in TypeScript support, optimized production builds

---

## UI Framework: Material UI

### Core MUI Packages
```bash
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
```

**Packages**:
- `@mui/material` - Core components (Button, Card, AppBar, Drawer, etc.)
- `@mui/icons-material` - Material Design icons
- `@emotion/react` - CSS-in-JS engine (required by MUI)
- `@emotion/styled` - Styled components API

### MUI X (Data Grid & Charts)
```bash
npm install @mui/x-data-grid @mui/x-charts
```

**Usage**:
- `@mui/x-data-grid` - DataGrid for job tables, logs, artifacts
- `@mui/x-charts` - (Optional) Alternative to Recharts for metrics

**License**: MIT for community version (sufficient for this project)

---

## Canvas & Graph Visualization

### React Flow
```bash
npm install reactflow
```

**Version**: `^11.10.0` (latest stable)

**Features**:
- Drag-and-drop node placement
- Edge connections with types
- Zoom, pan, fit-to-view
- MiniMap, Controls, Background
- Custom node components
- Layout algorithms (dagre integration)

**Why React Flow**: Production-ready, accessible, extensible, great TypeScript support

---

## State Management

### Zustand (Realtime State)
```bash
npm install zustand
```

**Usage**: WebSocket-driven realtime state (nodes, edges, events, charts)

**Why Zustand**: 
- Minimal boilerplate
- No providers needed
- DevTools integration
- Perfect for pub/sub patterns

### React Query (HTTP State)
```bash
npm install @tanstack/react-query
```

**Usage**: HTTP requests (fetch mesh, trigger jobs, get logs)

**Why React Query**:
- Caching & invalidation
- Loading/error states
- Optimistic updates
- Retry logic

---

## Charts & Visualizations

### Recharts
```bash
npm install recharts
```

**Usage**: Line charts, area charts, bar charts for metrics

**Why Recharts**:
- React-first API
- Responsive
- Composable
- Works well with MUI theme

**Alternative**: `@mui/x-charts` (if you want full MUI integration)

---

## Utilities

### Essential Utils
```bash
npm install nanoid date-fns
```

**Packages**:
- `nanoid` - Generate unique IDs for nodes/edges
- `date-fns` - Date formatting for timestamps

### Optional Utils
```bash
npm install clsx immer
```

**Packages**:
- `clsx` - Conditional className helper
- `immer` - Immutable state updates (if needed)

---

## Development Dependencies

### TypeScript Types
```bash
npm install -D @types/react @types/react-dom @types/node
```

### Linting & Formatting
```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
                  prettier eslint-config-prettier
```

### Vite Plugins
```bash
npm install -D @vitejs/plugin-react
```

---

## Complete Installation Command

```bash
# Core dependencies
npm install react@^18.3.0 react-dom@^18.3.0 \
            @mui/material@^5.15.0 @mui/icons-material@^5.15.0 \
            @emotion/react@^11.11.0 @emotion/styled@^11.11.0 \
            reactflow@^11.10.0 \
            zustand@^4.5.0 \
            @tanstack/react-query@^5.17.0 \
            recharts@^2.10.0 \
            nanoid@^5.0.0 \
            date-fns@^3.0.0

# Optional (DataGrid)
npm install @mui/x-data-grid@^6.18.0

# Dev dependencies
npm install -D vite@^5.0.0 \
               typescript@^5.3.0 \
               @vitejs/plugin-react@^4.2.0 \
               @types/react@^18.2.0 \
               @types/react-dom@^18.2.0 \
               @types/node@^20.0.0 \
               eslint@^8.56.0 \
               @typescript-eslint/parser@^6.19.0 \
               @typescript-eslint/eslint-plugin@^6.19.0 \
               prettier@^3.2.0
```

---

## Vite Configuration

**File**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@store': path.resolve(__dirname, './src/store'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@types': path.resolve(__dirname, './src/types')
    }
  },
  server: {
    port: 3030,
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3030',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist/ui',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'flow-vendor': ['reactflow'],
          'chart-vendor': ['recharts']
        }
      }
    }
  }
});
```

---

## TypeScript Configuration

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@store/*": ["./src/store/*"],
      "@lib/*": ["./src/lib/*"],
      "@types/*": ["./src/types/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx",
    "lint:fix": "eslint src --ext ts,tsx --fix",
    "format": "prettier --write 'src/**/*.{ts,tsx,json,css,md}'"
  }
}
```

---

## Browser Support

### Target Browsers
- Chrome/Edge >= 90
- Firefox >= 88
- Safari >= 14

### Polyfills Needed
None - All dependencies work with ES2020+ browsers

### Progressive Enhancement
- `backdrop-filter` with fallback for older browsers
- CSS Grid with flexbox fallback (MUI handles this)

---

## Bundle Size Targets

### Development
- No size limits (HMR + source maps)

### Production
- Initial bundle: < 300 KB gzipped
- React Flow chunk: ~150 KB
- MUI chunk: ~100 KB
- Charts chunk: ~80 KB (lazy loaded)

### Optimization Strategies
1. Code splitting by route/feature
2. Lazy load DataGrid only when needed
3. Tree-shake unused MUI components
4. Dynamic imports for heavy features

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start dev server with HMR
npm run dev

# Open http://localhost:3030
```

### Type Checking
```bash
# Check types without building
npm run typecheck

# Watch mode
tsc --noEmit --watch
```

### Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Integration with Existing Backend

### Current Setup
- API server runs on port 3030
- WebSocket endpoint: `ws://localhost:3030/ws`
- REST endpoints: `http://localhost:3030/api/*`

### Vite Proxy Configuration
Already configured in `vite.config.ts` to proxy:
- `/api/*` → API server
- `/ws` → WebSocket server

### No Backend Changes Required
The new UI will use the same WebSocket protocol and REST endpoints. Only new endpoints need to be added (see [08-api-contract.md](./08-api-contract.md)).

---

## Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Material UI | Production-ready, accessible, comprehensive component library | Chakra UI, Ant Design |
| React Flow | Best-in-class graph visualization for React | D3.js + custom, Cytoscape.js |
| Zustand | Minimal boilerplate, perfect for pub/sub | Redux Toolkit, Jotai |
| Recharts | React-first, composable, MUI-compatible | Chart.js, Victory, MUI X Charts |
| Vite | Fast HMR, modern build tool | Create React App, Webpack |

---

**Read next**: [02-data-models.md](./02-data-models.md)
