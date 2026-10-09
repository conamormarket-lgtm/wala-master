// ──────────────────────────────────────────────────────────────────────────────
// Popups de campaña: lógica pura (sin Firebase ni DOM) para poder probarla con
// `node --test`. Decide QUÉ popup mostrar a QUIÉN y CUÁNDO.
//
// La configuración vive en un único documento `storeConfig/popups`:
//   { popups: [ { id, nombre, activo, objetivo, titulo, texto, ... } ] }
// Se eligió `storeConfig` (lectura pública, escritura admin) porque las reglas
// vivas de Firestore las maneja el ERP: una colección nueva no tendría permisos.
//
// Objetivos:
//   - 'encuesta': solo se muestra a quien no completó la encuesta. El botón lleva
//     a /encuesta-suscripcion (o a /login si no hay sesión). Completar la
//     encuesta después del clic cuenta como conversión.
//   - 'enlace': popup genérico (promo, Live, referidos…). El botón lleva a botonUrl.
// ──────────────────────────────────────────────────────────────────────────────

export const DIA_MS = 24 * 60 * 60 * 1000;

// Rutas donde NUNCA sale un popup: pagar, carrito, admin, login, la propia
// encuesta, el editor de prendas y las páginas de enlaces (link-in-bio).
export const RUTAS_SIN_POPUP = [
  '/admin',
  '/checkout',
  '/carrito',
  '/pago',
  '/login',
  '/registro',
  '/completar-perfil',
  '/encuesta-suscripcion',
  '/editor',
  '/l/',
  '/regalos-con-amor',
];

export const OPCIONES = {
  formato: [
    { value: 'imagen', label: 'Solo imagen (toda la imagen es el botón)' },
    { value: 'tarjeta', label: 'Tarjeta con título, texto y botón' },
  ],
  objetivo: [
    { value: 'encuesta', label: 'Llenar la encuesta' },
    { value: 'registro', label: 'Crear una cuenta' },
    { value: 'enlace', label: 'Ir a un enlace' },
  ],
  audiencia: [
    { value: 'todos', label: 'Todos' },
    { value: 'logueados', label: 'Solo con sesión iniciada' },
    { value: 'anonimos', label: 'Solo sin sesión' },
  ],
  paginas: [
    { value: 'todas', label: 'Todas las páginas' },
    { value: 'inicio', label: 'Solo el inicio' },
    { value: 'productos', label: 'Solo páginas de producto' },
    { value: 'elegidas', label: 'Las páginas que elija' },
  ],
  dispositivo: [
    { value: 'todos', label: 'Celular y computadora' },
    { value: 'movil', label: 'Solo celular' },
    { value: 'escritorio', label: 'Solo computadora' },
  ],
  disparador: [
    { value: 'tiempo', label: 'A los X segundos' },
    { value: 'scroll', label: 'Al bajar X% de la página' },
    { value: 'salida', label: 'Al intentar salir (solo computadora)' },
  ],
};

export const POPUP_VACIO = {
  id: '',
  nombre: '',
  activo: false,
  formato: 'tarjeta',
  objetivo: 'enlace',
  titulo: '',
  texto: '',
  imagenUrl: '',
  botonTexto: 'Ver más',
  botonUrl: '/',
  cerrarTexto: 'Ahora no',
  audiencia: 'todos',
  paginas: 'todas',
  // Con paginas = 'elegidas': rutas donde sale ("/", "/tienda", "/producto/*").
  rutas: [],
  dispositivo: 'todos',
  disparador: 'tiempo',
  segundos: 10,
  scrollPct: 40,
  cooldownDias: 3,
  desde: '',
  hasta: '',
  prioridad: 0,
};

// Popup que existe aunque nadie haya guardado nada todavía en el admin.
export const POPUP_ENCUESTA_DEFAULT = {
  ...POPUP_VACIO,
  id: 'encuesta',
  nombre: 'Llenar encuesta (perfil de regalos)',
  activo: true,
  formato: 'imagen',
  imagenUrl: '/images/popups/encuesta-conocerte-mejor.webp',
  objetivo: 'encuesta',
  // En formato imagen, el título es el texto alternativo de la imagen.
  titulo: '¡Queremos conocerte mejor! Haz clic para completar la encuesta',
  texto: 'Cuéntanos a quién le regalas y te avisamos antes de sus fechas especiales con ideas que le van a encantar. Además ganas monedas Walá. Toma 2 minutos.',
  botonTexto: 'Llenar encuesta',
  botonUrl: '/encuesta-suscripcion',
  cerrarTexto: 'Ahora no',
  segundos: 0,
  cooldownDias: 3,
  prioridad: 10,
};

