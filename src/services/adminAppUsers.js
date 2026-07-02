// ============================================================================
// adminAppUsers.js — Capa de lectura para la vista "Usuarios de la App".
// ----------------------------------------------------------------------------
// Objetivo: reunir TODA la actividad capturada de la APP nativa (Capacitor,
// clientType === "APP") agrupada por usuario IDENTIFICADO (uid), para el panel
// AdminUsuariosApp.
//
// REGLA DURA de lecturas (cachés en la nube, POCAS lecturas):
//   - Una sola query a analytics_sessions con UN SOLO where (clientType == 'APP')
//     acotada con limit → NO exige índice compuesto (Firestore solo pide índice
//     cuando combinas varios where/orderBy sobre campos distintos). Aquí usamos
//     un único filtro de igualdad y NINGÚN orderBy, así que no hace falta índice.
//   - El enriquecimiento con portal_clientes_users se hace SOLO para los uids
//     encontrados (getDocument por uid, en paralelo) — como máximo tantas
//     lecturas como usuarios app únicos, no como sesiones.
//
// El detalle por usuario (desglose APP/WEB, rutas, eventos) NO se calcula aquí:
// lo sirve getUserAnalytics(uid, email) de adminAnalytics.js (que ya devuelve
// topRoutesByViews/topRoutesByDwell como { total, app, web }).
// ============================================================================

import { getCollection, getDocument } from './firebase/firestore';
import { ANALYTICS_COLLECTIONS, toMillis } from './analytics/schema';
import { parseUserAgent } from './analytics/ua';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';

// Tope por defecto de sesiones APP a leer. Mantenerlo acotado es clave para la
// cuota (regla POCAS lecturas). Es un techo defensivo: si hubiera más sesiones
// APP que este límite, agregamos sobre las más recientes que devuelva la query.
const DEFAULT_APP_SESSIONS_MAX = 500;

// Clave usada para agrupar TODAS las sesiones sin uid bajo un único cubo
// "Anónimos" (no las mostramos como usuarios identificados, pero sí contamos su
// actividad para el KPI de sesiones anónimas de la app).
const ANON_BUCKET = '__anon__';

/**
 * Elige el valor MÁS FRECUENTE de una lista (ignora vacíos/'Desconocido').
 * Se usa para el device/os "más usado" por usuario. Empates: el primero visto.
 */
function moda(valores = []) {
  const conteo = new Map();
  valores.forEach((v) => {
    if (!v || v === 'Desconocido') return;
    conteo.set(v, (conteo.get(v) || 0) + 1);
  });
  let mejor = null;
  let mejorN = 0;
  conteo.forEach((n, v) => {
    if (n > mejorN) {
      mejorN = n;
      mejor = v;
    }
  });
  return mejor;
}

/**
 * Deriva device/os de una sesión, tolerando el doble origen del dato:
 *   - sesiones nuevas: tracker.js ya guarda device/os/browser (parseo compartido);
 *   - sesiones viejas: solo tienen userAgent → parseamos con parseUserAgent.
 * platform (Capacitor) manda sobre el os derivado del UA cuando existe.
 */
function derivarDispositivo(sesion) {
  const parsed = parseUserAgent(sesion?.userAgent);
  return {
    device: sesion?.device || parsed.device || 'Desconocido',
    os: sesion?.platform || sesion?.os || parsed.os || 'Desconocido',
    browser: sesion?.browser || parsed.browser || 'Desconocido',
  };
}

/**
 * getAppUsers({ max }) — lista de usuarios que han usado la APP nativa.
 *
 * Flujo:
 *   1) Lee analytics_sessions donde clientType == 'APP' (un solo where, con limit).
 *   2) Agrupa por uid (las sesiones sin uid se cuentan aparte como "Anónimos").
 *   3) Por usuario calcula: nº de sesiones APP, última actividad (max
 *      lastSeenAtClientMs), device/os más usado, país (countryCode).
 *   4) Enriquece con portal_clientes_users por uid (getDocument en paralelo)
 *      para nombre/correo/teléfono; si no hay doc, cae a displayName/email de la
 *      sesión.
 *   5) Devuelve la lista ORDENADA por última actividad (desc) + KPIs agregados.
 *
 * @param {{ max?: number }} [opts]
 * @returns {Promise<{ data: {
 *   users: Array<{
 *     uid: string, displayName: string|null, email: string|null,
 *     phone: string|null, appSessions: number, lastActivityMs: number,
 *     device: string|null, os: string|null, browser: string|null,
 *     countryCode: string|null, enriched: boolean,
 *   }>,
 *   kpis: { appUsersUnique: number, appSessions: number,
 *           anonAppSessions: number, lastActivityMs: number },
 * }, error: string|null }>}
 */
