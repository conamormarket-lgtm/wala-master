// src/services/walaOrders.js
//
// RED DE SEGURIDAD (ESPEJO) de los pedidos del Portal Web.
//
// PROBLEMA: el servidor crea cada pedido en `pedidos_web` (Cloud Functions: el
// checkout, el pago rápido y la landing). El ERP externo (aimunayerp.com), al aprobar el
// pedido, BORRA ese doc o le quita los marcadores de Portal Web. Como el portal
// NUNCA borra pedidos, ese pedido desaparecería de "Mis Pedidos"
// (misPedidosSecure en el servidor) y de "Recepción"
// (src/services/adminOrders.js, filtro esPedidoWala).
//
// SOLUCIÓN: el servidor guarda una COPIA propia del lado WALA en la colección
// `wala_pedidos`. Esta copia es nuestra y el ERP no la toca. Si el pedido
// original desaparece, la lectura del espejo lo recupera. Este módulo solo LEE
// el espejo (desde el 2026-10-16 el navegador ya no lo escribe: lo hacía el
// cuestionario de producto, que se retiró).
//
// Usa la MISMA instancia de Firestore del ERP (erpDb): wala_pedidos vive en el
// mismo proyecto que pedidos_web.

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from './firebase/observed.js';
import { erpDb, isErpFirestoreAvailable } from './erp/firebase';

/**
 * Colección donde vive la copia de seguridad de los pedidos del Portal Web.
 * Es propiedad del lado WALA: el ERP externo no la lee ni la borra.
 */
export const WALA_ORDERS_COLLECTION = 'wala_pedidos';

/* ────────────────────────────────────────────────────────────────────────────
 * ESTADO de WALA (fuente de verdad)
 *
 * wala_pedidos lleva SU PROPIO estado (estadoWala) independiente del ERP. Lo
 * escribe solo el servidor (Cloud Functions: el espejo al crear el pedido y
 * marcarWalaPedidoPagado al cobrar). Aquí, cómo se muestra.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Conjunto de estados válidos de wala_pedidos.estadoWala.
 * El flujo esperado es:
 *   pendiente_pago → pagado → en_preparacion → enviado → entregado
 * con `cancelado` como estado terminal alterno. (La validación NO es estricta:
 * se acepta cualquier estado pasado; este set es de referencia/documentación.)
 */
export const ESTADOS_WALA = Object.freeze([
  'pendiente_pago',
  'pagado',
  'en_preparacion',
  'enviado',
  'entregado',
  'cancelado',
]);

/**
 * Mapea un estadoWala a su representación de UI (etiqueta, color y paso del flujo).
 * Reutilizable por cualquier vista (Mis Compras, Recepción, detalle de pedido).
 *
 * `paso` ubica el estado en la línea de tiempo principal
 * (pendiente_pago=0 … entregado=4); `cancelado` usa paso -1 (fuera de línea).
 * `color` es un nombre/semáforo neutro que la UI puede mapear a su paleta.
 *
 * @param {string} estadoWala
 * @returns {{ label: string, color: string, paso: number }}
 */
export function estadoWalaADisplay(estadoWala) {
  const mapa = {
    pendiente_pago: { label: 'Pendiente de pago', color: 'warning', paso: 0 },
    pagado: { label: 'Pagado', color: 'info', paso: 1 },
    en_preparacion: { label: 'En preparación', color: 'info', paso: 2 },
    enviado: { label: 'Enviado', color: 'primary', paso: 3 },
    entregado: { label: 'Entregado', color: 'success', paso: 4 },
    cancelado: { label: 'Cancelado', color: 'danger', paso: -1 },
  };
  return mapa[estadoWala] || { label: 'Pendiente de pago', color: 'warning', paso: 0 };
}

/* ────────────────────────────────────────────────────────────────────────────
 * LECTURA del espejo
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Convierte un doc crudo del espejo a la forma que la UI de "Mis Compras" espera
 * (la misma que un doc crudo del ERP: con `id` y nombres
 * de campo ERP que luego pasa por normalizarPedidoParaVista). Marca _fromMirror.
 */