export const POPUPS_DEFAULT = [POPUP_ENCUESTA_DEFAULT];

const num = (v, def, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};

const enOpciones = (campo, v) =>
  OPCIONES[campo].some((o) => o.value === v) ? v : POPUP_VACIO[campo];

// Normaliza lo que venga de Firestore: campos faltantes, tipos raros o valores
// fuera de rango nunca rompen la tienda.
export function normalizarPopup(raw = {}) {
  const p = { ...POPUP_VACIO, ...(raw || {}) };
  return {
    ...p,
    id: String(p.id || '').trim(),
    nombre: String(p.nombre || ''),
    activo: p.activo === true,
    // Sin imagen, el formato imagen no tiene nada que mostrar: cae a tarjeta.
    formato: enOpciones('formato', p.formato) === 'imagen' && String(p.imagenUrl || '').trim() ? 'imagen' : 'tarjeta',
    objetivo: enOpciones('objetivo', p.objetivo),
    titulo: String(p.titulo || ''),
    texto: String(p.texto || ''),
    imagenUrl: String(p.imagenUrl || ''),
    botonTexto: String(p.botonTexto || ''),
    botonUrl: String(p.botonUrl || ''),
    cerrarTexto: String(p.cerrarTexto || ''),
    audiencia: enOpciones('audiencia', p.audiencia),
    paginas: enOpciones('paginas', p.paginas),
    rutas: normalizarRutas(p.rutas),
    dispositivo: enOpciones('dispositivo', p.dispositivo),
    disparador: enOpciones('disparador', p.disparador),
    segundos: num(p.segundos, 10, 0, 600),
    scrollPct: num(p.scrollPct, 40, 5, 100),
    cooldownDias: num(p.cooldownDias, 3, 0, 365),
    desde: /^\d{4}-\d{2}-\d{2}$/.test(p.desde) ? p.desde : '',
    hasta: /^\d{4}-\d{2}-\d{2}$/.test(p.hasta) ? p.hasta : '',
    prioridad: num(p.prioridad, 0, -1000, 1000),
  };
}

// Documento de Firestore → lista de popups. Sin documento, el default.
export function popupsDesdeDoc(data) {
  if (!data || !Array.isArray(data.popups)) return POPUPS_DEFAULT.map(normalizarPopup);
  return data.popups.map(normalizarPopup).filter((p) => p.id);
}

// Fecha local YYYY-MM-DD (la tienda opera en Lima; el navegador del cliente
// casi siempre está en la misma zona).
export function diaLocal(ms) {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function rutaBloqueada(pathname = '/') {
  return RUTAS_SIN_POPUP.some((r) => (r.endsWith('/')
    ? pathname.startsWith(r)
    : pathname === r || pathname.startsWith(`${r}/`)));
}

// Páginas para elegir rápido en el admin. "*" al final = esa página y todo lo
// que cuelga de ella ("/producto/*" = cualquier producto).
export const PAGINAS_SUGERIDAS = [
  { ruta: '/', label: 'Inicio' },
  { ruta: '/tienda', label: 'Tienda (todas las categorías)' },
  { ruta: '/ofertas', label: 'Ofertas' },
  { ruta: '/producto/*', label: 'Cualquier producto' },
  { ruta: '/buscar', label: 'Búsqueda' },
  { ruta: '/personalizar', label: 'Personalizar' },
  { ruta: '/cuenta/*', label: 'Mi cuenta' },
  { ruta: '/minijuegos', label: 'Minijuegos' },
  { ruta: '/sorteos/*', label: 'Sorteos' },
];

// "tienda/" → "/tienda"; "https://www.wala.pe/ofertas?x=1" → "/ofertas".
export function normalizarRuta(ruta) {
  let r = String(ruta || '').trim();
  if (!r) return '';
  r = r.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0].trim();
  if (!r.startsWith('/')) r = `/${r}`;
  if (r.length > 1) r = r.replace(/\/+$/, '');
  return r === '/*' ? '/*' : r;
}

export function normalizarRutas(rutas) {
  return [...new Set((Array.isArray(rutas) ? rutas : []).map(normalizarRuta).filter(Boolean))].slice(0, 30);
}

// ¿La página actual es una de las elegidas?
export function rutaCoincide(rutas, pathname) {
  const actual = normalizarRuta(pathname) || '/';
  return normalizarRutas(rutas).some((r) => {
    if (r.endsWith('/*')) {
      const base = r.slice(0, -2);
      return base === '' || actual === base || actual.startsWith(`${base}/`);
    }
    return actual === r;
  });
}

