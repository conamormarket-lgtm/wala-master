/**
 * Lógica PURA de los avisos de pedido (categoría ORDERS del panel de
 * notificaciones). Sin firebase-admin: se testea con Node puro
 * (functions/test/ordersLogic.test.js).
 *
 * El ERP mueve `pedidos.estadoGeneral` por muchas etapas internas (Diseño,
 * Impresión, Estampado, Empaquetado, "Listo para…", "En Pausa por Stock"…).
 * Al cliente no le sirve un aviso por cada una: se agrupan en HITOS y se avisa
 * una sola vez por hito y pedido.
 */

// Orden de los hitos: un pedido no "vuelve" a un hito anterior.
const HITOS = ["pagado", "produccion", "enviado", "entregado"];

function normalizar(estado) {
  return String(estado || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Hito del cliente para un estadoGeneral del ERP, o null si no amerita aviso. */
function hitoDeEstadoErp(estadoGeneral) {
  const e = normalizar(estadoGeneral);
  if (!e) return null;
  // Pausas, anulaciones y estados iniciales no se avisan.
  if (/pausa|anulad|cancelad|nuevo|pendiente/.test(e)) return null;
  if (/finaliz|entregad|completad/.test(e)) return "entregado";
  if (/reparto|enviad|en camino|despach/.test(e)) return "enviado";
  if (/disen|impres|prepar|estamp|empaqu|produc/.test(e)) return "produccion";
  return null;
}

/** Hito del cliente para un estadoWala de wala_pedidos (la base propia de Wala). */
function hitoDeEstadoWala(estadoWala) {
  const e = normalizar(estadoWala);
  if (e === "pagado") return "pagado";
  if (e === "en_preparacion") return "produccion";
  if (e === "enviado") return "enviado";
  if (e === "entregado") return "entregado";
  return null;
}

/**
 * ¿Hay que avisar este hito? Solo si es nuevo para el pedido y no es anterior
 * al último ya avisado (si el pedido saltó directo a "entregado", no se manda
 * después un "en producción" atrasado).
 */
function debeAvisar(hito, yaAvisados) {
  if (!hito || !HITOS.includes(hito)) return false;
  const lista = Array.isArray(yaAvisados) ? yaAvisados : [];
  if (lista.includes(hito)) return false;
  const maxPrevio = Math.max(-1, ...lista.map((h) => HITOS.indexOf(h)));
  return HITOS.indexOf(hito) > maxPrevio;
}

function textoHito(hito, numeroPedido) {
  const n = numeroPedido ? ` #${numeroPedido}` : "";
  switch (hito) {
    case "pagado":
      return { title: "✅ Recibimos tu pago", body: `Tu pedido${n} ya está confirmado. Te avisamos cuando entre a producción.` };
    case "produccion":
      return { title: "🎨 Tu pedido está en producción", body: `Ya estamos trabajando en tu pedido${n}.` };
    case "enviado":
      return { title: "🚚 Tu pedido va en camino", body: `Tu pedido${n} salió a reparto. ¡Ya casi llega!` };
    case "entregado":
      return { title: "🎁 Tu pedido fue entregado", body: `Esperamos que te encante tu pedido${n}. ¡Gracias por comprar en Walá!` };
    default:
      return null;
  }
}

module.exports = { HITOS, hitoDeEstadoErp, hitoDeEstadoWala, debeAvisar, textoHito };
