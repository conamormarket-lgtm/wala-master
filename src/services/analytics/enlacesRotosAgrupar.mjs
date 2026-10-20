/*
 * Enlaces rotos (admin, dashboard/paginas): agrupa los eventos page_not_found
 * por dirección pedida. Funciones puras para poder probarlas sin Firestore
 * (enlacesRotosAgrupar.test.mjs).
 */

export const SIN_ORIGEN = 'Directo (escrito a mano, un QR o una app)';

// "/Promo/?utm=1#x" → "/Promo": sin query, sin ancla y sin la barra final.
export function direccionDeRuta(ruta) {
  const limpia = String(ruta || '').split('?')[0].split('#')[0].trim();
  if (!limpia || limpia === '/') return '/';
  return limpia.replace(/\/+$/, '') || '/';
}

// Una dirección de un solo tramo ("/promo") cae en /:slug: la busca como
// landing. Devuelve ese slug en minúsculas, o null si tiene más tramos.
export function slugDeDireccion(direccion) {
  const tramos = String(direccion || '').split('/').filter(Boolean);
  if (tramos.length !== 1) return null;
  try {
    return decodeURIComponent(tramos[0]).toLowerCase();
  } catch {
    return tramos[0].toLowerCase();
  }
}

// De dónde venía: el sitio de afuera (sin www.), la página de la tienda que
// tiene el enlace roto, o SIN_ORIGEN si no hay referrer.
export function origenDeReferrer(desde, hostPropio = '') {
  if (!desde) return SIN_ORIGEN;
  try {
    const url = new URL(desde);
    const host = url.host.replace(/^www\./, '');
    if (hostPropio && host === String(hostPropio).replace(/^www\./, '')) {
      return `En la tienda: ${direccionDeRuta(url.pathname)}`;
    }
    return host || SIN_ORIGEN;
  } catch {
    return String(desde).slice(0, 60);
  }
}

// La landing que hoy atiende ese slug (creada o redirigida después de las
// visitas): su slug actual, o null.
export function landingQueAtiende(slug, landings = []) {
  if (!slug) return null;
  const hit = landings.find((l) => String(l.slug || '').toLowerCase() === slug)
    || landings.find((l) => (l.slugsAnteriores || []).some((s) => String(s).toLowerCase() === slug));
  return hit ? hit.slug : null;
}

/**
 * eventos: docs page_not_found ({ path, eventData: { ruta, desde }, clientTsMs,
 * anonymousId, uid, sessionId }). Devuelve una fila por dirección, la más pedida
 * primero: { direccion, visitas, personas, ultimaMs, origenes: [{ origen,
 * visitas }], slug, resueltaA }.
 */
export function agruparEnlacesRotos(eventos = [], { landings = [], hostPropio = '' } = {}) {
  const porDireccion = new Map();
  for (const e of eventos) {
    const direccion = direccionDeRuta(e?.eventData?.ruta || e?.path);
    const clave = direccion.toLowerCase();
    if (!porDireccion.has(clave)) {
      porDireccion.set(clave, { direccion, visitas: 0, personas: new Set(), ultimaMs: 0, origenes: new Map() });
    }
    const fila = porDireccion.get(clave);
    fila.visitas += 1;
    const quien = e?.uid || e?.anonymousId || e?.sessionId;
    if (quien) fila.personas.add(quien);
    fila.ultimaMs = Math.max(fila.ultimaMs, Number(e?.clientTsMs) || 0);
    const origen = origenDeReferrer(e?.eventData?.desde, hostPropio);
    fila.origenes.set(origen, (fila.origenes.get(origen) || 0) + 1);
  }

  return [...porDireccion.values()]
    .map((f) => {
      const slug = slugDeDireccion(f.direccion);
      return {
        direccion: f.direccion,
        visitas: f.visitas,
        personas: f.personas.size,
        ultimaMs: f.ultimaMs,
        origenes: [...f.origenes.entries()]
          .map(([origen, visitas]) => ({ origen, visitas }))
          .sort((a, b) => b.visitas - a.visitas),
        slug,
        resueltaA: landingQueAtiende(slug, landings),
      };
    })
    .sort((a, b) => b.visitas - a.visitas || b.ultimaMs - a.ultimaMs);
}
