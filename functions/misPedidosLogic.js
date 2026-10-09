/**
 * Lógica PURA de "Mis Pedidos" (qué pedidos puede ver una cuenta). Sin
 * firebase-admin: se testea con Node puro (functions/test/misPedidosLogic.test.js).
 *
 * Por qué existe: antes la tienda mostraba TODOS los pedidos cuyo DNI coincidía
 * con el del perfil, y el DNI del perfil lo escribe el propio usuario sin
 * comprobarlo. Cualquiera podía registrarse con el DNI de un comprador invitado
 * y ver sus pedidos (nombre, dirección, teléfono, productos).
 *
 * Ahora un pedido se muestra COMPLETO solo si la cuenta demuestra que es suyo:
 *   - lo compró con esa cuenta (buyerUid / userId),
 *   - el correo del pedido es el de la cuenta Y ese correo está verificado,
 *   - o lo vinculó probando que lo conoce (número de pedido + teléfono).
 * Lo que solo coincide por DNI se resume (fecha y fase) sin datos personales.
 */

const { hitoDeEstadoErp, hitoDeEstadoWala } = require("./ordersLogic");

const COLECCIONES_PEDIDOS = ["pedidos", "pedidos_web", "wala_pedidos"];
// Campos de correo que usan el ERP y el checkout (mismos que ERP_CORREO de index.js).
const CAMPOS_CORREO = ["clienteCorreo", "correo", "email", "correoElectronico"];
const CAMPOS_TELEFONO = ["clienteContacto", "telefono1", "numero1", "phone", "telefono", "phone1"];

function normDoc(v) {
  return String(v == null ? "" : v).trim().replace(/\s/g, "");
}

function normEmail(v) {
  return String(v == null ? "" : v).trim().toLowerCase();
}

function soloDigitos(v) {
  return String(v == null ? "" : v).replace(/\D/g, "");
}

function normCodigo(v) {
  return String(v == null ? "" : v).trim().replace(/^#/, "").toUpperCase();
}

/** Clave de negocio del pedido (misma que adminOrders.js / searchOrdersByDniInERP). */
function claveDeNegocio(p) {
  return (p && (p.numeroPedido || p.portalPseudoOrderId || p.pedidoWebId || p.id)) || null;
}

function correosDePedido(p) {
  return CAMPOS_CORREO.map((f) => normEmail(p && p[f])).filter(Boolean);
}

function telefonosDePedido(p) {
  return CAMPOS_TELEFONO.map((f) => soloDigitos(p && p[f])).filter((t) => t.length >= 6);
}

/**
 * ¿Por qué esta cuenta puede ver el pedido completo? Devuelve el motivo
 * ('cuenta' | 'correo' | 'vinculado') o null si no hay prueba.
 *
 * @param {object} pedido  Doc crudo (con `id` y `_coleccion`).
 * @param {object} cuenta  { uid, email, emailVerificado, vinculados: Set<string> }
 *   `vinculados` contiene rutas "coleccion/id" y claves de negocio.
 */
function motivoDeAcceso(pedido, cuenta) {
  if (!pedido || !cuenta || !cuenta.uid) return null;
  if (pedido.buyerUid === cuenta.uid || pedido.userId === cuenta.uid) return "cuenta";
  const vinculados = cuenta.vinculados || new Set();
  const ruta = `${pedido._coleccion}/${pedido.id}`;
  const clave = claveDeNegocio(pedido);
  if (vinculados.has(ruta) || (clave && vinculados.has(`clave:${clave}`))) return "vinculado";
  const email = normEmail(cuenta.email);
  if (email && cuenta.emailVerificado === true && correosDePedido(pedido).includes(email)) {
    return "correo";
  }
  return null;
}

/** "juan.perez@gmail.com" → "j***@gmail.com". Sin dominio válido → null. */
function enmascararCorreo(email) {
  const e = normEmail(email);
  const at = e.indexOf("@");
  if (at < 1 || at === e.length - 1) return null;
  return `${e[0]}***${e.slice(at)}`;
}

/** Milisegundos de un Timestamp de Firestore, Date, número o ISO. 0 si no hay. */
function aMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v._seconds === "number") return v._seconds * 1000;
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  const n = new Date(v).getTime();
  return Number.isNaN(n) ? 0 : n;
}

/** Fase gruesa para el resumen: 'pagado' | 'produccion' | 'enviado' | 'entregado' | 'recibido'. */
function faseGruesa(p) {
  return hitoDeEstadoErp(p && p.estadoGeneral) || hitoDeEstadoWala(p && p.estadoWala) || "recibido";
}

/**
 * Resumen SIN datos personales de un pedido que coincide por DNI pero que la
 * cuenta todavía no demostró que es suyo. Solo fecha, fase y una pista de con
 * qué correo se hizo (enmascarado) para que la persona sepa cómo verlo.
 */
function resumenPendiente(pedido, cuenta) {
  const correos = correosDePedido(pedido);
  const email = normEmail(cuenta && cuenta.email);
  return {
    ref: `${pedido._coleccion}/${pedido.id}`,
    fecha: aMillis(pedido.createdAt) || null,
    fase: faseGruesa(pedido),
    pistaCorreo: correos.length ? enmascararCorreo(correos[0]) : null,
    // Mismo correo que la cuenta, pero la cuenta aún no lo verificó: basta con
    // verificar el correo para verlo.
    mismoCorreo: !!email && correos.includes(email),
  };
}

