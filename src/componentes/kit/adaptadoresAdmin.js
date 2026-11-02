/*
 * Adaptadores del panel administrativo (guía: guia/ADMIN.md). Aparte de
 * adaptadores.js para no ir en el archivo principal de la tienda. Sin
 * imports: se prueban solos (adaptadoresAdmin.test.mjs). Los íconos van como
 * nombre (`icono`); MarcoAdmin los dibuja con ICONOS_ADMIN.
 */

/* ── Menú y permisos ───────────────────────────────────── */

/*
 * Permisos (los de AdminConfiguracion): 'superadmin' lo abre todo.
 * Cada opción dice qué permiso pide (`permiso`: uno de la lista basta;
 * `todos`: hacen falta todos). Sin `permiso`, la ve cualquier admin.
 * Las reglas son las mismas de AdminLayout:
 *  - diseño (manage_design): recepción, pagos, sorteos, enlaces, avisos,
 *    datos para recomendar, editar la tienda, destacados, WhatsApp,
 *    backups, Kapi y los juegos
 *  - productos (manage_products): el catálogo (menos inventario), las
 *    recompensas y los cliparts; landing pages y temas piden además
 *    manage_landing_pages
 *  - inventario (manage_inventory) · clientes (manage_clients): reclamos,
 *    referidos, cuentas de pedidos, encuesta, popups, fechas, retos, misiones
 *  - Resultados: diseño o clientes; Clientes y Opiniones, solo clientes
 *  - Configuración: solo superadmin
 * Diferencia a propósito: "Inicio" lo ve cualquier admin (antes el enlace
 * estaba en el grupo de diseño, aunque /admin ya abría para todos).
 */
const DISENO = ['manage_design'];
const PRODUCTOS = ['manage_products'];
const CLIENTES = ['manage_clients'];

export const MENU_ADMIN = [
  {
    id: 'inicio', titulo: 'Inicio', icono: 'inicio', tono: 'degradado', suelto: true,
    items: [{ to: '/admin', texto: 'Inicio', icono: 'inicio', exacto: true }],
  },
  {
    id: 'pedidos', titulo: 'Pedidos y pagos', icono: 'pedidos', tono: 'menta',
    items: [
      { to: '/admin/recepcion-pedidos', texto: 'Recepción de pedidos', icono: 'pedidos', permiso: DISENO },
      { to: '/admin/gestion-pagos', texto: 'Gestión de pagos', icono: 'pagos', permiso: DISENO },
      { to: '/admin/libro-reclamaciones', texto: 'Libro de reclamaciones', icono: 'reclamos', permiso: CLIENTES },
      { to: '/admin/crear-cuentas-pedidos', texto: 'Cuentas desde pedidos', icono: 'cuentas', permiso: CLIENTES },
    ],
  },
  {
    id: 'catalogo', titulo: 'Catálogo', icono: 'catalogo', tono: 'degradado',
    items: [
      { to: '/admin/productos', texto: 'Productos', icono: 'productos', permiso: PRODUCTOS },
      { to: '/admin/inventario', texto: 'Inventario', icono: 'inventario', permiso: ['manage_inventory'] },
      { to: '/admin/categorias', texto: 'Categorías', icono: 'categorias', permiso: PRODUCTOS },
      { to: '/admin/colecciones', texto: 'Colecciones', icono: 'colecciones', permiso: PRODUCTOS },
      { to: '/admin/marcas', texto: 'Marcas', icono: 'marcas', permiso: PRODUCTOS },
      { to: '/admin/atributos-catalogo', texto: 'Atributos del catálogo', icono: 'atributos', permiso: PRODUCTOS },
      { to: '/admin/envios', texto: 'Zonas de envío', icono: 'envios', permiso: PRODUCTOS },
      { to: '/admin/plantillas-yoryo', texto: 'Plantillas de cuadros', icono: 'plantillas', permiso: PRODUCTOS },
      { to: '/admin/blueprints', texto: 'Blueprints', icono: 'blueprints', permiso: PRODUCTOS },
      { to: '/admin/cliparts', texto: 'Cliparts', icono: 'cliparts', permiso: PRODUCTOS },
      { to: '/admin/publico-productos', texto: 'Datos para recomendar', icono: 'recomendar', permiso: DISENO },
    ],
  },
  {
    id: 'resultados', titulo: 'Resultados', icono: 'resultados', tono: 'oro',
    items: [
      { to: '/admin/resultados', texto: 'Resumen', icono: 'resultados', permiso: [...DISENO, ...CLIENTES], exacto: true },
      { to: '/admin/resultados/productos', texto: 'Productos más vistos', icono: 'productos', permiso: [...DISENO, ...CLIENTES] },
      { to: '/admin/resultados/visitantes', texto: 'Visitantes', icono: 'visitantes', permiso: [...DISENO, ...CLIENTES] },
      { to: '/admin/resultados/clientes', texto: 'Clientes', icono: 'clientes', permiso: CLIENTES },
      { to: '/admin/resultados/opiniones', texto: 'Opiniones', icono: 'opiniones', permiso: CLIENTES },
      { to: '/admin/resultados/tecnico', texto: 'Detalle técnico', icono: 'tecnico', permiso: [...DISENO, ...CLIENTES] },
    ],
  },
  {
    id: 'clientes', titulo: 'Clientes', icono: 'clientes', tono: 'rosa',
    items: [
      { to: '/admin/referidos', texto: 'Referidos', icono: 'referidos', permiso: CLIENTES },
      { to: '/admin/recompensas', texto: 'Recompensas', icono: 'recompensas', permiso: PRODUCTOS },
      { to: '/admin/misiones', texto: 'Misiones diarias', icono: 'misiones', permiso: CLIENTES },
      { to: '/admin/retos', texto: 'Retos semanales', icono: 'retos', permiso: CLIENTES },
      { to: '/admin/notificaciones', texto: 'Notificaciones y ofertas', icono: 'notificaciones', permiso: DISENO },
      { to: '/admin/fechas-importantes', texto: 'Fechas importantes', icono: 'fechas', permiso: CLIENTES },
      { to: '/admin/encuestas', texto: 'Encuesta de suscripción', icono: 'encuesta', permiso: CLIENTES },
    ],
  },
  {
    id: 'campanas', titulo: 'Campañas', icono: 'campanas', tono: 'oro',
    items: [
      { to: '/admin/sorteos', texto: 'Sorteos y rifas', icono: 'sorteos', permiso: DISENO },
      { to: '/admin/sorteos-suscripcion', texto: 'Sorteo por suscripción', icono: 'suscripcion', permiso: DISENO },
      { to: '/admin/enlaces', texto: 'Enlaces útiles', icono: 'enlaces', permiso: DISENO },
      { to: '/admin/popups', texto: 'Popups y anuncios', icono: 'popups', permiso: CLIENTES },
      { to: '/admin/landing-pages', texto: 'Landing pages', icono: 'landings', permiso: [...PRODUCTOS, 'manage_landing_pages'], todos: true },
      { to: '/admin/temas', texto: 'Temas', icono: 'temas', permiso: [...PRODUCTOS, 'manage_landing_pages'], todos: true },
    ],
  },
  {
    id: 'diseno', titulo: 'Diseño y juegos', icono: 'diseno', tono: 'rosa',
    items: [
      { to: '/tienda', texto: 'Editar la tienda', icono: 'editar', permiso: DISENO, fuera: true },
      { to: '/admin/destacados', texto: 'Destacados', icono: 'destacados', permiso: DISENO },
      { to: '/admin/mascota', texto: 'Kapi', icono: 'kapi', permiso: DISENO },
      { to: '/admin/wordle', texto: 'La Palabra del día', icono: 'palabra', permiso: DISENO },
      { to: '/admin/ruleta', texto: 'Ruleta semanal', icono: 'ruleta', permiso: DISENO },
      { to: '/admin/bolitas', texto: 'Las Bolitas de Kapi', icono: 'bolitas', permiso: DISENO },
    ],
  },
  {
    id: 'ajustes', titulo: 'Ajustes', icono: 'ajustes', tono: 'plata',
    items: [
      { to: '/admin/configuracion', texto: 'Administradores y bloqueos', icono: 'admins', permiso: [] },
      { to: '/admin/whatsapp', texto: 'WhatsApp', icono: 'whatsapp', permiso: DISENO },
      { to: '/admin/backups', texto: 'Historial y backups', icono: 'historial', permiso: DISENO },
    ],
  },
];

/** ¿Estos permisos abren esta opción? `permiso: []` = solo superadmin. */
export function puedeVer(item, permisos = []) {
  const lista = Array.isArray(permisos) ? permisos : [];
  if (lista.includes('superadmin')) return true;
  if (!item.permiso) return true;
  if (!item.permiso.length) return false;
  return item.todos ? item.permiso.every((p) => lista.includes(p)) : item.permiso.some((p) => lista.includes(p));
}

/** El menú de un admin: solo las opciones que puede abrir; un grupo sin ninguna no sale. */
export function menuAdminPara(permisos, menu = MENU_ADMIN) {
  return menu
    .map((g) => ({ ...g, items: g.items.filter((it) => puedeVer(it, permisos)) }))
    .filter((g) => g.items.length);
}

/*
 * La barra inferior del celular: cuatro accesos fijos y "Más" (el menú).
 * Si un admin no puede abrir uno, entra el siguiente de la lista de
 * reserva que sí pueda.
 */
const ACCESOS = [
  { id: 'inicio', to: '/admin', texto: 'Inicio', icono: 'inicio', exacto: true },
  { id: 'pedidos', to: '/admin/recepcion-pedidos', texto: 'Pedidos', icono: 'pedidos', permiso: DISENO },
  { id: 'productos', to: '/admin/productos', texto: 'Productos', icono: 'productos', permiso: PRODUCTOS },
  { id: 'resultados', to: '/admin/resultados', texto: 'Resultados', icono: 'resultados', permiso: [...DISENO, ...CLIENTES] },
  { id: 'inventario', to: '/admin/inventario', texto: 'Inventario', icono: 'inventario', permiso: ['manage_inventory'] },
  { id: 'reclamos', to: '/admin/libro-reclamaciones', texto: 'Reclamos', icono: 'reclamos', permiso: CLIENTES },
  { id: 'referidos', to: '/admin/referidos', texto: 'Referidos', icono: 'referidos', permiso: CLIENTES },
];

export function accesosAdminPara(permisos, cuantos = 4) {
  return ACCESOS.filter((a) => puedeVer(a, permisos)).slice(0, cuantos);
}

/** ¿La ruta `actual` es la de esta opción? (exacto: solo esa; si no, también sus hijas). */
export function esRutaActiva(item, actual = '') {
  if (!item?.to || !actual) return false;
  if (item.exacto) return actual === item.to;
  return actual === item.to || actual.startsWith(`${item.to}/`);
}

/** La opción del menú que corresponde a la ruta (la más larga que coincide). */
export function opcionActiva(grupos, actual) {
  let mejor = null;
  grupos.forEach((g) => g.items.forEach((it) => {
    if (esRutaActiva(it, actual) && (!mejor || it.to.length > mejor.item.to.length)) mejor = { grupo: g, item: it };
  }));
  return mejor;
}

/* ── Categorías ────────────────────────────────────────── */

/** Una categoría de `categories` → lo que muestra el admin. */
export function categoriaDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.name || '',
    imagen: doc.imageUrl || '',
    orden: Number.isFinite(Number(doc.order)) ? Number(doc.order) : 0,
    marcas: Array.isArray(doc.brandIds) ? doc.brandIds : [],
  };
}

/** Lo que guarda el formulario → los campos de `categories` (los mismos de AdminCategorias). */
export function categoriaAFirestore(c = {}) {
  return {
    name: String(c.nombre || '').trim(),
    order: Number(c.orden) || 0,
    imageUrl: c.imagen || '',
    brandIds: Array.isArray(c.marcas) ? [...new Set(c.marcas)] : [],
  };
}

/** Una marca de `tienda_brands` → lo justo para elegirla en el admin. */
export function marcaAdminDesdeFirestore(doc = {}) {
  return { id: doc.id, nombre: doc.name || 'Sin nombre', logo: doc.logoUrl || '' };
}

/** Mismo nombre sin tildes, mayúsculas ni espacios de más (para no repetir). */
export const mismoNombre = (a, b) => normalizarBusqueda(a) === normalizarBusqueda(b);

