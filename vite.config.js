import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// En local / Vercel se sirve en raiz ('/'). En GitHub Pages el sitio vive bajo
// /<repo>/, asi que el workflow define VITE_BASE para esa subruta.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Chile Express - Recepcion y Entrega',
        short_name: 'CX Escaneo',
        description: 'App local y offline para escanear, recibir y entregar paquetes Chile Express',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#e2231a',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: false }
    })
  ],
  server: { host: true },
  preview: { host: true }
});
