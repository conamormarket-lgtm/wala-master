// src/services/adminOrders.js
//
// CAPA DE DATOS para el área admin "Recepción de Pedidos".
//
// Lee TODOS los pedidos del portal WALA desde el ERP (negocio aparte: colecciones
// `pedidos_web` y `pedidos`) — NO los del usuario logueado. usePedidos.js FILTRA al
// DNI del cliente, así que NO sirve para admin; aquí solo reusamos los normalizadores
// PUROS (getProductosPedido / getCodigoPedido / derivarEstadoCompra) y la regla
// esPedidoWala, replicando el patrón de lectura de salesAnalytics.js
// (fetchOrdersFromCollection: query indexada por createdAt desc + fallback en memoria).
//
// SOLO LECTURA del ERP. Ninguna función aquí escribe nada.
//
// La fuente de verdad de los nombres de campo es el payload que escribe el checkout
// (webOrderPayload en CheckoutPage.jsx). Toda lectura es defensiva (varios alias) para
// soportar también los pedidos NATIVOS del ERP (colección `pedidos`), cuyas líneas
// pueden no traer precio/subtotal.

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { erpDb, isErpFirestoreAvailable } from './erp/firebase';
import {
  derivarEstadoCompra,
  getProductosPedido,
  getCodigoPedido,
} from '../utils/estadoCompra';
import { getAllWalaMirrorOrders } from './walaOrders';

/**
 * Colecciones del ERP donde viven los pedidos. `pedidos_web` es la fuente principal
 * de los pedidos hechos desde WALA (el checkout web crea ahí, vía createWebOrder);
 * `pedidos` es el ERP validado, que también puede contener pedidos del portal una vez
 * aprobados (canalVenta === 'Portal Web').
 */
const COLECCION_WEB = 'pedidos_web';
const COLECCION_ERP = 'pedidos';

/**
 * Límite por defecto de pedidos a leer por colección (orden desc por fecha).
 * Conservador respecto al estándar del repo (MAX_ORDERS_PER_COLLECTION=400 en
 * salesAnalytics.js, bajado por "Quota exceeded"). Para Recepción 200 es suficiente.
 */
