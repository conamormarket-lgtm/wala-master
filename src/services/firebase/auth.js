import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from 'firebase/auth';
import { auth, getFirebaseConfigMessage } from './config';

// Detecta si la app está corriendo dentro de un runtime nativo de Capacitor (Android/iOS)
// window.Capacitor es inyectado automáticamente por el bridge de Capacitor en el WebView nativo.
const isNativePlatform = () =>
  typeof window !== 'undefined' &&
  window.Capacitor &&
  window.Capacitor.isNativePlatform?.();

const googleProvider = new GoogleAuthProvider();

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
 * - En navegador web: usa signInWithPopup como siempre.
 */
export const signInWithGoogle = async () => {
  if (!isAuthAvailable()) {
    return { user: null, error: getFirebaseConfigMessage(), errorCode: null, credential: null };
  }

  // ── Plataforma nativa (Android / iOS) ────────────────────────────────────
  if (isNativePlatform()) {
    try {
      const { GoogleAuth } = await import(/* webpackIgnore: true */ '@codetrix-studio/capacitor-google-auth');
      await GoogleAuth.initialize({
        clientId: '572322137024-0bl118c7mnuglq3fbnbdlhv5kg36dp9a.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication.idToken;
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
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
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null, errorCode: null, credential: null };
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
        const { GoogleAuth } = await import(/* webpackIgnore: true */ '@codetrix-studio/capacitor-google-auth');
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

