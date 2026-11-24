/*
 * "Borrar mi cuenta" (Mi cuenta › Ajustes): todo lo hace el servidor
 * (functions: eliminarCuentaSecure; qué se borra y qué se conserva, en
 * functions/eliminarCuentaLogic.js). La app móvil llama a la misma función.
 *   - revisarBorrado() → [{ tipo, texto }] lo que impide borrar (vacío: se puede)
 *   - confirmarBorrado() → borra; exige haber entrado hace menos de 5 minutos
 */
import { getFunctions, httpsCallable } from 'firebase/functions';

const llamar = (datos) => httpsCallable(getFunctions(), 'eliminarCuentaSecure', { timeout: 540000 })(datos);

export async function revisarBorrado() {
  const { data } = await llamar({ revisar: true });
  return Array.isArray(data?.pendientes) ? data.pendientes : [];
}

/**
 * Lanza el error de la función tal cual: `details.motivo` dice si hay que
 * volver a entrar ('reautenticar') o resolver algo ('pendientes', con
 * `details.pendientes`).
 */
export async function confirmarBorrado() {
  const { data } = await llamar({ confirmar: true });
  return data?.eliminada === true;
}

/** El texto para el cliente de un error de la función (los nuestros ya vienen en español). */
export function mensajeDeErrorBorrado(error) {
  const codigo = String(error?.code || '').replace(/^functions\//, '');
  if (['failed-precondition', 'unauthenticated', 'invalid-argument', 'deadline-exceeded', 'unavailable'].includes(codigo) && error?.message) {
    return error.message;
  }
  return 'Algo falló de nuestro lado. Revisa tu conexión y vuelve a intentarlo.';
}
