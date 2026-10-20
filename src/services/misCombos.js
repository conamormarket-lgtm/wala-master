import { createDocument, updateDocument, deleteDocument, getCollection } from './firebase/firestore';
import { getDesignById, eliminarCreacion, saveDesign } from './designs';

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
 *     piezas: [{ designId, prendaId, talla, frente, espalda }],
 *     previas: [imagen por pieza] }
 *
 * Cada pieza es SUYA (desde el 2026-10-20): su propia creación, hecha para
 * este combo (campo `combo`), nunca la misma en dos piezas ni una creación
 * suelta del cliente. "Ponerlo también en la prenda 2", "Usar en la otra",
 * elegir de "Mis creaciones" y "Llevar en combo" ponen una COPIA (con las
 * mismas imágenes, sin subir nada): cambiar o borrar una no toca la otra.
 * Los combos de antes pueden tener piezas compartidas: siguen funcionando.
 *
 * Un combo comprado (o en el carrito) no se borra al eliminarlo: se ARCHIVA
 * (`archivado: true`), deja de verse y sus prendas siguen ocultas con él (el
 * pedido conserva sus archivos). Antes sus prendas volvían a verse sueltas.
 * Cuando ya no hacen falta (no están en un pedido ni en el carrito), la
 * limpieza de las listas (cuidarCombosArchivados) los borra del todo.
 *
 * La foto de frente y la de espalda van DENTRO de cada pieza: el guardado
 * (removeEmptyForFirestore) quita los '' de las listas, y en una lista
 * aparte ("previasEspalda") una pieza sin espalda corría a las demás: la
 * casaca mostraba la espalda del polo. `previas` queda para lo de antes.
 */
export const esMiCombo = (d) => d?.tipo === 'comboCrear';

/** Un "Mi combo" que sigue en uso (no archivado al eliminarlo). */
export const esComboVigente = (d) => esMiCombo(d) && d.archivado !== true;

/** ¿La pieza está terminada? (guardada, con vistas previas y archivos para imprimir). */
const piezaLista = (d) => Boolean(d) && d.estado !== 'borrador'
  && Array.isArray(d.archivosImpresion) && d.archivosImpresion.length > 0
  && Array.isArray(d.vistasPrevias) && d.vistasPrevias.length > 0;

export const imagenDe = (d) => d?.vistasPrevias?.[0]?.url || d?.imagenConjunta || d?.previewUrl || d?.miniatura || '';

/** El otro lado con diseño de una prenda (su espalda), o '' si tiene uno solo. */
export const espaldaDe = (d) => d?.vistasPrevias?.[1]?.url || d?.miniaturas?.[1]?.url || '';

