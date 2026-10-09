/**
 * Diseños de la comunidad (functions/comunidad.js).
 *
 * Todo pasa por Cloud Functions: la galería se ve sin iniciar sesión y no
 * depende de las reglas de Firestore; publicar y retirar comprueban en el
 * servidor que quien llama es admin.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';

const llamar = (nombre, datos) => httpsCallable(getFunctions(), nombre)(datos);

const mensaje = (e, porDefecto) => {
  const code = String(e?.code || '');
  if (code.includes('internal') || code.includes('unavailable')) return porDefecto;
  return e?.message || porDefecto;
};

/** Diseños publicados (sin capas), destacados primero. */
export async function listarComunidad() {
  const { data } = await llamar('listarComunidad', {});
  return Array.isArray(data?.disenos) ? data.disenos : [];
}

/** Un diseño publicado con sus capas (para abrirlo en el estudio), o null. */
export async function obtenerDisenoComunidad(id) {
  const { data } = await llamar('obtenerDisenoComunidad', { id });
  return data?.diseno || null;
}

/** Admin: publica una creación suya, o actualiza su publicación. */
export async function publicarEnComunidad(designId) {
  try {
    const { data } = await llamar('publicarEnComunidad', { designId });
    return { error: null, actualizada: data?.actualizada === true };
  } catch (e) {
    return { error: mensaje(e, 'No se pudo publicar. Inténtalo de nuevo.') };
  }
}

/** Admin: la quita de la galería (las creaciones hechas con ella siguen bien). */
export async function retirarDeComunidad(designId) {
  try {
    await llamar('retirarDeComunidad', { designId });
    return { error: null };
  } catch (e) {
    return { error: mensaje(e, 'No se pudo retirar. Inténtalo de nuevo.') };
  }
}

/** +1 uso del diseño (una vez por cuenta). Silencioso: es solo un contador. */
export function registrarUsoComunidad(id) {
  return llamar('registrarUsoComunidad', { id }).catch(() => {});
}
