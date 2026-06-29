// src/services/walaOrders.js
//
// RED DE SEGURIDAD (ESPEJO) de los pedidos del Portal Web.
//
// PROBLEMA: el portal crea cada pedido en `pedidos_web` (createWebOrder, en
// src/services/erp/firebase.js). El ERP externo (aimunayerp.com), al aprobar el
// pedido, BORRA ese doc o le quita los marcadores de Portal Web. Como el portal
// NUNCA borra pedidos, ese pedido desaparece de "Mis Compras"
// (searchOrdersByDniInERP, filtra por DNI exacto) y de "Recepción"
// (src/services/adminOrders.js, filtro esPedidoWala).
//
// SOLUCIÓN: aquí guardamos una COPIA propia del lado WALA en la colección
// `wala_pedidos`. Esta copia es nuestra y el ERP no la toca. Si el pedido
// original desaparece, la lectura del espejo (getWalaMirrorOrders) lo recupera.
//
// REGLAS DURAS de este módulo:
//   - El espejo es BEST-EFFORT: su escritura va siempre en try/catch del lado
//     del llamador y JAMÁS debe hacer fallar ni demorar la creación del pedido.
//   - NO se toca lógica de pagos/totales: solo copiamos campos display ya
//     calculados (montoTotal, etc.). NO se guardan secretos de pago.
//   - Idempotente: doc id estable (numeroPedido) + setDoc({ merge: true }).
//
// Usa la MISMA instancia de Firestore del ERP (erpDb) que createWebOrder, porque
// las reglas Firestore de producción están abiertas y así reusamos la conexión
// ya inicializada (mismo proyecto del ERP).

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { erpDb, isErpFirestoreAvailable } from './erp/firebase';

/**
 * Colección donde vive la copia de seguridad de los pedidos del Portal Web.
 * Es propiedad del lado WALA: el ERP externo no la lee ni la borra.
 */
export const WALA_ORDERS_COLLECTION = 'wala_pedidos';

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers puros internos (no exportados)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Normaliza un número de documento (DNI/CE) igual que erp/firebase.js:
 * trim + quita TODOS los espacios. Devuelve string (vacío si no hay valor).
 */
function normalizarDocumento(valor) {
  if (valor == null) return '';
  return String(valor).trim().replace(/\s/g, '');
}

/**
 * Sanea un valor para usarlo como ID de documento de Firestore.
 * Los doc id no pueden contener '/', y por seguridad evitamos también otros
 * caracteres problemáticos. Se conserva el valor "bonito" del numeroPedido en el
 * campo `numeroPedido` del doc; esto es solo para la CLAVE.
 */
