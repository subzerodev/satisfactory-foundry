/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA: Workbox generateSW precaches the hashed build assets + the bundled
    // catalog for full offline use. No `base` here (Axis 2) — CI passes
    // --base=/satisfactory-foundry/ and the plugin derives SW scope, start_url,
    // and precache URLs from the resolved base. registerType 'prompt' drives the
    // in-app REVISION AVAILABLE toast (UpdateToast); offlineReady stays silent.
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Satisfactory Foundry',
        short_name: 'Foundry',
        description:
          'Plan Satisfactory production manifolds — balance feeds and outputs, size machines, and read the flow, right in the browser.',
        display: 'standalone',
        theme_color: '#24384a',
        background_color: '#ede9dc',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precache everything the app needs so it works fully offline after the
        // first visit — including the 5.3 MB bundled catalog, which the 2 MiB
        // Workbox default would silently skip (raised to 8 MiB below).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
  },
})
