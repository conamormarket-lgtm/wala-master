import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Catálogo de recompensas canjeables con puntos ('monedas'). Fase 2b.
// Lectura pública (vitrina del cliente), escritura solo admin (ver firestore.rules).
// Colección Firestore: 'rewardsCatalog'.
//
// `tipo` usa el mismo vocabulario que los premios de la Ruleta (ver
// src/utils/ruletaModel.js), para que redeemRewardSecure pueda generar el
// mismo cupón auto-aplicable que ya genera spinRuletaSecure:
//   manual              -> se entrega a mano (comportamiento histórico: el
//                          cupón no lleva tipo y el checkout pide "canjéalo
//                          con un asesor").
//   descuento           -> cupón de % o monto fijo sobre el total del pedido.
//   producto_descuento  -> cupón de % sobre un producto concreto.
//   producto_gratis     -> cupón que regala una unidad de un producto concreto.
//   envio_gratis        -> cupón que anula el costo de envío.
//
// Forma del doc: { title, description, cost (number, en puntos),
//   tipo, descuentoPct, descuentoMonto, topeDescuento, productId, productName,
//   vigenciaDias (días de validez del cupón generado), imageUrl,
//   value (nota interna, texto libre), active (bool), order (number) }.
const COLLECTION = 'rewardsCatalog';

const CAMPOS = [
  'title', 'description', 'cost', 'value', 'active', 'order',
  'tipo', 'descuentoPct', 'descuentoMonto', 'topeDescuento',
  'productId', 'productName', 'vigenciaDias', 'imageUrl',
];

export const getRewards = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

export const getReward = async (id) => await getDocument(COLLECTION, id);

export const createReward = async (data) => {
  return await createDocument(COLLECTION, {
    title: data.title || '',
    description: data.description || '',
    cost: typeof data.cost === 'number' ? data.cost : 0,
    value: data.value || '',
    active: data.active !== false,
    order: typeof data.order === 'number' ? data.order : 0,
    tipo: data.tipo || 'manual',
    descuentoPct: Number(data.descuentoPct) || 0,
    descuentoMonto: Number(data.descuentoMonto) || 0,
    topeDescuento: Number(data.topeDescuento) || 0,
    productId: data.productId || '',
    productName: data.productName || '',
    vigenciaDias: Number(data.vigenciaDias) || 30,
    imageUrl: data.imageUrl || '',
  });
};

export const updateReward = async (id, data) => {
  const payload = {};
  CAMPOS.forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteReward = async (id) => await deleteDocument(COLLECTION, id);
