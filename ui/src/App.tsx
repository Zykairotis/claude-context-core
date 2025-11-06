/**
 * Material Mesh Command Center - Main App
 */

import { useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '@lib/theme';
import { wsManager } from '@lib/websocket';
import { ToastContainer } from '@lib/toast';
import { AppBar } from '@components/layout/AppBar';
import { DockPanel } from '@components/layout/DockPanel';
import { MacDock } from '@components/layout/MacDock';
import { MainCanvas } from '@components/canvas/MainCanvas';
import { SettingsPanel } from '@components/settings/SettingsPanel';
import { useRealtimeStore } from '@store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  const project = 'default';
  const [activePanel, setActivePanel] = useState<'activity' | 'inspector' | 'stats' | null>(null);
  const { settingsPanel, closeSettings } = useRealtimeStore();

  useEffect(() => {
    // Connect to WebSocket on mount (will fail gracefully if server not running)
    const wsUrl = `ws://localhost:3030/ws?project=${project}`;
    wsManager.connect(wsUrl);

    return () => {
      wsManager.disconnect();
    };
  }, [project]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#000' }}>
          <AppBar project={project} />
          
          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
            <MainCanvas />
            
            {/* Floating Panels */}
            {activePanel && (
              <DockPanel
                panel={activePanel}
                onClose={() => setActivePanel(null)}
              />
            )}
          </Box>
          
          {/* macOS-style Dock */}
          <MacDock
            activePanel={activePanel}
            onPanelSelect={(panel: 'activity' | 'inspector' | 'stats') => setActivePanel(activePanel === panel ? null : panel)}
          />
        </Box>
        
        {/* Toast Notifications */}
        <ToastContainer />
        
        {/* Settings Panel */}
        <SettingsPanel
          open={settingsPanel.isOpen}
          onClose={closeSettings}
          node={settingsPanel.node}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