export function normalizarEspejoParaVista(docId, data) {
  const d = data && typeof data === 'object' ? data : {};
  return {
    id: docId,
    // Claves de negocio (las usa getCodigoPedido / dedup de la vista)
    numeroPedido: d.numeroPedido ?? null,
    portalPseudoOrderId: d.portalPseudoOrderId ?? d.numeroPedido ?? null,
    pedidoWebId: d.pedidoWebId ?? null,
    // Cliente (nombres de campo ERP que lee normalizarPedidoParaVista)
    clienteNombreCompleto: d.clienteNombreCompleto ?? null,
    clienteNumeroDocumento: d.clienteNumeroDocumento ?? null,
    dni: d.dni ?? null,
    dniRaw: d.dniRaw ?? null,
    buyerUid: d.buyerUid ?? null,
    // Productos (formato array, compatible con getProductosPedido).
    // Las líneas nuevas ya traen urlImagen/urlImagenPersonalizada/textoPersonalizado/
    // designId (ver resumirProductos) y pasan tal cual a la vista.
    productos: Array.isArray(d.productos) ? d.productos : [],
    // Contexto de regalo (ADITIVO; solo los espejos nuevos lo traen)
    ...(d.giftDetails != null && { giftDetails: d.giftDetails }),
    ...(d.deliveryDate != null && { deliveryDate: d.deliveryDate }),
    // Montos display
    montoTotal: d.montoTotal ?? null,
    moneda: d.moneda ?? 'PEN',
    // Origen / estado (sin etapa avanzada → la vista lo verá "por confirmar")
    canalVenta: d.canalVenta ?? 'Portal Web',
    web: d.web === true,
    fuente: d.fuente ?? 'wala-mirror',
    createdAt: d.createdAt ?? null,
    // ── ESTADO PROPIO DE WALA (fuente de verdad) ───────────────────────────────
    // Se expone a la vista para que muestre el estado que vive en wala_pedidos,
    // independientemente del doc del ERP. Default seguro "pendiente_pago" para
    // espejos antiguos que aún no tienen el campo.
    estadoWala: d.estadoWala ?? 'pendiente_pago',
    pagado: d.pagado === true,
    pagadoAt: d.pagadoAt ?? null,
    metodoPago: d.metodoPago ?? null,
    estadoWalaUpdatedAt: d.estadoWalaUpdatedAt ?? null,
    // Marca de procedencia: la UI puede distinguir copias de seguridad.
    _fromMirror: true,
  };
}

/**
 * Límite por defecto de copias-espejo a leer para el admin (orden desc por fecha).
 * Conservador, alineado con LIMIT_DEFAULT de adminOrders.js (200) y la nota del
 * repo sobre cuotas de Firestore.
 */
const ADMIN_MIRROR_LIMIT_DEFAULT = 200;

/**
 * Lee TODAS las copias-espejo de `wala_pedidos` (SIN filtro de usuario) para el
 * área admin "Recepción": la colección completa ordenada
 * por createdAt desc con un límite razonable.
 *
 * NUNCA lanza: ante error (o erpDb no disponible) devuelve lista vacía, para no
 * romper la lectura de Recepción (la red de seguridad es best-effort).
 *
 * @param {object} [params]
 * @param {number} [params.limitN=200] - Máximo de copias-espejo a traer.
 * @returns {Promise<Array<object>>} Copias normalizadas con _fromMirror:true.
 */
export async function getAllWalaMirrorOrders({ limitN = ADMIN_MIRROR_LIMIT_DEFAULT } = {}) {
  if (!isErpFirestoreAvailable()) return [];

  const coll = collection(erpDb, WALA_ORDERS_COLLECTION);

  let docs = [];
  try {
    // Camino preferente: ordenado por fecha desc + límite (no requiere índice
    // compuesto: orderBy de un solo campo).
    const snap = await getDocs(query(coll, orderBy('createdAt', 'desc'), limit(limitN)));
    docs = snap.docs;
  } catch (error) {
    // Fallback: si el orderBy fallara (p.ej. docs sin createdAt), leemos sin
    // ordenar con límite y ordenamos en memoria más abajo no es necesario aquí
    // porque el merge del admin reordena por fecha de todos modos.
    console.warn('[walaOrders] getAllWalaMirrorOrders orderBy falló, fallback simple:', error?.message);
    try {
      const snap = await getDocs(query(coll, limit(limitN)));
      docs = snap.docs;
    } catch (error2) {
      console.warn('[walaOrders] getAllWalaMirrorOrders también falló:', error2?.message);
      return [];
    }
  }

  return docs.map((dDoc) => normalizarEspejoParaVista(dDoc.id, dDoc.data()));
}
