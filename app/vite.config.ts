import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// The console is served under /app/ on the same Netlify site as the landing page.
export default defineConfig({
  base: '/app/',
  // The 3D twin uses the landing page's baked body, and VITA's chat the landing page's ask module (one source of truth each); let the dev server read those folders.
  server: { fs: { allow: ['.', '../landing/universe/targets', '../landing/vita'] } },
  // Four test files seed the 20k-reading demo mission; cap workers so they do not starve each other.
  test: { maxWorkers: 3 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AstroDocX Crew Console',
        short_name: 'AstroDocX',
        description:
          'Offline-first astronaut health co-pilot: detect, explain, act, log, sync later. Prototype, not a medical device.',
        theme_color: '#02050a',
        background_color: '#02050a',
        display: 'standalone',
        start_url: '/app/',
        scope: '/app/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      // Fonts and the 3D twin's body are bundled and precached so the console looks the same offline.
      // The 3D cabin's models and textures (about 4 MB) are cached on first visit instead of precached, so the console's install stays small.
      // Network first, so a changed model reaches returning visitors (an unchanged one is a quick 304); the cache serves offline or on a slow link.
      workbox: {
        navigateFallback: '/app/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,bin}'],
        runtimeCaching: [{ urlPattern: /\/(models\/[^/]+\.glb|textures\/[^/]+\.webp)$/, handler: 'NetworkFirst', options: { cacheName: 'cabin-models', networkTimeoutSeconds: 4 } }],
      },
    }),
  ],
})
