/**
 * Material Mesh Command Center - Right Drawer
 * Inspector panel for selected nodes/edges
 */

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useRealtimeStore, selectSelectedNode } from '@store';
import { Inspector } from './Inspector';

const DRAWER_WIDTH = 320;

export function RightDrawer() {
  const selectedNode = useRealtimeStore(selectSelectedNode);

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
          height: 'calc(100vh - 64px)',
          borderLeft: 'none',
        },
      }}
    >
      <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
        {selectedNode ? (
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
              Select a node to inspect its details
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
