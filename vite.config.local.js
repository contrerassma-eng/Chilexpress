import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build de un solo archivo HTML (todo inline: JS, CSS y libreria de escaneo).
// Para abrir directo desde el dispositivo sin servidor ni deploy.
// Nota: la camara web exige contexto seguro; al abrir como archivo local
// funciona en escritorio (Chrome/Edge); en el celular usa HTTPS (GitHub Pages)
// o el ingreso manual de codigos.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-local',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 5000,
    cssCodeSplit: false
  }
});
