/*
 * Adaptadores: producto de la tienda (colección productos_wala, ver
 * normalizeProductForRead en src/services/products.js) → props del kit.
 *
 * El kit no lee Firestore; estas funciones solo traducen nombres de campos
 * para usar <TarjetaProducto> y <AgregarRapido> con productos reales.
 */

const variantesDe = (p) => (p?.hasVariants ? p.variants || [] : []);

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
 */
export function opcionesDeProducto(p, { subproductos = {} } = {}) {
  const vs = variantesDe(p);
  const piezas = p?.isComboProduct
    ? (p.comboItems || []).map((it) => ({
      nombre: it.name,
      colores: variantesDe(subproductos[it.productId])
        .filter((v) => !it.variantMapping?.allowedColors || it.variantMapping.allowedColors.includes(v.name))
        .map((v) => ({ nombre: v.name, hex: v.colorHex || '#cccccc' })),
    }))
    : [];
  // Combos: talla compartida = las que tienen todas las piezas (o todas, si no coinciden).
  let opcionesCombo = [];
  if (piezas.length) {
    const listas = (p.comboItems || []).map((it) => [...new Set(variantesDe(subproductos[it.productId]).flatMap((v) => v.sizes || []))]);
    const comunes = listas.reduce((a, l) => a.filter((x) => l.includes(x)), listas[0] || []);
    opcionesCombo = comunes.length ? comunes : [...new Set(listas.flat())];
  }
  return {
    producto: { nombre: p.name, imagen: p.mainImage || p.images?.[0], precio: p.salePrice || p.price, precioAntes: p.salePrice ? p.price : undefined },
    variantes: piezas.length ? [] : vs.map((v) => ({ id: v.id, nombre: v.name, colorHex: v.colorHex, imagen: v.imageUrl, opciones: v.sizes || [] })),
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
