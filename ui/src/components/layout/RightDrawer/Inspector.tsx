/**
 * Inspector - Node details with tabs
 */

import { useState } from 'react';
import { Box, Typography, Tabs, Tab, Chip, Divider, Paper } from '@mui/material';
import type { NodeMetadata } from '@types';
import { getStatusColor } from '@lib/theme';

interface InspectorProps {
  node: NodeMetadata;
}

export function Inspector({ node }: InspectorProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        {node.label}
      </Typography>

      <Chip
        label={node.status}
        size="small"
        sx={{
          backgroundColor: getStatusColor(node.status),
          color: 'white',
          mb: 2,
        }}
      />

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab label="Overview" />
        <Tab label="Metrics" />
        <Tab label="Logs" />
      </Tabs>

      <Divider sx={{ mb: 2 }} />

      {activeTab === 0 && (
        <Paper elevation={0} sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Node Type
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {node.type}
          </Typography>

          <Typography variant="caption" color="text.secondary" gutterBottom>
            ID
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {node.id}
          </Typography>

          <Typography variant="caption" color="text.secondary" gutterBottom>
            Created
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {new Date(node.createdAt).toLocaleString()}
          </Typography>

          <Typography variant="caption" color="text.secondary" gutterBottom>
            Last Updated
          </Typography>
          <Typography variant="body2">
            {new Date(node.updatedAt).toLocaleString()}
          </Typography>
        </Paper>
      )}

      {activeTab === 1 && (
        <Typography variant="body2" color="text.secondary">
          Metrics visualization coming soon...
        </Typography>
      )}

      {activeTab === 2 && (
        <Typography variant="body2" color="text.secondary">
          Live logs coming soon...
        </Typography>
      )}
    </Box>
  );
}
