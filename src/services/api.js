import { API_BASE_URL } from '../utils/constants';

/**
 * Busca pedidos de un cliente por teléfono y DNI
 * @param {string} telefono - Número de teléfono del cliente
 * @param {string} dni - Número de DNI del cliente
 * @returns {Promise<Object>} Respuesta con pedidos o error
 */
export const buscarPedidoCliente = async (telefono, dni) => {
  try {
    const response = await fetch(`${API_BASE_URL}/pedidos/buscar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ telefono, dni }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(error.message || 'Error de conexión. Inténtalo de nuevo.');
  }
};
