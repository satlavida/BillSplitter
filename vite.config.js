import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import  { VitePWA }  from 'vite-plugin-pwa'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),VitePWA({
    base: '/BillSplitter/', // Match the base path
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
    manifest: {
      name: 'Bill Splitter',
      short_name: 'BillSplit',
      description: 'Split bills easily among multiple people',
      start_url: '/BillSplitter/',
      scope: '/BillSplitter/',
      theme_color: '#3b82f6',
      background_color: '#ffffff',
      display: 'standalone',
      icons: [
        {
          src: '/BillSplitter/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/BillSplitter/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      // Simplified workbox configuration - just the globPatterns for precaching
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      navigateFallback: null
    },
    // For development testing
    devOptions: {
      enabled: true,
      navigateFallback: null
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