/* ── Colecciones ───────────────────────────────────────── */

export function coleccionDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.name || '',
    imagen: doc.imageUrl || '',
    orden: Number.isFinite(Number(doc.order)) ? Number(doc.order) : 0,
  };
}

/** Los campos de `collections` (los mismos de AdminColecciones). */
export function coleccionAFirestore(c = {}) {
  return { name: String(c.nombre || '').trim(), order: Number(c.orden) || 0, imageUrl: c.imagen || '' };
}

/* ── Atributos del catálogo ────────────────────────────── */

/*
 * Tres listas con la misma forma: tipos de producto (`productTypes`, sin
 * marcas), etiquetas (`tags`) y personajes (`characters`), con marcas (sin
 * ninguna: de todas). `campo`: dónde los guarda un producto.
 */
export const ATRIBUTOS = {
  tipos: { titulo: 'Tipos de producto', singular: 'tipo de producto', plural: 'tipos de producto', campo: 'productType', conMarcas: false, ejemplo: 'Accesorio', ayuda: 'El filtro «Tipo de producto» de la tienda.' },
  etiquetas: { titulo: 'Etiquetas', singular: 'etiqueta', plural: 'etiquetas', campo: 'tags', conMarcas: true, ejemplo: 'Dragon Ball', ayuda: 'Palabras temáticas para clasificar y filtrar.' },
  personajes: { titulo: 'Personajes', singular: 'personaje', plural: 'personajes', campo: 'characters', conMarcas: true, ejemplo: 'Goku', ayuda: 'Los protagonistas de cada diseño.' },
};

const idDeValor = (v) => (v && typeof v === 'object' ? (v.id || v.slug || v.name || '') : v);

/** Cuántos productos usan cada valor de un atributo ({ id: n }). Cuenta también los ocultos. */
export function usosDeAtributo(productos = [], tipo) {
  const campo = ATRIBUTOS[tipo]?.campo;
  const usos = {};
  if (!campo) return usos;
  productos.forEach((p) => {
    const crudo = p?.[campo];
    const ids = new Set((Array.isArray(crudo) ? crudo : [crudo]).map(idDeValor).filter(Boolean));
    ids.forEach((id) => { usos[id] = (usos[id] || 0) + 1; });
  });
  return usos;
}

export function atributoDesdeFirestore(doc = {}, usos = {}) {
  return {
    id: doc.id,
    nombre: doc.name || doc.id || '',
    marcas: Array.isArray(doc.brandIds) ? doc.brandIds : [],
    usos: usos[doc.id] || 0,
  };
}

/** Tipos: solo el nombre; etiquetas y personajes, también sus marcas. */
export function atributoAFirestore(a = {}, tipo) {
  const name = String(a.nombre || '').trim();
  return ATRIBUTOS[tipo]?.conMarcas ? { name, brandIds: Array.isArray(a.marcas) ? [...new Set(a.marcas)] : [] } : { name };
}

/* ── Zonas de envío ────────────────────────────────────── */

export function zonaDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.name || '',
    departamento: doc.departamento || '',
    costo: Number(doc.cost) || 0,
    dias: Number(doc.etaDays) || 0,
    orden: Number(doc.order) || 0,
    activa: doc.active !== false,
  };
}

/** Los campos de `shippingZones` (los mismos de AdminEnviosZonas). */
export function zonaAFirestore(z = {}) {
  return {
    name: String(z.nombre || '').trim(),
    departamento: String(z.departamento || '').trim(),
    cost: Number(z.costo) || 0,
    etaDays: Number(z.dias) || 0,
    order: Number(z.orden) || 0,
    active: z.activa !== false,
  };
}

/* ── Cliparts ──────────────────────────────────────────── */

export function clipartDesdeFirestore(doc = {}) {
  return { id: doc.id, nombre: doc.name || '', imagen: doc.url || '', categoria: doc.category || '' };
}

/** `directa`: la que convierte un enlace de Drive en imagen (utils/imageUrl, toDirectImageUrl). */
export function clipartAFirestore(c = {}, directa = (u) => u) {
  const url = String(c.imagen || '').trim();
  return { name: String(c.nombre || '').trim(), url: url ? directa(url) : '', category: String(c.categoria || '').trim() };
}

/* ── Marcas ────────────────────────────────────────────── */

/** La parte de la dirección de una marca (wala.pe/<esto>): como brands.js y la cabecera. */
export function slugDeMarca(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
}

export const TOPE_MONEDAS_POR_DEFECTO = 50;

/** El % de monedas de una marca (como utils/topeMonedas: vacío o raro = 50; entre 0 y 100). */
export function topeMonedasDe(crudo) {
  if (crudo === null || crudo === undefined || crudo === '') return TOPE_MONEDAS_POR_DEFECTO;
  const n = Number(crudo);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : TOPE_MONEDAS_POR_DEFECTO;
}

export function marcaDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.name || '',
    slug: doc.slug || '',
    logo: doc.logoUrl || '',
    orden: Number(doc.order) || 0,
    whatsapp: doc.whatsappNumber || '',
    mensajeVacio: doc.storeEmpty || '',
    topeMonedas: topeMonedasDe(doc.topeMonedasPct),
    fondo: doc.bgColor || '#ffffff',
    textura: doc.bgImage || '',
    opacidad: doc.bgOpacity ?? 100,
  };
}

/**
 * Los campos de `tienda_brands` que edita el admin (los mismos de
 * AdminMarcas). storeTitle y storeSubtitle no van: se conservan en el doc
 * (updateBrand solo escribe lo que llega) pero ya no se ven en la tienda.
 */
export function marcaAFirestore(m = {}) {
  return {
    name: String(m.nombre || '').trim(),
    slug: String(m.slug || '').trim(),
    logoUrl: String(m.logo || '').trim(),
    order: Number(m.orden) || 0,
    bgColor: m.fondo || '#ffffff',
    bgImage: String(m.textura || '').trim(),
    bgOpacity: Number(m.opacidad ?? 100),
    whatsappNumber: String(m.whatsapp || '').trim(),
    storeEmpty: String(m.mensajeVacio || '').trim(),
    topeMonedasPct: topeMonedasDe(m.topeMonedas),
  };
}

/* ── Productos (lo justo para elegirlos en el admin) ───── */

/*
 * La personalización de antes (el editor viejo y Yoryo) que todavía tiene
 * un producto de la tienda: como tienePersonalizacionVieja de AdminProductos.
 */
function conPersonalizacionVieja(p) {
  if (p.esPrendaBase === true || p.deleted === true) return false;
  const items = Array.isArray(p.comboItems) ? p.comboItems : [];
  return p.customizable === true
    || (Array.isArray(p.customizationViews) && p.customizationViews.length > 0)
    || Boolean(p.YoryoPersonalizado)
    || items.some((it) => it?.customizable === true || Boolean(it?.YoryoPersonalizado));
}

/* La foto de la tarjeta del admin: la de la lista, la de su color principal, la principal o la primera. */
function fotoDeProducto(p) {
  const variantes = Array.isArray(p.variants) ? p.variants : [];
  const principal = variantes.find((v) => v.id === p.defaultVariantId) || variantes[0];
  return p.thumbnailImageUrl || principal?.imageUrl || p.mainImage || (Array.isArray(p.images) && p.images[0]) || '';
}

/**
 * Un producto de `productos_wala` para las listas del admin. Los
 * archivados (deleted) no se listan: null.
 */
export function productoAdminDesde(p = {}) {
  if (!p || p.deleted === true) return null;
  const precioLista = Number(p.price) || 0;
  const oferta = Number(p.salePrice) || 0;
  const conOferta = oferta > 0 && oferta < precioLista;
  return {
    id: p.id,
    nombre: p.name || 'Sin nombre',
    imagen: fotoDeProducto(p),
    precio: conOferta ? oferta : precioLista,
    precioLista,
    conOferta,
    oculto: p.visible === false,
    marcaId: p.brandId || '',
    destacado: p.featured === true,
    ordenDestacado: Number(p.featuredOrder) || 0,
    stock: Number.isFinite(Number(p.inStock)) ? Number(p.inStock) : 0,
    sku: p.sku || '',
    categorias: Array.isArray(p.categories) ? p.categories : (p.categoryId ? [p.categoryId] : []),
    colecciones: Array.isArray(p.collections) ? p.collections : [],
    tipo: (p.productType && typeof p.productType === 'object' ? p.productType.id : p.productType) || '',
    esCombo: p.isComboProduct === true,
    piezas: p.isComboProduct === true && Array.isArray(p.comboItems) ? p.comboItems.map((it) => it?.productId).filter(Boolean) : [],
    // Crear: una prenda personalizable, un pack de Crear y lo que reemplazó un personalizable.
    personalizable: p.esPrendaBase === true,
    talCual: p.seVendeTalCual === true,
    enTienda: p.enTienda === true,
    pack: p.esComboCrear === true,
    packPublicado: p.comboCrear?.publicado === true,
    reemplazado: Boolean(p.reemplazadoPor),
    personalizacionVieja: conPersonalizacionVieja(p),
    publico: p.publico || '',
    edadMinima: p.edadMinima ?? null,
    equipo: p.equipo || '',
  };
}

/*
 * Lo que se lista en "Tienda" (como `catalogo` de AdminProductos): sin lo
 * que reemplazó un personalizable, sin los packs de Crear y, de las
 * prendas personalizables, solo las que también se venden en la tienda.
 */
export const esDeLaTienda = (p) => p && !p.reemplazado && !p.pack && (!p.personalizable || p.enTienda);

/** Los ids que son pieza de algún combo de la lista. */
export const piezasDeCombos = (productos = []) => new Set(productos.filter((p) => p.esCombo).flatMap((p) => p.piezas));

/** Las etiquetas de la vista "Todos" (las mismas de ListaTodos). */
export function etiquetasDeProducto(p) {
  if (p.pack) return ['Pack de Crear', p.packPublicado ? 'En Crear' : 'Borrador', ...(p.packPublicado && p.enTienda ? ['En la tienda'] : [])];
  if (p.personalizable) return ['Personalizable', p.oculto ? 'Borrador' : 'En Crear', ...(!p.oculto && p.enTienda ? ['En la tienda'] : [])];
  if (p.reemplazado) return [...(p.esCombo ? ['Combo'] : []), 'Reemplazado por su personalizable'];
  return [...(p.esCombo ? ['Combo'] : []), p.oculto ? 'Oculto' : 'En la tienda'];
}

/** A dónde lleva un producto de "Todos": los packs a su lista, las prendas a su ficha de Crear, el resto a la ficha. */
export function rutaAdminDeProducto(p) {
  if (p.pack) return '/admin/productos?ver=packs';
  if (p.personalizable) return `/admin/prendas-crear/${p.id}`;
  return `/admin/productos/${p.id}`;
}

/* ── La ficha de un producto (D2b) ─────────────────────── */

/* Los tipos de cumplimiento (fulfillmentType); '' = que lo decida la tienda. */
export const CUMPLIMIENTOS = [
  { valor: '', texto: 'Automático' },
  { valor: 'stock', texto: 'Stock propio' },
  { valor: 'print_on_demand', texto: 'Se imprime al pedirlo' },
  { valor: 'made_to_order', texto: 'Se fabrica al pedirlo' },
  { valor: 'dropship', texto: 'Lo envía el proveedor' },
];

const lista = (v) => (Array.isArray(v) ? v : []);
const idDe = (v) => (v && typeof v === 'object' ? v.id || '' : v || '');

/**
 * Un producto de `productos_wala` → los datos de la ficha (lo mismo que
 * cargaba AdminProductoFormV2). Sin variantes y sin ser combo (los de
 * antes), se arma una "Principal" con su foto, su galería y sus tallas.
 * `nuevo`: { marcaId } para uno nuevo (la marca de ?brandId=).
 */
