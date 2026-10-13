import { createDocument, updateDocument, deleteDocument } from './firebase/firestore';
import { getDesignById } from './designs';

/**
 * "Mi combo": el combo que arma el cliente, guardado en su cuenta como UNA
 * creación (colección designs, tipo 'comboCrear'). Apunta a una creación por
 * pieza (las de siempre, tipo 'crear') con su talla. Así el combo se ve como
 * una sola tarjeta, sigue ahí en otro dispositivo y se puede publicar entero
 * en la comunidad (functions/comunidad.js).
 *
 * Como una prenda suelta, mientras no está terminado es un BORRADOR
 * (estado 'borrador', en "Tus borradores"); cuando todas sus piezas están
 * guardadas y listas para imprimir pasa a 'guardada' (en "Tus creaciones").
 *
 *   { userId, tipo: 'comboCrear', estado, comboId, comboNombre, name,
 *     piezas: [{ designId, prendaId, talla }], previas: [imagen por pieza] }
 */
export const esMiCombo = (d) => d?.tipo === 'comboCrear';

/** ¿La pieza está terminada? (guardada, con vistas previas y archivos para imprimir). */
const piezaLista = (d) => Boolean(d) && d.estado !== 'borrador'
  && Array.isArray(d.archivosImpresion) && d.archivosImpresion.length > 0
  && Array.isArray(d.vistasPrevias) && d.vistasPrevias.length > 0;

const imagenDe = (d) => d?.vistasPrevias?.[0]?.url || d?.imagenConjunta || d?.previewUrl || d?.miniatura || '';

const datos = ({ combo, piezas, creaciones }) => ({
  tipo: 'comboCrear',
  estado: piezas.length > 0 && piezas.every((p, i) => p.designId && piezaLista(creaciones[i])) ? 'guardada' : 'borrador',
  comboId: combo.id,
  comboNombre: combo.name || '',
  piezas: piezas.map((p, i) => ({
    designId: p.designId || '',
    prendaId: combo.piezas[i]?.prendaId || '',
    talla: p.talla || '',
  })),
  previas: creaciones.map(imagenDe),
});

/**
 * Crea o actualiza "Mi combo" con lo armado (`piezas`) y las creaciones de
 * cada pieza (`creaciones`, null si no tiene). El nombre solo se pone al
 * crearlo: después lo cambia el cliente.
 */
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

/**
 * Lo mismo leyendo cada pieza de Firestore: para el estudio, que no tiene a
 * mano las demás piezas. No crea nada mientras ninguna pieza tenga diseño.
 */
export const sincronizarMiCombo = async (userId, { id, combo, piezas }) => {
  if (!userId || !combo || !piezas.some((p) => p.designId)) return { id: id || '', error: null };
  const creaciones = await Promise.all(piezas.map(async (p) => {
    if (!p.designId) return null;
    const { data } = await getDesignById(p.designId);
    return data && data.userId === userId ? data : null;
  }));
  return guardarMiCombo(userId, { id, combo, piezas, creaciones });
};

/** Quita "Mi combo". Sus prendas (creaciones) se quedan en la cuenta. */
export const eliminarMiCombo = (id) => deleteDocument('designs', id);

/**
 * Las tarjetas a mostrar (creaciones o borradores): cada combo como UNA
 * tarjeta y sus prendas no se repiten sueltas (siguen en la cuenta y se abren
 * desde el combo), esté el combo terminado o en borrador.
 */
export const agruparCombos = (designs, otros = []) => {
  // `otros`: combos de la otra lista (un combo en borrador puede tener piezas ya guardadas).
  const enCombo = new Set([...designs, ...otros].filter(esMiCombo).flatMap((c) => (c.piezas || []).map((p) => p.designId)));
  return designs.filter((d) => esMiCombo(d) || !enCombo.has(d.id));
};
