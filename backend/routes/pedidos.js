const express = require('express');
const router = express.Router();
const { buscarPedidosPorCliente } = require('../data/mockData');

/**
 * POST /api/pedidos/buscar
 * Busca pedidos de un cliente por teléfono y DNI
 * 
 * Body:
 * {
 *   telefono: string,
 *   dni: string
 * }
 * 
 * Respuesta exitosa:
 * {
 *   pedidos: [...]
 * }
 * 
 * Respuesta error:
 * {
 *   error: "mensaje de error"
 * }
 */
router.post('/buscar', (req, res) => {
  try {
    const { telefono, dni } = req.body;

    // Validar que se proporcionen los datos requeridos
    if (!telefono || !dni) {
      return res.status(400).json({
        error: 'Teléfono y DNI son requeridos'
      });
    }

    // Buscar pedidos del cliente
    const pedidosCliente = buscarPedidosPorCliente(telefono, dni);

    // Si no se encuentra el usuario o no tiene pedidos
    if (!pedidosCliente || pedidosCliente.length === 0) {
      return res.status(404).json({
        error: 'No se encontraron pedidos para los datos proporcionados. Verifica tu teléfono y DNI.'
      });
    }

    // Retornar pedidos encontrados
    res.json({
      pedidos: pedidosCliente
    });
  } catch (error) {
    console.error('Error al buscar pedidos:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;