export function fichaDesdeProducto(p, nuevo = {}) {
  if (!p) {
    const id = `var_${Date.now()}`;
    return {
      nombre: '', precio: '', oferta: '', sku: '', stock: 0, descripcion: '',
      esCombo: false, cumplimiento: '', marcaId: nuevo.marcaId || '', categoria: '', colecciones: [], tipo: '', personajes: [], etiquetas: [],
      publico: '', edadMinima: null, equipo: '',
      whatsappActivo: true, whatsappNumero: '', whatsappMensaje: '',
      destacado: false, visible: true, personalizarEn: '',
      variantes: [{ id, nombre: 'Variante 1', color: '#cccccc', foto: '', encuadre: null, galeria: [], encuadres: {}, etiquetaTalla: 'Talla', tallas: [] }],
      principal: id,
      combo: { tallas: 'porPrenda', piezas: [], portada: '' },
      // Un personalizable de Crear (D2c): su prendaBase tal cual se edita.
      esPrenda: nuevo.prenda === true,
      prenda: { vistas: [], colores: {} },
      enTienda: false,
      talCual: false,
      ...(nuevo.prenda === true && { stock: '', visible: false }),
    };
  }
  let variantes = lista(p.variants).map((v) => ({
    id: v.id,
    nombre: v.name || '',
    color: v.colorHex || '#cccccc',
    foto: v.imageUrl || '',
    encuadre: v.thumbnailCrop || null,
    galeria: lista(v.images),
    encuadres: v.imagesCrops && typeof v.imagesCrops === 'object' ? v.imagesCrops : {},
    etiquetaTalla: v.sizeLabel || 'Talla',
    tallas: lista(v.sizes),
  }));
  if (!variantes.length && !p.isComboProduct) {
    variantes = [{
      id: p.defaultVariantId || `var_${Date.now()}`,
      nombre: 'Principal',
      color: '#cccccc',
      foto: p.mainImage || '',
      encuadre: p.thumbnailCrop || null,
      galeria: lista(p.images).filter((u) => u !== p.mainImage),
      encuadres: p.imagesCrops || {},
      etiquetaTalla: 'Talla',
      tallas: lista(p.mainSizes),
    }];
  }
  const principal = variantes.some((v) => v.id === p.defaultVariantId) ? p.defaultVariantId : variantes[0]?.id || '';
  return {
    nombre: p.name || '',
    precio: p.price ?? '',
    oferta: Number(p.salePrice) > 0 ? p.salePrice : '',
    sku: p.sku || '',
    // Un personalizable puede no tener stock (sin límite): vacío.
    stock: p.esPrendaBase === true && (p.inStock === null || p.inStock === undefined || p.inStock === '') ? '' : (Number.isFinite(Number(p.inStock)) ? Number(p.inStock) : 0),
    descripcion: p.description || '',
    esCombo: p.isComboProduct === true,
    cumplimiento: p.fulfillmentType || '',
    marcaId: p.brandId || '',
    categoria: lista(p.categories)[0] || p.categoryId || '',
    colecciones: lista(p.collections),
    tipo: idDe(p.productType),
    personajes: lista(p.characters).map(idDe).filter(Boolean),
    etiquetas: lista(p.tags).map(idDe).filter(Boolean),
    publico: p.publico || '',
    edadMinima: p.edadMinima ?? null,
    equipo: p.equipo || '',
    whatsappActivo: p.whatsappEnabled !== false,
    whatsappNumero: p.whatsappNumber || '',
    whatsappMensaje: p.whatsappMessage || '',
    destacado: p.featured === true,
    visible: p.visible !== false,
    personalizarEn: p.personalizarEn || '',
    variantes,
    principal,
    combo: {
      tallas: p.comboTallas || 'porPrenda',
      piezas: lista(p.comboItems).map((it, i) => ({
        uid: `${it.productId || 'pieza'}-${i}`,
        productoId: it.productId || '',
        nombre: it.name || '',
        foto: it.imageUrl || '',
        color: it.variantMapping?.color || '',
      })),
      portada: p.comboPreviewImage || '',
    },
    esPrenda: p.esPrendaBase === true && p.isComboProduct !== true,
    prenda: p.prendaBase && typeof p.prendaBase === 'object' ? { vistas: [], colores: {}, ...p.prendaBase } : { vistas: [], colores: {} },
    enTienda: p.enTienda === true,
    talCual: p.seVendeTalCual === true,
  };
}

/**
 * Los datos de la ficha → lo que AdminProductoFormV2 le pasaba a
 * createProduct / updateProduct (el servicio normaliza después). `original`:
 * el producto tal como estaba, para no perder lo que la ficha no muestra
 * (las copias chicas de cada foto, la configuración de Yoryo de una pieza).
 * Un personalizable lleva su prendaBase: `prendaBaseParaGuardar` (la de
 * PersonalizacionPrenda / utils) la limpia; sin ella va tal cual.
 */
export function fichaAProducto(f, original = {}, { prendaBaseParaGuardar } = {}) {
  const prenda = f.esPrenda === true && !f.esCombo;
  const fotoPrenda = prenda ? String(lista(f.prenda?.vistas)[0]?.imagen || '') : '';
  const viejas = new Map(lista(original.variants).map((v) => [v.id, v]));
  const variantes = f.esCombo ? [] : f.variantes.map((v) => {
    const antes = viejas.get(v.id) || {};
    const fotos = new Set([v.foto, ...v.galeria].filter(Boolean));
    return {
      id: v.id,
      name: String(v.nombre || '').trim(),
      colorHex: v.color || '#cccccc',
      // Un personalizable sin foto de tienda en un color usa la de su primera vista.
      imageUrl: v.foto || fotoPrenda,
      images: [...v.galeria],
      sizes: [...v.tallas],
      sizeLabel: String(v.etiquetaTalla || '').trim() || 'Talla',
      showSizeConfig: v.tallas.length > 0,
      thumbnailCrop: v.encuadre || null,
      // Solo los encuadres y las copias de fotos que siguen en la variante.
      imagesCrops: Object.fromEntries(Object.entries(v.encuadres || {}).filter(([url]) => fotos.has(url))),
      imagesVariantes: Object.fromEntries(Object.entries({ ...(antes.imagesVariantes || {}), ...(v.copias || {}) }).filter(([url]) => fotos.has(url))),
    };
  });
  const principal = variantes.find((v) => v.id === f.principal) || variantes[0];
  const piezasAntes = lista(original.comboItems);
  return {
    name: String(f.nombre || '').trim(),
    description: f.descripcion || '',
    price: Number(f.precio) || 0,
    salePrice: Number(f.oferta) || 0,
    inStock: prenda && f.stock === '' ? null : Number(f.stock) || 0,
    sku: String(f.sku || '').trim(),
    brandId: f.marcaId || '',
    fulfillmentType: f.cumplimiento || undefined,
    productType: f.tipo || '',
    categories: f.categoria ? [f.categoria] : [],
    collections: [...f.colecciones],
    mainImage: principal?.imageUrl || '',
    thumbnailWithDesignUrl: '',
    mainSizes: [],
    defaultVariantId: principal?.id || '',
    hasVariants: !f.esCombo && variantes.length > 0,
    customizable: false,
    customizationViews: [],
    esPrendaBase: prenda,
    ...(prenda && { prendaBase: prendaBaseParaGuardar ? prendaBaseParaGuardar(f.prenda, variantes) : f.prenda }),
    personalizarEn: prenda ? '' : f.personalizarEn || '',
    whatsappEnabled: f.whatsappActivo !== false,
    whatsappNumber: String(f.whatsappNumero || '').trim(),
    whatsappMessage: String(f.whatsappMensaje || '').trim(),
    isComboProduct: f.esCombo === true,
    comboItems: f.esCombo ? f.combo.piezas.map((pz, i) => {
      const antes = piezasAntes.find((it) => it.productId === pz.productoId) || {};
      return {
        ...antes,
        productId: pz.productoId,
        name: String(pz.nombre || '').trim(),
        imageUrl: pz.foto || '',
        position: i,
        scale: antes.scale ?? 1,
        variantMapping: { ...(antes.variantMapping || {}), color: pz.color || '' },
      };
    }) : [],
    comboTallas: f.combo.tallas,
    comboPreviewImage: f.esCombo ? f.combo.portada || '' : '',
    characters: [...f.personajes],
    tags: [...f.etiquetas],
    publico: f.publico || '',
    equipo: String(f.equipo || '').trim(),
    edadMinima: f.edadMinima,
    variants: variantes,
    visible: f.visible !== false,
    enTienda: prenda && f.enTienda === true,
    seVendeTalCual: prenda && f.enTienda === true && f.talCual === true,
    featured: f.destacado === true,
    isV2: true,
  };
}

/** Lo que falta en la ficha antes de guardar: { campo: mensaje } y en qué pestaña está. */
export function erroresDeFicha(f) {
  const e = {};
  if (!String(f.nombre || '').trim()) e.nombre = { texto: 'Escribe el nombre del producto.', pestana: 'general' };
  if (f.precio === '' || f.precio === null || !(Number(f.precio) >= 0)) e.precio = { texto: 'Escribe el precio (puede ser 0).', pestana: 'general' };
  if (f.oferta !== '' && Number(f.oferta) > 0 && Number(f.oferta) >= Number(f.precio)) e.oferta = { texto: 'La oferta tiene que ser menor que el precio (si no, no se guarda).', pestana: 'general' };
  if (Number(f.stock) < 0) e.stock = { texto: 'El stock no puede ser negativo.', pestana: 'general' };
  if (f.esCombo && !f.combo.piezas.length) e.piezas = { texto: 'Agrega al menos un producto al combo.', pestana: 'colores' };
  if (!f.esCombo && !f.variantes.length) e.variantes = { texto: 'Tiene que quedar al menos un color.', pestana: 'colores' };
  if (f.esPrenda && !f.esCombo) {
    const vistas = lista(f.prenda?.vistas);
    if (!vistas.length || vistas.some((v) => !v?.imagen || !(lista(v.zonas).length || v.zona))) {
      e.vistas = { texto: 'Cada vista necesita su foto y al menos una zona de impresión.', pestana: 'diseno' };
    }
  }
  return e;
}

/* ── Crear: personalizables y packs (D2c) ──────────────── */

const zonasDeVistaCruda = (v) => (Array.isArray(v?.zonas) && v.zonas.length ? v.zonas.length : v?.zona ? 1 : 0);
const plantillasValidas = (lista) => (Array.isArray(lista) ? lista : [])
  .filter((p) => p && p.id && p.capas && typeof p.capas === 'object' && Object.values(p.capas).some((c) => Array.isArray(c) && c.length));

/**
 * Un personalizable (esPrendaBase) para la lista de Crear: cuántos colores,
 * vistas, zonas y plantillas tiene, si le faltan vistas con foto y zonas, y
 * en qué packs está (como AdminPrendasCrear).
 *  - packs: los combos de Crear (getCombosCrear), para saber cuáles la usan
 */
export function personalizableDesde(p = {}, packs = []) {
  const variantes = lista(p.variants);
  const principal = variantes.find((v) => String(v.id) === String(p.defaultVariantId)) || variantes[0];
  const vistas = lista(p.prendaBase?.vistas);
  const usan = lista(packs).filter((c) => c.deleted !== true && lista(c.comboCrear?.piezas || c.piezas).some((pz) => pz?.prendaId === p.id));
  return {
    id: p.id,
    nombre: p.name || 'Sin nombre',
    foto: principal?.imageUrl || vistas[0]?.imagen || p.mainImage || '',
    colores: variantes.length,
    vistas: vistas.length,
    zonas: vistas.reduce((t, v) => t + zonasDeVistaCruda(v), 0),
    plantillas: plantillasValidas(p.prendaBase?.plantillas).length,
    faltanZonas: !vistas.length || vistas.some((v) => !v?.imagen || !zonasDeVistaCruda(v)),
    publicada: p.visible !== false,
    enTienda: p.enTienda === true,
    talCual: p.enTienda === true && p.seVendeTalCual === true,
    packs: usan.map((c) => ({ id: c.id, nombre: c.name || 'Pack', publicado: (c.comboCrear?.publicado ?? c.publicado) === true })),
  };
}

export const MODOS_TALLA_PACK = [
  { valor: 'auto', texto: 'Automático', ayuda: 'Prendas distintas (el conjunto de una persona): una talla. La misma prenda repetida (pareja, trío): una por prenda.' },
  { valor: 'porPrenda', texto: 'Una por prenda', ayuda: 'Cada prenda elige la suya: él y ella pueden ser de tallas distintas.' },
  { valor: 'una', texto: 'Una para todas', ayuda: 'Una sola talla que se aplica a todas las prendas.' },
];
export const MIN_PIEZAS_PACK = 2;
export const MAX_PIEZAS_PACK = 4;

