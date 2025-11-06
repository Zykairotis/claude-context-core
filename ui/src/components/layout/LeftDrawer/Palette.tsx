/**
 * Palette - Draggable node types
 */

import { Box, Typography, Card, CardContent, alpha } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import WebIcon from '@mui/icons-material/Web';
import GitHubIcon from '@mui/icons-material/GitHub';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FilterListIcon from '@mui/icons-material/FilterList';
import DashboardIcon from '@mui/icons-material/Dashboard';
import type { NodeType } from '@types';

interface PaletteItemData {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const PALETTE_ITEMS: PaletteItemData[] = [
  {
    type: 'github',
    label: 'GitHub Repo',
    icon: <GitHubIcon />,
    color: '#000000',
    description: 'Index code from GitHub',
  },
  {
    type: 'crawler',
    label: 'Web Crawler',
    icon: <WebIcon />,
    color: '#a0522d',
    description: 'Crawl and index websites',
  },
  {
    type: 'vectordb',
    label: 'Vector DB',
    icon: <StorageIcon />,
    color: '#cd853f',
    description: 'Store embeddings',
  },
  {
    type: 'reranker',
    label: 'Reranker',
    icon: <FilterListIcon />,
    color: '#b8860b',
    description: 'Rerank search results',
  },
  {
    type: 'llm',
    label: 'LLM',
    icon: <SmartToyIcon />,
    color: '#daa520',
    description: 'Large language model',
  },
  {
    type: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    color: '#000000',
    description: 'Metrics visualization',
  },
];

export function Palette() {
  const handleDragStart = (e: React.DragEvent, item: PaletteItemData) => {
    e.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ type: item.type, label: item.label })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
        Node Palette
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {PALETTE_ITEMS.map((item) => (
          <Card
            key={item.type}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            sx={{
              cursor: 'grab',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              '&:hover': {
                transform: 'translateX(4px)',
                borderColor: alpha(item.color, 0.4),
                boxShadow: `0 4px 20px ${alpha(item.color, 0.15)}`,
              },
              '&:active': {
                cursor: 'grabbing',
                transform: 'scale(0.98)',
              },
            }}
          >
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  color: item.color, 
                  display: 'flex',
                  filter: 'drop-shadow(0 0 2px currentColor)',
                }}>
                  {item.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {item.description}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
