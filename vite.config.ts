import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// When building for Electron we need file:// compatible paths and no PWA SW.
const isElectron = process.env.VITE_ELECTRON === 'true';

export default defineConfig(() => {
    return {
      base: isElectron ? './' : (process.env.VITE_BASE_URL ?? '/'),
      build: {
        // Separate output dir keeps the web PWA build untouched.
        outDir: isElectron ? 'dist-electron-web' : 'dist',
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        // Service Workers don't work on file://, so skip the PWA plugin for
        // the Electron build. The stub alias below handles the import in code.
        ...(isElectron ? [] : [VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'icons/*.png'],
          manifest: {
            name: 'Hero Tower',
            short_name: 'Hero Tower',
            description: 'Hero Tower: RPG tatico 3D com combate por turnos e progresso offline.',
            theme_color: '#6b3141',
            background_color: '#ead6c2',
            display: 'standalone',
            orientation: 'portrait-primary',
            start_url: '/',
            icons: [
              { src: 'icons/icon-48x48.png',   sizes: '48x48',   type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-256x256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
              { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
            ],
          },
          workbox: {
            cleanupOutdatedCaches: true,
            skipWaiting: true,
            clientsClaim: true,
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
            navigateFallback: '/index.html',
            globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,woff2,wasm,json,webmanifest}'],
            runtimeCaching: [
              {
                urlPattern: ({ request }) => request.mode === 'navigate',
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'hero-adventure-pages',
                  networkTimeoutSeconds: 3,
                  expiration: {
                    maxEntries: 24,
                    maxAgeSeconds: 60 * 60 * 24 * 14,
                  },
                },
              },
              {
                urlPattern: /\.(?:fbx|glb|gltf|wasm|png|jpg|jpeg|webp|svg|json)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'hero-adventure-assets',
                  expiration: {
                    maxEntries: 480,
                    maxAgeSeconds: 60 * 60 * 24 * 120,
                  },
                },
              },
              {
                urlPattern: /\.(?:mp3|wav|ogg|m4a)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'hero-adventure-audio',
                  rangeRequests: true,
                  expiration: {
                    maxEntries: 160,
                    maxAgeSeconds: 60 * 60 * 24 * 60,
                  },
                },
              },
            ],
          },
        })]),  // end conditional PWA spread
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // In the Electron build, replace the SW virtual module with a no-op
          // stub so index.tsx compiles without changes.
          ...(isElectron ? { 'virtual:pwa-register': path.resolve(__dirname, 'electron/pwa-stub.ts') } : {}),
        }
      }
    };
});
