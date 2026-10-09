/**
 * Mensajes en español para códigos de error de Firebase Auth.
 * Usar en Login, Registro y Recuperar contraseña para mostrar mensajes claros.
 * Tono: tuteo, igual que el resto de la tienda.
 */
const CREDENCIALES_INCORRECTAS =
  'Correo o contraseña incorrectos. Si te registraste con Google, usa «Iniciar con Google».';

const ERROR_GENERICO = 'Ha ocurrido un error. Inténtalo de nuevo.';

const AUTH_ERROR_MESSAGES = {
  'auth/account-exists-with-different-credential':
    'Este correo ya tiene una cuenta con contraseña. Inicia sesión con tu contraseña o usa «¿Olvidaste tu contraseña?».',
  'auth/email-already-in-use':
    'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.',
  'auth/operation-not-allowed':
    'Este método de inicio de sesión no está disponible. Escríbenos y te ayudamos.',
  'auth/popup-closed-by-user': 'Inicio de sesión cancelado.',
  'auth/cancelled-popup-request': 'Inicio de sesión cancelado.',
  'auth/popup-blocked':
    'Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes para wala.pe e inténtalo de nuevo.',
  'auth/too-many-requests':
    'Demasiados intentos. Espera unos minutos o restablece tu contraseña.',
  'auth/user-disabled':
    'Esta cuenta está deshabilitada. Escríbenos y te ayudamos.',
  'auth/invalid-email': 'Ese correo no es válido. Revísalo e inténtalo de nuevo.',
  'auth/missing-email': 'Ingresa tu correo electrónico.',
  'auth/missing-password': 'Ingresa tu contraseña.',
  'auth/weak-password':
    'La contraseña no cumple los requisitos: al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
  // Lo devuelve Firebase cuando está activa la política de contraseñas del
  // proyecto y la contraseña no la cumple (aunque se salte el formulario).
  'auth/password-does-not-meet-requirements':
    'La contraseña no cumple los requisitos: al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
  'auth/user-not-found': CREDENCIALES_INCORRECTAS,
  'auth/wrong-password': CREDENCIALES_INCORRECTAS,
  'auth/invalid-credential': CREDENCIALES_INCORRECTAS,
  'auth/invalid-login-credentials': CREDENCIALES_INCORRECTAS,
  'auth/network-request-failed':
    'No se pudo conectar. Revisa tu conexión a internet e inténtalo de nuevo.',
  'auth/requires-recent-login':
    'Por seguridad, vuelve a iniciar sesión para completar esta acción.',
  'auth/user-token-expired':
    'Tu sesión expiró. Vuelve a iniciar sesión.',
  'auth/web-storage-unsupported':
    'Tu navegador está bloqueando el almacenamiento que necesita el inicio de sesión. Sal del modo privado o prueba con otro navegador.',
  'auth/unauthorized-domain':
    'No se puede iniciar sesión desde esta dirección. Entra desde wala.pe.',
  'auth/internal-error': ERROR_GENERICO,
};

/**
 * Devuelve el mensaje en español para un errorCode de Firebase Auth.
 *
 * Nunca muestra el texto crudo de Firebase ("Firebase: Error (auth/…)."): está
 * en inglés y con jerga técnica. Si el código no está traducido se usa un
 * mensaje genérico y el detalle va a la consola para poder depurarlo.
 * El `fallbackMessage` solo se muestra cuando NO viene de Firebase (p. ej. el
 * aviso de configuración de getFirebaseConfigMessage).
 */
export function getAuthErrorMessage(errorCode, fallbackMessage) {
  if (errorCode && AUTH_ERROR_MESSAGES[errorCode]) {
    return AUTH_ERROR_MESSAGES[errorCode];
  }
  const esTextoDeFirebase = /firebase|auth\//i.test(String(fallbackMessage || ''));
  if (errorCode || esTextoDeFirebase) {
    console.warn('[Auth] Error sin traducir:', errorCode, fallbackMessage);
    return ERROR_GENERICO;
  }
  return fallbackMessage || ERROR_GENERICO;
}
