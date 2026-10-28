/*
 * Adaptadores: producto de la tienda (colección productos_wala, ver
 * normalizeProductForRead en src/services/products.js) → props del kit.
 *
 * El kit no lee Firestore; estas funciones solo traducen nombres de campos
 * para usar <TarjetaProducto> y <AgregarRapido> con productos reales.
 */

import { limaTodayStr, felicidadKapiHoy } from '../../utils/fechaLima';
import { getFallbackHex } from '../../utils/colors';
import { fotosGenerales } from '../../utils/fotosDeColor';
import { proximaOcurrencia, textoFechaEvento } from '../../utils/fechaEvento.mjs';
import { hoyLocal } from '../../utils/fechasFestivas.mjs';
import {
  leerPrendaBase, colorDisponible, fondoMuestra, precioPersonalizado, tallasDeColor,
  vistasDelColor, esColorBlanco, textoSobre, medidaZona,
} from '../../utils/prendaBase';

const variantesDe = (p) => (p?.hasVariants ? p.variants || [] : []);

/* ── Colores de las variantes ──────────────────────────────── */

/** Dos nombres de color iguales sin mirar espacios ni mayúsculas ("Azul Acero " = "azul acero"). */
const normalColor = (n) => String(n ?? '').trim().toLowerCase();
const mismoColor = (a, b) => Boolean(normalColor(a)) && normalColor(a) === normalColor(b);

/** El color de la muestra: el guardado o, si falta, el que dice el nombre ("Negro"); si no, ninguno. */
const hexDeVariante = (v) => v?.colorHex || getFallbackHex(v?.name);

/** La muestra es clara (el visto va oscuro): la misma regla que las de Crear. */
const esClaro = (hex) => esColorBlanco(hex) || textoSobre(hex) !== '#FFFFFF';

/** Las variantes de una prenda de un combo que el combo permite (allowedColors). */
const variantesDePieza = (sub, it) => {
  const permitidos = (it?.variantMapping?.allowedColors || []).map(normalColor);
  const vs = variantesDe(sub);
  return permitidos.length ? vs.filter((v) => permitidos.includes(normalColor(v.name))) : vs;
};

/** Los colores de una prenda de un combo: su muestra de color y las tallas de ese color. */
const coloresDePieza = (sub, it) => variantesDePieza(sub, it).map((v) => {
  const hex = hexDeVariante(v) || '#cccccc';
  return { nombre: v.name, hex, claro: esClaro(hex), tallas: v.sizes || [] };
});

/**
 * Qué hace el botón de la tarjeta. Misma regla que productNeedsVariantSelection
 * (src/utils/comboProductUtils.js) más las prendas base del estudio Crear.
 *  - 'crear':   esPrendaBase → se diseña en /crear/:id
 *  - 'elegir':  combo, más de una variante, variantes con opciones o mainSizes
 *  - 'agregar': sin opciones (taza, llavero, producto con una sola variante)
 */
export function accionDeProducto(p) {
  if (p?.esPrendaBase || p?.esComboCrear) return 'crear';
  if (p?.isComboProduct && p.comboItems?.length) return 'elegir';
  const vs = variantesDe(p);
  if (vs.length > 1 || vs.some((v) => v.sizes?.length) || p?.mainSizes?.length) return 'elegir';
  return 'agregar';
}

/*
 * Prendas y combos de Crear en la tienda ("También en la tienda", ver
 * utils/enTienda.mjs): se venden solo personalizados. Su botón lleva al
 * estudio y su stock vacío es "sin límite" (no "agotado").
 */
const esDeCrear = (p) => p?.esPrendaBase === true || p?.esComboCrear === true;

/** Agotado: en Crear solo con un stock cargado en 0; en la tienda, sin stock. */
const agotadoDe = (p) => (esDeCrear(p) ? typeof p.inStock === 'number' && p.inStock <= 0 : !p?.inStock);

/** Adónde lleva "Personalízalo": el estudio de la prenda (en ese color) o el combo. */
export function rutaPersonalizar(p, colorId) {
  if (p?.esComboCrear) return `/combo/${p.id}?nuevo=1`;
  return `/crear/${p.id}${colorId ? `?color=${encodeURIComponent(colorId)}` : ''}`;
}

/**
 * Los colores que se ofrecen de una prenda de Crear, como en Crear: los que
 * se pueden pedir (un bicolor sin sus fotos no), sin la versión invertida
 * (se elige en el estudio con "Invertir colores") y el bicolor partido en dos.
 */
const coloresDeCrear = (p) => {
  const { vistas, colores } = leerPrendaBase(p);
  return colores
    .filter((c) => !c.espejoDe && colorDisponible(c, vistas))
    .map((c) => ({ id: c.id, nombre: c.nombre, hex: c.hex, fondo: fondoMuestra(c) }));
};

/** Las piezas de un combo de Crear como las guarda el admin (nombre y foto). */
const piezasDeComboCrear = (p) => (p?.comboCrear?.piezas || [])
  .filter((pz) => pz?.prendaId)
  .map((pz) => ({ nombre: pz.nombre || '', imagen: pz.imagen || undefined }));

const DIAS_NUEVO = 30;

/** Fecha de creación en ms (Timestamp de Firestore, texto ISO o número). */
const msDe = (f) => {
  if (!f) return 0;
  if (typeof f.toMillis === 'function') return f.toMillis();
  if (typeof f.seconds === 'number') return f.seconds * 1000;
  const n = typeof f === 'number' ? f : Date.parse(f);
  return Number.isFinite(n) ? n : 0;
};

/** Creado hace menos de 30 días (misma regla que PremiumProductCard). */
export const esNuevo = (p, ahora = Date.now()) => {
  const ms = msDe(p?.createdAt) || Number(p?.createdAtMs) || 0;
  return ms > 0 && ahora - ms < DIAS_NUEVO * 86400000;
};

/**
 * Props de <TarjetaProducto> desde un producto.
 *  - imagen: miniatura ya elegida por la tienda (useProductThumbnailVariant)
 *  - catalogo: { marcas, categorias, marcaActual } para el sello de la marca
 *    y el nombre de la categoría. marcaActual = id de la marca de la página
 *    (dentro de una marca no se repite su logo en cada tarjeta).
 */
/**
 * La portada de un combo (comboPreviewImage, la que sube el admin), con la
 * misma regla que ComboProductImage de la tienda: una URL de verdad (ni
 * vacía, ni data:, ni el placeholder). Sin ella, el combo se ve con sus
 * piezas.
 */
export function portadaDeCombo(p = {}) {
  const url = typeof p.comboPreviewImage === 'string' ? p.comboPreviewImage.trim() : '';
  if (!p.isComboProduct || !url || url.toLowerCase().startsWith('data:') || url.includes('placeholder')) return '';
  return url;
}

/** La foto actual de la pieza en el color del combo; la copia guardada es respaldo. */
export function piezaDeCombo(it, sub) {
  const vs = variantesDePieza(sub, it);
  const variante = vs.find((v) => mismoColor(v.name, it.variantMapping?.color))
    || vs.find((v) => String(v.id) === String(sub?.defaultVariantId)) || vs[0];
  const fotos = [variante?.imageUrl, ...(variante?.images || []), ...(variante?.galleryImages || []), ...fotosGenerales(sub, variante), it.imageUrl];
  return {
    nombre: sub?.name || it.name,
    imagen: fotos.find((u) => u && !String(u).toLowerCase().includes('placeholder')),
  };
}

export function tarjetaDesdeProducto(p, { imagen, catalogo = {}, subproductos = {}, piezasCargando = false } = {}) {
  const vs = variantesDe(p);
  const { marcas = [], categorias = [], marcaActual = null } = catalogo;
  const m = !marcaActual && p.brandId ? marcas.find((x) => x.id === p.brandId) : null;
  const cat = (p.categories || []).map((id) => categorias.find((c) => (c.categoryId || c.id) === id)).find(Boolean);
  const principal = vs.find((v) => String(v.id) === String(p.defaultVariantId)) || vs[0];
  // Un combo con portada se ve con ella (como en la tienda); sin portada, con sus piezas.
  // Las generales, sin las de otro color (al pasar el mouse no sale otro color).
  // Un combo de Crear se ve con su portada o, sin ella, con sus piezas.
  const portadaCrear = p.esComboCrear && p.mainImage && !String(p.mainImage).includes('placeholder') ? p.mainImage : '';
  const fotos = p.isComboProduct
    ? [portadaDeCombo(p)].filter(Boolean)
    : p.esComboCrear
      ? [portadaCrear].filter(Boolean)
      : [principal?.imageUrl, ...(principal?.images || []), ...fotosGenerales(p, principal)].filter(Boolean);
  const crear = esDeCrear(p);
  const coloresCrear = p.esPrendaBase ? coloresDeCrear(p) : [];
  return {
    url: p.esComboCrear ? rutaPersonalizar(p) : `/producto/${p.id}`,
    imagen: imagen || fotos[0],
    imagenHover: fotos.find((f) => f !== (imagen || fotos[0])),
    nombre: p.name,
    categoria: cat?.name,
    precio: p.salePrice || p.price,
    precioAntes: p.salePrice ? p.price : undefined,
    // Los productos de la tienda ya no se personalizan (eso es Crear); los
    // de Crear que salen en la tienda llevan el sello "Tu diseño".
    personalizable: crear,
    agotado: agotadoDe(p),
    stock: typeof p.inStock === 'number' ? p.inStock : undefined,
    nuevo: esNuevo(p),
    marca: m?.logoUrl ? { nombre: m.name, logo: m.logoUrl } : undefined,
    piezas: p.isComboProduct ? (p.comboItems || []).map((it) => {
      const sub = subproductos[it.productId];
      const pieza = piezaDeCombo(it, sub);
      // La copia del combo puede ser antigua: solo es respaldo si la lectura falla.
      return piezasCargando && !sub ? { ...pieza, imagen: undefined } : pieza;
    }) : p.esComboCrear ? piezasDeComboCrear(p) : [],
    piezasCargando: p.esComboCrear ? false : piezasCargando,
    // Con una sola variante (la "Principal" que crea el admin por defecto) no
    // hay colores que mostrar.
    colores: p.esPrendaBase
      ? (coloresCrear.length > 1 ? [...new Set(coloresCrear.map((c) => c.fondo))] : [])
      : vs.length > 1 ? vs.filter((v) => v.colorHex).map((v) => v.colorHex) : [],
    accion: accionDeProducto(p),
    // Sin lista de deseos, como en Crear: un regalo de la lista se compra
    // tal cual, y estos solo se venden diseñados.
    ...(crear && { textoAccion: 'Personalízalo', sinDeseo: true }),
  };
}

