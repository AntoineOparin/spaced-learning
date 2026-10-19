import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Runs the Worker (API + static assets) in workerd during `vite dev` and builds it.
    // E2E runs use a throwaway local D1 directory (see e2e/serve.mjs).
    cloudflare({
      persistState: process.env.E2E_STATE ? { path: process.env.E2E_STATE } : true,
    }),
    VitePWA({
      registerType: 'prompt', // never reload in the middle of a study session
      injectRegister: false, // registered from React (see src/app/UpdatePrompt.tsx)
      // The manifest request must carry the Cloudflare Access cookie, or installation fails.
      useCredentials: true,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'theme-init.js'],
      manifest: {
        name: 'Spaced Learning',
        short_name: 'Spaced',
        description: 'Spaced repetition for university courses',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell, code and KaTeX fonts (woff2 only — every target browser uses it).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        // Never answer API/auth navigations from the cache: they must reach Access + the Worker.
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/cdn-cgi\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
