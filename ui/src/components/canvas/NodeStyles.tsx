/**
 * Custom styles for React Flow nodes to match the amber/gold theme
 */

import { GlobalStyles } from '@mui/material';

export function NodeStyles() {
  return (
    <GlobalStyles
      styles={{
        '.react-flow__node': {
          background: 'rgba(0, 0, 0, 0.85)',
          border: '1px solid rgba(205, 133, 63, 0.4)',
          borderRadius: '8px',
          padding: '12px 16px',
          backdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 32px rgba(205, 133, 63, 0.15), 0 0 0 1px rgba(205, 133, 63, 0.2) inset',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        },
        '.react-flow__node:hover': {
          borderColor: 'rgba(205, 133, 63, 0.6)',
          boxShadow: '0 12px 48px rgba(205, 133, 63, 0.25), 0 0 0 1px rgba(205, 133, 63, 0.3) inset',
          transform: 'translateY(-2px)',
        },
        '.react-flow__node.selected': {
          borderColor: 'rgba(218, 165, 32, 0.8)',
          boxShadow: '0 16px 64px rgba(218, 165, 32, 0.35), 0 0 0 2px rgba(218, 165, 32, 0.4) inset, 0 0 40px rgba(218, 165, 32, 0.2)',
        },
        '.react-flow__handle': {
          width: '10px',
          height: '10px',
          background: 'rgba(205, 133, 63, 0.8)',
          border: '2px solid rgba(0, 0, 0, 0.8)',
          boxShadow: '0 0 8px rgba(205, 133, 63, 0.6)',
          transition: 'all 0.2s',
        },
        '.react-flow__handle:hover': {
          background: 'rgba(218, 165, 32, 1)',
          boxShadow: '0 0 16px rgba(218, 165, 32, 0.8)',
          transform: 'scale(1.3)',
        },
        '.react-flow__handle-connecting': {
          background: 'rgba(218, 165, 32, 1)',
          boxShadow: '0 0 20px rgba(218, 165, 32, 1)',
        },
        '.react-flow__edge-path': {
          stroke: 'rgba(205, 133, 63, 0.5)',
          strokeWidth: 2,
        },
        '.react-flow__edge.selected .react-flow__edge-path': {
          stroke: 'rgba(218, 165, 32, 0.8)',
          strokeWidth: 3,
        },
        '.react-flow__edge:hover .react-flow__edge-path': {
          stroke: 'rgba(218, 165, 32, 0.8)',
        },
        '.react-flow__background': {
          backgroundColor: 'transparent',
        },
        '.react-flow__minimap': {
          backgroundColor: 'rgba(0, 0, 0, 0.85) !important',
          border: '1px solid rgba(205, 133, 63, 0.4)',
          borderRadius: '8px',
          backdropFilter: 'blur(20px)',
        },
        '.react-flow__minimap-mask': {
          fill: 'rgba(205, 133, 63, 0.1)',
        },
        '.react-flow__controls': {
          button: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid rgba(205, 133, 63, 0.4)',
            color: '#cd853f',
            borderRadius: '6px',
            backdropFilter: 'blur(20px)',
            transition: 'all 0.2s',
          },
          'button:hover': {
            backgroundColor: 'rgba(205, 133, 63, 0.15)',
            borderColor: 'rgba(205, 133, 63, 0.6)',
            boxShadow: '0 0 12px rgba(205, 133, 63, 0.3)',
          },
          'button svg': {
            fill: '#cd853f',
          },
        },
      }}
    />
  );
}
