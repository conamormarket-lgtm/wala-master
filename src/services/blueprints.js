import { getCollection, getDocument, createDocument, updateDocument, deleteDocument } from './firebase/firestore';

// Blueprints POD (estilo Printful) — Fase 4.
// Cada blueprint describe una prenda base imprimible: sus áreas de impresión
// (printAreas con tamaño físico en cm + dpi), los métodos de decoración
// disponibles (DTG, bordado, sublimación...) y el costo base de impresión.
// Es la plantilla sobre la que el editor fabric genera el ARTE DE PRODUCCIÓN.
// Colección Firestore: 'blueprints' (lectura pública, escritura admin).
const COLLECTION = 'blueprints';

// Normaliza un área de impresión asegurando tipos numéricos correctos.
// Firestore rechaza NaN/undefined, así que forzamos números válidos.
const normalizePrintArea = (area = {}) => ({
  name: (area.name || '').trim(),
  widthCm: typeof area.widthCm === 'number' ? area.widthCm : Number(area.widthCm) || 0,
  heightCm: typeof area.heightCm === 'number' ? area.heightCm : Number(area.heightCm) || 0,
  // 300 dpi es el estándar de imprenta para POD si no se especifica otro.
  dpi: typeof area.dpi === 'number' ? area.dpi : Number(area.dpi) || 300,
});

export const getBlueprints = async () => {
  return await getCollection(COLLECTION, [], { field: 'order', direction: 'asc' });
};

export const getBlueprint = async (id) => await getDocument(COLLECTION, id);

export const createBlueprint = async (data) => {
  return await createDocument(COLLECTION, {
    name: data.name || '',
    baseGarment: data.baseGarment || '',
    // Áreas imprimibles: al menos una. Cada una con tamaño físico + dpi.
    printAreas: Array.isArray(data.printAreas) ? data.printAreas.map(normalizePrintArea) : [],
    // Métodos de decoración soportados (array de strings): 'DTG', 'bordado', etc.
    decorationMethods: Array.isArray(data.decorationMethods)
      ? data.decorationMethods.map((m) => (m || '').trim()).filter(Boolean)
      : [],
    basePrintCost: typeof data.basePrintCost === 'number' ? data.basePrintCost : Number(data.basePrintCost) || 0,
    active: data.active !== false,
    order: typeof data.order === 'number' ? data.order : Number(data.order) || 0,
    createdAt: new Date().toISOString(),
  });
};

export const updateBlueprint = async (id, data) => {
  const payload = {};
  ['name', 'baseGarment', 'basePrintCost', 'active', 'order'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  // Los arrays se normalizan aparte para garantizar la forma del contrato.
  if (data.printAreas !== undefined) {
    payload.printAreas = Array.isArray(data.printAreas) ? data.printAreas.map(normalizePrintArea) : [];
  }
  if (data.decorationMethods !== undefined) {
    payload.decorationMethods = Array.isArray(data.decorationMethods)
      ? data.decorationMethods.map((m) => (m || '').trim()).filter(Boolean)
      : [];
  }
  payload.updatedAt = new Date().toISOString();
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteBlueprint = async (id) => await deleteDocument(COLLECTION, id);
