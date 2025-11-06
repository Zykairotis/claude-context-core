/**
 * FilterPanel - Filter nodes by status
 */

import { Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

export function FilterPanel() {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
        Filter by Status
      </Typography>

      <ToggleButtonGroup
        size="small"
        orientation="vertical"
        sx={{ width: '100%' }}
      >
        <ToggleButton value="all" sx={{ justifyContent: 'flex-start', gap: 1 }}>
          All Nodes
        </ToggleButton>
        <ToggleButton value="running" sx={{ justifyContent: 'flex-start', gap: 1 }}>
          <PlayArrowIcon fontSize="small" />
          Running
        </ToggleButton>
        <ToggleButton value="ok" sx={{ justifyContent: 'flex-start', gap: 1 }}>
          <CheckCircleIcon fontSize="small" />
          OK
        </ToggleButton>
        <ToggleButton value="failed" sx={{ justifyContent: 'flex-start', gap: 1 }}>
          <ErrorIcon fontSize="small" />
          Failed
        </ToggleButton>
        <ToggleButton value="idle" sx={{ justifyContent: 'flex-start', gap: 1 }}>
          <PauseIcon fontSize="small" />
          Idle
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
