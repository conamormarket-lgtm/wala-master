import { getDocument, setDocument } from './firebase/firestore';

const COLLECTION = 'messages';

/**
 * Obtener un mensaje por clave
 * @param {string} key - Clave del mensaje (ej. store_title, store_subtitle)
 * @returns {{ data: string|null, error: string|null }}
 */
export const getMessage = async (key) => {
  const { data, error } = await getDocument(COLLECTION, key);
  if (error && error !== 'Documento no encontrado') {
    return { data: null, error };
  }
  return { data: data?.value ?? null, error: null };
};

/**
 * Guardar un mensaje por clave
 * @param {string} key - Clave del mensaje
 * @param {string} value - Valor a guardar
 * @returns {{ error: string|null }}
 */
export const setMessage = async (key, value) => {
  return await setDocument(COLLECTION, key, { value: value ?? '' });
};
