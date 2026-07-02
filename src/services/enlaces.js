// ── Enlaces útiles (constructor tipo LINKTREE / link-in-bio) ─────────────────
// Colección Firestore: 'link_pages'. Cada doc es una PÁGINA pública de botones
// que se sirve en /l/{slug}. Molde: flashOffers.js (CRUD sobre firestore.js).
//
// REGLAS DURAS del dueño:
//  - Contadores en la NUBE (denormalizados con FieldValue.increment), NUNCA
//    localStorage. Las visitas viven en link_pages/{id}.visitas y los clics por
//    botón en la subcolección link_pages/{id}/clics/{botonId}.count.
//  - Pocas lecturas/escrituras: la página pública lee 1 doc (getLinkPageBySlug,
//    query de UN solo campo 'slug'); el admin lee la subcolección clics 1 vez.
//  - La escritura de contadores la hace SOLO la Cloud Function registrarClicEnlace
//    (admin SDK); el cliente jamás escribe la subcolección clics.
//
// Lectura pública de link_pages; la escritura la restringen las reglas al admin.
import {
  getCollection,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from './firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase/config';
import { collection, getDocs, query, where, limit, documentId } from 'firebase/firestore';
import { ANALYTICS_COLLECTIONS, ANALYTICS_EVENT_TYPES, formatDayKey } from './analytics/schema';

const COLLECTION = 'link_pages';

// ── CRUD admin ───────────────────────────────────────────────────────────────

// Todas las páginas de enlaces (uso admin), ordenadas por updatedAt desc.
// Si no hubiera índice para updatedAt, se ordena en cliente (pocas páginas).
export const getLinkPages = async () => {
  const res = await getCollection(COLLECTION, [], { field: 'updatedAt', direction: 'desc' });
  if (res.error) {
    // Fallback: sin orderBy (evita depender de índice) y se ordena en cliente.
    const plano = await getCollection(COLLECTION, []);
    if (plano.data) {
      plano.data.sort((a, b) => (toMs(b.updatedAt) - toMs(a.updatedAt)));
    }
    return plano;
  }
  return res;
};

export const getLinkPage = async (id) => await getDocument(COLLECTION, id);

// Lectura PÚBLICA por slug (1 query de un solo campo). Devuelve el primer match.
// Si el índice/orden fallara, ya es filtro simple: Firestore no exige índice
// compuesto para un where de igualdad sobre un campo. Se ordenan botones/redes
// en cliente por 'order' (barato, arrays pequeños).
export const getLinkPageBySlug = async (slug) => {
  const limpio = (slug || '').trim();
  if (!limpio) return { data: null, error: 'slug vacío' };
  const res = await getCollection(
    COLLECTION,
    [{ field: 'slug', operator: '==', value: limpio }],
    null,
    1
  );
  if (res.error) return { data: null, error: res.error };
  const doc = (res.data && res.data[0]) || null;
  if (!doc) return { data: null, error: 'Página no encontrada' };
  // Orden en cliente de botones y redes (el modelo guarda 'order' por item).
  if (Array.isArray(doc.botones)) {
    doc.botones = [...doc.botones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  if (Array.isArray(doc.redes)) {
    doc.redes = [...doc.redes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return { data: doc, error: null };
};

// Diseño por defecto: valores seguros para que una página nueva ya se vea bien.
const disenoPorDefecto = () => ({
  buttonStyle: 'solid',        // "solid" | "glass" | "outline"
  cornerRoundness: 12,         // px (redondez de esquinas del botón)
  buttonShadow: 'soft',        // "none" | "soft" | "strong" | "hard"
  buttonColor: '#111827',
  buttonTextColor: '#ffffff',
  titleColor: '#111827',       // color del TÍTULO (independiente del botón)
  textColor: '#374151',        // color del TEXTO normal (descripción/redes/footer)
  textAlign: 'center',         // alineación: "left" | "center" | "right" | "justify"
  // background.type: "color" | "gradient" | "pattern" | "image".
  // Para "pattern", `color` es el color base sobre el que se dibuja la textura.
  background: { type: 'color', value: '#f3f4f6', color: '#4B0055' },
  fontFamily: '',
});

// Normaliza el arreglo de botones al contrato { id, titulo, url, thumbnailUrl, order }.
const normalizarBotones = (botones) => {
  if (!Array.isArray(botones)) return [];
  return botones.map((b, i) => ({
    id: b.id || `btn_${Date.now()}_${i}`,
    titulo: b.titulo || '',
    url: (b.url || '').trim(),
    thumbnailUrl: b.thumbnailUrl || '',
    order: typeof b.order === 'number' ? b.order : i,
  }));
};

// Normaliza el arreglo de redes al contrato
// { id, tipo, nombre, url, iconUrl?, order }.
const normalizarRedes = (redes) => {
  if (!Array.isArray(redes)) return [];
  return redes.map((r, i) => ({
    id: r.id || `red_${Date.now()}_${i}`,
    tipo: r.tipo || 'custom', // "instagram"|"facebook"|"tiktok"|"whatsapp"|"custom"
    nombre: r.nombre || '',
    url: (r.url || '').trim(),
    iconUrl: r.iconUrl || '',
    order: typeof r.order === 'number' ? r.order : i,
  }));
};

// Normaliza el objeto diseño mezclando con los valores por defecto.
const normalizarDiseno = (diseno) => {
  const d = diseno || {};
  const base = disenoPorDefecto();
  return {
    buttonStyle: d.buttonStyle || base.buttonStyle,
    cornerRoundness: typeof d.cornerRoundness === 'number' ? d.cornerRoundness : base.cornerRoundness,
    buttonShadow: d.buttonShadow || base.buttonShadow,
    buttonColor: d.buttonColor || base.buttonColor,
    buttonTextColor: d.buttonTextColor || base.buttonTextColor,
    // Título y texto: si la página es VIEJA (sin estos campos) caen al color del
    // texto del botón (comportamiento previo), así no cambia su apariencia.
    titleColor: d.titleColor || d.buttonTextColor || base.titleColor,
    textColor: d.textColor || d.buttonTextColor || base.textColor,
    textAlign: ['left', 'center', 'right', 'justify'].includes(d.textAlign) ? d.textAlign : base.textAlign,
    background: d.background && d.background.type
      ? {
          type: d.background.type,
          value: d.background.value ?? '',
          color: d.background.color || base.background.color,
        }
      : base.background,
    fontFamily: d.fontFamily || base.fontFamily,
  };
};

export const createLinkPage = async (data) => {
  return await createDocument(COLLECTION, {
    slug: (data.slug || '').trim(),
    titulo: data.titulo || '',
    descripcion: data.descripcion || '',
    avatarUrl: data.avatarUrl || '',
    estado: data.estado === 'borrador' ? 'borrador' : 'activo', // "activo" | "borrador"
    diseno: normalizarDiseno(data.diseno),
    botones: normalizarBotones(data.botones),
    redes: normalizarRedes(data.redes),
    visitas: 0, // contador denormalizado (lo incrementa la CF de vista si se usa)
  });
};

export const updateLinkPage = async (id, data) => {
  const payload = {};
  if (data.slug !== undefined) payload.slug = (data.slug || '').trim();
  ['titulo', 'descripcion', 'avatarUrl', 'estado'].forEach((k) => {
    if (data[k] !== undefined) payload[k] = data[k];
  });
  if (data.diseno !== undefined) payload.diseno = normalizarDiseno(data.diseno);
  if (data.botones !== undefined) payload.botones = normalizarBotones(data.botones);
  if (data.redes !== undefined) payload.redes = normalizarRedes(data.redes);
  // OJO: 'visitas' y la subcolección 'clics' NO se tocan aquí (los maneja la CF).
  return await updateDocument(COLLECTION, id, payload);
};

export const deleteLinkPage = async (id) => await deleteDocument(COLLECTION, id);

// ── Analítica de clics por botón (lectura admin) ─────────────────────────────
// Lee la subcolección link_pages/{pageId}/clics (1 lectura por página en admin).
// Devuelve { data: { [botonId]: count }, error }. Pocas lecturas: son 1 doc por
// botón y solo se consulta desde el editor/dashboard admin, nunca en público.
export const getClicsDeLinkPage = async (pageId) => {
  if (!pageId) return { data: {}, error: 'pageId vacío' };
  if (!db) return { data: {}, error: 'Firestore no disponible' };
  try {
    const snap = await getDocs(collection(db, COLLECTION, pageId, 'clics'));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = (d.data() && typeof d.data().count === 'number') ? d.data().count : 0;
    });
    return { data: map, error: null };
  } catch (e) {
    return { data: {}, error: e.message };
  }
};

// ── Registro de clic (wrapper de la Cloud Function callable) ─────────────────
// Incrementa el contador del botón en la nube y registra el evento link_click
// (la CF registrarClicEnlace es el ÚNICO escritor de ese evento: así NO hay doble
// conteo). El contexto de sesión (sessionId/uid/clientType/país/device) lo aporta
// el llamador (la página pública lo deriva de la sesión de analítica).
// Fire-and-forget en la UI: nunca debe bloquear la apertura del enlace.
export const registrarClic = async (pageId, botonId, extra = {}) => {
  if (!pageId || !botonId) return { data: null, error: 'faltan pageId/botonId' };
  try {
    const callable = httpsCallable(getFunctions(), 'registrarClicEnlace');
    const res = await callable({ pageId, botonId, ...extra });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'Error en el servidor' };
  }
};

// ── Registro de visita (wrapper de la Cloud Function callable) ───────────────
// Incrementa el contador denormalizado link_pages/{id}.visitas en la nube y
// registra el evento link_page_view (único escritor: la CF). Fire-and-forget en
// la UI: se dispara al montar /l/{slug} y jamás bloquea el render.
export const registrarVisita = async (pageId, slug, extra = {}) => {
  if (!pageId) return { data: null, error: 'falta pageId' };
  try {
    const callable = httpsCallable(getFunctions(), 'registrarVisitaEnlace');
    const res = await callable({ pageId, slug: slug || '', ...extra });
    return { data: res.data, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'Error en el servidor' };
  }
};

// ── Analítica "de dónde": desglose por país / dispositivo / día (lectura admin) ─
// Lee los eventos link_page_view/link_click de UNA página (query de un solo campo
// pageId → índice automático, sin índice compuesto) y los agrega en cliente. Para
// los eventos a los que les falte país/dispositivo (visitante nuevo cuyo país aún
// no estaba en caché al emitir el evento), se UNE con la sesión de analítica por
// sessionId (mismo mecanismo que el dashboard). Lecturas acotadas: como mucho
// EVENT_CAP eventos + las sesiones únicas que falten (en lotes de 10). Solo se
// consulta desde el editor admin, nunca en público.
const EVENT_CAP = 2000;

export const getAnaliticaEnlace = async (pageId) => {
  const vacio = { totalVisitas: 0, totalClics: 0, porPais: [], porDispositivo: [], porDia: [] };
  if (!pageId) return { data: vacio, error: 'pageId vacío' };
  if (!db) return { data: vacio, error: 'Firestore no disponible' };
  try {
    // 1) Todos los eventos de esta página (filtro simple pageId==, con tope).
    const qEv = query(
      collection(db, ANALYTICS_COLLECTIONS.EVENTS),
      where('pageId', '==', pageId),
      limit(EVENT_CAP)
    );
    const snap = await getDocs(qEv);
    const eventos = [];
    snap.forEach((d) => eventos.push(d.data() || {}));

    // 2) Sesiones a resolver: las de eventos SIN país/dispositivo propio.
    const sesionesFaltantes = new Set();
    eventos.forEach((ev) => {
      if ((!ev.countryCode || !ev.device) && ev.sessionId) sesionesFaltantes.add(ev.sessionId);
    });
    const sesionInfo = {}; // sessionId -> { countryCode, device }
    const ids = [...sesionesFaltantes];
    for (let i = 0; i < ids.length; i += 10) {
      const lote = ids.slice(i, i + 10);
      // eslint-disable-next-line no-await-in-loop
      const sSnap = await getDocs(query(
        collection(db, ANALYTICS_COLLECTIONS.SESSIONS),
        where(documentId(), 'in', lote)
      ));
      sSnap.forEach((s) => {
        const sd = s.data() || {};
        sesionInfo[s.id] = { countryCode: sd.countryCode || null, device: sd.device || null };
      });
    }

    // 3) Agregación por país / dispositivo / día, contando visitas y clics.
    const paisMap = {};   // key -> { visitas, clics }
    const devMap = {};
    const diaMap = {};
    const bump = (mapa, key, esClic) => {
      const k = key || 'Desconocido';
      if (!mapa[k]) mapa[k] = { visitas: 0, clics: 0 };
      if (esClic) mapa[k].clics += 1; else mapa[k].visitas += 1;
    };

    let totalVisitas = 0;
    let totalClics = 0;
    eventos.forEach((ev) => {
      const esClic = ev.type === ANALYTICS_EVENT_TYPES.LINK_CLICK;
      const esVista = ev.type === ANALYTICS_EVENT_TYPES.LINK_PAGE_VIEW;
      if (!esClic && !esVista) return;
      if (esClic) totalClics += 1; else totalVisitas += 1;

      const info = ev.sessionId ? sesionInfo[ev.sessionId] : null;
      const pais = ev.countryCode || info?.countryCode || null;
      const device = ev.device || info?.device || null;
      const dia = formatDayKey(ev.clientTsMs) || 'Sin fecha';

      bump(paisMap, pais, esClic);
      bump(devMap, device, esClic);
      bump(diaMap, dia, esClic);
    });

    const aOrden = (mapa) =>
      Object.entries(mapa)
        .map(([key, v]) => ({ key, visitas: v.visitas, clics: v.clics }))
        .sort((a, b) => (b.visitas + b.clics) - (a.visitas + a.clics));

    const porDia = Object.entries(diaMap)
      .map(([dia, v]) => ({ dia, visitas: v.visitas, clics: v.clics }))
      .sort((a, b) => (a.dia < b.dia ? 1 : -1)); // más reciente primero

    return {
      data: { totalVisitas, totalClics, porPais: aOrden(paisMap), porDispositivo: aOrden(devMap), porDia },
      error: null,
    };
  } catch (e) {
    return { data: vacio, error: e.message };
  }
};

// Helper local: milisegundos de un timestamp de Firestore/serverTimestamp o Date.
function toMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
}
