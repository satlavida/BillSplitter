import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import  { VitePWA }  from 'vite-plugin-pwa'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
    manifest: {
      name: 'Bill Splitter',
      short_name: 'BillSplit',
      description: 'Split bills easily among multiple people',
      theme_color: '#3b82f6',
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      // Workbox options
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      // Don't fallback on document based (e.g. `/some-page`) requests
      // This removes the need to detect `accept-header` request
      navigateFallback: null
    },
    devOptions: {
      enabled: true
    }
  })],
  base: './',
  build: {
    outDir: 'docs/'
  },
  resolve: {
    alias: {
      src: "/src",
      components: "/src/Components",
      ui: "/src/ui",
    },
  },
})
