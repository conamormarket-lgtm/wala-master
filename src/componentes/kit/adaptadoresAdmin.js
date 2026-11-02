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

/** El estado del stock (Inventario): 0 agotado, hasta 3 últimas, más disponible. */
export const estadoDeStock = (n) => (n <= 0 ? 'agotado' : n <= 3 ? 'ultimas' : 'disponible');

/** Busca sin tildes ni mayúsculas. */
export function normalizarBusqueda(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
