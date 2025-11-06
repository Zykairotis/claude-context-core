/**
 * MainCanvas - React Flow mesh editor
 */

import { Box } from '@mui/material';
import { ReactFlowProvider } from 'reactflow';
import { MeshCanvas } from './MeshCanvas';
import { CanvasToolbar } from './CanvasToolbar';
import { ElectricFieldBackground } from './ElectricFieldBackground';
import { NodeStyles } from './NodeStyles';

export function MainCanvas() {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.default',
        position: 'relative',
      }}
    >
      {/* Global styles for React Flow nodes */}
      <NodeStyles />
      
      {/* Animated background */}
      <ElectricFieldBackground />
      
      <ReactFlowProvider>
        <CanvasToolbar />
        <MeshCanvas />
      </ReactFlowProvider>
    </Box>
  );
}