/** Un pack de Crear (esComboCrear) → lo que edita el admin. */
export function packDesdeFirestore(c = {}) {
  const cc = c.comboCrear || {};
  return {
    id: c.id,
    nombre: c.name || '',
    descripcion: c.description || '',
    marcaId: c.brandId || '',
    categoria: lista(c.categories)[0] || '',
    portada: c.mainImage || '',
    precio: c.price ?? '',
    oferta: Number(c.salePrice) > 0 ? c.salePrice : '',
    publicado: (cc.publicado ?? c.publicado) === true,
    enTienda: c.enTienda === true,
    tallas: ['auto', 'una', 'porPrenda'].includes(cc.tallas) ? cc.tallas : 'auto',
    piezas: lista(cc.piezas || c.piezas).map((pz) => ({
      prendaId: pz?.prendaId || '',
      fija: pz?.fija === true,
      color: pz?.color ? { id: String(pz.color.id || ''), nombre: pz.color.nombre || '', hex: pz.color.hex || '' } : null,
      nombre: pz?.nombre || '',
      imagen: pz?.imagen || '',
    })),
  };
}

/** Lo del pack → lo que recibe guardarComboCrear (el formulario de AdminCombosCrear). */
export function packAGuardar(k = {}) {
  return {
    name: String(k.nombre || '').trim(),
    description: String(k.descripcion || '').trim(),
    price: Number(k.precio) || 0,
    salePrice: Number(k.oferta) > 0 ? Number(k.oferta) : '',
    publicado: k.publicado === true,
    enTienda: k.enTienda === true,
    tallas: k.tallas || 'auto',
    brandId: k.marcaId || '',
    mainImage: k.portada || '',
    categories: k.categoria ? [k.categoria] : [],
    piezas: lista(k.piezas).map((pz) => ({ prendaId: pz.prendaId, ...(pz.fija && { fija: true }), ...(pz.color && { color: pz.color }) })),
  };
}

/** Lo que falta en un pack (las reglas de AdminCombosCrear). */
export function erroresDePack(k) {
  const e = {};
  if (!String(k.nombre || '').trim()) e.nombre = 'Escribe el nombre del pack.';
  if (!(Number(k.precio) > 0)) e.precio = 'Escribe el precio del pack.';
  if (Number(k.oferta) > 0 && Number(k.oferta) >= Number(k.precio)) e.oferta = 'La oferta tiene que ser menor que el precio.';
  const piezas = lista(k.piezas);
  if (piezas.length < MIN_PIEZAS_PACK) e.piezas = `Un pack lleva al menos ${MIN_PIEZAS_PACK} piezas.`;
  else if (piezas.some((pz) => !pz.prendaId || (pz.fija && !pz.color))) e.piezas = 'Completa cada pieza (la que va tal cual necesita su color).';
  else if (!piezas.some((pz) => !pz.fija)) e.piezas = 'Al menos una pieza tiene que diseñarse.';
  return e;
}

/* ── Blueprints (D2d) ──────────────────────────────────── */

/** Un área de impresión por defecto (como AdminBlueprints: cm y dpi de imprenta). */
export const areaVacia = () => ({ nombre: '', ancho: 30, alto: 40, dpi: 300 });

export function blueprintDesdeFirestore(doc = {}) {
  const areas = lista(doc.printAreas).map((a) => ({ nombre: a?.name || '', ancho: Number(a?.widthCm) || 0, alto: Number(a?.heightCm) || 0, dpi: Number(a?.dpi) || 300 }));
  return {
    id: doc.id,
    nombre: doc.name || '',
    prenda: doc.baseGarment || '',
    costo: Number(doc.basePrintCost) || 0,
    orden: Number(doc.order) || 0,
    activo: doc.active !== false,
    metodos: lista(doc.decorationMethods).map((m) => String(m).trim()).filter(Boolean),
    areas: areas.length ? areas : [areaVacia()],
  };
}

/** Los campos de `blueprints`; las áreas sin nombre no se guardan (como antes). */
export function blueprintAFirestore(b = {}) {
  return {
    name: String(b.nombre || '').trim(),
    baseGarment: String(b.prenda || '').trim(),
    basePrintCost: Number(b.costo) || 0,
    order: Number(b.orden) || 0,
    active: b.activo !== false,
    decorationMethods: [...new Set(lista(b.metodos).map((m) => String(m).trim()).filter(Boolean))],
    printAreas: lista(b.areas).filter((a) => String(a?.nombre || '').trim()).map((a) => ({
      name: String(a.nombre).trim(), widthCm: Number(a.ancho) || 0, heightCm: Number(a.alto) || 0, dpi: Number(a.dpi) || 300,
    })),
  };
}

/** El estado del stock (Inventario): 0 agotado, hasta 3 últimas, más disponible. */
export const estadoDeStock = (n) => (n <= 0 ? 'agotado' : n <= 3 ? 'ultimas' : 'disponible');

/** Busca sin tildes ni mayúsculas. */
export function normalizarBusqueda(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/* ── Pedidos y pagos (D3) ──────────────────────────────── */

/*
 * Recepción de pedidos: los pedidos ya llegan como los deja
 * normalizarPedidoRecepcion (services/adminOrders.js, solo lectura del ERP);
 * aquí solo el estado para la insignia, los filtros, las cifras y la
 * dirección para copiar (el enlace de WhatsApp es utils/whatsappLink).
 */
export const ESTADOS_RECEPCION = {
  por_confirmar_pago: { texto: 'Por confirmar pago', tono: 'aviso' },
  pago_confirmado: { texto: 'Pago confirmado', tono: 'violeta' },
  en_preparacion: { texto: 'En producción', tono: 'violeta' },
  entregado: { texto: 'Entregado', tono: 'exito' },
  anulado: { texto: 'Anulado', tono: 'neutro' },
};

/* Los filtros de antes: "Por entregar" es todo lo que no está entregado ni anulado. */
export const FILTROS_RECEPCION = [
  { valor: 'por_entregar', texto: 'Por entregar' },
  { valor: 'en_preparacion', texto: 'En producción' },
  { valor: 'por_confirmar_pago', texto: 'Pago pendiente' },
  { valor: 'entregado', texto: 'Entregados' },
];

const porEntregar = (p) => p.estado?.key !== 'entregado' && p.estado?.key !== 'anulado';

/** ¿Entra el pedido en el filtro de estado? ('' = todos) */
export function pedidoEnFiltro(p, filtro) {
  if (!filtro) return true;
  if (filtro === 'por_entregar') return porEntregar(p);
  return p.estado?.key === filtro;
}

/** Los campos donde busca la recepción (código, cliente, teléfono, documento, dirección). */
export const textoDePedido = (p) => [
  p.codigo, p.clienteNombre, p.clienteContacto, p.clienteDocumento,
  p.entrega?.direccion, p.entrega?.distrito, p.entrega?.departamento,
].filter(Boolean).join(' ');

/**
 * Las cifras de arriba, como las calcula adminOrders, salvo "pendientes de
 * pago": sin los anulados (antes contaba todo lo no pagado y no cuadraba con
 * su filtro, "Pago pendiente").
 */
export function resumenRecepcion(pedidos = []) {
  const r = { total: 0, porEntregar: 0, pendientesPago: 0, enProduccion: 0, entregados: 0, montoTotal: 0 };
  for (const p of lista(pedidos)) {
    r.total += 1;
    r.montoTotal += Number(p.montoTotal) || 0;
    if (p.estado?.key === 'entregado') r.entregados += 1;
    if (p.estado?.key === 'en_preparacion') r.enProduccion += 1;
    if (!p.estado?.paid && p.estado?.key !== 'anulado') r.pendientesPago += 1;
    if (porEntregar(p)) r.porEntregar += 1;
  }
  r.montoTotal = Math.round(r.montoTotal * 100) / 100;
  return r;
}

/** La dirección para copiar y pegar en la agencia: dirección, distrito, departamento y a quién. */
export function direccionParaCopiar(p = {}) {
  const e = p.entrega || {};
  const para = p.esRegalo && p.regalo?.destinatario ? p.regalo.destinatario : p.clienteNombre;
  return [
    [e.direccion, e.distrito, e.departamento].filter(Boolean).join(', '),
    [para, p.clienteContacto].filter(Boolean).join(' · '),
  ].filter(Boolean).join('\n');
}

/*
 * Gestión de pagos (D3b): los enlaces llegan como los deja normalizarEnlace
 * (services/enlacesPago.js): { id, concepto, moneda 'PEN'|'USD'|null, monto,
 * estado 'pendiente'|'pagado', createdMs, pagadoMs, metodo, tiempoPagoMs }.
 */
const DIA_MS = 86400000;

/** Los periodos del historial; 'fechas' usa desde/hasta ('AAAA-MM-DD'). */
export const PERIODOS_PAGOS = [
  { valor: '7', texto: 'Últimos 7 días' },
  { valor: '30', texto: 'Últimos 30 días' },
  { valor: '90', texto: 'Últimos 90 días' },
  { valor: 'fechas', texto: 'Elegir fechas' },
];

/** El rango [desdeMs, hastaMs] de un periodo (hasta incluye el día entero; null = sin tope). */
export function rangoDePeriodo(periodo, { desde, hasta } = {}, ahora = Date.now()) {
  const diaLocal = (iso, fin) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    return fin ? new Date(+m[1], m[2] - 1, +m[3], 23, 59, 59, 999).getTime() : new Date(+m[1], m[2] - 1, +m[3]).getTime();
  };
  if (periodo === 'fechas') return [diaLocal(desde, false), diaLocal(hasta, true)];
  const n = Number(periodo);
  if (!n) return [null, null];
  const hoy = new Date(ahora);
  return [new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (n - 1)).getTime(), null];
}

/** ¿Entra el enlace? { estado, metodo, rango: [desde, hasta], q } ('' = todos). */
export function enlaceEnFiltro(e, { estado = '', metodo = '', rango = [null, null], q = '' } = {}) {
  if (estado && e.estado !== estado) return false;
  if (metodo && e.metodo !== metodo) return false;
  const [desde, hasta] = rango;
  if (desde != null && (e.createdMs == null || e.createdMs < desde)) return false;
  if (hasta != null && (e.createdMs == null || e.createdMs > hasta)) return false;
  return !q || normalizarBusqueda(e.concepto).includes(normalizarBusqueda(q));
}

/** Las cifras del historial (sobre lo filtrado), como antes: lo cobrado separado por moneda. */
export function resumenEnlaces(enlaces = []) {
  const todos = lista(enlaces);
  const pagados = todos.filter((e) => e.estado === 'pagado');
  const suma = (moneda) => Math.round(pagados.filter((e) => e.moneda === moneda && e.monto != null).reduce((a, e) => a + e.monto, 0) * 100) / 100;
  const tiempos = pagados.map((e) => e.tiempoPagoMs).filter((t) => t != null);
  return {
    generados: todos.length,
    pagados: pagados.length,
    conversion: todos.length ? (pagados.length / todos.length) * 100 : 0,
    cobradoPEN: suma('PEN'),
    cobradoUSD: suma('USD'),
    tiempoPromedio: tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null,
  };
}

/**
 * Generados y pagados por día, **con los días sin nada en cero** (antes el
 * gráfico saltaba los días vacíos y juntaba fechas lejanas). Un pagado
 * cuenta el día en que se pagó. Hasta `maxDias` hacia atrás desde el último.
 */
export function serieDiariaEnlaces(enlaces = [], maxDias = 120) {
  const dia = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const generados = new Map();
  const pagados = new Map();
  const sumar = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (const e of lista(enlaces)) {
    if (e.createdMs != null) sumar(generados, dia(e.createdMs));
    if (e.estado === 'pagado' && (e.pagadoMs ?? e.createdMs) != null) sumar(pagados, dia(e.pagadoMs ?? e.createdMs));
  }
  const dias = [...generados.keys(), ...pagados.keys()];
  if (!dias.length) return [];
  const fin = Math.max(...dias);
  const inicio = Math.max(Math.min(...dias), fin - (maxDias - 1) * DIA_MS);
  const serie = [];
  for (let d = new Date(inicio); d.getTime() <= fin; d.setDate(d.getDate() + 1)) {
    const k = d.getTime();
    serie.push({
      dia: k,
      etiqueta: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      valores: { generados: generados.get(k) || 0, pagados: pagados.get(k) || 0 },
    });
  }
  return serie;
}

