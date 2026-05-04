/**
 * Mensajes en español para códigos de error de Firebase Auth.
 * Usar en Login y Register para mostrar mensajes claros al usuario.
 */
const AUTH_ERROR_MESSAGES = {
  'auth/account-exists-with-different-credential':
    'Este correo ya está registrado con contraseña. Use Iniciar sesión e ingrese su contraseña, o use «Olvidé mi contraseña» si no la recuerda.',
  'auth/email-already-in-use':
    'Este correo ya está registrado. Use Iniciar sesión y elija «Continuar con Google» para entrar con su cuenta.',
  'auth/operation-not-allowed':
    'El inicio de sesión con este método no está habilitado. Contacte al administrador.',
  'auth/popup-closed-by-user': 'Inicio de sesión cancelado.',
  'auth/cancelled-popup-request': 'Inicio de sesión cancelado.',
  'auth/too-many-requests':
    'Demasiados intentos. Pruebe más tarde o restablezca su contraseña.',
  'auth/user-disabled':
    'Esta cuenta ha sido deshabilitada. Contacte al administrador.',
  'auth/invalid-email': 'Correo no válido.',
  'auth/weak-password':
    'La contraseña no cumple los requisitos. Use al menos 8 caracteres, mayúsculas, minúsculas, un número y un carácter especial.',
  'auth/user-not-found':
    'Correo o contraseña incorrectos. Si se registró con Google, use el botón «Iniciar con Google».',
  'auth/wrong-password':
    'Correo o contraseña incorrectos. Si se registró con Google, use el botón «Iniciar con Google».',
  'auth/invalid-credential':
    'Credenciales incorrectas. Si se registró con Google, use el botón «Iniciar con Google».',
  'auth/invalid-login-credentials':
    'Correo o contraseña incorrectos. Si se registró con Google, use el botón «Iniciar con Google».',
};

/**
 * Devuelve el mensaje en español para un errorCode de Firebase Auth,
 * o el mensaje original si no hay traducción.
 */
export function getAuthErrorMessage(errorCode, fallbackMessage) {
  if (errorCode && AUTH_ERROR_MESSAGES[errorCode]) {
    return AUTH_ERROR_MESSAGES[errorCode];
  }
  return fallbackMessage || 'Ha ocurrido un error. Intente de nuevo.';
}
