/*
 * ¿El cliente ya vio el reto de esta semana? Para el puntito de aviso de Kapi:
 * sale mientras haya un reto activo sin completar que no abrió ni en la
 * ventana de Kapi ni en Mi cuenta › Misiones. Solo en este navegador (es una
 * comodidad: si se borra, el puntito vuelve a salir una vez).
 */
const clave = (uid) => `wala_reto_visto:${uid || 'anonimo'}`;
export const EVENTO_RETO_VISTO = 'wala:reto-visto';

export function retoVisto(uid, challengeId) {
  if (!challengeId) return true;
  try {
    return window.localStorage.getItem(clave(uid)) === challengeId;
  } catch {
    return true;
  }
}

export function marcarRetoVisto(uid, challengeId) {
  if (!challengeId || retoVisto(uid, challengeId)) return;
  try {
    window.localStorage.setItem(clave(uid), challengeId);
  } catch { /* sin almacenamiento: el aviso sigue */ }
  window.dispatchEvent(new Event(EVENTO_RETO_VISTO));
}
