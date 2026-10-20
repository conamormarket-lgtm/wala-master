import { leerPrendaBase, colorDisponible, fondoMuestra, precioBase, precioPersonalizado, tallasDeColor, fondoColorGuardado } from '../../utils/prendaBase';

/*
 * Los adaptadores de Crear y lo que sale de ahí (Comunidad, una creación,
 * un combo), aparte de adaptadores.js (que va en el archivo principal de la
 * tienda): solo los usan esas páginas.
 */

/**
 * Una prenda base de productos_wala (getPrendasBase) → props de
 * TarjetaProducto con accion "crear" ("Diseñar", va al estudio): frente y
 * espalda (imagenHover), sus colores (solo los que se pueden pedir, como la
 * tienda) y los lados que se diseñan en la línea de la categoría.
 */
export const prendaCrearDesdeProducto = (prenda = {}) => {
  const { vistas, colores } = leerPrendaBase(prenda);
  const lados = vistas.map((v) => v.nombre).filter(Boolean).join(' + ');
  return {
    id: prenda.id,
    nombre: prenda.name,
    imagen: vistas[0]?.imagen,
    imagenHover: vistas[1]?.imagen,
    categoria: [prenda.visible === false && 'Borrador', lados].filter(Boolean).join(' · '),
    colores: [...new Set(colores.filter((c) => colorDisponible(c, vistas)).map(fondoMuestra))],
    precio: precioBase(prenda),
    personalizable: true,
    accion: 'crear',
    // En Crear no hay lista de deseos: es una prenda para diseñar.
    sinDeseo: true,
    url: `/crear/${prenda.id}`,
  };
};

/**
 * Un combo de Crear (getCombosCrear) con sus prendas → props de
 * TarjetaProducto (piezas: la etiqueta "Combo" y sus prendas como cartas;
 * precioAntes: lo que cuestan por separado, así se ve el ahorro), más
 * `cantidad` y `conjunto` para "¿Para cuántos?". null si falta una prenda.
 *  - prendaPorId: Map de las prendas base por id
 */
export const comboCrearDesde = (combo = {}, prendaPorId = new Map()) => {
  const prendas = (combo.piezas || []).map((p) => prendaPorId.get(p.prendaId));
  if (!prendas.length || !prendas.every(Boolean)) return null;
  const precio = precioBase(combo);
  const sueltas = prendas.reduce((total, p) => total + precioBase(p), 0);
  return {
    id: combo.id,
    cantidad: prendas.length,
    conjunto: new Set((combo.piezas || []).map((p) => p.prendaId)).size > 1,
    nombre: combo.name,
    categoria: [!combo.publicado && 'Borrador', 'Cada una con su diseño'].filter(Boolean).join(' · '),
    piezas: prendas.map((p) => ({ nombre: p.name, imagen: leerPrendaBase(p).vistas[0]?.imagen || p.mainImage })),
    precio,
    precioAntes: sueltas > precio ? sueltas : undefined,
    personalizable: true,
    accion: 'crear',
    textoAccion: 'Armar',
    sinDeseo: true,
    url: `/combo/${combo.id}?nuevo=1`,
  };
};

/**
 * Un diseño de la comunidad (listarComunidad) → TarjetaCreacion con `usar`:
 * frente y espalda (o las prendas de un combo), prenda y color, quién lo
 * hizo y cuántos lo usaron.
 */
// Frente y espalda de cada prenda de un combo publicado (juntos: si una
// prenda no tiene foto se quita entera, sin correr las espaldas de las demás).
const fotosComunidad = (d) => (d.piezas || []).map((p) => {
  const vistas = (p.vistasPrevias || []).filter((v) => v?.url);
  return { frente: vistas[0]?.url || p.imagenConjunta || p.previewUrl, espalda: vistas[1]?.url || '' };
}).filter((f) => f.frente);

