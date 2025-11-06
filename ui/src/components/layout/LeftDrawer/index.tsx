/**
 * Material Mesh Command Center - Left Drawer
 * Palette with draggable node types
 */

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { Palette } from './Palette';
import { FilterPanel } from './FilterPanel';
import { StatsMini } from './StatsMini';

const DRAWER_WIDTH = 280;

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
          height: 'calc(100vh - 64px)',
          borderRight: 'none',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
          <Palette />
          <Divider sx={{ my: 2 }} />
          <FilterPanel />
        </Box>
        
        <Divider />
        <StatsMini />
      </Box>
    </Drawer>
  );
}
