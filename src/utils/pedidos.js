import { getQueueStage } from './constants';

/**
 * Nombres de campos del ERP usados en el portal (ver src/constants/erpPedidosHeaders.js para lista completa).
 * Prioridad: encabezados ERP oficiales primero, alias legacy después.
 */
const ERP_NOMBRE = [
  'clienteNombre', 'clienteApellidos', 'clienteNombreCompleto', 'nombreCompleto', 'customerName', 'nombreCliente', 'nombre'
];
const ERP_TELEFONO1 = ['clienteContacto', 'telefono1', 'numero1', 'phone', 'telefono', 'phone1'];
const ERP_TELEFONO2 = ['clienteContactoSecundario', 'telefono2', 'numero2', 'phone2'];
const ERP_CORREO = ['clienteCorreo', 'correo', 'email', 'correoElectronico'];
const ERP_PROVINCIA = ['clienteProvincia', 'provincia', 'province'];
const ERP_CIUDAD = ['clienteDepartamento', 'ciudad', 'city'];
const ERP_DISTRITO = ['clienteDistrito', 'distrito', 'district'];
/** Campos de envío (no del cliente) para la ficha del pedido */
const ERP_ENVIO_PROVINCIA = ['envioProvincia'];
const ERP_ENVIO_CIUDAD = ['envioDepartamento', 'envioCiudad'];
const ERP_ENVIO_DISTRITO = ['envioDistrito'];

function getFirst(pedido, keys) {
  if (!pedido || typeof pedido !== 'object') return undefined;
  for (const k of keys) {
    if (pedido[k] != null && pedido[k] !== '') return pedido[k];
  }
  return undefined;
}

/** Convierte un valor a URL string. Acepta string, array, u objeto con .url/.link */
function toSingleUrlString(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && val !== null && (val.url != null || val.link != null))
    return toSingleUrlString(val.url ?? val.link);
  return '';
}

