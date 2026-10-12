import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Segundo paso del build: solo la página del kit de componentes
// (/componentes → componentes.html). Va aparte para que el build de la
// tienda (vite.config.js) quede idéntico: si las dos páginas se compilan
// juntas, Rollup reparte el código común en chunks nuevos y cambia lo que
// carga la tienda. Escribe en build/ sin borrar lo que dejó el primer paso.
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  publicDir: false, // public/ ya lo copió el build de la tienda
  build: {
    outDir: 'build',
    emptyOutDir: false,
    rollupOptions: {
      input: { componentes: fileURLToPath(new URL('./componentes.html', import.meta.url)) },
      output: {
        entryFileNames: 'assets/kit/[name]-[hash].js',
        chunkFileNames: 'assets/kit/[name]-[hash].js',
        assetFileNames: 'assets/kit/[name]-[hash][extname]',
      },
    },
  },
});
