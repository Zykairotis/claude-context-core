# Node Type Components

**Shard**: 07  
**Dependencies**: 02-data-models, 06-material-theme  
**Blocks**: Canvas implementation

---

## Node Kinds Overview

| Kind | Purpose | Inputs | Outputs |
|------|---------|--------|----------|
| `github` | GitHub repository source | None | Code chunks |
| `crawler` | Web crawler (Crawl4AI) | URLs | Web pages |
| `file` | File upload | User files | Documents |
| `dataset` | Dataset storage | Chunks | Indexed data |
| `vector` | Vector database (Qdrant) | Embeddings | Vector search |
| `reranker` | Reranking service | Results | Ranked results |
| `llm` | LLM processing | Text | Generated text |
| `dashboard` | Output/visualization | Data | UI display |

---

## Base KnowledgeNode Component

**File**: `src/components/Canvas/nodes/KnowledgeNode.tsx`

```typescript
import { memo, useState } from 'react';
import {
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  alpha,
  Box
} from '@mui/material';
import { Handle, Position, NodeProps } from 'reactflow';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import type { MeshNode } from '../../../types';
import { getNodeIcon } from './nodeIcons';

interface KnowledgeNodeData {
  kind: MeshNode['kind'];
  label: string;
  status: MeshNode['status'];
  meta?: MeshNode['meta'];
}

export const KnowledgeNode = memo(({ data, selected }: NodeProps<KnowledgeNodeData>) => {
  const [isHovered, setIsHovered] = useState(false);

  const statusColors = {
    idle: { bg: alpha('#64748b', 0.1), border: '#64748b', chip: 'default' },
    queued: { bg: alpha('#f59e0b', 0.1), border: '#f59e0b', chip: 'warning' },
    running: { bg: alpha('#3b82f6', 0.1), border: '#3b82f6', chip: 'info' },
    ok: { bg: alpha('#22c55e', 0.1), border: '#22c55e', chip: 'success' },
    degraded: { bg: alpha('#f59e0b', 0.1), border: '#f59e0b', chip: 'warning' },
    failed: { bg: alpha('#ef4444', 0.1), border: '#ef4444', chip: 'error' }
  };

  const colors = statusColors[data.status] || statusColors.idle;
  const Icon = getNodeIcon(data.kind);

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[Node] Run:', data);
    // Trigger API call
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[Node] Stop:', data);
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[Node] Settings:', data);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[Node] Delete:', data);
  };

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{ minWidth: 240 }}
    >
      <Card
        variant="outlined"
        sx={{
          backgroundColor: colors.bg,
          borderColor: selected ? colors.border : alpha(colors.border, 0.3),
          borderWidth: selected ? 2 : 1,
          transition: 'all 0.2s',
          boxShadow: selected
            ? `0 0 0 3px ${alpha(colors.border, 0.2)}`
            : data.status === 'running'
            ? `0 0 20px ${alpha(colors.border, 0.4)}`
            : 'none',
          '&:hover': {
            borderColor: colors.border,
            transform: 'translateY(-2px)'
          }
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack spacing={1.5}>
            {/* Header */}
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  color: colors.border,
                  display: 'flex',
                  alignItems: 'center',
                  '& > svg': { fontSize: 24 }
                }}
              >
                <Icon />
              </Box>
              
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {data.label}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {data.kind}
                </Typography>
              </Stack>
              
              <Chip
                size="small"
                label={data.status}
                color={colors.chip as any}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Stack>

            {/* Metadata */}
            {data.meta && (
              <Stack spacing={0.5}>
                {data.meta.repo && (
                  <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                    📦 {data.meta.repo}
                  </Typography>
                )}
                {data.meta.url && (
                  <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                    🌐 {new URL(data.meta.url).hostname}
                  </Typography>
                )}
                {data.meta.dataset && (
                  <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                    💾 {data.meta.dataset}
                  </Typography>
                )}
              </Stack>
            )}

            {/* Actions */}
            {(isHovered || selected) && (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Run">
                  <IconButton size="small" onClick={handleRun} disabled={data.status === 'running'}>
                    <PlayArrowRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Stop">
                  <IconButton size="small" onClick={handleStop} disabled={data.status !== 'running'}>
                    <StopRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Settings">
                  <IconButton size="small" onClick={handleSettings}>
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={handleDelete} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          width: 12,
          height: 12,
          backgroundColor: colors.border,
          border: `2px solid ${alpha('#fff', 0.2)}`
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          width: 12,
          height: 12,
          backgroundColor: colors.border,
          border: `2px solid ${alpha('#fff', 0.2)}`
        }}
      />
    </Box>
  );
});

KnowledgeNode.displayName = 'KnowledgeNode';
```

---

## Node Icons Mapping

**File**: `src/components/Canvas/nodes/nodeIcons.tsx`

```typescript
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageIcon from '@mui/icons-material/Language';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import StorageIcon from '@mui/icons-material/Storage';
import DataObjectIcon from '@mui/icons-material/DataObject';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PsychologyIcon from '@mui/icons-material/Psychology';
import DashboardIcon from '@mui/icons-material/Dashboard';
import type { NodeKind } from '../../../types';

export function getNodeIcon(kind: NodeKind) {
  const icons = {
    github: GitHubIcon,
    crawler: LanguageIcon,
    file: UploadFileIcon,
    dataset: StorageIcon,
    vector: DataObjectIcon,
    reranker: AutoFixHighIcon,
    llm: PsychologyIcon,
    dashboard: DashboardIcon
  };
  return icons[kind] || StorageIcon;
}
```

---

## Custom Edge Component

**File**: `src/components/Canvas/edges/DataEdge.tsx`

```typescript
import { EdgeProps, getBezierPath } from 'reactflow';
import { alpha } from '@mui/material';

export function DataEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const edgeColors = {
    data: '#7dd3fc',
    trigger: '#a78bfa',
    control: '#f472b6'
  };

  const color = edgeColors[data?.kind as keyof typeof edgeColors] || '#7dd3fc';

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={selected ? 3 : 2}
        stroke={color}
        strokeOpacity={selected ? 1 : 0.6}
        fill="none"
        style={{ filter: `drop-shadow(0 0 4px ${alpha(color, 0.4)})` }}
      />
      {data?.stats?.ratePerMin && (
        <text>
          <textPath
            href={`#${id}`}
            style={{ fontSize: 10, fill: color }}
            startOffset="50%"
            textAnchor="middle"
          >
            {data.stats.ratePerMin}/min
          </textPath>
        </text>
      )}
    </>
  );
}
```

---

**Read next**: [08-api-contract.md](./08-api-contract.md)
