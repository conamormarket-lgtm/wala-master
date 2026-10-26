import { getCollection, getDocument, createDocument, updateDocument } from './firebase/firestore';
import { clearProductCaches } from './products';
import { productoConYoryo, YORYO_PACK_ID } from '../utils/yoryoPersonalizacion.mjs';

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

// Tallas del combo, elegidas en el admin: 'una' (una talla para todas),
// 'porPrenda' (cada prenda la suya) o 'auto' (sin elegir: un conjunto de
// prendas distintas lleva una; una pareja o un trío de la misma, una por prenda).
export const MODOS_TALLA = ['auto', 'una', 'porPrenda'];

/** El combo listo para la página: piezas limpias, si se puede comprar y cómo se eligen las tallas. */
export const leerCombo = (doc) => ({
  ...doc,
  piezas: piezasDe(doc),
  publicado: doc?.comboCrear?.publicado === true,
  tallas: MODOS_TALLA.includes(doc?.comboCrear?.tallas) ? doc.comboCrear.tallas : 'auto',
});

export const getCombosCrear = async ({ incluirBorradores = false } = {}) => {
  const { data, error } = await getCollection(COLLECTION, [
    { field: 'esComboCrear', operator: '==', value: true },
  ]);
  if (error) return { data: [], error };
  const pack = await getDocument(COLLECTION, YORYO_PACK_ID);
  const lista = pack.data && !data.some((p) => p.id === YORYO_PACK_ID) ? [...data, { ...pack.data, id: YORYO_PACK_ID }] : data;
  const combos = lista.map(productoConYoryo)
    .map(leerCombo)
    .filter((c) => c.deleted !== true && c.piezas.length >= MIN_PIEZAS && (incluirBorradores || c.publicado))
    .sort((a, b) => a.piezas.length - b.piezas.length || String(a.name).localeCompare(String(b.name)));
  return { data: combos, error: null };
};

export const getComboCrear = async (id) => {
  const { data, error } = await getDocument(COLLECTION, id);
  // Un fallo de red no es "no existe": se distingue para poder reintentar.
  if (error) return { data: null, error, noEncontrado: false };
  const producto = data && productoConYoryo({ ...data, id });
  if (!producto || producto.esComboCrear !== true && id !== YORYO_PACK_ID) return { data: null, error: 'No encontrado', noEncontrado: true };
  return { data: leerCombo(producto), error: null };
};

/** Crea o actualiza un combo desde el admin. Devuelve su id. */
export const guardarComboCrear = async (id, form) => {
  const anterior = id === YORYO_PACK_ID ? await getDocument(COLLECTION, id) : null;
  const datos = {
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    price: Number(form.price) || 0,
    // Sin oferta = sin campo: para el servidor un salePrice de 0 es un precio de S/ 0.
    salePrice: Number(form.salePrice) > 0 ? Number(form.salePrice) : null,
    mainImage: String(form.mainImage || '').trim(),
    esComboCrear: true,
    // Nunca en los listados de la tienda: se arma en /combo/:id.
    visible: id === YORYO_PACK_ID ? anterior?.data?.visible !== false : false,
    comboCrear: {
      publicado: form.publicado === true,
      piezas: (form.piezas || []).filter((p) => p?.prendaId).map((p) => ({ prendaId: p.prendaId })),
      tallas: MODOS_TALLA.includes(form.tallas) ? form.tallas : 'auto',
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

// Descuento sugerido por cantidad de prendas (el admin lo cambia antes de crear).
export const DESCUENTO_SUGERIDO = { 2: 0.1, 3: 0.15 };

const firmaPiezas = (piezas) => piezas.map((p) => p.prendaId).sort().join('|');

/**
 * Combos que se pueden armar con las prendas de Crear: pareja y trío de cada
 * una, con un precio sugerido (suma de las sueltas con descuento, redondeado
 * hacia abajo de 5 en 5). Deja fuera los que ya existen con esas prendas.
 */
export const sugerirCombos = (prendas, existentes = [], precioDe) => {
  const yaHay = new Set(existentes.map((c) => firmaPiezas(c.piezas || [])));
  const sugeridos = [];
  prendas.forEach((prenda) => {
    [2, 3].forEach((n) => {
      const piezas = Array.from({ length: n }, () => ({ prendaId: prenda.id }));
      if (yaHay.has(firmaPiezas(piezas))) return;
      const sueltas = precioDe(prenda) * n;
      const precio = Math.max(5, Math.floor((sueltas * (1 - DESCUENTO_SUGERIDO[n])) / 5) * 5);
      sugeridos.push({
        clave: `${prenda.id}-${n}`,
        name: `${n === 2 ? 'Pareja' : 'Trío'} · ${prenda.name}`,
        description: n === 2
          ? 'Dos prendas, cada una con su propio diseño, color y talla. Para ti y tu persona favorita.'
          : 'Tres prendas, cada una con su propio diseño, color y talla. Para tus amigos o tu familia.',
        piezas,
        sueltas,
        price: precio,
      });
    });
  });
  return sugeridos;
};
