// Datos de prueba para el backend mock

// Usuarios de prueba con sus credenciales
const usuarios = [
  {
    telefono: '999888777',
    dni: '12345678',
    nombreCliente: 'Juan Pérez'
  },
  {
    telefono: '987654321',
    dni: '87654321',
    nombreCliente: 'María García'
  }
];

// Pedidos de prueba
const pedidos = [
  // Pedidos de Juan Pérez
  {
    id: 'PED-001',
    nombreCliente: 'Juan Pérez',
    telefono: '999888777',
    dni: '12345678',
    direccion: 'Av. Principal 123, Lima',
    fechaCompra: '15/01/2024',
    tallas: 'M, L, XL',
    montoAdelantado: '150.00',
    montoTotal: '450.00',
    estado: 'En Reparto',
    imageURLs: [
      'https://via.placeholder.com/400x400?text=Diseño+1',
      'https://via.placeholder.com/400x400?text=Diseño+2',
      'https://via.placeholder.com/400x400?text=Diseño+3'
    ],
    fechas: {
      compra: '15/01/2024',
      diseno: '16/01/2024',
      cobranza: '18/01/2024',
      preparacion: '20/01/2024',
      estampado: '22/01/2024',
      empaquetado: '24/01/2024',
      reparto: '25/01/2024',
      finalizado: null
    }
  },
  {
    id: 'PED-002',
    nombreCliente: 'Juan Pérez',
    telefono: '999888777',
    dni: '12345678',
    direccion: 'Jr. Los Olivos 456, San Juan de Lurigancho',
    fechaCompra: '10/02/2024',
    tallas: 'S, M',
    montoAdelantado: '80.00',
    montoTotal: '280.00',
    estado: 'En Preparación',
    imageURLs: [
      'https://via.placeholder.com/400x400?text=Diseño+A',
      'https://via.placeholder.com/400x400?text=Diseño+B'
    ],
    fechas: {
      compra: '10/02/2024',
      diseno: '11/02/2024',
      cobranza: '12/02/2024',
      preparacion: null,
      estampado: null,
      empaquetado: null,
      reparto: null,
      finalizado: null
    }
  },
  // Pedidos de María García
  {
    id: 'PED-003',
    nombreCliente: 'María García',
    telefono: '987654321',
    dni: '87654321',
    direccion: 'Calle Las Flores 789, Miraflores',
    fechaCompra: '05/02/2024',
    tallas: 'XS, S, M, L',
    montoAdelantado: '200.00',
    montoTotal: '650.00',
    estado: 'Finalizado',
    imageURLs: [
      'https://via.placeholder.com/400x400?text=Diseño+X',
      'https://via.placeholder.com/400x400?text=Diseño+Y',
      'https://via.placeholder.com/400x400?text=Diseño+Z',
      'https://via.placeholder.com/400x400?text=Diseño+W'
    ],
    fechas: {
      compra: '05/02/2024',
      diseno: '06/02/2024',
      cobranza: '07/02/2024',
      preparacion: '08/02/2024',
      estampado: '10/02/2024',
      empaquetado: '12/02/2024',
      reparto: '14/02/2024',
      finalizado: '15/02/2024'
    }
  },
  // Pedido adicional para Juan Pérez - Pendiente
  {
    id: 'PED-004',
    nombreCliente: 'Juan Pérez',
    telefono: '999888777',
    dni: '12345678',
    direccion: 'Av. Principal 123, Lima',
    fechaCompra: '28/02/2024',
    tallas: 'L, XL, XXL',
    montoAdelantado: '100.00',
    montoTotal: '380.00',
    estado: 'Pendiente',
    imageURLs: [
      'https://via.placeholder.com/400x400?text=Diseño+Nuevo'
    ],
    fechas: {
      compra: '28/02/2024',
      diseno: null,
      cobranza: null,
      preparacion: null,
      estampado: null,
      empaquetado: null,
      reparto: null,
      finalizado: null
    }
  }
];

/**
 * Busca pedidos de un cliente por teléfono y DNI
 * @param {string} telefono - Número de teléfono
 * @param {string} dni - Número de DNI
 * @returns {Array} Array de pedidos del cliente o null si no existe
 */
function buscarPedidosPorCliente(telefono, dni) {
  // Verificar si el usuario existe
  const usuario = usuarios.find(
    u => u.telefono === telefono && u.dni === dni
  );

  if (!usuario) {
    return null;
  }

  // Buscar todos los pedidos del cliente
  const pedidosCliente = pedidos.filter(
    p => p.telefono === telefono && p.dni === dni
  );

  return pedidosCliente;
}

module.exports = {
  usuarios,
  pedidos,
  buscarPedidosPorCliente
};
