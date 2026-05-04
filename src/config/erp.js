/**
 * Configuración de la API del ERP.
 * Fuente única de verdad para pedidos, clientes e inventario.
 */

const ERP_BASE_URL = process.env.REACT_APP_ERP_API_URL || '';
const ERP_API_KEY = process.env.REACT_APP_ERP_API_KEY || '';
const ERP_TIMEOUT_MS = Number(process.env.REACT_APP_ERP_TIMEOUT_MS) || 15000;
const ERP_MAX_RETRIES = Number(process.env.REACT_APP_ERP_MAX_RETRIES) || 3;
const ERP_RETRY_DELAY_MS = Number(process.env.REACT_APP_ERP_RETRY_DELAY_MS) || 2000;

export const erpConfig = {
  baseUrl: ERP_BASE_URL.replace(/\/$/, ''),
  apiKey: ERP_API_KEY,
  timeout: ERP_TIMEOUT_MS,
  maxRetries: ERP_MAX_RETRIES,
  retryDelay: ERP_RETRY_DELAY_MS,

  endpoints: {
    orders: '/orders',
    orderById: (id) => `/orders/${id}`,
    orderSearch: '/orders/search',
    customers: '/customers',
    customerByDni: (dni) => `/customers/dni/${dni}`,
    inventory: '/inventory',
    productStock: (productId) => `/inventory/products/${productId}`,
    health: '/health',
  },
};

export const isErpConfigured = () => Boolean(ERP_BASE_URL && ERP_BASE_URL !== '');

export default erpConfig;