function coincidePagina(p, pathname) {
  if (p.paginas === 'inicio') return pathname === '/';
  if (p.paginas === 'productos') return pathname.startsWith('/producto/');
  if (p.paginas === 'elegidas') return rutaCoincide(p.rutas, pathname);
  return true;
}

/**
 * ¿Este popup se le puede mostrar a esta persona ahora?
 * ctx = {
 *   pathname, ahora (ms), esMovil (bool),
 *   logueado (bool), perfil (userProfile | null; con sesión debe estar cargado),
 *   estadoLocal: { [popupId]: { ocultoHasta } },
 * }
 * Devuelve { ok: true } o { ok: false, motivo } (el motivo ayuda al admin).
 */
export function evaluarPopup(popup, ctx) {
  const p = normalizarPopup(popup);
  const { pathname = '/', ahora = Date.now(), esMovil = false, logueado = false, perfil = null, estadoLocal = {} } = ctx || {};

  if (!p.activo) return { ok: false, motivo: 'inactivo' };
  const hoy = diaLocal(ahora);
  if (p.desde && hoy < p.desde) return { ok: false, motivo: 'aún no empieza' };
  if (p.hasta && hoy > p.hasta) return { ok: false, motivo: 'ya terminó' };

  if (rutaBloqueada(pathname)) return { ok: false, motivo: 'ruta bloqueada' };
  if (!coincidePagina(p, pathname)) return { ok: false, motivo: 'otra página' };

  if (p.dispositivo === 'movil' && !esMovil) return { ok: false, motivo: 'solo celular' };
  if (p.dispositivo === 'escritorio' && esMovil) return { ok: false, motivo: 'solo computadora' };

  if (p.audiencia === 'logueados' && !logueado) return { ok: false, motivo: 'requiere sesión' };
  if (p.audiencia === 'anonimos' && logueado) return { ok: false, motivo: 'solo sin sesión' };

  // Invitar a crear cuenta a quien ya la tiene no tiene sentido.
  if (p.objetivo === 'registro' && logueado) return { ok: false, motivo: 'ya tiene cuenta' };

  if (p.objetivo === 'encuesta' && logueado) {
    // Con sesión hay que esperar al perfil: sin él no sabemos si ya la llenó.
    // _perfilNoCargado: la lectura falló y se reintenta (AuthContext): todavía no se sabe.
    if (!perfil || perfil._perfilNoCargado) return { ok: false, motivo: 'perfil cargando' };
    if (perfil.hasCompletedSurvey) return { ok: false, motivo: 'ya llenó la encuesta' };
    // Si la saltó ("No, gracias") hace poco, respetamos el mismo enfriamiento.
    const salto = Number(perfil.lastSurveyPromptedAt) || 0;
    if (salto && ahora - salto < p.cooldownDias * DIA_MS) return { ok: false, motivo: 'saltó la encuesta hace poco' };
  }

  const oculto = Number(estadoLocal?.[p.id]?.ocultoHasta) || 0;
  if (oculto > ahora) return { ok: false, motivo: 'en enfriamiento' };

  return { ok: true };
}

// El popup de mayor prioridad que aplica, o null.
export function elegirPopup(popups, ctx) {
  const candidatos = (popups || [])
    .map(normalizarPopup)
    .filter((p) => p.id && evaluarPopup(p, ctx).ok)
    .sort((a, b) => b.prioridad - a.prioridad);
  return candidatos[0] || null;
}

// Tras mostrarse, el popup queda oculto `cooldownDias` (aunque la persona lo
// ignore y navegue), para no perseguirla en cada página.
export function marcarMostrado(estadoLocal, popup, ahora = Date.now()) {
  const p = normalizarPopup(popup);
  return {
    ...(estadoLocal || {}),
    [p.id]: { ...(estadoLocal?.[p.id] || {}), vistoEn: ahora, ocultoHasta: ahora + p.cooldownDias * DIA_MS },
  };
}

// Ventana para atribuir una conversión a un clic en un popup.
export const VENTANA_CONVERSION_MS = 7 * DIA_MS;

// Si hubo un clic reciente en un popup con este objetivo, devuelve su id.
export function conversionPendiente(ultimoClic, objetivo, ahora = Date.now()) {
  if (!ultimoClic || ultimoClic.objetivo !== objetivo || !ultimoClic.popupId) return null;
  if (ahora - (Number(ultimoClic.en) || 0) > VENTANA_CONVERSION_MS) return null;
  return ultimoClic.popupId;
}

// Id corto y legible a partir del nombre (para popups nuevos del admin).
export function idDesdeNombre(nombre, existentes = []) {
  const base = String(nombre || 'popup')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'popup';
  let id = base;
  let i = 2;
  while (existentes.includes(id)) id = `${base}-${i++}`;
  return id;
}
