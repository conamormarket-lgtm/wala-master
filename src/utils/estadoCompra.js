// src/utils/estadoCompra.js
//
// Utilidades puras y defensivas para la vista "Mis Compras / Estado de la compra"
// (estilo MercadoLibre). NO contienen lógica de cobro/totales; solo DERIVAN un
// estado legible a partir de los campos del pedido (crudo o normalizado).
//
// OJO con la normalización: usePedidos pasa los pedidos por
// normalizarPedidoParaVista (src/utils/pedidos.js), que NO hace spread del
// pedido crudo: construye un objeto explícito. Eso significa que campos como
// `pagado`, `estadoPago`, `web`, `numeroPedido`, `portalPseudoOrderId`,
// `metodoPago`, `estadoValidacion` y el mapa `productos` NO sobreviven a la
// normalización (sí sobreviven `estadoGeneral`/`estado`, `id`, `createdAt`,
// `historialPagos`, `marca`). Por eso TODAS las funciones aquí leen de forma
// defensiva con varios alias, y las páginas deben pasar el pedido CRUDO cuando
// necesiten el detalle de productos / método de pago.
//
// Todas las funciones son puras: no mutan su entrada ni dependen de estado
// externo, y no rompen si faltan campos.

import { estadoToKey } from './constants';

/**
 * Devuelve las líneas de producto de un pedido como array, soportando tanto el
 * formato array como el formato mapa del ERP ({ item_0: {...}, item_1: {...} }).
 *
 * Cada línea se devuelve "tal cual" viene del pedido; el contrato esperado por
 * línea es:
 *   { productoId, producto, cantidad, talla, color, precio, subtotal,
 *     personalizado, urlImagenPersonalizada, brandId? }
 *
 * @param {object} pedido
 * @returns {Array<object>}
 */
export function getProductosPedido(pedido) {
  if (!pedido || typeof pedido !== 'object') return [];
  const productos = pedido.productos;
  if (productos == null) return [];
  if (Array.isArray(productos)) return productos.filter(Boolean);
  if (typeof productos === 'object') return Object.values(productos).filter(Boolean);
  return [];
}

/**
 * Código / número visible del pedido para mostrar al cliente.
 * Prioriza el número oficial del ERP, luego el pseudo-id del portal, luego el id.
 *
 * @param {object} pedido
 * @returns {string}
 */
export function getCodigoPedido(pedido) {
  if (!pedido || typeof pedido !== 'object') return '';
  return pedido.numeroPedido || pedido.portalPseudoOrderId || pedido.id || '';
}

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers internos (no exportados)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Etapas que se consideran "todavía no entró a producción" (pedido recién creado). */
const ETAPAS_INICIALES = ['nuevo', 'pendiente', ''];

/** Etapas que se consideran "pedido entregado / finalizado". */
const ETAPAS_FINALIZADAS = ['finalizado', 'entregado', 'completado'];

/**
 * ¿El pedido figura como pagado? Lee múltiples alias de forma defensiva.
 * Cualquiera de estas señales basta para considerarlo pagado:
 *   - pagado === true
 *   - estadoPago === 'pagado'
 *   - web === false            (un pedido NO-web ya pasó por caja en el ERP)
 *   - conDeuda === false       (sin deuda pendiente)
 *   - algún registro de historialPagos con estado que matchee /aprob/i
 */
function esPagado(pedido) {
  if (!pedido || typeof pedido !== 'object') return false;
  if (pedido.pagado === true) return true;
  if (pedido.estadoPago === 'pagado') return true;
  if (pedido.web === false) return true;
  if (pedido.conDeuda === false) return true;
  if (
    Array.isArray(pedido.historialPagos) &&
    pedido.historialPagos.some((p) => /aprob/i.test((p && p.estado) || ''))
  ) {
    return true;
  }
  return false;
}

/**
 * Determina el método de pago y una etiqueta humana legible.
 * @param {object} pedido
 * @param {boolean} paid
 * @returns {{ paymentMethod: (string|null), paymentLabel: string }}
 */
function derivarMetodoPago(pedido, paid) {
  // Método explícito del pedido o, en su defecto, el del último registro de pago.
  let paymentMethod = (pedido && pedido.metodoPago) || null;
  if (!paymentMethod && pedido && Array.isArray(pedido.historialPagos)) {
    for (let i = pedido.historialPagos.length - 1; i >= 0; i -= 1) {
      const reg = pedido.historialPagos[i];
      if (reg && reg.metodo) {
        paymentMethod = reg.metodo;
        break;
      }
    }
  }

  const metodoStr = paymentMethod ? String(paymentMethod).toLowerCase() : '';

  let paymentLabel;
  if (/culqi|tarjeta|card|visa|mastercard/.test(metodoStr)) {
    paymentLabel = 'Pagado con tarjeta (Culqi)';
  } else if (/paypal/.test(metodoStr)) {
    paymentLabel = 'Pagado con PayPal';
  } else if (/yape|plin|transfer|transf|deposito|depósito/.test(metodoStr)) {
    // Yape/Plin/transferencia requieren validación manual del asesor.
    paymentLabel = 'Por validar (Yape/Plin/transf.)';
  } else if (paid) {
    // Pagado pero sin método identificable: etiqueta genérica de tarjeta (Culqi
    // es el método por defecto del portal en Perú).
    paymentLabel = 'Pagado con tarjeta (Culqi)';
  } else {
    paymentLabel = 'Pendiente de pago';
  }

  return { paymentMethod, paymentLabel };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Derivación del estado de compra (combina los dos ejes: etapa + pago)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Deriva un estado de compra unificado y legible combinando DOS ejes:
 *   1) la etapa de producción (estadoGeneral / status / estado), y
 *   2) si el pedido está pagado o no.
 *
 * @param {object} pedido
 * @returns {{
 *   key: string, label: string, color: string,
 *   paid: boolean, paymentMethod: (string|null), paymentLabel: string
 * }}
 */
