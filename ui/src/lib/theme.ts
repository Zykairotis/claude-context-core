/**
 * Material Mesh Command Center - MUI Theme
 * Liquid glass aesthetic with cyan/purple accents
 * Based on docs/ui-redesign/06-material-theme.md
 */

import { createTheme, alpha } from '@mui/material/styles';

// ============================================================================
// Color Palette
// ============================================================================

const colors = {
  // Primary: Red
  red: {
    50: '#ffe0e0',
    100: '#ffb3b3',
    200: '#ff8080',
    300: '#ff4d4d',
    400: '#ff2626',
    500: '#ff0000', // Primary - Pure Red
    600: '#f00000',
    700: '#de0000',
    800: '#cc0000',
    900: '#ad0000',
  },
  // Secondary: Dark Red / Crimson
  crimson: {
    50: '#ffe5e5',
    100: '#ffbfbf',
    200: '#ff9494',
    300: '#ff6969',
    400: '#ff4545',
    500: '#ff2121', // Secondary
    600: '#ff1d1d',
    700: '#ff1818',
    800: '#ff1414',
    900: '#ff0b0b',
  },
  // Glass surfaces - Pure black glass (no color tint)
  glass: {
    light: 'rgba(0, 0, 0, 0.4)',
    medium: 'rgba(0, 0, 0, 0.6)',
    strong: 'rgba(0, 0, 0, 0.8)',
  },
  // Background - Pure black with subtle variations
  background: {
    default: '#000000',
    paper: '#0a0a0a',
    elevated: '#0f0000', // Slight red tint
  },
};

// ============================================================================
// Theme Configuration
// ============================================================================

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.red[500],
      light: colors.red[300],
      dark: colors.red[700],
    },
    secondary: {
      main: colors.crimson[500],
      light: colors.crimson[300],
      dark: colors.crimson[700],
    },
    background: {
      default: colors.background.default,
      paper: colors.background.paper,
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
    error: {
      main: '#ff4444',
    },
    warning: {
      main: '#ffaa00',
    },
    success: {
      main: '#00ff88',
    },
    info: {
      main: colors.red[500],
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${colors.red[500]} ${colors.background.paper}`,
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: colors.background.paper,
          },
          '&::-webkit-scrollbar-thumb': {
            background: colors.red[500],
            borderRadius: '4px',
            boxShadow: `0 0 10px ${alpha(colors.red[500], 0.5)}`,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: colors.red[400],
            boxShadow: `0 0 15px ${alpha(colors.red[500], 0.8)}`,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(colors.background.elevated, 0.7),
          backdropFilter: 'blur(40px) saturate(200%)',
          borderBottom: `1px solid ${alpha(colors.red[500], 0.3)}`,
          boxShadow: `0 4px 30px ${alpha(colors.red[500], 0.1)}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: alpha(colors.background.paper, 0.8),
          backdropFilter: 'blur(40px) saturate(200%)',
          borderRight: `1px solid ${alpha(colors.red[500], 0.3)}`,
          boxShadow: `inset -1px 0 20px ${alpha(colors.red[500], 0.1)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          // backgroundColor will be controlled by individual components
          backdropFilter: 'blur(20px) saturate(180%)',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(colors.background.paper, 0.7),
          backdropFilter: 'blur(30px) saturate(180%)',
          border: `1px solid ${alpha(colors.red[500], 0.1)}`,
        },
        elevation1: {
          boxShadow: `0 4px 16px ${alpha(colors.red[500], 0.15)}`,
        },
        elevation2: {
          boxShadow: `0 8px 32px ${alpha(colors.red[500], 0.2)}`,
        },
        elevation3: {
          boxShadow: `0 12px 48px ${alpha(colors.red[500], 0.25)}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        contained: {
          background: `linear-gradient(135deg, ${colors.red[500]} 0%, ${colors.crimson[500]} 100%)`,
          boxShadow: `0 4px 12px ${alpha(colors.red[500], 0.4)}, 0 0 20px ${alpha(colors.red[500], 0.2)}`,
          backdropFilter: 'blur(10px)',
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.red[400]} 0%, ${colors.crimson[400]} 100%)`,
            boxShadow: `0 6px 16px ${alpha(colors.red[500], 0.5)}, 0 0 30px ${alpha(colors.red[500], 0.3)}`,
            transform: 'translateY(-2px)',
          },
        },
        outlined: {
          borderColor: alpha(colors.red[500], 0.5),
          backgroundColor: alpha(colors.glass.light, 0.3),
          backdropFilter: 'blur(10px)',
          '&:hover': {
            borderColor: colors.red[500],
            backgroundColor: alpha(colors.red[500], 0.15),
            boxShadow: `0 0 20px ${alpha(colors.red[500], 0.3)}`,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: alpha('#000', 0.5),
            backdropFilter: 'blur(10px)',
            '& fieldset': {
              borderColor: alpha('#fff', 0.2),
            },
            '&:hover fieldset': {
              borderColor: alpha('#fff', 0.3),
            },
            '&.Mui-focused fieldset': {
              borderColor: alpha('#fff', 0.5),
            },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: alpha(colors.background.elevated, 0.9),
          backdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${alpha(colors.red[500], 0.4)}`,
          boxShadow: `0 8px 32px ${alpha(colors.red[500], 0.3)}`,
          fontSize: '0.75rem',
        },
      },
    },
    // MuiDataGrid will be configured when @mui/x-data-grid types are available
    // MuiDataGrid: {
    //   styleOverrides: {
    //     root: {
    //       border: `1px solid ${alpha(colors.cyan[500], 0.2)}`,
    //       backgroundColor: alpha(colors.background.paper, 0.5),
    //       '& .MuiDataGrid-cell': {
    //         borderColor: alpha(colors.cyan[500], 0.1),
    //       },
    //       '& .MuiDataGrid-columnHeaders': {
    //         backgroundColor: alpha(colors.background.elevated, 0.8),
    //         borderColor: alpha(colors.cyan[500], 0.2),
    //       },
    //       '& .MuiDataGrid-row:hover': {
    //         backgroundColor: alpha(colors.cyan[500], 0.05),
    //       },
    //     },
    //   },
    // },
  },
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get status color based on node status
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'ok':
    case 'running':
      return colors.red[500];
    case 'failed':
    case 'error':
      return colors.red[700];
    case 'warning':
      return '#ffaa00';
    case 'idle':
    case 'queued':
      return 'rgba(255, 255, 255, 0.5)';
    default:
      return 'rgba(255, 255, 255, 0.3)';
  }
};

/**
 * Create glass effect styles
 */
export const glassEffect = (opacity: number = 0.7) => ({
  backgroundColor: alpha(colors.background.paper, opacity),
  backdropFilter: 'blur(40px) saturate(180%)',
  border: `1px solid ${alpha('#fff', 0.1)}`,
  boxShadow: `0 8px 32px ${alpha('#000', 0.5)}, inset 0 1px 0 ${alpha('#fff', 0.05)}`,
});
