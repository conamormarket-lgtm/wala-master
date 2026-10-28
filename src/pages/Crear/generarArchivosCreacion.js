import { subirArchivoImpresion, subirVistaPrevia } from '../../services/crearArchivos';
import { medidaZona, cargarImagen, fotoDeVista, fondoDeVista, leerTecnica } from '../../utils/prendaBase';
import { asegurarFuentesDe, renderizarImpresion, renderizarVistaPrevia, componerVistas } from './renderDiseno';

/**
 * El estudio y las plantillas del combo generan exactamente los mismos
 * archivos desde las capas originales. Nunca usa fotos reducidas del CDN.
 * Procesa las zonas en serie para no mantener varios PNG grandes a la vez.
 */
export async function generarArchivosCreacion({ uid, prenda, color, vistas, capas, srcDe = (c) => c.src, onPaso = () => {} }) {
  await asegurarFuentesDe(capas);
  // Grabado láser: todo en un solo tono (escala de grises), también la vista previa.
  const tecnica = leerTecnica(prenda?.prendaBase?.tecnica);
  const laser = tecnica === 'laser';
  const renderVista = async (vista) => {
    const img = await cargarImagen(fotoDeVista(vista, color));
    return renderizarVistaPrevia({
      fuente: fondoDeVista(img, vista, color), anchoImg: img.naturalWidth, altoImg: img.naturalHeight,
      vista, capasPorZona: capas, srcDe, laser,
    });
  };
  const archivosImpresion = [];
  const vistasPrevias = [];
  const previas = {};
  for (const vista of vistas) {
    const zonas = vista.zonas.filter((zona) => capas[zona.id]?.length);
    if (!zonas.length) continue;
    for (const zona of zonas) {
      onPaso(`Preparando el archivo de impresión (${vista.nombre} · ${zona.nombre})…`);
      const medida = medidaZona(zona, vista);
      const { blob, ancho, alto } = await renderizarImpresion(capas[zona.id], zona, srcDe, medida, { laser });
      const url = await subirArchivoImpresion(uid, blob, zona.id);
      archivosImpresion.push({
        vista: zona.id, vistaId: vista.id, nombre: `${vista.nombre} · ${zona.nombre}`, url, ancho, alto, tecnica,
        ...(medida && { anchoCm: medida.anchoCm, altoCm: medida.altoCm }),
      });
    }
    onPaso(`Preparando la vista previa (${vista.nombre})…`);
    const blob = await renderVista(vista);
    previas[vista.id] = blob;
    vistasPrevias.push({ vista: vista.id, nombre: vista.nombre, url: await subirVistaPrevia(uid, blob, vista.id), zonas: zonas.map((z) => z.id) });
  }
  onPaso('Uniendo las vistas…');
  const lados = [];
  for (const vista of vistas) lados.push({ nombre: vista.nombre, blob: previas[vista.id] || await renderVista(vista) });
  const conjunta = await componerVistas(lados, { titulo: `${prenda.name} · ${color.nombre}` });
  return { archivosImpresion, vistasPrevias, imagenConjunta: await subirVistaPrevia(uid, conjunta, 'conjunto') };
}
