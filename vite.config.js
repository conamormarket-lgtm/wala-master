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
    build: { outDir: 'build' }, // misma carpeta que CRA (Vercel/Firebase ya la detectan)
  };
});
