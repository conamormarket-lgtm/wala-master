import { createDocument } from '../firebase/firestore';
import { ANALYTICS_COLLECTIONS } from './schema';
import { getAnonymousId, ensureAnalyticsSession, getClientType } from './tracker';

/*
 * Enlaces rotos: alguien pidió una dirección que no existe (la página "No
 * encontramos esta página", GENERALES.md P22). Así se ven los de un anuncio,
 * un QR o una landing borrada. Va aparte de tracker.js para no pesar en el
 * archivo principal: solo lo usa esa página.
 */
export const PAGE_NOT_FOUND = 'page_not_found';

/**
 * Registra la dirección pedida (path y eventData.ruta) y de dónde venía
 * (eventData.desde: document.referrer; vacío si se escribió a mano o viene de
 * una app).
 */
export async function trackPageNotFound(ruta, desde = '', userCtx = {}) {
  if (!ruta) return;
  const sessionId = await ensureAnalyticsSession(userCtx, ruta);
  await createDocument(ANALYTICS_COLLECTIONS.EVENTS, {
    type: PAGE_NOT_FOUND,
    path: ruta,
    uid: userCtx?.uid || null,
    email: userCtx?.email || null,
    displayName: userCtx?.displayName || null,
    anonymousId: getAnonymousId(),
    sessionId: sessionId || null,
    clientTsMs: Date.now(),
    clientType: getClientType(),
    eventData: { ruta, desde: desde || null },
  });
}
