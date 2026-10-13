import { createDocument, updateDocument, deleteDocument } from './firebase/firestore';

/**
 * "Mi combo": el combo que armó el cliente, guardado en su cuenta como UNA
 * creación (colección designs, tipo 'comboCrear'). Apunta a una creación por
 * pieza (las de siempre, tipo 'crear') con su talla. Así el combo se ve como
 * una sola tarjeta en Mis creaciones, sigue ahí en otro dispositivo y se
 * puede publicar entero en la comunidad (functions/comunidad.js).
 *
 *   { userId, tipo: 'comboCrear', estado: 'guardada', comboId, comboNombre,
 *     name, piezas: [{ designId, prendaId, talla }], previas: [url por pieza] }
 */
export const esMiCombo = (d) => d?.tipo === 'comboCrear';

const datos = ({ combo, piezas, creaciones }) => ({
  tipo: 'comboCrear',
  estado: 'guardada',
  comboId: combo.id,
  comboNombre: combo.name || '',
  piezas: piezas.map((p, i) => ({
    designId: p.designId,
    prendaId: combo.piezas[i]?.prendaId || '',
    talla: p.talla || '',
  })),
  previas: creaciones.map((c) => c?.vistasPrevias?.[0]?.url || c?.imagenConjunta || c?.previewUrl || ''),
});

/** Crea o actualiza "Mi combo". El nombre solo se pone al crearlo (luego lo cambia el cliente). */
export const guardarMiCombo = async (userId, { id, combo, piezas, creaciones }) => {
  if (id) {
    const { error } = await updateDocument('designs', id, datos({ combo, piezas, creaciones }));
    return { id, error };
  }
  const { id: nuevo, error } = await createDocument('designs', {
    userId,
    name: combo.name || 'Mi combo',
    ...datos({ combo, piezas, creaciones }),
  });
  return { id: nuevo, error };
};

/** Quita "Mi combo". Sus prendas (creaciones) se quedan en la cuenta. */
export const eliminarMiCombo = (id) => deleteDocument('designs', id);

/**
 * Las tarjetas a mostrar en Mis creaciones: cada combo como UNA tarjeta y sus
 * prendas no se repiten sueltas (siguen en la cuenta y se abren desde el combo).
 */
export const agruparCombos = (designs) => {
  const enCombo = new Set(designs.filter(esMiCombo).flatMap((c) => (c.piezas || []).map((p) => p.designId)));
  return designs.filter((d) => esMiCombo(d) || !enCombo.has(d.id));
};
