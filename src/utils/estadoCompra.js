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
// WALA = FUENTE DE VERDAD: estadoWalaADisplay traduce wala_pedidos.estadoWala
// (pendiente_pago/pagado/en_preparacion/enviado/entregado/cancelado) a label/color/paso.
// Se usa para que "Mis Compras" y "Recepción" muestren el estado PROPIO de WALA.
import { estadoWalaADisplay } from '../services/walaOrders';

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
 * RANGO de avance de cada `key` de estado de compra. Sirve para elegir el estado
 * MÁS AVANZADO cuando coexisten dos fuentes para el mismo pedido (el doc VIVO del
 * ERP y el estado propio de WALA en wala_pedidos). Mayor número = más avanzado.
 * `anulado` queda fuera de la línea (se trata aparte, es terminal alterno).
 */
const RANGO_ESTADO = {
  anulado: -1,
  por_confirmar_pago: 0,
  pago_confirmado: 1,
  en_preparacion: 2,
  entregado: 3,
};

/** Rango seguro de una key (desconocida = 0, el más bajo no-anulado). */
function rangoDe(key) {
  return RANGO_ESTADO[key] != null ? RANGO_ESTADO[key] : 0;
}

/**
 * Deriva el estado de compra SOLO a partir de la etapa de producción del ERP
 * (estadoGeneral/status/estado) + si está pagado. Es la derivación HISTÓRICA del
 * portal para pedidos VIVOS del ERP; no conoce wala_pedidos. Devuelve null cuando
 * NO hay señal de etapa NI de pago en el doc (para que el llamador pueda preferir
 * el estado propio de WALA en pedidos solo-espejo).
 *
 * @param {object} safe
 * @param {boolean} [permitirNull=false] - Si true, devuelve null cuando no hay etapa ni pago.
 * @returns {{ key:string, label:string, color:string, paid:boolean }|null}
 */
function derivarEstadoErp(safe, permitirNull = false) {
  // Eje 1: etapa de producción normalizada a key (p.ej. "impresion", "reparto").
  const etapa = estadoToKey(safe.estadoGeneral || safe.status || safe.estado) || '';

  // estadoToKey recorta el prefijo "en " y corrompe literales como "Entregado"
  // (-> "tregado"); por eso comprobamos también el texto crudo para terminal/anulado.
  const rawEstado = String(safe.estadoGeneral || safe.status || safe.estado || '').toLowerCase();
  const esFinalizadoRaw = /entreg|finaliz|complet/.test(rawEstado);
  const esAnuladoRaw = /anul|cancel/.test(rawEstado);

  // Eje 2: ¿pagado?
  const paid = esPagado(safe);

  if (etapa === 'anulado' || esAnuladoRaw) {
    return { key: 'anulado', label: 'Anulado', color: '#6b7280', paid }; // gris
  }
  if (ETAPAS_FINALIZADAS.includes(etapa) || esFinalizadoRaw) {
    // Si llegó a entregado/finalizado, asumimos pago completado.
    return { key: 'entregado', label: 'Entregado', color: '#16a34a', paid: true }; // verde
  }
  if (etapa && !ETAPAS_INICIALES.includes(etapa)) {
    // Está en alguna etapa intermedia de producción/reparto.
    return {
      key: 'en_preparacion',
      label: etapa === 'reparto' ? 'En camino' : 'En preparación',
      color: '#7C3AED', // violeta (Aurora Violeta Serena)
      paid,
    };
  }
  if (paid) {
    // Sin etapa avanzada pero el pago ya está confirmado.
    return { key: 'pago_confirmado', label: 'Pago confirmado', color: '#2563eb', paid: true }; // azul
  }
  // Sin etapa avanzada y sin señal de pago.
  if (permitirNull) return null;
  return { key: 'por_confirmar_pago', label: 'Por confirmar pago', color: '#d97706', paid: false }; // ámbar
}

/**
 * Traduce un wala_pedidos.estadoWala al MISMO vocabulario de `key` que usa la UI
 * de "Mis Compras"/"Recepción" (por_confirmar_pago/pago_confirmado/en_preparacion/
 * entregado/anulado). Reusa estadoWalaADisplay (label/color de marca de WALA) y
 * añade la `key` y el flag `paid` que el resto del módulo espera.
 *
 * Mapeo (decisión del dueño):
 *   pendiente_pago → por_confirmar_pago (ámbar "Por confirmar pago", no pagado)
 *   pagado         → pago_confirmado    (azul "Pagado", pagado)
 *   en_preparacion → en_preparacion     ("En preparación")
 *   enviado        → en_preparacion     ("Enviado"/"En camino")
 *   entregado      → entregado          (verde "Entregado")
 *   cancelado      → anulado            (gris "Cancelado")
 *
 * @param {string} estadoWala
 * @returns {{ key:string, label:string, color:string, paid:boolean }|null}
 */
