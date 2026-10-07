import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
          'Offline-first astronaut health co-pilot: detect, explain, act, log, sync later. Concept prototype, not a medical device.',
        theme_color: '#0C0A1E',
        background_color: '#0C0A1E',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: { navigateFallback: '/index.html' },
    }),
  ],
})