export function derivarEstadoCompra(pedido) {
  const safe = pedido && typeof pedido === 'object' ? pedido : {};

  // Eje 1: etapa de producción normalizada a key (p.ej. "impresion", "reparto").
  const etapa = estadoToKey(safe.estadoGeneral || safe.status || safe.estado) || '';

  // ── CASO ESPEJO (red de seguridad) ─────────────────────────────────────────
  // Un pedido que viene SOLO de la copia espejo (_fromMirror) y NO trae etapa de
  // producción significa que su doc VIVO ya no existe: el ERP lo absorbió/aprobó
  // al validarlo (por eso desapareció de pedidos/pedidos_web). En "Mis Compras"
  // debe verse CONFIRMADO/PROCESADO (verde), NUNCA "Por confirmar pago" ni error.
  // El espejo no guarda estadoGeneral avanzado, así que sin esta rama caería por
  // defecto a 'por_confirmar_pago'. Solo aplica a copias de respaldo: los pedidos
  // VIVOS (sin _fromMirror) conservan su derivación normal intacta.
  const esSoloEspejo = safe._fromMirror === true || safe.fuente === 'wala-mirror';
  if (esSoloEspejo && ETAPAS_INICIALES.includes(etapa)) {
    const { paymentMethod, paymentLabel } = derivarMetodoPago(safe, true);
    return {
      key: 'pago_confirmado',
      label: 'Confirmado',
      color: '#16a34a', // verde (procesado/en el sistema de gestión)
      paid: true,
      paymentMethod,
      // Mensaje claro de que el pedido ya está en el ERP/sistema de gestión.
      paymentLabel: paymentLabel === 'Pendiente de pago'
        ? 'En tu sistema de gestión'
        : paymentLabel,
    };
  }

  // estadoToKey recorta el prefijo "en " y corrompe literales como "Entregado"
  // (-> "tregado"); por eso comprobamos también el texto crudo para terminal/anulado.
  const rawEstado = String(safe.estadoGeneral || safe.status || safe.estado || '').toLowerCase();
  const esFinalizadoRaw = /entreg|finaliz|complet/.test(rawEstado);
  const esAnuladoRaw = /anul|cancel/.test(rawEstado);

  // Eje 2: ¿pagado?
  const paid = esPagado(safe);

  // El método/etiqueta de pago se calcula siempre; el `paid` que se le pasa se
  // ajusta por caso más abajo cuando la etapa fuerza un estado "pagado".
  let estado;

  if (etapa === 'anulado' || esAnuladoRaw) {
    estado = {
      key: 'anulado',
      label: 'Anulado',
      color: '#6b7280', // gris
      paid,
    };
  } else if (ETAPAS_FINALIZADAS.includes(etapa) || esFinalizadoRaw) {
    // Si llegó a entregado/finalizado, asumimos pago completado.
    estado = {
      key: 'entregado',
      label: 'Entregado',
      color: '#16a34a', // verde
      paid: true,
    };
  } else if (etapa && !ETAPAS_INICIALES.includes(etapa)) {
    // Está en alguna etapa intermedia de producción/reparto.
    estado = {
      key: 'en_preparacion',
      label: etapa === 'reparto' ? 'En camino' : 'En preparación',
      color: '#7C3AED', // violeta (Aurora Violeta Serena)
      paid,
    };
  } else if (paid) {
    // Sin etapa avanzada pero el pago ya está confirmado.
    estado = {
      key: 'pago_confirmado',
      label: 'Pago confirmado',
      color: '#2563eb', // azul
      paid: true,
    };
  } else {
    // Recién creado y sin confirmación de pago.
    estado = {
      key: 'por_confirmar_pago',
      label: 'Por confirmar pago',
      color: '#d97706', // ámbar
      paid: false,
    };
  }

  const { paymentMethod, paymentLabel } = derivarMetodoPago(safe, estado.paid);

  return {
    key: estado.key,
    label: estado.label,
    color: estado.color,
    paid: estado.paid,
    paymentMethod,
    paymentLabel,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Marcas (brandIds) del pedido
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Devuelve los brandIds ÚNICOS presentes en un pedido. Por cada línea:
 *   - usa line.brandId si existe; si no,
 *   - cruza line.productoId contra el catálogo (array de productos) -> product.brandId.
 * Filtra valores falsy y deduplica.
 *
 * @param {object} pedido
 * @param {Array<object>} [catalogo] - Array de productos del catálogo (cada uno con id/brandId).
 * @returns {Array<string>}
 */
export function getBrandIdsDePedido(pedido, catalogo) {
  const lineas = getProductosPedido(pedido);
  if (lineas.length === 0) return [];

  const cat = Array.isArray(catalogo) ? catalogo : [];

  // Índice productoId -> brandId del catálogo (para no recorrerlo por cada línea).
  let indicePorId = null;
  const resolverPorCatalogo = (productoId) => {
    if (!productoId || cat.length === 0) return null;
    if (indicePorId == null) {
      indicePorId = new Map();
      for (const prod of cat) {
        if (!prod || typeof prod !== 'object') continue;
        const pid = prod.id ?? prod.productoId ?? prod.productId;
        if (pid != null && prod.brandId) indicePorId.set(String(pid), prod.brandId);
      }
    }
    return indicePorId.get(String(productoId)) || null;
  };

  const brandIds = [];
  for (const linea of lineas) {
    if (!linea || typeof linea !== 'object') continue;
    const brandId = linea.brandId || resolverPorCatalogo(linea.productoId);
    if (brandId) brandIds.push(brandId);
  }

  return [...new Set(brandIds)];
}
