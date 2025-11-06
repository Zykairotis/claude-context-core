/**
 * BottomShelf - Activity feed with expand/collapse
 */

import { useState } from 'react';
import { Box, Paper, IconButton, Typography, Divider } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ActivityFeed } from './ActivityFeed';

export function BottomShelf() {
  const [expanded, setExpanded] = useState(true);
  const height = expanded ? 200 : 40;

  return (
    <Paper
      elevation={8}
      sx={{
        height,
        transition: 'height 0.3s ease',
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 0.5,
          minHeight: 40,
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
          Activity Feed
        </Typography>
        <IconButton size="small">
          {expanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>

      {expanded && (
        <>
          <Divider />
          <ActivityFeed />
        </>
      )}
    </Paper>
  );
}
