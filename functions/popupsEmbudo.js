/*
 * El embudo de un popup contado en PERSONAS (no en veces), del lado del
 * servidor. La conversión del navegador (popup_conversion) depende de una
 * marca en localStorage que se pierde (otra versión de la app, otro aparato,
 * datos borrados): con la encuesta se cruza además el clic con la cuenta, y
 * cuenta si la llenó (surveyCompletedAt) en los 7 días siguientes.
 */
const DIA_MS = 24 * 60 * 60 * 1000;
const VENTANA_MS = 7 * DIA_MS;
const RUTA_ENCUESTA = "/encuesta-suscripcion";

// Una persona: su cuenta si la tiene; si no, el aparato.
const persona = (e) => (e && e.uid ? `u:${e.uid}` : e && e.anonymousId ? `a:${e.anonymousId}` : null);
const personas = (lista) => new Set((lista || []).map(persona).filter(Boolean));

/** El primer clic de cada persona: { persona → { ts, uid, anonymousId } }. */
function primerosClics(clics = []) {
  const m = new Map();
  for (const c of clics) {
    const p = persona(c);
    if (!p) continue;
    const ts = Number(c.ts) || 0;
    const ya = m.get(p);
    if (!ya || ts < ya.ts) m.set(p, { ts, uid: c.uid || null, anonymousId: c.anonymousId || null });
  }
  return m;
}

const dentro = (t, desde) => Number.isFinite(t) && t >= desde && t - desde <= VENTANA_MS;

/**
 * - eventos: { vistas, cierres, clics, conversiones }: [{ uid, anonymousId, ts }]
 * - objetivo: 'encuesta' | 'registro' | 'enlace'
 * - abrieron: Set de personas que abrieron la encuesta tras su clic (la arma quien llama)
 * - completoEn: Map uid → ms en que llenó la encuesta
 * → { vistas, clics, cierres, conversiones (veces / quienes cumplieron),
 *     vieron, cerraron, tocaron, empezaron (null si no aplica), cumplieron }
 */
function embudoDePopup({ eventos = {}, objetivo = "", abrieron = new Set(), completoEn = new Map() } = {}) {
  const { vistas = [], cierres = [], clics = [], conversiones = [] } = eventos;
  const clicDe = primerosClics(clics);
  const cumplieron = personas(conversiones);
  if (objetivo === "encuesta") {
    for (const [p, c] of clicDe) {
      if (c.uid && dentro(Number(completoEn.get(c.uid)), c.ts)) cumplieron.add(p);
    }
  }
  const empezaron = objetivo === "encuesta"
    ? [...clicDe.keys()].filter((p) => abrieron.has(p) || cumplieron.has(p)).length
    : null;
  return {
    vistas: vistas.length,
    clics: clics.length,
    cierres: cierres.length,
    conversiones: cumplieron.size,
    vieron: personas(vistas).size,
    cerraron: personas(cierres).size,
    tocaron: clicDe.size,
    empezaron,
    cumplieron: cumplieron.size,
  };
}

module.exports = { embudoDePopup, primerosClics, persona, dentro, VENTANA_MS, RUTA_ENCUESTA };
