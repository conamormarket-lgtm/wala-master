import { getCollection, getDocument } from './firebase/firestore';

// Las prendas de Crear son documentos del catálogo (ver utils/prendaBase.js)
// con esPrendaBase: se crean y editan en Admin -> Prendas de Crear
// (/admin/prendas-crear), aparte de los productos de la tienda.
const COLLECTION = 'productos_wala';

/** Prendas publicadas para la página Crear (con borradores si lo pide el admin). */
export const getPrendasBase = async ({ incluirBorradores = false } = {}) => {
  const { data, error } = await getCollection(COLLECTION, [
    { field: 'esPrendaBase', operator: '==', value: true },
  ]);
  if (error) return { data: [], error };
  const publicadas = data
    .filter((p) => (incluirBorradores || p.visible !== false) && p.deleted !== true && Array.isArray(p.prendaBase?.vistas) && p.prendaBase.vistas.length > 0)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { data: publicadas, error: null };
};

/** Todas las prendas para el admin: también borradores y las que aún no tienen vistas. */
export const getPrendasBaseAdmin = async () => {
  const { data, error } = await getCollection(COLLECTION, [
    { field: 'esPrendaBase', operator: '==', value: true },
  ]);
  if (error) return { data: [], error };
  return {
    data: data.filter((p) => p.deleted !== true).sort((a, b) => String(a.name).localeCompare(String(b.name))),
    error: null,
  };
};

export const getPrendaBase = async (id) => {
  const { data, error } = await getDocument(COLLECTION, id);
  if (error || !data) return { data: null, error: error || 'No encontrada' };
  return { data: { id, ...data }, error: null };
};