/**
 * Un producto de la lista de deseos de otra persona, para <TarjetaRegalo>
 * (/wishlist/:código y /regalar/:código).
 *  - item: el de la lista (productId y lo que guardó al agregarlo:
 *    productName, productImage, price, isGifted)
 *  - producto: el del catálogo; undefined mientras llega (la tarjeta se ve
 *    con lo que guardó la lista y "Regalar esto" espera), null si no existe
 *  - imagen: la foto que elige la tienda · catalogo: como tarjetaDesdeProducto
 *  - exigirPrecio: sin precio no se puede regalar (/regalar/:código)
 * Oculto o borrado (deleted), se ve apagado: su foto y "Ya no está en la tienda".
 */
export function itemRegaloDesde(item = {}, producto, { imagen, catalogo, exigirPrecio = false } = {}) {
  const id = item.productId;
  const base = { id, regalado: Boolean(item.isGifted) };
  const guardado = {
    url: `/producto/${id}`,
    nombre: item.productName || 'Producto',
    imagen: item.productImage || undefined,
    precio: item.price > 0 ? item.price : undefined,
  };
  if (producto === undefined) return { ...base, producto: guardado, cargando: true };
  const precio = producto ? producto.salePrice || producto.price || 0 : 0;
  const disponible = Boolean(producto) && producto.visible !== false && producto.deleted !== true && (!exigirPrecio || precio > 0);
  if (!disponible) {
    return { ...base, disponible: false, producto: { nombre: producto?.name || guardado.nombre, imagen: producto?.mainImage || guardado.imagen } };
  }
  return { ...base, disponible: true, producto: tarjetaDesdeProducto(producto, { imagen, catalogo }) };
}

/**
 * Las ocasiones del año que le tocan a una persona por su relación y su
 * género (las mismas que "Fechas importantes"): "Día de la Madre"…
 */
export function festivasDePersona(roleKey, gender) {
  const festivas = [];
  if (gender === 'Femenino') festivas.push('Día de la Mujer');
  if (gender === 'Masculino') festivas.push('Día del Hombre');
  if (roleKey === 'pareja') festivas.push('San Valentín');
  if (roleKey === 'padres' && gender === 'Femenino') festivas.push('Día de la Madre');
  if (roleKey === 'padres' && gender === 'Masculino') festivas.push('Día del Padre');
  if (roleKey === 'hijos') festivas.push('Día del Niño');
  if (roleKey === 'amigos') festivas.push('Día de la Amistad');
  return festivas;
}

/**
 * Una fecha especial de getPublicGiftRegistry (dates[i]) → props de
 * <FechaEntrega> para PaginaRegalar, con lo que necesita el carrito:
 *  - fecha: la PRÓXIMA vez que cae (el evento guarda el año de nacimiento, o
 *    "0000"), dias: cuánto falta, fechaTexto: "24 de octubre"
 *  - etiqueta: "Cumpleaños de María (Hermana)" (deliveryEventLabel)
 */
export function fechaEntregaDesde(d = {}, i = 0, { hoy = hoyLocal() } = {}) {
  const proxima = proximaOcurrencia(d.date, hoy) || d.date || '';
  const [a, m, dia] = String(proxima).split('-').map(Number);
  const [ha, hm, hd] = hoy.split('-').map(Number);
  const dias = a && m && dia ? Math.round((Date.UTC(a, m - 1, dia) - Date.UTC(ha, hm - 1, hd)) / 86400000) : null;
  const ocasion = d.label || d.type || 'Fecha especial';
  return {
    id: d.id || d.eventId || `${d.date}-${i}`,
    nombre: d.recipientName || '',
    foto: d.recipientPhoto || undefined,
    relacion: d.relation || undefined,
    ocasion,
    fecha: proxima,
    dias,
    fechaTexto: textoFechaEvento(proxima, { conAnio: false }),
    festivas: festivasDePersona(d.roleKey, d.gender),
    etiqueta: `${ocasion}${d.recipientName ? ` de ${d.recipientName}` : ''}${d.relation ? ` (${d.relation})` : ''}`,
  };
}

/**
 * Props de <AgregarRapido> desde un producto.
 *  - subproductos: { [productId]: producto } de las piezas de un combo
 *    (la tienda ya los carga en ProductDetail para mostrar sus colores).
 * Las muestras llevan el color guardado o el que dice el nombre
 * (getFallbackHex) y, en un combo, las tallas de cada color. La foto de la
 * variante (imagen) es para "Agregar rápido", no para la muestra.
 */
export function opcionesDeProducto(p, { subproductos = {} } = {}) {
  const vs = variantesDe(p);
  const piezas = p?.isComboProduct
    ? (p.comboItems || []).map((it) => {
      const sub = subproductos[it.productId];
      const colores = coloresDePieza(sub, it);
      // El color con el que viene el combo (variantMapping.color), con el nombre de la variante.
      const inicial = colores.find((c) => mismoColor(c.nombre, it.variantMapping?.color));
      // Sin colores, las tallas son las de la prenda (como getComboVariantInfo de la tienda).
      return { nombre: it.name, color: inicial?.nombre || it.variantMapping?.color, colores, tallas: colores.length ? [] : sub?.mainSizes || sub?.sizes || [] };
    })
    : [];
  // Combos: las tallas que tienen todas las piezas (o todas, si no coinciden).
  // Solo dice si el combo pide talla: cada prenda elige la suya entre las de
  // su color (OpcionesProducto, tallasDePieza).
  let opcionesCombo = [];
  if (piezas.length) {
    const listas = piezas.map((pz) => (pz.colores.length ? [...new Set(pz.colores.flatMap((c) => c.tallas))] : pz.tallas)).filter((l) => l.length);
    const comunes = listas.reduce((a, l) => a.filter((x) => l.includes(x)), listas[0] || []);
    opcionesCombo = comunes.length ? comunes : [...new Set(listas.flat())];
  }
  return {
    // Un combo se ve con su portada o, sin ella, con la foto de una prenda (su
    // mainImage suele ser el relleno "Producto").
    producto: { nombre: p.name, imagen: portadaDeCombo(p) || [p.mainImage, ...(p.images || []), ...(p.comboItems || []).map((it) => it.imageUrl)].find((u) => u && !String(u).includes('placeholder')), precio: p.salePrice || p.price, precioAntes: p.salePrice ? p.price : undefined },
    // Una prenda de Crear: sus colores como en Crear (el bicolor partido en
    // dos) y sin tallas (se eligen en el estudio, al agregar).
    variantes: piezas.length ? [] : p?.esPrendaBase
      ? coloresDeCrear(p).map((c) => {
        const v = vs.find((x) => String(x.id) === String(c.id));
        return { id: c.id, nombre: c.nombre, colorHex: c.fondo, claro: esClaro(c.hex), imagen: v?.imageUrl, opciones: [] };
      })
      : vs.map((v) => {
        const hex = hexDeVariante(v);
        return { id: v.id, nombre: v.name, colorHex: hex, claro: hex ? esClaro(hex) : undefined, imagen: v.imageUrl, opciones: v.sizes || [] };
      }),
    opciones: piezas.length ? opcionesCombo : p?.esPrendaBase ? [] : p.mainSizes || [],
    // Los productos guardados antes de que products.js conservara sizeLabel
    // no lo tienen: dicen "Talla" hasta que se vuelvan a guardar.
    etiquetaOpcion: vs.find((v) => v.sizeLabel)?.sizeLabel || 'Talla',
    piezas,
    // El admin elige por combo: una talla para todas ('una') o una por prenda
    // (lo de siempre, sin el campo).
    tallaUnica: piezas.length > 0 && p.comboTallas === 'una',
    personalizable: false,
  };
}

/*
 * Marcas (colección tienda_brands, la misma consulta getBrands() que ya usan
 * el Header y el mosaico "Explora nuestros mundos") → tarjeta del kit.
 */

