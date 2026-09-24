import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base works with HashRouter on any GitHub Pages path.
const base = process.env.VITE_BASE || './';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // registered in src/main.tsx so the app reloads itself on a new deploy
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Seoul 2026 · Family Guide',
        short_name: 'Seoul 2026',
        description: 'Private family guide to Seoul, 23–30 Sep 2026',
        theme_color: '#07080c',
        background_color: '#07080c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}', 'assets/*.woff2'],
        globIgnores: ['images/**', 'data/**', 'assets/pretendard*.woff2', 'assets/Pretendard*.woff2', 'assets/*cyrillic*', 'assets/*vietnamese*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'data', networkTimeoutSeconds: 4, expiration: { maxEntries: 10 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'local-images-v2', expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
          {
            urlPattern: ({ request, url }) => request.destination === 'image' && url.origin !== self.location.origin && !url.hostname.includes('arcgisonline.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'remote-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.includes('arcgisonline.com'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'map-tiles', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'api.open-meteo.com',
            handler: 'NetworkFirst',
            options: { cacheName: 'weather', networkTimeoutSeconds: 5, expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
  },
});