/** Divide un string por espacios y devuelve array de URLs no vacías (el operador puede pegar "url1 url2 url3"). */
function splitUrlsBySpaces(s) {
  if (!s || typeof s !== 'string') return [];
  return s.trim().split(/\s+/).map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Recoge todas las URLs de imagen de diseño desde un pedido y devuelve array de strings no vacíos. */
function getDesignImageUrls(pedido) {
  if (!pedido || typeof pedido !== 'object') return [];
  const raw = [];
  const diseño = pedido.diseño ?? pedido.diseno;
  if (diseño && typeof diseño === 'object') {
    [diseño.urlImagen, diseño.linkDiseno, diseño.url, diseño.link, diseño.imagen].forEach((v) => raw.push(v));
  }
  ['linkDiseno', 'imagenGaleria', 'urlGaleria', 'galeriaDiseno', 'linkImagen', 'urlDiseno', 'disenoUrl', 'imagenDiseno'].forEach((key) => {
    if (pedido[key] != null && pedido[key] !== '') raw.push(pedido[key]);
  });
  if (Array.isArray(pedido.imageURLs) && pedido.imageURLs.length) raw.push(...pedido.imageURLs);
  const flattened = [];
  raw.forEach((v) => {
    if (Array.isArray(v)) v.forEach((item) => flattened.push(item));
    else flattened.push(v);
  });
  const strings = [];
  flattened.forEach((v) => {
    const s = toSingleUrlString(v);
    if (s) splitUrlsBySpaces(s).forEach((u) => strings.push(u));
  });
  return [...new Set(strings)];
}

function formatFecha(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  const d = val?.toDate?.() ?? (val instanceof Date ? val : null);
  return d ? d.toLocaleDateString('es-PE') : null;
}

/** Fecha y hora en locale es-PE para modales (cuando entró / salió). */
function formatFechaHora(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  const d = val?.toDate?.() ?? (val instanceof Date ? val : null);
  return d ? d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : null;
}

/** Construye objeto fechas para Timeline desde mapas ERP (impresion, diseño, preparación, estampado, empaquetado, reparto). */
function buildFechasDesdeErp(pedido) {
  const f = {};
  const impresion = pedido.impresion;
  const diseño = pedido.diseño ?? pedido.diseno;
  const preparacion = pedido.preparación ?? pedido.preparacion;
  const estampado = pedido.estampado;
  const empaquetado = pedido.empaquetado;
  const reparto = pedido.reparto;
  if (impresion?.fechaSalida != null) f.impresion = formatFecha(impresion.fechaSalida);
  if (diseño?.fechaSalida != null) f.diseno = formatFecha(diseño.fechaSalida);
  if (diseño?.fechaEntrada != null && !f.diseno) f.diseno = formatFecha(diseño.fechaEntrada);
  if (preparacion?.fechaSalida != null) f.preparacion = formatFecha(preparacion.fechaSalida);
  if (estampado?.fechaSalida != null) f.estampado = formatFecha(estampado.fechaSalida);
  if (empaquetado?.fechaSalida != null) f.empaquetado = formatFecha(empaquetado.fechaSalida);
  if (reparto?.fechaSalida != null) f.reparto = formatFecha(reparto.fechaSalida);
  if (reparto?.fechaFinalizado != null && !f.reparto) f.reparto = formatFecha(reparto.fechaFinalizado);
  return f;
}

/** Construye detalles por etapa para modales (fechas con hora, operador, diseñador, etc.). */
function buildDetallesEtapas(pedido) {
  const impresion = pedido.impresion;
  const diseño = pedido.diseño ?? pedido.diseno;
  const preparacion = pedido.preparación ?? pedido.preparacion;
  const estampado = pedido.estampado;
  const empaquetado = pedido.empaquetado;
  const reparto = pedido.reparto;
  const productos = pedido.productos;
  const prendas = pedido.prendas;

  const detalles = {
    compra: {
      fecha: formatFechaHora(pedido.createdAt),
      productos: productos ?? null,
      prendas: typeof prendas === 'string' ? prendas : (prendas ?? null),
      cantidad: pedido.cantidad ?? null,
      canalVenta: pedido.canalVenta ?? null,
      vendedor: pedido.vendedor ?? null,
      montoTotal: pedido.montoTotal ?? pedido.total,
      montoAdelanto: pedido.montoAdelanto ?? pedido.montoAdelantado,
      observación: pedido.observación ?? pedido.observacion ?? null,
    },
    diseno: {
      fechaEntrada: formatFechaHora(diseño?.fechaEntrada ?? diseño?.estadofechaEntrada),
      fechaSalida: formatFechaHora(diseño?.fechaSalida),
      diseñadorAsignado: diseño?.diseñadorAsignado ?? null,
      urlImagen: diseño?.urlImagen ?? null,
    },
    impresion: {
      fechaEntrada: formatFechaHora(impresion?.fechaEntrada),
      fechaSalida: formatFechaHora(impresion?.fechaSalida),
      estado: impresion?.estado ?? null,
      pago1: impresion?.pago1 ?? null,
      pago2: impresion?.pago2 ?? null,
      montoPendiente: pedido.montoPendiente ?? impresion?.montoPendiente ?? null,
    },
    preparacion: {
      fechaEntrada: formatFechaHora(preparacion?.fechaEntrada),
      fechaSalida: formatFechaHora(preparacion?.fechaSalida),
      operador: preparacion?.operador ?? null,
    },
    estampado: {
      fechaEntrada: formatFechaHora(estampado?.fechaEntrada),
      fechaSalida: formatFechaHora(estampado?.fechaSalida),
      operador: estampado?.operador ?? null,
    },
    empaquetado: {
      fechaEntrada: formatFechaHora(empaquetado?.fechaEntrada),
      fechaSalida: formatFechaHora(empaquetado?.fechaSalida),
      operador: empaquetado?.operador ?? null,
    },
    reparto: {
      fechaEntrada: formatFechaHora(reparto?.fechaEntrada),
      fechaSalida: formatFechaHora(reparto?.fechaSalida),
      fechaFinalizado: formatFechaHora(reparto?.fechaFinalizado),
      repartidor: reparto?.repartidor ?? null,
    },
    finalizado: {
      fecha: formatFechaHora(reparto?.fechaFinalizado ?? reparto?.fechaSalida),
    },
  };
  return detalles;
}

function getQueueNumberFromPedido(pedido) {
  if (!pedido) return null;
  const stage = getQueueStage(pedido.estadoGeneral ?? pedido.status ?? pedido.estado);
  if (!stage) return pedido.numeroColaDisplay || null;
  const stageObj = pedido[stage] || pedido[stage.replace('n', 'ñ')];
  if (stageObj && stageObj.numeroColaDisplay != null) {
    return String(stageObj.numeroColaDisplay);
  }
  return pedido.numeroColaDisplay || null;
}

function conDeudaFromPedido(pedido) {
  if (pedido.conDeuda !== undefined && typeof pedido.conDeuda === 'boolean') {
    if (!pedido.conDeuda) return false;
    // Si la BD dice que hay deuda, verificamos que el monto sea mayor a 0, redondeado a 2 decimales
    const m = Number(pedido.montoDeuda ?? pedido.montoPendiente ?? pedido.impresion?.montoPendiente);
    if (!Number.isNaN(m) && Math.round(m * 100) / 100 <= 0) return false;
    return true;
  }
  const pendiente = pedido.montoPendiente ?? pedido.impresion?.montoPendiente ?? pedido.montoDeuda;
  if (pendiente == null) return false;
  const n = Number(pendiente);
  return !Number.isNaN(n) && Math.round(n * 100) / 100 > 0;
}

/** Monto de deuda formateado para la vista ("50.00") o null si no hay deuda. */
function montoDeudaFromPedido(pedido) {
  if (pedido.montoDeuda !== undefined) {
    const m = Number(pedido.montoDeuda);
    return !Number.isNaN(m) && Math.round(m * 100) / 100 > 0 ? m.toFixed(2) : null;
  }
  const pendiente = pedido.montoPendiente ?? pedido.impresion?.montoPendiente;
  if (pendiente == null) return null;
  const n = Number(pendiente);
  return !Number.isNaN(n) && Math.round(n * 100) / 100 > 0 ? n.toFixed(2) : null;
}

/**
 * Extrae los datos del cliente desde una lista de pedidos ERP (primer pedido con datos).
 * Devuelve un objeto unificado: nombreCompleto, telefono1, telefono2, correo, provincia, ciudad, distrito, numeroDocumento.
 */
export function extraerDatosClienteDesdePedidos(pedidosRaw) {
  if (!Array.isArray(pedidosRaw) || pedidosRaw.length === 0) return null;
  const first = pedidosRaw[0];
  const nombreCompleto = getFirst(first, ERP_NOMBRE);
  const telefono1 = getFirst(first, ERP_TELEFONO1);
  const telefono2 = getFirst(first, ERP_TELEFONO2);
  const correo = getFirst(first, ERP_CORREO);
  const provincia = getFirst(first, ERP_PROVINCIA);
  const ciudad = getFirst(first, ERP_CIUDAD);
  const distrito = getFirst(first, ERP_DISTRITO);
  const numeroDocumento = first.clienteNumeroDocumento ?? first.dni ?? first.documento;

  const provinciaAddr = provincia ?? first.envioProvincia ?? first.shippingAddress?.province ?? first.direccion?.provincia;
  const ciudadAddr = ciudad ?? first.envioDepartamento ?? first.shippingAddress?.city ?? first.direccion?.ciudad;
  const distritoAddr = distrito ?? first.envioDistrito ?? first.shippingAddress?.district ?? first.direccion?.distrito;

  if (!nombreCompleto && !telefono1 && !correo && !numeroDocumento) return null;

  return {
    nombreCompleto: nombreCompleto || '—',
    telefono1: telefono1 ?? '—',
    telefono2: telefono2 ?? '—',
    correo: correo ?? '—',
    provincia: provinciaAddr ?? '—',
    ciudad: ciudadAddr ?? '—',
    distrito: distritoAddr ?? '—',
    numeroDocumento: numeroDocumento ?? '—',
  };
}

/**
 * Normaliza un pedido al formato esperado por la vista (PedidoCard).
 * Acepta formato del mock/API (nombreCliente, direccion, fechas...) o formato ERP (customerName, shippingAddress, timeline..., clienteNumeroDocumento, clienteNombreCompleto, etc.).
 */
export function normalizarPedidoParaVista(pedido) {
  if (!pedido) return null;
  if (pedido.nombreCliente != null && pedido.direccion != null) {
    const envioProvincia = getFirst(pedido, ERP_ENVIO_PROVINCIA) ?? pedido.shippingAddress?.province ?? null;
    const envioCiudad = getFirst(pedido, ERP_ENVIO_CIUDAD) ?? pedido.shippingAddress?.city ?? null;
    const envioDistrito = getFirst(pedido, ERP_ENVIO_DISTRITO) ?? pedido.shippingAddress?.district ?? null;
    const imageURLsResolved = getDesignImageUrls(pedido);
    const estadoVal = pedido.estadoGeneral ?? pedido.status ?? pedido.estado ?? 'Pendiente';
    return {
      id: pedido.id,
      estado: estadoVal,
      estadoGeneral: estadoVal,
      nombreCliente: pedido.nombreCliente,
      direccion: pedido.direccion,
      fechaCompra: pedido.fechaCompra,
      tallas: pedido.tallas,
      montoAdelantado: pedido.montoAdelantado,
      montoTotal: pedido.montoTotal,
      montoDeuda: montoDeudaFromPedido(pedido),
      envioProvincia: envioProvincia ?? '—',
      envioCiudad: envioCiudad ?? '—',
      envioDistrito: envioDistrito ?? '—',
      agenciaEnvio: pedido.agenciaEnvio ?? '—',
      imageURLs: imageURLsResolved,
      fechas: pedido.fechas || {},
      conDeuda: conDeudaFromPedido(pedido),
      detallesEtapas: pedido.detallesEtapas ?? {},
      numeroColaDisplay: getQueueNumberFromPedido(pedido),
      marca: pedido.marca || pedido.Marca || null,
      createdAt: pedido.createdAt ?? pedido.fechaCompra ?? null,
      historialPagos: pedido.impresion?.historialPagos || pedido.cobranza?.historialPagos || pedido.historialPagos || [],
    };
  }

  const nombrePartes = [pedido.clienteNombre, pedido.clienteApellidos].filter(Boolean);
  const nombreCliente = nombrePartes.length
    ? nombrePartes.join(' ')
    : (getFirst(pedido, ERP_NOMBRE) || pedido.customerName || pedido.nombreCliente || 'Cliente');

  const dirPartes = [pedido.envioDireccion, pedido.envioDistrito, pedido.envioDepartamento].filter(Boolean);
  const dirFromErp = dirPartes.length ? dirPartes.join(', ') : null;
  const addr = pedido.shippingAddress || {};
  const dirFromAddr = [addr.address, addr.district, addr.city].filter(Boolean).join(', ');
  const dirFromFields = typeof pedido.direccion === 'string'
    ? pedido.direccion
    : [pedido.address, pedido.distrito, pedido.ciudad].filter(Boolean).join(', ');
  const dir = dirFromErp || dirFromAddr || dirFromFields || 'No disponible';

  const tallasFromPrendas = pedido.prendas && typeof pedido.prendas === 'string' ? pedido.prendas : null;
  const tallas = (pedido.items || [])
    .map((i) => i.variant?.size)
    .filter(Boolean);
  const tallasStr = tallasFromPrendas ?? (tallas.length ? tallas.join(', ') : null) ?? pedido.tallas ?? 'N/A';

  const designUrls = getDesignImageUrls(pedido);
  const itemsImages = (pedido.items || [])
    .flatMap((i) => (i.customization?.imageURL ? [i.customization.imageURL] : []))
    .filter((u) => u && String(u).trim());
  const imageURLs = designUrls.length ? designUrls : (itemsImages.length ? itemsImages : (pedido.imageURLs || []));

  const fechaCompra = formatFecha(pedido.createdAt) ?? pedido.timeline?.compra ?? pedido.fechaCompra ?? 'N/A';
  const fechasErp = buildFechasDesdeErp(pedido);
  const fechas = Object.keys(fechasErp).length ? fechasErp : (pedido.timeline || pedido.fechas || {});

  const montoAdelanto = pedido.montoAdelanto ?? pedido.montoAdelantado;
  const montoTotalVal = pedido.montoTotal ?? pedido.total;
  const envioProvincia = getFirst(pedido, ERP_ENVIO_PROVINCIA) ?? pedido.shippingAddress?.province ?? '—';
  const envioCiudad = getFirst(pedido, ERP_ENVIO_CIUDAD) ?? pedido.shippingAddress?.city ?? '—';
  const envioDistrito = getFirst(pedido, ERP_ENVIO_DISTRITO) ?? pedido.shippingAddress?.district ?? '—';
  const agenciaEnvio = pedido.agenciaEnvio != null && pedido.agenciaEnvio !== '' ? pedido.agenciaEnvio : '—';

  const estadoVal = pedido.estadoGeneral ?? pedido.status ?? pedido.estado ?? 'Pendiente';

  return {
    id: pedido.id || pedido.erpOrderId,
    estado: estadoVal,
    estadoGeneral: estadoVal,
    nombreCliente,
    direccion: dir,
    fechaCompra,
    tallas: typeof tallasStr === 'string' ? tallasStr : String(tallasStr ?? 'N/A'),
    montoAdelantado: montoAdelanto != null ? String(montoAdelanto) : '0.00',
    montoTotal: montoTotalVal != null ? String(montoTotalVal) : '0.00',
    montoDeuda: montoDeudaFromPedido(pedido),
    envioProvincia,
    envioCiudad,
    envioDistrito,
    agenciaEnvio,
    imageURLs,
    fechas,
    conDeuda: conDeudaFromPedido(pedido),
    detallesEtapas: buildDetallesEtapas(pedido),
    numeroColaDisplay: getQueueNumberFromPedido(pedido),
    marca: pedido.marca || pedido.Marca || null,
    createdAt: pedido.createdAt ?? pedido.fechaCompra ?? null,
    historialPagos: pedido.impresion?.historialPagos || pedido.cobranza?.historialPagos || pedido.historialPagos || [],
  };
}
