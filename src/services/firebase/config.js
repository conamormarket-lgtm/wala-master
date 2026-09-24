import { initializeApp } from 'firebase/app';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import { initializeFirestore, persistentLocalCache, getFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
} from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Ocultar los diagnósticos de Firestore en producción.
if (import.meta.env.PROD) setLogLevel('silent');

// Verificar si Firebase está configurado
const isFirebaseConfigured = () => {
  const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;
  return apiKey &&
    apiKey !== 'your-api-key-here' &&
    apiKey !== '' &&
    process.env.REACT_APP_FIREBASE_PROJECT_ID &&
    process.env.REACT_APP_FIREBASE_PROJECT_ID !== 'your-project-id';
};

/**
 * Arranca Firebase Auth SIN el resolvedor de popup/redirect.
 *
 * getAuth() lo trae de serie, y ese resolvedor carga en el arranque el iframe
 * de Google (https://apis.google.com/js/api.js) para comprobar si vuelves de un
 * inicio de sesión por redirección. Si ese script no llega —lo bloquean
 * extensiones de privacidad, la prevención de seguimiento del navegador o un
 * filtro de red— Firebase se queda esperándolo y NUNCA avisa de quién ha
 * entrado. Y como Firestore no envía nada hasta saber con qué credencial ir,
 * detrás se cuelga TODA la app: la sesión no aparece y las lecturas se quedan
 * colgadas hasta agotar su tope (se ven en consola como "Firestore timeout"
 * once seguidas, que fue justo el síntoma).
 *
 * Sin resolvedor, la sesión se restaura solo de lo guardado en el navegador,
 * que es lo único que hace falta para saber quién entra. La lista de
 * persistencia es la MISMA que usa getAuth() (IndexedDB y, si no, el
 * almacenamiento local), así que nadie pierde su sesión por este cambio.
 *
 * El resolvedor sigue haciendo falta para entrar con Google, pero ahí se pasa a
 * mano en signInWithPopup (services/firebase/auth.js): así el iframe se carga
 * cuando alguien pulsa el botón, no en cada visita.
 */
const arrancarAuth = (instancia) => {
  try {
    return initializeAuth(instancia, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch (e) {
    // Ya inicializado (recarga en caliente, doble import): vale el de siempre.
    return getAuth(instancia);
  }
};

let app = null;
let db = null;
let auth = null;

// En DEV usamos emuladores por defecto. También en preview local
// (vite build --mode preview o VITE_USE_EMULATORS=true).
export const USE_EMULATORS =
  import.meta.env.VITE_USE_EMULATORS === 'true'
  || import.meta.env.MODE === 'preview'
  || (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false');

if (USE_EMULATORS) {
  try {
    // storageBucket hace falta aunque sea un emulador: sin el, cualquier ref()
    // de Storage falla con 'storage/no-default-bucket' y no habia forma de
    // probar una subida en local. El nombre no se resuelve contra Google, solo
    // le da un bucket por defecto al SDK para hablar con el emulador.
    app = initializeApp({
      projectId: 'demo-wala',
      apiKey: 'demo-emulator',
      authDomain: 'localhost',
      storageBucket: 'demo-wala.appspot.com',
    });
    try {
      // Long polling evita cuelgues del WebChannel en Windows + emulador.
      db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    } catch {
      db = getFirestore(app);
    }
    auth = arrancarAuth(app);
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
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
      auth = arrancarAuth(app);
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

/**
 * Storage BAJO DEMANDA.
 *
 * Antes se hacia `getStorage(app)` aqui mismo, al cargar el modulo, con lo que
 * el SDK de Firebase Storage entraba en el bundle de arranque de cualquier
 * visita. Pero Storage solo hace falta para SUBIR archivos (panel de admin,
 * avatares, reseñas): para ver la tienda no se usa nunca — las imagenes se
 * piden por URL normal, sin SDK.
 *
 * Devuelve null si Firebase no esta configurado, igual que hacia el export
 * anterior, para que quien llame siga pudiendo comprobarlo.
 */
let storagePromesa = null;

export const obtenerStorage = () => {
  if (!app) return Promise.resolve(null);
  if (!storagePromesa) {
    storagePromesa = import('firebase/storage')
      .then(async ({ getStorage, connectStorageEmulator }) => {
        const s = getStorage(app);
        if (USE_EMULATORS) {
          try { connectStorageEmulator(s, 'localhost', 9199); } catch (e) { /* ya conectado */ }
        }
        return s;
      })
      .catch((e) => {
        console.warn('Firebase Storage no disponible:', e?.message || e);
        storagePromesa = null;
        return null;
      });
  }
  return storagePromesa;
};

/**
 * Messaging BAJO DEMANDA.
 *
 * Antes se llamaba a isSupported() + getMessaging(app) al cargar el modulo, o
 * sea en CADA arranque, cuando las notificaciones push solo hacen falta si la
 * persona acepta el permiso — y el permiso se pide mas tarde, con la sesion ya
 * iniciada. Devuelve null si el navegador no lo soporta.
 */
let messagingPromesa = null;

export const obtenerMessaging = () => {
  if (!app) return Promise.resolve(null);
  if (!messagingPromesa) {
    messagingPromesa = import('firebase/messaging')
      .then(async ({ getMessaging, isSupported }) => {
        if (!(await isSupported())) {
          console.warn('Firebase Messaging no está soportado en este navegador.');
          return null;
        }
        return getMessaging(app);
      })
      .catch((e) => {
        console.warn('Firebase Messaging no disponible:', e?.message || e);
        messagingPromesa = null;
        return null;
      });
  }
  return messagingPromesa;
};

export { db, auth, getFirebaseConfigMessage };
export default app;