function sanearDocId(valor) {
  if (valor == null) return '';
  return String(valor)
    .trim()
    .replace(/[/\\#?[\].]/g, '-') // caracteres no permitidos / reservados
    .replace(/\s+/g, '-');
}

/**
 * Devuelve las líneas de producto de un pedido como array, soportando tanto el
 * formato array como el formato mapa del ERP ({ item_0: {...}, item_1: {...} }).
 * (Mismo criterio que getProductosPedido de utils/estadoCompra.js, replicado
 * aquí para no acoplar el espejo a la capa de UI.)
 */
function productosComoArray(productos) {
  if (productos == null) return [];
  if (Array.isArray(productos)) return productos.filter(Boolean);
  if (typeof productos === 'object') return Object.values(productos).filter(Boolean);
  return [];
}

/**
 * Resume las líneas de producto a un array plano y LIGERO para el espejo.
 * Solo campos display: nada de imágenes pesadas ni datos de pago.
 */
function resumirProductos(productos) {
  const lineas = productosComoArray(productos);
  return lineas.map((l) => ({
    productoId: l?.productoId ?? null,
    nombre: l?.producto ?? l?.nombre ?? 'Producto',
    brandId: l?.brandId ?? null,
    cantidad: l?.cantidad ?? 1,
    talla: l?.talla ?? null,
    color: l?.color ?? null,
    precio: l?.precio ?? null,
    subtotal: l?.subtotal ?? null,
    personalizado: !!l?.personalizado,
  }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * ESCRITURA del espejo
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Construye el doc espejo a partir del payload YA NORMALIZADO del pedido y lo
 * escribe en `wala_pedidos` con setDoc({ merge: true }) (idempotente).
 *
 * BEST-EFFORT: el llamador (createWebOrder) DEBE envolver esta llamada en
 * try/catch y nunca re-lanzar. Aun así, aquí también validamos disponibilidad y
 * no lanzamos por validaciones triviales.
 *
 * @param {object}  params
 * @param {string}  params.pedidoWebId - docId que devolvió el addDoc a `pedidos_web`.
 * @param {object}  params.payload     - Payload normalizado del pedido (webOrderPayload).
 * @returns {Promise<{ id: string|null, error: string|null }>}
 */
export async function mirrorWebOrder({ pedidoWebId, payload }) {
  if (!isErpFirestoreAvailable()) {
    return { id: null, error: 'Firestore del ERP no está disponible' };
  }

  const datos = payload && typeof payload === 'object' ? payload : {};

  // ── Documento (DNI/CE) con sus variantes para que la lectura case ──────────
  // dniRaw: valor original tecleado; clienteNumeroDocumento/dni: ya normalizado
  // por createWebOrder. Si el espejo se llamara con un payload sin normalizar,
  // normalizamos aquí de forma idéntica a erp/firebase.js.
  const dniRaw =
    datos.dniRaw != null
      ? datos.dniRaw
      : (datos.clienteNumeroDocumento ?? datos.dni ?? '');
  const dniNorm = normalizarDocumento(datos.clienteNumeroDocumento ?? datos.dni ?? dniRaw);

  // ── Identidad del comprador autenticado ────────────────────────────────────
  // El checkout (CheckoutPage.jsx:750) mete userId solo si hay usuario logueado.
  const buyerUid = datos.buyerUid ?? datos.userId ?? null;

  // ── Clave estable e idempotente del espejo ─────────────────────────────────
  // numeroPedido es el código de negocio del portal (pseudoOrderId); si faltara,
  // caemos al docId de pedidos_web. Saneado para ser un doc id válido.
  const numeroPedido = datos.numeroPedido ?? null;
  const idCrudo = numeroPedido || pedidoWebId;
  const id = sanearDocId(idCrudo);
  if (!id) {
    return { id: null, error: 'No se pudo determinar un id para el espejo' };
  }

  // ── Doc espejo: SOLO campos display + claves de búsqueda. NADA de pagos ─────
  const espejo = {
    // Claves de identidad / búsqueda
    numeroPedido: numeroPedido ?? null,
    portalPseudoOrderId: datos.portalPseudoOrderId ?? numeroPedido ?? null,
    pedidoWebId: pedidoWebId ?? null,
    buyerUid, // = userId del checkout (CheckoutPage.jsx:750)

    // Documento del cliente (normalizado + crudo) para casar en la lectura
    dni: dniNorm || null,
    dniRaw: dniRaw || null,
    clienteNumeroDocumento: dniNorm || null,

    // Datos display del cliente
    clienteNombreCompleto:
      datos.clienteNombreCompleto ?? datos.customerName ?? datos.nombreCliente ?? null,

    // Productos resumidos (ligeros, sin imágenes pesadas)
    productos: resumirProductos(datos.productos),

    // Montos display (NO se recalcula nada; se copia el total ya calculado)
    montoTotal: datos.montoTotal ?? datos.total ?? null,
    moneda: datos.moneda ?? datos.currency ?? 'PEN',

    // Marcadores de origen WALA (para que esPedidoWala y la vista lo reconozcan)
    canalVenta: 'Portal Web',
    web: true,

    // ── ESTADO PROPIO DE WALA (fuente de verdad independiente del ERP) ──────────
    // Al CREAR el pedido siempre nace como "pendiente_pago" (todavía no pagado).
    // El pago (Culqi/PayPal) lo moverá a "pagado" vía markWalaOrderPagado, y el
    // ERP (fase aparte, vía API con API key) podrá avanzarlo a en_preparacion/
    // enviado/entregado/cancelado vía updateWalaOrderEstado. Estos campos son
    // ADITIVOS: no tocan la lógica de pagos/totales del checkout.
    // NOTA: con setDoc({ merge:true }) y doc id estable, si el espejo ya existía
    // (reintento idempotente) NO se pisa un estado más avanzado de forma
    // destructiva intencional; igualmente el flujo normal crea el espejo una vez.
    estadoWala: 'pendiente_pago',
    pagado: false,

    // Metadatos del espejo
    createdAt: serverTimestamp(),
    fuente: 'wala-mirror',
  };

  try {
    const ref = doc(erpDb, WALA_ORDERS_COLLECTION, id);
    // NO-DESTRUCTIVO respecto al estado/pago: si el espejo YA existe (reintento,
    // backfill o re-mirror del mismo numeroPedido), NO pisamos su estadoWala/
    // pagado —podría estar ya 'pagado' o más avanzado— ni su createdAt original.
    // Solo refrescamos los campos display/clave. Si es nuevo, nace 'pendiente_pago'.
    let payload = espejo;
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const { estadoWala: _e, pagado: _p, createdAt: _c, ...soloDisplay } = espejo;
        payload = soloDisplay;
      }
    } catch {
      // Si la lectura previa falla, seguimos con el merge normal (best-effort).
    }
    await setDoc(ref, payload, { merge: true });
    return { id, error: null };
  } catch (error) {
    // No re-lanzamos: el espejo es best-effort. Devolvemos el error para que el
    // llamador pueda hacer console.warn si quiere.
    return { id: null, error: error?.message || 'Error al escribir el espejo' };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * ESTADO de WALA (fuente de verdad) — actualización del espejo
 *
 * wala_pedidos lleva SU PROPIO estado (estadoWala) independiente del ERP. Estas
 * funciones lo actualizan de forma IDEMPOTENTE y BEST-EFFORT (try/catch interno,
 * NUNCA lanzan). Son ADITIVAS: NO tocan la lógica de pagos/totales del checkout;
 * el llamador (Culqi/PayPal) las invoca ADEMÁS de marcar pedidos_web como hoy.
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
 * Localiza el doc de wala_pedidos para un pedido dado.
 *
 * Estrategia:
 *   1) Por id directo = sanearDocId(numeroPedido) (la clave estable del espejo).
 *   2) Si no existe y hay pedidoWebId → query where("pedidoWebId","==",pedidoWebId).
 *
 * BEST-EFFORT: nunca lanza. Devuelve la referencia del doc encontrado (o, si no
 * existe pero hay numeroPedido, la referencia por id saneado para poder crearlo
 * vía setDoc{merge}), junto con un flag de si existía.
 *
 * @param {object} params
 * @param {string} [params.numeroPedido]
 * @param {string} [params.pedidoWebId]
 * @returns {Promise<{ ref: import('firebase/firestore').DocumentReference|null, existe: boolean }>}
 */
async function localizarDocWala({ numeroPedido, pedidoWebId } = {}) {
  const coll = collection(erpDb, WALA_ORDERS_COLLECTION);

  // 1) Por id estable saneado a partir del numeroPedido.
  const idSaneado = numeroPedido != null ? sanearDocId(numeroPedido) : '';
  if (idSaneado) {
    try {
      const ref = doc(erpDb, WALA_ORDERS_COLLECTION, idSaneado);
      const snap = await getDoc(ref);
      if (snap.exists()) return { ref, existe: true };
      // El doc por id no existe; recordamos la ref por si hay que crearlo (merge),
      // pero antes intentamos casar por pedidoWebId (puede existir con otra clave).
    } catch (error) {
      console.warn('[walaOrders] localizarDocWala getDoc por id falló:', error?.message);
    }
  }

  // 2) Por pedidoWebId (query de una sola condición → sin índice compuesto).
  if (pedidoWebId) {
    try {
      const snap = await getDocs(query(coll, where('pedidoWebId', '==', pedidoWebId), limit(1)));
      if (!snap.empty) {
        return { ref: snap.docs[0].ref, existe: true };
      }
    } catch (error) {
      console.warn('[walaOrders] localizarDocWala query por pedidoWebId falló:', error?.message);
    }
  }

  // No se encontró un doc existente. Si tenemos un id saneado, devolvemos esa ref
  // para que el llamador pueda crear el espejo con setDoc{merge} (idempotente).
  if (idSaneado) {
    return { ref: doc(erpDb, WALA_ORDERS_COLLECTION, idSaneado), existe: false };
  }
  return { ref: null, existe: false };
}

/**
 * Actualiza el estado propio (estadoWala) de un pedido en wala_pedidos.
 *
 * IDEMPOTENTE y BEST-EFFORT: nunca lanza. Si el doc ya existe hace updateDoc; si
 * no existe (pero hay numeroPedido para derivar la clave) hace setDoc{merge} para
 * dejarlo creado con el estado. Siempre sella estadoWalaUpdatedAt.
 *
 * @param {object} params
 * @param {string} [params.numeroPedido] - Código de negocio del portal (clave del espejo).
 * @param {string} [params.pedidoWebId]  - docId de pedidos_web (fallback de localización).
 * @param {string} params.estado         - Nuevo estadoWala (ver ESTADOS_WALA).
 * @param {object} [params.extra]        - Campos adicionales a fusionar (p.ej. tracking).
 * @returns {Promise<{ ok: boolean, id: string|null, error: string|null }>}
 */
export async function updateWalaOrderEstado({ numeroPedido, pedidoWebId, estado, extra } = {}) {
  if (!isErpFirestoreAvailable()) {
    return { ok: false, id: null, error: 'Firestore del ERP no está disponible' };
  }
  if (!estado || typeof estado !== 'string') {
    return { ok: false, id: null, error: 'estado requerido' };
  }

  try {
    const { ref, existe } = await localizarDocWala({ numeroPedido, pedidoWebId });
    if (!ref) {
      return { ok: false, id: null, error: 'No se pudo localizar el doc de wala_pedidos' };
    }

    const extraObj = extra && typeof extra === 'object' ? extra : {};
    const cambios = {
      estadoWala: estado,
      ...extraObj,
      estadoWalaUpdatedAt: serverTimestamp(),
    };

    if (existe) {
      // El doc ya existe: actualización parcial.
      await updateDoc(ref, cambios);
    } else {
      // No existía: lo creamos/fusionamos de forma idempotente. Añadimos un par
      // de marcadores mínimos para que la lectura lo reconozca como WALA.
      await setDoc(
        ref,
        {
          ...cambios,
          numeroPedido: numeroPedido ?? null,
          pedidoWebId: pedidoWebId ?? null,
          canalVenta: 'Portal Web',
          web: true,
          fuente: 'wala-mirror',
        },
        { merge: true },
      );
    }
    return { ok: true, id: ref.id, error: null };
  } catch (error) {
    // BEST-EFFORT: no re-lanzamos para no romper el flujo de pago/ERP.
    console.warn('[walaOrders] updateWalaOrderEstado falló:', error?.message);
    return { ok: false, id: null, error: error?.message || 'Error al actualizar estadoWala' };
  }
}

/**
 * Marca un pedido de wala_pedidos como PAGADO (estadoWala:"pagado", pagado:true).
 *
 * Pensada para llamarse DESPUÉS de que el pago (Culqi/PayPal) se confirma, ADEMÁS
 * de la marca actual en pedidos_web. ADITIVA, IDEMPOTENTE y BEST-EFFORT (nunca
 * lanza). NO recalcula montos: montoPagado es solo informativo para el espejo.
 *
 * @param {object} params
 * @param {string} [params.numeroPedido]
 * @param {string} [params.pedidoWebId]
 * @param {string} [params.metodoPago]   - 'culqi' | 'paypal' | etc. (informativo).
 * @param {number} [params.montoPagado]  - Monto cobrado (informativo, ya calculado).
 * @returns {Promise<{ ok: boolean, id: string|null, error: string|null }>}
 */
export async function markWalaOrderPagado({ numeroPedido, pedidoWebId, metodoPago, montoPagado } = {}) {
  // Reutiliza updateWalaOrderEstado para mantener una sola ruta de escritura.
  const extra = {
    pagado: true,
    pagadoAt: serverTimestamp(),
  };
  if (metodoPago != null) extra.metodoPago = metodoPago;
  if (montoPagado != null) extra.montoPagado = montoPagado;

  return updateWalaOrderEstado({
    numeroPedido,
    pedidoWebId,
    estado: 'pagado',
    extra,
  });
}

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
 * (misma que searchOrdersByDniInERP entrega: doc crudo del ERP con `id` y nombres
 * de campo ERP que luego pasa por normalizarPedidoParaVista). Marca _fromMirror.
 */
function normalizarEspejoParaVista(docId, data) {
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
    // Productos (formato array, compatible con getProductosPedido)
    productos: Array.isArray(d.productos) ? d.productos : [],
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
 * Lee la copia de seguridad de pedidos del Portal Web desde `wala_pedidos`.
 *
 * Estrategia de búsqueda (cada where es una sola condición → no requiere índice
 * compuesto; la unión y el dedup se hacen en memoria):
 *   1) Si hay userId → where("buyerUid", "==", userId).
 *   2) Si hay dni → where("clienteNumeroDocumento", "==", dniNorm) con fallbacks
 *      a where("dni", ...) y al valor CRUDO (dniRaw) por si difiere del normalizado.
 *
 * Une todos los resultados, deduplica por docId, normaliza cada pedido a la forma
 * que espera la UI (igual que searchOrdersByDniInERP) y lo marca _fromMirror:true.
 *
 * NUNCA lanza: ante error devuelve lista vacía (best-effort de red de seguridad).
 *
 * @param {object} params
 * @param {string} [params.userId] - UID del comprador autenticado (= buyerUid).
 * @param {string} [params.dni]    - Documento del cliente (DNI/CE).
 * @returns {Promise<Array<object>>} Pedidos normalizados con _fromMirror:true.
 */
export async function getWalaMirrorOrders({ userId, dni } = {}) {
  if (!isErpFirestoreAvailable()) return [];

  const coll = collection(erpDb, WALA_ORDERS_COLLECTION);

  // Acumulador por docId para deduplicar automáticamente las uniones.
  const porDocId = new Map();

  // Ejecuta una query y vuelca sus docs en el acumulador (best-effort por query:
  // si una falla, las demás siguen aportando resultados).
  const acumular = async (q) => {
    try {
      const snap = await getDocs(q);
      snap.docs.forEach((dDoc) => {
        if (!porDocId.has(dDoc.id)) porDocId.set(dDoc.id, dDoc.data());
      });
    } catch (error) {
      console.warn('[walaOrders] Falló una consulta del espejo:', error?.message);
    }
  };

  try {
    // 1) Por usuario autenticado (camino preferente y más exacto).
    if (userId) {
      await acumular(query(coll, where('buyerUid', '==', userId)));
    }

    // 2) Por documento (DNI/CE), con normalizado, alias `dni` y crudo de fallback.
    const dniRaw = dni != null ? String(dni) : '';
    const dniNorm = normalizarDocumento(dniRaw);
    if (dniNorm) {
      await acumular(query(coll, where('clienteNumeroDocumento', '==', dniNorm)));
      await acumular(query(coll, where('dni', '==', dniNorm)));
      // Fallback al valor CRUDO si difiere del normalizado (copias antiguas).
      if (dniRaw && dniRaw !== dniNorm) {
        await acumular(query(coll, where('clienteNumeroDocumento', '==', dniRaw)));
        await acumular(query(coll, where('dni', '==', dniRaw)));
        await acumular(query(coll, where('dniRaw', '==', dniRaw)));
      }
    }
  } catch (error) {
    console.warn('[walaOrders] Error al leer el espejo wala_pedidos:', error?.message);
    return [];
  }

  // Normaliza cada doc a la forma de la UI y devuelve marcado como copia.
  const pedidos = [];
  porDocId.forEach((data, docId) => {
    pedidos.push(normalizarEspejoParaVista(docId, data));
  });
  return pedidos;
}

/**
 * Límite por defecto de copias-espejo a leer para el admin (orden desc por fecha).
 * Conservador, alineado con LIMIT_DEFAULT de adminOrders.js (200) y la nota del
 * repo sobre cuotas de Firestore.
 */
const ADMIN_MIRROR_LIMIT_DEFAULT = 200;

/**
 * Lee TODAS las copias-espejo de `wala_pedidos` (SIN filtro de usuario) para el
 * área admin "Recepción". A diferencia de getWalaMirrorOrders (que filtra por
 * comprador/DNI para "Mis Compras"), aquí traemos la colección completa ordenada
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

export default getWalaMirrorOrders;
