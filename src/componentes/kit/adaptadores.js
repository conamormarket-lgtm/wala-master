/*
 * Adaptadores: producto de la tienda (colección productos_wala, ver
 * normalizeProductForRead en src/services/products.js) → props del kit.
 *
 * El kit no lee Firestore; estas funciones solo traducen nombres de campos
 * para usar <TarjetaProducto> y <AgregarRapido> con productos reales.
 */

import { limaTodayStr, felicidadKapiHoy } from '../../utils/fechaLima';
import { getFallbackHex } from '../../utils/colors';
import {
  leerPrendaBase, colorDisponible, fondoMuestra, precioBase, precioPersonalizado, tallasDeColor, fondoColorGuardado,
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
  if (p?.esPrendaBase) return 'crear';
  if (p?.isComboProduct && p.comboItems?.length) return 'elegir';
  const vs = variantesDe(p);
  if (vs.length > 1 || vs.some((v) => v.sizes?.length) || p?.mainSizes?.length) return 'elegir';
  return 'agregar';
}

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
export function tarjetaDesdeProducto(p, { imagen, catalogo = {} } = {}) {
  const vs = variantesDe(p);
  const { marcas = [], categorias = [], marcaActual = null } = catalogo;
  const m = !marcaActual && p.brandId ? marcas.find((x) => x.id === p.brandId) : null;
  const cat = (p.categories || []).map((id) => categorias.find((c) => (c.categoryId || c.id) === id)).find(Boolean);
  const principal = vs.find((v) => String(v.id) === String(p.defaultVariantId)) || vs[0];
  const fotos = [principal?.imageUrl, ...(principal?.images || []), p.mainImage, ...(p.images || [])].filter(Boolean);
  return {
    url: p.esPrendaBase ? `/crear/${p.id}` : `/producto/${p.id}`,
    imagen: imagen || fotos[0],
    imagenHover: fotos.find((f) => f !== (imagen || fotos[0])),
    nombre: p.name,
    categoria: cat?.name,
    precio: p.salePrice || p.price,
    precioAntes: p.salePrice ? p.price : undefined,
    personalizable: Boolean(p.customizable),
    agotado: !p.inStock,
    stock: typeof p.inStock === 'number' ? p.inStock : undefined,
    nuevo: esNuevo(p),
    marca: m?.logoUrl ? { nombre: m.name, logo: m.logoUrl } : undefined,
    piezas: p.isComboProduct ? (p.comboItems || []).map((it) => ({ nombre: it.name, imagen: it.imageUrl })) : [],
    // Con una sola variante (la "Principal" que crea el admin por defecto) no
    // hay colores que mostrar.
    colores: vs.length > 1 ? vs.filter((v) => v.colorHex).map((v) => v.colorHex) : [],
    accion: accionDeProducto(p),
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
  // Combos: talla compartida = las que tienen todas las piezas (o todas, si no
  // coinciden). Es la de todos los colores: con los elegidos la recalcula
  // OpcionesProducto (tallasDe).
  let opcionesCombo = [];
  if (piezas.length) {
    const listas = piezas.map((pz) => (pz.colores.length ? [...new Set(pz.colores.flatMap((c) => c.tallas))] : pz.tallas)).filter((l) => l.length);
    const comunes = listas.reduce((a, l) => a.filter((x) => l.includes(x)), listas[0] || []);
    opcionesCombo = comunes.length ? comunes : [...new Set(listas.flat())];
  }
  return {
    producto: { nombre: p.name, imagen: p.mainImage || p.images?.[0], precio: p.salePrice || p.price, precioAntes: p.salePrice ? p.price : undefined },
    variantes: piezas.length ? [] : vs.map((v) => {
      const hex = hexDeVariante(v);
      return { id: v.id, nombre: v.name, colorHex: hex, claro: hex ? esClaro(hex) : undefined, imagen: v.imageUrl, opciones: v.sizes || [] };
    }),
    opciones: piezas.length ? opcionesCombo : p.mainSizes || [],
    // Los productos guardados antes de que products.js conservara sizeLabel
    // no lo tienen: dicen "Talla" hasta que se vuelvan a guardar.
    etiquetaOpcion: vs.find((v) => v.sizeLabel)?.sizeLabel || 'Talla',
    piezas,
    personalizable: Boolean(p.customizable),
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

const BANNERS_ARCADE = {
  palabra: '/assets/kapi/banners/palabra.webp',
  kapi: '/assets/kapi/banners/alimenta.webp',
  ruleta: '/assets/kapi/banners/ruleta.webp',
  bolitas: '/assets/kapi/banners/bolitas.webp',
};

/**
 * Las cuatro tarjetas de la Zona Arcade (props de TarjetaJuego) y cuántos
 * juegos quedan hoy, con la misma lógica de MinijuegosPage. No decide nada:
 * el día lo dice el servidor (hora de Lima) y la página pasa lo que ya sabe.
 *  - sesion, cargando: sin sesión cada botón lleva a iniciar sesión; mientras
 *    se resuelve, botones "cargando" (que no se anuncie un juego ya hecho).
 *  - palabraHecha (wordle de hoy), kapiReclamado (lastKapiClaimDate === hoy),
 *    kapiDoble (multiplicador kapi_double_3d vigente), bolitasHechas
 *    (lastBallSortReward === hoy)
 *  - ruleta: { desbloqueada, girada, perdida, empezada, pendienteAnterior,
 *    dias } (getRuletaEligibility)
 *  - hasta: { manana, lunes } fechas ISO de la próxima medianoche de Lima y del
 *    lunes (para "Disponible de nuevo en…")
 *  - onAlimentar: abre la ventana de Kapi (la tienda dispara 'open-kapi-pet')
 */
export function juegosDelArcade({
  sesion = false, cargando = false, palabraHecha: palabra = false, kapiReclamado: kapi = false, kapiDoble = false,
  bolitasHechas: bolitas = false, ruleta: ruletaPerfil = {}, hasta = {}, onAlimentar, urlLogin = '/login', banners = BANNERS_ARCADE,
} = {}) {
  // Sin sesión no hay perfil: nada está hecho y la ruleta está en cero (como
  // la tienda con userProfile null).
  const palabraHecha = sesion && palabra;
  const kapiReclamado = sesion && kapi;
  const bolitasHechas = sesion && bolitas;
  const ruleta = sesion ? ruletaPerfil : {};
  const { desbloqueada = false, girada = false, perdida = false, empezada = false, pendienteAnterior = false } = ruleta;
  const dias = Math.max(0, Math.min(7, Number(ruleta.dias) || 0));
  const esperaDiaria = hasta.manana ? { hasta: hasta.manana, texto: 'Disponible de nuevo en' } : undefined;
  // Botón según la sesión: sin sesión todos llevan a entrar.
  const boton = (hecho) => {
    if (cargando) return { tipo: 'cargando', texto: 'Cargando…' };
    if (!sesion) return { tipo: 'login', texto: 'Inicia sesión', url: urlLogin };
    return hecho;
  };
  const faltan = 7 - dias;

  const juegos = [
    {
      id: 'palabra',
      imagen: banners.palabra,
      titulo: 'Palabra del Día',
      descripcion: 'Adivina la palabra oculta en 6 intentos y compite en el ranking global.',
      estado: palabraHecha ? { texto: 'Hecho hoy', tono: 'exito' } : { texto: 'Nuevo reto cada día', tono: 'exito' },
      recompensa: { texto: 'Hasta +4 monedas al acertar' },
      atenuada: palabraHecha,
      espera: palabraHecha && sesion ? esperaDiaria : undefined,
      accion: boton(palabraHecha
        ? { tipo: 'hecho', texto: 'Ver mi resultado', url: '/palabra-del-dia' }
        : { tipo: 'jugar', texto: 'Jugar ahora', url: '/palabra-del-dia' }),
    },
    {
      id: 'kapi',
      imagen: banners.kapi,
      titulo: 'Alimenta a Kapi',
      descripcion: 'Reclama tu moneda gratis cada día para ahorrar en tus compras.',
      estado: kapiReclamado ? { texto: 'Hecho hoy', tono: 'exito' } : { texto: 'Disponible hoy', tono: 'aviso', punto: true },
      recompensa: { texto: kapiDoble ? '+2 monedas hoy' : '+1 moneda al día' },
      atenuada: kapiReclamado,
      espera: kapiReclamado && sesion ? esperaDiaria : undefined,
      accion: boton(kapiReclamado
        ? { tipo: 'hecho', texto: 'Reclamado hoy', onClick: onAlimentar }
        : { tipo: 'jugar', texto: 'Reclamar moneda', onClick: onAlimentar }),
    },
    {
      id: 'ruleta',
      imagen: banners.ruleta,
      titulo: 'Ruleta Semanal',
      descripcion: 'Reclama tu moneda los 7 días para girar la ruleta y ganar premios increíbles.',
      estado: desbloqueada ? { texto: 'Giro disponible', tono: 'violeta', punto: true }
        : girada ? { texto: 'Girada', tono: 'exito' }
          : perdida ? { texto: 'Semana perdida', tono: 'peligro' }
            : { texto: 'Bloqueada', tono: 'neutro' },
      recompensa: { texto: 'Premio semanal', icono: 'regalo' },
      racha: { dias, de: 7 },
      nota: pendienteAnterior ? { tipo: 'buena', texto: '¡Tienes un giro pendiente de la semana pasada!' }
        : !desbloqueada ? {
          tipo: girada ? 'hecho' : 'bloqueo',
          texto: girada ? 'Ya giraste esta semana. Vuelve el próximo lunes.'
            : perdida ? 'Perdiste un día esta semana. ¡La próxima no falles!'
              : 'Reclama 7 días seguidos para desbloquearla.',
        } : undefined,
      // Bloqueada por la racha, lo que falta no es tiempo sino días.
      espera: girada ? (hasta.lunes ? { hasta: hasta.lunes, texto: 'Vuelve el lunes, en' } : undefined)
        : !desbloqueada && !perdida && dias < 7
          ? (empezada ? `Te falta${faltan === 1 ? '' : 'n'} ${faltan} ${faltan === 1 ? 'día' : 'días'} de racha` : 'Alimenta a Kapi cada día para desbloquearla')
          : undefined,
      atenuada: !desbloqueada,
      bloqueada: !desbloqueada,
      accion: boton(desbloqueada
        ? { tipo: 'jugar', texto: 'Girar ruleta', url: '/ruleta' }
        : { tipo: 'bloqueado', texto: girada ? 'Ya giraste esta semana' : 'Bloqueada' }),
    },
    {
      id: 'bolitas',
      imagen: banners.bolitas,
      titulo: 'Las Bolitas de Kapi',
      descripcion: 'Ordena los colores en los tubos para ganar 2 monedas al día.',
      estado: bolitasHechas ? { texto: 'Hecho hoy', tono: 'exito' } : { texto: 'Disponible hoy', tono: 'violeta', punto: true },
      recompensa: { texto: '+2 monedas al día' },
      atenuada: bolitasHechas,
      espera: bolitasHechas && sesion ? esperaDiaria : undefined,
      // Ya hecha, se puede jugar por diversión, sin prometer premio.
      accion: boton(bolitasHechas
        ? { tipo: 'hecho', texto: 'Completado — jugar igual', url: '/ball-sort' }
        : { tipo: 'jugar', texto: 'Jugar ahora', url: '/ball-sort' }),
    },
  ];

  const listos = sesion && !cargando
    ? (palabraHecha ? 0 : 1) + (kapiReclamado ? 0 : 1) + (desbloqueada ? 1 : 0) + (bolitasHechas ? 0 : 1)
    : 0;
  // Mientras se resuelve la sesión no se anuncia nada (ni "Hecho hoy" ni
  // "Disponible"): solo el botón cargando.
  if (cargando) {
    return { listos, juegos: juegos.map((j) => ({ ...j, estado: undefined, espera: undefined, nota: undefined, atenuada: false, bloqueada: false })) };
  }
  return { juegos, listos };
}

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
  return {
    nombre: perfil.displayName || perfil.nombre || usuario.displayName || String(usuario.email || '').split('@')[0],
    email: usuario.email || perfil.email || '',
    avatar: perfil.avatarConfig?.avatarUrl || usuario.photoURL || null,
    pais,
    tipoDocumento: pais === 'PE' ? (perfil.tipoDocumento || 'DNI') : 'OTRO',
    documento: perfil.dni || '',
    telefono: pais === 'PE' ? (perfil.phone || '') : (perfil.phoneIntl?.localNumber || perfil.phone || ''),
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
 *    en otra página llevan su botón ("Ir a Mis cupones").
 */
export const misionDesdeServidor = (m = {}, acciones = {}) => {
  const a = m.actionKey && !m.verified ? acciones[m.actionKey] : null;
  return {
    id: m.missionId,
    titulo: m.title,
    descripcion: m.description,
    recompensa: Number(m.rewardPoints) || 0,
    completada: Boolean(m.completed),
    accion: a && !m.completed ? { texto: a.goLabel || 'Ir a hacerlo', url: a.path } : undefined,
  };
};

/** "Guardada hoy / ayer / hace N días" desde una fecha (Timestamp, ms o ISO). */
const haceCuanto = (f, prefijo = 'Guardada') => {
  const ms = typeof f === 'number' ? f : typeof f === 'string' ? Date.parse(f) : ((f?.seconds || f?._seconds || 0) * 1000);
  if (!ms) return '';
  const dias = Math.floor((Date.now() - ms) / 86400000);
  if (dias <= 0) return `${prefijo} hoy`;
  if (dias === 1) return `${prefijo} ayer`;
  return `${prefijo} hace ${dias} días`;
};

/**
 * Diseño guardado (services/designs) → TarjetaCreacion. Lo que sale del
 * catálogo vivo va en `extra`: { precio, precioAntes, disponible, comprado }
 * (MisCreacionesPage lo cruza con getProduct y usePedidos).
 */
export const creacionDesdeDiseno = (d = {}, extra = {}) => {
  const deCrear = d.tipo === 'crear';
  const vistas = d.vistasPrevias || [];
  return {
    id: d.id,
    nombre: d.name,
    imagen: vistas[0]?.url || d.imagenConjunta || d.previewUrl || null,
    imagenEspalda: deCrear ? (vistas[1]?.url || null) : null,
    producto: d.productName,
    color: d.color ? { nombre: d.color.nombre, hex: d.color.hex } : undefined,
    fecha: haceCuanto(d.updatedAt || d.createdAt),
    publicada: d.comunidad === 'publicada',
    combo: d.combo?.nombre,
    lados: vistas.length > 1 ? 'Frente + Espalda' : undefined,
    urlEditar: deCrear ? `/crear/${d.productId}?designId=${d.id}` : `/editor/${d.productId}?designId=${d.id}`,
    urlComprar: deCrear ? `/creacion/${d.id}` : undefined,
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
  categoryAnswers: p.gustos || {},
  events: (p.eventos || []).map((e) => ({
    id: e.id, type: e.tipo, date: e.fecha, ...(e.tipo === 'Fecha Especial' ? { customName: e.nombre } : {}),
  })),
  familySet: Boolean(p.familia?.activo),
  familyAnswers: { q1: Boolean(p.familia?.q1), q2: Boolean(p.familia?.q2), q3: Boolean(p.familia?.q3) },
});

/**
 * tienda_encuesta_config (getSurveyConfig, con DEFAULT_SURVEY_CONFIG) →
 * { config, conjuntos } de PaginaEncuesta. Las sugerencias de cada campo de
 * texto salen de useGiftCatalog (sugerenciasCampo): pasarlas en `sugerencias`.
 *  - sugerencias(conjunto, campo) → [texto]
 */
export const encuestaDesdeConfig = (c = {}, sugerencias) => ({
  config: {
    portada: {
      titulo: c.introPanel?.title,
      subtitulo: c.introPanel?.subtitle,
      textoEmpezar: c.introPanel?.continueButtonText,
      textoOmitir: c.introPanel?.skipButtonText,
    },
    sobreTi: {
      titulo: c.basicDataPanel?.title,
      subtitulo: c.basicDataPanel?.subtitle,
      campos: (c.basicDataPanel?.fields || []).map((f) => ({
        id: f.id, etiqueta: f.label, tipo: f.type === 'select' ? 'opciones' : 'texto', opciones: f.options || [], requerido: Boolean(f.required),
      })),
    },
    gracias: {
      titulo: c.completionPanel?.title,
      mensaje: c.completionPanel?.message,
      textoBoton: c.completionPanel?.buttonText,
    },
  },
  conjuntos: (c.brandsPanel?.categories || []).map((cat) => ({
    id: cat.id,
    nombre: cat.name,
    campos: (cat.fields || []).map((f) => (f.type === 'select'
      ? { id: f.id, etiqueta: f.label, opciones: f.options || [] }
      : { id: f.id, etiqueta: f.label, sugerencias: sugerencias ? sugerencias(cat, f) : [] })),
  })),
});

/* ── Crear (/personalizar) ─────────────────────────────── */

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
    url: `/combo/${combo.id}?nuevo=1`,
  };
};

/**
 * Un diseño de la comunidad (listarComunidad) → TarjetaCreacion con `usar`:
 * frente y espalda (o las prendas de un combo), prenda y color, quién lo
 * hizo y cuántos lo usaron.
 */
export const disenoComunidadDesde = (d = {}) => {
  const previas = (d.vistasPrevias || []).filter((p) => p?.url);
  const esCombo = d.tipo === 'combo';
  const url = esCombo ? `/combo/${d.comboId}?plantilla=${d.id}` : `/crear/${d.productId}?plantilla=${d.id}`;
  return {
    id: d.id,
    nombre: d.nombre,
    imagen: previas[0]?.url || d.imagenConjunta || d.previewUrl || '',
    imagenEspalda: esCombo ? undefined : previas[1]?.url,
    imagenes: esCombo ? (d.piezas || []).map((p) => (p.vistasPrevias || []).find((v) => v?.url)?.url || p.imagenConjunta || p.previewUrl).filter(Boolean) : undefined,
    combo: esCombo ? String((d.piezas || []).length) : undefined,
    producto: esCombo ? (d.comboNombre || d.productName) : d.productName,
    color: !esCombo && d.color?.nombre ? { nombre: d.color.nombre, hex: d.color.hex } : undefined,
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
 * Un producto de productos_wala → props de PaginaProducto (sin las opiniones
 * ni los relacionados, que llegan por su lado).
 *  - catalogo: { marcas, categorias } (para la marca y las migas)
 *  - subproductos: { [productId]: producto } de las piezas de un combo
 * Devuelve { producto, opciones (las de opcionesDeProducto), varianteInicial,
 * fotos: { base: [...], [varianteId]: [...], combo? } }. Las fotos de una
 * variante son las suyas (imageUrl, galleryImages, images) y, si no tiene,
 * las del producto: el mismo orden que buildImages de ProductDetail.
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
  const base = p.isComboProduct
    ? fotosGaleria([p.comboPreviewImage, ...(p.comboItems || []).map((it) => it.imageUrl), ...delProducto], Object.fromEntries((p.comboItems || []).map((it) => [it.imageUrl, it.name])))
    : fotosGaleria(delProducto);
  const fotos = { base };
  if (p.isComboProduct) {
    const urls = (lista) => [...new Set(lista.filter(Boolean))];
    fotos.combo = {
      portada: urls([p.comboPreviewImage]),
      piezas: (p.comboItems || []).map((it) => {
        const sub = subproductos[it.productId];
        const vs = variantesDePieza(sub, it);
        return {
          porColor: Object.fromEntries(vs.map((v) => [v.name, urls([v.imageUrl, ...(v.galleryImages || []), ...(v.images || [])])])),
          general: urls([it.imageUrl, sub?.mainImage, ...(sub?.images || [])]),
        };
      }),
      producto: urls(delProducto),
    };
  }
  variantesDe(p).forEach((v) => {
    const propias = [v.imageUrl, ...(v.galleryImages || []), ...(v.images || [])].filter(Boolean);
    fotos[v.id] = propias.length && variantesDe(p).length > 1 ? fotosGaleria([...propias, ...delProducto], { [propias[0]]: v.name }) : base;
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
      agotado: !p.inStock,
      personalizable: Boolean(p.customizable),
      urlPersonalizar: p.customizable ? `/editor/${p.id}` : undefined,
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

export function plantillaDeMarca({ brandId, nombre = '', bloques = BLOQUES_MARCA, hayDestacados = true, hayOfertas = true } = {}) {
  const pedidas = new Set(bloques);
  const secciones = [
    pedidas.has('categorias') && { type: 'categories_nav', settings: { brandId } },
    pedidas.has('destacados') && hayDestacados && { type: 'featured_carousel', settings: { title: 'Lo más pedido', titleUnderline: true, visibleItems: 5 } },
    pedidas.has('ofertas') && hayOfertas && { type: 'sale_carousel', settings: { title: 'En oferta', titleUnderline: true, visibleItems: 5 } },
    pedidas.has('catalogo') && { type: 'sidebar_catalog', settings: { title: nombre ? `Todo ${nombre}` : 'Todos los productos', titleUnderline: true, brandId, anchorId: 'catalogo' } },
  ].filter(Boolean);
  return secciones.map((sec, k) => ({ id: `marca-${sec.type}`, order: k + 1, ...sec }));
}
