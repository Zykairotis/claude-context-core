/**
 * StatsMini - Quick stats overview
 */

import { Box, Typography, Paper, alpha } from '@mui/material';
import { useRealtimeStore } from '@store';

export function StatsMini() {
  const nodes = useRealtimeStore((state: any) => state.nodes);
  const edges = useRealtimeStore((state: any) => state.edges);
  
  const runningCount = nodes.filter((n: any) => n.status === 'running').length;
  const failedCount = nodes.filter((n: any) => n.status === 'failed').length;

  const stats = [
    { label: 'Nodes', value: nodes.length, color: 'primary.main' },
    { label: 'Edges', value: edges.length, color: 'secondary.main' },
    { label: 'Running', value: runningCount, color: 'success.main' },
    { label: 'Failed', value: failedCount, color: 'error.main' },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.5),
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Quick Stats
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {stats.map((stat) => (
          <Box key={stat.label} sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ color: stat.color, fontWeight: 600 }}>
              {stat.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
