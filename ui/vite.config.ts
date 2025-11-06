import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@store': path.resolve(__dirname, './src/store/index.ts'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@types': path.resolve(__dirname, './src/types')
    }
  },
  server: {
    port: 3030,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3030',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist/ui',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'flow-vendor': ['reactflow'],
          'chart-vendor': ['recharts']
        }
      }
    }
  }
});
