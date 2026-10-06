// Popups de campaña: lectura/escritura en Firestore, estado local del navegador
// y métricas. La lógica de "a quién y cuándo" está en ./popupsLogic.mjs.
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from './firebase/config';
import { getDocument, setDocument } from './firebase/firestore';
import { ANALYTICS_COLLECTIONS, ANALYTICS_EVENT_TYPES } from './analytics/schema';
import { trackPopupEvent } from './analytics/tracker';
import { conversionPendiente, marcarMostrado, normalizarPopup, popupsDesdeDoc } from './popupsLogic.mjs';

const COLECCION = 'storeConfig';
const DOC_ID = 'popups';

const CLAVE_ESTADO = 'wala_popups_estado';
const CLAVE_SESION = 'wala_popup_sesion';
const CLAVE_ULTIMO_CLIC = 'wala_popup_ultimo_clic';

export async function getPopups() {
  const { data, error } = await getDocument(COLECCION, DOC_ID);
  if (error && !/no existe|not found|no encontrado/i.test(String(error))) {
    return { data: popupsDesdeDoc(null), error };
  }
  return { data: popupsDesdeDoc(data), error: null };
}

export async function savePopups(popups) {
  const limpios = (popups || []).map(normalizarPopup).filter((p) => p.id);
  return setDocument(COLECCION, DOC_ID, { popups: limpios, actualizadoEn: Date.now() });
}

// ── Estado local (por navegador) ────────────────────────────────────────────
const leerJSON = (storage, clave, def) => {
  try {
    const raw = storage.getItem(clave);
    return raw ? JSON.parse(raw) : def;
  } catch {
    return def;
  }
};
const escribirJSON = (storage, clave, valor) => {
  try {
    storage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* modo privado o storage bloqueado: el popup igual funciona, solo sin memoria */
  }
};

export const leerEstadoLocal = () => leerJSON(window.localStorage, CLAVE_ESTADO, {});

// Máximo un popup por sesión de navegación (pestaña).
export const yaHuboPopupEnSesion = () => Boolean(leerJSON(window.sessionStorage, CLAVE_SESION, null));

export function registrarMostrado(popup) {
  escribirJSON(window.localStorage, CLAVE_ESTADO, marcarMostrado(leerEstadoLocal(), popup, Date.now()));
  escribirJSON(window.sessionStorage, CLAVE_SESION, popup.id);
}

// ── Métricas ────────────────────────────────────────────────────────────────
const enviar = (tipo, popup, userCtx) => {
  // La página se toma YA: el tracker lee la URL después de un await y, tras un
  // clic que navega, registraría la página de destino.
  const pagina = window.location.pathname || '/';
  trackPopupEvent(tipo, popup.id, { objetivo: popup.objetivo, pagina }, userCtx).catch(() => {});
};

export const trackVista = (popup, userCtx) => enviar(ANALYTICS_EVENT_TYPES.POPUP_VIEW, popup, userCtx);
export const trackCierre = (popup, userCtx) => enviar(ANALYTICS_EVENT_TYPES.POPUP_CLOSE, popup, userCtx);

export function trackClic(popup, userCtx) {
  enviar(ANALYTICS_EVENT_TYPES.POPUP_CLICK, popup, userCtx);
  escribirJSON(window.localStorage, CLAVE_ULTIMO_CLIC, { popupId: popup.id, objetivo: popup.objetivo, en: Date.now() });
}

// Llamar cuando la persona cumple un objetivo (p. ej. 'encuesta' al guardar).
// Si llegó por un popup en los últimos días, se registra la conversión.
export function registrarConversionPopup(objetivo, userCtx = {}) {
  try {
    const popupId = conversionPendiente(leerJSON(window.localStorage, CLAVE_ULTIMO_CLIC, null), objetivo, Date.now());
    if (!popupId) return;
    window.localStorage.removeItem(CLAVE_ULTIMO_CLIC);
    trackPopupEvent(ANALYTICS_EVENT_TYPES.POPUP_CONVERSION, popupId, { objetivo }, userCtx).catch(() => {});
  } catch {
    /* nunca debe romper el guardado de la encuesta */
  }
}

// Conteos por popup (solo admin). Igualdad en dos campos: no necesita índice compuesto.
export async function getEstadisticasPopup(popupId) {
  const tipos = {
    vistas: ANALYTICS_EVENT_TYPES.POPUP_VIEW,
    clics: ANALYTICS_EVENT_TYPES.POPUP_CLICK,
    cierres: ANALYTICS_EVENT_TYPES.POPUP_CLOSE,
    conversiones: ANALYTICS_EVENT_TYPES.POPUP_CONVERSION,
  };
  const entradas = await Promise.all(Object.entries(tipos).map(async ([clave, tipo]) => {
    const q = query(
      collection(db, ANALYTICS_COLLECTIONS.EVENTS),
      where('type', '==', tipo),
      where('eventData.popupId', '==', popupId),
    );
    const snap = await getCountFromServer(q);
    return [clave, snap.data().count];
  }));
  return Object.fromEntries(entradas);
}

// Para probar desde el admin: olvida en ESTE navegador qué popups ya se vieron.
export function reiniciarEstadoLocal() {
  try {
    window.localStorage.removeItem(CLAVE_ESTADO);
    window.localStorage.removeItem(CLAVE_ULTIMO_CLIC);
    window.sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* sin storage no hay nada que limpiar */
  }
}
