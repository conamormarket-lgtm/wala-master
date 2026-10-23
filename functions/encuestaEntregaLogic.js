/**
 * Lógica PURA de la encuesta de la entrega ("¿Cómo te fue con tu pedido?").
 * Sin firebase-admin: se testea con Node puro
 * (functions/test/encuestaEntregaLogic.test.js).
 *
 * La config vive en tienda_encuesta_config/global → entregaPanel (la edita el
 * admin en /admin/encuesta-entregas):
 *   { activo, monedas, opcionesMejorar: [texto] }
 */

const OPCIONES_POR_DEFECTO = [
  "Tiempo de entrega", "Calidad del producto", "Empaque", "Atención", "Precio", "Todo estuvo bien",
];
const MONEDAS_POR_DEFECTO = 5;
const MONEDAS_TOPE = 50;
const COMENTARIO_MAX = 500;

/** La config con sus valores por defecto y los límites del servidor. */
function configEntrega(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const opciones = Array.isArray(c.opcionesMejorar)
    ? c.opcionesMejorar.map((o) => String(o || "").trim()).filter(Boolean).slice(0, 12)
    : [];
  const monedas = Number(c.monedas);
  return {
    activo: c.activo !== false,
    monedas: Number.isFinite(monedas) ? Math.max(0, Math.min(MONEDAS_TOPE, Math.round(monedas))) : MONEDAS_POR_DEFECTO,
    opcionesMejorar: opciones.length ? opciones : OPCIONES_POR_DEFECTO,
  };
}

/**
 * Valida lo que manda el cliente. Devuelve { estrellas, mejorar, comentario }
 * o { error } con el mensaje para mostrar.
 */
function limpiarRespuestaEntrega(data, cfg) {
  const estrellas = Number(data && data.estrellas);
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) return { error: "Elige de 1 a 5 estrellas." };
  const validas = new Set(cfg.opcionesMejorar);
  const mejorar = [...new Set((Array.isArray(data && data.mejorar) ? data.mejorar : []).map((x) => String(x || "").trim()))]
    .filter((x) => validas.has(x));
  const comentario = String((data && data.comentario) || "").trim().slice(0, COMENTARIO_MAX);
  return { estrellas, mejorar, comentario };
}

/** Id del documento: una respuesta por cliente y pedido. */
function claveEntrega(uid, codigo) {
  return `${uid}__${String(codigo).trim().replace(/[/\\#?[\].]/g, "-").replace(/\s+/g, "-")}`;
}

module.exports = {
  configEntrega, limpiarRespuestaEntrega, claveEntrega, OPCIONES_POR_DEFECTO, MONEDAS_POR_DEFECTO, COMENTARIO_MAX,
};