function estadoWalaAEstadoCompra(estadoWala) {
  if (!estadoWala) return null;
  const disp = estadoWalaADisplay(estadoWala); // { label, color(semáforo), paso }
  const mapa = {
    pendiente_pago: { key: 'por_confirmar_pago', color: '#d97706', paid: false }, // ámbar
    pagado: { key: 'pago_confirmado', color: '#2563eb', paid: true }, // azul
    en_preparacion: { key: 'en_preparacion', color: '#7C3AED', paid: true }, // violeta
    enviado: { key: 'en_preparacion', color: '#7C3AED', paid: true }, // violeta (en camino)
    entregado: { key: 'entregado', color: '#16a34a', paid: true }, // verde
    cancelado: { key: 'anulado', color: '#6b7280', paid: false }, // gris
  };
  const base = mapa[estadoWala];
  if (!base) return null;
  // El label legible sale de estadoWalaADisplay (textos propios de WALA).
  return { key: base.key, label: disp.label, color: base.color, paid: base.paid };
}

/**
 * Deriva un estado de compra unificado y legible.
 *
 * WALA = FUENTE DE VERDAD: si el pedido trae estado propio de WALA
 * (wala_pedidos.estadoWala en pedidos solo-espejo, o `_walaEstado` adjuntado al
 * doc VIVO del ERP en searchOrdersByDniInERP/adminOrders), se combina con la
 * derivación histórica del ERP (etapa de producción + pago) y se muestra el
 * estado MÁS AVANZADO entre ambos (no se degrada un "Entregado/Finalizado" del
 * ERP a "pagado", ni viceversa). Para pedidos VIVOS que NO son de WALA (sin
 * estadoWala) el comportamiento es EXACTAMENTE el histórico.
 *
 * @param {object} pedido
 * @returns {{
 *   key: string, label: string, color: string,
 *   paid: boolean, paymentMethod: (string|null), paymentLabel: string
 * }}
 */
export function derivarEstadoCompra(pedido) {
  const safe = pedido && typeof pedido === 'object' ? pedido : {};

  // ── Estado propio de WALA (si el pedido lo trae) ───────────────────────────
  // Dos orígenes posibles:
  //   - Pedido SOLO-ESPEJO: el doc crudo de wala_pedidos trae `estadoWala`.
  //   - Doc VIVO enriquecido: searchOrdersByDniInERP/adminOrders adjuntaron
  //     `_walaEstado` (y `_walaPagado`) al doc vivo del ERP.
  const walaEstadoRaw = safe.estadoWala || safe._walaEstado || null;
  const estadoWala = walaEstadoRaw ? estadoWalaAEstadoCompra(walaEstadoRaw) : null;

  // ── Estado del ERP (etapa de producción + pago) ────────────────────────────
  // Si hay estado de WALA, permitimos null cuando el ERP no aporta señal (así un
  // pedido solo-espejo pendiente_pago NO se fuerza a "por_confirmar_pago" del ERP
  // sino que toma el estado de WALA). Si NO hay estado de WALA, mantenemos el
  // comportamiento histórico (nunca null → default "por_confirmar_pago").
  const estadoErp = derivarEstadoErp(safe, /* permitirNull */ !!estadoWala);

  // ── Elegir el estado a mostrar ─────────────────────────────────────────────
  // Regla de fusión: el ESTADO mostrado = el MÁS AVANZADO entre el del ERP y el de
  // WALA. `anulado/cancelado` es terminal: si CUALQUIER fuente lo marca, gana
  // (un pedido cancelado no debe verse "en preparación").
  let estado;
  if (estadoErp && estadoWala) {
    if (estadoErp.key === 'anulado' || estadoWala.key === 'anulado') {
      // Cancelación terminal: preferimos el que esté anulado (gris).
      estado = estadoErp.key === 'anulado' ? estadoErp : estadoWala;
    } else {
      // Ambos en la línea normal: gana el de mayor rango (no degradar).
      estado = rangoDe(estadoWala.key) >= rangoDe(estadoErp.key) ? estadoWala : estadoErp;
    }
  } else {
    // Solo una fuente disponible (o ninguna → default del ERP).
    estado = estadoWala || estadoErp;
  }

  // `paid`: pagado si la fuente elegida lo indica, o si WALA dice pagado (el pago
  // se sincroniza en wala_pedidos), o si el doc vivo trae _walaPagado.
  const paid = !!(estado.paid || (estadoWala && estadoWala.paid) || safe._walaPagado === true);

  const { paymentMethod, paymentLabel } = derivarMetodoPago(safe, paid);

  return {
    key: estado.key,
    label: estado.label,
    color: estado.color,
    paid,
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