/** "2d 4h", "3h 10m", "5m 2s", "40s" (como antes); null → '—'. */
export function duracionCorta(ms) {
  if (ms == null) return '—';
  const t = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${t % 60}s`;
  return `${t}s`;
}

/** Lo que se guarda en `enlaces_pago` (como antes), o los errores del formulario. */
export function enlaceNuevo({ concepto = '', moneda = 'PEN', monto = '' } = {}) {
  const n = Number(String(monto).replace(',', '.'));
  const errores = {
    concepto: String(concepto).trim() ? undefined : 'Escribe qué se está cobrando.',
    monto: Number.isFinite(n) && n > 0 ? undefined : 'Pon un monto mayor a 0.',
  };
  if (errores.concepto || errores.monto) return { errores };
  const m = Math.round(n * 100) / 100;
  return { datos: { concepto: String(concepto).trim(), moneda, monto: m, ...(moneda === 'USD' ? { montoUSD: m } : { montoPEN: m }), estado: 'pendiente' } };
}

export const MENSAJE_PAGOS_POR_DEFECTO = 'Hola, quiero pagar mi saldo pendiente del pedido *#{id}*. Adjunto mi comprobante por S/ *{monto}*.';

/** La configuración de pagos desde los mensajes (`messages`); sin WhatsApp de pagos, el de la cuenta. */
export function configPagosDesde(m = {}) {
  const t = (k) => String(m[k] ?? '').trim();
  return {
    yapeNumero: t('yape_number'),
    yapeTitular: t('yape_name'),
    plinNumero: t('plin_number'),
    plinTitular: t('plin_name'),
    whatsapp: t('whatsapp_number_pagos') || t('whatsapp_number_cuenta'),
    mensaje: m.whatsapp_text_pagos || MENSAJE_PAGOS_POR_DEFECTO,
  };
}

/** Los mensajes que se guardan (las mismas claves de antes). */
export function configPagosAMensajes(c = {}) {
  const t = (v) => String(v ?? '').trim();
  return {
    yape_number: t(c.yapeNumero),
    yape_name: t(c.yapeTitular),
    plin_number: t(c.plinNumero),
    plin_name: t(c.plinTitular),
    whatsapp_number_pagos: t(c.whatsapp),
    whatsapp_text_pagos: c.mensaje || '',
  };
}

/*
 * Libro de reclamaciones (D3c): el documento de `libro_reclamaciones` que
 * guarda ReclamacionesDeTienda (código, estado, consumidor, bien, reclamo,
 * respuestaProveedor) y el plazo para responder (config/empresa.js:
 * plazoRespuestaDiasHabiles).
 */
const msDe = (v) => {
  if (v == null) return null;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const n = typeof v === 'string' ? Date.parse(v) : Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Un reclamo como lo usa la página. */
export function reclamoDesdeFirestore(doc = {}) {
  const c = doc.consumidor || {};
  const b = doc.bien || {};
  const r = doc.reclamo || {};
  return {
    id: doc.id,
    codigo: doc.codigo || doc.id || '',
    creadoMs: msDe(doc.createdAt),
    estado: doc.estado === 'respondido' ? 'respondido' : 'pendiente',
    tipo: r.tipo === 'queja' ? 'queja' : 'reclamo',
    consumidor: {
      nombre: c.nombre || '',
      documento: [c.tipoDocumento, c.numeroDocumento].filter(Boolean).join(' '),
      email: c.email || '',
      telefono: c.telefono || '',
      domicilio: c.domicilio || '',
      esMenor: Boolean(c.esMenor),
      apoderado: c.apoderado || '',
    },
    bien: { tipo: b.tipo === 'servicio' ? 'servicio' : 'producto', descripcion: b.descripcion || '', monto: b.montoReclamado == null ? null : Number(b.montoReclamado) },
    detalle: r.detalle || '',
    pedido: r.pedido || '',
    respuesta: doc.respuestaProveedor || '',
    respondidoMs: msDe(doc.respondidoEn),
  };
}

/** Lo que se guarda al responder (como antes); sin texto, el error. */
export function respuestaDeReclamo(texto, ahora = new Date()) {
  const t = String(texto || '').trim();
  if (!t) return { error: 'Escribe la respuesta antes de marcarlo como respondido.' };
  return { datos: { estado: 'respondido', respuestaProveedor: t, respondidoEn: ahora.toISOString() } };
}

/** Días hábiles (lunes a viernes; los feriados no se descuentan) entre dos fechas, sin contar el primero. */
export function diasHabilesEntre(desdeMs, hastaMs) {
  if (desdeMs == null || hastaMs == null || hastaMs <= desdeMs) return 0;
  const d = new Date(desdeMs);
  d.setHours(0, 0, 0, 0);
  const fin = new Date(hastaMs);
  fin.setHours(0, 0, 0, 0);
  let n = 0;
  while (d < fin) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) n += 1;
  }
  return n;
}

/**
 * Cómo va un reclamo pendiente frente al plazo: { dias, quedan, estado }
 * con estado 'a_tiempo' | 'por_vencer' (3 días hábiles o menos) | 'vencido';
 * los respondidos, null.
 */
export function plazoDeReclamo(r, plazo = 15, ahora = Date.now()) {
  if (!r || r.estado === 'respondido' || r.creadoMs == null) return null;
  const dias = diasHabilesEntre(r.creadoMs, ahora);
  const quedan = plazo - dias;
  return { dias, quedan, estado: quedan < 0 ? 'vencido' : quedan <= 3 ? 'por_vencer' : 'a_tiempo' };
}

/** Lo que se busca en un reclamo: código, nombre, documento, correo y pedido. */
export const textoDeReclamo = (r) => [r.codigo, r.consumidor?.nombre, r.consumidor?.documento, r.consumidor?.email, r.pedido].filter(Boolean).join(' ');

/*
 * Crear cuentas desde pedidos (D3c): lo que devuelve
 * migrateLegacyAutoCreatedUsers, en filas con su nombre. En la simulación
 * salen los "se harían"; en la de verdad, los hechos.
 */
export function filasMigracion(d = {}) {
  const fila = (texto, valor) => (valor == null ? null : { texto, valor: Number(valor) || 0 });
  const comunes = [fila('Candidatos', d.candidateUserIds), fila('Ya estaban en la colección nueva', d.alreadyInTarget), fila('No estaban en la colección vieja', d.notFoundInLegacy)];
  const propias = d.dryRun
    ? [fila('Se migrarían', d.wouldMigrate), fila('Se borrarían de la vieja', d.wouldDeleteFromLegacy), fila('Se borrarían (ya migrados antes)', d.wouldDeleteAlreadyMigrated)]
    : [fila('Migrados', d.migrated), fila('Borrados de la vieja', d.deletedFromLegacy), fila('Borrados (ya migrados antes)', d.deletedAlreadyMigrated)];
  return [...comunes.slice(0, 1), ...propias, ...comunes.slice(1)].filter(Boolean);
}

/* ── Resultados (D4) ───────────────────────────────────── */

/*
 * Los datos llegan como los arma useDashboardAnalytics (dashboard/dashShared):
 * data.visitas.total.total, data.ventas.pedidos.total, data.ventas.ingresosCents.total
 * (céntimos), data.canales, data.visitasPorDia, data.otrosCobros…, y `anterior`
 * con el periodo de antes ({ visitas, pedidos, ingresosCents, diasConVentas }).
 * Las cuentas son las de antes (calcularDelta y calcularDeltaPuntos).
 */
const enteroPE = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const solesDeCentimos = (c) => `S/ ${((Number(c) || 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const decimal = (v) => (Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 });

/** De cada 100 visitas, cuántas compran (un decimal). */
export const porCienVisitas = (pedidos, visitas) => (visitas > 0 ? Math.round((pedidos / visitas) * 1000) / 10 : 0);

/** El cambio en % contra el periodo anterior: { texto: '▲ 12%', bueno } (sin base previa, '▲ nuevo'). */
export function cambioPorcentual(actual, previo) {
  if (actual == null || previo == null) return null;
  const a = Number(actual) || 0;
  const b = Number(previo) || 0;
  if (b === 0) return a === 0 ? { texto: '= 0%', bueno: true } : { texto: '▲ nuevo', bueno: true };
  const pct = ((a - b) / b) * 100;
  if (Math.round(pct * 10) === 0) return { texto: '= 0%', bueno: true };
  return { texto: `${pct > 0 ? '▲' : '▼'} ${decimal(Math.abs(pct))}%`, bueno: pct > 0 };
}

/** El cambio de algo que ya es un porcentaje, en puntos: { texto: '▲ 0.4 pp', bueno }. */
export function cambioEnPuntos(actual, previo) {
  if (actual == null || previo == null) return null;
  const d = Math.round(((Number(actual) || 0) - (Number(previo) || 0)) * 10) / 10;
  if (d === 0) return { texto: '= 0 pp', bueno: true };
  return { texto: `${d > 0 ? '▲' : '▼'} ${decimal(Math.abs(d))} pp`, bueno: d > 0 };
}

const diferenciaCon = (actual, previo, formato) => {
  const d = (Number(actual) || 0) - (Number(previo) || 0);
  return d === 0 ? '=' : `${d > 0 ? '+' : '−'}${formato(Math.abs(d))}`;
};

/**
 * Las cuatro cifras del Resumen y la comparativa con el periodo anterior.
 *  - datos · anterior · comparar · canal: { canal, visitas, pedidos } (solo ese canal)
 *  → { cifras: [{ id, nombre, valor, cambio, explicacion }], comparativa: [{ nombre, actual, previo, diferencia, cambio }], hayAnterior }
 */
export function cifrasDelResumen({ datos, anterior, comparar = false, canal = null } = {}) {
  const visitas = datos?.visitas?.total?.total || 0;
  const pedidos = datos?.ventas?.pedidos?.total || 0;
  const ventas = datos?.ventas?.ingresosCents?.total || 0;
  const hayAnterior = Boolean(comparar && anterior && anterior.diasConVentas > 0);
  const vPrev = anterior?.visitas?.total || 0;
  const pPrev = anterior?.pedidos?.total || 0;
  const iPrev = anterior?.ingresosCents?.total || 0;
  const conv = porCienVisitas(pedidos, visitas);
  const convPrev = porCienVisitas(pPrev, vPrev);
  const con = (c) => (hayAnterior && !canal ? c : null);
  const nota = canal ? ` Solo visitas de ${canal.canal}.` : '';
  const cifras = [
    { id: 'visitas', nombre: 'Visitas', valor: enteroPE(canal ? canal.visitas : visitas), cambio: con(cambioPorcentual(visitas, vPrev)), explicacion: `Personas que entraron a la tienda o a la app. Si alguien vuelve antes de 30 minutos, es la misma visita. No cuenta robots ni al equipo.${nota}` },
    { id: 'pedidos', nombre: 'Pedidos', valor: enteroPE(canal ? canal.pedidos : pedidos), cambio: con(cambioPorcentual(pedidos, pPrev)), explicacion: `Pedidos enviados desde la tienda o la app, aunque todavía no estén pagados.${nota}` },
    { id: 'ventas', nombre: 'Ventas', valor: solesDeCentimos(ventas), cambio: con(cambioPorcentual(ventas, iPrev)), explicacion: `Suma de lo que llevan esos pedidos (precio por cantidad). No incluye sorteos, suscripciones ni pagos de saldo.${canal ? ' Las ventas no se separan por canal: es el total.' : ''}` },
    { id: 'conversion', nombre: 'De cada 100 visitas compran', valor: decimal(canal ? porCienVisitas(canal.pedidos, canal.visitas) : conv), cambio: con(cambioEnPuntos(conv, convPrev)), explicacion: `Pedidos ÷ visitas × 100.${nota}` },
  ];
  const comparativa = hayAnterior ? [
    { nombre: 'Visitas', actual: enteroPE(visitas), previo: enteroPE(vPrev), diferencia: diferenciaCon(visitas, vPrev, enteroPE), cambio: cambioPorcentual(visitas, vPrev) },
    { nombre: 'Pedidos', actual: enteroPE(pedidos), previo: enteroPE(pPrev), diferencia: diferenciaCon(pedidos, pPrev, enteroPE), cambio: cambioPorcentual(pedidos, pPrev) },
    { nombre: 'Ventas', actual: solesDeCentimos(ventas), previo: solesDeCentimos(iPrev), diferencia: diferenciaCon(ventas, iPrev, solesDeCentimos), cambio: cambioPorcentual(ventas, iPrev) },
    // En puntos el cambio ya es la diferencia: no se repite.
    { nombre: 'De cada 100 visitas compran', actual: decimal(conv), previo: decimal(convPrev), diferencia: null, cambio: cambioEnPuntos(conv, convPrev) },
  ] : [];
  return { cifras, comparativa, hayAnterior };
}

const NOMBRES_COBRO = {
  sorteo: ['ticket de sorteo', 'tickets de sorteo'],
  suscripcion: ['suscripción', 'suscripciones'],
  saldo: ['pago de saldo', 'pagos de saldo'],
  pago_rapido: ['pago rápido', 'pagos rápidos'],
  otro: ['otro cobro', 'otros cobros'],
};

/** "Otros cobros" (no son pedidos de la tienda): { montos: 'S/ 120.00 + USD 20.00', detalle: '3 tickets de sorteo · 1 pago de saldo' } o null. */
export function otrosCobrosDe(cobros = {}) {
  const fuentes = Object.entries(cobros || {}).filter(([, c]) => c?.cantidad > 0);
  if (!fuentes.length) return null;
  const porMoneda = {};
  fuentes.forEach(([, c]) => Object.entries(c.porMoneda || {}).forEach(([m, cents]) => { porMoneda[m] = (porMoneda[m] || 0) + cents; }));
  return {
    montos: Object.entries(porMoneda).map(([m, c]) => (m === 'PEN' ? solesDeCentimos(c) : `${m} ${((Number(c) || 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`)).join(' + '),
    detalle: fuentes.map(([f, c]) => `${enteroPE(c.cantidad)} ${(NOMBRES_COBRO[f] || NOMBRES_COBRO.otro)[c.cantidad === 1 ? 0 : 1]}`).join(' · '),
  };
}

/** Visitas por día para GraficoTendencia: [{ etiqueta: 'DD/MM', valores: { visitas } }]. */
export const serieDeVisitas = (porDia = []) => lista(porDia).map((d) => ({ etiqueta: d.day ? `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}` : '', valores: { visitas: Number(d.total) || 0 } }));

/** Los periodos de Resultados: hoy, ayer, 7, 30, 90 días o fechas. */
export const PERIODOS_RESULTADOS = [
  { id: 'hoy', texto: 'Hoy' },
  { id: 'ayer', texto: 'Ayer' },
  { id: '7', texto: '7 días' },
  { id: '30', texto: '30 días' },
  { id: '90', texto: '90 días' },
  { id: 'fechas', texto: 'Fechas' },
];

/*
 * Productos y Visitantes de Resultados (D4b): las filas de cada ranking
 * ({ id, nombre, valor, texto, sub, imagen }) para ListaBarras, desde el
 * mismo resumen diario. productoDe(id, nombre) → { nombre, imagen } (del
 * catálogo, con los ocultos) y nombreCategoria(id) → nombre los pone el conector.
 */
const cuentaDe = (n, uno, varios) => `${enteroPE(n)} ${Number(n) === 1 ? uno : varios}`;
const pctDe = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/** Las listas de la pestaña Productos. medida: 'ingresos' | 'unidades' (cómo se ordenan los vendidos). */
export function listasDeProductos({ datos = {}, productoDe = (id, n) => ({ nombre: n || 'Producto sin nombre', imagen: '' }), nombreCategoria = (id) => id, medida = 'ingresos' } = {}) {
  const d = datos || {};
  const producto = (id, n) => {
    const p = productoDe(id, n) || {};
    return { nombre: p.nombre || n || 'Producto sin nombre', imagen: p.imagen || '' };
  };
  const vistos = lista(d.topProducts).map((p) => ({ id: p.productId || p.name, ...producto(p.productId, p.name), valor: p.total, texto: cuentaDe(p.total, 'vista', 'vistas') }));
  const vendidos = lista(d.topVendidos).map((p) => ({
    id: p.productId,
    ...producto(p.productId),
    valor: medida === 'ingresos' ? p.ingresosCents : p.unidades,
    texto: medida === 'ingresos' ? solesDeCentimos(p.ingresosCents) : `${enteroPE(p.unidades)} u.`,
    sub: cuentaDe(p.pedidos, 'pedido', 'pedidos'),
  })).sort((a, b) => b.valor - a.valor);
  const masMirados = lista(d.interes?.productos).map((p) => ({
    id: p.productId, ...producto(p.productId), valor: p.dwellMs, texto: duracionCorta(p.dwellMs),
    sub: p.personas ? `${cuentaDe(p.personas, 'persona', 'personas')} con cuenta` : 'Solo visitantes sin cuenta',
  }));
  const lineasVistas = lista(d.topCategoriesByViews).map((c) => ({ id: c.id || c.name, nombre: c.name || nombreCategoria(c.id), valor: c.total, texto: cuentaDe(c.total, 'vista', 'vistas') }));
  const porLinea = new Map();
  lista(d.topVendidos).forEach((p) => {
    const k = p.linea || 'Sin línea';
    const x = porLinea.get(k) || { cents: 0, unidades: 0 };
    x.cents += Number(p.ingresosCents) || 0;
    x.unidades += Number(p.unidades) || 0;
    porLinea.set(k, x);
  });
  const lineasVendidas = [...porLinea.entries()]
    .map(([k, x]) => ({ id: k, nombre: k === 'Sin línea' ? k : nombreCategoria(k), valor: x.cents, texto: solesDeCentimos(x.cents), sub: `${enteroPE(x.unidades)} u.` }))
    .sort((a, b) => b.valor - a.valor);
  const colecciones = lista(d.topCollectionsByViews).map((c) => ({ id: c.id || c.name, nombre: c.name || c.id, valor: c.total, texto: cuentaDe(c.total, 'vista', 'vistas') }));
  const busquedas = lista(d.topSearches).map((x) => ({ id: x.query, nombre: `«${x.query}»`, valor: x.total, texto: cuentaDe(x.total, 'vez', 'veces') }));
  const deseos = lista(d.deseos?.topProductos).map((p) => ({ id: p.productId, ...producto(p.productId, p.nombre), valor: p.agregados, texto: cuentaDe(p.agregados, 'vez', 'veces') }));
  return { vistos, vendidos, masMirados, lineasVistas, lineasVendidas, colecciones, busquedas, deseos };
}

const NOMBRES_DISPOSITIVO = { Mobile: 'Celular', Desktop: 'Computadora', Tablet: 'Tablet', Desconocido: 'No se sabe' };
const NOMBRES_CLIENTE = { APP: 'App Walá', WEB: 'Web (wala.pe)' };

/* Una lista con su parte del total: "41%" y "2,278 visitas" debajo. */
function conPorcentaje(filas = [], nombres = {}) {
  const suma = lista(filas).reduce((a, x) => a + (Number(x.count) || 0), 0);
  return lista(filas).map((x) => ({
    id: x.code || x.name,
    nombre: nombres[x.name] || (!x.name || /^(unknown|desconocido)$/i.test(x.name) ? 'No se sabe' : x.name),
    valor: x.count,
    texto: `${pctDe(x.count, suma)}%`,
    sub: cuentaDe(x.count, 'visita', 'visitas'),
  }));
}

/** La pestaña Visitantes: cifras, canal por canal, país (o el aproximado) y con qué entran. */
export function listasDeVisitantes(datos = {}) {
  const d = datos || {};
  const v = d.visitas || {};
  const visitas = v.total?.total || 0;
  const paises = conPorcentaje(d.byCountry);
  const aprox = paises.length ? [] : conPorcentaje(d.byCountryAprox);
  return {
    cifras: [
      { id: 'visitas', nombre: 'Visitas', valor: enteroPE(visitas) },
      { id: 'personas', nombre: 'Personas distintas', valor: d.personas ? enteroPE(d.personas.total) : '—', ayuda: 'Mismo celular o computadora = 1' },
      { id: 'interaccion', nombre: 'Hicieron algo', valor: `${pctDe(v.conInteraccion?.total || 0, visitas)}%`, ayuda: 'Vieron 2+ páginas, 10 s o pidieron' },
      { id: 'paginas', nombre: 'Páginas por visita', valor: visitas ? decimal((v.paginas?.total || 0) / visitas) : '—' },
      { id: 'tiempo', nombre: 'Tiempo por visita', valor: visitas ? duracionCorta(Math.round((v.dwellMs?.total || 0) / visitas)) : '—' },
    ],
    canales: lista(d.canales).map((c) => ({
      id: c.canal, canal: c.canal, visitas: enteroPE(c.visitas), parte: `${pctDe(c.visitas, visitas)}%`,
      interaccion: `${pctDe(c.conInteraccion, c.visitas)}%`, pedidos: enteroPE(c.pedidos), conversion: decimal(porCienVisitas(c.pedidos, c.visitas)),
    })),
    paises: paises.length ? paises : aprox,
    paisAproximado: !paises.length && aprox.length > 0,
    dispositivos: conPorcentaje(d.byDevice, NOMBRES_DISPOSITIVO),
    clientes: conPorcentaje(d.byClientType, NOMBRES_CLIENTE),
  };
}

/*
 * Clientes de Resultados (D4c): los carritos abandonados (abandonedCarts del
 * resumen), los cumpleaños (getDatosPersonalesAggregate) y la ficha de un
 * cliente (getUserFicha + getUserAnalytics), como los usaba la pestaña de antes.
 */
const fechaCorta = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
};
const solesDe = (v) => `S/ ${(Number(v) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Hoy", "Mañana", "En 5 días". */
export const enDiasTexto = (n) => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`);

/** Quién dejó un carrito: su nombre, el del perfil, su correo o "Visitante sin cuenta". */
export function quienDelCarrito(c = {}, perfil = null) {
  return c.displayName || perfil?.displayName || c.email || perfil?.email || (c.uid ? 'Cliente' : 'Visitante sin cuenta');
}

/** Los próximos cumpleaños: [{ id, enDias, cuando, pronto, quien, detalle }]. */
export function cumpleanosDe(lista_ = []) {
  return lista(lista_).map((c, i) => ({
    id: `${c.uid}-${c.fecha}-${c.dePersona}-${i}`,
    enDias: c.enDias,
    cuando: enDiasTexto(c.enDias),
    pronto: c.enDias <= 7,
    quien: c.esTitular ? c.nombre : c.dePersona,
    detalle: `${c.fechaLegible || c.fecha}${c.esTitular ? '' : ` · lo agendó ${c.nombre}`}`,
  }));
}

/**
 * Lo de arriba de la ficha y su resumen.
 *  - ficha (getUserFicha) · actividad (getUserAnalytics, puede faltar)
 *  → { contacto, chips: [texto], cifras: [{ nombre, valor, ayuda }], notas: [texto] }
 */
export function resumenDeFicha(ficha = {}, actividad = null) {
  const f = ficha || {};
  const m = actividad?.metrics || {};
  const telefono = f.phoneIntl?.full || f.phone || '';
  const sesionesApp = lista(actividad?.sessions).filter((x) => x.clientType === 'APP').length;
  const historico = actividad?.estimatedSummary?.isEstimated ? actividad.estimatedSummary : null;
  return {
    contacto: [f.email, f.dni && `${f.tipoDocumento || 'Doc.'} ${f.dni}`, telefono, f.country].filter(Boolean).join(' · ') || 'Sin datos de contacto',
    chips: [`${enteroPE(f.monedas)} monedas`, f.hasCompletedSurvey ? 'Completó la encuesta' : 'Sin encuesta', f.marketingConsent?.whatsapp === true ? 'Acepta WhatsApp' : 'No aceptó WhatsApp'],
    cifras: actividad ? [
      { nombre: 'Visitas', valor: enteroPE(m.totalSessions) },
      { nombre: 'Páginas vistas', valor: enteroPE(m.totalPageViews) },
      { nombre: 'Tiempo en la tienda', valor: duracionCorta(m.totalDwellMs || 0) },
      { nombre: 'Días que entró', valor: enteroPE(m.activeDays) },
      { nombre: 'Última vez', valor: fechaCorta(m.lastAccessAtMs) || '—' },
      { nombre: 'Usa la app', valor: sesionesApp ? 'Sí' : 'No', ayuda: sesionesApp ? `${enteroPE(sesionesApp)} ${sesionesApp === 1 ? 'visita' : 'visitas'} desde la app` : undefined },
    ] : [],
    notas: [
      [
        fechaCorta(f.createdAtMs) && `Cuenta creada el ${fechaCorta(f.createdAtMs)}`,
        `${enteroPE(f.wishlist?.count)} en su lista de deseos`,
        `${enteroPE(f.cart?.count)} en su carrito`,
        `${enteroPE(lista(f.giftRecipients).length)} personas agendadas`,
      ].filter(Boolean).join(' · '),
      historico && `Compras de antes de medir (estimado con los pedidos del ERP): ${enteroPE(historico.orderCount)} pedidos por ${solesDe(historico.totalSpent)}, del ${fechaCorta(historico.firstOrderAtMs) || '—'} al ${fechaCorta(historico.lastOrderAtMs) || '—'}.`,
    ].filter(Boolean),
  };
}

/** Las listas de la ficha: lo que mira, deseos, carrito y personas, listas para mostrar. */
export function listasDeFicha(ficha = {}, actividad = null, productoDe = () => null) {
  const f = ficha || {};
  return {
    mira: lista(actividad?.productInterest).slice(0, 8).map((r) => {
      const p = productoDe(r.productId) || {};
      return { id: r.productId, nombre: p.nombre || r.name || 'Producto', imagen: p.imagen || '', detalle: `${duracionCorta(r.dwellMs)} · ${enteroPE(r.views)} ${r.views === 1 ? 'vista' : 'vistas'}` };
    }),
    deseos: lista(f.wishlist?.items).map((it, i) => ({
      id: `${it.productId || 'p'}-${i}`, nombre: it.productName, imagen: it.productImage || '',
      detalle: [it.price > 0 ? solesDe(it.price) : null, fechaCorta(it.addedAt) && `agregado el ${fechaCorta(it.addedAt)}`].filter(Boolean).join(' · '),
      marca: it.isGifted ? `Ya se lo regalaron${it.giftedBy ? ` (${it.giftedBy})` : ''}` : null,
    })),
    carrito: lista(f.cart?.items).map((it, i) => ({
      id: `${it.productId || 'p'}-${i}`, nombre: it.productName, imagen: it.productImage || '',
      detalle: `${enteroPE(it.quantity)} × ${solesDe(it.price)} = ${solesDe(it.subtotal)}`,
      marca: it.selected === false ? 'Lo dejó para después' : null,
    })),
    carritoResumen: lista(f.cart?.items).length ? `${enteroPE(f.cart?.unidades)} unidades por unos ${solesDe(f.cart?.totalEstimado)}. Es lo que tiene ahora: cambia cada vez que navega o compra.` : '',
    personas: lista(f.giftRecipients).map((p, i) => ({
      id: p.id || `persona-${i}`, nombre: p.name, rol: p.roleDisplay,
      fechas: lista(p.events).length ? p.events.map((ev) => `${ev.label}: ${ev.dateLegible || ev.date || 'sin fecha'}`).join(' · ') : 'Sin fechas',
    })),
    cumpleanos: f.birthdayLegible ? `Su cumpleaños: ${f.birthdayLegible}` : 'No registró su cumpleaños.',
  };
}

/*
 * Detalle técnico de Resultados (D4d): la calidad de los datos y la
 * reconstrucción del resumen diario por tramos (BackfillAnaliticaButton:
 * aggregateAnalyticsDailyBackfill acepta hasta 120 días por llamada; se manda
 * de a 10 para ver el avance; el tope de la pantalla es 365).
 */
export const MAX_DIAS_RECONSTRUIR = 365;
const claveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const esClaveDia = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

/** Los últimos n días hasta hoy (incluido): { desde, hasta } en 'AAAA-MM-DD'. */
export function ultimosDias(n, hoy = new Date()) {
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (n - 1));
  return { desde: claveDia(desde), hasta: claveDia(hoy) };
}

