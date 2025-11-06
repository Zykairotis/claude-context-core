# Material UI Liquid Glass Theme

**Shard**: 06  
**Dependencies**: 01-tech-stack  
**Blocks**: All UI components

---

## Theme Architecture

The liquid glass aesthetic combines:
1. **Dark base** - Deep blue/black backgrounds
2. **Translucent surfaces** - Frosted glass effect via `backdrop-filter`
3. **Subtle gradients** - Light overlays for depth
4. **Cyan/Purple accents** - Primary and secondary colors
5. **Smooth animations** - Micro-interactions on hover/focus

---

## Complete Theme Definition

**File**: `src/theme.ts`

```typescript
import { createTheme, alpha, Theme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
  }
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7dd3fc',      // cyan-300
      light: '#a5f3fc',     // cyan-200
      dark: '#22d3ee',      // cyan-400
      contrastText: '#0c4a6e'
    },
    secondary: {
      main: '#a78bfa',      // purple-400
      light: '#c4b5fd',     // purple-300
      dark: '#8b5cf6',      // purple-500
      contrastText: '#ffffff'
    },
    accent: {
      main: '#f472b6',      // pink-400
      light: '#f9a8d4',     // pink-300
      dark: '#ec4899'       // pink-500
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626'
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706'
    },
    info: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb'
    },
    success: {
      main: '#22c55e',
      light: '#4ade80',
      dark: '#16a34a'
    },
    background: {
      default: '#0b1220',           // Very dark blue
      paper: alpha('#1e293b', 0.45) // Slate-800 translucent
    },
    text: {
      primary: '#f8fafc',           // Slate-50
      secondary: alpha('#cbd5e1', 0.8), // Slate-300
      disabled: alpha('#94a3b8', 0.5)   // Slate-400
    },
    divider: alpha('#475569', 0.2)  // Slate-600
  },

  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500, lineHeight: 1.75 },
    subtitle2: { fontWeight: 500, lineHeight: 1.57 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
    button: { fontWeight: 600, letterSpacing: '0.02em' }
  },

  shape: {
    borderRadius: 14
  },

  shadows: [
    'none',
    `0 1px 2px 0 ${alpha('#000', 0.05)}`,
    `0 1px 3px 0 ${alpha('#000', 0.1)}, 0 1px 2px -1px ${alpha('#000', 0.1)}`,
    `0 4px 6px -1px ${alpha('#000', 0.1)}, 0 2px 4px -2px ${alpha('#000', 0.1)}`,
    `0 10px 15px -3px ${alpha('#000', 0.1)}, 0 4px 6px -4px ${alpha('#000', 0.1)}`,
    `0 20px 25px -5px ${alpha('#000', 0.1)}, 0 8px 10px -6px ${alpha('#000', 0.1)}`,
    `0 25px 50px -12px ${alpha('#000', 0.25)}`,
    ...Array(18).fill('none')
  ] as Theme['shadows'],

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${alpha('#475569', 0.3)} transparent`,
          '&::-webkit-scrollbar': {
            width: 8,
            height: 8
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha('#475569', 0.3),
            borderRadius: 4,
            '&:hover': {
              backgroundColor: alpha('#475569', 0.5)
            }
          }
        }
      }
    },

    MuiPaper: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(14px) saturate(140%)',
          backgroundColor: alpha('#1e293b', 0.45),
          border: `1px solid ${alpha('#ffffff', 0.08)}`,
          backgroundImage: `
            linear-gradient(
              180deg,
              ${alpha('#ffffff', 0.06)} 0%,
              ${alpha('#ffffff', 0.03)} 50%,
              ${alpha('#ffffff', 0.01)} 100%
            )
          `
        }
      }
    },

    MuiAppBar: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          backdropFilter: 'blur(10px) saturate(120%)',
          backgroundColor: alpha('#0f172a', 0.6),
          borderBottom: `1px solid ${alpha('#ffffff', 0.08)}`
        }
      }
    },

    MuiCard: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 20px 25px -5px ${alpha('#000', 0.2)}, 0 8px 10px -6px ${alpha('#000', 0.15)}`
          }
        }
      }
    },

    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
          padding: '8px 16px',
          transition: 'all 0.2s'
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: `0 4px 12px ${alpha('#7dd3fc', 0.3)}`,
            transform: 'translateY(-1px)'
          },
          '&:active': {
            transform: 'translateY(0)'
          }
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
            backgroundColor: alpha('#7dd3fc', 0.08)
          }
        }
      }
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500
        },
        filled: {
          backdropFilter: 'blur(8px)'
        }
      }
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: alpha('#0f172a', 0.95),
          backdropFilter: 'blur(20px) saturate(150%)',
          borderRight: `1px solid ${alpha('#ffffff', 0.08)}`
        }
      }
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined'
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: alpha('#1e293b', 0.4),
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: alpha('#1e293b', 0.6),
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: alpha('#7dd3fc', 0.3)
              }
            },
            '&.Mui-focused': {
              backgroundColor: alpha('#1e293b', 0.7),
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#7dd3fc',
                borderWidth: 2
              }
            }
          }
        }
      }
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: alpha('#1e293b', 0.95),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha('#ffffff', 0.1)}`,
          fontSize: '0.75rem'
        }
      }
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backdropFilter: 'blur(20px) saturate(150%)',
          backgroundColor: alpha('#1e293b', 0.85),
          backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.08)}, ${alpha('#ffffff', 0.03)})`
        }
      }
    },

    MuiBackdrop: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(4px)',
          backgroundColor: alpha('#000', 0.5)
        }
      }
    }
  }
});
```

---

## CSS Variables (Optional)

For dynamic theming or additional customization:

```typescript
// Extend theme with CSS variables
export const injectCssVariables = () => {
  const root = document.documentElement;
  
  root.style.setProperty('--glass-bg', 'rgba(30, 41, 59, 0.45)');
  root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.08)');
  root.style.setProperty('--glass-glow-cyan', 'rgba(125, 211, 252, 0.2)');
  root.style.setProperty('--glass-glow-purple', 'rgba(167, 139, 250, 0.2)');
};
```

---

## Usage in App

```typescript
// main.tsx
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import { App } from './app/App';

function Root() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}
```

---

## Custom Variants

Add custom button/chip variants:

```typescript
// Extend Button variants
declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    glass: true;
  }
}

// In theme
MuiButton: {
  variants: [
    {
      props: { variant: 'glass' },
      style: {
        backgroundColor: alpha('#7dd3fc', 0.1),
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha('#7dd3fc', 0.3)}`,
        '&:hover': {
          backgroundColor: alpha('#7dd3fc', 0.2),
          borderColor: '#7dd3fc'
        }
      }
    }
  ]
}
```

---

**Read next**: [07-node-types.md](./07-node-types.md)
