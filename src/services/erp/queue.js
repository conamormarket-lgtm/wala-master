import { erpConfig, isErpConfigured } from '../../config/erp';
import { sendOrderToERP } from './integration';

const STORAGE_KEY = 'erp_sync_queue';
const MAX_ATTEMPTS = erpConfig.maxRetries;
const RETRY_DELAY = erpConfig.retryDelay;

/**
 * Obtiene la cola de sincronización desde localStorage.
 * @returns {Array<{ firebaseOrderId: string, orderData: Object, attempts: number, lastError?: string }>}
 */
function getQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Guarda la cola en localStorage.
 * @param {Array} queue
 */
function saveQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('No se pudo guardar la cola ERP:', e);
  }
}

/**
 * Añade un pedido a la cola para reintentos.
 * @param {string} firebaseOrderId
 * @param {Object} orderData - Objeto pedido tal como se envía al ERP
 */
export function enqueueOrder(firebaseOrderId, orderData) {
  const queue = getQueue();
  if (queue.some((item) => item.firebaseOrderId === firebaseOrderId)) {
    return;
  }
  queue.push({
    firebaseOrderId,
    orderData,
    attempts: 0,
    addedAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

/**
 * Elimina un pedido de la cola.
 * @param {string} firebaseOrderId
 */
export function removeFromQueue(firebaseOrderId) {
  const queue = getQueue().filter((item) => item.firebaseOrderId !== firebaseOrderId);
  saveQueue(queue);
}

/**
 * Procesa un elemento de la cola: envía al ERP y actualiza o elimina de la cola.
 * @param {Object} item - { firebaseOrderId, orderData, attempts }
 * @param {Function} onSuccess - (erpOrderId) => void
 * @param {Function} onUpdateFirebase - (firebaseOrderId, { erpOrderId, status, syncedAt }) => Promise<void>
 * @returns {Promise<{ success: boolean, erpOrderId?: string, error?: string }>}
 */
export async function processQueueItem(item, onSuccess, onUpdateFirebase) {
  const { firebaseOrderId, orderData, attempts } = item;

  if (!isErpConfigured()) {
    return { success: false, error: 'ERP no configurado' };
  }

  if (attempts >= MAX_ATTEMPTS) {
    removeFromQueue(firebaseOrderId);
    return { success: false, error: 'Máximo de reintentos alcanzado' };
  }

  const { erpOrderId, error } = await sendOrderToERP(orderData, firebaseOrderId);

  if (error) {
    const queue = getQueue();
    const updated = queue.map((i) =>
      i.firebaseOrderId === firebaseOrderId
        ? { ...i, attempts: i.attempts + 1, lastError: error }
        : i
    );
    saveQueue(updated);
    return { success: false, error };
  }

  removeFromQueue(firebaseOrderId);
  if (onSuccess) onSuccess(erpOrderId);
  if (onUpdateFirebase && typeof onUpdateFirebase === 'function') {
    try {
      await onUpdateFirebase(firebaseOrderId, {
        erpOrderId,
        status: 'synced',
        syncedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Error al actualizar pedido en Firebase tras sync ERP:', e);
    }
  }
  return { success: true, erpOrderId };
}

/**
 * Procesa toda la cola (un intento por elemento).
 * @param {Function} [onSuccess] - (firebaseOrderId, erpOrderId) => void
 * @param {Function} [onUpdateFirebase] - (firebaseOrderId, update) => Promise<void>
 * @returns {Promise<{ processed: number, succeeded: number, failed: number }>}
 */
export async function processQueue(onSuccess, onUpdateFirebase) {
  const queue = getQueue();
  let succeeded = 0;
  let failed = 0;

  for (const item of queue) {
    const result = await processQueueItem(item, (erpOrderId) => {
      if (onSuccess) onSuccess(item.firebaseOrderId, erpOrderId);
    }, onUpdateFirebase);

    if (result.success) succeeded++;
    else failed++;

    if (queue.length > 1 && RETRY_DELAY > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }

  return {
    processed: queue.length,
    succeeded,
    failed,
  };
}

/**
 * Devuelve los pedidos pendientes de sincronizar.
 * @returns {Array<{ firebaseOrderId: string, attempts: number, lastError?: string }>}
 */
export function getPendingOrders() {
  return getQueue().map(({ firebaseOrderId, attempts, lastError }) => ({
    firebaseOrderId,
    attempts,
    lastError,
  }));
}