/**
 * Reparte los pedidos encontrados en visibles y pendientes.
 *
 * Las copias espejo (wala_pedidos) no guardan correo: una copia se ve si es de
 * la cuenta, si está vinculada, o si su pedido vivo (misma clave de negocio) es
 * visible. Los pendientes se deduplican por clave de negocio para no contar dos
 * veces el mismo pedido (vivo + espejo).
 *
 * @param {Array<object>} pedidos Docs crudos con `id` y `_coleccion`, sin repetir ruta.
 * @param {object} cuenta { uid, email, emailVerificado, vinculados }
 * @returns {{ visibles: Array<object>, pendientes: Array<object> }}
 */
function clasificarPedidos(pedidos, cuenta) {
  const visibles = [];
  const candidatos = [];
  const clavesVisibles = new Set();

  const vivos = pedidos.filter((p) => p && p._coleccion !== "wala_pedidos");
  const espejos = pedidos.filter((p) => p && p._coleccion === "wala_pedidos");

  for (const p of vivos) {
    if (motivoDeAcceso(p, cuenta)) {
      visibles.push(p);
      const c = claveDeNegocio(p);
      if (c) clavesVisibles.add(c);
    } else {
      candidatos.push(p);
    }
  }
  for (const m of espejos) {
    const c = claveDeNegocio(m);
    if (motivoDeAcceso(m, cuenta) || (c && clavesVisibles.has(c))) {
      visibles.push(m);
      if (c) clavesVisibles.add(c);
    } else {
      candidatos.push(m);
    }
  }

  const pendientes = [];
  const clavesPendientes = new Set();
  for (const p of candidatos) {
    const c = claveDeNegocio(p);
    if (c && (clavesVisibles.has(c) || clavesPendientes.has(c))) continue;
    if (c) clavesPendientes.add(c);
    pendientes.push(resumenPendiente(p, cuenta));
  }
  pendientes.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
  return { visibles, pendientes };
}

/**
 * Prueba de que el pedido es de quien lo pide: el número de pedido Y el
 * teléfono con el que se hizo (los dos los tiene el comprador en su
 * confirmación; quien solo conoce un DNI ajeno no).
 */
function pruebaDeVinculo(pedido, { numeroPedido, telefono } = {}) {
  const codigo = normCodigo(numeroPedido);
  const tel = soloDigitos(telefono);
  if (!codigo || tel.length < 6) return false;
  const codigos = [pedido.numeroPedido, pedido.portalPseudoOrderId, pedido.pedidoWebId]
    .map(normCodigo)
    .filter(Boolean);
  if (!codigos.includes(codigo)) return false;
  // Se comparan los últimos 9 dígitos: así da igual si se escribió con +51.
  const ultimos = (t) => t.slice(-9);
  return telefonosDePedido(pedido).some((t) => ultimos(t) === ultimos(tel));
}

/**
 * Convierte el doc para mandarlo por una callable sin perder las fechas: los
 * Timestamp pasan a { __ts: millis } y el cliente los vuelve a construir.
 * (Sin esto llegan como { _seconds, _nanoseconds } y la vista no los reconoce.)
 */
function serializarParaCliente(valor, profundidad = 0) {
  if (valor == null || profundidad > 12) return valor;
  if (typeof valor.toMillis === "function") return { __ts: valor.toMillis() };
  if (valor instanceof Date) return { __ts: valor.getTime() };
  if (Array.isArray(valor)) return valor.map((v) => serializarParaCliente(v, profundidad + 1));
  if (typeof valor === "object") {
    // DocumentReference u otros objetos del SDK: se mandan como ruta.
    if (typeof valor.path === "string" && typeof valor.firestore === "object") return valor.path;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (typeof v === "function") continue;
      out[k] = serializarParaCliente(v, profundidad + 1);
    }
    return out;
  }
  return valor;
}

/** Ventana deslizante simple para limitar intentos de vínculo. */
function evaluarIntentos(estado, ahoraMs, { max = 5, ventanaMs = 60 * 60 * 1000 } = {}) {
  const inicio = Number(estado && estado.inicio) || 0;
  const n = Number(estado && estado.n) || 0;
  if (!inicio || ahoraMs - inicio >= ventanaMs) return { permitido: true, siguiente: { inicio: ahoraMs, n: 1 } };
  if (n >= max) return { permitido: false, siguiente: { inicio, n }, esperaMs: inicio + ventanaMs - ahoraMs };
  return { permitido: true, siguiente: { inicio, n: n + 1 } };
}

module.exports = {
  COLECCIONES_PEDIDOS,
  CAMPOS_CORREO,
  normDoc,
  normEmail,
  claveDeNegocio,
  motivoDeAcceso,
  enmascararCorreo,
  resumenPendiente,
  clasificarPedidos,
  pruebaDeVinculo,
  serializarParaCliente,
  evaluarIntentos,
  aMillis,
};