const datos = ({ combo, piezas, creaciones }) => ({
  tipo: 'comboCrear',
  estado: piezas.length > 0 && piezas.every((p, i) => p.designId && piezaLista(creaciones[i])) ? 'guardada' : 'borrador',
  comboId: combo.id,
  comboNombre: combo.name || '',
  piezas: piezas.map((p, i) => ({
    designId: p.designId || '',
    prendaId: combo.piezas[i]?.prendaId || '',
    talla: p.talla || '',
    frente: imagenDe(creaciones[i]),
    // La espalda: la tarjeta la muestra al pasar el mouse.
    espalda: espaldaDe(creaciones[i]),
    // Su color: la tarjeta muestra el de cada prenda.
    color: creaciones[i]?.color || null,
    // Su nombre: la página del combo lo muestra mientras carga la prenda.
    nombre: creaciones[i]?.name || '',
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

/**
 * Copia de una creación (guardada o borrador) para llevarla a un combo: la
 * misma prenda, color, diseño e imágenes ya generadas, marcada como pieza del
 * combo. La creación original sigue suelta, igual que antes.
 */
export const copiarCreacionParaCombo = (userId, creacion, combo, pieza = 0) => saveDesign(userId, {
  tipo: 'crear',
  estado: creacion.estado,
  productId: creacion.productId,
  productName: creacion.productName,
  layers: creacion.layers,
  layersByView: creacion.layersByView,
  variant: creacion.variant,
  name: creacion.name,
  previewUrl: creacion.previewUrl,
  color: creacion.color,
  archivosImpresion: creacion.archivosImpresion,
  vistasPrevias: creacion.vistasPrevias,
  imagenConjunta: creacion.imagenConjunta,
  miniatura: creacion.miniatura,
  miniaturas: creacion.miniaturas,
  basadoEn: creacion.basadoEn,
  combo: { id: combo.id, nombre: combo.name || '', pieza },
});

/** Quita solo el documento de "Mi combo" (sin tocar sus prendas). */
export const eliminarMiCombo = (id) => deleteDocument('designs', id);

/** TODOS los diseños del cliente (las listas traen solo los 50 más recientes). */
const todosLosDisenos = async (userId) => {
  const { data, error } = await getCollection('designs', [{ field: 'userId', operator: '==', value: userId }]);
  return error ? null : (data || []);
};

/**
 * El "Mi combo" (vigente o archivado) que usa esta creación como prenda, o
 * null. undefined si no se pudo revisar.
 */
export const comboQueUsa = async (userId, designId) => {
  const disenos = await todosLosDisenos(userId);
  if (!disenos) return undefined;
  return disenos.find((d) => esMiCombo(d) && (d.piezas || []).some((p) => p.designId === designId)) || null;
};

/** Ids de las prendas que usa algún "Mi combo" (menos el que se excluye). */
const usadasPorCombos = (disenos, excepto = null) => new Set(disenos
  .filter((d) => esMiCombo(d) && d.id !== excepto)
  .flatMap((c) => (c.piezas || []).map((p) => p.designId).filter(Boolean)));

/**
 * Elimina "Mi combo" y sus prendas. Una prenda se borra si se hizo para ESTE
 * combo (campo combo), ningún otro combo la usa y no está en un pedido, en el
 * carrito ni publicada. Si alguna se queda por eso (o el combo mismo está en
 * un pedido o en el carrito), el combo se ARCHIVA en vez de borrarse: sus
 * prendas siguen ocultas con él y no vuelven a verse sueltas. Una creación
 * suelta que se eligió para un combo de antes (sin campo combo) no se toca:
 * es del cliente. Devuelve { borradas, sueltas, archivado }.
 */
export const eliminarMiComboConPrendas = async (userId, combo, { enCarrito = new Set() } = {}) => {
  const disenos = await todosLosDisenos(userId);
  // Sin la lista completa no se sabe si otro combo usa una prenda: no se borra nada.
  if (!disenos) return { error: 'No pudimos revisar tus diseños. Inténtalo de nuevo.', borradas: [], sueltas: [], archivado: false };
  const enOtro = usadasPorCombos(disenos, combo.id);
  const ids = [...new Set((combo.piezas || []).map((p) => p.designId).filter(Boolean))];
  const piezas = ids.filter((id) => !enOtro.has(id))
    .map((id) => disenos.find((x) => x.id === id))
    .filter((d) => d && d.userId === userId);
  const propias = piezas.filter((d) => d.combo?.id);
  const seQuedan = propias.filter((d) => !sePuedeBorrarSola(d, enCarrito));
  const archivar = combo.enPedido === true || enCarrito.has(combo.id) || seQuedan.length > 0;
  const { error } = archivar
    ? await updateDocument('designs', combo.id, { archivado: true, archivadoEn: Date.now() })
    : await deleteDocument('designs', combo.id);
  if (error) return { error, borradas: [], sueltas: [], archivado: false };
  const borradas = [];
  await Promise.allSettled(propias.filter((d) => sePuedeBorrarSola(d, enCarrito)).map(async (d) => {
    const { error: e } = await eliminarCreacion(userId, d);
    if (!e) borradas.push(d.id);
  }));
  // Las de antes, elegidas de "Mis creaciones": siguen siendo del cliente.
  const sueltas = piezas.filter((d) => !d.combo?.id).map((d) => d.id);
  return { error: null, borradas, sueltas, archivado: archivar };
};

/**
 * Limpieza de los combos archivados (la corren las listas): el que ya no
 * está en un pedido ni en el carrito, y cuyas prendas tampoco, se borra del
 * todo con ellas. Devuelve los ids borrados.
 */
export const cuidarCombosArchivados = async (userId, { todos, enCarrito = new Set() }) => {
  const archivados = (todos || []).filter((d) => esMiCombo(d) && d.archivado === true
    && d.enPedido !== true && !enCarrito.has(d.id));
  if (!userId || !archivados.length) return [];
  const completos = await todosLosDisenos(userId);
  if (!completos) return [];
  const borradas = [];
  await Promise.allSettled(archivados.map(async (combo) => {
    const enOtro = usadasPorCombos(completos, combo.id);
    const piezas = [...new Set((combo.piezas || []).map((p) => p.designId).filter(Boolean))]
      .filter((id) => !enOtro.has(id))
      .map((id) => completos.find((x) => x.id === id))
      .filter((d) => d && d.userId === userId && d.combo?.id);
    if (piezas.some((d) => !sePuedeBorrarSola(d, enCarrito))) return;
    for (const d of piezas) {
      const { error } = await eliminarCreacion(userId, d);
      if (error) return;
      borradas.push(d.id);
    }
    const { error } = await deleteDocument('designs', combo.id);
    if (!error) borradas.push(combo.id);
  }));
  return borradas;
};

/** Días que se guarda (oculta) una versión reemplazada antes de borrarse sola. */
export const DIAS_VERSION_REEMPLAZADA = 7;
const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * Prendas hechas para un combo que ningún combo usa ya: versiones anteriores.
 * Pasa al editar una prenda que las dos compartían (el estudio trabaja en una
 * copia para no cambiar la otra) y después llevar esa copia a la otra prenda,
 * o cuando una prenda se quedó sin su combo. Eliminar un combo ya borra sus
 * prendas (eliminarMiComboConPrendas); las que no se borran pierden el campo
 * combo y se ven como creaciones normales.
 */
export const versionesReemplazadas = (designs, otros = []) => {
  const usadas = usadasPorCombos([...designs, ...otros]);
  return designs.filter((d) => !esMiCombo(d) && d.combo?.id && !usadas.has(d.id));
};

/** Días que le quedan a una versión reemplazada antes de borrarse (sin marca: todos). */
export const diasParaBorrar = (d) => {
  if (!d?.reemplazadaEn) return DIAS_VERSION_REEMPLAZADA;
  const pasados = (Date.now() - d.reemplazadaEn) / MS_DIA;
  return Math.max(0, Math.ceil(DIAS_VERSION_REEMPLAZADA - pasados));
};

/** ¿Se puede borrar sola? Nunca si está en un pedido, en el carrito o en la comunidad. */
const sePuedeBorrarSola = (d, enCarrito) => d.enPedido !== true
  && !enCarrito.has(d.id) && d.comunidad !== 'publicada';

/**
 * Mantenimiento de las versiones reemplazadas (lo corren las listas, con
 * TODO ya cargado: creaciones y borradores). Marca desde cuándo está fuera
 * cada una, borra las que pasaron los días y quita la marca a las que se
 * volvieron a usar. Devuelve los ids borrados.
 */
export const cuidarVersionesReemplazadas = async (userId, { todos, enCarrito = new Set() }) => {
  if (!userId) return [];
  const versiones = versionesReemplazadas(todos);
  // Las listas traen solo los 50 más recientes: un combo más antiguo puede
  // usar una prenda que aquí parece suelta. Para borrar se mira todo.
  let usadasEnTodo = null;
  if (versiones.some((d) => d.reemplazadaEn && Date.now() - d.reemplazadaEn > DIAS_VERSION_REEMPLAZADA * MS_DIA)) {
    const completos = await todosLosDisenos(userId);
    usadasEnTodo = completos ? usadasPorCombos(completos) : null;
  }
  const ids = new Set(versiones.map((d) => d.id));
  const ahora = Date.now();
  const borradas = [];
  const tareas = [];
  todos.forEach((d) => {
    if (d.reemplazadaEn && !ids.has(d.id)) tareas.push(updateDocument('designs', d.id, { reemplazadaEn: null }));
  });
  versiones.forEach((d) => {
    if (!d.reemplazadaEn) {
      tareas.push(updateDocument('designs', d.id, { reemplazadaEn: ahora }));
    } else if (ahora - d.reemplazadaEn > DIAS_VERSION_REEMPLAZADA * MS_DIA && sePuedeBorrarSola(d, enCarrito)
      && usadasEnTodo && !usadasEnTodo.has(d.id)) {
      tareas.push(eliminarCreacion(userId, d).then(({ error }) => { if (!error) borradas.push(d.id); }));
    }
  });
  await Promise.allSettled(tareas);
  return borradas;
};

/** Recupera una versión reemplazada: pasa a ser una creación suelta, como cualquiera. */
export const recuperarVersion = (id) => updateDocument('designs', id, { combo: null, reemplazadaEn: null });

/**
 * Las tarjetas a mostrar (creaciones o borradores): cada combo como UNA
 * tarjeta y sus prendas no se repiten sueltas (siguen en la cuenta y se abren
 * desde el combo), esté el combo terminado o en borrador. Las versiones
 * reemplazadas tampoco salen (están en "Versiones anteriores de tus combos").
 * Un combo archivado (eliminado, pero comprado o en el carrito) no se ve, y
 * sus prendas tampoco: siguen siendo de él.
 */
export const agruparCombos = (designs, otros = []) => {
  // `otros`: la otra lista (un combo en borrador puede tener piezas ya
  // guardadas, y un combo guardado, piezas en borrador).
  const enCombo = new Set([...designs, ...otros].filter(esMiCombo).flatMap((c) => (c.piezas || []).map((p) => p.designId)));
  const reemplazadas = new Set(versionesReemplazadas(designs, otros).map((d) => d.id));
  return designs.filter((d) => (esMiCombo(d) ? esComboVigente(d) : !enCombo.has(d.id) && !reemplazadas.has(d.id)));
};
