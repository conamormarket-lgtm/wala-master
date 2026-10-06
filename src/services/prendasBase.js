import { getCollection, getDocument, createDocument, updateDocument } from './firebase/firestore';
import { clearProductCaches } from './products';
import { leerPrendaBase, precioBase } from '../utils/prendaBase';

// Mismo lugar que el resto del catálogo: ver el comentario de utils/prendaBase.js.
const COLLECTION = 'productos_wala';

const ordenar = (lista) =>
  [...lista].sort((a, b) => (a.ordenCrear ?? 999) - (b.ordenCrear ?? 999) || String(a.name).localeCompare(String(b.name)));

/** Prendas publicadas para la página Crear. */
export const getPrendasBase = async () => {
  const { data, error } = await getCollection(COLLECTION, [
    { field: 'esPrendaBase', operator: '==', value: true },
  ]);
  if (error) return { data: [], error };
  const publicadas = data.filter((p) => p.visible !== false && p.deleted !== true);
  return { data: ordenar(publicadas), error: null };
};

/** Todas las prendas (también borradores), para el admin. */
export const getPrendasBaseAdmin = async () => {
  const { data, error } = await getCollection(COLLECTION, [
    { field: 'esPrendaBase', operator: '==', value: true },
  ]);
  if (error) return { data: [], error };
  return { data: ordenar(data.filter((p) => p.deleted !== true)), error: null };
};

export const getPrendaBase = async (id) => {
  const { data, error } = await getDocument(COLLECTION, id);
  if (error || !data) return { data: null, error: error || 'No encontrada' };
  return { data: { id, ...data }, error: null };
};

/**
 * Arma el documento de producto a partir del formulario del admin. Además de
 * `prendaBase` rellena los campos que el resto de la app lee de un producto
 * (mainImage, images, mainSizes, inStock...) para que carrito, checkout,
 * "Mis compras" y el ERP muestren la prenda sin conocer este formato.
 */
const armarDocumento = (form) => {
  const cfg = leerPrendaBase(form);
  const portada = cfg.vistas[0]?.imagen || '';
  const price = Math.max(0, Number(form.price) || 0);
  return {
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    price,
    salePrice: null,
    visible: form.visible === true,
    esPrendaBase: true,
    customizable: false,
    hasVariants: false,
    isComboProduct: false,
    mainImage: portada,
    images: portada ? [portada] : [],
    mainSizes: cfg.tallas,
    ordenCrear: Number.isFinite(Number(form.ordenCrear)) ? Number(form.ordenCrear) : 999,
    prendaBase: {
      tallas: cfg.tallas,
      colores: cfg.colores,
      vistas: cfg.vistas,
    },
  };
};

export const guardarPrendaBase = async (id, form) => {
  const documento = armarDocumento(form);
  if (!documento.name) return { id: null, error: 'Ponle un nombre a la prenda.' };
  if (!documento.prendaBase.vistas.length) return { id: null, error: 'Agrega al menos una vista con su foto.' };
  if (documento.prendaBase.vistas.some((v) => !v.imagen)) return { id: null, error: 'Cada vista necesita su foto.' };
  if (documento.visible && !(precioBase(documento) > 0)) {
    return { id: null, error: 'Define el precio antes de publicar la prenda.' };
  }

  const result = id
    ? await updateDocument(COLLECTION, id, documento)
    : await createDocument(COLLECTION, { ...documento, createdAtMs: Date.now() });
  if (result.error) return { id: null, error: result.error };
  clearProductCaches();
  return { id: id || result.id, error: null };
};

/** Borrado lógico: igual que el resto del catálogo (el historial lo sigue leyendo). */
export const eliminarPrendaBase = async (id) => {
  const result = await updateDocument(COLLECTION, id, { deleted: true, visible: false });
  if (!result.error) clearProductCaches();
  return result;
};
