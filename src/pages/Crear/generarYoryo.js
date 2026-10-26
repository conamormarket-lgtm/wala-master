import { subirArchivoImpresion, subirVectorYoryo, subirVistaPrevia } from '../../services/crearArchivos';
import { cargarFuenteYoryo, crearArteYoryo, archivoComoDataUrl, svgComoPng, validarVectorSvg, vistaProductoYoryo } from './arteYoryo.mjs';
import { medidasConfirmadas, validarDatosYoryo } from '../../utils/yoryoPersonalizacion.mjs';

export async function fotosInlineYoryo(datos) {
  return Promise.all((datos.fotos || []).map(async (f) => {
    const r = await fetch(f.url);
    if (!r.ok) throw new Error('No pudimos cargar una de las fotos del diseño.');
    return archivoComoDataUrl(await r.blob());
  }));
}

export async function resolverVectorYoryo(datos) {
  if (!datos.vector?.url || datos.plantilla !== 'escudo') return datos;
  const r = await fetch(datos.vector.url);
  if (!r.ok) throw new Error('No pudimos cargar el vector del escudo.');
  return { ...datos, vector: { ...datos.vector, ...validarVectorSvg(await r.text()) } };
}

export async function generarYoryo({ uid, producto, datos }) {
  const config = producto.personalizacionYoryo;
  const error = validarDatosYoryo(datos, config.tecnica);
  if (error) throw new Error(error);
  const fuente = await cargarFuenteYoryo(datos.tipografia);
  const fotos = config.tecnica === 'laser' ? [] : await fotosInlineYoryo(datos);
  const svg = crearArteYoryo({ datos: await resolverVectorYoryo(datos), config, fuente, fotos });
  const revision = crypto.randomUUID();
  const medidas = config.produccion || {};
  const lista = medidasConfirmadas(medidas);
  const archivo = { tecnica: config.tecnica, formato: config.tecnica === 'laser' ? 'svg' : 'png', revision, lista,
    ...(lista && { anchoMm: Number(medidas.anchoMm), altoMm: Number(medidas.altoMm) }) };
  if (config.tecnica === 'laser') archivo.url = await subirVectorYoryo(uid, svg);
  else {
    const ancho = lista ? Math.round(Number(medidas.anchoMm) * 300 / 25.4) : 2400;
    const alto = lista ? Math.round(Number(medidas.altoMm) * 300 / 25.4) : Math.round(ancho * config.proporcion);
    if (ancho * alto > 16000000) throw new Error('El área de impresión supera el tamaño admitido. Revisa sus medidas.');
    archivo.url = await subirArchivoImpresion(uid, await svgComoPng(svg, ancho, alto), 'frente');
  }
  const previaBlob = await vistaProductoYoryo(producto, svg);
  const previa = await subirVistaPrevia(uid, previaBlob, 'frente');
  return {
    tipo: 'crear', estado: 'guardada', productId: producto.id, productName: producto.name,
    name: `${config.nombre} · ${datos.nombre}`, datosYoryo: datos, firmaYoryo: JSON.stringify({ datos, medidas }),
    produccionYoryo: { tecnica: config.tecnica, lista, revision }, archivosProduccion: [archivo],
    // Compatibilidad con la consulta y la representación de creaciones actuales.
    archivosImpresion: config.tecnica === 'laser' ? [] : [{ ...archivo, vista: 'frente', nombre: 'Frente' }],
    layersByView: { frente: [{ type: 'text', text: datos.nombre, left: 0, top: 0, tamano: 90 }] },
    variant: { size: '', color: producto.variants?.[0]?.name || '' },
    color: { id: producto.variants?.[0]?.id || '', nombre: producto.variants?.[0]?.name || '', hex: producto.variants?.[0]?.colorHex || '#FFFFFF' },
    vistasPrevias: [{ vista: 'frente', nombre: 'Frente', url: previa, revision }],
    previewUrl: previa, imagenConjunta: previa,
  };
}
