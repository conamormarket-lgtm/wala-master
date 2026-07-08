import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Migración CRA -> Vite (Fase 1). Para NO obligar a renombrar el .env ni el código,
// se mantienen las variables `REACT_APP_*` y `process.env.*` resolviéndolas vía `define`.
// (El camino "canónico" de Vite sería import.meta.env.VITE_*, pero eso forzaría renombrar
//  el .env local y las env de Vercel; se difiere para no romper el entorno existente.)
const REACT_APP_KEYS = [
  'REACT_APP_API_URL',
  'REACT_APP_CULQI_PUBLIC_KEY',
  'REACT_APP_PAYPAL_CLIENT_ID',
  'REACT_APP_FIREBASE_API_KEY', 'REACT_APP_FIREBASE_AUTH_DOMAIN', 'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID', 'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_FIREBASE_MEASUREMENT_ID', 'REACT_APP_FIREBASE_VAPID_KEY',
  'REACT_APP_ERP_API_URL', 'REACT_APP_ERP_API_KEY', 'REACT_APP_ERP_TIMEOUT_MS',
  'REACT_APP_ERP_MAX_RETRIES', 'REACT_APP_ERP_RETRY_DELAY_MS',
  'REACT_APP_ERP_FIREBASE_API_KEY', 'REACT_APP_ERP_FIREBASE_AUTH_DOMAIN', 'REACT_APP_ERP_FIREBASE_PROJECT_ID',
  'REACT_APP_ERP_FIREBASE_STORAGE_BUCKET', 'REACT_APP_ERP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_ERP_FIREBASE_APP_ID', 'REACT_APP_ERP_FIREBASE_MEASUREMENT_ID',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const define = {
    // Compat con libs que asumen window.global (algunas de Firebase).
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    // En CRA PUBLIC_URL era '' (homepage '/'); en Vite el dir public/ se sirve en la raíz.
    'process.env.PUBLIC_URL': JSON.stringify(''),
  };
  for (const k of REACT_APP_KEYS) {
    define[`process.env.${k}`] = JSON.stringify(env[k] || '');
  }

  return {
    plugins: [react()],
    define,
    server: { port: 3000, open: false },
    preview: {
      host: true, // 0.0.0.0 — localhost y 127.0.0.1 en Windows
      port: 4174,
      strictPort: false,
    },
    build: {
      outDir: 'build', // misma carpeta que CRA (Vercel/Firebase ya la detectan)
      // Fase 1 — partir el bundle monolítico (~2.25MB) en chunks vendor por librería grande.
      // Es puramente aditivo: no cambia el código de la app, solo cómo Rollup agrupa node_modules.
      // Cada lib pesada va a su propio chunk para que el navegador cargue en paralelo y cachee mejor.
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Solo nos interesan las dependencias de terceros.
            if (!id.includes('node_modules')) return undefined;

            // React core + router juntos (se usan en todas las rutas).
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') || // react-router y react-router-dom
              id.includes('node_modules/scheduler/')      // dependencia interna de react-dom
            ) {
              return 'react-vendor';
            }

            // Firebase (auth, firestore, storage, messaging, etc.) — muy pesado.
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase-vendor';
            }

            // Recharts y su dependencia de gráficos d3.
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'charts';
            }

            // Animaciones.
            if (id.includes('node_modules/framer-motion')) {
              return 'motion';
            }

            // PayPal SDK (solo se necesita en checkout).
            if (id.includes('node_modules/@paypal')) {
              return 'paypal';
            }

            // Fabric (editor de imágenes/canvas), si está presente.
            if (id.includes('node_modules/fabric')) {
              return 'fabric';
            }

            // El resto de node_modules cae en el chunk vendor por defecto de Vite.
            return undefined;
          },
        },
      },
    },
  };
});
