import { generarArchivosCreacion } from './generarArchivosCreacion';
import { saveDesign } from '../../services/designs';
import {
  leerPrendaBase, colorDisponible, vistasDelColor,
} from '../../utils/prendaBase';

/**
 * Una prenda de un diseño de la comunidad, tal cual, como creación del
 * cliente: lo mismo que hace el estudio al guardar una plantilla sin cambios
 * (CrearStudioPage generarArchivos + generarYGuardar), sin abrirlo. Genera los
 * archivos de impresión de cada zona, la vista previa de cada lado y la
 * imagen con todos los lados, y la guarda en su cuenta.
 *
 * Así un combo de la comunidad se compra directo, como un diseño individual
 * (que se agrega al carrito eligiendo la talla).
 *
 * @param {object} p
 * @param {string} p.uid
 * @param {object} p.prenda   La prenda (productos_wala) de esa pieza.
 * @param {object} p.pieza    La pieza de la publicación: { nombre, color, layersByView }.
 * @param {string} p.talla
 * @param {string} [p.basadoEn]  Id de la publicación de la comunidad.
 * @param {object} [p.combo]     { id, nombre, pieza } si es parte de un combo.
 * @param {(texto: string) => void} [p.onPaso]
 * @returns {Promise<object>} La creación guardada (con su id).
 */
export async function crearDesdePlantilla({ uid, prenda, pieza, talla, basadoEn, combo, onPaso = () => {} }) {
  const leida = leerPrendaBase(prenda);
  const listos = leida.colores.filter((c) => colorDisponible(c, leida.vistas));
  const colores = listos.length ? listos : leida.colores;
  const color = colores.find((c) => c.id === pieza?.color?.id || c.nombre === pieza?.color?.nombre);
  if (!color) throw new Error(`El color de "${pieza?.nombre || prenda.name}" ya no está disponible.`);
  const vistas = color.hex2 ? vistasDelColor(leida.vistas, color) : leida.vistas;

  const capas = {};
  Object.entries(pieza?.layersByView || {}).forEach(([zonaId, lista]) => {
    if (Array.isArray(lista) && lista.length) capas[zonaId] = lista;
  });
  if (!Object.keys(capas).length) throw new Error(`"${pieza?.nombre || prenda.name}" no tiene diseño.`);
  const { archivosImpresion, vistasPrevias, imagenConjunta } = await generarArchivosCreacion({ uid, prenda, color, vistas, capas, onPaso });

  const creacion = {
    productId: prenda.id,
    productName: prenda.name,
    name: String(pieza?.nombre || '').trim() || `${prenda.name} ${color.nombre}`,
    layersByView: capas,
    variant: { size: talla || '', color: color.nombre },
    tipo: 'crear',
    estado: 'guardada',
    miniatura: '',
    miniaturas: [],
    previewUrl: imagenConjunta,
    color: {
      id: color.id, nombre: color.nombre, hex: color.hex,
      ...(color.hex2 ? { hex2: color.hex2, patron: color.patron } : {}),
    },
    archivosImpresion,
    vistasPrevias,
    imagenConjunta,
    ...(basadoEn && { basadoEn }),
    ...(combo && { combo }),
  };
  const { id, error } = await saveDesign(uid, creacion);
  if (error || !id) throw new Error(error || 'No se pudo guardar el diseño.');
  return { ...creacion, id, userId: uid };
}
