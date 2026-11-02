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

/** Un producto de `productos_wala` para las listas del admin. Los archivados (deleted) no se listan: null. */
export function productoAdminDesde(p = {}) {
  if (!p || p.deleted === true) return null;
  const precio = Number(p.price) || 0;
  const oferta = Number(p.salePrice) || 0;
  return {
    id: p.id,
    nombre: p.name || 'Sin nombre',
    imagen: p.mainImage || (Array.isArray(p.images) && p.images[0]) || '',
    precio: oferta > 0 && oferta < precio ? oferta : precio,
    oculto: p.visible === false,
    marcaId: p.brandId || '',
    destacado: p.featured === true,
    ordenDestacado: Number(p.featuredOrder) || 0,
  };
}

/** Busca sin tildes ni mayúsculas. */
export function normalizarBusqueda(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
