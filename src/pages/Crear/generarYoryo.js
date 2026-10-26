import { subirArchivoImpresion, subirVectorYoryo, subirVistaPrevia } from '../../services/crearArchivos';
import { cargarFuentesYoryo, crearArteYoryo, archivoComoDataUrl, svgComoPng, validarVectorSvg, vistaProductoYoryo } from './arteYoryo.mjs';
import { medidasConfirmadas, validarDatosYoryo } from '../../utils/yoryoPersonalizacion.mjs';
import { fijarDistribucion, firmaDeDisenoYoryo } from '../../utils/distribucionYoryo.mjs';
import { plantillaImpresionYoryo } from '../../utils/plantillasYoryo.mjs';

const originales = new Map();
const cargarOriginal = (url, tipo) => {
  const key = `${tipo}:${url}`;
  if (!originales.has(key)) {
    if (originales.size >= 24) originales.delete(originales.keys().next().value);
    originales.set(key, (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error('No pudimos cargar un archivo del diseño.');
      return tipo === 'svg' ? validarVectorSvg(await r.text()) : archivoComoDataUrl(await r.blob());
    })().catch((e) => { originales.delete(key); throw e; }));
  }
  return originales.get(key);
};
export async function fotosInlineYoryo(datos) {
  return Promise.all((datos.fotos || []).map((f) => f?.url ? cargarOriginal(f.url, 'imagen') : ''));
}

export async function cargarPlantillaYoryo(datos) {
  const p = plantillaImpresionYoryo(datos);
  if (!p) return {};
  const [fondo, superposicion] = await Promise.all([p.fondo ? cargarOriginal(p.fondo, 'imagen') : '', p.superposicion ? cargarOriginal(p.superposicion, 'imagen') : '']);
  return { fondo, superposicion };
}

export async function generarBorradorYoryo({ uid, producto, datos }) {
  const config = producto.personalizacionYoryo;
  datos = fijarDistribucion(datos, config);
  const [fuentes, fotos, plantilla, resueltos] = await Promise.all([cargarFuentesYoryo(datos, config), config.tecnica === 'laser' ? [] : fotosInlineYoryo(datos), config.tecnica === 'laser' ? {} : cargarPlantillaYoryo(datos), resolverVectorYoryo(datos)]);
  const arte = crearArteYoryo({ datos: { ...resueltos, nombre: datos.nombre || 'Tu nombre' }, config, fuentes, fotos, plantilla });
  const miniatura = await subirVistaPrevia(uid, await vistaProductoYoryo(producto, arte, datos), 'borrador');
  return { tipo: 'crear', estado: 'borrador', productId: producto.id, productName: producto.name,
    name: `${config.nombre} · ${datos.nombre || 'En preparación'}`, datosYoryo: datos, firmaYoryo: firmaDeDisenoYoryo(datos, config.produccion || {}),
    produccionYoryo: { tecnica: config.tecnica, lista: false }, archivosProduccion: [], archivosImpresion: [], vistasPrevias: [], layersByView: {}, miniatura,
  };
}

export async function resolverVectorYoryo(datos) {
  if (!datos.vector?.url || datos.plantilla !== 'escudo') return datos;
  return { ...datos, vector: { ...datos.vector, ...await cargarOriginal(datos.vector.url, 'svg') } };
}

export async function generarYoryo({ uid, producto, datos }) {
  const config = producto.personalizacionYoryo;
  datos = fijarDistribucion(datos, config);
  const error = validarDatosYoryo(datos, config.tecnica);
  if (error) throw new Error(error);
  const fuentes = await cargarFuentesYoryo(datos, config);
  const fotos = config.tecnica === 'laser' ? [] : await fotosInlineYoryo(datos);
  const plantilla = config.tecnica === 'laser' ? {} : await cargarPlantillaYoryo(datos);
  const svg = crearArteYoryo({ datos: await resolverVectorYoryo(datos), config, fuentes, fotos, plantilla });
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
  const previaBlob = await vistaProductoYoryo(producto, svg, datos);
  const previa = await subirVistaPrevia(uid, previaBlob, 'frente');
  return {
    tipo: 'crear', estado: 'guardada', productId: producto.id, productName: producto.name,
    name: `${config.nombre} · ${datos.nombre}`, datosYoryo: datos, firmaYoryo: firmaDeDisenoYoryo(datos, medidas),
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
