/**
 * MacDock - macOS-style dock menu at the bottom
 */

import { Box, IconButton, Tooltip, alpha, Zoom } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import CodeIcon from '@mui/icons-material/Code';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useState } from 'react';

interface MacDockProps {
  activePanel: string | null;
  onPanelSelect: (panel: 'activity' | 'inspector' | 'stats') => void;
}

interface DockItem {
  id: 'activity' | 'inspector' | 'stats';
  icon: React.ReactNode;
  label: string;
  color: string;
}

const DOCK_ITEMS: DockItem[] = [
  {
    id: 'activity',
    icon: <TimelineIcon />,
    label: 'Activity',
    color: '#daa520',
  },
  {
    id: 'inspector',
    icon: <CodeIcon />,
    label: 'Inspector',
    color: '#d2691e',
  },
  {
    id: 'stats',
    icon: <BarChartIcon />,
    label: 'Stats',
    color: '#b8860b',
  },
];

export function MacDock({ activePanel, onPanelSelect }: MacDockProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        gap: 1,
        p: 1.5,
        borderRadius: 3,
        bgcolor: alpha('#000', 0.85),
        backdropFilter: 'blur(50px) saturate(200%)',
        border: '1px solid',
        borderColor: alpha('#cd853f', 0.25),
        boxShadow: `0 12px 48px ${alpha('#cd853f', 0.2)}, 0 0 0 1px ${alpha('#cd853f', 0.15)} inset, 0 0 60px ${alpha('#cd853f', 0.1)}`,
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        '&:hover': {
          boxShadow: `0 16px 64px ${alpha('#cd853f', 0.3)}, 0 0 0 1px ${alpha('#cd853f', 0.3)} inset, 0 0 80px ${alpha('#cd853f', 0.15)}`,
        },
      }}
    >
      {DOCK_ITEMS.map((item, index) => {
        const isActive = activePanel === item.id;
        const isHovered = hoveredIndex === index;
        const scale = isHovered ? 1.4 : isActive ? 1.2 : 1;

        return (
          <Zoom key={item.id} in timeout={200}>
            <Tooltip title={item.label} placement="top">
              <IconButton
                onClick={() => onPanelSelect(item.id)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: isActive ? alpha(item.color, 0.2) : alpha('#fff', 0.05),
                  backdropFilter: 'blur(10px)',
                  border: '1px solid',
                  borderColor: isActive ? alpha(item.color, 0.5) : alpha('#fff', 0.1),
                  color: isActive ? item.color : '#fff',
                  transform: `scale(${scale}) translateY(${isHovered ? -8 : 0}px)`,
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: isActive
                    ? `0 0 20px ${alpha(item.color, 0.4)}, 0 4px 12px ${alpha('#000', 0.5)}`
                    : isHovered
                    ? `0 8px 16px ${alpha('#000', 0.6)}`
                    : `0 2px 8px ${alpha('#000', 0.3)}`,
                  '&:hover': {
                    bgcolor: alpha(item.color, 0.15),
                    borderColor: alpha(item.color, 0.4),
                  },
                  '&::before': isActive
                    ? {
                        content: '""',
                        position: 'absolute',
                        bottom: -8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: item.color,
                        boxShadow: `0 0 8px ${item.color}`,
                      }
                    : {},
                }}
              >
                {item.icon}
              </IconButton>
            </Tooltip>
          </Zoom>
        );
      })}
    </Box>
  );
}