/** Ruta de la landing de una marca: su `slug` o el nombre sin tildes ni espacios. */
export function rutaDeMarca(m) {
  if (m?.slug) return String(m.slug).replace(/^\/+|\/+$/g, '');
  return String(m?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Props de una tarjeta de marca; null si la marca está oculta o no tiene ruta. */
export function tarjetaDesdeMarca(m) {
  const ruta = rutaDeMarca(m);
  if (!m?.name || !ruta || m.active === false || m.visible === false) return null;
  // bgColor viene en #ffffff en casi todas las marcas (valor por defecto del
  // admin): blanco o casi blanco no sirve de fondo de tarjeta → paleta.
  const color = /^#?(f{3}|f{6}|fefefe|fafafa)$/i.test(String(m.bgColor || '').trim()) ? '' : m.bgColor || '';
  return {
    id: m.id || ruta,
    nombre: m.name,
    logo: m.logoUrl || m.imageUrl || '',
    url: `/${ruta}`,
    color,
    fondo: m.bgImage || '',
  };
}

/* Temas que el editor viejo guardaba en "author" (misma lista que
   normalizeTestimonial en pages/Tienda/components/Testimonials). */
const TEMAS_VIEJOS = new Set([
  'calidad de impresión', 'personalización', 'atención al cliente', 'envío', 'calidad de la prenda', 'experiencia general',
]);

/**
 * Props de <TarjetaTestimonio> desde un testimonio del builder. Los guardados
 * con el tema en el campo del autor pasan el tema a su lugar y firman
 * "Cliente de Walá" (como hace la tienda).
 */
export function testimonioDesdeAjuste(t = {}) {
  const autorEraTema = !t.topic && TEMAS_VIEJOS.has(String(t.author || '').trim().toLocaleLowerCase('es'));
  return {
    texto: t.text,
    autor: autorEraTema ? 'Cliente de Walá' : (t.author || 'Cliente de Walá'),
    tema: autorEraTema ? t.author : (t.topic || ''),
    ciudad: t.city || t.location,
    puntuacion: t.rating,
    avatar: t.avatar,
    verificado: t.verified === true,
  };
}

/* ── Catálogo con filtros ───────────────────────────────── */

/** Id de una referencia (texto o { id | slug | name }), como idOf de SidebarCatalogLayout. */
const idDe = (c) => (c && typeof c === 'object' ? c.id || c.slug || c.name || '' : c || '');

/** Precio que paga el cliente: la oferta si es menor que el precio normal. */
export const precioEfectivo = (p) => {
  const normal = Number(p?.price) || 0;
  const oferta = Number(p?.salePrice) || 0;
  return oferta > 0 && (!normal || oferta < normal) ? oferta : normal;
};

/** Precio más bajo y más alto de una lista de productos (enteros), o null. */
export function limitesDePrecio(productos = []) {
  const precios = productos.map(precioEfectivo).filter((n) => n > 0);
  if (!precios.length) return null;
  return { min: Math.floor(Math.min(...precios)), max: Math.ceil(Math.max(...precios)) };
}

/* Temporadas: colecciones cuyo nombre es una fecha o estación (la tienda no
   tiene un campo propio; misma regla que SidebarCatalogLayout). */
const PALABRAS_TEMPORADA = ['verano', 'invierno', 'otoño', 'otono', 'primavera', 'navidad', 'navideno', 'fiestas',
  'pascua', 'halloween', 'valentín', 'valentin', 'temporada', 'spring', 'summer', 'autumn', 'fall', 'winter', 'holiday', 'xmas', 'christmas', 'easter'];
const FRASES_TEMPORADA = ['año nuevo', 'ano nuevo', 'san valentín', 'san valentin', 'día de la madre', 'dia de la madre', 'día del padre', 'dia del padre'];
export const esTemporada = (c) => {
  const nombre = String(c?.name || '').toLowerCase();
  const palabras = nombre.split(/[^a-záéíóúüñ]+/i).filter(Boolean);
  return palabras.some((w) => PALABRAS_TEMPORADA.includes(w) || w.startsWith('navideñ'))
    || FRASES_TEMPORADA.some((f) => nombre.includes(f));
};

/**
 * Grupos de filtros del catálogo (props `grupos` de CatalogoConFiltros) desde
 * las listas de la tienda, en el orden de la tienda: Categorías, Temporadas,
 * Colecciones, Marcas, Tipo de producto, Etiquetas, Personajes.
 *  - categorias (tienda_categories), colecciones (tienda_collections), marcas
 *    (tienda_brands), tipos (productTypes), etiquetas (tags), personajes
 *    (characters): [{ id, name }]
 *  - productos: los de la página (o todos los de la marca). Con ellos cada
 *    opción lleva su cuenta y se quitan las que no tienen productos.
 *  - marcaActual: id de la marca de la página; entonces no hay grupo Marcas.
 * Cada grupo trae `de(producto)` para filtrar en el navegador.
 */
export function gruposDeCatalogo({ categorias = [], colecciones = [], marcas = [], tipos = [], etiquetas = [], personajes = [], productos = [], marcaActual } = {}) {
  const lista = (v) => [].concat(v ?? []).map(idDe).filter(Boolean);
  const de = {
    categorias: (p) => [...new Set([...lista(p.categories), ...lista(p.categoryId), ...lista(p.category)])],
    colecciones: (p) => lista(p.collections),
    marcas: (p) => lista(p.brandId),
    tipos: (p) => lista(p.productType),
    etiquetas: (p) => lista(p.tags),
    personajes: (p) => lista(p.characters),
  };
  const contar = (fn) => {
    const cuenta = new Map();
    productos.forEach((p) => fn(p).forEach((v) => cuenta.set(v, (cuenta.get(v) || 0) + 1)));
    return cuenta;
  };
  const opciones = (docs, fn) => {
    const cuenta = productos.length ? contar(fn) : null;
    return docs
      .filter((d) => d?.name && idDe(d))
      .map((d) => ({ valor: idDe(d), nombre: d.name, cuenta: cuenta ? cuenta.get(idDe(d)) || 0 : undefined }))
      .filter((o) => !cuenta || o.cuenta > 0);
  };
  const temporadas = colecciones.filter(esTemporada);
  const otras = temporadas.length ? colecciones.filter((c) => !esTemporada(c)) : colecciones;
  return [
    { id: 'categoria', titulo: 'Categorías', opciones: opciones(categorias, de.categorias), de: de.categorias },
    { id: 'temporada', titulo: 'Temporadas', opciones: opciones(temporadas, de.colecciones), de: de.colecciones },
    { id: 'coleccion', titulo: 'Colecciones', opciones: opciones(otras, de.colecciones), de: de.colecciones },
    ...(marcaActual ? [] : [{ id: 'marca', titulo: 'Marcas', opciones: opciones(marcas, de.marcas), de: de.marcas }]),
    { id: 'tipo', titulo: 'Tipo de producto', opciones: opciones(tipos, de.tipos), de: de.tipos },
    { id: 'etiqueta', titulo: 'Etiquetas', opciones: opciones(etiquetas, de.etiquetas), de: de.etiquetas },
    { id: 'personaje', titulo: 'Personajes', opciones: opciones(personajes, de.personajes), de: de.personajes },
  ].filter((g) => g.opciones.length);
}

/**
 * Columnas y segunda foto de las grillas desde la configuración de la tienda
 * (storeConfig.layout, la que usa ProductGrid): props de GrillaProductos y
 * CatalogoConFiltros. 'auto' (o nada) = tantas como quepan.
 */
export function grillaDesdeConfiguracion(layout = {}) {
  const num = (v) => (Number(v) > 0 ? Number(v) : undefined);
  const escritorio = num(layout?.productGridColumnsDesktop);
  const celular = num(layout?.productGridColumnsMobile);
  return {
    columnas: escritorio || celular ? { escritorio, celular } : undefined,
    segundaFoto: layout?.showHoverSecondaryMedia ?? true,
  };
}

/* ── Zona Arcade (/minijuegos) ──────────────────────────── */

// juegosDelArcade vive en adaptadoresArcade.js: solo la usa la Zona Arcade
// y aquí habría ido al archivo principal de la tienda.

/* ── Kapi, la mascota ───────────────────────────────────── */

/**
 * Cómo está Kapi hoy, desde el perfil (misma regla que KapiPet y que
 * feedKapiSecure): props de KapiFlotante y VentanaKapi.
 *  - alimentado: lastKapiClaimDate es hoy (hora de Lima)
 *  - felicidad: la guardada con el mismo decaimiento que aplicará el servidor
 *  - estado: 'feliz' si comió hoy; si no, 'triste' con felicidad < 40 y
 *    'hambre' si solo falta la de hoy
 *  - recompensa: 2 con el multiplicador kapi_double_3d vigente, si no 1
 *  - aviso: el "!" del botón (comida pendiente o tutorial sin ver)
 */
export function kapiDesdePerfil(perfil, { hoy = limaTodayStr(), ahora = new Date() } = {}) {
  if (!perfil) return null;
  const alimentado = perfil.lastKapiClaimDate === hoy;
  const felicidad = felicidadKapiHoy(perfil.kapiHappiness, perfil.lastKapiClaimDate, hoy);
  const estado = alimentado ? 'feliz' : felicidad < 40 ? 'triste' : 'hambre';
  const doble = perfil.activeMultiplier === 'kapi_double_3d'
    && Boolean(perfil.multiplierExpiresAt) && new Date(perfil.multiplierExpiresAt) > ahora;
  return {
    estado,
    felicidad,
    alimentado,
    recompensa: doble ? 2 : 1,
    aviso: !alimentado || !perfil.kapiTutorialVisto,
  };
}

/**
 * Props de RetoSemanal desde el reto activo (globals/activeChallenge) y el
 * avance del perfil (weeklyChallengeProgress, challengeEvidencesApproved).
 * Sin reto activo devuelve null.
 */
export function retoDesdePerfil(reto, perfil = {}) {
  if (!reto) return null;
  const avance = perfil?.weeklyChallengeProgress || {};
  const esEste = avance.challengeId === reto.challengeId;
  return {
    titulo: reto.title,
    descripcion: reto.description,
    recompensa: reto.rewardType === 'main' ? `${reto.rewardCoins} monedas` : 'Doble monedas al alimentar a Kapi',
    progreso: esEste ? Number(avance.progress) || 0 : 0,
    meta: Number(reto.goal) || 1,
    completado: (esEste && Boolean(avance.completed)) || Boolean(perfil?.challengeEvidencesApproved?.includes(reto.challengeId)),
    conEvidencia: String(reto.actionType || '').startsWith('manual_'),
  };
}

/* ── Grilla de categorías automática (category_grid, dataSource 'products') ── */

const idDeCategoriaGrilla = (c) => (c && typeof c === 'object' ? c.id || c.slug || c.name || '' : c || '');
const fotoDeProducto = (p) => p?.mainImage || p?.imageUrl || p?.images?.[0] || p?.variants?.find((v) => v?.imageUrl)?.imageUrl || '';

/**
 * Las categorías con productos, como las calculaba CategoryGrid: cuántos
 * productos tiene cada una, la foto de su primer producto y el orden del
 * admin (order y luego nombre). GrillaCategorias aplica sortMode y límite.
 *  - idsDe(producto) → ids de sus categorías (la tienda pasa idsDeCategoriaDe,
 *    la misma regla que el menú de la cabecera)
 */
export function categoriasDeGrilla(categorias = [], productos = [], { idsDe = (p) => p?.categories || [] } = {}) {
  const cuentas = new Map();
  const fotos = new Map();
  productos.forEach((p) => {
    if (!p || p.visible === false || p.active === false) return;
    new Set(idsDe(p)).forEach((id) => {
      cuentas.set(id, (cuentas.get(id) || 0) + 1);
      if (!fotos.has(id) && fotoDeProducto(p)) fotos.set(id, fotoDeProducto(p));
    });
  });
  return categorias
    .filter((c) => c && c.active !== false && cuentas.has(idDeCategoriaGrilla(c)))
    .map((c) => ({
      categoryId: idDeCategoriaGrilla(c),
      name: c.name || c.title || 'Categoría',
      imageUrl: c.imageUrl || c.image || '',
      imagenProducto: fotos.get(idDeCategoriaGrilla(c)) || '',
      cuenta: cuentas.get(idDeCategoriaGrilla(c)) || 0,
      order: Number(c.order) || 0,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
}

/* ── Marco: avisos, WhatsApp, campañas y pie legal ─────── */

const TIPOS_AVISO = { warning: 'aviso', info: 'info', error: 'error' };

/**
 * Props de AvisoSistema desde configuracion/estado_app ({ mostrarAviso, tipo,
 * mensaje }). Solo con mostrarAviso === true; si no, null. El tipo de
 * Firestore ('warning' | 'info' | 'error', 'warning' si falta) pasa al del kit.
 */
export function avisoDesdeEstadoApp(estado) {
  if (!estado || estado.mostrarAviso !== true) return null;
  return {
    tipo: TIPOS_AVISO[estado.tipo] || 'aviso',
    mensaje: estado.mensaje || 'Tenemos una actualización importante programada.',
  };
}

/**
 * Número de WhatsApp listo para wa.me, como el botón de la tienda: sin
 * espacios, guiones ni paréntesis, y con +51 si no trae código de país.
 */
export function numeroWhatsApp(crudo) {
  const limpio = String(crudo || '').replace(/[\s\-()]/g, '');
  if (!limpio) return '';
  return limpio.startsWith('+') ? limpio : `+51${limpio}`;
}

/**
 * Props de VentanaCampana desde un popup de storeConfig/popups (las reglas
 * de cuándo sale siguen en services/popupsLogic.mjs).
 *  - 'imagen' con imagenUrl: solo la imagen, que es el botón
 *  - 'tarjeta': título, texto, botón (botonTexto) y el de cerrar (cerrarTexto,
 *    sin él no hay segundo botón)
 */
export function campanaDesdePopup(popup = {}) {
  return {
    formato: popup.formato === 'imagen' && popup.imagenUrl ? 'imagen' : 'tarjeta',
    imagen: popup.imagenUrl || undefined,
    titulo: popup.titulo || '',
    texto: popup.texto || '',
    accion: popup.botonTexto || 'Continuar',
    textoCerrar: popup.cerrarTexto || null,
  };
}

/**
 * Props de PieLegal desde config/empresa.js. La dirección fiscal solo si ya
 * está llena (mientras dice "RELLENAR…" no se muestra).
 */
export function pieLegalDesdeEmpresa(empresa = {}) {
  const direccion = empresa.domicilioFiscal && !String(empresa.domicilioFiscal).startsWith('RELLENAR')
    ? empresa.domicilioFiscal : undefined;
  return {
    empresa: { nombre: empresa.nombreComercial, email: empresa.email, telefono: empresa.telefono, direccion },
    enlaces: [
      { texto: 'Términos y Condiciones', url: '/terminos-y-condiciones' },
      { texto: 'Políticas de Privacidad', url: '/politicas-privacidad' },
    ],
    reclamaciones: '/libro-de-reclamaciones',
  };
}

/* ── Búsqueda ───────────────────────────────────────────── */

/**
 * Sugerencias del buscador (props de PanelBusqueda) desde lo que devuelve
 * getSearchSuggestions (services/search.js): productos con foto y precio, y
 * las marcas y categorías de esos productos como atajos.
 *  - marcas (tienda_brands) y categorias (tienda_categories): para los nombres
 *    y los logos (la búsqueda solo trae ids)
 *  - termino: lo escrito (va en el enlace de "buscar en esta marca")
 */
export function sugerenciasDesdeBusqueda(resultado, { marcas = [], categorias = [], termino = '' } = {}) {
  if (!resultado) return null;
  const q = encodeURIComponent(String(termino || '').trim());
  return {
    productos: (resultado.productos || []).map((p) => {
      const t = tarjetaDesdeProducto(p);
      return { id: p.id, nombre: p.name, imagen: t.imagen, precio: t.precio, url: t.url };
    }),
    marcas: (resultado.marcas || []).map((m) => {
      const doc = marcas.find((x) => x.id === m.id);
      return { id: m.id, nombre: doc?.name || m.id, logo: doc?.logoUrl, cuenta: m.total, url: `/buscar?q=${q}&brand=${encodeURIComponent(m.id)}` };
    }),
    categorias: (resultado.categorias || []).map((c) => {
      const doc = categorias.find((x) => (x.categoryId || x.id) === c.id);
      return { id: c.id, nombre: doc?.name || c.id, imagen: doc?.imageUrl || undefined, cuenta: c.total, url: `/tienda?categoria=${encodeURIComponent(c.id)}` };
    }),
    total: resultado.total || 0,
  };
}

/* Cómo se hace el producto (FULFILLMENT_TYPES de constants/marketplace). */
const MODALIDADES = [['print_on_demand', 'Personalizado'], ['stock', 'En stock']];

/**
 * Grupo "Modalidad" del catálogo en la búsqueda (personalizado o de stock),
 * con su cuenta; sin productos de ninguna, null. Va primero en `grupos`.
 */
export function grupoModalidad(productos = []) {
  const opciones = MODALIDADES
    .map(([valor, nombre]) => ({ valor, nombre, cuenta: productos.filter((p) => p.fulfillmentType === valor).length }))
    .filter((o) => o.cuenta > 0);
  return opciones.length ? { id: 'modalidad', titulo: 'Modalidad', opciones, de: (p) => [p.fulfillmentType] } : null;
}

/** Órdenes de la búsqueda (los mismos de SearchPage). */
export const ORDENES_BUSQUEDA = [
  { valor: 'newest', texto: 'Más nuevos' },
  { valor: 'price', texto: 'Precio: menor a mayor' },
  { valor: 'price-desc', texto: 'Precio: mayor a menor' },
  { valor: 'name', texto: 'Nombre (A-Z)' },
];

/** Ordena una lista de productos con uno de ORDENES_BUSQUEDA (sin tocar la original). */
export function ordenarProductos(productos = [], orden = 'newest') {
  const fecha = (p) => {
    const f = p?.createdAt;
    if (!f) return 0;
    if (typeof f === 'number') return f;
    if (typeof f === 'string') return Date.parse(f) || 0;
    return (f.seconds || f._seconds || 0) * 1000;
  };
  const lista = productos.slice();
  if (orden === 'price') return lista.sort((a, b) => precioEfectivo(a) - precioEfectivo(b));
  if (orden === 'price-desc') return lista.sort((a, b) => precioEfectivo(b) - precioEfectivo(a));
  if (orden === 'name') return lista.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
  return lista.sort((a, b) => fecha(b) - fecha(a));
}

/* ── Cuenta ─────────────────────────────────────────────── */

/**
 * Perfil del cliente → props de PaginaPerfil (y el `perfil` de
 * PaginaDirecciones). Mismos campos que lee PerfilPage: el nombre que
 * muestra CuentaLayout, la foto de AvatarStudio y el teléfono local de
 * phoneIntl fuera del Perú.
 *  - perfil: userProfile (Firestore) · usuario: user de Firebase Auth
 */
export function perfilDesdeUsuario(perfil = {}, usuario = {}) {
  const pais = perfil.country || 'PE';
  const tipo = perfil.tipoDocumento === 'CE' || perfil.tipoDocumento === 'Pasaporte' ? perfil.tipoDocumento : 'DNI';
  return {
    // Sin nombre guardado queda vacío: el del correo no se propone (se guardaría sin notarlo).
    nombre: perfil.displayName || perfil.nombre || usuario.displayName || '',
    email: usuario.email || perfil.email || '',
    // Solo la foto propia (la de Google no se puede quitar desde aquí).
    avatar: perfil.avatarConfig?.avatarUrl || null,
    pais,
    // En el Perú, DNI, carnet o pasaporte (un tipo viejo, como 'OTRO', pasa a DNI); fuera, 'OTRO'.
    tipoDocumento: pais === 'PE' ? tipo : 'OTRO',
    documento: perfil.dni ? String(perfil.dni).trim() : '',
    telefono: pais === 'PE' ? String(perfil.phone || '').replace(/\D/g, '') : String(perfil.phoneIntl?.localNumber ?? perfil.phone ?? ''),
    cumpleanos: perfil.birthDate || '',
  };
}

/** Una dirección de wala_direcciones/{uid}.lista → props de PaginaDirecciones. */
export const direccionDesdeFirestore = (d = {}) => ({
  id: d.id,
  principal: Boolean(d.principal),
  nombre: d.customerName || '',
  tipoDocumento: d.docType || 'DNI',
  documento: d.dni || '',
  telefono: d.phone || '',
  pais: d.country || 'PE',
  ciudad: d.city || 'Lima',
  departamento: d.department || '',
  provincia: d.province || '',
  distrito: d.district || '',
  direccion: d.address || '',
});

/** Al revés: lo que devuelve el formulario → el formato de services/direcciones (guardarDirecciones). */
export const direccionAFirestore = (d = {}) => ({
  ...(d.id ? { id: d.id } : {}),
  principal: Boolean(d.principal),
  customerName: String(d.nombre || '').trim(),
  docType: d.tipoDocumento || 'DNI',
  dni: String(d.documento || '').trim(),
  phone: String(d.telefono || '').trim(),
  country: d.pais || 'PE',
  city: d.ciudad || 'Lima',
  department: d.departamento || '',
  province: d.provincia || '',
  district: d.distrito || '',
  address: String(d.direccion || '').trim(),
});

const MESES_CORTOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "2026-10-31" → "31 de octubre" (con el año si no es el actual). */
const diaLegible = (iso) => {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  if (!m || !d) return '';
  return `${d} de ${MESES_CORTOS[m - 1]}${a && a !== new Date().getFullYear() ? ` de ${a}` : ''}`;
};

/**
 * Recompensa de rewardsCatalog → TarjetaRecompensa.
 *  - beneficio: el texto del premio (textoPremio de utils/ruletaModel, como
 *    CatalogReward); sin él, reward.value
 */
export const recompensaDesdeFirestore = (r = {}, beneficio) => ({
  id: r.id,
  titulo: r.title,
  descripcion: r.description,
  imagen: r.imageUrl || null,
  beneficio: beneficio || r.value || '',
  costo: Number(r.cost) || 0,
});

/**
 * Cupón de userCoupons → TarjetaCupon.
 *  - estado: estadoCupon(c) de services/cupones ('activo' | 'usado' | 'caducado')
 */
export const cuponDesdeFirestore = (c = {}, estado = 'activo') => ({
  id: c.id,
  codigo: c.code,
  texto: c.texto || c.titulo || c.title || 'Cupón de descuento',
  origen: c.origen,
  estado,
  vence: diaLegible(c.expiraEn),
  // Los cupones viejos del catálogo (sin tipo) los aplica un asesor.
  conAsesor: !c.tipo,
});

/**
 * Misión de getDailyMissionsSecure → TarjetaMision.
 *  - acciones: MISSION_ACTIONS (constants/missionActions): las que se cumplen
 *    en otra página llevan su botón ("Ir a Mis cupones"). Una verificable con
 *    una acción que no está en la lista lleva "Ir a hacerlo" (a las misiones,
 *    como antes): nunca "Completar", que el servidor rechazaría.
 */
export const misionDesdeServidor = (m = {}, acciones = {}) => {
  const pendiente = Boolean(m.actionKey) && !m.verified && !m.completed;
  const a = pendiente ? acciones[m.actionKey] : null;
  let accion;
  if (pendiente) accion = a ? { texto: a.goLabel || 'Ir a hacerlo', url: a.path } : { texto: 'Ir a hacerlo', url: '/cuenta/misiones' };
  return {
    id: m.missionId,
    titulo: m.title,
    descripcion: m.description,
    recompensa: Number(m.rewardPoints) || 0,
    completada: Boolean(m.completed),
    accion,
  };
};

/** TIERS de constants/tiers.js → niveles de NivelCuenta (sin el emoji: cada uno lleva su sello). */
export const nivelesDesdeTiers = (tiers = []) => tiers.map((t) => ({ clave: t.key, nombre: t.name, min: Number(t.min) || 0 }));

/**
 * Milisegundos del último guardado de un diseño, o null. `updatedAt` llega
 * como Timestamp, { seconds }, texto, número o Date; los diseños guardados
 * antes de arreglar el guardado tienen ahí un mapa sin fecha: para esos se
 * usa la hora que llevan en el nombre sus vistas previas
 * (designs/{uid}/crear/previas/{ms}_…). Lo mismo que fechaDeCreacion.
 */
export const fechaDeDiseno = (d) => {
  for (const ts of [d?.updatedAt, d?.createdAt]) {
    if (!ts) continue;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    const segundos = ts.seconds ?? ts._seconds;
    if (typeof segundos === 'number') return segundos * 1000;
    if (ts instanceof Date || typeof ts === 'string' || typeof ts === 'number') {
      const ms = new Date(ts).getTime();
      if (!Number.isNaN(ms)) return ms;
    }
  }
  let ultima = null;
  [d?.imagenConjunta, d?.previewUrl, ...(d?.vistasPrevias || []).map((p) => p?.url)].forEach((u) => {
    const m = typeof u === 'string' && u.match(/previas(?:%2F|\/)(\d{13})_/);
    if (m) ultima = Math.max(ultima || 0, Number(m[1]));
  });
  return ultima;
};

const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/**
 * "Guardada hoy / ayer / hace 3 días / hace 2 meses" desde milisegundos. Con
 * `fino` (borradores): también minutos y horas ("Editado hace 5 minutos").
 */
export const haceCuanto = (ms, prefijo = 'Guardada', { fino = false } = {}) => {
  if (!ms) return '';
  if (fino) {
    let valor = (ms - Date.now()) / 1000;
    for (const [tope, unidad] of [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']]) {
      if (Math.abs(valor) < tope) return `${prefijo} ${relativo.format(Math.round(valor), unidad)}`;
      valor /= tope;
    }
    return '';
  }
  const dias = Math.round((Date.now() - ms) / 86400000);
  if (dias < 30) return `${prefijo} ${relativo.format(-dias, 'day')}`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `${prefijo} ${relativo.format(-meses, 'month')}`;
  return `${prefijo} ${relativo.format(-Math.round(meses / 12), 'year')}`;
};

const fechaLarga = (ms) => (ms ? new Date(ms).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : undefined);

/**
 * Diseño guardado (services/designs) → TarjetaCreacion, según lo que es:
 *  - "Mi combo" (tipo 'comboCrear'): sus prendas lado a lado, su combo y el
 *    enlace al combo con lo suyo puesto
 *  - un borrador de Crear: su miniatura, "Editado hace…" y "Continuar"
 *  - una creación de Crear: su página (ver, comprar) y el estudio
 *  - un diseño del editor de antes (sin tipo): solo "Editar" en el editor
 *    (su foto, con sus capas, la dibuja la tienda: `foto`)
 * Lo que sale del catálogo vivo va en `extra` ({ precio, precioAntes,
 * disponible, comprado, imagenes, colores, aviso… }).
 */
export const creacionDesdeDiseno = (d = {}, extra = {}) => {
  const fecha = fechaDeDiseno(d);
  const base = {
    id: d.id,
    publicada: d.comunidad === 'publicada',
    comprado: d.enPedido === true,
    fechaCompleta: fechaLarga(fecha),
  };
  if (d.tipo === 'comboCrear') {
    const piezas = d.piezas || [];
    const borrador = d.estado === 'borrador';
    const url = `/combo/${d.comboId}?mio=${d.id}`;
    return {
      ...base,
      nombre: d.name || 'Mi combo',
      imagenes: piezas.some((p) => p.frente) ? piezas.map((p) => p.frente || '') : (d.previas || []),
      // La espalda de cada prenda (la tarjeta la muestra al pasar el mouse).
      imagenesEspalda: piezas.some((p) => p.frente) ? piezas.map((p) => p.espalda || '') : undefined,
      subtitulo: borrador
        ? `${piezas.filter((p) => p.designId).length} de ${piezas.length} prendas con diseño · sin terminar`
        : (d.comboNombre || 'Combo'),
      combo: String(piezas.length),
      fecha: haceCuanto(fecha, borrador ? 'Editado' : 'Guardada', { fino: borrador }),
      borrador,
      url,
      urlEditar: url,
      urlComprar: borrador ? undefined : url,
      ...extra,
    };
  }
  if (d.estado === 'borrador') {
    const url = `/crear/${d.productId}?designId=${d.id}`;
    return {
      ...base,
      nombre: d.productName || 'Mi diseño',
      imagen: d.miniatura || d.miniaturas?.[0]?.url || null,
      imagenEspalda: d.miniaturas?.[1]?.url || null,
      color: d.color?.hex ? { nombre: d.color.nombre, hex: d.color.hex } : undefined,
      subtitulo: d.color?.nombre ? `${d.color.nombre} · sin terminar` : 'Sin terminar',
      fecha: haceCuanto(fecha, 'Editado', { fino: true }),
      borrador: true,
      url,
      urlEditar: url,
      ...extra,
    };
  }
  const deCrear = d.tipo === 'crear';
  const vistas = (d.vistasPrevias || []).filter((v) => v?.url);
  const editor = `/editor/${d.productId || 'unknown'}?designId=${d.id}`;
  return {
    ...base,
    nombre: d.name || 'Sin nombre',
    imagen: deCrear ? (vistas[0]?.url || d.imagenConjunta || d.previewUrl || null) : null,
    imagenEspalda: deCrear ? (vistas[1]?.url || null) : null,
    producto: d.productName,
    color: d.color?.nombre ? { nombre: d.color.nombre, hex: d.color.hex } : undefined,
    fecha: haceCuanto(fecha),
    lados: vistas.map((v) => v.nombre).filter(Boolean).join(' + ') || undefined,
    url: deCrear ? `/creacion/${d.id}` : editor,
    urlEditar: deCrear ? `/crear/${d.productId}?designId=${d.id}` : editor,
    urlComprar: deCrear ? `/creacion/${d.id}` : undefined,
    soloEditar: !deCrear,
    ...extra,
  };
};

const RELACION_TEXTO = {
  pareja: 'Pareja', hijos: 'Hijo/a', padres: 'Padre/Madre', hermanos: 'Hermano/a',
  sobrinos: 'Sobrino/a', primos: 'Primo/a', amigos: 'Amigo/a', otros: 'Otra persona',
};

/** Persona de userProfile.giftRecipients → PaginaFechas (sin las ideas: esas salen de useGiftCatalog). */
export const personaDesdeRecipient = (r = {}) => ({
  id: r.id,
  nombre: r.name || '',
  relacion: r.roleKey || 'otros',
  relacionTexto: r.roleDisplay || RELACION_TEXTO[r.roleKey] || 'Otra persona',
  genero: r.gender || '',
  foto: r.photoUrl || null,
  presupuesto: r.budget || '',
  gustos: Object.fromEntries((r.selectedCategories || []).map((c) => [c, (r.categoryAnswers || {})[c] || {}])),
  // Lo respondido de un conjunto que se apagó: no se pierde al guardar.
  gustosApagados: Object.fromEntries(Object.entries(r.categoryAnswers || {}).filter(([c]) => !(r.selectedCategories || []).includes(c))),
  eventos: (r.events || []).map((e) => ({ id: e.id, tipo: e.type, nombre: e.customName || '', fecha: e.date || '' })),
  // "Conjunto familia" de la encuesta (familySet + sus tres respuestas).
  familia: { activo: Boolean(r.familySet), q1: Boolean(r.familyAnswers?.q1), q2: Boolean(r.familyAnswers?.q2), q3: Boolean(r.familyAnswers?.q3) },
});

/** Al revés: lo que guarda el formulario → el recipient de giftRecipients. */
export const personaARecipient = (p = {}, id) => ({
  id: p.id || id,
  roleKey: p.relacion || 'otros',
  roleDisplay: RELACION_TEXTO[p.relacion] || 'Otra persona',
  name: String(p.nombre || '').trim(),
  gender: p.genero || '',
  photoUrl: p.foto || null,
  budget: p.presupuesto || '',
  selectedCategories: Object.keys(p.gustos || {}),
  categoryAnswers: { ...(p.gustosApagados || {}), ...(p.gustos || {}) },
  events: (p.eventos || []).map((e) => ({
    id: e.id, type: e.tipo, date: e.fecha, ...(e.tipo === 'Fecha Especial' ? { customName: e.nombre } : {}),
  })),
  familySet: Boolean(p.familia?.activo),
  familyAnswers: { q1: Boolean(p.familia?.q1), q2: Boolean(p.familia?.q2), q3: Boolean(p.familia?.q3) },
});

// encuestaDesdeConfig vive en adaptadoresEncuesta.js: solo la usa la encuesta
// y aquí habría ido al archivo principal de la tienda.

/* ── Crear (/personalizar) ─────────────────────────────── */

// Los adaptadores de Crear (prendas, combos, comunidad, una creación, un
// combo) viven en adaptadoresCrear.js: solo los usan esas páginas y aquí
// habrían ido al archivo principal de la tienda.

/**
 * Una prenda base (productos_wala con prendaBase) → la prenda de
 * PaginaEstudio: sus lados (cada color con sus zonas, ver vistasDelColor) y
 * sus colores con lo que el estudio necesita para dibujarlos.
 *  - colores: [{ id, nombre, hex (fondo de la muestra), tinte (el tono para
 *    teñir la foto blanca), blanco (no se tiñe), claro (el visto va oscuro),
 *    oscura (la prenda es oscura: las guías van en blanco), fotos, espejo
 *    (bicolor al revés: las fotos se voltean), espejoDe, tallas, vistas }]
 *  - cada zona trae `anchoCm` y `altoCm` si su lado tiene escala (medidaZona):
 *    con eso el estudio mide la letra en cm y la calidad de la imagen.
 */
export const prendaEstudioDesde = (producto = {}) => {
  const cfg = leerPrendaBase(producto);
  const conMedidas = (vistas = []) => vistas.map((v) => ({
    ...v,
    zonas: (v.zonas || []).map((z) => ({ ...z, ...(medidaZona(z, v) || {}) })),
  }));
  return {
    id: producto.id,
    nombre: producto.name,
    precio: precioPersonalizado(producto),
    precioAntes: Number(producto.price) > precioPersonalizado(producto) ? Number(producto.price) : undefined,
    vistas: conMedidas(cfg.vistas),
    tallas: cfg.tallas,
    colores: cfg.colores.filter((c) => colorDisponible(c, cfg.vistas)).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      hex: fondoMuestra(c),
      tinte: c.hex,
      blanco: esColorBlanco(c.hex),
      claro: esColorBlanco(c.hex) || textoSobre(c.hex) !== '#FFFFFF',
      oscura: !c.hex2 && textoSobre(c.hex) === '#FFFFFF',
      fotos: c.fotos,
      espejo: Boolean(c.espejo),
      espejoDe: c.espejoDe,
      tallas: tallasDeColor(c, cfg),
      vistas: conMedidas(vistasDelColor(cfg.vistas, c)),
    })),
  };
};

/* ── Ficha de producto (/producto/:id) ─────────────────────── */

/**
 * Fotos sin repetir para la galería. `nombres`: el de cada foto por su url
 * (el color, o la prenda de un combo); las demás van sin píldora.
 */
const fotosGaleria = (urls, nombres = {}) => [...new Set(urls.filter(Boolean))]
  .map((url) => ({ url, nombre: nombres[url] || '' }));

/**
 * Las fotos de las vistas de personalización en un color (frente y, si
 * tiene, espalda: customizationViews[].imagesByColor), como buildImages de
 * ProductDetail. El nombre del color se compara sin espacios ni mayúsculas.
 */
const vistasPorColor = (p, color) => (p?.customizationViews || []).flatMap((vista) => {
  const de = (mapa) => {
    const k = Object.keys(mapa || {}).find((x) => mismoColor(x, color));
    return k ? [mapa[k]] : [];
  };
  return [...de(vista.imagesByColor), ...(vista.hasBackSide ? de(vista.backSide?.imagesByColor) : [])];
});

/* ── Pago rápido ─────────────────────────────────────────── */

const aFecha = (v) => {
  if (!v) return null;
  const f = typeof v.toDate === 'function' ? v.toDate() : new Date(typeof v.seconds === 'number' ? v.seconds * 1000 : v);
  return Number.isNaN(f.getTime()) ? null : f;
};
const HORAS_ENLACE_VIEJO = 36;

/**
 * Un documento de enlaces_pago → { enlace, estado } para PaginaPagoRapido.
 * Las reglas de PagoRapidoPage: vence en expiresAt (o a las 36 h de
 * createdAt en los enlaces viejos), salvo que ya esté pagado; sin moneda es
 * USD; el monto puede venir en monto, montoUSD o montoPEN.
 *  - estado: undefined (se puede pagar) | 'vencido' | 'noEncontrado' (sin doc)
 *  - enlace.vence: "Vence hoy a las 18:30", "Vence mañana a las 09:00",
 *    "Vence el 20 de octubre a las 10:15"
 */
export function enlacePagoDesde(doc, { ahora = new Date() } = {}) {
  if (!doc) return { enlace: {}, estado: 'noEncontrado' };
  const pagado = doc.estado === 'pagado';
  const creado = aFecha(doc.createdAt);
  const vence = aFecha(doc.expiresAt) || (creado ? new Date(creado.getTime() + HORAS_ENLACE_VIEJO * 3600000) : null);
  const vencido = Boolean(vence) && vence <= ahora && !pagado;
  let textoVence;
  if (vence && !pagado && !vencido) {
    const hora = vence.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dia = (f) => f.toLocaleDateString('es-PE', { year: 'numeric', month: 'numeric', day: 'numeric' });
    const manana = new Date(ahora.getTime() + 86400000);
    if (dia(vence) === dia(ahora)) textoVence = `Vence hoy a las ${hora}`;
    else if (dia(vence) === dia(manana)) textoVence = `Vence mañana a las ${hora}`;
    else textoVence = `Vence el ${vence.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })} a las ${hora}`;
  }
  return {
    estado: vencido ? 'vencido' : undefined,
    enlace: {
      id: doc.id,
      concepto: doc.concepto || '',
      monto: Number(doc.monto || doc.montoUSD || doc.montoPEN || 0),
      moneda: doc.moneda || 'USD',
      vence: textoVence,
      pagado,
      transaccion: doc.paypalOrderId || doc.culqiChargeId || doc.transaccion || undefined,
    },
  };
}

/* ── Carrito ─────────────────────────────────────────────── */

const esRelleno = (u) => !u || String(u).includes('placeholder');

/**
 * Una línea del carrito (CartContext) → props de ItemCarrito.
 *  - catalogo: Map productId → producto (la caché de la tienda, leída UNA vez
 *    para todo el carrito): para no mostrar "Color: Principal" y para las
 *    bolitas de color de las prendas de un combo
 *  - falta: lo que le falta (['color', 'talla'], de cartValidation) si la
 *    línea está incompleta
 * Mismos enlaces que CartItem: el combo de Crear a /combo/:id?mio=, una
 * creación a /creacion/:designId, lo demás a /producto/:id.
 */
export function itemCarritoDesde(item = {}, { catalogo = new Map(), falta } = {}) {
  const custom = item.customization || null;
  const piezasCrear = custom?.tipo === 'comboCrear' ? custom.piezas || [] : null;
  // Un cuadro, mousepad o tomatodo hecho con el personalizador anterior (oct.
  // 2026) ya no se puede producir: hay que volver a crearlo en Crear.
  const editorAnterior = Boolean(custom?.datosYoryo || piezasCrear?.some((p) => p?.datosYoryo));
  let url = `/producto/${item.productId}`;
  if (piezasCrear) url = `/combo/${item.productId}${custom.miComboId ? `?mio=${custom.miComboId}` : ''}`;
  else if (custom?.tipo === 'crear' && custom.designId) url = `/creacion/${custom.designId}`;

  const precio = custom?.finalPrice || item.price || 0;
  // El precio de antes solo sin personalización (con diseño, el precio es otro).
  const precioAntes = !custom && item.regularPrice > precio ? item.regularPrice : undefined;

  // Un combo sin portada se ve con la foto de su primera prenda (sin pedir nada).
  const imagen = item.isComboProduct && esRelleno(item.productImage)
    ? (item.comboItems || []).map((it) => it.imageUrl).find((u) => !esRelleno(u)) || item.productImage
    : item.productImage;

  // "Color: Principal" no dice nada: el color se muestra si hay talla o si el
  // producto tiene más de un color (sin el producto, se muestra).
  const producto = catalogo.get(item.productId);
  const conColor = Boolean(item.variant?.size) || !producto || (producto.variants?.length || 0) > 1;
  const color = item.variant?.selectedVariant?.name || item.variant?.color || '';
  const detalles = [];
  if (!item.isComboProduct && !piezasCrear) {
    if (color && conColor) detalles.push({ etiqueta: 'Color', valor: color, hex: item.variant?.colorHex || item.variant?.selectedVariant?.colorHex || undefined });
    if (item.variant?.size) detalles.push({ etiqueta: item.variant?.selectedVariant?.sizeLabel || 'Talla', valor: item.variant.size });
  }

  let piezas = [];
  if (piezasCrear) {
    piezas = piezasCrear.map((p) => ({
      texto: [p.prendaNombre, p.color?.nombre, p.talla && `Talla ${p.talla}`].filter(Boolean).join(' · ')
        + (p.nombre && !String(p.nombre).toLowerCase().includes(String(p.prendaNombre || '').toLowerCase()) ? ` · “${p.nombre}”` : ''),
      hex: p.color?.hex,
    }));
  } else if (item.isComboProduct) {
    // Cada prenda con su nombre (antes "Producto 1: …"), su color y la talla.
    piezas = Object.entries(item.comboVariantSelections || {}).map(([i, sel]) => {
      const it = (item.comboItems || [])[i] || {};
      const sub = catalogo.get(it.productId);
      const hex = sub?.variants?.find((v) => mismoColor(v.name, sel?.color))?.colorHex;
      return { texto: [it.name || `Prenda ${Number(i) + 1}`, sel?.color, sel?.size && `Talla ${sel.size}`].filter(Boolean).join(' · '), hex };
    });
  }

  return {
    id: item.id,
    imagen,
    nombre: item.productName,
    precio,
    precioAntes,
    cantidad: item.quantity || 1,
    seleccionado: item.selected !== false,
    url,
    avisoPersonalizacion: editorAnterior ? 'Este diseño se hizo con el editor anterior. Quítalo y vuelve a crearlo en Crear para poder pagarlo.' : undefined,
    detalles,
    combo: Boolean(item.isComboProduct || piezasCrear),
    piezas,
    personalizado: Boolean(custom) && !piezasCrear,
    incompleto: editorAnterior ? 'personalización' : falta?.length ? falta.join(' y ') : undefined,
    urlElegir: editorAnterior ? '/personalizar' : falta?.length ? url : undefined,
  };
}

/**
 * Un producto de productos_wala → props de PaginaProducto (sin las opiniones
 * ni los relacionados, que llegan por su lado).
 *  - catalogo: { marcas, categorias } (para la marca y las migas)
 *  - subproductos: { [productId]: producto } de las piezas de un combo
 * Devuelve { producto, opciones (las de opcionesDeProducto), varianteInicial,
 * fotos: { base: [...], [varianteId]: [...], combo? } }. Las fotos de una
 * variante son las de sus vistas de personalización en ese color y las suyas
 * (imageUrl, galleryImages, images), y después las generales del producto
 * que no son de otro color (fotosGenerales); si no tiene, las del producto.
 * En un combo, `combo` = { portada, piezas: [{ porColor: { [color]: urls },
 * general: urls }], producto }: PaginaProducto arma la galería con el color
 * elegido de cada prenda; si ese color no tiene foto (o la prenda no tiene
 * colores), van las de la prenda (general).
 */
export function fichaProductoDesde(p = {}, { catalogo = {}, subproductos = {} } = {}) {
  const { marcas = [], categorias = [] } = catalogo;
  const m = p.brandId ? marcas.find((x) => x.id === p.brandId) : null;
  const cat = (p.categories || []).map((id) => categorias.find((c) => (c.categoryId || c.id) === id)).find(Boolean);
  const delProducto = [p.mainImage, ...(p.images || [])];
  // El relleno que recibe un combo sin portada no es una foto de la galería.
  const urls = (lista) => [...new Set(lista.filter((u) => !esRelleno(u)))];
  const base = p.isComboProduct
    ? fotosGaleria(urls([portadaDeCombo(p), ...(p.comboItems || []).map((it) => it.imageUrl), ...delProducto]), Object.fromEntries((p.comboItems || []).map((it) => [it.imageUrl, it.name])))
    : fotosGaleria(delProducto);
  const fotos = { base };
  if (p.isComboProduct) {
    fotos.combo = {
      portada: urls([portadaDeCombo(p)]),
      piezas: (p.comboItems || []).map((it) => {
        const sub = subproductos[it.productId];
        const vs = variantesDePieza(sub, it);
        return {
          porColor: Object.fromEntries(vs.map((v) => [v.name, urls([...vistasPorColor(sub, v.name), v.imageUrl, ...(v.galleryImages || []), ...(v.images || [])])])),
          general: urls([it.imageUrl, sub?.mainImage, ...(sub?.images || [])]),
        };
      }),
      producto: urls(delProducto),
    };
  }
  // Con un solo color también van sus fotos (su galería no está en el
  // producto); solo la píldora con el color, que ahí no dice nada, se omite.
  const unColor = variantesDe(p).length === 1;
  variantesDe(p).forEach((v) => {
    const propias = [...vistasPorColor(p, v.name), v.imageUrl, ...(v.galleryImages || []), ...(v.images || [])].filter(Boolean);
    // Después de las suyas, las generales del producto que no son de otro color.
    fotos[v.id] = propias.length ? fotosGaleria([...propias, ...fotosGenerales(p, v)], unColor ? {} : { [propias[0]]: v.name }) : base;
  });
  const precio = p.salePrice || p.price;
  return {
    producto: {
      id: p.id,
      nombre: p.name,
      marca: m?.name ? { nombre: m.name, url: `/${rutaDeMarca(m)}`, logo: m.logoUrl || '' } : undefined,
      categoria: cat ? { nombre: cat.name, url: `/tienda?categoria=${cat.categoryId || cat.id}` } : undefined,
      precio,
      precioAntes: p.salePrice && p.salePrice < p.price ? p.price : undefined,
      stock: typeof p.inStock === 'number' ? p.inStock : undefined,
      agotado: agotadoDe(p),
      // Los productos de la tienda ya no se personalizan (eso es Crear); la
      // ficha lo vuelve a poner con el interruptor personalizableViejo.
      personalizable: Boolean(p.esPrendaBase),
      // Una prenda de Crear en la tienda: solo "Personalízalo" (sin carrito).
      soloPersonalizar: Boolean(p.esPrendaBase),
      descripcion: p.description || '',
      combo: p.isComboProduct ? (p.comboItems || []).map((it) => ({ nombre: it.name || subproductos[it.productId]?.name || 'Producto', imagen: it.imageUrl })) : undefined,
    },
    opciones: opcionesDeProducto(p, { subproductos }),
    // La variante que el admin marcó como principal (la tienda hoy abre siempre la primera).
    varianteInicial: (variantesDe(p).find((v) => String(v.id) === String(p.defaultVariantId)) || variantesDe(p)[0])?.id,
    fotos,
  };
}

/**
 * Las opiniones de product_reviews → props de las opiniones de la ficha.
 * Firma con el nombre y la inicial del apellido (no el nombre completo).
 *  - uid: el de quien mira (para saber si ya la marcó útil)
 */
export function opinionesDesde(resenas = [], { uid } = {}) {
  const firma = (n) => {
    const [nombre, apellido] = String(n || 'Cliente de Walá').trim().split(/\s+/);
    return apellido ? `${nombre} ${apellido[0].toUpperCase()}.` : nombre;
  };
  const lista = resenas.map((r) => ({
    id: r.id,
    autor: firma(r.userName),
    fecha: r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
    puntuacion: Number(r.rating) || 0,
    texto: r.comment,
    fotos: r.imageUrls || [],
    utiles: (r.helpfulVotes || []).length,
    marcada: Boolean(uid) && (r.helpfulVotes || []).includes(uid),
  }));
  const total = lista.length;
  const porEstrella = lista.reduce((a, o) => ({ ...a, [o.puntuacion]: (a[o.puntuacion] || 0) + 1 }), {});
  return {
    lista,
    total,
    promedio: total ? lista.reduce((t, o) => t + o.puntuacion, 0) / total : 0,
    porEstrella,
  };
}

/* ── Nav de categorías de una marca (categories_nav) ── */

const ALINEAR_NAV = ['left', 'center', 'right', 'justify'];
const idDeCategoria = (c) => ((c && typeof c === 'object') ? (c.id || c.slug || c.name || '') : (c || ''));

/**
 * Las burbujas de categories_nav de una marca, con la regla de TiendaPage
 * (navCategoriesByBrand):
 *  - la lista curada de la marca (tienda_brands.categoryNav: su orden, su
 *    nombre y su foto; sin nombre o foto, los de la categoría), solo con las
 *    categorías que tienen productos visibles de la marca;
 *  - y al final, las categorías que la marca ya usa y no están en la lista
 *    (por el orden de la categoría y el nombre);
 *  - sin lista curada, todas las que usa (mismo orden).
 *  - estilo: categoryNavStyle → { align, animation } (center/static por defecto).
 * marca: el doc de tienda_brands · productos: los de la marca (visibles) ·
 * categorias: tienda_categories [{ id, name, imageUrl, order }]
 */
export function navDeMarca(marca = {}, { productos = [], categorias = [] } = {}) {
  const porId = new Map(categorias.filter((c) => c?.id).map((c) => [c.id, c]));
  const enUso = new Set();
  productos.forEach((p) => {
    [...(Array.isArray(p.categories) ? p.categories : []), p.categoryId, p.category].forEach((c) => {
      const id = idDeCategoria(c);
      if (id) enUso.add(id);
    });
  });
  const auto = (ids) => ids
    .map((id) => porId.get(id))
    .filter(Boolean)
    .map((c) => ({ categoryId: c.id, name: c.name || '', imageUrl: c.imageUrl || '', order: typeof c.order === 'number' ? c.order : 0 }))
    .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
  const curada = Array.isArray(marca.categoryNav) ? marca.categoryNav : [];
  let items;
  if (curada.length) {
    const elegidas = [...curada]
      .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
      .map((it) => {
        const categoryId = idDeCategoria(it?.categoryId);
        const c = porId.get(categoryId);
        return { categoryId, name: it?.name || c?.name || '', imageUrl: it?.imageUrl || c?.imageUrl || '' };
      })
      .filter((it) => it.categoryId && enUso.has(it.categoryId));
    const ya = new Set(elegidas.map((it) => it.categoryId));
    items = [...elegidas, ...auto([...enUso].filter((id) => !ya.has(id)))];
  } else {
    items = auto([...enUso]);
  }
  const e = marca.categoryNavStyle || {};
  return {
    items: items.map(({ categoryId, name, imageUrl }) => ({ categoryId, name, imageUrl })),
    estilo: {
      align: ALINEAR_NAV.includes(e.align) ? e.align : 'center',
      animation: ['static', 'slider'].includes(e.animation) ? e.animation : 'static',
    },
  };
}

/* ── Página de marca: identidad y plantilla ── */

/** Los bloques de la plantilla de una marca, en su orden. */
export const BLOQUES_MARCA = ['categorias', 'destacados', 'ofertas', 'catalogo'];

const casiBlanco = (hex) => /^#?(f{3}|f{6}|fefefe|fdfdfd|fafafa)$/i.test(String(hex || '').trim());

/**
 * La identidad de una marca para su página (TemaMarca + PortadaMarca), desde
 * su doc de tienda_brands. Los campos de `identidad` son los que se eligen en
 * el panel de la marca (a futuro); sin ellos, lo que ya hay: bgColor si no es
 * blanco (todas lo tienen blanco hoy) y el violeta de Walá si no.
 *  → { color, color2, estilo: 'foto' | 'color' | 'collage', imagen, frase, bloques }
 */
export function identidadDeMarca(marca = {}) {
  const i = marca.identidad || {};
  const color = i.color || (marca.bgColor && !casiBlanco(marca.bgColor) ? marca.bgColor : '');
  return {
    color,
    color2: i.color2 || '',
    estilo: ['foto', 'color', 'collage'].includes(i.estilo) ? i.estilo : (i.imagen ? 'foto' : 'color'),
    imagen: i.imagen || '',
    frase: i.frase || (marca.name ? `Productos de ${marca.name}` : ''),
    bloques: Array.isArray(i.bloques) ? i.bloques.filter((b) => BLOQUES_MARCA.includes(b)) : BLOQUES_MARCA,
  };
}

/**
 * Las secciones de la página de una marca sin armarlas a mano en el builder
 * (las mismas que hoy repiten 7 landings): las burbujas de sus categorías,
 * lo más pedido, sus ofertas (si hay) y su catálogo con filtros. Son
 * secciones normales del builder: se dibujan con RenderSecciones.
 *  - brandId, nombre · bloques (BLOQUES_MARCA, en ese orden; los que no
 *    estén no salen) · hayDestacados, hayOfertas (sin productos, la fila
 *    no sale)
 */
/** La forma de la página de una marca mientras carga (EsqueletoPagina secciones). */
export const ESQUELETO_MARCA = ['hero_banner', 'categories_nav', 'featured_carousel', 'sidebar_catalog'];

/** Las filas de la página de una marca van más juntas que las del inicio (es una sola marca). */
const JUNTAS = { paddingTop: '1rem', paddingBottom: '1.5rem' };

export function plantillaDeMarca({ brandId, nombre = '', bloques = BLOQUES_MARCA, hayDestacados = true, hayOfertas = true } = {}) {
  const pedidas = new Set(bloques);
  const secciones = [
    pedidas.has('categorias') && { type: 'categories_nav', settings: { brandId } },
    pedidas.has('destacados') && hayDestacados && { type: 'featured_carousel', settings: { title: 'Lo más pedido', titleUnderline: true, visibleItems: 5, ...JUNTAS } },
    pedidas.has('ofertas') && hayOfertas && { type: 'sale_carousel', settings: { title: 'En oferta', titleUnderline: true, visibleItems: 5, ...JUNTAS } },
    pedidas.has('catalogo') && { type: 'sidebar_catalog', settings: { title: nombre ? `Todo ${nombre}` : 'Todos los productos', titleUnderline: true, brandId, anchorId: 'catalogo', ...JUNTAS } },
  ].filter(Boolean);
  return secciones.map((sec, k) => ({ id: `marca-${sec.type}`, order: k + 1, ...sec }));
}
