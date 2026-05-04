import { getCollection, createDocument, getDocument, deleteDocument } from './firebase/firestore';
import { uploadFile, deleteFile } from './firebase/storage';

const COLLECTION = 'fonts';

/**
 * Obtener todas las tipografías personalizadas
 */
export const getFonts = async () => {
  const result = await getCollection(COLLECTION, [], { field: 'name', direction: 'asc' });
  if (result.error) return { data: [], error: result.error };
  return { data: result.data || [], error: null };
};

/**
 * Crear tipografía: subir archivo a Storage y crear documento en Firestore
 * @param {File} file - Archivo .ttf, .otf, .woff, .woff2
 * @param {string} name - Nombre para mostrar en el selector
 * @param {string} [family] - Nombre de familia CSS (font-family). Si no se pasa, se usa name
 */
export const createFont = async (file, name, family = null) => {
  const displayName = (name || file.name || 'Fuente').trim();
  const fontFamily = (family || displayName).trim();

  const path = `fonts/${Date.now()}_${file.name}`;
  const { url, error: uploadError } = await uploadFile(file, path);
  if (uploadError || !url) {
    return { id: null, error: uploadError || 'Error al subir el archivo' };
  }

  const payload = {
    name: displayName,
    family: fontFamily,
    url,
    storagePath: path
  };
  const { id, error } = await createDocument(COLLECTION, payload);
  if (error) return { id: null, error };
  return { id, error: null };
};

/**
 * Eliminar tipografía (documento y archivo en Storage)
 */
export const deleteFont = async (id) => {
  const { data: doc, error: getError } = await getDocument(COLLECTION, id);
  if (getError || !doc) return { error: getError || 'Tipografía no encontrada' };
  if (doc.storagePath) {
    await deleteFile(doc.storagePath);
  }
  return await deleteDocument(COLLECTION, id);
};
