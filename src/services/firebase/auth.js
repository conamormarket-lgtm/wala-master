import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from 'firebase/auth';
import { auth, getFirebaseConfigMessage } from './config';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// Detecta si la app está corriendo dentro de un runtime nativo de Capacitor (Android/iOS)
// window.Capacitor es inyectado automáticamente por el bridge de Capacitor en el WebView nativo.
const isNativePlatform = () =>
  typeof window !== 'undefined' &&
  window.Capacitor &&
  window.Capacitor.isNativePlatform?.();

const googleProvider = new GoogleAuthProvider();
// Pedimos (durante el login) permiso para LEER la fecha de nacimiento vía Google
// People API (gratis). Es un scope "sensible": para producción Google exige
// verificar la app; si no, sale aviso de "app no verificada". El cumpleaños es
// OPCIONAL: si no se concede o no existe, el flujo sigue y se pide manualmente.
googleProvider.addScope('https://www.googleapis.com/auth/user.birthday.read');

// Lee el cumpleaños desde la People API (gratis) con el accessToken de Google.
// Devuelve 'YYYY-MM-DD' o null. Tolerante a fallos: nunca lanza (el cumpleaños es
// un extra; jamás debe romper el inicio de sesión).
const fetchGoogleBirthday = async (accessToken) => {
  if (!accessToken) return null;
  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=birthdays',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const bdays = Array.isArray(data.birthdays) ? data.birthdays : [];
    const conFecha = (b) => b?.date?.year && b?.date?.month && b?.date?.day;
    // Preferir la del tipo ACCOUNT (la real de la cuenta) con año/mes/día completos.
    const pick =
      bdays.find((b) => conFecha(b) && b?.metadata?.source?.type === 'ACCOUNT') ||
      bdays.find(conFecha);
    if (!pick) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pick.date.year}-${pad(pick.date.month)}-${pad(pick.date.day)}`;
  } catch (_) {
    return null;
  }
};

// Guarda (best-effort) el cumpleaños de Google en localStorage para precargarlo
// luego en "completar perfil". Silencioso ante cualquier error.
const guardarCumpleGoogle = async (accessToken) => {
  try {
    const bday = await fetchGoogleBirthday(accessToken);
    if (bday && typeof localStorage !== 'undefined') {
      localStorage.setItem('wala_google_birthday', bday);
    }
  } catch (_) { /* el cumpleaños es opcional */ }
};

// Verificar si Firebase Auth está disponible
const isAuthAvailable = () => {
  return auth !== null;
};

/**
 * Registro con email y contraseña
 */
export const signUpWithEmail = async (email, password, displayName) => {
  if (!isAuthAvailable()) {
    return { user: null, error: getFirebaseConfigMessage(), errorCode: null };
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    return { user: userCredential.user, error: null, errorCode: null };
  } catch (error) {
    return { user: null, error: error.message, errorCode: error.code || null };
  }
};

/**
 * Login con email y contraseña
 */
export const signInWithEmail = async (email, password) => {
  if (!isAuthAvailable()) {
    return { user: null, error: getFirebaseConfigMessage(), errorCode: null };
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null, errorCode: null };
  } catch (error) {
    return { user: null, error: error.message, errorCode: error.code || null };
  }
};

/**
 * Login con Google.
 * - En Android/iOS nativo (Capacitor): usa el plugin @codetrix-studio/capacitor-google-auth
 *   que abre el selector de cuentas nativo de Google (sin popup ni WebView en blanco).
 * - En navegador web: signInWithRedirect (antes signInWithPopup). El popup lo
 *   crea y posiciona internamente el SDK de Firebase — no hay forma de ajustar
 *   su posición/tamaño desde nuestro código, y en algunos navegadores/monitores
 *   aparecía chico en una esquina en vez de centrado. Redirect navega la
 *   pestaña entera a Google y vuelve — sin ventana emergente, no hay nada que
 *   "posicionar mal". El resultado se recoge al volver con
 *   consumeGoogleRedirectResult() (ver más abajo), no acá: esta función solo
 *   DISPARA la redirección, la página se descarga antes de que su propio
 *   return llegue a usarse.
 */
export const signInWithGoogle = async () => {
  if (!isAuthAvailable()) {
    return { user: null, error: getFirebaseConfigMessage(), errorCode: null, credential: null };
  }

  // ── Plataforma nativa (Android / iOS) ────────────────────────────────────
  if (isNativePlatform()) {
    try {
      await GoogleAuth.initialize({
        clientId: '572322137024-0bl118c7mnuglq3fbnbdlhv5kg36dp9a.apps.googleusercontent.com',
        // Añadimos el scope de cumpleaños (People API) para paridad con el login web
        // y poder importar el cumpleaños en móvil. Es OPCIONAL y tolerante: si no se
        // concede, el flujo de login sigue igual (el cumpleaños se pide manualmente).
        scopes: ['profile', 'email', 'https://www.googleapis.com/auth/user.birthday.read'],
        grantOfflineAccess: true,
      });
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication.idToken;
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      // Best-effort: cumpleaños desde People API con el accessToken nativo.
      try { await guardarCumpleGoogle(googleUser.authentication?.accessToken); } catch (_) {}
      return { user: result.user, error: null, errorCode: null, credential: null };
    } catch (error) {
      // El usuario canceló el selector de cuentas — no es un error real
      if (error.error === 'popup_closed_by_user' || error.message === 'The user canceled the sign-in flow.') {
        return { user: null, error: null, errorCode: 'auth/cancelled', credential: null };
      }
      return {
        user: null,
        error: error.message || 'Error al iniciar sesión con Google',
        errorCode: error.code || null,
        credential: null,
      };
    }
  }

  // ── Navegador web ─────────────────────────────────────────────────────────
  try {
    // El resolvedor va explícito porque la instancia de auth se crea sin él
    // (ver arrancarAuth en firebase/config.js): así el iframe/redirect de
    // Google se prepara aquí, al pulsar el botón, y no en el arranque de cada
    // visita. signInWithRedirect navega la pestaña — esta llamada casi nunca
    // llega a resolver desde el punto de vista de quien la esperó (la página
    // se descarga antes); solo puede rechazar si falla ANTES de redirigir
    // (config inválida, red caída, etc.).
    await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
    return { user: null, error: null, errorCode: null, credential: null };
  } catch (error) {
    const credential = error.credential || null;
    return {
      user: null,
      error: error.message,
      errorCode: error.code || null,
      credential
    };
  }
};

/**
 * Recoge el resultado de un signInWithGoogle() (web) que redirigió a Google y
 * volvió. Se llama UNA vez al cargar la página que disparó el login (Login/
 * Registro/el modal de suscripción) — ver el patrón sessionStorage en cada
 * una: solo actúan si SU PROPIO marcador está guardado, así este mismo
 * `getRedirectResult()` (compartido, cualquiera puede llamarlo) no dispara la
 * navegación de una página distinta a la que inició el redirect.
 *
 * Sin resultado pendiente (visita normal, no volviendo de Google) devuelve
 * user:null sin error — no es un fallo, es el caso normal.
 */
export const consumeGoogleRedirectResult = async () => {
  if (!isAuthAvailable()) {
    return { user: null, error: null, errorCode: null };
  }
  try {
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    if (!result) {
      return { user: null, error: null, errorCode: null };
    }
    // Best-effort: igual que en el popup, leer el cumpleaños desde la People
    // API (gratis) y guardarlo para precargarlo en "completar perfil". Nunca
    // rompe el login.
    try {
      const accessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
      await guardarCumpleGoogle(accessToken);
    } catch (_) { /* el cumpleaños es opcional */ }
    return { user: result.user, error: null, errorCode: null };
  } catch (error) {
    return { user: null, error: error.message, errorCode: error.code || null };
  }
};

/**
 * Cerrar sesión
 */
export const logout = async () => {
  if (!isAuthAvailable()) {
    return { error: null };
  }
  try {
    // Si es plataforma nativa, también cerrar sesión del plugin de Google
    if (isNativePlatform()) {
      try {
        await GoogleAuth.signOut();
      } catch (_) {
        // Ignorar error si el plugin no estaba activo
      }
    }
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Observador de cambios de autenticación
 */
export const onAuthChange = (callback) => {
  if (!isAuthAvailable()) {
    // Si Firebase no está disponible, llamar callback con null inmediatamente
    callback(null);
    return () => {}; // Retornar función de limpieza vacía
  }
  return onAuthStateChanged(auth, callback);
};

/**
 * Obtener usuario actual
 */
export const getCurrentUser = () => {
  if (!isAuthAvailable()) {
    return null;
  }
  return auth.currentUser;
};

/**
 * Envía un correo para restablecer la contraseña.
 * Siempre devuelve éxito en la UI para no revelar si el correo existe.
 */
export const sendPasswordResetEmail = async (email) => {
  if (!isAuthAvailable()) {
    return { error: getFirebaseConfigMessage(), errorCode: null };
  }
  try {
    await firebaseSendPasswordResetEmail(auth, email);
    return { error: null, errorCode: null };
  } catch (error) {
    return { error: error.message, errorCode: error.code || null };
  }
};

