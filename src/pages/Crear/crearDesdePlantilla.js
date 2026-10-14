import { saveDesign } from '../../services/designs';
import { subirArchivoImpresion, subirVistaPrevia } from '../../services/crearArchivos';
import {
  leerPrendaBase, colorDisponible, vistasDelColor, medidaZona, cargarImagen, fotoDeVista, fondoDeVista,
} from '../../utils/prendaBase';
import { asegurarFuentesDe, renderizarImpresion, renderizarVistaPrevia, componerVistas } from './renderDiseno';

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
  await asegurarFuentesDe(capas);

  const srcDe = (capa) => capa.src;
  const renderizarVista = async (v) => {
    const img = await cargarImagen(fotoDeVista(v, color));
    return renderizarVistaPrevia({
      fuente: fondoDeVista(img, v, color), anchoImg: img.naturalWidth, altoImg: img.naturalHeight,
      vista: v, capasPorZona: capas, srcDe,
    });
  };

  const archivosImpresion = [];
  const vistasPrevias = [];
  const blobsPrevias = {};
  for (const v of vistas.filter((x) => x.zonas.some((z) => capas[z.id]))) {
    const zonasConCapas = v.zonas.filter((z) => capas[z.id]);
    for (const z of zonasConCapas) {
      onPaso(`Preparando ${prenda.name} (${v.nombre} · ${z.nombre})…`);
      const medida = medidaZona(z, v);
      const { blob, ancho, alto } = await renderizarImpresion(capas[z.id], z, srcDe, medida);
      const url = await subirArchivoImpresion(uid, blob, z.id);
      archivosImpresion.push({
        vista: z.id, vistaId: v.id, nombre: `${v.nombre} · ${z.nombre}`, url, ancho, alto,
        ...(medida && { anchoCm: medida.anchoCm, altoCm: medida.altoCm }),
      });
    }
    const previa = await renderizarVista(v);
    blobsPrevias[v.id] = previa;
    const url = await subirVistaPrevia(uid, previa, v.id);
    vistasPrevias.push({ vista: v.id, nombre: v.nombre, url, zonas: zonasConCapas.map((z) => z.id) });
  }
  // Todos los lados en una imagen (con y sin diseño), como el estudio.
  const lados = [];
  for (const v of vistas) lados.push({ nombre: v.nombre, blob: blobsPrevias[v.id] || await renderizarVista(v) });
  const imagenConjunta = await subirVistaPrevia(uid, await componerVistas(lados, { titulo: `${prenda.name} · ${color.nombre}` }), 'conjunto');

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
