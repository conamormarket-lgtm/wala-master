import { useState, useCallback } from 'react';
import { isErpConfigured } from '../config/erp';
import {
  sendOrderToERP,
  getOrderStatus,
  searchOrdersByCustomer,
  syncCustomerData,
  getProductInventory,
  checkErpHealth,
} from '../services/erp/integration';

/**
 * Hook para interactuar con la API del ERP desde componentes.
 * @returns {Object} Funciones y estado para consultas al ERP
 */
export function useERP() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const configured = isErpConfigured();

  const sendOrder = useCallback(async (orderData, firebaseOrderId = null) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sendOrderToERP(orderData, firebaseOrderId);
      if (result.error) setError(result.error);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrderStatus = useCallback(async (orderId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOrderStatus(orderId);
      if (result.error) setError(result.error);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchOrders = useCallback(async (telefono, dni) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchOrdersByCustomer(telefono, dni);
      if (result.error) setError(result.error);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncCustomer = useCallback(async (dni, phone, extra = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await syncCustomerData(dni, phone, extra);
      if (result.error) setError(result.error);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProductInventory = useCallback(async (productId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getProductInventory(productId);
      if (result.error) setError(result.error);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const healthCheck = useCallback(async () => {
    setError(null);
    return checkErpHealth();
  }, []);

  return {
    isConfigured: configured,
    loading,
    error,
    clearError: () => setError(null),
    sendOrder,
    getOrderStatus: fetchOrderStatus,
    searchOrders,
    syncCustomer,
    getProductInventory: fetchProductInventory,
    checkHealth: healthCheck,
  };
}

export default useERP;
