/**
 * CanvasToolbar - Canvas controls and actions
 */

import { Box, IconButton, Tooltip, Divider, alpha, Typography } from '@mui/material';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { useReactFlow } from 'reactflow';
import { useState } from 'react';

export function CanvasToolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleFitView = () => {
    fitView({ padding: 0.2, duration: 400 });
  };

  const handleClear = () => {
    if (window.confirm('Clear all nodes? This cannot be undone.')) {
      // Will be connected to store action
      console.log('Clear all nodes');
    }
  };

  return (
    <>
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        gap: 0.5,
        backgroundColor: alpha('#000', 0.9),
        backdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid',
        borderColor: alpha('#cd853f', 0.3),
        boxShadow: `0 8px 32px ${alpha('#cd853f', 0.2)}`,
        borderRadius: 2,
        p: 0.5,
      }}
    >
      <Tooltip title="Undo (Ctrl+Z)">
        <IconButton size="small" sx={{ color: '#cd853f' }}>
          <UndoIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Redo (Ctrl+Shift+Z)">
        <IconButton size="small" sx={{ color: '#cd853f' }}>
          <RedoIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: alpha('#cd853f', 0.2) }} />

      <Tooltip title="Zoom In (+)">
        <IconButton size="small" onClick={() => zoomIn()} sx={{ color: '#cd853f' }}>
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Zoom Out (-)">
        <IconButton size="small" onClick={() => zoomOut()} sx={{ color: '#cd853f' }}>
          <ZoomOutIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Fit to View (F)">
        <IconButton size="small" onClick={handleFitView} sx={{ color: '#cd853f' }}>
          <FitScreenIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: alpha('#cd853f', 0.2) }} />

      <Tooltip title="Save Layout (Ctrl+S)">
        <IconButton size="small" sx={{ color: '#cd853f' }}>
          <SaveIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Clear All (Ctrl+Shift+Delete)">
        <IconButton size="small" onClick={handleClear} sx={{ color: '#ff4444' }}>
          <DeleteSweepIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ borderColor: alpha('#cd853f', 0.2) }} />

      <Tooltip title="Keyboard Shortcuts">
        <IconButton 
          size="small" 
          onClick={() => setShowShortcuts(!showShortcuts)}
          sx={{ color: '#cd853f' }}
        >
          <KeyboardIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>

    {/* Keyboard Shortcuts Panel */}
    {showShortcuts && (
      <Box
        sx={{
          position: 'absolute',
          top: 70,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          backgroundColor: alpha('#000', 0.95),
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid',
          borderColor: alpha('#cd853f', 0.3),
          boxShadow: `0 8px 32px ${alpha('#cd853f', 0.25)}`,
          borderRadius: 2,
          p: 2,
          minWidth: 300,
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#cd853f', mb: 1.5, fontWeight: 600 }}>
          Keyboard Shortcuts
        </Typography>
        {[
          { key: 'Del', action: 'Delete selected' },
          { key: 'Ctrl+C', action: 'Copy' },
          { key: 'Ctrl+V', action: 'Paste' },
          { key: 'Ctrl+Z', action: 'Undo' },
          { key: 'Ctrl+Shift+Z', action: 'Redo' },
          { key: 'Ctrl+A', action: 'Select all' },
          { key: 'F', action: 'Fit to view' },
          { key: '+/-', action: 'Zoom in/out' },
          { key: 'Space+Drag', action: 'Pan canvas' },
        ].map((shortcut, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              py: 0.75,
              borderBottom: i < 8 ? `1px solid ${alpha('#cd853f', 0.1)}` : 'none',
            }}
          >
            <Typography variant="caption" sx={{ color: '#999' }}>
              {shortcut.action}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: '#cd853f', 
                fontFamily: 'monospace',
                bgcolor: alpha('#cd853f', 0.1),
                px: 1,
                py: 0.25,
                borderRadius: 0.5,
              }}
            >
              {shortcut.key}
            </Typography>
          </Box>
        ))}
      </Box>
    )}
    </>
  );
}
