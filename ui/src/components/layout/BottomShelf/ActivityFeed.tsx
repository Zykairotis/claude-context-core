/**
 * ActivityFeed - Live event stream
 */

import { Box, Typography, Chip, alpha } from '@mui/material';
import { useRealtimeStore } from '@store';
import { formatDistanceToNow } from 'date-fns';

export function ActivityFeed() {
  const events = useRealtimeStore((state: any) => state.events);

  if (events.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No activity yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
      {events.map((event: any) => (
        <Box
          key={event.id}
          sx={{
            p: 1.5,
            mb: 0.5,
            borderRadius: 1,
            backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.5),
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Chip
            label={event.severity}
            size="small"
            color={
              event.severity === 'error'
                ? 'error'
                : event.severity === 'warning'
                ? 'warning'
                : event.severity === 'success'
                ? 'success'
                : 'default'
            }
            sx={{ minWidth: 70 }}
          />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {event.message}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
