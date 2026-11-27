import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(mode === 'android'
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              injectRegister: 'auto',
              includeAssets: ['favicon.ico', 'icon-192x192.png', 'icon-512x512.png'],
              workbox: {
                cacheId: 'dragotracker-v2.2.0',
              },
              manifest: {
                name: 'Dragoriano Workout Tracker',
                short_name: 'GymTracker',
                description: 'Premium Workout Tracking App',
                theme_color: '#0B0E13',
                background_color: '#0B0E13',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                  {
                    src: 'icon-192x192.png',
                    type: 'image/png',
                    sizes: '192x192',
                    purpose: 'any'
                  },
                  {
                    src: 'icon-512x512.png',
                    type: 'image/png',
                    sizes: '512x512',
                    purpose: 'any'
                  },
                  {
                    src: 'icon-192x192.png',
                    type: 'image/png',
                    sizes: '192x192',
                    purpose: 'maskable'
                  }
                ],
                start_url: env.VITE_BASE_PATH || '/',
                scope: env.VITE_BASE_PATH || '/'
              }
            }),
          ]),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('src/data/exercises.ts')) return 'exercise-data';
            if (!normalizedId.includes('/node_modules/')) return undefined;
            if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|clsx|tailwind-merge|zustand|idb|radix-ui|class-variance-authority|sonner)\//.test(normalizedId)) return 'react-vendor';
            if (/\/node_modules\/three\//.test(normalizedId)) return 'three-vendor';
            if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(normalizedId)) return 'motion';
            if (/\/node_modules\/(recharts|d3-|victory-vendor|decimal\.js-light|internmap|robust-predicates)\//.test(normalizedId)) return 'charts';
            if (/\/node_modules\/@supabase\//.test(normalizedId)) return 'supabase';
            if (/\/node_modules\/(html5-qrcode|qrcode\.react)\//.test(normalizedId)) return 'qr';
            if (/\/node_modules\/lucide-react\//.test(normalizedId)) return 'icons';
            return undefined;
          }
        }
      },
      chunkSizeWarningLimit: 1000,
    },
    base: mode === 'android' ? './' : (env.VITE_BASE_PATH || '/'),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/android/**', '**/dist/**'],
        awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 },
      },
    },
  };
});