/** Cuántos días hay entre dos claves, las dos incluidas (null si no se puede). */
export function diasEntreClaves(desde, hasta) {
  if (!esClaveDia(desde) || !esClaveDia(hasta)) return null;
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  if (b < a) return null;
  return Math.round((b - a) / DIA_MS) + 1;
}

/** El rango partido en tramos seguidos de hasta `dias` días: [{ fromDay, toDay }]. */
export function tramosDeDias(desde, hasta, dias = 10) {
  const tramos = [];
  if (diasEntreClaves(desde, hasta) == null) return tramos;
  const cursor = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (cursor <= fin) {
    const ini = claveDia(cursor);
    cursor.setDate(cursor.getDate() + dias - 1);
    tramos.push({ fromDay: ini, toDay: cursor < fin ? claveDia(cursor) : hasta });
    cursor.setDate(cursor.getDate() + 1);
  }
  return tramos;
}

/** La ayuda bajo las fechas de "Reconstruir": qué va a pasar o qué está mal. */
export function ayudaDeRango(desde, hasta) {
  const n = diasEntreClaves(desde, hasta);
  if (n == null) return { valido: false, texto: 'Elige las dos fechas, y que «Desde» no sea después de «Hasta».' };
  if (n > MAX_DIAS_RECONSTRUIR) return { valido: false, texto: `El rango (${n} días) supera el máximo de ${MAX_DIAS_RECONSTRUIR}. Divídelo en partes.` };
  return { valido: true, dias: n, texto: `Se reconstruirán ${n} ${n === 1 ? 'día' : 'días'}.` };
}

