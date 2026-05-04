import { erpConfig, isErpConfigured } from '../../config/erp';

/**
 * Realiza una petición a la API del ERP con timeout y headers.
 * @param {string} path - Ruta del endpoint (sin baseUrl)
 * @param {RequestInit} options - Opciones de fetch
 * @returns {Promise<Response>}
 */
async function erpFetch(path, options = {}) {
  if (!isErpConfigured()) {
    throw new Error('ERP no está configurado. Configura REACT_APP_ERP_API_URL en .env');
  }

  const url = `${erpConfig.baseUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), erpConfig.timeout);

  const headers = {
    'Content-Type': 'application/json',
    ...(erpConfig.apiKey && { 'X-API-Key': erpConfig.apiKey }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('La solicitud al ERP tardó demasiado. Inténtalo de nuevo.');
    }
    throw err;
  }
}

/**
 * Envía un pedido confirmado al ERP.
 * @param {Object} orderData - Datos del pedido (compatible con el objeto que crea CheckoutPage)
 * @param {string} [firebaseOrderId] - ID del pedido en Firebase para referencia
 * @returns {Promise<{ erpOrderId: string | null, error: string | null }>}
 */
export async function sendOrderToERP(orderData, firebaseOrderId = null) {
  if (!isErpConfigured()) {
    return { erpOrderId: null, error: 'ERP no configurado' };
  }

  const payload = {
    firebaseOrderId: firebaseOrderId || undefined,
    userId: orderData.userId,
    dni: orderData.dni,
    phone: orderData.phone,
    customerName: orderData.customerName,
    email: orderData.email,
    items: orderData.items,
    total: orderData.total,
    status: orderData.status || 'Pendiente',
    shippingAddress: orderData.shippingAddress,
    timeline: orderData.timeline,
  };

  try {
    const response = await erpFetch(erpConfig.endpoints.orders, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.message || errorBody.error || `Error ${response.status}`;
      return { erpOrderId: null, error: message };
    }

    const data = await response.json();
    const erpOrderId = data.id || data.orderId || data.data?.id || null;
    return { erpOrderId, error: null };
  } catch (err) {
    return {
      erpOrderId: null,
      error: err.message || 'Error al enviar pedido al ERP',
    };
  }
}

/**
 * Consulta el estado de un pedido en el ERP.
 * @param {string} orderId - ID del pedido (puede ser ID ERP o ID Firebase si el ERP lo acepta)
 * @returns {Promise<{ data: Object | null, error: string | null }>}
 */
export async function getOrderStatus(orderId) {
  if (!isErpConfigured()) {
    return { data: null, error: 'ERP no configurado' };
  }

  try {
    const path = typeof erpConfig.endpoints.orderById === 'function'
      ? erpConfig.endpoints.orderById(orderId)
      : `${erpConfig.endpoints.orders}/${orderId}`;
    const response = await erpFetch(path, { method: 'GET' });

    if (response.status === 404) {
      return { data: null, error: 'Pedido no encontrado en el ERP' };
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorBody.message || errorBody.error || `Error ${response.status}`,
      };
    }

    const data = await response.json();
    return { data: data.data || data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err.message || 'Error al consultar estado en el ERP',
    };
  }
}

/**
 * Busca pedidos de un cliente por DNI y teléfono en el ERP.
 * @param {string} telefono
 * @param {string} dni
 * @returns {Promise<{ data: Array | null, error: string | null }>}
 */
export async function searchOrdersByCustomer(telefono, dni) {
  if (!isErpConfigured()) {
    return { data: null, error: 'ERP no configurado' };
  }

  try {
    const response = await erpFetch(erpConfig.endpoints.orderSearch, {
      method: 'POST',
      body: JSON.stringify({ telefono, dni }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorBody.message || errorBody.error || `Error ${response.status}`,
      };
    }

    const data = await response.json();
    const pedidos = data.pedidos ?? data.orders ?? data.data ?? data;
    const list = Array.isArray(pedidos) ? pedidos : [];
    return { data: list, error: null };
  } catch (err) {
    return {
      data: null,
      error: err.message || 'Error al buscar pedidos en el ERP',
    };
  }
}

/**
 * Sincroniza datos de cliente con el ERP (crear o actualizar).
 * @param {string} dni
 * @param {string} phone
 * @param {Object} [extra] - Campos adicionales (nombre, email, etc.)
 * @returns {Promise<{ data: Object | null, error: string | null }>}
 */
export async function syncCustomerData(dni, phone, extra = {}) {
  if (!isErpConfigured()) {
    return { data: null, error: 'ERP no configurado' };
  }

  const path = typeof erpConfig.endpoints.customerByDni === 'function'
    ? erpConfig.endpoints.customerByDni(dni)
    : `${erpConfig.endpoints.customers}/dni/${dni}`;

  try {
    const body = { dni, phone, ...extra };
    const response = await erpFetch(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorBody.message || errorBody.error || `Error ${response.status}`,
      };
    }

    const data = await response.json();
    return { data: data.data || data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err.message || 'Error al sincronizar cliente con el ERP',
    };
  }
}

/**
 * Consulta stock de un producto en el ERP.
 * @param {string} productId
 * @returns {Promise<{ data: Object | null, error: string | null }>}
 */
export async function getProductInventory(productId) {
  if (!isErpConfigured()) {
    return { data: null, error: 'ERP no configurado' };
  }

  const path = typeof erpConfig.endpoints.productStock === 'function'
    ? erpConfig.endpoints.productStock(productId)
    : `${erpConfig.endpoints.inventory}/products/${productId}`;

  try {
    const response = await erpFetch(path, { method: 'GET' });

    if (response.status === 404) {
      return { data: null, error: 'Producto no encontrado en el ERP' };
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorBody.message || errorBody.error || `Error ${response.status}`,
      };
    }

    const data = await response.json();
    return { data: data.data || data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err.message || 'Error al consultar inventario en el ERP',
    };
  }
}

/**
 * Comprueba si el ERP está disponible (health check).
 * @returns {Promise<boolean>}
 */
export async function checkErpHealth() {
  if (!isErpConfigured()) return false;
  try {
    const path = erpConfig.endpoints.health || '/health';
    const response = await erpFetch(path, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}
