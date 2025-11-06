/**
 * KnowledgeNode - Custom node component with status-based styling
 */

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
  Box,
  CircularProgress,
} from '@mui/material';
import { Handle, Position, NodeProps } from 'reactflow';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import type { NodeMetadata } from '@types';
import { getNodeIcon, getNodeColor } from './nodeIcons';
import { useRunNode, useStopNode, useDeleteNode } from '@lib/api';
import { toast } from '@lib/toast';
import { useRealtimeStore } from '@store';

export const KnowledgeNode = memo(({ data, selected }: NodeProps<NodeMetadata>) => {
  const openSettings = useRealtimeStore((state: any) => state.openSettings);
  const [isHovered, setIsHovered] = useState(false);

  // API hooks
  const runNode = useRunNode();
  const stopNode = useStopNode();
  const deleteNode = useDeleteNode('default'); // TODO: Get project from context

  // Status-based color scheme
  const statusColors = {
    idle: { bg: alpha('#64748b', 0.1), border: '#64748b', chip: 'default' as const },
    queued: { bg: alpha('#f59e0b', 0.1), border: '#f59e0b', chip: 'warning' as const },
    running: { bg: alpha('#3b82f6', 0.1), border: '#3b82f6', chip: 'info' as const },
    ok: { bg: alpha('#22c55e', 0.1), border: '#22c55e', chip: 'success' as const },
    failed: { bg: alpha('#ef4444', 0.1), border: '#ef4444', chip: 'error' as const },
    warning: { bg: alpha('#f59e0b', 0.1), border: '#f59e0b', chip: 'warning' as const },
  };

  const colors = statusColors[data.status] || statusColors.idle;
  const Icon = getNodeIcon(data.type);
  const nodeColor = getNodeColor(data.type);

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    runNode.mutate(data.id);
    toast.success(`Starting ${data.label}...`);
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopNode.mutate(data.id);
    toast.info(`Stopping ${data.label}...`);
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[Node] Opening settings for:', data);
    if (openSettings) {
      openSettings(data);
    } else {
      toast.info('Settings panel is loading...');
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete ${data.label}?`)) {
      deleteNode.mutate(data.id);
      toast.success(`Deleting ${data.label}...`);
    }
  };

  // Check loading states
  const isRunning = runNode.isPending;
  const isStopping = stopNode.isPending;
  const isDeleting = deleteNode.isPending;

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{ minWidth: 240 }}
    >
      <Card
        variant="outlined"
        sx={{
          backgroundColor: alpha('#000', 0.9),
          backdropFilter: 'blur(20px) saturate(180%)',
          borderColor: selected 
            ? (data.type === 'github' ? '#000000' : colors.border)
            : alpha(data.type === 'github' ? '#000000' : colors.border, 0.3),
          borderWidth: selected ? 2 : 1,
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: selected
            ? data.type === 'github'
              ? `0 0 0 3px ${alpha('#000', 0.2)}, 0 8px 32px ${alpha('#000', 0.3)}`
              : `0 0 0 3px ${alpha(colors.border, 0.2)}, 0 8px 32px ${alpha(colors.border, 0.3)}`
            : data.status === 'running'
            ? data.type === 'github'
              ? `0 0 20px ${alpha('#000', 0.4)}`
              : `0 0 20px ${alpha(colors.border, 0.4)}`
            : `0 4px 12px ${alpha('#000', 0.5)}`,
          '&:hover': {
            borderColor: data.type === 'github' ? '#000000' : colors.border,
            transform: 'translateY(-2px)',
            boxShadow: data.type === 'github'
              ? `0 0 0 3px ${alpha('#000', 0.15)}, 0 12px 40px ${alpha('#000', 0.25)}`
              : `0 0 0 3px ${alpha(colors.border, 0.15)}, 0 12px 40px ${alpha(colors.border, 0.25)}`,
          },
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack spacing={1.5}>
            {/* Header */}
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  color: data.type === 'github' ? '#000000' : nodeColor,
                  display: 'flex',
                  alignItems: 'center',
                  filter: data.type === 'github' 
                    ? 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.8))' 
                    : `drop-shadow(0 0 8px ${alpha(nodeColor, 0.6)})`,
                  '& > svg': { fontSize: 24 },
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
                    whiteSpace: 'nowrap',
                    color: '#ffffff',
                  }}
                >
                  {data.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.7,
                    color: data.type === 'github' ? '#000000' : nodeColor,
                    textTransform: 'uppercase',
                    fontSize: '0.65rem',
                    letterSpacing: '0.5px',
                  }}
                >
                  {data.type}
                </Typography>
              </Stack>

              <Chip
                size="small"
                label={data.status}
                color={colors.chip}
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  '& .MuiChip-label': {
                    px: 1,
                  },
                }}
              />
            </Stack>

            {/* Metadata */}
            {data.data && Object.keys(data.data).length > 0 && (
              <Stack spacing={0.5}>
                {Object.entries(data.data).slice(0, 2).map(([key, value]) => (
                  <Typography
                    key={key}
                    variant="caption"
                    sx={{
                      opacity: 0.8,
                      fontSize: '0.7rem',
                      color: alpha('#ffffff', 0.7),
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {key}: {String(value)}
                  </Typography>
                ))}
              </Stack>
            )}

            {/* Action Buttons - Always Visible */}
            <Box sx={{ pt: 0.5 }}>
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Run" placement="top">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleRun}
                      disabled={data.status === 'running' || isRunning || isDeleting}
                      sx={{
                        color: '#22c55e',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: alpha('#22c55e', 0.15),
                          transform: 'scale(1.1)',
                          boxShadow: `0 0 12px ${alpha('#22c55e', 0.4)}`,
                        },
                      }}
                    >
                      {isRunning ? (
                        <CircularProgress size={16} sx={{ color: '#22c55e' }} />
                      ) : (
                        <PlayArrowRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Stop" placement="top">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleStop}
                      disabled={data.status !== 'running' || isStopping || isDeleting}
                      sx={{
                        color: '#f59e0b',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: alpha('#f59e0b', 0.15),
                          transform: 'scale(1.1)',
                          boxShadow: `0 0 12px ${alpha('#f59e0b', 0.4)}`,
                        },
                      }}
                    >
                      {isStopping ? (
                        <CircularProgress size={16} sx={{ color: '#f59e0b' }} />
                      ) : (
                        <StopRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Settings" placement="top">
                  <IconButton
                    size="small"
                    onClick={handleSettings}
                    disabled={isDeleting}
                    sx={{
                      color: '#cd853f',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: alpha('#cd853f', 0.15),
                        transform: 'scale(1.1)',
                        boxShadow: `0 0 12px ${alpha('#cd853f', 0.4)}`,
                      },
                    }}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete" placement="top">
                  <IconButton
                    size="small"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    sx={{
                      color: '#ef4444',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: alpha('#ef4444', 0.15),
                        transform: 'scale(1.1)',
                        boxShadow: `0 0 12px ${alpha('#ef4444', 0.4)}`,
                      },
                    }}
                  >
                    {isDeleting ? (
                      <CircularProgress size={16} sx={{ color: '#ef4444' }} />
                    ) : (
                      <DeleteIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
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
          border: `2px solid ${alpha('#fff', 0.2)}`,
          transition: 'all 0.2s',
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
          border: `2px solid ${alpha('#fff', 0.2)}`,
          transition: 'all 0.2s',
        }}
      />
    </Box>
  );
});

KnowledgeNode.displayName = 'KnowledgeNode';
