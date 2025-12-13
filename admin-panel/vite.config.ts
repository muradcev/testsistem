import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'ui-vendor': ['@headlessui/react', '@heroicons/react'],
          // Data fetching
          'data-vendor': ['@tanstack/react-query', 'axios', 'zustand'],
          // Map library
          'map-vendor': ['leaflet', 'react-leaflet'],
          // Charts
          'chart-vendor': ['recharts'],
          // Date utilities
          'date-vendor': ['date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
