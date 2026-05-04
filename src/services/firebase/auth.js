import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from 'firebase/auth';
import { auth, getFirebaseConfigMessage } from './config';

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
 * Login con Google
 * Devuelve errorCode y credential (si aplica) para tratar account-exists-with-different-credential.
 */
export const signInWithGoogle = async () => {
  if (!isAuthAvailable()) {
    return { user: null, error: getFirebaseConfigMessage(), errorCode: null, credential: null };
  }
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
