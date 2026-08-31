import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import  { VitePWA }  from 'vite-plugin-pwa'
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Path the app is deployed under — GitHub Pages (prod) serves it at
  // /BillSplitter/, Cloudflare Pages (beta) serves it from the domain root.
  // See VITE_BASE_PATH in .env.production / .env.beta.
  const basePath = env.VITE_BASE_PATH || '/BillSplitter/'

  return {
  plugins: [react(), tailwindcss(),VitePWA({
    base: basePath,
    registerType: 'prompt',
    includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
    manifest: {
      name: 'Bill Splitter',
      short_name: 'BillSplit',
      description: 'Split bills easily among multiple people',
      start_url: basePath,
      scope: basePath,
      theme_color: '#3b82f6',
      background_color: '#ffffff',
      display: 'standalone',
      icons: [
        {
          src: `${basePath}icons/icon-192x192.png`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: `${basePath}icons/icon-512x512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      // Simplified workbox configuration - just the globPatterns for precaching
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      // opencv.js (wasm, ~15MB) is lazy-loaded on demand by the dev receipt
      // scan test page only (see src/lib/opencvLoader.ts) — never precache it.
      globIgnores: ['**/opencv-*.js'],
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
  server: {
    watch: {
      // The Go backend (server/) writes its SQLite DB/WAL/SHM files and
      // scan-receipt scratch images inside this repo while `npm run e2e` or
      // a local `go run ./cmd/server` runs alongside `vite dev` — without
      // this, every write triggers an unwanted full-page HMR reload.
      ignored: ['**/server/**'],
    },
  },
  resolve: {
    alias: {
      src: "/src",
      components: "/src/Components",
      ui: "/src/ui",
    },
  },
  }
})
