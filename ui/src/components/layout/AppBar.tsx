/**
 * Material Mesh Command Center - AppBar
 * Top navigation with project selector and connection status
 */

import MuiAppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material';
import { useRealtimeStore } from '@store';

interface AppBarProps {
  project: string;
}

export function AppBar({ project }: AppBarProps) {
  const connected = useRealtimeStore((state: any) => state.connected);
  const nodes = useRealtimeStore((state: any) => state.nodes);

  return (
    <MuiAppBar 
      position="static" 
      elevation={0}
      sx={{
        bgcolor: alpha('#000', 0.7),
        backdropFilter: 'blur(40px) saturate(200%)',
        borderBottom: '1px solid',
        borderColor: alpha('#cd853f', 0.2),
        boxShadow: `0 4px 30px ${alpha('#cd853f', 0.1)}`,
      }}
    >
      <Toolbar variant="dense">
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 800, 
            mr: 3, 
            fontSize: '1.2rem',
            background: 'linear-gradient(135deg, #cd853f 0%, #daa520 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Claude Context
        </Typography>

        <Chip
          label={project}
          size="small"
          sx={{ 
            mr: 2, 
            fontWeight: 600,
            bgcolor: alpha('#cd853f', 0.1),
            borderColor: alpha('#cd853f', 0.3),
            backdropFilter: 'blur(10px)',
            boxShadow: `0 0 15px ${alpha('#cd853f', 0.15)}`,
          }}
          variant="outlined"
        />

        <Box sx={{ flex: 1 }} />

        <Chip
          label={`${nodes.length} nodes`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ mr: 2 }}
        />

        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: connected ? '#00ff88' : '#ff4444',
            boxShadow: connected 
              ? `0 0 10px ${alpha('#00ff88', 0.6)}`
              : `0 0 10px ${alpha('#ff4444', 0.6)}`,
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        />
      </Toolbar>
    </MuiAppBar>
  );
}