/** Las filas de "Calidad de los datos": de las pestañas registradas a las visitas. null si el periodo no se midió así. */
export function filasDeCalidad(calidad, visitas) {
  if (!(calidad?.diasMedidos > 0)) return null;
  return [
    { id: 'registradas', texto: 'Pestañas registradas', valor: enteroPE(calidad.sesionesRegistradas) },
    { id: 'robots', texto: '− Robots (buscadores y navegadores automáticos)', valor: enteroPE(calidad.sesionesBot) },
    { id: 'equipo', texto: '− Equipo admin', valor: enteroPE(calidad.sesionesAdmin) },
    { id: 'sinPaginas', texto: '− Sin ninguna página vista', valor: enteroPE(calidad.sinPaginas) },
    { id: 'unidas', texto: '− Otra pestaña de la misma visita (menos de 30 min)', valor: enteroPE(calidad.unidas) },
    { id: 'visitas', texto: '= Visitas', valor: enteroPE(visitas?.total?.total), total: true },
  ];
}

/*
 * Las pantallas técnicas (D4d): Páginas y tiempo, Uso y permanencia,
 * Navegador y sistema, sobre el mismo `data` de useDashboardAnalytics /
 * useGlobalAnalytics. Muchos números llegan como TAW ({ total, app, web }).
 * nombrePagina (prettyRouteName) y rutaCorta (shortPath) los pone el conector.
 */
const totalTAW = (v) => (typeof v === 'number' ? v : Number(v?.total) || 0);
const msDeTs = (v) => {
  if (v == null) return null;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Un TAW según el origen ('todos' | 'app' | 'web'), como segTAW: si el dato
 * no trae el corte, el total y sinDesglose. → { valor, sinDesglose }
 */
export function segunOrigen(taw, origen = 'todos') {
  if (origen !== 'app' && origen !== 'web') return { valor: totalTAW(taw), sinDesglose: false };
  const v = taw && typeof taw === 'object' ? taw[origen] : undefined;
  return v == null ? { valor: totalTAW(taw), sinDesglose: true } : { valor: Number(v) || 0, sinDesglose: false };
}

/** Las páginas vistas por día desde eventsForCharts: [{ etiqueta 'DD/MM', valores: { total, app, web } }] en orden. */
export function traficoPorDia(eventos = []) {
  const dias = new Map();
  for (const e of lista(eventos)) {
    if (e?.type !== 'page_view') continue;
    const ms = Number(e.clientTsMs) || msDeTs(e.createdAt);
    if (!ms) continue;
    const d = new Date(ms);
    const clave = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const x = dias.get(clave) || { etiqueta: clave, ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), valores: { total: 0, app: 0, web: 0 } };
    x.valores.total += 1;
    x.valores[e.clientType === 'APP' ? 'app' : 'web'] += 1;
    dias.set(clave, x);
  }
  return [...dias.values()].sort((a, b) => a.ts - b.ts);
}

/** El seguimiento de pedidos: orderTracking o, si no llegó, contado en eventsForCharts sobre /cuenta/pedidos (como antes). */
export function seguimientoDePedidos(datos = {}) {
  if (datos?.orderTracking) return datos.orderTracking;
  let views = 0;
  let totalDwellMs = 0;
  let conTiempo = 0;
  const personas = new Set();
  for (const e of lista(datos?.eventsForCharts)) {
    const ruta = typeof e.path === 'string' ? e.path.split('?')[0].split('#')[0] : '';
    if (ruta !== '/cuenta/pedidos' && !ruta.startsWith('/cuenta/pedidos/')) continue;
    if (e.type === 'page_view') views += 1;
    if (e.type === 'route_dwell') { totalDwellMs += Number(e.dwellMs) || 0; conTiempo += 1; }
    const quien = e.uid || e.anonymousId || e.email;
    if (quien) personas.add(quien);
  }
  return { views, uniqueUsers: personas.size, totalDwellMs, avgDwellMs: conTiempo ? Math.round(totalDwellMs / conTiempo) : 0 };
}

/** Páginas y tiempo: las rutas más vistas y lo más buscado como filas de ListaBarras, y el total de búsquedas. */
export function listasDePaginas(datos = {}, { nombrePagina = (p) => p, rutaCorta = (p) => p } = {}) {
  const rutas = lista(datos?.topRoutesByViews).map((r) => ({ id: r.path, nombre: nombrePagina(r.path), valor: totalTAW(r.views), texto: cuentaDe(totalTAW(r.views), 'vista', 'vistas'), sub: rutaCorta(r.path) }));
  const busquedas = lista(datos?.topSearches).map((x) => ({ id: x.query, nombre: x.query, valor: x.total, texto: enteroPE(x.total) }));
  return { rutas, busquedas, totalBusquedas: busquedas.reduce((a, b) => a + (Number(b.valor) || 0), 0) };
}

/** "anon_3f9a1b": la clave de un visitante sin cuenta, corta. */
export function claveAnonimaCorta(clave) {
  const s = String(clave || '');
  const partes = s.split('_');
  return `anon_${(partes[partes.length - 1] || s).slice(0, 6)}`;
}

/**
 * Uso y permanencia: las cuatro cifras cortadas por origen y las listas.
 *  - datos · origen · nombrePagina · rutaCorta · areas ([{ area, views }] de deriveAppUsage, del conector)
 */
export function listasDeUso({ datos = {}, origen = 'todos', nombrePagina = (p) => p, rutaCorta = (p) => p, areas = [] } = {}) {
  const d = datos || {};
  const sesiones = segunOrigen(d.totalSessions, origen);
  const paginas = d.__source === 'analytics_daily' ? segunOrigen(d.pageViews, origen) : (() => {
    const vistas = lista(d.eventsForCharts).filter((e) => e.type === 'page_view');
    const app = vistas.filter((e) => e.clientType === 'APP').length;
    return { valor: origen === 'app' ? app : origen === 'web' ? vistas.length - app : vistas.length, sinDesglose: false };
  })();
  const sd = d.scrollDepth || {};
  const scroll = origen === 'app' && sd.avgApp != null ? sd.avgApp : origen === 'web' && sd.avgWeb != null ? sd.avgWeb : sd.avgTotal;
  const tiempo = segunOrigen(d.avgDwellPerSessionMs, origen);
  const conRutas = (filas, campo, formato) => lista(filas)
    .map((r) => ({ id: r.path, nombre: nombrePagina(r.path), sub: rutaCorta(r.path), valor: segunOrigen(r[campo], origen).valor }))
    .filter((r) => origen === 'todos' || r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((r) => ({ ...r, texto: formato(r.valor) }));
  const NOMBRES_FUNCION = { editor: 'Editor de prendas', minijuegos: 'Minijuegos', misiones: 'Misiones', wishlist: 'Lista de deseos', busqueda: 'Búsqueda' };
  return {
    sinDesglose: sesiones.sinDesglose || paginas.sinDesglose || tiempo.sinDesglose,
    cifras: [
      { id: 'sesiones', nombre: 'Sesiones', valor: enteroPE(sesiones.valor) },
      { id: 'paginas', nombre: 'Páginas vistas', valor: enteroPE(paginas.valor) },
      { id: 'scroll', nombre: 'Scroll medio', valor: `${enteroPE(scroll)}%` },
      { id: 'tiempo', nombre: 'Tiempo medio por sesión', valor: duracionCorta(tiempo.valor) },
    ],
    visitantes: [...lista(d.topIdentities)]
      .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0) || (Number(b.dwellMs) || 0) - (Number(a.dwellMs) || 0))
      .slice(0, 10)
      .map((v) => ({
        id: v.clave,
        nombre: v.logueado ? (v.nombre && v.nombre !== 'anónimo' ? v.nombre : 'Cliente logueado') : `Visitante anónimo (${claveAnonimaCorta(v.clave)})`,
        valor: Number(v.views) || 0,
        texto: cuentaDe(v.views, 'página', 'páginas'),
        sub: `${v.logueado ? 'Con cuenta' : 'Sin cuenta'} · ${duracionCorta(Number(v.dwellMs) || 0)} de permanencia`,
      })),
    areas: lista(areas).map((a) => ({ id: a.area, nombre: a.area, valor: a.views, texto: a.pct != null ? `${Math.round(a.pct)}%` : enteroPE(a.views), sub: cuentaDe(a.views, 'vista', 'vistas') })),
    funciones: lista(d.featureUsage).map((f) => ({ id: f.area, nombre: NOMBRES_FUNCION[f.area] || f.area, valor: f.total, texto: enteroPE(f.total) })),
    rutasVistas: conRutas(d.topRoutesByViews, 'views', (v) => cuentaDe(v, 'vista', 'vistas')),
    rutasTiempo: conRutas(d.topRoutesByDwell, 'dwellMs', duracionCorta),
    busquedas: lista(d.topSearches).map((x) => ({ id: x.query, nombre: x.query, valor: x.total, texto: enteroPE(x.total) })),
  };
}

