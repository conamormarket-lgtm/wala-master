/**
 * Encabezados (campos) del ERP para documentos de pedidos.
 * Fuente de verdad para mapeo: consultar aquí al implementar o mantener.
 * En pedidos.js se usan solo los necesarios para la vista del portal.
 */

export const ERP_PEDIDOS_HEADERS = {
  activador: 'Qué activador se usó',
  agenciaEnvio: 'Agencia de envío',
  añadidos: 'Productos añadidos',
  canalVenta: 'Publicación de origen',
  cantidad: 'Cantidad de productos',

  clienteApellidos: 'Apellidos',
  clienteContacto: 'Teléfono',
  clienteContactoSecundario: 'Teléfono secundario',
  clienteCorreo: 'Correo',
  clienteDepartamento: 'Departamento',
  clienteDistrito: 'Distrito',
  clienteNombre: 'Nombre',
  clienteNumeroDocumento: 'Número de documento',
  clienteProvincia: 'Si es de provincia o no',
  clienteTipoDocumento: 'Tipo de documento',

  impresion: 'Map: estado, fechaSalida, pago1, pago2',
  createdAt: 'Fecha de venta',

  diseño: 'Map: diseñadorAsignado, estadofechaEntrada, fechaSalida, urlImagen',

  empaquetado: 'Map: estado, fechaEntrada, fechaSalida, operador',

  envioApellidos: 'Apellidos de envío',
  envioContacto: 'Teléfono de envío',
  envioDepartamento: 'Departamento de envío',
  envioDireccion: 'Dirección de envío',
  envioDistrito: 'Distrito de envío',
  envioNombres: 'Nombres de envío',
  envioNumeroDocumento: 'Número de documento de envío',
  envioProvincia: 'Provincia de envío',
  envioTipoDocumento: 'Tipo de documento de envío',

  esMostacero: 'Si es mostacero o no',
  esPersonalizado: 'Si el pedido es personalizado o no',
  esPrioridad: 'Si el pedido es prioridad o no',
  estadoGeneral: 'Estado general del pedido',
  estampado: 'Map: estado, fechaEntrada, fechaSalida, operador',
  fechaEnvio: 'Fecha de envío',
  historialModificaciones: 'Historial de modificaciones',
  id: 'Id del pedido',
  importado: 'Si es importado o no',
  lineaProducto: 'Línea de producto',

  montoAdelanto: 'Monto adelantado',
  montoMostacero: 'Monto adelantado de mostacero',
  montoPendiente: 'Monto pendiente',
  montoTotal: 'Monto total',

  observación: 'Observaciones',
  prendas: 'Prendas, colores y tallas (ej. "Polera RosadoFuerte/Celeste (M) - ...")',

  preparación: 'Map: estado, fechaEntrada, fechaSalida, operador',
  productos: 'Map: cantidad, producto, productoId',
  reparto: 'Map: estado, fechaEntrada, fechaFinalizado, fechaSalida, repartidor',

  status: 'Estado del pedido',
  tiempos: 'Map: impresion, diseño, empaquetado, estampado, preparacion, reparto, total',
  vendedor: 'Vendedor',
  whatsappOrigen: 'WhatsApp en el que se realizó la venta',
};

export default ERP_PEDIDOS_HEADERS;
