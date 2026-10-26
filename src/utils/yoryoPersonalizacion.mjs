import productos from '../../functions/yoryoProductos.json' with { type: 'json' };
import { nombreConCreacion } from './nombreCreacion.js';

export const YORYO_PACK_ID = productos.packId;
export const YORYO_PIEZAS = productos.piezas;
export const esYoryoPersonalizable = (p) => Boolean(p && (p.id === YORYO_PACK_ID || YORYO_PIEZAS.some((x) => x.id === p.id || x.sku === p.sku)));
export const rutaPersonalizarYoryo = (p) => `${p?.id === YORYO_PACK_ID ? '/combo/' : '/crear/'}${p?.id || ''}`;

// Conserva los mismos productos, precios e inventario. La configuración técnica
// se guarda aparte; nunca se inventan las medidas del área de producción.
export function productoConYoryo(p) {
  if (!esYoryoPersonalizable(p)) return p;
  const description = String(p.description || '').replace(/Después de tu compra,[^<]*?WhatsApp[^<.]*\./gi, 'Personaliza tu diseño antes de agregarlo al carrito.');
  if (p.id === YORYO_PACK_ID) return {
    ...p, description, personalizacionYoryo: { pack: true },
    comboCrear: { publicado: p.visible !== false && p.comboCrear?.publicado !== false, piezas: YORYO_PIEZAS.map((x) => ({ prendaId: x.id })) },
  };
  const base = YORYO_PIEZAS.find((x) => x.id === p.id || x.sku === p.sku);
  const imagen = p.variants?.[0]?.imageUrl || p.mainImage || p.images?.[0] || '';
  return {
    ...p,
    description,
    personalizacionYoryo: { ...base, proporcion: medidasConfirmadas(p.produccionYoryo) ? Number(p.produccionYoryo.altoMm) / Number(p.produccionYoryo.anchoMm) : base.proporcion, produccion: p.produccionYoryo || {} },
    // El formato existente sirve también a Mis creaciones y sus tarjetas.
    prendaBase: p.prendaBase?.vistas?.length ? p.prendaBase : {
      vistas: [{ id: 'frente', nombre: 'Frente', imagen, zonas: [{ id: 'frente', nombre: base.nombre, x: 0.15, y: 0.15, w: 0.7, proporcion: base.proporcion }] }],
      colores: {},
    },
  };
}

export const datosYoryoVacios = () => ({ plantilla: 'nombre', tipografia: 'Clásica', nombre: '', frase: '', equipo: '', fecha: '', fotos: [], vector: null });

export function validarDatosYoryo(datos, tecnica) {
  if (!String(datos?.nombre || '').trim()) return 'Escribe el nombre o los nombres del diseño.';
  if (String(datos.nombre).length > 60 || String(datos.frase || '').length > 160) return 'Acorta el nombre o la frase para que entren en el diseño.';
  if (tecnica === 'laser' && datos.plantilla === 'escudo' && !datos.vector?.url) return 'Sube el escudo en SVG con sus textos convertidos a trazos.';
  const fotos = (datos.fotos || []).filter((f) => f?.url);
  if (tecnica !== 'laser' && fotos.length < (datos.plantilla === 'collage' ? 3 : 1)) return datos.plantilla === 'collage' ? 'Agrega las tres fotos del collage.' : 'Agrega tu foto o diseño.';
  return '';
}

export const medidasConfirmadas = (p) => Boolean(p?.medidasConfirmadas === true && Number(p.anchoMm) > 0 && Number(p.altoMm) > 0 && Number(p.anchoMm) <= 500 && Number(p.altoMm) <= 500);
export const personalizacionYoryoLista = (p) => {
  const a = p?.archivosProduccion?.[0], v = p?.vistasPrevias?.[0], meta = p?.produccionYoryo;
  return Boolean(meta?.lista && meta.revision && a?.lista && a.url && v?.url && a.revision === meta.revision && v.revision === meta.revision && a.tecnica === meta.tecnica && a.formato === (meta.tecnica === 'laser' ? 'svg' : 'png'));
};

export function faltaPersonalizacionYoryo(item) {
  if (!esYoryoPersonalizable({ id: item?.productId })) return '';
  const c = item.customization;
  const piezas = item.productId === YORYO_PACK_ID ? c?.piezas || [] : [c];
  const ids = item.productId === YORYO_PACK_ID ? YORYO_PIEZAS.map((p) => p.id) : [item.productId];
  if (piezas.length !== ids.length || piezas.some((p, i) => (p?.prendaId || item.productId) !== ids[i] || !p?.datosYoryo)) return 'Completa la personalización.';
  if (piezas.some((p) => !personalizacionYoryoLista(p))) return 'La personalización está pendiente de confirmar para producción.';
  return '';
}

// Edición atómica: solo reemplaza el diseño de esa fila. Mantiene cantidad,
// selección y datos de regalo; no agrega otro artículo ni altera otros packs.
export function reemplazarDisenoCarrito(items, itemId, productoId, nueva) {
  return items.map((item) => item.id !== itemId || item.productId !== productoId ? item : {
    ...item,
    customization: nueva,
    productImage: nueva.imageURL || item.productImage,
    ...(nueva.tipo === 'crear' && { productName: nombreConCreacion(nueva.prendaNombre || item.productName, nueva) }),
  });
}