export async function getAppUsers({ max = DEFAULT_APP_SESSIONS_MAX } = {}) {
  // (1) Query barata: UN SOLO where de igualdad, sin orderBy, con limit.
  //     Filtrar por clientType en un único campo NO exige índice compuesto.
  const { data: sessions, error } = await getCollection(
    ANALYTICS_COLLECTIONS.SESSIONS,
    [{ field: 'clientType', operator: '==', value: 'APP' }],
    null,
    max
  );

  if (error) {
    return { data: { users: [], kpis: emptyKpis() }, error };
  }

  const lista = Array.isArray(sessions) ? sessions : [];

  // (2)+(3) Agrupación por uid con acumuladores por usuario.
  const porUid = new Map(); // uid -> acumulador
  let anonAppSessions = 0; // sesiones APP sin uid (no son "usuarios identificados")

  lista.forEach((s) => {
    const uid = s?.uid || null;
    const seenAt = toMillis(s?.lastSeenAtClientMs || s?.updatedAt || s?.createdAt);

    if (!uid) {
      anonAppSessions += 1;
      return; // Anónimos: no entran en la lista de usuarios identificados.
    }

    if (!porUid.has(uid)) {
      porUid.set(uid, {
        uid,
        appSessions: 0,
        lastActivityMs: 0,
        // Nombre/correo de respaldo desde la propia sesión (si el usuario no
        // tiene doc en portal_clientes_users).
        sessionDisplayName: null,
        sessionEmail: null,
        devices: [],
        oses: [],
        browsers: [],
        countryCode: null,
        lastSeenForCountry: 0,
      });
    }
    const acc = porUid.get(uid);
    acc.appSessions += 1;
    if (seenAt > acc.lastActivityMs) acc.lastActivityMs = seenAt;
    if (!acc.sessionDisplayName && s?.displayName) acc.sessionDisplayName = s.displayName;
    if (!acc.sessionEmail && s?.email) acc.sessionEmail = s.email;

    const { device, os, browser } = derivarDispositivo(s);
    acc.devices.push(device);
    acc.oses.push(os);
    acc.browsers.push(browser);

    // País: nos quedamos con el de la sesión MÁS reciente que traiga countryCode.
    if (s?.countryCode && seenAt >= acc.lastSeenForCountry) {
      acc.countryCode = s.countryCode;
      acc.lastSeenForCountry = seenAt;
    }
  });

  const uids = [...porUid.keys()];

  // (4) Enriquecimiento por uid (en paralelo). Como máximo una lectura por
  //     usuario app único — NO por sesión. Tolerante a docs inexistentes.
  const perfiles = await Promise.all(
    uids.map(async (uid) => {
      const { data } = await getDocument(PORTAL_USERS_COLLECTION, uid);
      return { uid, perfil: data || null };
    })
  );
  const perfilPorUid = new Map(perfiles.map((p) => [p.uid, p.perfil]));

  // (5) Construcción de la lista final ordenada por última actividad (desc).
  const users = uids.map((uid) => {
    const acc = porUid.get(uid);
    const perfil = perfilPorUid.get(uid);
    const enriched = Boolean(perfil);

    const displayName =
      (perfil?.displayName || perfil?.nombre) ||
      acc.sessionDisplayName ||
      null;
    const email = perfil?.email || acc.sessionEmail || null;
    const phone = perfil?.phone || perfil?.telefono || null;

    return {
      uid,
      displayName,
      email,
      phone,
      appSessions: acc.appSessions,
      lastActivityMs: acc.lastActivityMs,
      device: moda(acc.devices) || acc.devices[0] || null,
      os: moda(acc.oses) || acc.oses[0] || null,
      browser: moda(acc.browsers) || acc.browsers[0] || null,
      countryCode: acc.countryCode || null,
      enriched,
    };
  }).sort((a, b) => b.lastActivityMs - a.lastActivityMs);

  // KPIs agregados de la app (para la cabecera del panel).
  const appSessions = lista.length;
  const lastActivityMs = users.reduce(
    (m, u) => Math.max(m, u.lastActivityMs),
    0
  );

  return {
    data: {
      users,
      kpis: {
        appUsersUnique: users.length,
        appSessions,
        anonAppSessions,
        lastActivityMs,
      },
    },
    error: null,
  };
}

function emptyKpis() {
  return { appUsersUnique: 0, appSessions: 0, anonAppSessions: 0, lastActivityMs: 0 };
}

export default getAppUsers;
