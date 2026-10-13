import { getCollection, getDocument, createDocument, updateDocument } from './firebase/firestore';
import { clearProductCaches } from './products';

// Combos de Crear ("Pareja", "Trío"...): un doc de productos_wala con
// esComboCrear y su precio de paquete. Cada pieza es una prenda de Crear que
// el cliente diseña por separado. Va oculto de la tienda (visible: false) y
// se ofrece solo en Crear cuando comboCrear.publicado. El servidor lo valida
// en functions/cartValidation.js (validarCombos).
const COLLECTION = 'productos_wala';

export const MIN_PIEZAS = 2;
export const MAX_PIEZAS = 4;

const piezasDe = (combo) => (Array.isArray(combo?.comboCrear?.piezas) ? combo.comboCrear.piezas : [])
  .filter((p) => p && p.prendaId);

/** El combo listo para la página: piezas limpias y si se puede comprar. */
export const leerCombo = (doc) => ({
  ...doc,
  piezas: piezasDe(doc),
  publicado: doc?.comboCrear?.publicado === true,
});

export const getCombosCrear = async ({ incluirBorradores = false } = {}) => {
  const { data, error } = await getCollection(COLLECTION, [
    { field: 'esComboCrear', operator: '==', value: true },
  ]);
  if (error) return { data: [], error };
  const combos = data
    .map(leerCombo)
    .filter((c) => c.deleted !== true && c.piezas.length >= MIN_PIEZAS && (incluirBorradores || c.publicado))
    .sort((a, b) => a.piezas.length - b.piezas.length || String(a.name).localeCompare(String(b.name)));
  return { data: combos, error: null };
};

export const getComboCrear = async (id) => {
  const { data, error } = await getDocument(COLLECTION, id);
  if (error || !data || data.esComboCrear !== true) return { data: null, error: error || 'No encontrado' };
  return { data: leerCombo({ id, ...data }), error: null };
};

/** Crea o actualiza un combo desde el admin. Devuelve su id. */
export const guardarComboCrear = async (id, form) => {
  const datos = {
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    price: Number(form.price) || 0,
    // Sin oferta = sin campo: para el servidor un salePrice de 0 es un precio de S/ 0.
    salePrice: Number(form.salePrice) > 0 ? Number(form.salePrice) : null,
    mainImage: String(form.mainImage || '').trim(),
    esComboCrear: true,
    // Nunca en los listados de la tienda: se arma en /combo/:id.
    visible: false,
    comboCrear: {
      publicado: form.publicado === true,
      piezas: (form.piezas || []).filter((p) => p?.prendaId).map((p) => ({ prendaId: p.prendaId })),
    },
  };
  const res = id
    ? await updateDocument(COLLECTION, id, datos)
    : await createDocument(COLLECTION, { ...datos, createdAtMs: Date.now() });
  if (res.error) throw new Error(res.error);
  clearProductCaches();
  return id || res.id;
};

/** Archiva el combo: deja de ofrecerse, pero los pedidos que lo usan siguen igual. */
export const archivarComboCrear = async (id) => {
  const res = await updateDocument(COLLECTION, id, { deleted: true, 'comboCrear.publicado': false });
  if (res.error) throw new Error(res.error);
  clearProductCaches();
};
