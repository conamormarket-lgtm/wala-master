import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/variables.css';
import './theme/tokens.css';
import './styles/globals.css';
import App, { queryClient } from './App';
import { loadStorefrontPage } from './pages/Tienda/services/startup.js';

// Evitar que el error auth/configuration-not-found cierre la app
window.addEventListener('unhandledrejection', (event) => {
  const code = event.reason?.code || event.reason?.auth?.code;
  const msg = event.reason?.message || event.reason?.auth?.message || '';
  if (code === 'auth/configuration-not-found' || String(msg).includes('configuration-not-found')) {
    event.preventDefault();
    event.stopPropagation();
    console.warn('Firebase Auth no configurado. Activa Authentication en Firebase Console y añade localhost a Dominios autorizados.');
    window.dispatchEvent(new CustomEvent('firebase-auth-config-error'));
  }
});

// Evitar overlay de React por error de Fabric.js (clearRect null al actualizar/desmontar canvas)
window.addEventListener('error', (event) => {
  if (event.message && typeof event.message === 'string' && event.message.includes("Cannot read properties of null (reading 'clearRect')")) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
});

// ── Caché del shell de la app (service worker) ─────────────────────────────
// Sin esto, cada arranque en frío vuelve a pedir por red los ~430 KB de JS y
// CSS aunque sean idénticos a los de la visita anterior — y en la app de
// Android eso pasa cada vez que se abre. Ver public/sw.js para qué cachea cada
// cosa y por qué; en resumen: los /assets con hash de caché, index.html
// siempre de red (para que un deploy se note al instante) y nada de Firestore
// ni Storage.
//
// Solo en producción: en desarrollo, un worker entre medias enmascara los
// cambios de Vite y vuelve loco el hot-reload.
//
// Solo en http/https: bajo Capacitor la app puede correr en un esquema propio
// (capacitor://) donde registrar un worker falla, y no hay nada que cachear
// porque los archivos ya son locales.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  /^https?:$/.test(window.location.protocol)
) {
  // Tras 'load' para no competir por ancho de banda con la primera pintada.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      // Que falle no rompe nada: la app funciona igual, solo sin caché.
      console.warn('[sw] no se pudo registrar:', e?.message || e);
    });
  });
}

// Start the public page config before mounting providers and other readers.
const initialPage = window.location.pathname.replace(/\/+$/, '') || '/';
if (['/', '/home', '/tienda'].includes(initialPage)) {
  const pageId = initialPage === '/tienda' ? 'tienda' : 'home';
  queryClient.prefetchQuery({
    queryKey: ['storefront-config', pageId],
    queryFn: () => loadStorefrontPage(pageId),
    staleTime: 10 * 60 * 1000,
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
