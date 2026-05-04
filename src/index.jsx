import React from 'react';
import ReactDOM from 'react-dom/client';
import './fabricPatch';
import './styles/variables.css';
import './styles/globals.css';
import App from './App';

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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