/** El nombre de un país por su código (como DashOrigen): 'Perú', 'Sin identificar', 'Otros'. */
export function nombreDePais(code, guardado) {
  const c = String(code || '').toUpperCase();
  if (!c || c === 'UNKNOWN') return 'Sin identificar';
  if (c === 'OTROS') return 'Otros';
  if (guardado && guardado !== code) return guardado;
  try {
    const n = new Intl.DisplayNames(['es'], { type: 'region' }).of(c);
    if (n && n !== c) return n;
  } catch {
    // Un código que no es ISO: queda tal cual.
  }
  return c;
}

/* Filas con su parte del total: "41%" y debajo cuántos. */
const conParte = (filas, nombreDe, unidad = ['sesión', 'sesiones']) => {
  const suma = filas.reduce((a, x) => a + (Number(x.count) || 0), 0);
  return filas.map((x) => ({ id: x.code || x.name, nombre: nombreDe(x), valor: Number(x.count) || 0, texto: `${pctDe(x.count, suma)}%`, sub: cuentaDe(x.count, unidad[0], unidad[1]) }));
};

/** Navegador y sistema: cifras, aparatos, navegadores, sistemas, país (confiable y aproximado), app o web con su cambio, fuentes, campañas y regiones. */
export function listasDeNavegador({ datos = {}, anterior = null, comparar = false } = {}) {
  const d = datos || {};
  const fuente = lista(d.utmStats?.topSources)[0];
  const region = lista(d.geographyStats?.topRegions)[0];
  const app = lista(d.byClientType).find((x) => x.name === 'APP')?.count || 0;
  const web = lista(d.byClientType).find((x) => x.name === 'WEB')?.count || 0;
  const NOMBRES_TIPO = { APP: 'App (instalada)', WEB: 'Web (navegador)' };
  const cov = d.extendedCoverage || {};
  const sinDesglose = Math.max(0, (Number(cov.closedDocs) || 0) - (Number(cov.docsWithBreakdowns) || 0));
  let cambioTipo = null;
  if (comparar && anterior) {
    cambioTipo = anterior.daysWithData === 0 ? { sinDatos: true } : { app: cambioPorcentual(app, anterior.sessions?.app), web: cambioPorcentual(web, anterior.sessions?.web) };
  }
  return {
    cifras: [
      { id: 'vivo', nombre: 'Sesiones en vivo', valor: enteroPE(totalTAW(d.realtimeActiveSessions)) },
      { id: 'muestras', nombre: 'Muestras de dispositivo', valor: enteroPE(lista(d.byDevice).reduce((a, x) => a + (Number(x.count) || 0), 0)) },
      { id: 'fuente', nombre: fuente ? `Fuente líder · ${fuente.name}` : 'Fuente líder', valor: fuente ? enteroPE(fuente.value) : '—' },
      { id: 'region', nombre: region ? `Región líder · ${region.name}` : 'Región líder', valor: region ? enteroPE(region.count) : '—' },
    ],
    dispositivos: conParte(lista(d.byDevice), (x) => x.name),
    navegadores: conParte(lista(d.byBrowser), (x) => x.name),
    sistemas: conParte(lista(d.byOS), (x) => x.name),
    paises: conParte(lista(d.byCountry), (x) => nombreDePais(x.code, x.name)),
    paisesAprox: conParte(lista(d.byCountryAprox), (x) => nombreDePais(x.code, x.name)),
    diasSinPais: sinDesglose,
    primerDiaPais: cov.firstBreakdownDay || null,
    tipos: conParte(lista(d.byClientType), (x) => NOMBRES_TIPO[x.name] || x.name),
    cambioTipo,
    fuentes: lista(d.utmStats?.topSources).slice(0, 6).map((x) => ({ id: x.name, nombre: x.name, valor: x.value, texto: enteroPE(x.value) })),
    campanas: lista(d.utmStats?.topCampaigns).slice(0, 5).map((x) => ({ id: x.name, nombre: x.name, valor: x.count, texto: enteroPE(x.count) })),
    regiones: lista(d.geographyStats?.topRegions).slice(0, 6).map((x) => ({ id: x.name, nombre: x.name, valor: x.count, texto: enteroPE(x.count) })),
  };
}

/* ── Clientes y fidelidad (D5) ─────────────────────────── */

/*
 * Referidos (D5a): solo seguimiento. claimReferralSecure paga cuando el
 * pedido queda Finalizado en el ERP; aquí nadie aprueba nada.
 */
export const ESTADOS_REFERIDO = {
  sent: { texto: 'Enlace creado', tono: 'neutro', ayuda: 'Nadie lo abrió todavía' },
  clicked: { texto: 'Abrió el enlace', tono: 'neutro' },
  registered: { texto: 'Creó su cuenta', tono: 'violeta', ayuda: 'Por invitación' },
  purchased: { texto: 'Compró', tono: 'aviso', ayuda: 'Esperando la entrega' },
  completed: { texto: 'Aprobado', tono: 'exito', ayuda: 'Sistema anterior' },
  claimed: { texto: 'Monedas reclamadas', tono: 'exito' },
  ineligible: { texto: 'No califica', tono: 'peligro' },
};

/**
 * Un referido para la lista. estimar(total, referido) → monedas
 * (estimateReferralReward de services/referrals, la misma fórmula que paga el servidor).
 */
export function referidoDesdeFirestore(doc = {}, estimar = () => 0) {
  const ms = msDeTs(doc.createdAt);
  const conPedido = Boolean(doc.orderId);
  const reclamado = doc.status === 'claimed';
  return {
    id: doc.id,
    creadoMs: ms,
    codigo: doc.referrerCode || '',
    enlace: doc.tipo === 'invitacion' ? 'Invitación' : doc.productId ? `Producto ${doc.productId}` : doc.linkId || !doc.tipo ? 'Enlace anterior' : 'Tienda',
    quien: doc.status === 'sent' ? '' : (doc.visitanteNombre || 'Visitante sin cuenta'),
    pedido: doc.orderId || '',
    venta: Number(doc.orderTotal) || 0,
    monedas: conPedido ? (reclamado ? Number(doc.earnedCoins) || 0 : estimar(doc.orderTotal, doc)) : null,
    estimado: conPedido && !reclamado,
    estado: ESTADOS_REFERIDO[doc.status] ? doc.status : 'sent',
  };
}

/** Las cifras de arriba: enlaces, cuántos compraron, monedas ya pagadas y por pagar (estimadas). */
export function resumenReferidos(referidos = []) {
  const l = lista(referidos);
  return {
    enlaces: l.length,
    entraron: l.filter((r) => r.estado !== 'sent').length,
    compraron: l.filter((r) => r.pedido).length,
    pagadas: l.filter((r) => r.estado === 'claimed').reduce((a, r) => a + (r.monedas || 0), 0),
    porPagar: l.filter((r) => r.estimado && r.estado !== 'ineligible').reduce((a, r) => a + (r.monedas || 0), 0),
  };
}

/*
 * Misiones diarias (D5a): `missions` con su verificación (actionKey de
 * constants/missionActions; sin ella, el cliente la marca él mismo).
 */
export function misionDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.title || '',
    descripcion: doc.description || '',
    monedas: Number(doc.rewardPoints) || 0,
    orden: Number(doc.order) || 0,
    activa: doc.active !== false,
    verificacion: doc.actionKey || '',
  };
}

/** Lo que se guarda (como antes: textos recortados y números). */
export function misionAFirestore(m = {}) {
  return {
    title: String(m.nombre || '').trim(),
    description: String(m.descripcion || '').trim(),
    rewardPoints: Number(m.monedas) || 0,
    order: Number(m.orden) || 0,
    active: m.activa !== false,
    actionKey: m.verificacion || '',
  };
}

/*
 * Retos semanales (D5a): el catálogo `weeklyChallenges`, el reto activo
 * (`globals/activeChallenge`, siete días) y las evidencias pendientes.
 */
export const RECOMPENSAS_RETO = [
  { valor: 'main', texto: 'Monedas' },
  { valor: 'kapi_double_3d', texto: 'Doble monedas al alimentar a Kapi (3 días)' },
];

export const recompensaDeReto = (r = {}) => (r.tipo === 'kapi_double_3d' || r.rewardType === 'kapi_double_3d'
  ? 'Doble monedas al alimentar a Kapi (3 días)'
  : `${enteroPE(r.monedas ?? r.rewardCoins)} monedas`);

export function retoDesdeFirestore(doc = {}) {
  return {
    id: doc.id,
    nombre: doc.title || '',
    descripcion: doc.description || '',
    accion: doc.actionType || '',
    meta: Number(doc.goal) || 1,
    monedas: Number(doc.rewardCoins) || 0,
    tipo: doc.rewardType === 'kapi_double_3d' ? 'kapi_double_3d' : 'main',
  };
}

export function retoAFirestore(r = {}) {
  return {
    title: String(r.nombre || '').trim(),
    description: String(r.descripcion || '').trim(),
    actionType: String(r.accion || '').trim(),
    goal: Math.max(1, Number(r.meta) || 1),
    rewardCoins: r.tipo === 'kapi_double_3d' ? 0 : Number(r.monedas) || 0,
    rewardType: r.tipo === 'kapi_double_3d' ? 'kapi_double_3d' : 'main',
  };
}

/** El documento de `globals/activeChallenge` para activar un reto desde ahora por siete días (como antes). */
export function retoActivoDesde(r = {}, ahora = new Date()) {
  const g = retoAFirestore(r);
  return {
    challengeId: r.id, title: g.title, description: g.description, actionType: g.actionType, goal: g.goal,
    rewardCoins: g.rewardCoins, rewardType: g.rewardType,
    startedAt: ahora.toISOString(), expiresAt: new Date(ahora.getTime() + 7 * DIA_MS).toISOString(),
  };
}

/** Una evidencia pendiente con la recompensa de su reto (la del catálogo o la del activo). */
export function evidenciaDesde(doc = {}, retos = [], activo = null) {
  const ref = lista(retos).find((r) => r.id === doc.challengeId) || (activo ? retoDesdeFirestore({ ...activo, id: activo.challengeId }) : null);
  return {
    id: doc.id,
    quien: doc.userName || 'Cliente',
    uid: doc.userId || '',
    reto: ref?.nombre || doc.challengeId || '',
    tipo: doc.evidenceType === 'image' ? 'imagen' : 'enlace',
    url: doc.evidenceUrl || '',
    enviadaMs: msDeTs(doc.submittedAt),
    monedas: ref ? ref.monedas : 0,
    tipoRecompensa: ref ? ref.tipo : 'main',
  };
}
