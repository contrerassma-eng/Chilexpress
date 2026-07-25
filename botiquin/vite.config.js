import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// El Worker sirve el build desde la raiz del dominio, asi que la base es '/'.
export default defineConfig({
  base: '/',
  build: { outDir: 'dist' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Botiquin de casa',
        short_name: 'Botiquin',
        description: 'Inventario del botiquin: escanea, agrega compras y descuenta lo que consumes',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f9',
        theme_color: '#0f766e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // La API nunca se sirve desde cache: el stock tiene que ser el real.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly'
          }
        ],
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: false }
    })
  ],
  server: {
    host: true,
    // `npm run dev:api` levanta el Worker en 8787 para probar la API en local.
    proxy: { '/api': 'http://127.0.0.1:8787' }
  },
  preview: { host: true }
});
