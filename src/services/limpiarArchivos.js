import { getCollection } from './firebase/firestore';
import { obtenerStorage } from './firebase/config';
import { urlsDeDiseno } from './designs';

// Aparte de designs.js (que va en el archivo principal): solo lo usa el estudio.
/**
 * Borra de Storage los archivos que una creación dejó de usar al volver a
 * guardarse (cada guardado sube imágenes nuevas; las de antes quedaban para
 * siempre). Solo de su carpeta (designs/{uid}/), y nunca uno que use otra de
 * sus creaciones (las copias de un combo comparten imágenes) o que aparezca en
 * `enUso` (el carrito, que guarda las URLs de cuando se agregó). Si algo
 * falla no pasa nada: el archivo solo queda huérfano. Devuelve cuántos borró.
 */
export const limpiarArchivosSobrantes = async (userId, urls, { enUso = '' } = {}) => {
  const candidatas = [...new Set((urls || []).filter((u) => typeof u === 'string' && /^https?:/i.test(u)))]
    .filter((u) => !enUso.includes(u));
  if (!userId || !candidatas.length) return 0;
  const { data: todas, error } = await getCollection('designs', [{ field: 'userId', operator: '==', value: userId }]);
  if (error || !todas) return 0;
  const usadas = new Set();
  todas.forEach((d) => urlsDeDiseno(d).forEach((u) => usadas.add(u)));
  const libres = candidatas.filter((u) => !usadas.has(u));
  if (!libres.length) return 0;
  const storage = await obtenerStorage();
  if (!storage) return 0;
  const { ref, deleteObject } = await import('firebase/storage');
  let borrados = 0;
  await Promise.all(libres.map(async (url) => {
    try {
      const archivo = ref(storage, url);
      if (!archivo.fullPath.startsWith(`designs/${userId}/`)) return;
      await deleteObject(archivo);
      borrados += 1;
    } catch { /* ya no existe o no es de Storage */ }
  }));
  return borrados;
};