const LIMIT_DEFAULT = 200;

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers puros internos (no exportados)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Convierte un Timestamp Firestore / Date / number / string a milisegundos epoch. */
function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Convierte a número de forma segura (acepta strings tipo "120.00"). */
function toNum(value) {
  if (value == null || value === '') return 0;
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Primer valor no vacío de una lista de claves del pedido. */
function getFirst(pedido, keys) {
  if (!pedido || typeof pedido !== 'object') return undefined;
  for (const k of keys) {
    if (pedido[k] != null && pedido[k] !== '') return pedido[k];
  }
  return undefined;
}

/**
 * ¿El pedido fue hecho desde el portal WALA?
 * (Réplica de esPedidoWala de usePedidos.js:33-38 — el ERP es un negocio aparte y sus
 * colecciones mezclan pedidos nativos del ERP con los del portal.)
 */
function esPedidoWala(p) {
  return (
    !!p &&
    (p.canalVenta === 'Portal Web' ||
      p.web === true ||
      p.activador === 'portal_web' ||
      p.vendedor === 'Portal Web')
  );
}

/** Nombre completo del cliente, leyendo de forma defensiva los alias del ERP. */
function nombreClienteDe(pedido) {
  const partes = [pedido.clienteNombre, pedido.clienteApellidos].filter(Boolean);
  if (partes.length) return partes.join(' ');
  return (
    getFirst(pedido, [
      'clienteNombreCompleto',
      'nombreCompleto',
      'customerName',
      'nombreCliente',
      'nombre',
    ]) || 'Cliente'
  );
}

/** Teléfono / contacto principal del cliente. */
function contactoDe(pedido) {
  return (
    getFirst(pedido, [
      'clienteContacto',
      'envioContacto',
      'telefono1',
      'numero1',
      'phone',
      'phoneIntl',
      'telefono',
    ]) || ''
  );
}

/** Correo del cliente. */
function correoDe(pedido) {
  return getFirst(pedido, ['clienteCorreo', 'correo', 'email', 'correoElectronico']) || '';
}

/** Número de documento (DNI/CE) del cliente. */
function documentoDe(pedido) {
  return (
    getFirst(pedido, ['clienteNumeroDocumento', 'dni', 'envioNumeroDocumento', 'documento']) || ''
  );
}

/**
 * Dirección de entrega: usa los campos de ENVÍO (no los de cliente), con los mismos
 * alias defensivos que CuentaCompraDetallePage.jsx:285-295.
 */
function direccionEntregaDe(pedido) {
  const direccion =
    getFirst(pedido, ['envioDireccion', 'direccion', 'clienteDireccion']) || '';
  const distrito = getFirst(pedido, ['envioDistrito', 'clienteDistrito', 'distrito']) || '';
  const departamento =
    getFirst(pedido, ['envioDepartamento', 'envioCiudad', 'clienteDepartamento', 'ciudad']) || '';
  const partes = [distrito, departamento].filter(Boolean);
  return {
    direccion,
    distrito,
    departamento,
    direccionResumen: [direccion, ...partes].filter(Boolean).join(', '),
  };
}

/** Modo regalo: lee el sub-objeto giftDetails (solo presente si isGiftMode en checkout). */
function modoRegaloDe(pedido) {
  const g = pedido.giftDetails;
  const esRegalo = !!(g && g.isGift);
  return {
    esRegalo,
    destinatario: esRegalo ? g.recipientName || '' : '',
    mensaje: esRegalo ? g.message || '' : '',
    // deliveryDate SOLO vive bajo giftDetails (no en la raíz); string ISO.
    deliveryDate: esRegalo ? g.deliveryDate || null : null,
    deliveryEventLabel: esRegalo ? g.deliveryEventLabel || '' : '',
  };
}

/**
 * Normaliza las líneas de producto a un array uniforme para la tarjeta.
 * Reusa getProductosPedido (soporta map ERP item_0/item_1 → array).
 * OJO: los pedidos NATIVOS del ERP traen líneas SIN precio/subtotal.
 */
function productosDe(pedido) {
  const lineas = getProductosPedido(pedido);
  return lineas.map((l) => {
    const cantidad = toNum(l?.cantidad) || 1;
    const subtotal =
      l?.subtotal != null ? toNum(l.subtotal) : toNum(l?.precio) * cantidad;
    return {
      productoId: l?.productoId ?? null,
      nombre: l?.producto || 'Producto',
      brandId: l?.brandId ?? null,
      cantidad,
      talla: l?.talla ?? null,
      color: l?.color ?? null,
      precio: toNum(l?.precio),
      subtotal,
      personalizado: !!l?.personalizado,
    };
  });
}

/**
 * Etiqueta legible de la fecha de compra (es-PE) a partir de createdAt.
 */
function fechaLabelDe(ms) {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Normalización al CONTRATO de tarjeta de "Recepción de Pedidos"
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Convierte un pedido CRUDO del ERP en la tarjeta normalizada que consume la UI.
 * Función PURA (no muta su entrada, tolerante a campos ausentes).
 *
 * @param {object} rawPedido - Pedido crudo del ERP (con `id` y opcional `_coleccion`).
 * @returns {object} Tarjeta normalizada (ver forma en getWalaOrdersForAdmin).
 */
export function normalizarPedidoRecepcion(rawPedido) {
  const pedido = rawPedido && typeof rawPedido === 'object' ? rawPedido : {};

  const estado = derivarEstadoCompra(pedido);
  const productos = productosDe(pedido);
  const cantidadTotal =
    productos.reduce((acc, p) => acc + (p.cantidad || 0), 0) || toNum(pedido.cantidad);

  const fechaCompraMs = toMillis(pedido.createdAt ?? pedido.fechaCompra);
  const entrega = direccionEntregaDe(pedido);
  const regalo = modoRegaloDe(pedido);

  const montoTotal = toNum(pedido.montoTotal ?? pedido.total);
  const costoEnvio = toNum(pedido.costoEnvio ?? pedido.envioMonto ?? pedido.montoEnvio);
  const montoPendiente = toNum(pedido.montoPendiente);

  return {
    id: pedido.id || '',
    coleccion: pedido._coleccion || null, // 'pedidos' | 'pedidos_web' | null
    codigo: getCodigoPedido(pedido),
    canalVenta: pedido.canalVenta || '',
    esWala: esPedidoWala(pedido),

    // Procedencia de la COPIA-ESPEJO (red de seguridad wala_pedidos):
    //  - _fromMirror: el dato viene de la colección espejo (no del doc vivo).
    //  - _procesadoErp: además, su doc VIVO ya no existe en el ERP (lo absorbió/borró
    //    al aprobarlo). La UI lo marca como "Procesado en ERP" para que el admin no
    //    lo confunda con un pendiente, pero TAMPOCO lo pierda de vista.
    _fromMirror: pedido._fromMirror === true,
    _procesadoErp: pedido._procesadoErp === true,

    // Fecha de compra (createdAt es el campo real, Firestore Timestamp).
    fechaCompraMs,
    fechaCompraLabel: fechaLabelDe(fechaCompraMs),

    // Cliente y contacto.
    clienteNombre: nombreClienteDe(pedido),
    clienteContacto: contactoDe(pedido),
    clienteCorreo: correoDe(pedido),
    clienteDocumento: documentoDe(pedido),

    // Dirección de entrega (campos de ENVÍO, no del cliente).
    entrega,
    agenciaEnvio: pedido.agenciaEnvio || '',

    // Productos vendidos.
    productos,
    cantidadTotal,

    // Montos.
    montoTotal,
    costoEnvio,
    descuentoMonedas: toNum(pedido.descuentoMonedas),
    montoPendiente,

    // Estado unificado (producción + pago) derivado.
    estado: {
      key: estado.key,
      label: estado.label,
      color: estado.color,
      paid: estado.paid,
      paymentMethod: estado.paymentMethod,
      paymentLabel: estado.paymentLabel,
    },

    // Modo regalo y fecha de entrega programada (solo bajo giftDetails).
    esRegalo: regalo.esRegalo,
    regalo,
    deliveryDate: regalo.deliveryDate,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Lectura del ERP (réplica del patrón de salesAnalytics.fetchOrdersFromCollection)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Lee pedidos recientes de una colección del ERP, ordenados por createdAt desc.
 * Si se pasa `sinceMs`, intenta filtrar SERVER-SIDE (where createdAt >= …); si ese
 * filtro indexado falla (sin índice compuesto), cae a leer las más recientes y filtrar
 * en memoria. Sin `sinceMs` usa solo orderBy + limit (no requiere índice de rango).
 *
 * @param {string} collName
 * @param {number} limitN
 * @param {number|null} sinceMs
 * @returns {Promise<Array<object>>} pedidos crudos con id y _coleccion.
 */
async function fetchOrdersFromCollection(collName, limitN, sinceMs) {
  const coll = collection(erpDb, collName);
  const stamp = (p) => ({ id: p.id, _coleccion: collName, ...p });

  try {
    const q =
      sinceMs != null
        ? query(
            coll,
            where('createdAt', '>=', Timestamp.fromMillis(sinceMs)),
            orderBy('createdAt', 'desc'),
            limit(limitN)
          )
        : query(coll, orderBy('createdAt', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d) => stamp({ id: d.id, ...d.data() }));
  } catch (err) {
    // Fallback: leer recientes (solo orderBy) y filtrar el rango en memoria.
    console.warn(
      `[adminOrders] Filtro indexado falló en ${collName}, usando fallback:`,
      err?.message
    );
    try {
      const qFallback = query(coll, orderBy('createdAt', 'desc'), limit(limitN));
      const snap = await getDocs(qFallback);
      let docs = snap.docs.map((d) => stamp({ id: d.id, ...d.data() }));
      if (sinceMs != null) {
        docs = docs.filter((p) => toMillis(p.createdAt) >= sinceMs);
      }
      return docs;
    } catch (err2) {
      console.warn(`[adminOrders] Fallback también falló en ${collName}:`, err2?.message);
      return [];
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * API pública
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Obtiene los pedidos del portal WALA para el área admin "Recepción de Pedidos".
 *
 * Lee `pedidos_web` (fuente principal) ordenado por createdAt desc con límite, e
 * incluye también `pedidos` con canalVenta === 'Portal Web' (pedidos del portal ya
 * validados). Filtra con esPedidoWala, deduplica por id, normaliza al CONTRATO de
 * tarjeta y calcula un resumen agregado. NUNCA escribe en el ERP.
 *
 * Maneja errores devolviendo lista vacía sin romper.
 *
 * @param {object} [options]
 * @param {number} [options.limitN=200]    - Máximo de docs a leer por colección.
 * @param {number|null} [options.sinceDays=null] - Si se pasa, solo pedidos de los últimos N días.
 * @param {string|null} [options.estado=null]    - Si se pasa, filtra por estado.key (p.ej. 'entregado').
 * @returns {Promise<{
 *   pedidos: Array<object>,            // tarjetas normalizadas (ver normalizarPedidoRecepcion)
 *   resumen: {
 *     total: number,
 *     porEntregar: number,
 *     pendientesPago: number,
 *     enProduccion: number,
 *     entregados: number,
 *     montoTotal: number,
 *   },
 *   available: boolean,
 *   error: string|null,
 * }>}
 */
export async function getWalaOrdersForAdmin({
  limitN = LIMIT_DEFAULT,
  sinceDays = null,
  estado = null,
} = {}) {
  const resumenVacio = {
    total: 0,
    porEntregar: 0,
    pendientesPago: 0,
    enProduccion: 0,
    entregados: 0,
    montoTotal: 0,
  };
  const empty = { pedidos: [], resumen: resumenVacio, available: false, error: null };

  if (!isErpFirestoreAvailable()) {
    return { ...empty, error: 'ERP Firestore no disponible' };
  }

  const sinceMs =
    sinceDays != null && sinceDays > 0
      ? Date.now() - sinceDays * 24 * 60 * 60 * 1000
      : null;

  // Lee en paralelo: las 2 colecciones VIVAS del ERP + la COPIA-ESPEJO de WALA.
  // El espejo (getAllWalaMirrorOrders) NUNCA lanza (devuelve [] ante error), así
  // que su lectura no puede romper Recepción; solo las del ERP pueden fallar.
  let web = [];
  let erp = [];
  let espejo = [];
  try {
    [web, erp, espejo] = await Promise.all([
      fetchOrdersFromCollection(COLECCION_WEB, limitN, sinceMs),
      fetchOrdersFromCollection(COLECCION_ERP, limitN, sinceMs),
      // El espejo no soporta filtro de rango por fecha server-side; traemos las
      // copias más recientes y el filtro `sinceMs` se aplica en memoria más abajo
      // junto al resto (no afecta KPIs porque solo recorta lo antiguo).
      getAllWalaMirrorOrders({ limitN }).catch(() => []),
    ]);
  } catch (err) {
    return { ...empty, available: true, error: err?.message || 'Error al leer pedidos del ERP' };
  }

  // Pedidos VIVOS del ERP (pedidos_web + pedidos). Solo los del portal WALA
  // (el ERP mezcla pedidos nativos + del portal).
  let vivos = [...web, ...erp].filter(esPedidoWala);

  // De-dup de los VIVOS por CLAVE DE NEGOCIO (numeroPedido/portalPseudoOrderId),
  // con fallback al id. Un pedido del portal puede existir a la vez en `pedidos_web`
  // y en `pedidos`: al validarse en el ERP se crea un doc NUEVO con id distinto pero
  // MISMO numeroPedido. Deduplicar solo por doc id los mostraría DUPLICADOS e inflaría
  // los KPIs. Como `pedidos_web` se lee primero, su versión gana en empate.
  // Misma clave que walaOrders/adminOrders usan en toda la red de seguridad.
  const claveDeNegocio = (p) =>
    p?.numeroPedido || p?.portalPseudoOrderId || p?.pedidoWebId || p?.id || null;

  const clavesVivas = new Set();
  vivos = vivos.filter((p) => {
    const clave = claveDeNegocio(p);
    if (!clave) return true;
    if (clavesVivas.has(clave)) return false;
    clavesVivas.add(clave);
    return true;
  });

  // MERGE con la COPIA-ESPEJO: el doc VIVO siempre gana. Solo incorporamos las
  // copias cuyo doc vivo YA NO EXISTE en el ERP (el ERP las absorbió/borró al
  // aprobarlas). Esas copias solo-espejo se MARCAN como _procesadoErp para que la
  // UI muestre un badge "Procesado en ERP": el admin no las confunde con pendientes
  // pero tampoco las pierde de vista. Dedup interno del espejo por la misma clave.
  const soloEspejo = [];
  const clavesEspejoVistas = new Set();
  for (const copia of espejo) {
    const clave = claveDeNegocio(copia);
    // Si existe un doc vivo con esta clave, el vivo gana: descartamos la copia.
    if (clave && clavesVivas.has(clave)) continue;
    // Dedup interno de las copias entre sí.
    if (clave && clavesEspejoVistas.has(clave)) continue;
    if (clave) clavesEspejoVistas.add(clave);
    // El doc vivo ya no existe → es una copia de respaldo de un pedido ya procesado.
    soloEspejo.push({ ...copia, _procesadoErp: true });
  }

  let crudos = [...vivos, ...soloEspejo];

  // Las copias-espejo no pasan por el filtro de rango server-side (no se les aplica
  // `where createdAt >=`), así que si hay ventana temporal la aplicamos en memoria
  // para que `sinceDays` también recorte las copias antiguas. Los docs vivos ya
  // venían filtrados; re-filtrarlos es idempotente.
  if (sinceMs != null) {
    crudos = crudos.filter((p) => toMillis(p.createdAt) >= sinceMs);
  }

  // Normalizar al contrato de tarjeta y ordenar por fecha desc (mezcla de colecciones).
  let pedidos = crudos
    .map(normalizarPedidoRecepcion)
    .sort((a, b) => b.fechaCompraMs - a.fechaCompraMs);

  // Filtro opcional por estado.key.
  if (estado) {
    pedidos = pedidos.filter((p) => p.estado.key === estado);
  }

  // Resumen agregado.
  const resumen = pedidos.reduce(
    (acc, p) => {
      acc.total += 1;
      acc.montoTotal += p.montoTotal || 0;
      const key = p.estado.key;
      if (key === 'entregado') acc.entregados += 1;
      if (key === 'en_preparacion') acc.enProduccion += 1;
      if (!p.estado.paid) acc.pendientesPago += 1;
      // "Por entregar" = pagados/en curso que aún NO están entregados ni anulados.
      if (key !== 'entregado' && key !== 'anulado') acc.porEntregar += 1;
      return acc;
    },
    { ...resumenVacio }
  );
  resumen.montoTotal = Math.round(resumen.montoTotal * 100) / 100;

  return { pedidos, resumen, available: true, error: null };
}

export default getWalaOrdersForAdmin;
