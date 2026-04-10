import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['pwa-icon.svg', 'pwa-icon-maskable.svg', 'apple-touch-icon.svg'],
          manifest: {
            name: 'Hero Adventure',
            short_name: 'Hero Adventure',
            description: 'Hero Adventure: RPG tatico 3D com combate por turnos e progresso offline.',
            theme_color: '#6b3141',
            background_color: '#ead6c2',
            display: 'standalone',
            orientation: 'portrait-primary',
            start_url: '/',
            icons: [
              {
                src: 'pwa-icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any',
              },
              {
                src: 'pwa-icon-maskable.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            cleanupOutdatedCaches: true,
            skipWaiting: true,
            clientsClaim: true,
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,woff2,fbx,mp3,wav,ogg,m4a}'],
            runtimeCaching: [
              {
                urlPattern: /\.(?:fbx|png|jpg|jpeg|webp|svg)$/,
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
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
