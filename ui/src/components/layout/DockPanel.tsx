/**
 * DockPanel - Collapsible docked panels for tools and inspectors
 */

import { Box, Paper, IconButton, Typography, alpha } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Inspector } from './RightDrawer/Inspector';
import { ActivityFeed } from './BottomShelf/ActivityFeed';
import { StatsMini } from './LeftDrawer/StatsMini';
import { useRealtimeStore, selectSelectedNode } from '@store';

interface DockPanelProps {
  panel: 'activity' | 'inspector' | 'stats';
  onClose: () => void;
}

export function DockPanel({ panel, onClose }: DockPanelProps) {
  const selectedNode = useRealtimeStore(selectSelectedNode);

  const panelConfig = {
    activity: { title: 'Activity Feed', position: 'center' as const, width: 700, height: 500 },
    inspector: { title: 'Inspector', position: 'right' as const, width: 400, height: 'calc(100vh - 100px)' },
    stats: { title: 'Statistics', position: 'center' as const, width: 500, height: 350 },
  };

  const config = panelConfig[panel];
  const isCentered = config.position === 'center';

  return (
    <Paper
      elevation={24}
      sx={{
        width: config.width,
        height: config.height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'fixed',
        top: isCentered ? '50%' : 80,
        left: isCentered ? '50%' : undefined,
        right: !isCentered ? 20 : undefined,
        transform: isCentered ? 'translate(-50%, -50%)' : undefined,
        zIndex: 100,
        bgcolor: alpha('#000', 0.9),
        backdropFilter: 'blur(50px) saturate(200%)',
        border: '1px solid',
        borderColor: alpha('#cd853f', 0.3),
        borderRadius: 3,
        boxShadow: `0 24px 80px ${alpha('#cd853f', 0.2)}, 0 0 0 1px ${alpha('#cd853f', 0.2)} inset, 0 0 120px ${alpha('#cd853f', 0.1)}`,
        animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        '@keyframes slideIn': {
          from: {
            opacity: 0,
            transform: isCentered ? 'translate(-50%, -45%) scale(0.95)' : 'translateX(50px)',
          },
          to: {
            opacity: 1,
            transform: isCentered ? 'translate(-50%, -50%) scale(1)' : 'translateX(0)',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: alpha('#cd853f', 0.2),
          bgcolor: alpha('#cd853f', 0.05),
          boxShadow: `inset 0 1px 0 ${alpha('#cd853f', 0.15)}`,
        }}
      >
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700, fontSize: '1rem' }}>
          {config.title}
        </Typography>
        <IconButton 
          size="small" 
          onClick={onClose}
          sx={{
            bgcolor: alpha('#fff', 0.05),
            '&:hover': { bgcolor: alpha('#ff4444', 0.2) },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>


      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {panel === 'activity' && <ActivityFeed />}
        {panel === 'stats' && <StatsMini />}
        {panel === 'inspector' && (
          selectedNode ? (
            <Inspector node={selectedNode} />
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Select a node to inspect
              </Typography>
            </Box>
          )
        )}
      </Box>
    </Paper>
  );
}