export const disenoComunidadDesde = (d = {}) => {
  const previas = (d.vistasPrevias || []).filter((p) => p?.url);
  const esCombo = d.tipo === 'combo';
  const url = esCombo ? `/combo/${d.comboId}?plantilla=${d.id}` : `/crear/${d.productId}?plantilla=${d.id}`;
  return {
    id: d.id,
    nombre: d.nombre,
    imagen: previas[0]?.url || d.imagenConjunta || d.previewUrl || '',
    imagenEspalda: esCombo ? undefined : previas[1]?.url,
    imagenes: esCombo ? fotosComunidad(d).map((f) => f.frente) : undefined,
    // La espalda de cada prenda (la tarjeta la muestra al pasar el mouse).
    imagenesEspalda: esCombo ? fotosComunidad(d).map((f) => f.espalda) : undefined,
    combo: esCombo ? String((d.piezas || []).length) : undefined,
    producto: esCombo ? (d.comboNombre || d.productName) : d.productName,
    color: !esCombo && d.color?.nombre ? { nombre: d.color.nombre, hex: d.color.hex, fondo: fondoColorGuardado(d.color) || d.color.hex } : undefined,
    // La foto y el nombre llevan a usarlo, como el botón.
    url,
    lados: previas.length > 1 ? previas.map((p) => p.nombre).filter(Boolean).join(' + ') : undefined,
    usar: { url, autor: d.autorNombre || 'Walá', usos: d.usos || 0 },
    // Para el filtro por prenda de la galería (como ComunidadPage), con el
    // nombre de la prenda ("Polera clásica"), no el del combo.
    prendaId: d.productId,
    prendaNombre: esCombo ? ((d.piezas || [])[0]?.productName || d.productName) : d.productName,
  };
};

const FECHA_LARGA = { day: 'numeric', month: 'long', year: 'numeric' };

/**
 * Una creación (getDesignById) y su prenda base (getPrendaBase) → las props
 * de PaginaCreacion (sin los handlers). Como CreacionPage: las fotos son sus
 * vistas previas y la imagen de todos los lados; las tallas, las del color.
 *  - fecha: ms (fechaDeCreacion) · esAdmin: ve las prendas en borrador
 */
export const fichaCreacionDesde = (d = {}, prenda, { fecha, esAdmin = false } = {}) => {
  const cfg = prenda ? leerPrendaBase(prenda) : null;
  const color = cfg?.colores.find((c) => c.id === d.color?.id || c.nombre === d.color?.nombre) || null;
  const imagenes = (d.vistasPrevias || []).filter((p) => p?.url).map((p) => ({ url: p.url, nombre: p.nombre }));
  if (d.imagenConjunta) imagenes.push({ url: d.imagenConjunta, nombre: 'Todos los lados' });
  if (!imagenes.length && d.previewUrl) imagenes.push({ url: d.previewUrl, nombre: 'Vista previa' });
  const precio = prenda ? precioPersonalizado(prenda) : 0;
  const lista = Number(prenda?.price);
  return {
    creacion: {
      nombre: d.name || d.nombre || 'Mi creación',
      prenda: d.productName || prenda?.name,
      fecha: fecha ? new Date(fecha).toLocaleDateString('es-PE', FECHA_LARGA) : undefined,
      imagenes,
      color: d.color?.nombre ? { nombre: d.color.nombre, fondo: fondoColorGuardado(d.color, prenda) || d.color.hex } : undefined,
      lados: (d.vistasPrevias || []).map((p) => p?.nombre).filter(Boolean),
      zonas: (d.archivosImpresion || []).filter((a) => a?.nombre).map((a) => ({ nombre: a.nombre, ancho: a.anchoCm, alto: a.altoCm })),
      imagenConjunta: d.imagenConjunta,
      publicada: d.comunidad === 'publicada',
    },
    precio,
    precioAntes: Number.isFinite(lista) && lista > precio ? lista : undefined,
    disponible: Boolean(prenda) && prenda.deleted !== true && (prenda.visible !== false || esAdmin),
    agotado: typeof prenda?.inStock === 'number' && prenda.inStock <= 0,
    tallas: cfg ? (color ? tallasDeColor(color, cfg) : cfg.tallas) : [],
    talla: d.variant?.size,
    combo: d.combo?.id ? { nombre: d.combo.nombre, url: `/combo/${d.combo.id}` } : undefined,
    urlEditar: `/crear/${d.productId}?designId=${d.id}`,
    descripcionPrenda: prenda?.description,
  };
};
