import { useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadFile } from '../../services/firebase/storage';

/*
 * Lo que comparten los conectores del panel (src/components/panel/): los
 * servicios de la tienda devuelven { data, error }; las páginas del kit
 * esperan promesas que fallan con un Error (así muestran el motivo).
 */

/** { data, error } → data, o lanza el error (el texto que dio el servicio). */
export async function sinError(promesa) {
  const r = await promesa;
  if (r?.error) throw new Error(typeof r.error === 'string' ? r.error : r.error.message || 'No se pudo guardar.');
  return r?.data;
}

/** useQuery sobre un servicio { data, error }; `cargando`, `error` y `onReintentar` para las páginas. */
export function useLectura(queryKey, servicio, opciones = {}) {
  const q = useQuery({ queryKey, queryFn: () => sinError(servicio()), ...opciones });
  return {
    datos: q.data,
    cargando: q.isLoading,
    error: q.error ? q.error.message || 'No se pudo cargar.' : undefined,
    onReintentar: () => q.refetch(),
  };
}

/** Invalida varias claves de una vez (las del admin y las de la tienda). */
export function useInvalidar() {
  const queryClient = useQueryClient();
  return (...claves) => Promise.all(claves.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/**
 * subirImagen(blob, { alAvanzar }) para CampoImagen: sube a `carpeta/` con el
 * mismo uploadFile de las páginas de antes (con sus copias chicas) y devuelve
 * la url. uploadFile no da el avance: se marca al empezar y al terminar.
 */
export const subirA = (carpeta, nombre = 'imagen') => async (blob, { alAvanzar } = {}) => {
  alAvanzar?.(10);
  const tipo = blob?.type || 'image/jpeg';
  const extension = tipo.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const archivo = blob instanceof File ? blob : new File([blob], `${nombre}.${extension}`, { type: tipo });
  const { url, error } = await uploadFile(archivo, `${carpeta}/${Date.now()}_${nombre}.${extension}`);
  if (error || !url) throw new Error(typeof error === 'string' ? error : 'No se pudo subir la imagen.');
  alAvanzar?.(100);
  return url;
};
