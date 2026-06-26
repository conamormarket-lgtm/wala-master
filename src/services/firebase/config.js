import { initializeApp } from 'firebase/app';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import { initializeFirestore, persistentLocalCache, getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getMessaging, isSupported } from 'firebase/messaging';

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
let messaging = null;

// En DEV usamos los EMULADORES de Firebase (proyecto demo aislado 'demo-wala'), salvo que
// VITE_USE_EMULATORS='false'. En build/producción se usa el Firebase real del .env.
const USE_EMULATORS = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false';

if (USE_EMULATORS) {
  try {
    app = initializeApp({ projectId: 'demo-wala', apiKey: 'demo-emulator', authDomain: 'localhost' });
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectStorageEmulator(storage, 'localhost', 9199);
    try { connectFunctionsEmulator(getFunctions(app), 'localhost', 5001); } catch (e) { /* functions opcional */ }
    console.info('[Wala] EMULADORES de Firebase activos (proyecto demo-wala) — datos locales, sin tocar producción.');
  } catch (error) {
    console.warn('No se pudo conectar a los emuladores. ¿Están corriendo? (npm run emulators):', error?.message || error);
  }
} else if (isFirebaseConfigured()) {
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

    // ── Detección de iframe ─────────────────────────────────────────────
    // Si la app corre DENTRO de un iframe (p. ej. la PREVIEW del mapa de calor en
    // el dashboard), una 2ª instancia compite por el lock de IndexedDB de la
    // persistencia y lanza "Failed to obtain exclusive access to the persistence
    // layer". En ese caso usamos CACHÉ EN MEMORIA (getFirestore normal) para no
    // tocar IndexedDB. Fuera del iframe el comportamiento no cambia.
    const inIframe = (typeof window !== 'undefined') && window.self !== window.top;

    // ── Firestore con persistencia offline ─────────────────────────────
    if (inIframe) {
      // Dentro de un iframe: caché en memoria, sin IndexedDB (evita el conflicto de lock).
      db = getFirestore(app);
    } else {
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache(), // Cache simple sin multi-tab para mejor compatibilidad en Capacitor/Android
        });
      } catch (firestoreErr) {
        // Si initializeFirestore falla (ya inicializado, etc.), usar getFirestore
        db = getFirestore(app);
        console.warn('Firestore: usando caché en memoria (IndexedDB no disponible).');
      }
    }

    try {
      auth = getAuth(app);
    } catch (authError) {
      auth = null;
      console.warn('Firebase Auth no disponible:', authError?.message || authError);
      console.warn('Solución: en Firebase Console > Authentication > haz clic en "Comenzar" y añade "localhost" en Dominios autorizados.');
    }

    // Inicializar Messaging solo si es soportado por el navegador
    isSupported().then((supported) => {
      if (supported) {
        try {
          messaging = getMessaging(app);
        } catch (messagingError) {
          console.warn('Firebase Messaging no disponible:', messagingError);
        }
      } else {
        console.warn('Firebase Messaging no está soportado en este navegador.');
      }
    });

  } catch (error) {
    console.warn('Error al inicializar Firebase:', error);
    app = null;
    db = null;
    auth = null;
    storage = null;
    messaging = null;
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

export { db, auth, storage, messaging, getFirebaseConfigMessage };
export default app;
