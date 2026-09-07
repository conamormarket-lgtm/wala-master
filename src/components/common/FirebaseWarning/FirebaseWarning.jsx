import React, { useState, useEffect } from 'react';
import { auth } from '../../../services/firebase/config';
import styles from './FirebaseWarning.module.css';
import { T } from '../../../i18n/useTranslatedText';

const FirebaseWarning = () => {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!auth) setShowWarning(true);
    const onAuthError = () => setShowWarning(true);
    window.addEventListener('firebase-auth-config-error', onAuthError);
    return () => window.removeEventListener('firebase-auth-config-error', onAuthError);
  }, []);

  if (!showWarning) return null;

  return (
    <div className={styles.warning}>
      <div className={styles.iconContainer}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
        </svg>
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>Modo Desarrollo</h3>
          <button 
            className={styles.closeButton}
            onClick={() => setShowWarning(false)}
            aria-label="Cerrar aviso"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <p className={styles.message}>
          {typeof window !== 'undefined' && /vercel\.app$/i.test(window.location.hostname)
            ? 'Firebase no está configurado en este despliegue. Las variables de entorno deben configurarse en Vercel (no en .env).'
            : 'Firebase no está configurado o Authentication no está activo. La app funciona con funcionalidades limitadas (sin inicio de sesión).'}
        </p>
        <div className={styles.instructions}>
          <p className={styles.instructionTitle}>
            {typeof window !== 'undefined' && /vercel\.app$/i.test(window.location.hostname)
              ? 'Para que Firebase funcione en Vercel:'
              : 'Para quitar el error auth/configuration-not-found:'}
          </p>
          <ol className={styles.steps}>
            {typeof window !== 'undefined' && /vercel\.app$/i.test(window.location.hostname) ? (
              <>
                <li><T>Entra en</T> <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a> <T>→ tu proyecto →</T> <strong>Settings</strong> → <strong>Environment Variables</strong></li>
                <li><T>Añade cada variable (mismo nombre y valor que en tu</T> <code>.env</code> local): <code>REACT_APP_FIREBASE_API_KEY</code>, <code>REACT_APP_FIREBASE_PROJECT_ID</code>, <code>REACT_APP_FIREBASE_AUTH_DOMAIN</code>, <code>REACT_APP_FIREBASE_STORAGE_BUCKET</code>, <code>REACT_APP_FIREBASE_MESSAGING_SENDER_ID</code>, <code>REACT_APP_FIREBASE_APP_ID</code></li>
                <li><T>Guarda y en</T> <strong>Deployments</strong> <T>haz clic en ⋮ del último deploy →</T> <strong>Redeploy</strong> <T>(sin las variables el build no las incluye)</T></li>
                <li>En <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer">Firebase Console</a> <T>→ Authentication → Dominios autorizados, añade</T> <code><T>portal-clientes-regala-con-amor.vercel.app</T></code></li>
              </>
            ) : (
              <>
                <li>Abre <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer">Firebase Console</a> <T>y elige tu proyecto</T></li>
                <li><T>Entra en</T> <strong>Authentication</strong> <T>y haz clic en</T> <strong>Comenzar</strong> <T>(o en la pestaña Proveedores y activa Email/Google)</T></li>
                <li><T>En Authentication →</T> <strong><T>Configuración</T></strong> → <strong>Dominios autorizados</strong><T>, añade</T> <code>localhost</code> <T>si no está</T></li>
                <li><T>Guarda y recarga esta página</T></li>
              </>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default FirebaseWarning;
