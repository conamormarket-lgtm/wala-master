import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';
import { clearProductCaches } from './products';

// Tras cambiar una categoría se borra la copia del navegador (la tienda la
// pinta al abrir): si no, el admin seguía viendo la vieja en su tienda.
const yLimpiar = async (promesa) => {
  const res = await promesa;
  if (!res?.error) clearProductCaches();
  return res;
};

const COLLECTION = 'tienda_categories';

/**
 * Obtener todas las categorías ordenadas por order
 */
export const getCategories = async () => {
  // IMPORTANTE: NO usar orderBy('order') en la query. En Firestore, orderBy por un
  // campo EXCLUYE silenciosamente los documentos que no tienen ese campo; las
  // categorías creadas sin `order` desaparecían de esta lista (y por ende de los
  // selectores del builder, quedando sus productos con un id de categoría sin
  // nombre). Se leen TODAS y se ordena en memoria (order ?? 9999).
  const res = await getCollection(COLLECTION, []);
  if (res?.data) {
    res.data = [...res.data].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }
  return res;
};

/**
 * Obtener una categoría por ID
 */
export const getCategory = async (id) => {
  return await getDocument(COLLECTION, id);
};

/**
 * Crear categoría (Firestore genera ID)
 * @param {{ name: string, order: number }} data
 */
export const createCategory = async (data) => {
  return yLimpiar(createDocument(COLLECTION, {
    name: data.name || '',
    imageUrl: data.imageUrl || '',
    order: typeof data.order === 'number' ? data.order : 0,
    // Una categoría puede ser compartida por varias marcas (p. ej. "Ropa")
    // sin duplicar documentos ni romper los filtros por categoryId.
    brandIds: Array.isArray(data.brandIds) ? data.brandIds.filter(Boolean) : [],
    // El tipo de producto de la categoría (productTypes): sus productos lo heredan.
    ...(data.productType ? { productType: String(data.productType) } : {}),
  }));
};

/**
 * Actualizar categoría
 * @param {string} id
 * @param {{ name?: string, order?: number }} data
 */
export const updateCategory = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl;
  if (data.order !== undefined) payload.order = data.order;
  if (data.brandIds !== undefined) {
    payload.brandIds = Array.isArray(data.brandIds) ? data.brandIds.filter(Boolean) : [];
  }
  // '' lo quita (updateDocument lo pasa a deleteField).
  if (data.productType !== undefined) payload.productType = data.productType ? String(data.productType) : '';
  return yLimpiar(updateDocument(COLLECTION, id, payload));
};

/**
 * Eliminar categoría
 */
export const deleteCategory = async (id) => {
  return yLimpiar(deleteDocument(COLLECTION, id));
};
