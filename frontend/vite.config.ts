import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      'axios',
      'react-hook-form',
      '@hookform/resolvers/zod',
      'zod',
      'lucide-react',
      'framer-motion',
      'date-fns',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Extract the top-level package name from the module path
          const pkg = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)?.[1] ?? '';

          // Charts — heaviest dep, only used on /statistics (lazy-loaded)
          if (pkg === 'recharts' || pkg.startsWith('d3-') || pkg === 'd3' || pkg === 'victory') {
            return 'vendor-charts';
          }
          // Animation
          if (pkg === 'framer-motion') return 'vendor-motion';
          // React core — most stable, rarely changes → long cache TTL
          if (pkg === 'react-dom') return 'vendor-react-dom';
          if (pkg === 'react') return 'vendor-react';
          // Routing
          if (pkg === 'react-router-dom' || pkg === 'react-router') return 'vendor-router';
          // Headless UI primitives
          if (pkg.startsWith('@radix-ui/')) return 'vendor-radix';
          // Forms + validation
          if (pkg === 'react-hook-form' || pkg.startsWith('@hookform/') || pkg === 'zod') {
            return 'vendor-forms';
          }
          // Server state
          if (pkg.startsWith('@tanstack/')) return 'vendor-query';
          // Icons (tree-shaken per icon — keeps its own chunk small)
          if (pkg === 'lucide-react') return 'vendor-icons';
          // Phone input + country data (libphonenumber-js is heavy)
          if (pkg === 'react-phone-number-input' || pkg === 'libphonenumber-js') {
            return 'vendor-phone';
          }
          // Date picker + date utilities
          if (pkg === 'react-day-picker' || pkg === 'date-fns') return 'vendor-date';
          // Command palette (cmdk — used by CountryDropdown / shadcn Command)
          if (pkg === 'cmdk') return 'vendor-cmdk';
          // WebAuthn browser client
          if (pkg.startsWith('@simplewebauthn/')) return 'vendor-webauthn';
          // HTTP client + client-side state
          if (pkg === 'axios' || pkg === 'zustand') return 'vendor-http';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
