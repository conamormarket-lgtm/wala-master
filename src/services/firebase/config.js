import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Verificar si Firebase está configurado
const isFirebaseConfigured = () => {
  const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;
  return apiKey &&
    apiKey !== 'your-api-key-here' &&
    apiKey !== '' &&
    process.env.REACT_APP_FIREBASE_PROJECT_ID &&
    process.env.REACT_APP_FIREBASE_PROJECT_ID !== 'your-project-id';
};

let app = null;
let db = null;
let auth = null;
let storage = null;

if (isFirebaseConfigured()) {
  try {
    const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;
    const firebaseConfig = {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.REACT_APP_FIREBASE_APP_ID,
      ...(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID && {
        measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
      }),
    };

    app = initializeApp(firebaseConfig);
    storage = getStorage(app);

    // ── Firestore con persistencia offline ─────────────────────────────
    // Usa initializeFirestore (API moderna) para configurar caché local
    // persistente en IndexedDB + soporte multi-tab.
    //
    // Después de la primera carga, TODAS las lecturas de Firestore se
    // sirven desde disco local (~10ms) en lugar del servidor (~300-2000ms).
    // Los datos se sincronizan en background cuando hay conexión.
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (firestoreErr) {
      // Si initializeFirestore falla (ya inicializado, etc.), usar getFirestore
      const { getFirestore } = require('firebase/firestore');
      db = getFirestore(app);
      console.warn('Firestore: usando caché en memoria (IndexedDB no disponible).');
    }

    try {
      auth = getAuth(app);
    } catch (authError) {
      auth = null;
      console.warn('Firebase Auth no disponible:', authError?.message || authError);
      console.warn('Solución: en Firebase Console > Authentication > haz clic en "Comenzar" y añade "localhost" en Dominios autorizados.');
    }
  } catch (error) {
    console.warn('Error al inicializar Firebase:', error);
    app = null;
    db = null;
    auth = null;
    storage = null;
  }
} else {
  console.warn('Firebase no está configurado. Usando modo desarrollo con backend mock.');
  console.warn('Para configurar Firebase, edita el archivo .env con tus credenciales.');
}

// Mensaje según entorno (en Vercel no existe .env, hay que usar el dashboard)
const getFirebaseConfigMessage = () => {
  if (typeof window !== 'undefined' && /vercel\.app$/i.test(window.location.hostname)) {
    return 'Firebase no está configurado en Vercel. Entra en vercel.com → tu proyecto → Settings → Environment Variables, añade REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_PROJECT_ID, REACT_APP_FIREBASE_AUTH_DOMAIN, REACT_APP_FIREBASE_STORAGE_BUCKET, REACT_APP_FIREBASE_MESSAGING_SENDER_ID, REACT_APP_FIREBASE_APP_ID (los mismos valores que en tu .env local). Guarda y haz Redeploy del proyecto.';
  }
  return 'Firebase no está configurado. Por favor configura tus credenciales en el archivo .env';
};

export { db, auth, storage, getFirebaseConfigMessage };
export default app;
