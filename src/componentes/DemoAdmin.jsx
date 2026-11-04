import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { Archive, Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  MarcoAdmin, SinPermiso, CabezaAdmin, PaginaInicioAdmin, PaginaCategorias, InsigniaEstado, ESTADOS_ADMIN, AccionesLote,
  PaginaColecciones, PaginaAtributos, PaginaEnvios, PaginaMarcas, PaginaProductosMarca, PaginaDestacados,
  PaginaProductos, PaginaRecomendar, PaginaFichaProducto, fichaDesdeProducto, fichaAProducto,
  PaginaPersonalizables, PaginaPacks, personalizableDesde, packDesdeFirestore,
  PaginaRecepcion,
  PaginaPagos, configPagosDesde, PaginaReclamos, reclamoDesdeFirestore,
  MarcoResultados, PaginaResumenResultados, PaginaProductosResultados, PaginaVisitantesResultados, PaginaClientesResultados, PaginaOpinionesResultados,
  PaginaDetalleTecnico, PaginaPaginasTecnica, PaginaUsoTecnica, PaginaNavegadorTecnica, PaginaMapaDeCalor, ORIGENES_TECNICOS,
  PaginaReferidosAdmin, PaginaMisionesAdmin, PaginaRetosAdmin, referidoDesdeFirestore, misionDesdeFirestore, misionAFirestore,
  retoDesdeFirestore, retoAFirestore, retoActivoDesde, evidenciaDesde, PaginaRecompensasAdmin, recompensaAdminDesdeFirestore, recompensaAdminAFirestore,
  PaginaFechasAdmin, fechaClienteDesde, paqueteDesdeFirestore, paquetesDeFecha, cambiosAlElegir, siguienteElegido,
  PaginaNotificacionesAdmin, configNotificacionesDesde, campanaDesde, PaginaEncuestaAdmin, RespuestasEntregas, RespuestasEncuesta, configConPregunta,
  PaginaSorteosAdmin, PaginaSorteoAdmin, sorteoDesdeFirestore, sorteoAFormulario, participanteDesde,
  PaginaSuscripcionesAdmin, PaginaSuscripcionAdmin, campanaSuscripcionDesde, campanaSuscripcionAFormulario, suscriptorDesde, beneficioDesde, ganadorGaleriaDesde,
  PaginaEnlacesAdmin, PaginaEnlaceAdmin, paginaEnlacesDesde, paginaEnlacesAFirestore,
  PaginaPopupsAdmin, PaginaLandingsAdmin, PaginaTemasAdmin, landingDesde, landingAFirestore, temaDesde, temaAFirestore, temaDesdeCss,
  PaginaKapiAdmin, PaginaPalabraAdmin, PaginaBolitasAdmin, palabraDiaDesde, patrocinioDesde, premiosBolitasDesde,
  PaginaRuletaAdmin, premioRuletaAFirestore, ganadoRuletaDesde,
  PaginaConfiguracionAdmin, adminDesdeFirestore, adminAFirestore, paginasBloqueables, conBloqueo,
  PaginaWhatsAppAdmin, PaginaHistorialAdmin, whatsappDesdeMensajes, whatsappAMensajes, cambioDisenoDesde, conVersionActual, movimientoInventarioDesde,
  CampoImagen, TablaAdmin, EstadoVacio, Boton, Chip, Pestanas, ProveedorEnlaces, useToast,
  menuAdminPara, accesosAdminPara, puedeVer, opcionActiva, categoriaDesdeFirestore, marcaAdminDesdeFirestore,
  coleccionDesdeFirestore, atributoDesdeFirestore, usosDeAtributo, zonaDesdeFirestore, marcaDesdeFirestore,
  productoAdminDesde, tarjetaDesdeProducto,
} from './kit';
import TIENDA from './demo/tienda.json';
import CREAR from './demo/crear.json';
import { leerPlantillas, prendaBaseParaGuardar } from '../utils/prendaBase';
import { FESTIVAS_DEFAULT, normalizarFestiva, hoyLocal } from '../utils/fechasFestivas.mjs';
import { normalizarPopup, POPUP_ENCUESTA_DEFAULT } from '../services/popupsLogic.mjs';
import { normalizarPremio, normalizarConfig } from '../utils/ruletaModel';
import MARCAS_TIENDA from './demo/marcas.json';
import { CargandoPanel } from './kit/piezas/admin/CargandoPanel';
import cs from './ComponentesPage.module.css';
import s from './DemoAdmin.module.css';

/*
 * El panel administrativo armado solo con el kit (guía: kit/guia/ADMIN.md).
 *  - Panel de prueba: MarcoAdmin con el menú real filtrado por permiso; los
 *    enlaces navegan. Hechos: el inicio (D0) y el catálogo base (D1):
 *    categorías, colecciones, marcas y sus productos, atributos, zonas de
 *    envío y destacados; y de D2a, productos, inventario y
 *    datos para recomendar, con la copia real de la tienda
 *    (demo/tienda.json y demo/marcas.json; las zonas son de ejemplo). El resto de las secciones dice en qué apartado se hará.
 *  - Piezas del admin: las piezas sueltas con sus estados.
 * Guardar, eliminar y subir se simulan ("Guardar y subir fallan" para ver el error).
 */

const PERFILES = [
  { id: 'super', texto: 'Super Admin', permisos: ['superadmin'], rol: 'Super Admin' },
  { id: 'catalogo', texto: 'Catálogo', permisos: ['manage_products', 'manage_inventory'], rol: 'Catálogo e inventario' },
  { id: 'inventario', texto: 'Solo inventario', permisos: ['manage_inventory'], rol: 'Inventario' },
  { id: 'clientes', texto: 'Clientes', permisos: ['manage_clients'], rol: 'Clientes y pagos' },
];

const TAMANOS = [
  { id: 'ancho', texto: 'Computadora' },
  { id: 'celular', texto: 'Celular' },
];

const ESTADOS = [
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
  ['vacio', 'Sin datos'],
  ['falla', 'Guardar y subir fallan'],
  ['abriendo', 'Abriendo el panel'],
];

/* Las páginas que ya están, para los chips de "Ir a". */
const HECHAS = [
  ['/admin', 'Inicio'],
  ['/admin/resultados', 'Resultados'],
  ['/admin/recepcion-pedidos', 'Recepción'],
  ['/admin/gestion-pagos', 'Pagos'],
  ['/admin/libro-reclamaciones', 'Reclamos'],
  ['/admin/referidos', 'Referidos'],
  ['/admin/misiones', 'Misiones'],
  ['/admin/retos', 'Retos'],
  ['/admin/recompensas', 'Recompensas'],
  ['/admin/fechas-importantes', 'Fechas'],
  ['/admin/notificaciones', 'Notificaciones'],
  ['/admin/encuestas', 'Encuesta'],
  ['/admin/sorteos', 'Sorteos'],
  ['/admin/sorteos-suscripcion', 'Suscripción'],
  ['/admin/enlaces', 'Enlaces'],
  ['/admin/popups', 'Popups'],
  ['/admin/landing-pages', 'Landings'],
  ['/admin/temas', 'Temas'],
  ['/admin/mascota', 'Kapi'],
  ['/admin/wordle', 'Palabra'],
  ['/admin/bolitas', 'Bolitas'],
  ['/admin/ruleta', 'Ruleta'],
  ['/admin/configuracion', 'Configuración'],
  ['/admin/whatsapp', 'WhatsApp'],
  ['/admin/backups', 'Historial'],
  ['/admin/categorias', 'Categorías'],
  ['/admin/colecciones', 'Colecciones'],
  ['/admin/marcas', 'Marcas'],
  ['/admin/atributos-catalogo', 'Atributos'],
  ['/admin/envios', 'Envíos'],
  ['/admin/destacados', 'Destacados'],
  ['/admin/productos', 'Productos'],
  ['/admin/publico-productos', 'Recomendar'],
];

/* El apartado de ADMIN.md donde se hará cada sección que todavía no está. */
const APARTADOS = {
  pedidos: 'D3 · Pedidos y pagos', catalogo: 'D2 · Productos', resultados: 'D4 · Resultados', clientes: 'D5 · Clientes y fidelidad',
  campanas: 'D6 · Campañas', diseno: 'D7 · Juegos y Kapi', ajustes: 'D8 · Ajustes',
};

// La copia real: categories, collections, tags, characters, productTypes y
// 35 productos (tienda.json) y tienda_brands (marcas.json); las marcas de
// cada categoría salen de su categoryNav.
const MARCAS_CORTAS = MARCAS_TIENDA.map(marcaAdminDesdeFirestore);
const MARCAS = MARCAS_TIENDA.map(marcaDesdeFirestore);
const CATEGORIAS = (() => {
  const de = {};
  MARCAS_TIENDA.forEach((b) => (b.categoryNav || []).forEach((n) => { (de[n.categoryId] ||= []).push(b.id); }));
  return TIENDA.categorias.map((c, i) => categoriaDesdeFirestore({ ...c, order: c.order ?? i, brandIds: c.brandIds || de[c.id] || [] }));
})();
const COLECCIONES = TIENDA.colecciones.map((c, i) => coleccionDesdeFirestore({ ...c, order: c.order ?? i }));
const ATRIBUTOS_DEMO = {
  tipos: TIENDA.tipos.map((d) => atributoDesdeFirestore(d, usosDeAtributo(TIENDA.productos, 'tipos'))),
  etiquetas: TIENDA.etiquetas.map((d) => atributoDesdeFirestore(d, usosDeAtributo(TIENDA.productos, 'etiquetas'))),
  personajes: TIENDA.personajes.map((d) => atributoDesdeFirestore(d, usosDeAtributo(TIENDA.productos, 'personajes'))),
};
// De ejemplo (no hay copia de shippingZones).
const ZONAS = [
  { id: 'z1', name: 'Lima Metropolitana', departamento: 'Lima', cost: 10, etaDays: 2, order: 0 },
  { id: 'z2', name: 'Callao', departamento: 'Callao', cost: 10, etaDays: 2, order: 1 },
  { id: 'z3', name: 'Arequipa', departamento: 'Arequipa', cost: 18, etaDays: 4, order: 2 },
  { id: 'z4', name: 'Cusco', departamento: 'Cusco', cost: 20, etaDays: 5, order: 3 },
  { id: 'z5', name: 'Trujillo', departamento: 'La Libertad', cost: 18, etaDays: 4, order: 4, active: false },
].map(zonaDesdeFirestore);
// Los productos, con cinco destacados, algunos ocultos, el stock variado y
// dos con la personalización de antes (de ejemplo).
const PRODUCTOS = TIENDA.productos.map((p, i) => productoAdminDesde({
  ...p,
  featured: i < 5,
  featuredOrder: i,
  visible: i % 9 === 4 ? false : p.visible,
  inStock: [0, 2, 12, 40, 3, 25, 0, 8][i % 8],
  sku: i % 3 === 0 ? `WL-${1000 + i}` : '',
  customizable: i === 6 || i === 13 ? true : p.customizable,
  publico: i % 4 === 0 ? 'unisex' : undefined,
  edadMinima: i % 4 === 0 ? 0 : undefined,
}));
const TIPOS = TIENDA.tipos.map((x) => ({ id: x.id, nombre: x.name }));
const CATEGORIAS_CORTAS = TIENDA.categorias.map((x) => ({ id: x.id, nombre: x.name }));
const COLECCIONES_CORTAS = TIENDA.colecciones.map((x) => ({ id: x.id, nombre: x.name }));
// La ficha: los productos crudos (como en Firestore) por id, para abrirla y guardarla.
const CRUDOS = Object.fromEntries(TIENDA.productos.map((p) => [p.id, p]));
const coloresDemo = (id) => (CRUDOS[id]?.variants || []).map((v) => ({ nombre: v.name, foto: v.imageUrl }));
const DESTINOS_CREAR = [
  { valor: '/crear/polo-kapi', texto: 'Polo Kapi · Crear' },
  { valor: '/combo/pareja-kapi', texto: 'Pareja Kapi · pack de Crear' },
];
const conMarcas = (lista) => lista.map((x) => ({ id: x.id, nombre: x.nombre, marcas: x.marcas || [] }));
// Crear: las 4 prendas y los 2 packs de la copia (demo/crear.json).
// La copia no trae plantillas: dos de ejemplo en la casaca, para probar "Traer de otro".
const PLANTILLAS_DEMO = [
  { id: 'demo-corazones', nombre: 'Corazones', grupo: 'Parejas', imagen: '/assets/kapi/kapi-happy.webp', capas: { frente: [{ tipo: 'texto', texto: 'Te amo' }] } },
  { id: 'demo-escudo', nombre: 'Escudo', grupo: 'Equipos', imagen: '/assets/marca/splash-etiqueta-w.webp', capas: { frente: [{ tipo: 'imagen' }] } },
];
const PRENDAS_CRUDAS = Object.fromEntries(CREAR.prendas.map((p, i) => [p.id, { ...p, inStock: p.inStock ?? null, ...(i === 0 && { prendaBase: { ...p.prendaBase, plantillas: PLANTILLAS_DEMO } }) }]));
// D3a: pedidos de ejemplo con la forma de normalizarPedidoRecepcion (nombres inventados).
const ESTADO_DEMO = {
  por_confirmar_pago: { label: 'Por confirmar pago', paid: false },
  pago_confirmado: { label: 'Pago confirmado', paid: true },
  en_preparacion: { label: 'En preparación', paid: true },
  entregado: { label: 'Entregado', paid: true },
  anulado: { label: 'Anulado', paid: false },
};
const PEDIDOS_RECEPCION = [
  ['Valeria Quispe', '987654321', 'Av. Benavides 1520, dpto. 302', 'Miraflores', 'Lima', 'en_preparacion', [[1, 'Polo clásico personalizado', 'Negro', 'M', true], [1, 'Taza Kapi', '', '', false]], 89.9, 10],
  ['Diego Fernández', '956112233', 'Jr. Las Begonias 455', 'San Isidro', 'Lima', 'por_confirmar_pago', [[2, 'Casaca clásica', 'Azul', 'L', false]], 259.8, 12],
  ['Camila Rojas', '', 'Calle Los Pinos 230', 'Cayma', 'Arequipa', 'pago_confirmado', [[1, 'Cuadro personalizado', '', '', true]], 75, 18, { destinatario: 'Andrés Rojas', mensaje: 'Feliz aniversario, mi amor.', fecha: '2026-11-14' }],
  ['Luis Mendoza', '944556677', 'Mz. B Lt. 12, Urb. Santa Rosa', 'Trujillo', 'La Libertad', 'entregado', [[3, 'Polera clásica', 'Gris', 'S', false]], 297, 15],
  ['Sofía Ramírez', '933221144', 'Av. La Marina 2355', 'San Miguel', 'Lima', 'en_preparacion', [[1, 'Pack de oficina personalizado', '', '', true], [1, 'Mousepad personalizado', '', '', true]], 120, 10],
  ['Mateo Vargas', '912345678', 'Av. Arequipa 3120', 'Lince', 'Lima', 'anulado', [[1, 'Jogger clásico', 'Negro', 'M', false]], 79.9, 10],
  ['Andrea Castillo', '+34 611 222 333', 'Calle Mayor 14, 3º B', 'Madrid', 'España', 'por_confirmar_pago', [[2, 'Polo clásico', 'Blanco', 'S', true]], 139.8, 95],
  ['Jorge Salazar', '987001122', 'Av. Javier Prado Este 4200', 'Surco', 'Lima', 'pago_confirmado', [[1, 'Billetera grabada', 'Café', '', true]], 69.9, 10],
  ['Lucía Torres', '976543210', 'Jr. Puno 345', 'Cusco', 'Cusco', 'entregado', [[1, 'Tomatodo grabado', 'Negro', '', true]], 59.9, 18],
  ['Renzo Paredes', '965432109', '', '', '', 'por_confirmar_pago', [], 45, 0],
].map(([nombre, tel, direccion, distrito, departamento, key, productos, monto, envio, regalo], i) => ({
  id: `demo-pedido-${i + 1}`,
  codigo: `WALA-${String(1820 - i * 7).padStart(5, '0')}`,
  fechaCompraLabel: `${String(30 - i * 2).padStart(2, '0')} de octubre de 2026`,
  clienteNombre: nombre,
  clienteContacto: tel,
  clienteDocumento: i % 3 === 0 ? `7${String(1234567 + i * 1111).slice(0, 7)}` : '',
  entrega: { direccion, distrito, departamento },
  productos: productos.map(([cantidad, n, color, talla, personalizado]) => ({ cantidad, nombre: n, color, talla, personalizado })),
  cantidadTotal: productos.reduce((a, [c]) => a + c, 0),
  montoTotal: monto,
  costoEnvio: envio,
  estado: { key, ...ESTADO_DEMO[key] },
  esRegalo: !!regalo,
  regalo: regalo ? { destinatario: regalo.destinatario, mensaje: regalo.mensaje } : {},
  deliveryDate: regalo?.fecha || null,
  _procesadoErp: i === 3,
}));
// D3b: enlaces de pago de ejemplo con la forma de normalizarEnlace, en las últimas seis semanas.
const CONCEPTOS_PAGO = ['Diferencia de envío a España', 'Saldo del pedido WALA-01790', 'Envío a Arequipa', 'Polo extra para el pack', 'Saldo del pedido WALA-01802', 'Envío internacional a Chile', 'Reposición de taza', 'Bordado adicional'];
const ENLACES_DEMO = Array.from({ length: 34 }, (_, i) => {
  const hoy = new Date();
  const dia = [0, 1, 1, 2, 4, 5, 5, 5, 7, 8, 10, 11, 13, 14, 14, 16, 18, 19, 21, 22, 22, 24, 26, 27, 28, 30, 31, 33, 35, 36, 38, 39, 40, 41][i];
  const createdMs = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dia, 9 + (i % 9), (i * 17) % 60).getTime();
  const usd = i % 6 === 2;
  const pagado = i % 3 !== 0 || dia > 30;
  const espera = [40, 300, 3600, 7200, 86400 * 1.5, 900][i % 6] * 1000;
  return {
    id: `demo-enlace-${i + 1}`,
    concepto: CONCEPTOS_PAGO[i % CONCEPTOS_PAGO.length],
    moneda: usd ? 'USD' : 'PEN',
    monto: usd ? [25, 40, 18][i % 3] : [15, 35, 60, 120, 22.5][i % 5],
    estado: pagado ? 'pagado' : 'pendiente',
    createdMs,
    pagadoMs: pagado ? createdMs + espera : null,
    metodo: usd ? 'paypal' : 'culqi',
    tiempoPagoMs: pagado ? espera : null,
  };
});
const CONFIG_PAGOS_DEMO = configPagosDesde({ yape_number: '987 654 321', yape_name: 'Walá Perú SAC', whatsapp_number_cuenta: '+51 999 888 777' });
// D3c: reclamos de ejemplo (nombres inventados) con fechas relativas a hoy, para ver el plazo.
const RECLAMOS_DEMO = [
  [26, 'Rosa Huamán', 'reclamo', 'producto', 'Polo clásico talla M', 79.9, 'El polo llegó con una mancha en la manga.', 'Que me lo cambien por uno nuevo.', null],
  [19, 'Carlos Ñique', 'queja', 'servicio', 'Atención por WhatsApp', null, 'Escribí tres veces y nadie me respondió en dos días.', 'Que mejoren el tiempo de respuesta.', null],
  [9, 'Milagros Soto', 'reclamo', 'producto', 'Cuadro personalizado', 75, 'El diseño salió cortado por un costado.', 'Que lo vuelvan a imprimir.', null],
  [3, 'Kevin Ramos', 'reclamo', 'producto', 'Pack de oficina personalizado', 120, 'Me llegó sin el mousepad.\nEl pedido era WALA-01790.', 'Que me envíen la pieza que falta.', null],
  [1, 'Ana Lucía Prado', 'queja', 'servicio', 'Entrega', null, 'El repartidor dejó el paquete en portería sin avisar.', 'Que avisen antes de dejarlo.', null],
  [40, 'José Paredes', 'reclamo', 'producto', 'Casaca clásica talla L', 159.9, 'La casaca vino en talla S.', 'Cambio de talla.', 'Hola José, ya te enviamos la talla L sin costo. Disculpa las molestias.'],
  [33, 'Fiorella Díaz', 'queja', 'servicio', 'Pago con Yape', null, 'Me cobraron dos veces.', 'Que me devuelvan un pago.', 'Hola Fiorella, devolvimos el segundo cobro el mismo día. Ya debería verse en tu Yape.'],
].map(([dias, nombre, tipo, bien, descripcion, monto, detalle, pedido, respuesta], i) => {
  const hoy = new Date();
  const creado = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias, 10 + i, 15);
  return reclamoDesdeFirestore({
    id: `demo-reclamo-${i + 1}`,
    codigo: `WALA-${creado.getFullYear()}${String(creado.getMonth() + 1).padStart(2, '0')}${String(creado.getDate()).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
    createdAt: creado.getTime(),
    estado: respuesta ? 'respondido' : 'pendiente',
    consumidor: { nombre, tipoDocumento: 'DNI', numeroDocumento: `4${String(5612340 + i * 731).slice(0, 7)}`, email: `${nombre.split(' ')[0].toLowerCase()}@correo.pe`, telefono: `9${String(87654320 + i * 13)}`.slice(0, 9), domicilio: i % 2 ? 'Av. Los Álamos 345, Surco' : '', esMenor: i === 4, apoderado: i === 4 ? 'Lucía Prado' : null },
    bien: { tipo: bien, descripcion, montoReclamado: monto },
    reclamo: { tipo, detalle, pedido },
    respuestaProveedor: respuesta,
    respondidoEn: respuesta ? new Date(creado.getTime() + 3 * 86400000).toISOString() : null,
  });
});
// D4a: un resumen de Resultados de ejemplo con la forma de useDashboardAnalytics (30 días).
const diaKey = (atras) => { const d = new Date(); d.setDate(d.getDate() - atras); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const DIAS_RESULTADOS = { hoy: 1, ayer: 1, 7: 7, 30: 30, 90: 90 };
function resultadosDemo(dias) {
  const visitasPorDia = Array.from({ length: dias }, (_, i) => ({ day: diaKey(dias - 1 - i), total: Math.round(140 + 60 * Math.sin(i / 3) + (i % 7 === 5 ? 90 : 0) + i * 1.5) }));
  const visitas = visitasPorDia.reduce((a, d) => a + d.total, 0);
  const pedidos = Math.round(visitas * 0.021);
  return {
    datos: {
      visitas: { total: { total: visitas }, conInteraccion: { total: Math.round(visitas * 0.46) }, paginas: { total: Math.round(visitas * 3.4) }, dwellMs: { total: visitas * 142000 } },
      ventas: { pedidos: { total: pedidos }, ingresosCents: { total: pedidos * 8650 } },
      diasConResultados: dias,
      visitasPorDia,
      canales: [
        { canal: 'Instagram', visitas: Math.round(visitas * 0.41), conInteraccion: Math.round(visitas * 0.2), pedidos: Math.round(pedidos * 0.46) },
        { canal: 'Google', visitas: Math.round(visitas * 0.27), conInteraccion: Math.round(visitas * 0.14), pedidos: Math.round(pedidos * 0.3) },
        { canal: 'Directo o sin dato', visitas: Math.round(visitas * 0.18), conInteraccion: Math.round(visitas * 0.07), pedidos: Math.round(pedidos * 0.16) },
        { canal: 'TikTok', visitas: Math.round(visitas * 0.1), conInteraccion: Math.round(visitas * 0.03), pedidos: Math.round(pedidos * 0.06) },
      ],
      otrosCobros: { sorteo: { cantidad: 6, porMoneda: { PEN: 6 * 1000 } }, saldo: { cantidad: 2, porMoneda: { PEN: 9000 } } },
      // D4b: lo de Productos y Visitantes, con productos de la copia de la tienda.
      ...productosResultadosDemo(visitas, pedidos, dias, visitasPorDia),
      realtimeSessionsDetails: [
        { id: 's1', hasAccount: true, displayName: 'Valeria Quispe', lastPath: '/producto/polo-clasico', lastSeenAtMs: Date.now() - 60000 },
        { id: 's2', hasAccount: false, lastPath: '/tienda', lastSeenAtMs: Date.now() - 120000 },
        { id: 's3', hasAccount: false, lastPath: '/personalizar', lastSeenAtMs: Date.now() - 240000 },
        { id: 's4', hasAccount: true, email: 'diego@correo.pe', lastPath: '/carrito', lastSeenAtMs: Date.now() - 30000 },
      ],
    },
    anterior: { visitas: { total: Math.round(visitas * 0.88) }, pedidos: { total: Math.round(pedidos * 1.05) }, ingresosCents: { total: Math.round(pedidos * 1.05) * 8200 }, diasConVentas: dias },
  };
}
const PRODUCTOS_RES = TIENDA.productos.slice(0, 12);
function productosResultadosDemo(visitas, pedidos, dias, visitasPorDia) {
  const k = dias / 30;
  return {
    topProducts: PRODUCTOS_RES.map((p, i) => ({ productId: p.id, total: Math.round((420 - i * 31) * k) })),
    topVendidos: PRODUCTOS_RES.slice(0, 8).map((p, i) => ({ productId: p.id, unidades: Math.round((14 - i) * k) || 1, pedidos: Math.round((11 - i) * k) || 1, ingresosCents: Math.round((14 - i) * k) * (p.salePrice || p.price || 50) * 100, linea: p.categories?.[0] || null })),
    interes: {
      productos: PRODUCTOS_RES.slice(0, 6).map((p, i) => ({ productId: p.id, dwellMs: (900 - i * 120) * 1000, personas: 6 - i })),
      pares: [
        { uid: 'u1', productId: PRODUCTOS_RES[0].id, nombre: 'Valeria', dwellMs: 185000, ultimaMs: Date.now() - 3600000 },
        { uid: 'u2', productId: PRODUCTOS_RES[1].id, nombre: 'Diego', dwellMs: 96000, ultimaMs: Date.now() - 7200000 },
        { uid: 'u3', productId: PRODUCTOS_RES[0].id, nombre: 'Camila', dwellMs: 64000, ultimaMs: Date.now() - 86400000 },
        { uid: 'u4', productId: PRODUCTOS_RES[3].id, nombre: 'Luis', dwellMs: 41000, ultimaMs: Date.now() - 86400000 * 2 },
      ],
    },
    topCategoriesByViews: TIENDA.categorias.slice(0, 6).map((c, i) => ({ id: c.id, name: c.name, total: Math.round((800 - i * 110) * k) })),
    topCollectionsByViews: (TIENDA.colecciones || []).slice(0, 4).map((c, i) => ({ id: c.id, name: c.name, total: Math.round((140 - i * 30) * k) })),
    topSearches: [['polo personalizado', 48], ['tomatodo azul', 14], ['cuadro pareja', 12], ['hoodie', 9], ['taza', 6]].map(([query, total]) => ({ query, total: Math.round(total * k) || 1 })),
    deseos: { agregados: { total: Math.round(64 * k) }, quitados: { total: Math.round(11 * k) }, topProductos: PRODUCTOS_RES.slice(2, 7).map((p, i) => ({ productId: p.id, agregados: Math.round((12 - i * 2) * k) || 1 })) },
    crear: { aperturas: { total: Math.round(310 * k) }, aperturasCombo: { total: Math.round(42 * k) }, guardados: { total: Math.round(57 * k) } },
    personas: { total: Math.round(visitas * 0.72), app: Math.round(visitas * 0.12) },
    // D4c: carritos abandonados (los uid son los de PERFILES_DEMO).
    abandonedCarts: [
      { id: 'c1', uid: 'u1', displayName: 'Valeria Quispe', lastCartValue: 15980, abandonedAtMs: Date.now() - 3600000 * 3 },
      { id: 'c2', uid: 'u2', lastCartValue: 8990, abandonedAtMs: Date.now() - 3600000 * 20 },
      { id: 'c3', uid: null, lastCartValue: 5990, abandonedAtMs: Date.now() - 86400000 * 2 },
      { id: 'c4', uid: 'u4', displayName: 'Luis Mendoza', lastCartValue: 23950, abandonedAtMs: Date.now() - 86400000 * 4 },
    ],
    carritosAbandonados: { cantidad: { total: 4 }, valorCents: { total: 54910 } },
    // D4d: lo de las pantallas técnicas.
    ...tecnicoDemo(visitas, visitasPorDia),
    // D4d: de las pestañas registradas a las visitas.
    calidad: { diasMedidos: dias, sesionesRegistradas: Math.round(visitas * 1.62), sesionesBot: Math.round(visitas * 0.31), sesionesAdmin: Math.round(visitas * 0.04), sinPaginas: Math.round(visitas * 0.09), unidas: Math.round(visitas * 1.62) - Math.round(visitas * 0.31) - Math.round(visitas * 0.04) - Math.round(visitas * 0.09) - visitas },
    byCountry: [{ name: 'Perú', code: 'PE', count: Math.round(visitas * 0.9) }, { name: 'España', code: 'ES', count: Math.round(visitas * 0.04) }, { name: 'Chile', code: 'CL', count: Math.round(visitas * 0.03) }, { name: 'unknown', count: Math.round(visitas * 0.03) }],
    byDevice: [{ name: 'Mobile', count: Math.round(visitas * 0.78) }, { name: 'Desktop', count: Math.round(visitas * 0.19) }, { name: 'Tablet', count: Math.round(visitas * 0.03) }],
    byClientType: [{ name: 'WEB', count: Math.round(visitas * 0.83) }, { name: 'APP', count: Math.round(visitas * 0.17) }],
    pedidosTotal: pedidos,
  };
}
const PERFILES_DEMO = new Map([
  ['u1', { displayName: 'Valeria Quispe', phone: '987654321', marketingConsent: { whatsapp: true } }],
  ['u2', { displayName: 'Diego Fernández', phone: '956112233', marketingConsent: { whatsapp: false } }],
  ['u3', { displayName: 'Camila Rojas', marketingConsent: { whatsapp: true } }],
  ['u4', { displayName: 'Luis Mendoza', phoneIntl: { full: '+34600111222' }, marketingConsent: { whatsapp: true } }],
]);
const CATALOGO_RES = new Map(TIENDA.productos.map((p) => [String(p.id), p]));
const productoDeDemo = (id, nombre) => { const p = CATALOGO_RES.get(String(id)); return { nombre: p?.name || nombre, imagen: p?.mainImage || p?.images?.[0] || '', producto: p }; };
const nombreCategoriaDemo = (id) => TIENDA.categorias.find((c) => String(c.id) === String(id))?.name || id;
const RUTAS_RES = [['/', 1820], ['/tienda', 1310], ['/personalizar', 640], ['/producto/polo-clasico', 520], ['/carrito', 310], ['/cuenta/pedidos', 190], ['/combo/pareja-kapi', 150], ['/minijuegos', 120], ['/buscar', 95], ['/checkout', 80]];
function tecnicoDemo(visitas, visitasPorDia) {
  const k = visitas / 5555;
  const taw = (n, app = 0.17) => ({ total: Math.round(n), app: Math.round(n * app), web: Math.round(n) - Math.round(n * app) });
  const eventos = visitasPorDia.flatMap((d) => {
    const [y, m, dd] = d.day.split('-').map(Number);
    const ts = new Date(y, m - 1, dd, 12).getTime();
    return Array.from({ length: Math.max(1, Math.round(d.total / 20)) }, (_, i) => ({ type: 'page_view', clientTsMs: ts + i, clientType: i % 6 === 0 ? 'APP' : 'WEB', path: '/tienda' }));
  });
  return {
    __source: 'analytics_daily',
    eventsForCharts: eventos,
    totalEvents: { total: eventos.length, app: eventos.filter((e) => e.clientType === 'APP').length },
    topRoutesByViews: RUTAS_RES.map(([path, n]) => ({ path, views: taw(n * k) })),
    topRoutesByDwell: RUTAS_RES.slice(0, 8).map(([path, n], i) => ({ path, dwellMs: taw((n * 1400 + (i === 2 ? 900000 : 0)) * k) })).sort((a, b) => b.dwellMs.total - a.dwellMs.total),
    totalSessions: taw(visitas * 1.08),
    pageViews: taw(visitas * 3.4),
    scrollDepth: { avgTotal: 54, avgApp: 63, avgWeb: 52 },
    avgDwellPerSessionMs: taw(142000),
    topIdentities: [
      { clave: 'u1', logueado: true, nombre: 'Valeria Quispe', views: 84, dwellMs: 2400000 },
      { clave: 'anon_7f3a91c2', logueado: false, views: 61, dwellMs: 1300000 },
      { clave: 'u4', logueado: true, nombre: 'anónimo', views: 47, dwellMs: 980000 },
      { clave: 'anon_b2c4d6e8', logueado: false, views: 33, dwellMs: 600000 },
    ],
    featureUsage: [{ area: 'editor', total: Math.round(310 * k) }, { area: 'busqueda', total: Math.round(260 * k) }, { area: 'wishlist', total: Math.round(140 * k) }, { area: 'minijuegos', total: Math.round(90 * k) }, { area: 'misiones', total: Math.round(40 * k) }],
    extendedCoverage: { closedDocs: visitasPorDia.length, docsWithBreakdowns: Math.max(0, visitasPorDia.length - 3), firstBreakdownDay: visitasPorDia[3]?.day, docsWithTopIdentities: visitasPorDia.length },
    byBrowser: [{ name: 'Chrome', count: Math.round(visitas * 0.58) }, { name: 'Safari', count: Math.round(visitas * 0.27) }, { name: 'Instagram', count: Math.round(visitas * 0.09) }, { name: 'Edge', count: Math.round(visitas * 0.06) }],
    byOS: [{ name: 'Android', count: Math.round(visitas * 0.52) }, { name: 'iOS', count: Math.round(visitas * 0.29) }, { name: 'Windows', count: Math.round(visitas * 0.15) }, { name: 'macOS', count: Math.round(visitas * 0.04) }],
    byCountryAprox: [{ code: 'PE', count: Math.round(120 * k) }, { code: 'unknown', count: Math.round(8 * k) }],
    utmStats: { topSources: [{ name: 'instagram', value: Math.round(visitas * 0.3) }, { name: 'google', value: Math.round(visitas * 0.2) }, { name: 'tiktok', value: Math.round(visitas * 0.07) }], topCampaigns: [{ name: 'cyber-wala', count: Math.round(410 * k) }, { name: 'navidad-2026', count: Math.round(180 * k) }] },
    geographyStats: { topRegions: [{ name: 'Lima', count: Math.round(visitas * 0.61) }, { name: 'Arequipa', count: Math.round(visitas * 0.08) }, { name: 'La Libertad', count: Math.round(visitas * 0.06) }] },
    realtimeActiveSessions: { total: 4, app: 1, web: 3 },
    orderTracking: { views: Math.round(190 * k), uniqueUsers: Math.round(122 * k), totalDwellMs: Math.round(190 * k) * 48000, avgDwellMs: 48000 },
  };
}
const AREAS_DEMO = [['Tienda', 34], ['Inicio', 26], ['Producto', 14], ['Editor', 9], ['Carrito', 6], ['Mi cuenta', 5], ['Minijuegos', 3], ['Búsqueda', 2], ['Checkout', 1]];
const ANCHOS_DEMO = [{ id: 'todos', texto: 'Todos' }, { id: 'movil', texto: 'Móvil' }, { id: 'tablet', texto: 'Tablet' }, { id: 'escritorio', texto: 'Computadora' }];
const TITULOS_TECNICOS = {
  'mapa-de-calor': ['Mapa de calor', 'Dónde hacen clic tus visitantes'],
  paginas: ['Páginas y tiempo', 'Tráfico por página y búsquedas'],
  uso: ['Uso y permanencia', 'Actividad, áreas y permanencia'],
  navegador: ['Navegador y sistema', 'Aparatos, países, fuentes y regiones'],
};
// D5a: referidos, misiones y retos de ejemplo (nombres inventados).
const estimarDemo = (total, r) => { const n = Number(total) || 0; const p = Math.round(n * (n > 200 ? 0.1 : 0.05)); return r?.tipo === 'invitacion' && r?.invitadoUid ? Math.max(20, p) : p; };
const REFERIDOS_DEMO = [
  ['ANA2026', 'sent', null], ['ANA2026', 'clicked', null], ['LUIS77', 'registered', { tipo: 'invitacion', visitanteNombre: 'Kevin Ramos' }],
  ['LUIS77', 'purchased', { tipo: 'invitacion', invitadoUid: 'k', visitanteNombre: 'Kevin Ramos', orderId: 'WALA-01814', orderTotal: 129.8 }],
  ['VALE', 'claimed', { productId: 'polo-clasico', visitanteNombre: 'Rosa Huamán', orderId: 'WALA-01790', orderTotal: 259.8, earnedCoins: 26 }],
  ['VALE', 'purchased', { visitanteNombre: 'Diego Fernández', orderId: 'WALA-01806', orderTotal: 75 }],
  ['ANA2026', 'ineligible', { linkId: 'x', visitanteNombre: 'Ana Pérez', orderId: 'WALA-01760', orderTotal: 60 }],
].map(([referrerCode, status, extra], i) => referidoDesdeFirestore({ id: `ref-${i}`, referrerCode, status, createdAt: Date.now() - 86400000 * (i * 3 + 1), tipo: 'tienda', ...(extra || {}) }, estimarDemo));
const VERIFICACIONES_DEMO = [
  { valor: 'visit_catalogo_recompensas', texto: 'Visitó el Catálogo de Recompensas' }, { valor: 'visit_mis_cupones', texto: 'Visitó Mis Cupones' },
  { valor: 'visit_minijuegos', texto: 'Visitó Minijuegos' }, { valor: 'add_wishlist', texto: 'Agregó un favorito' }, { valor: 'bolitas_nivel', texto: 'Pasó un nivel de las Bolitas de Kapi' },
];
const MISIONES_DEMO = [
  ['Visita el Catálogo de Recompensas', 'Mira qué puedes canjear con tus monedas.', 5, 'visit_catalogo_recompensas', true],
  ['Agrega un favorito', 'Guarda un producto en tu lista de deseos.', 10, 'add_wishlist', true],
  ['Juega una partida', 'Pasa un nivel en las Bolitas de Kapi.', 15, 'bolitas_nivel', true],
  ['Comparte Walá en tus redes', 'Sube una historia mencionándonos.', 20, '', false],
].map(([title, description, rewardPoints, actionKey, active], i) => misionDesdeFirestore({ id: `mis-${i}`, title, description, rewardPoints, actionKey, active, order: i }));
const RETOS_DEMO = [
  ['Tres deseos', 'Agrega 3 productos a tu lista de deseos.', 'add_wishlist', 3, 20, 'main'],
  ['Diseñador de la semana', 'Guarda 2 creaciones en el estudio.', 'save_creation', 2, 0, 'kapi_double_3d'],
  ['Foto con tu Walá', 'Sube una foto usando tu prenda.', 'upload_photo', 1, 50, 'main'],
].map(([title, description, actionType, goal, rewardCoins, rewardType], i) => retoDesdeFirestore({ id: `reto-${i}`, title, description, actionType, goal, rewardCoins, rewardType }));
// D5b: recompensas de ejemplo, con productos de la copia de la tienda.
// D5c: fechas de clientes alrededor de hoy (algunas sin año) y sus paquetes.
const HOY_DEMO = hoyLocal();
const enDias = (n, anio) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${anio}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const FECHAS_CRUDAS = [
  ['u1', 'valeria.quispe@gmail.com', 'r1', 'Lucía', 'Mamá', 'padres', 'Femenino', 'Cumpleaños', enDias(1, 1968), ['Plantas', 'Café'], 'S/ 50 a S/ 100'],
  ['u1', 'valeria.quispe@gmail.com', 'r2', 'Diego', 'Pareja', 'pareja', 'Masculino', 'Aniversario', enDias(5, 2019), ['Fútbol', 'Anime'], 'Hasta S/ 150'],
  ['u2', 'luis.mendoza@hotmail.com', 'r3', 'Andrea', 'Pareja', 'pareja', 'Femenino', 'Cumpleaños', enDias(12, 1995), ['Kapi', 'Tazas'], ''],
  ['u3', 'carla.rojas@gmail.com', 'r4', 'Martín', 'Hijos', 'hijos', 'Masculino', 'Cumpleaños', enDias(0, 2016), ['Dinosaurios'], 'Hasta S/ 60'],
  ['u3', 'carla.rojas@gmail.com', 'r5', 'Rosa', 'Amigos', 'amigos', 'Femenino', 'Cumpleaños', enDias(22, 0), [], ''],
  ['u4', 'jorge.salas@outlook.com', 'r6', 'Papá Jorge', 'Padres', 'padres', 'Masculino', 'Cumpleaños', enDias(40, 1960), ['Polos'], ''],
  ['u5', 'mafer.diaz@gmail.com', 'r7', 'Sofía', 'Hermanos', 'hermanos', 'Femenino', 'Graduación', enDias(9, 2026), ['Joyas'], 'S/ 100 a S/ 200'],
  ['u5', 'mafer.diaz@gmail.com', 'r8', 'Tío Beto', 'Otros', 'otros', 'Masculino', 'Cumpleaños', enDias(-20, 0), [], ''],
].map(([userId, userEmail, recipientId, recipientName, recipientRole, recipientRoleKey, recipientGender, eventType, fecha, selectedCategories, recipientBudget], i) => ({
  userId, userEmail, recipientId, recipientName, recipientRole, recipientRoleKey, recipientGender, eventType, selectedCategories, recipientBudget,
  eventId: `ev${i}`, eventDate: fecha.startsWith('0-') ? `0000${fecha.slice(1)}` : fecha,
}));
const FECHAS_DEMO = FECHAS_CRUDAS.map((f) => fechaClienteDesde(f, HOY_DEMO));
const productoDePaquete = (p) => ({ id: p.id, name: p.name, price: p.salePrice || p.price, image: p.mainImage || p.images?.[0] || '' });
const PAQUETES_DEMO = [
  { id: 'paq1', userId: 'u1', recipientId: 'r1', eventId: 'ev0', eventType: 'Cumpleaños', isSelected: true, products: TIENDA.productos.slice(0, 2).map(productoDePaquete) },
  { id: 'paq2', userId: 'u1', recipientId: 'r1', eventId: 'ev0', eventType: 'Cumpleaños', isSelected: false, products: TIENDA.productos.slice(4, 7).map(productoDePaquete) },
  { id: 'paq3', userId: 'u2', recipientId: 'r3', eventId: 'ev2', eventType: 'Cumpleaños', isSelected: false, products: TIENDA.productos.slice(8, 9).map(productoDePaquete) },
].map(paqueteDesdeFirestore);
const FESTIVAS_DEMO = FESTIVAS_DEFAULT.map(normalizarFestiva).concat(normalizarFestiva({
  id: 'dia_cancion_criolla', nombre: 'Día de la Canción Criolla', emoji: '🎸', regla: { tipo: 'fija', mes: 10, dia: 31 }, avisarDias: [], activo: false,
}), normalizarFestiva({
  id: 'black_friday', nombre: 'Black Friday', emoji: '🛍️', regla: { tipo: 'movil', mes: 11, diaSemana: 5, ordinal: 4 }, avisarDias: [7, 1], avisarATodos: true,
}));
// D5d: la configuración guardada (con un texto 2 en el carrito), guardadas, campañas y su comparación.
const CONFIG_NOTIF_DEMO = configNotificacionesDesde({
  categories: { promos: true, retention: false },
  copys: { cart_24h: { a: { text: 'El box que elegiste sigue en tu carrito.', emoji: '🎁', cta: '¿Terminamos de armarlo?' }, b: { text: '{nombre}, tu carrito te extraña.', emoji: '🛒', cta: 'Vuelve por él' } } },
});
const HORA_MS = 3600000;
const GUARDADAS_DEMO = [
  { id: 'bor1', title: '🎄 Navidad: envío gratis', body: 'Del 15 al 24 de diciembre, envío gratis en Lima. Pide con tiempo.', segment: 'all', link: '/tienda', updatedAt: Date.now() - 86400000 * 3 },
  { id: 'bor2', title: '💜 Solo para VIP', body: 'Tienes 20 % en tu próxima compra por tener más de 50 monedas.', segment: 'vip', image: TIENDA.productos[2].mainImage || TIENDA.productos[2].images?.[0] || '', updatedAt: Date.now() - 86400000 * 9 },
].map(campanaDesde);
const CAMPANAS_DEMO = [
  { id: 'c1', title: '🔥 2x1 en cajas de regalo', body: 'Solo hoy: lleva dos y paga una.', segment: 'all', status: 'sent', pushUsers: 412, inAppUsers: 1830, opened: 214, sentAt: Date.now() - 86400000 * 2, image: TIENDA.productos[0].mainImage || TIENDA.productos[0].images?.[0] || '' },
  { id: 'c2', title: '✨ Nuevo: Casaca One Piece', body: 'Llegó la casaca de Luffy. Míralo antes de que se agote.', segment: 'cart', status: 'scheduled', scheduledAt: Date.now() + HORA_MS * 26, link: '/producto/x' },
  { id: 'c3', title: 'Te extrañamos', body: 'Vuelve y recibe 10 monedas.', segment: 'inactive', status: 'cancelled', scheduledAt: Date.now() - 86400000 * 6 },
  { id: 'c4', title: 'Black Friday', body: 'Todo con 30 %.', segment: 'all', status: 'error', createdAt: Date.now() - 86400000 * 12 },
].map(campanaDesde);
const ESTADISTICAS_DEMO = [
  { id: 'cart_1h', a: { sent: 320, opened: 61 } },
  { id: 'cart_24h', a: { sent: 140, opened: 18 }, b: { sent: 152, opened: 31 } },
  { id: 'survey_3d', a: { sent: 40, opened: 9 }, b: { sent: 38, opened: 7 } },
  { id: 'orders', a: { sent: 980, opened: 540 } },
  { id: 'manual_promo', a: { sent: 1830, opened: 214 } },
];
// D5e: una encuesta parecida a la real (con una pregunta retirada y una que cambió de texto) y sus respuestas.
const ENCUESTA_DEMO = {
  introPanel: { title: '¡Queremos conocerte mejor!', subtitle: 'Tus respuestas nos ayudan a darte ideas a la medida.', description: 'Cuéntanos a quiénes regalas y te damos 15 monedas. Toma unos 2 minutos.', continueButtonText: 'Empezar', skipButtonText: 'No, gracias' },
  basicDataPanel: {
    title: 'Un poco sobre ti', subtitle: 'Para conocerte',
    fields: [
      { id: 'nombres', label: '¿Cómo te llamas?', type: 'text', required: true, options: [] },
      { id: 'familia', label: '¿Tienes familia?', type: 'select', required: false, enEncuesta: false, retiradaEl: '2026-09-14', options: ['Vivo solo/a', 'Vivo en pareja', 'Tengo hijos'] },
      { id: 'como_nos_conociste', label: '¿Cómo nos conociste?', type: 'select', required: false, antes: [{ label: '¿Dónde nos viste?', hasta: '2026-08-01' }], options: ['Instagram', 'TikTok', 'Un amigo', 'Ya compré en una de sus marcas'] },
    ],
  },
  personPanel: { budget: true, familySet: false },
  brandsPanel: {
    title: '¿Le gusta algo de esto?', subtitle: 'Toca lo que le gusta',
    categories: [
      { id: 'futbol', name: 'Fútbol', tiendaCategorias: ['polos'], fields: [{ id: 'equipo', label: '¿De qué equipo es?', type: 'text', required: false, options: [] }] },
      { id: 'anime', name: 'Anime', tiendaCategorias: [], fields: [{ id: 'serie', label: '¿Qué anime le gusta?', type: 'text', required: false, options: [] }, { id: 'personaje', label: '¿Personaje favorito?', type: 'text', refina: true, required: false, options: [] }] },
      { id: 'kapi', name: 'Kapi y tazas', fields: [] },
    ],
  },
  completionPanel: { title: '¡Listo!', message: 'Ya tienes tus 15 monedas.', buttonText: 'Ir a la tienda', askWhatsapp: true },
  design: { primaryColor: '#8b5cf6' },
  entregaPanel: { activo: true, monedas: 5 },
};
const CATEGORIAS_TIENDA_DEMO = [{ valor: 'polos', texto: 'Polos' }, { valor: 'casacas', texto: 'Casacas' }, { valor: 'tazas', texto: 'Tazas' }, { valor: 'joyas', texto: 'Joyas' }, { valor: 'skincare', texto: 'Skincare' }];
const msAtras = (dias, hora = 15) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(hora, 20, 0, 0); return d.getTime(); };
const USUARIOS_ENCUESTA = [
  ['Valeria Quispe', 'valeria.quispe@gmail.com', 1, { como_nos_conociste: 'Instagram' }, { pareja: true, padres: true }, [['Diego', 'pareja', 'Pareja', 'Masculino', '50a100', ['futbol'], { futbol: { equipo: 'Alianza Lima' } }], ['Lucía', 'padres', 'Mamá', 'Femenino', 'hasta50', ['kapi'], {}]], true, '1994-03-02'],
  ['Luis Mendoza', 'luis.mendoza@hotmail.com', 3, { como_nos_conociste: 'TikTok' }, { pareja: true }, [['Andrea', 'pareja', 'Pareja', 'Femenino', '100a200', ['anime'], { anime: { serie: 'One Piece', personaje: 'Luffy' } }]], false, ''],
  ['Carla Rojas', 'carla.rojas@gmail.com', 6, { como_nos_conociste: 'Un amigo', familia: 'Tengo hijos' }, { hijos: true, amigos: true }, [['Martín', 'hijos', 'Hijos', 'Masculino', 'hasta50', ['anime'], { anime: { serie: 'one piece' } }], ['Rosa', 'amigos', 'Amigos', 'Femenino', '', [], {}]], true, '1990-07-11'],
  ['Jorge Salas', 'jorge.salas@outlook.com', 12, { como_nos_conociste: 'Instagram' }, { padres: true }, [['Papá Jorge', 'padres', 'Padres', 'Masculino', 'mas200', ['futbol'], { futbol: { equipo: 'alianza lima' } }]], null, ''],
  ['Mafer Díaz', 'mafer.diaz@gmail.com', 20, { como_nos_conociste: 'Ya compré en una de sus marcas' }, { hermanos: true }, [['Sofía', 'hermanos', 'Hermanos', 'Femenino', '50a100', ['kapi', 'anime'], { anime: { serie: 'Dragon Ball' } }]], true, '1998-12-01'],
  ['Pedro Huamán', 'pedro.h@gmail.com', 45, { familia: 'Vivo en pareja' }, { pareja: true }, [], false, ''],
  ['Ana Torres', 'ana.torres@gmail.com', null, {}, { amigos: true }, [['Gaby', 'amigos', 'Amigos', 'Femenino', '', [], {}]], null, ''],
].map(([displayName, email, dias, surveyBasicData, giftRoles, personas, whatsapp, birthDate], i) => ({
  id: `enc-${i}`, displayName, email, hasCompletedSurvey: true, surveyCompletedAt: dias == null ? undefined : msAtras(dias), surveyBasicData, giftRoles, birthDate,
  marketingConsent: whatsapp == null ? undefined : { whatsapp }, phone: i % 2 ? '' : '+51 987 654 32' + i,
  giftRecipients: personas.map(([name, roleKey, roleDisplay, gender, budget, selectedCategories, categoryAnswers], j) => ({ id: `p${i}-${j}`, name, roleKey, roleDisplay, gender, budget, selectedCategories, categoryAnswers, events: [{ id: 'e', type: 'Cumpleaños', date: '0000-11-0' + (j + 3) }] })),
}));
const EMBUDO_DEMO = [
  { id: 'entraron', label: 'Entraron', total: 120, porcentaje: 100 },
  { id: 'no_gracias', label: 'Dijeron "No, gracias"', total: 18, porcentaje: 15, aparte: true },
  { id: 'empezaron', label: 'Empezaron', total: 96, porcentaje: 80 },
  { id: 'sobre_ti', label: 'Sobre ti', total: 40, porcentaje: 33, nota: 'solo a quien le falta algo por responder' },
  { id: 'grupos', label: '¿A quiénes sueles regalar?', total: 90, porcentaje: 75 },
  { id: 'personas', label: 'Cada persona', total: 71, porcentaje: 59, nota: 'solo si eligió algún grupo' },
  { id: 'whatsapp', label: 'Promociones por WhatsApp', total: 33, porcentaje: 28, nota: 'solo a quien no lo tenía activado' },
  { id: 'terminaron', label: 'Terminaron', total: 64, porcentaje: 53 },
];
const ENTREGAS_DEMO = [
  [5, ['Todo estuvo bien'], 'Llegó rapidísimo y el empaque precioso.', 1, 'WL-1042', 'Valeria Quispe'],
  [4, ['Tiempo de entrega'], 'Muy bonito, pero tardó un día más.', 2, 'WL-1038', 'Luis Mendoza'],
  [5, [], '', 3, 'WL-1031', 'Carla Rojas'],
  [3, ['Empaque', 'Precio'], 'La caja llegó un poco golpeada.', 5, 'WL-1020', 'Jorge Salas'],
  [5, ['Todo estuvo bien'], '', 8, 'WL-1011', 'Mafer Díaz'],
  [2, ['Atención', 'Tiempo de entrega'], 'Nadie respondía el WhatsApp.', 12, 'WL-0999', 'Pedro Huamán'],
  [4, [], 'Todo bien.', 40, 'WL-0950', 'Ana Torres'],
  [5, ['Todo estuvo bien'], 'Lo volvería a pedir.', 45, 'WL-0941', 'Rosa Díaz'],
].map(([estrellas, mejorar, comentario, dias, codigo, nombre], i) => ({ id: `ent-${i}`, estrellas, mejorar, comentario, fecha: msAtras(dias, 11), codigo, nombre, email: '' }));
// D6a: sorteos de ejemplo y los participantes de uno.
const fotoTienda = (i) => TIENDA.productos[i].mainImage || TIENDA.productos[i].images?.[0] || '';
const SORTEOS_DEMO = [
  { id: 'sor-1', titulo: 'Gran sorteo de Navidad', slug: 'gran-sorteo-de-navidad', descripcion: 'Participa gratis y gana un conjunto pareja.', tipo: 'gratis', numGanadores: 2, premio: { nombre: 'Conjunto Pareja', valor: 189, imagenUrl: fotoTienda(3) }, heroImagenUrl: fotoTienda(0), fechaInicio: diaKey(10), fechaFin: diaKey(-20), estado: 'activo', chanceExtraCompartir: true, chanceExtraReferido: true, contadorParticipantes: 214 },
  { id: 'sor-2', titulo: 'Rifa de la casaca One Piece', slug: 'rifa-casaca-one-piece', tipo: 'pagado', precioTicket: 5, numGanadores: 1, premio: { nombre: 'Casaca One Piece', valor: 109, imagenUrl: fotoTienda(8) }, fechaInicio: diaKey(3), fechaFin: diaKey(-11), estado: 'activo', requisitoApp: 'recomendado', contadorParticipantes: 58 },
  { id: 'sor-3', titulo: 'Sorteo de aniversario', slug: 'sorteo-de-aniversario', tipo: 'gratis', numGanadores: 1, premio: { nombre: 'Pack de stickers' }, fechaInicio: diaKey(60), fechaFin: diaKey(30), estado: 'cerrado', contadorParticipantes: 132, ganadores: [{ uid: 'u9', nombre: 'Rosa Díaz', correo: 'rosa.diaz@gmail.com' }], drawId: 'draw_8f2c' },
  { id: 'sor-4', titulo: 'Día de la Madre', tipo: 'gratis', numGanadores: 3, estado: 'borrador' },
].map(sorteoDesdeFirestore);
const PARTICIPANTES_DEMO = [
  ['Valeria Quispe', 'valeria.quispe@gmail.com', '987654321', '', 3, 0, 5, true],
  ['Luis Mendoza', 'luis.mendoza@hotmail.com', '', '45678912', 1, 0, 1, false],
  ['Carla Rojas', 'carla.rojas@gmail.com', '912345678', '', 2, 0, 4, true],
  ['Jorge Salas', '', '998877665', '41234567', 1, 0, 1, false],
  ['Mafer Díaz', 'mafer.diaz@gmail.com', '', '', 1, 0, 2, true],
].map(([nombre, correo, telefono, dni, tickets, ticketsPagados, chancesTotal, origenApp], i) => participanteDesde({ id: `par-${i}`, nombre, correo, telefono, dni, tickets, ticketsPagados, chancesTotal, origenApp, estado: 'elegible' }));
// D6b: campañas de suscripción, sus suscriptores, beneficios y galería.
const CAMPANAS_SUS_DEMO = [
  { id: 'sus-1', titulo: 'No hay sin suerte', slug: 'no-hay-sin-suerte', descripcion: 'Suscríbete y entra cada mes al sorteo de una casaca.', estado: 'activo', numGanadores: 1, heroImagenUrl: fotoTienda(8), colores: { primario: '#5b21b6', fondo: '#faf7ff', texto: '#1e1033', acento: '#7c3aed' }, premios: [{ nombre: 'Casaca One Piece', imagenUrl: fotoTienda(8) }], contadorSuscriptores: 86,
    planes: [{ id: 'p-m', nombre: 'Mensual', intervalo: 'mensual', precioCentimos: 1990, precioUsd: 5.5, beneficios: ['Envío gratis'] }, { id: 'p-t', nombre: 'Trimestral', intervalo: 'trimestral', precioCentimos: 4990, chancesPorCiclo: 4, beneficios: ['Envío gratis', '10 % en tu pedido'], destacado: true }] },
  { id: 'sus-2', titulo: 'Club Kapi', slug: 'club-kapi', estado: 'borrador', numGanadores: 3, planes: [{ id: 'p-a', nombre: 'Anual', intervalo: 'anual', precioCentimos: 0 }] },
].map(campanaSuscripcionDesde);
const SUSCRIPTORES_DEMO = [
  ['Valeria Quispe', 'valeria.quispe@gmail.com', 'p-t', 'activo', 40, 8, 'culqi'],
  ['Luis Mendoza', 'luis.mendoza@hotmail.com', 'p-m', 'activo', 12, 3, 'paypal'],
  ['Carla Rojas', 'carla.rojas@gmail.com', 'p-m', 'pendiente_pago', 2, 2, 'culqi'],
  ['Jorge Salas', 'jorge.salas@outlook.com', 'p-m', 'vencido', -15, 1, 'culqi'],
  ['Mafer Díaz', 'mafer.diaz@gmail.com', 'p-t', 'cancelado', 20, 4, 'culqi'],
].map(([nombre, correo, planId, estado, dias, chancesTotal, metodoPago], i) => suscriptorDesde({ id: `ss-${i}`, nombre, correo, planId, estado, vigenciaHasta: Date.now() + dias * 86400000, chancesTotal, metodoPago }, CAMPANAS_SUS_DEMO[0].planes));
const BENEFICIOS_DEMO = [
  { id: 'b1', marca: 'Kapi Café', titulo: 'En todas las bebidas', descuento: '20 %', categoria: 'Cafetería', ubicacion: 'Miraflores', orden: 0 },
  { id: 'b2', marca: 'Daida Hogar', titulo: 'En cómodas', descuento: 'S/ 50', categoria: 'Muebles', orden: 1 },
].map(beneficioDesde);
const GALERIA_DEMO = [
  { id: 'g1', nombre: 'Rosa D.', premio: 'Casaca One Piece', fecha: 'Setiembre 2026', orden: 0 },
  { id: 'g2', nombre: 'Andrés P.', premio: 'Conjunto Pareja', fecha: 'Octubre 2026', orden: 1 },
].map(ganadorGaleriaDesde);
// D6c: páginas de enlaces con sus clics y de dónde llegan.
const PAGINAS_ENLACES_DEMO = [
  { id: 'enl-1', titulo: 'Walá · Regalos', slug: 'wala', descripcion: 'Regalos personalizados en Lima. Pide por WhatsApp o en la tienda.', avatarUrl: '/assets/kapi/kapi-happy.webp', visitas: 1240, estado: 'activo',
    diseno: { buttonStyle: 'solid', cornerRoundness: 18, buttonShadow: 'soft', buttonColor: '#ffffff', buttonTextColor: '#4c1d95', titleColor: '#ffffff', textColor: '#ede9fe', background: { type: 'gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }, fontFamily: "'Poppins', sans-serif" },
    botones: [{ id: 'b-wsp', titulo: 'Escríbenos por WhatsApp', url: 'https://wa.me/51924426791', order: 0 }, { id: 'b-tienda', titulo: 'La tienda', url: 'https://wala.pe/tienda', order: 1, thumbnailUrl: fotoTienda(0) }, { id: 'b-crear', titulo: 'Diseña tu polo', url: 'https://wala.pe/crear', order: 2 }],
    redes: [{ id: 'r-ig', tipo: 'instagram', nombre: '@wala.pe', url: 'https://instagram.com/wala.pe', order: 0 }, { id: 'r-tt', tipo: 'tiktok', nombre: '@wala', url: 'https://tiktok.com/@wala', order: 1 }] },
  { id: 'enl-2', titulo: 'Catálogo de Navidad', slug: 'navidad', estado: 'borrador', visitas: 0, botones: [], redes: [] },
].map(paginaEnlacesDesde);
const CLICS_DEMO = { 'b-wsp': 312, 'b-tienda': 190, 'b-crear': 64, 'r-ig': 41, 'r-tt': 12 };
const ANALITICA_ENLACES_DEMO = {
  porPais: [{ key: 'Perú', visitas: 1102, clics: 560 }, { key: 'Chile', visitas: 61, clics: 22 }, { key: 'Estados Unidos', visitas: 40, clics: 9 }],
  porDispositivo: [{ key: 'Celular', visitas: 1080, clics: 549 }, { key: 'Computadora', visitas: 160, clics: 70 }],
  porDia: Array.from({ length: 7 }, (_, i) => ({ dia: diaKey(i), visitas: 40 + ((i * 17) % 30), clics: 18 + ((i * 11) % 15) })),
};
// D6d: popups, páginas del editor y temas.
const POPUPS_DEMO = [
  normalizarPopup({ ...POPUP_ENCUESTA_DEFAULT, activo: true }),
  normalizarPopup({ id: 'live-viernes', nombre: 'Live del viernes', activo: true, formato: 'imagen', objetivo: 'enlace', titulo: 'Este viernes a las 8 p. m. sorteamos en vivo', imagenUrl: fotoTienda(2), botonUrl: '/sorteos', audiencia: 'todos', paginas: 'elegidas', rutas: ['/', '/tienda', '/producto/*'], disparador: 'scroll', scrollPct: 50, cooldownDias: 2, prioridad: 5, desde: diaKey(3), hasta: diaKey(-4) }),
  normalizarPopup({ id: 'registro', nombre: 'Crea tu cuenta', activo: false, formato: 'tarjeta', objetivo: 'registro', titulo: '10 monedas por crear tu cuenta', texto: 'Y guarda tus diseños para pedirlos cuando quieras.', botonTexto: 'Crear mi cuenta', audiencia: 'anonimos', disparador: 'salida', segundos: 20 }),
];
const ESTADISTICAS_POPUPS_DEMO = { [POPUPS_DEMO[0].id]: { vistas: 4120, clics: 610, cierres: 3200, conversiones: 233 }, 'live-viernes': { vistas: 880, clics: 142, cierres: 690, conversiones: 0 } };
const MARCAS_PAGINAS = MARCAS_TIENDA.slice(0, 3).map((m) => ({ id: m.id, slug: m.slug, name: m.name }));
const LANDINGS_DEMO = [
  { id: 'promo-navidad', title: 'Promo Navidad 2026', slug: 'promo-navidad', slugsAnteriores: ['navidad-2025'] },
  ...(MARCAS_PAGINAS[0] ? [{ id: MARCAS_PAGINAS[0].slug, title: MARCAS_PAGINAS[0].name, slug: MARCAS_PAGINAS[0].slug, brandId: MARCAS_PAGINAS[0].id }] : []),
  { id: 'dia-padre', title: 'Día del Padre', slug: 'dia-del-padre', brandId: MARCAS_PAGINAS[1]?.id || '' },
].map((p) => landingDesde(p, MARCAS_PAGINAS));
const TEMAS_DEMO = [
  { id: 't1', name: 'Oscuro', author: 'Walá', type: 'custom_css', version: '1.0', cssContent: '.landing { background: #0f1020; color: #fff; }\n.landing h1 { font-weight: 900; }' },
  { id: 't2', name: 'Astra', author: 'Brainstorm Force', type: 'wordpress_import', version: '4.1', cssContent: 'body{margin:0}'.repeat(900) },
].map(temaDesde);
// D7a: la palabra del día, los retos patrocinados, los mundos, los premios y las métricas de las Bolitas.
const PALABRAS_DEMO = [['REGALO', -1], ['FELIZ', 0], ['NAVIDAD', 3], ['PAREJA', 9]].map(([word, d]) => ({ id: diaKey(-d), word }));
const PATROCINIOS_DEMO = [
  { fecha: diaKey(0), marcaId: MARCAS_PAGINAS[0]?.id, marcaNombre: MARCAS_PAGINAS[0]?.name, cupo: 50, entregados: 31, activo: true, cupon: { tipo: 'descuento', descuentoPct: 15, topeDescuento: 30, vigenciaDias: 15 } },
  { fecha: diaKey(-4), marcaId: MARCAS_PAGINAS[1]?.id, marcaNombre: MARCAS_PAGINAS[1]?.name, cupo: 100, entregados: 0, activo: true, cupon: { tipo: 'envio_gratis', vigenciaDias: 7 } },
];
const PREMIOS_BOLITAS_DEMO = premiosBolitasDesde({ activo: true, puestos: [{ desde: 1, hasta: 1, cupon: { tipo: 'descuento', descuentoMonto: 30, vigenciaDias: 30 } }, { desde: 2, hasta: 5, marcaId: MARCAS_PAGINAS[0]?.id, cupon: { tipo: 'descuento', descuentoPct: 20, topeDescuento: 40, vigenciaDias: 15 } }] });
const metricasBolitasDemo = (dias) => ({
  porDia: Array.from({ length: dias }, (_, i) => ({ fecha: diaKey(i), partidas: 40 + ((i * 13) % 25), retos: 12 + ((i * 7) % 9), clics: 3 + (i % 5), niveles: {}, clicsPorMarca: { [MARCAS_PAGINAS[0]?.id]: 2 + (i % 3), [MARCAS_PAGINAS[1]?.id]: i % 2 } })),
  jugadores: { jugadores: 412, vuelven: { cantidad: 190, base: 412 }, siguen7: { cantidad: 96, base: 380 }, trabados: { 18: 22, 7: 41, 33: 9, 12: 30 } },
});
// D7b: los premios de la ruleta (uno solo los viernes, uno agotado), su config y lo que se ganó.
const PREMIOS_RULETA_DEMO = [
  { id: 'r1', nombre: '10 monedas', icono: '🪙', tipo: 'monedas', monedas: 10, probabilidad: 40, stockUsado: 120 },
  { id: 'r2', nombre: '20 monedas', icono: '💰', tipo: 'monedas', monedas: 20, probabilidad: 20, stockUsado: 48 },
  { id: 'r3', nombre: '10 % en tu pedido', etiqueta: '10 %', icono: '🎟️', tipo: 'descuento', descuentoPct: 10, topeDescuento: 20, probabilidad: 15, stockUsado: 9 },
  { id: 'r4', nombre: 'Envío gratis', icono: '🚚', tipo: 'envio_gratis', probabilidad: 10, dias: [5], stockUsado: 3 },
  { id: 'r5', nombre: 'Peluche de Kapi', etiqueta: 'Peluche', icono: '🧸', tipo: 'manual', probabilidad: 2, stockTotal: 5, stockUsado: 5, color: '#e04f8f' },
  { id: 'r6', nombre: 'Sigue intentando', etiqueta: 'Otra vez', icono: '🍀', tipo: 'nada', probabilidad: 12 },
].map(normalizarPremio);
const GANADOS_RULETA_DEMO = [
  { id: 'g1', displayName: 'Valeria Quispe', email: 'valeria.quispe@gmail.com', texto: 'Peluche de Kapi', tipo: 'manual', weekStart: diaKey(7), entregado: false },
  { id: 'g2', displayName: 'Luis Mendoza', email: 'luis.mendoza@hotmail.com', texto: '10 % en tu pedido', tipo: 'descuento', cuponCode: 'RUL-8KQ2', weekStart: diaKey(7) },
  { id: 'g3', displayName: 'Carla Rojas', email: 'carla.rojas@gmail.com', texto: 'Peluche de Kapi', tipo: 'manual', weekStart: diaKey(14), entregado: true },
  { id: 'g4', displayName: 'Jorge Salas', email: 'jorge.salas@outlook.com', texto: '20 monedas', tipo: 'monedas', weekStart: diaKey(14) },
].map(ganadoRuletaDesde);
// D8a: el equipo (el primero es quien mira), lo que queda por pasar a WebP y las traducciones juntadas.
const YO_DEMO = 'isaac.castro@gmail.com';
const ADMINS_DEMO = [
  { id: YO_DEMO, email: YO_DEMO, name: 'Isaac Castro', permissions: ['superadmin'] },
  { id: 'mariela.torres@gmail.com', email: 'mariela.torres@gmail.com', name: 'Mariela Torres', permissions: ['manage_design', 'manage_clients'] },
  { id: 'diego.ramos@gmail.com', email: 'diego.ramos@gmail.com', name: 'Diego Ramos', permissions: ['manage_products', 'manage_inventory', 'manage_landing_pages'] },
  { id: 'almacen.wala@gmail.com', email: 'almacen.wala@gmail.com', permissions: ['manage_inventory'] },
].map(adminDesdeFirestore);
// D8b: los números guardados (Crear vacío: usa el de la tienda), las copias del editor y los cambios de stock.
const WHATSAPP_DEMO = whatsappDesdeMensajes({ whatsapp_number_tienda: '987 654 321', whatsapp_number_cuenta: '+51 912 345 678', whatsapp_mostrar_en_acceso: 'no' });
const horasAtras = (h) => new Date(Date.now() - h * 3600000).toISOString();
const COPIAS_DEMO = [
  { id: 'log1', timestamp: horasAtras(2), pageId: 'home', user: 'Admin', description: 'Guardado desde el Editor Visual (Página: home)', config: { sections: [] } },
  { id: 'log2', timestamp: horasAtras(26), pageId: 'promo-navidad', user: 'Admin', description: 'Guardado desde el Editor Visual (Página: promo-navidad)', config: { sections: [] } },
  { id: 'log3', timestamp: horasAtras(30), pageId: 'home', user: 'Admin', description: 'Guardado desde el Editor Visual (Página: home)', config: { sections: [] } },
  { id: 'log4', timestamp: horasAtras(75), pageId: 'tienda', user: 'Admin', description: 'Guardado desde el Editor Visual (Página: tienda)', config: { sections: [] } },
  { id: 'log5', timestamp: horasAtras(170), pageId: 'home', user: 'Admin', description: 'Guardado desde el Editor Visual (Página: home)', config: { sections: [] } },
].map(cambioDisenoDesde);
const MOVIMIENTOS_DEMO = [
  [1, 12, 10, 'diego.ramos@gmail.com'], [3, 0, 24, 'almacen.wala@gmail.com'], [6, 5, 4, 'diego.ramos@gmail.com'],
  [30, 8, 15, 'almacen.wala@gmail.com'], [52, 3, 1, 'mariela.torres@gmail.com'], [80, 20, 20, 'diego.ramos@gmail.com'],
].map(([h, antes, despues, quien], i) => movimientoInventarioDesde({
  id: `inv${i}`, timestamp: Date.now() - h * 3600000, productId: TIENDA.productos[i % TIENDA.productos.length].id,
  productName: TIENDA.productos[i % TIENDA.productos.length].name, oldStock: antes, newStock: despues, userEmail: quien,
}));
const IMAGENES_DEMO = { diseno: { imagenes: 4, documentos: 3, apariciones: 6 }, productos: { imagenes: 37, documentos: 21, apariciones: 37 } };
const RECOMPENSAS_DEMO = [
  { title: 'Pack de stickers Kapi', description: 'Seis stickers para tu laptop o celular.', cost: 120, tipo: 'manual', value: 'Sale del cajón de mercancía', imageUrl: '/assets/kapi/kapi-happy.webp' },
  { title: '10% en tu pedido', description: 'Hasta S/ 20 de descuento.', cost: 300, tipo: 'descuento', descuentoPct: 10, topeDescuento: 20, vigenciaDias: 30 },
  { title: 'S/ 15 de descuento', cost: 450, tipo: 'descuento', descuentoMonto: 15, vigenciaDias: 15 },
  { title: 'Envío gratis', description: 'Para cualquier pedido en Lima.', cost: 200, tipo: 'envio_gratis', vigenciaDias: 30 },
  { title: 'Producto de regalo', cost: 900, tipo: 'producto_gratis', productId: TIENDA.productos[3].id, productName: TIENDA.productos[3].name, vigenciaDias: 20, active: false },
].map((r, i) => recompensaAdminDesdeFirestore({ id: `rec-${i}`, order: i, ...r }));
const CLIENTES_RES = [
  ['u1', 'Valeria Quispe', 'valeria@correo.pe', '71234567', 2], ['u2', 'Diego Fernández', 'diego@correo.pe', '', 0], ['u3', 'Camila Rojas', 'camila@correo.pe', '72345678', 0],
  ['u4', 'Luis Mendoza', 'luis@correo.es', '', 3], ['u5', 'Rosa Huamán', 'rosa@correo.pe', '45678912', 0], ['u6', 'Kevin Ramos', 'kevin@correo.pe', '', 1],
].map(([uid, nombre, email, dni, cartUnits]) => ({ uid, nombre, email, dni, cartCount: cartUnits ? 1 : 0, cartUnits }));
function fichaDemo(c) {
  const p = TIENDA.productos;
  return {
    nombre: c.nombre, email: c.email, dni: c.dni, tipoDocumento: c.dni ? 'DNI' : '', phone: c.uid === 'u3' ? '' : '987654321', monedas: 1200 + c.cartUnits * 150, hasCompletedSurvey: c.uid !== 'u2',
    marketingConsent: { whatsapp: c.uid !== 'u2' }, createdAtMs: Date.now() - 86400000 * 120, birthdayLegible: c.uid === 'u1' ? '14 de noviembre' : '',
    wishlist: { count: 2, items: [{ productId: p[2].id, productName: p[2].name, productImage: p[2].mainImage, price: p[2].salePrice || p[2].price, addedAt: Date.now() - 86400000 * 9 }, { productId: p[4].id, productName: p[4].name, productImage: p[4].mainImage, price: p[4].price, isGifted: true, giftedBy: 'Luis' }] },
    cart: c.cartUnits ? { count: 1, unidades: c.cartUnits, totalEstimado: c.cartUnits * (p[0].salePrice || p[0].price), items: [{ productId: p[0].id, productName: p[0].name, productImage: p[0].mainImage, quantity: c.cartUnits, price: p[0].salePrice || p[0].price, subtotal: c.cartUnits * (p[0].salePrice || p[0].price), selected: true }, { productId: p[1].id, productName: p[1].name, productImage: p[1].mainImage, quantity: 1, price: p[1].price, subtotal: p[1].price, selected: false }] } : { count: 0, unidades: 0, totalEstimado: 0, items: [] },
    giftRecipients: c.uid === 'u1' ? [{ id: 'g1', name: 'Andrés', roleDisplay: 'Pareja', events: [{ label: 'Cumpleaños', dateLegible: '3 de diciembre' }, { label: 'Aniversario', dateLegible: '14 de febrero' }] }] : [],
  };
}
const actividadDemo = (c) => ({
  metrics: { totalSessions: 14 + c.cartUnits * 3, totalPageViews: 61, totalDwellMs: 1840000, activeDays: 9, lastAccessAtMs: Date.now() - 3600000 * 5 },
  sessions: c.uid === 'u1' ? [{ clientType: 'APP' }, { clientType: 'APP' }, { clientType: 'WEB' }] : [{ clientType: 'WEB' }],
  estimatedSummary: c.uid === 'u4' ? { isEstimated: true, orderCount: 3, totalSpent: 389.7, firstOrderAtMs: Date.now() - 86400000 * 400, lastOrderAtMs: Date.now() - 86400000 * 200 } : null,
  productInterest: TIENDA.productos.slice(0, 4).map((p, i) => ({ productId: p.id, dwellMs: (300 - i * 60) * 1000, views: 4 - i })),
});
const CUMPLES_DEMO = {
  proximosCumpleanos: [
    { uid: 'u5', nombre: 'Rosa Huamán', esTitular: true, fecha: '11-02', fechaLegible: '2 de noviembre', enDias: 0 },
    { uid: 'u1', nombre: 'Valeria Quispe', esTitular: true, fecha: '11-14', fechaLegible: '14 de noviembre', enDias: 12 },
    { uid: 'u1', nombre: 'Valeria Quispe', dePersona: 'Andrés', esTitular: false, fecha: '11-05', fechaLegible: '5 de noviembre', enDias: 3 },
    { uid: 'u6', nombre: 'Kevin Ramos', dePersona: 'Su mamá', esTitular: false, fecha: '11-28', fechaLegible: '28 de noviembre', enDias: 26 },
  ].sort((a, b) => a.enDias - b.enDias),
  truncated: false,
};
const AVISOS_RESULTADOS = [
  { id: 'carritos', nivel: 'alta', titulo: '4 carritos abandonados con contacto', texto: 'Dejaron productos en el carrito y tienen WhatsApp: escríbeles hoy.', to: '/admin/resultados/clientes' },
  { id: 'vistos-sin-venta', nivel: 'media', titulo: 'El Polo clásico se mira mucho y se vende poco', texto: '320 vistas y 2 ventas: revisa la foto, el precio o las tallas.', to: '/admin/resultados/productos' },
  { id: 'busqueda', nivel: 'media', titulo: 'Buscan «tomatodo azul» y no hay', texto: '14 búsquedas sin resultado en este periodo.', to: '/admin/resultados/productos' },
  { id: 'enlaces', nivel: 'baja', titulo: '2 enlaces rotos', texto: 'Gente que llegó a una dirección que no existe.', to: '#enlaces' },
];
const ENLACES_ROTOS_DEMO = {
  visitas: 23,
  enlaces: [
    { direccion: '/cyber-wala', slug: 'cyber-wala', visitas: 15, personas: 11, ultimaMs: Date.now() - 3600000 * 5, origenes: [{ origen: 'Instagram', visitas: 9 }, { origen: 'QR', visitas: 4 }, { origen: 'Directo', visitas: 2 }] },
    { direccion: '/producto/polo-viejo-123', slug: null, visitas: 6, personas: 5, ultimaMs: Date.now() - 86400000, origenes: [{ origen: 'Google', visitas: 6 }] },
    { direccion: '/navidad', slug: 'navidad', resueltaA: 'navidad-2026', visitas: 2, personas: 2, ultimaMs: Date.now() - 86400000 * 3, origenes: [{ origen: 'WhatsApp', visitas: 2 }] },
  ],
  landings: [{ id: 'l1', title: 'Navidad 2026', slug: 'navidad-2026' }, { id: 'l2', title: 'Día de la Madre', slug: 'dia-de-la-madre' }],
};
const PESTANAS_RESULTADOS = [
  { id: 'resumen', texto: 'Resumen' }, { id: 'productos', texto: 'Productos' }, { id: 'visitantes', texto: 'Visitantes' },
  { id: 'clientes', texto: 'Clientes', soloClientes: true }, { id: 'opiniones', texto: 'Opiniones', soloClientes: true }, { id: 'tecnico', texto: 'Detalle técnico' },
];
const PACKS_CRUDOS = CREAR.combos.map((c) => ({ ...c, esComboCrear: true, comboCrear: { publicado: c.publicado, piezas: c.piezas, tallas: 'auto' } }));
const opcionDePrenda = (p) => ({ id: p.id, nombre: p.name, foto: (p.variants || [])[0]?.imageUrl || p.prendaBase?.vistas?.[0]?.imagen || '', precio: Number(p.salePrice) > 0 ? p.salePrice : p.price, colores: (p.variants || []).map((v) => ({ id: String(v.id), nombre: v.name, hex: v.colorHex })) });
const TAL_CUAL = TIENDA.productos.filter((p) => (p.variants || []).length && !p.isComboProduct).map(opcionDePrenda);
const BORRADORES = [{ id: 'borrador-1', nombre: 'Polo Kapi edición Navidad', fecha: 'Hace 2 días' }];
// Lo que deduciría giftRecommender, a grandes rasgos (solo para la demo).
const sugerenciaDemo = (p) => {
  const n = p.nombre.toLowerCase();
  return {
    publico: /ella|mujer|collagen|mask|cream|balm/.test(n) ? 'mujer' : /él |hombre/.test(n) ? 'hombre' : /pareja|conjunto/.test(n) ? 'unisex' : null,
    edadMinima: 0,
    equipo: /alianza/.test(n) ? 'Alianza Lima' : /universitario/.test(n) ? 'Universitario' : null,
  };
};
const MAS_VENDIDOS = [3, 8, 12, 0, 20, 15].map((i, k) => ({ id: TIENDA.productos[i].id, unidades: [41, 33, 27, 19, 12, 7][k] }));
const MUESTRAS = (() => {
  const m = {};
  TIENDA.productos.forEach((p) => { if (p.brandId && !m[p.brandId] && p.mainImage) m[p.brandId] = tarjetaDesdeProducto(p); });
  return m;
})();
const WHATSAPP = { principal: '', multimarca: false, fabrica: '+51924426791' };

const espera = (ms) => new Promise((r) => { window.setTimeout(r, ms); });

/* Una lista de la demo con su guardar y eliminar simulados. */
function useListaDemo(inicial, falla) {
  const [lista, setLista] = useState(inicial);
  const guardar = useCallback(async (datos, id) => {
    await espera(700);
    if (falla) throw new Error('Sin conexión con el servidor (es una prueba). Lo escrito sigue aquí.');
    setLista((l) => (id ? l.map((x) => (x.id === id ? { ...x, ...datos } : x)) : [...l, { ...datos, id: `nuevo-${Date.now()}` }]));
  }, [falla]);
  const eliminar = useCallback(async (id) => {
    await espera(600);
    if (falla) throw new Error('Sin conexión con el servidor (es una prueba).');
    setLista((l) => l.filter((x) => x.id !== id));
  }, [falla]);
  return [lista, guardar, eliminar, setLista];
}

function PanelDePrueba() {
  const toast = useToast();
  const [perfil, setPerfil] = useState('super');
  const [tamano, setTamano] = useState('ancho');
  const [estados, setEstados] = useState([]);
  const [ruta, setRuta] = useState('/admin/categorias');
  const marco = useRef(null);
  const p = PERFILES.find((x) => x.id === perfil);
  const grupos = useMemo(() => menuAdminPara(p.permisos), [p]);
  const accesos = useMemo(() => accesosAdminPara(p.permisos), [p]);
  const con = (e) => estados.includes(e);
  const falla = con('falla');

  const [categorias, guardarCategoria, eliminarCategoria, setCategorias] = useListaDemo(CATEGORIAS, falla);
  const [colecciones, guardarColeccion, eliminarColeccion, setColecciones] = useListaDemo(COLECCIONES, falla);
  const [zonas, guardarZona, eliminarZona] = useListaDemo(ZONAS, falla);
  const [marcas, guardarMarca, eliminarMarca, setMarcas] = useListaDemo(MARCAS, falla);
  const [actualizando, setActualizando] = useState(false);
  const [enlaces, setEnlaces] = useState(ENLACES_DEMO);
  const [configPagos, setConfigPagos] = useState(CONFIG_PAGOS_DEMO);
  const [reclamos, setReclamos] = useState(RECLAMOS_DEMO);
  const [resPeriodo, setResPeriodo] = useState('30');
  const [resFechas, setResFechas] = useState({ desde: diaKey(13), hasta: diaKey(0) });
  const [resComparar, setResComparar] = useState(true);
  const [rotos, setRotos] = useState(ENLACES_ROTOS_DEMO);
  const [resBusqueda, setResBusqueda] = useState('');
  const [resCliente, setResCliente] = useState(null);
  const [resFicha, setResFicha] = useState('resumen');
  const [resVisibles, setResVisibles] = useState(4);
  const [resEncuesta, setResEncuesta] = useState('entregas');
  const [resOrigen, setResOrigen] = useState('todos');
  const [resDiseno, setResDiseno] = useState('todos');
  const [resAncho, setResAncho] = useState('todos');
  const [resSinOrigen, setResSinOrigen] = useState(true);
  const [misiones, guardarMisionCruda, eliminarMision] = useListaDemo(MISIONES_DEMO, falla);
  const [fechasPestana, setFechasPestana] = useState('calendario');
  const [notifPestana, setNotifPestana] = useState('automaticos');
  const [sorteos, guardarSorteoCrudo, eliminarSorteo, setSorteos] = useListaDemo(SORTEOS_DEMO, falla);
  const [participantes, setParticipantes] = useState(PARTICIPANTES_DEMO);
  const [campanasSus, guardarCampanaSusCruda, eliminarCampanaSus, setCampanasSus] = useListaDemo(CAMPANAS_SUS_DEMO, falla);
  const [suscriptores, setSuscriptores] = useState(SUSCRIPTORES_DEMO);
  const [beneficiosSus, guardarBeneficioSus, eliminarBeneficioSus] = useListaDemo(BENEFICIOS_DEMO, falla);
  const [galeriaSus, guardarGanadorSus, eliminarGanadorSus] = useListaDemo(GALERIA_DEMO, falla);
  const [susPestana, setSusPestana] = useState('suscriptores');
  const [paginasEnlaces, guardarPaginaEnlacesCruda, eliminarPaginaEnlaces, setPaginasEnlaces] = useListaDemo(PAGINAS_ENLACES_DEMO, falla);
  const [enlacePestana, setEnlacePestana] = useState('contenido');
  const [popups, setPopups] = useState(POPUPS_DEMO);
  const [kapi, setKapi] = useState('/assets/kapi/kapi-happy.webp');
  const [palabras, setPalabras] = useState(PALABRAS_DEMO);
  const [patrocinios, setPatrocinios] = useState(PATROCINIOS_DEMO);
  const [mundosBolitas, setMundosBolitas] = useState(MARCAS_PAGINAS.slice(0, 2).map((m) => ({ id: m.id, nombre: m.name })));
  const [premiosBolitas, setPremiosBolitas] = useState(PREMIOS_BOLITAS_DEMO);
  const [bolitasPestana, setBolitasPestana] = useState('patrocinios');
  const [diasBolitas, setDiasBolitas] = useState(14);
  const [premiosRuleta, setPremiosRuleta] = useState(PREMIOS_RULETA_DEMO);
  const [configRuleta, setConfigRuleta] = useState(() => normalizarConfig({}));
  const [ganadosRuleta, setGanadosRuleta] = useState(GANADOS_RULETA_DEMO);
  const [ruletaPestana, setRuletaPestana] = useState('premios');
  const [admins, setAdmins] = useState(ADMINS_DEMO);
  const [bloqueadas, setBloqueadas] = useState(['footer']);
  const imagenesPendientes = useRef(IMAGENES_DEMO); // un ref: revisar justo después de convertir lee lo nuevo
  const traduccionesDemo = useRef({ en: 14, pt: 3 });
  const [configPestana, setConfigPestana] = useState('equipo');
  const [whatsappDemo, setWhatsappDemo] = useState(WHATSAPP_DEMO);
  const [copias, setCopias] = useState(COPIAS_DEMO);
  const [historialPestana, setHistorialPestana] = useState('diseno');
  const [landings, guardarLandingCruda, eliminarLanding] = useListaDemo(LANDINGS_DEMO, falla);
  const [temas, guardarTemaCrudo, eliminarTema, setTemas] = useListaDemo(TEMAS_DEMO, falla);
  const [encuesta, setEncuesta] = useState(ENCUESTA_DEMO);
  const [encuestaPestana, setEncuestaPestana] = useState('portada');
  const [configNotif, setConfigNotif] = useState(CONFIG_NOTIF_DEMO);
  const [guardadasNotif, setGuardadasNotif] = useState(GUARDADAS_DEMO);
  const [campanas, setCampanas] = useState(CAMPANAS_DEMO);
  const [festivas, setFestivas] = useState(FESTIVAS_DEMO);
  const [diasAviso, setDiasAviso] = useState([7, 1]);
  const [paquetes, setPaquetes] = useState(PAQUETES_DEMO);
  const [recompensas, guardarRecompensaCruda, eliminarRecompensa] = useListaDemo(RECOMPENSAS_DEMO, falla);
  const [retos, guardarRetoCrudo, eliminarReto] = useListaDemo(RETOS_DEMO, falla);
  const [retoActivo, setRetoActivo] = useState(() => retoActivoDesde(RETOS_DEMO[0], new Date(Date.now() - 86400000 * 2)));
  const [evidencias, setEvidencias] = useState(() => [
    { id: 'ev1', challengeId: 'reto-2', userName: 'Valeria Quispe', userId: 'u1', evidenceType: 'image', evidenceUrl: TIENDA.productos[0].mainImage || TIENDA.productos[0].images?.[0] || TIENDA.productos[2].mainImage, submittedAt: Date.now() - 3600000 * 5 },
    { id: 'ev2', challengeId: 'reto-0', userName: 'Luis Mendoza', userId: 'u4', evidenceType: 'link', evidenceUrl: 'https://instagram.com/p/demo', submittedAt: Date.now() - 86400000 },
  ]);
  const [atributos, setAtributos] = useState(ATRIBUTOS_DEMO);
  const [productos, setProductos] = useState(PRODUCTOS);
  const [whatsapp, setWhatsapp] = useState(WHATSAPP);
  const [borradores, setBorradores] = useState(BORRADORES);
  const [crudos, setCrudos] = useState(CRUDOS);
  const [prendasCrudas, setPrendasCrudas] = useState(PRENDAS_CRUDAS);
  const [packsCrudos, setPacksCrudos] = useState(PACKS_CRUDOS);
  const [creados, setCreados] = useState({ categoria: [], coleccion: [], tipo: [], personaje: [], etiqueta: [] });

  const navegar = useRef(null);
  navegar.current = (to) => {
    if (!to.startsWith('/admin')) {
      toast({ tipo: 'info', titulo: 'En el admin abriría la tienda', texto: to, duracion: 2200 });
      return;
    }
    setRuta(to);
    if (marco.current) marco.current.scrollTop = 0;
  };
  const rutaSola = ruta.split('?')[0];
  const verDeRuta = new URLSearchParams(ruta.split('?')[1] || '').get('ver') || 'tienda';
  const EnlaceAdmin = useMemo(() => forwardRef(function EnlaceAdmin({ to, onClick, children, ...rest }, ref) {
    return (
      <a ref={ref} href={to} {...rest} onClick={(e) => { onClick?.(e); if (e.defaultPrevented) return; e.preventDefault(); navegar.current(to); }}>
        {children}
      </a>
    );
  }), []);

  const subir = useCallback((blob, { alAvanzar } = {}) => new Promise((resolver, rechazar) => {
    let n = 0;
    const t = window.setInterval(() => {
      n += 20;
      alAvanzar?.(n);
      if (falla && n >= 60) { window.clearInterval(t); rechazar(new Error('Se cortó la subida (es una prueba).')); }
      if (n >= 100) { window.clearInterval(t); resolver(URL.createObjectURL(blob)); }
    }, 220);
  }), [falla]);
  const fallar = (texto = 'Sin conexión con el servidor (es una prueba).') => { if (falla) throw new Error(texto); };
  const cambiarProductos = async (ids, cambio) => {
    await espera(700);
    fallar();
    setProductos((ps) => ps.map((x) => (ids.includes(x.id) ? { ...x, ...cambio(x) } : x)));
    return { ok: ids.length, fallaron: 0 };
  };

  const comunes = {
    cargando: con('cargando'),
    error: con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined,
    onReintentar: () => setEstados((e) => e.filter((x) => x !== 'error')),
  };
  const vacio = con('vacio');

  // Las fichas de Crear viven bajo Productos en el menú.
  const rutaMenu = rutaSola.startsWith('/admin/prendas-crear') ? '/admin/productos' : rutaSola;
  const actual = opcionActiva(grupos, rutaMenu);
  const dePaso = opcionActiva(menuAdminPara(['superadmin']), rutaMenu);
  const prendaDeRuta = rutaSola.match(/^\/admin\/prendas-crear\/([^/]+)$/)?.[1];
  const inicialPrenda = useMemo(
    () => (prendaDeRuta ? fichaDesdeProducto(prendaDeRuta === 'nueva' ? null : prendasCrudas[prendaDeRuta], { prenda: true }) : null),
    [prendaDeRuta], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const plantillasPrenda = prendaDeRuta && prendaDeRuta !== 'nueva' ? leerPlantillas(prendasCrudas[prendaDeRuta]?.prendaBase?.plantillas) : undefined;
  const cambiarPlantillas = async (fn) => {
    await espera(400);
    fallar();
    setPrendasCrudas((m) => { const p = m[prendaDeRuta]; return { ...m, [prendaDeRuta]: { ...p, prendaBase: { ...p.prendaBase, plantillas: fn(p.prendaBase?.plantillas || []) } } }; });
  };
  const fichaDeRuta = rutaSola.match(/^\/admin\/productos\/([^/]+)$/)?.[1];
  // La ficha se arma una vez por producto (si no, cada render la volvería a empezar).
  const inicialFicha = useMemo(
    () => (fichaDeRuta ? fichaDesdeProducto(fichaDeRuta === 'nuevo' ? null : crudos[fichaDeRuta], { marcaId: new URLSearchParams(ruta.split('?')[1] || '').get('brandId') || '' }) : null),
    [fichaDeRuta], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const marcaDeRuta = ruta.match(/^\/admin\/marcas\/([^/]+)\/productos$/)?.[1];
  let pagina;
  if (!actual) {
    pagina = <SinPermiso permiso={dePaso?.grupo.id === 'catalogo' ? 'Catálogo de productos' : undefined} />;
  } else if (ruta === '/admin') {
    pagina = (
      <PaginaInicioAdmin
        usuario={{ nombre: 'Isaac Castro' }}
        cargando={con('cargando')}
        pendientes={[
          { id: 'pedidos', texto: 'Pedidos por recibir', detalle: 'Pagados y sin organizar el envío', cuenta: vacio ? 0 : 7, to: '/admin/recepcion-pedidos', icono: 'pedidos', tono: 'menta', permiso: ['manage_design'] },
          { id: 'reclamos', texto: 'Reclamos sin responder', detalle: 'El plazo legal es de 15 días hábiles', cuenta: vacio ? 0 : 2, to: '/admin/libro-reclamaciones', icono: 'reclamos', tono: 'rosa', permiso: ['manage_clients'] },
          { id: 'referidos', texto: 'Referidos por aprobar', detalle: 'Monedas esperando que las liberes', cuenta: 0, to: '/admin/referidos', icono: 'referidos', tono: 'oro', permiso: ['manage_clients'] },
          { id: 'retos', texto: 'Evidencias de retos', detalle: 'Fotos que mandaron los clientes', cuenta: vacio ? 0 : 4, to: '/admin/retos', icono: 'retos', tono: 'oro', permiso: ['manage_clients'] },
        ].filter((x) => puedeVer(x, p.permisos))}
        atajos={[
          { to: '/admin/productos', texto: 'Productos', detalle: 'Crear, editar y su stock', icono: 'productos', tono: 'degradado', permiso: ['manage_products', 'manage_inventory'] },
          { to: '/admin/resultados', texto: 'Resultados', detalle: 'Cómo va la tienda', icono: 'resultados', tono: 'oro', permiso: ['manage_design', 'manage_clients'] },
          { to: '/admin/categorias', texto: 'Categorías', detalle: 'Las burbujas de cada marca', icono: 'categorias', tono: 'degradado', permiso: ['manage_products'] },
          { to: '/admin/notificaciones', texto: 'Notificaciones', detalle: 'Ofertas y novedades', icono: 'notificaciones', tono: 'rosa', permiso: ['manage_design'] },
          { to: '/admin/fechas-importantes', texto: 'Fechas importantes', detalle: 'El calendario de campañas', icono: 'fechas', tono: 'rosa', permiso: ['manage_clients'] },
        ].filter((x) => puedeVer(x, p.permisos))}
      />
    );
  } else if (ruta === '/admin/categorias') {
    pagina = (
      <PaginaCategorias
        {...comunes}
        categorias={vacio ? [] : categorias}
        marcas={MARCAS_CORTAS}
        onGuardar={guardarCategoria}
        onEliminar={eliminarCategoria}
        onGuardarOrden={async (ids) => {
          await espera(600);
          fallar();
          setCategorias((l) => l.map((c) => ({ ...c, orden: ids.indexOf(c.id) + 1 })));
        }}
        subirImagen={subir}
      />
    );
  } else if (ruta === '/admin/colecciones') {
    pagina = (
      <PaginaColecciones
        {...comunes}
        colecciones={vacio ? [] : colecciones}
        onGuardar={guardarColeccion}
        onEliminar={eliminarColeccion}
        onGuardarOrden={async (ids) => {
          await espera(600);
          fallar();
          setColecciones((l) => l.map((c) => ({ ...c, orden: ids.indexOf(c.id) + 1 })));
        }}
        subirImagen={subir}
      />
    );
  } else if (ruta === '/admin/atributos-catalogo') {
    pagina = (
      <PaginaAtributos
        {...comunes}
        atributos={vacio ? {} : atributos}
        marcas={MARCAS_CORTAS}
        onGuardar={async (tipo, datos, id) => {
          await espera(600);
          fallar();
          setAtributos((a) => ({ ...a, [tipo]: id ? a[tipo].map((x) => (x.id === id ? { ...x, ...datos } : x)) : [...a[tipo], { ...datos, id: `nuevo-${Date.now()}`, usos: 0 }] }));
        }}
        onEliminar={async (tipo, id) => {
          await espera(600);
          fallar();
          setAtributos((a) => ({ ...a, [tipo]: a[tipo].filter((x) => x.id !== id) }));
        }}
        onQuitarSinUsar={async (tipo, ids) => {
          await espera(900);
          fallar();
          setAtributos((a) => ({ ...a, [tipo]: a[tipo].filter((x) => !ids.includes(x.id)) }));
          return { quitados: ids.length, fallaron: [] };
        }}
      />
    );
  } else if (ruta === '/admin/envios') {
    pagina = <PaginaEnvios {...comunes} zonas={vacio ? [] : zonas} onGuardar={guardarZona} onEliminar={eliminarZona} />;
  } else if (ruta === '/admin/marcas') {
    pagina = (
      <PaginaMarcas
        {...comunes}
        marcas={vacio ? [] : marcas}
        onGuardar={guardarMarca}
        onEliminar={eliminarMarca}
        onGuardarOrden={async (ids) => {
          await espera(600);
          fallar();
          setMarcas((l) => l.map((m) => ({ ...m, orden: ids.indexOf(m.id) + 1 })));
        }}
        subirImagen={subir}
        muestraDe={(id) => MUESTRAS[id] || null}
        whatsapp={whatsapp}
        onGuardarWhatsapp={async (c) => { await espera(600); fallar(); setWhatsapp((w) => ({ ...w, ...c })); }}
        onProductos={(m) => navegar.current(`/admin/marcas/${m.id}/productos`)}
        onDisenar={(m) => toast({ tipo: 'info', titulo: 'En el admin abriría su página con el editor', texto: `/${m.slug}?editar`, duracion: 2500 })}
        onAplicarPlantilla={async () => { await espera(1200); fallar(); return '8 conservadas por estar editadas a mano, 0 creadas.'; }}
        onQuitarRepetidas={async () => { await espera(900); fallar(); return 'No había páginas repetidas.'; }}
      />
    );
  } else if (marcaDeRuta) {
    const m = marcas.find((x) => x.id === marcaDeRuta) || marcas[0];
    pagina = (
      <PaginaProductosMarca
        {...comunes}
        marca={m}
        marcas={MARCAS_CORTAS}
        productos={vacio ? [] : productos}
        urlCrear={`/admin/productos/nuevo?brandId=${m.id}`}
        onDisenar={(x) => toast({ tipo: 'info', titulo: 'En el admin abriría su página con el editor', texto: `/${x.slug}?editar`, duracion: 2500 })}
        onAsignar={(ids) => cambiarProductos(ids, () => ({ marcaId: m.id }))}
        onQuitar={(ids) => cambiarProductos(ids, () => ({ marcaId: '' }))}
      />
    );
  } else if (prendaDeRuta) {
    const listasP = {
      categoria: [...conMarcas(CATEGORIAS), ...creados.categoria],
      coleccion: [...conMarcas(COLECCIONES), ...creados.coleccion],
      tipo: [...TIPOS, ...creados.tipo],
      personaje: [...conMarcas(ATRIBUTOS_DEMO.personajes), ...creados.personaje],
      etiqueta: [...conMarcas(ATRIBUTOS_DEMO.etiquetas), ...creados.etiqueta],
    };
    pagina = (
      <PaginaFichaProducto
        key={prendaDeRuta}
        inicial={inicialPrenda}
        nuevo={prendaDeRuta === 'nueva'}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        marcas={MARCAS.map((m) => ({ id: m.id, nombre: m.nombre, logo: m.logo, whatsapp: m.whatsapp }))}
        categorias={listasP.categoria}
        colecciones={listasP.coleccion}
        tipos={listasP.tipo}
        personajes={listasP.personaje}
        etiquetas={listasP.etiqueta}
        subirImagen={subir}
        fotoConPlantilla={async () => { await espera(900); fallar(); return '/assets/kapi/kapi-happy.webp'; }}
        plantillas={plantillasPrenda}
        accionesPlantillas={{
          onRenombrar: (id, nombre) => cambiarPlantillas((l) => l.map((x) => (x.id === id ? { ...x, nombre } : x))),
          onGrupo: (id, grupo) => cambiarPlantillas((l) => l.map((x) => (x.id === id ? { ...x, grupo } : x))),
          onQuitar: (id) => cambiarPlantillas((l) => l.filter((x) => x.id !== id)),
          otras: Object.values(prendasCrudas).filter((p) => p.id !== prendaDeRuta && leerPlantillas(p.prendaBase?.plantillas).length).map((p) => ({ id: p.id, nombre: p.name, plantillas: leerPlantillas(p.prendaBase.plantillas) })),
          onTraer: (origenId, ids) => cambiarPlantillas((l) => [...l, ...leerPlantillas(prendasCrudas[origenId]?.prendaBase?.plantillas).filter((x) => ids.includes(x.id)).map((x) => ({ ...x, id: `${x.id}-copia-${Date.now()}` }))]),
          urlNueva: `/crear/${prendaDeRuta}?nuevaPlantilla=1`,
          urlEditar: (id) => `/crear/${prendaDeRuta}?editarPlantilla=${id}`,
        }}
        onGuardar={async (datos) => {
          await espera(900);
          fallar('Sin conexión con el servidor (es una prueba). Lo escrito sigue aquí.');
          const id = prendaDeRuta === 'nueva' ? `prenda-${Date.now()}` : prendaDeRuta;
          const antes = prendasCrudas[id] || {};
          setPrendasCrudas((m) => ({ ...m, [id]: { ...antes, ...fichaAProducto(datos, antes, { prendaBaseParaGuardar }), id } }));
        }}
        onVolver={() => navegar.current('/admin/productos?ver=crear')}
      />
    );
  } else if (fichaDeRuta) {
    const listas = {
      categoria: [...conMarcas(CATEGORIAS), ...creados.categoria],
      coleccion: [...conMarcas(COLECCIONES), ...creados.coleccion],
      tipo: [...TIPOS, ...creados.tipo],
      personaje: [...conMarcas(ATRIBUTOS_DEMO.personajes), ...creados.personaje],
      etiqueta: [...conMarcas(ATRIBUTOS_DEMO.etiquetas), ...creados.etiqueta],
    };
    pagina = (
      <PaginaFichaProducto
        key={fichaDeRuta}
        inicial={inicialFicha}
        nuevo={fichaDeRuta === 'nuevo'}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        marcas={MARCAS.map((m) => ({ id: m.id, nombre: m.nombre, logo: m.logo, whatsapp: m.whatsapp }))}
        categorias={listas.categoria}
        colecciones={listas.coleccion}
        tipos={listas.tipo}
        personajes={listas.personaje}
        etiquetas={listas.etiqueta}
        onCrear={async (lista, { nombre, marcaId }) => {
          await espera(400);
          fallar();
          const nuevoItem = { id: `nuevo-${Date.now()}`, nombre, marcas: marcaId && lista !== 'tipo' ? [marcaId] : [] };
          setCreados((c) => ({ ...c, [lista]: [...c[lista], nuevoItem] }));
          return nuevoItem;
        }}
        productos={productos}
        coloresDe={coloresDemo}
        destinosCrear={DESTINOS_CREAR}
        subirImagen={subir}
        onGuardar={async (datos) => {
          await espera(900);
          fallar('Sin conexión con el servidor (es una prueba). Lo escrito sigue aquí.');
          const id = fichaDeRuta === 'nuevo' ? `nuevo-${Date.now()}` : fichaDeRuta;
          const crudo = { ...(crudos[id] || {}), ...fichaAProducto(datos, crudos[id] || {}), id };
          setCrudos((c) => ({ ...c, [id]: crudo }));
          setProductos((ps) => (ps.some((x) => x.id === id) ? ps.map((x) => (x.id === id ? { ...x, ...productoAdminDesde(crudo) } : x)) : [...ps, productoAdminDesde(crudo)]));
        }}
        onVolver={() => navegar.current('/admin/productos')}
        onPasarACrear={() => toast({ tipo: 'info', titulo: 'Abriría su ficha de Crear (D2c)', duracion: 2200 })}
        onBorrador={() => {}}
      />
    );
  } else if (rutaSola === '/admin/productos') {
    pagina = (
      <PaginaProductos
        {...comunes}
        productos={vacio ? [] : productos}
        categorias={CATEGORIAS_CORTAS}
        marcas={MARCAS_CORTAS}
        colecciones={COLECCIONES_CORTAS}
        tipos={TIPOS}
        soloStock={!puedeVer({ permiso: ['manage_products'] }, p.permisos)}
        urlHistorial="/admin/backups?ver=inventario"
        onGuardarStock={async (x, n) => { await espera(500); fallar('No se guardó el stock (es una prueba).'); setProductos((ps) => ps.map((y) => (y.id === x.id ? { ...y, stock: n } : y))); }}
        vista={verDeRuta}
        onVista={(v) => navegar.current(v === 'tienda' ? '/admin/productos' : `/admin/productos?ver=${v}`)}
        onAbrir={(x) => (x.personalizable || x.pack ? toast({ tipo: 'info', titulo: 'Su ficha es de Crear (D2c)', texto: x.nombre, duracion: 2200 }) : navegar.current(`/admin/productos/${x.id}`))}
        urlNuevo="/admin/productos/nuevo"
        onIr={(to) => toast({ tipo: 'info', titulo: 'Iría a', texto: to, duracion: 2000 })}
        onVisible={async (id, visible) => { await espera(500); fallar(); setProductos((ps) => ps.map((x) => (x.id === id ? { ...x, oculto: !visible } : x))); }}
        onVarios={(ids, visible) => cambiarProductos(ids, () => ({ oculto: !visible }))}
        onArchivar={async (ids) => { await espera(700); fallar(); setProductos((ps) => ps.filter((x) => !ids.includes(x.id))); return { ok: ids.length, fallaron: 0 }; }}
        onDuplicar={async (x) => { await espera(600); fallar(); setProductos((ps) => [...ps, { ...x, id: `copia-${Date.now()}`, nombre: `${x.nombre} (Copia)`, oculto: true, destacado: false }]); }}
        onExportar={() => {}}
        onQuitarPersonalizacionVieja={(ids) => cambiarProductos(ids, () => ({ personalizacionVieja: false }))}
        borradores={borradores}
        cuentas={{ crear: Object.values(prendasCrudas).filter((p) => !p.deleted).length, packs: packsCrudos.filter((c) => !c.deleted).length }}
        personalizables={(
          <PaginaPersonalizables
            embebido
            {...comunes}
            prendas={vacio ? [] : Object.values(prendasCrudas).filter((p) => !p.deleted).map((p) => personalizableDesde(p, packsCrudos))}
            onAbrir={(x) => navegar.current(`/admin/prendas-crear/${x.id}`)}
            onVer={(x) => toast({ tipo: 'info', titulo: 'Abriría Crear', texto: `/crear/${x.id}`, duracion: 2000 })}
            onPublicar={async (id, publicada) => { await espera(500); fallar(); setPrendasCrudas((m) => ({ ...m, [id]: { ...m[id], visible: publicada } })); }}
            onArchivar={async (id) => { await espera(600); fallar(); setPrendasCrudas((m) => ({ ...m, [id]: { ...m[id], deleted: true } })); }}
          />
        )}
        packs={(
          <PaginaPacks
            embebido
            {...comunes}
            packs={vacio ? [] : packsCrudos.filter((c) => !c.deleted).map(packDesdeFirestore)}
            prendas={Object.values(prendasCrudas).filter((p) => !p.deleted).map(opcionDePrenda)}
            talCual={TAL_CUAL}
            marcas={MARCAS_CORTAS}
            categorias={CATEGORIAS.map((c) => ({ id: c.id, nombre: c.nombre, marcas: c.marcas }))}
            subirImagen={subir}
            nuevoInicial={new URLSearchParams(ruta.split('?')[1] || '').get('nuevo') === '1'}
            onVer={(k) => toast({ tipo: 'info', titulo: 'Abriría el pack', texto: `/combo/${k.id}`, duracion: 2000 })}
            onGuardar={async (datos, id) => {
              await espera(700);
              fallar();
              const doc = { id: id || `pack-${Date.now()}`, name: datos.nombre, description: datos.descripcion, price: Number(datos.precio), salePrice: Number(datos.oferta) || 0, brandId: datos.marcaId, categories: datos.categoria ? [datos.categoria] : [], mainImage: datos.portada, enTienda: datos.enTienda, esComboCrear: true, comboCrear: { publicado: datos.publicado, tallas: datos.tallas, piezas: datos.piezas } };
              setPacksCrudos((l) => (id ? l.map((c) => (c.id === id ? doc : c)) : [...l, doc]));
            }}
            onArchivar={async (id) => { await espera(500); fallar(); setPacksCrudos((l) => l.map((c) => (c.id === id ? { ...c, deleted: true } : c))); }}
            onSugerir={() => Object.values(prendasCrudas).filter((p) => p.visible !== false && !p.deleted).flatMap((p) => [2, 3].map((n) => ({ clave: `${p.id}-${n}`, nombre: `${n === 2 ? 'Pareja' : 'Trío'} · ${p.name}`, precio: Math.floor((Number(p.price) * n * (n === 2 ? 0.9 : 0.85)) / 5) * 5, piezas: Array.from({ length: n }, () => ({ prendaId: p.id })) })))}
            onCrearSugeridos={async (lista, publicar) => {
              await espera(900);
              fallar();
              setPacksCrudos((l) => [...l, ...lista.map((c, i) => ({ id: `sug-${Date.now()}-${i}`, name: c.nombre, price: Number(c.precio), esComboCrear: true, comboCrear: { publicado: publicar, tallas: 'auto', piezas: c.piezas } }))]);
              return lista.length;
            }}
          />
        )}
        urlBorrador={(id) => `/admin/productos/nuevo?draftId=${id}`}
        onDescartarBorrador={async (id) => { await espera(400); setBorradores((b) => b.filter((x) => x.id !== id)); }}
      />
    );
  } else if (rutaSola === '/admin/publico-productos') {
    pagina = (
      <PaginaRecomendar
        {...comunes}
        productos={vacio ? [] : productos}
        categorias={CATEGORIAS_CORTAS}
        sugerenciaDe={sugerenciaDemo}
        equipos={['Alianza Lima', 'Universitario', 'Sporting Cristal']}
        onGuardar={async (id, campos) => { await espera(300); fallar(); setProductos((ps) => ps.map((x) => (x.id === id ? { ...x, ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v ?? (k === 'edadMinima' ? null : '')])) } : x))); }}
        onAceptarSugerencias={async () => { await espera(700); fallar(); }}
        onMarcarTodos={async () => { await espera(700); fallar(); }}
      />
    );
  } else if (ruta === '/admin/recepcion-pedidos') {
    pagina = (
      <PaginaRecepcion
        pedidos={vacio ? [] : PEDIDOS_RECEPCION}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con el ERP (es una prueba).' : undefined}
        actualizando={actualizando}
        onActualizar={async () => { setActualizando(true); await espera(900); setActualizando(false); setEstados((e) => e.filter((x) => x !== 'error')); }}
        detalleDe={(p) => `/cuenta/pedidos/${p.id}`}
      />
    );
  } else if (ruta === '/admin/gestion-pagos') {
    pagina = (
      <PaginaPagos
        enlaces={vacio ? [] : enlaces}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        actualizando={actualizando}
        onActualizar={async () => { setActualizando(true); await espera(900); setActualizando(false); setEstados((e) => e.filter((x) => x !== 'error')); }}
        urlDe={(id) => `${window.location.origin}/pago-rapido/${id}`}
        onGenerar={async (datos) => {
          await espera(700);
          fallar('Firestore rechazó el enlace (es una prueba).');
          const id = `demo-enlace-${Date.now()}`;
          setEnlaces((l) => [{ id, concepto: datos.concepto, moneda: datos.moneda, monto: datos.monto, estado: 'pendiente', createdMs: Date.now(), pagadoMs: null, metodo: datos.moneda === 'USD' ? 'paypal' : 'culqi', tiempoPagoMs: null }, ...l]);
          return id;
        }}
        config={configPagos}
        cargandoConfig={con('cargando')}
        onGuardarConfig={async (c) => { await espera(700); fallar(); setConfigPagos(c); }}
      />
    );
  } else if (rutaSola === '/admin/resultados' || rutaSola.startsWith('/admin/resultados/')) {
    // Cada pestaña es su ruta, como en el admin (el menú las lista por separado).
    const resPestana = rutaSola.split('/')[3] || 'resumen';
    // Las pantallas técnicas van en el mismo marco, sin pestañas.
    const tecnica = resPestana === 'tecnico' ? rutaSola.split('/')[4] : null;
    const dias = resPeriodo === 'fechas' ? Math.max(1, Math.round((Date.parse(resFechas.hasta) - Date.parse(resFechas.desde)) / 86400000) + 1) : DIAS_RESULTADOS[resPeriodo];
    const { datos: datosRes, anterior } = resultadosDemo(dias);
    const dia = resPeriodo === 'hoy' || resPeriodo === 'ayer' ? resPeriodo : null;
    const conClientes = p.permisos.includes('superadmin') || p.permisos.includes('manage_clients');
    pagina = (
      <MarcoResultados
        periodo={{ id: resPeriodo, etiqueta: dia || (resPeriodo === 'fechas' ? `del ${resFechas.desde} al ${resFechas.hasta}` : `${resPeriodo} días`), contra: dia === 'hoy' ? 'ayer' : dia === 'ayer' ? 'anteayer' : 'el periodo anterior' }}
        onPeriodo={setResPeriodo}
        desde={resFechas.desde}
        hasta={resFechas.hasta}
        onFechas={(desde, hasta) => setResFechas({ desde, hasta })}
        hoy={diaKey(0)}
        comparar={resComparar}
        onComparar={setResComparar}
        datosAl={Date.now() - 4 * 60000}
        actualizando={actualizando}
        onActualizar={async () => { setActualizando(true); await espera(900); setActualizando(false); setEstados((e) => e.filter((x) => x !== 'error')); }}
        pestanas={tecnica ? [] : PESTANAS_RESULTADOS.filter((x) => !x.soloClientes || conClientes)}
        titulo={tecnica ? TITULOS_TECNICOS[tecnica]?.[0] : undefined}
        queHace={tecnica ? TITULOS_TECNICOS[tecnica]?.[1] : undefined}
        migas={tecnica ? [{ texto: 'Resultados', to: '/admin/resultados' }, { texto: 'Detalle técnico', to: '/admin/resultados/tecnico' }, { texto: TITULOS_TECNICOS[tecnica]?.[0] }] : undefined}
        controles={tecnica === 'uso' ? <Pestanas etiqueta="Origen" opciones={ORIGENES_TECNICOS} valor={resOrigen} onChange={setResOrigen} /> : null}
        pestana={resPestana}
        onPestana={(id) => setRuta(id === 'resumen' ? '/admin/resultados' : `/admin/resultados/${id}`)}
      >
        {resPestana === 'resumen' ? (
          <PaginaResumenResultados
            datos={vacio || con('cargando') ? null : datosRes}
            anterior={anterior}
            comparar={resComparar}
            periodo={{ dia, contra: dia === 'hoy' ? 'ayer' : dia === 'ayer' ? 'anteayer' : 'el periodo anterior', anteriorTexto: `los ${dias} días de antes` }}
            cargando={con('cargando')}
            error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
            avisos={vacio ? [] : AVISOS_RESULTADOS}
            nombrePagina={(path) => ({ '/tienda': 'Tienda', '/personalizar': 'Crear', '/carrito': 'Carrito' }[path] || (path.startsWith('/producto/') ? 'Un producto' : path))}
            verCanales="/admin/resultados/visitantes"
            enlacesRotos={{
              ...rotos,
              crearLandingDe: (slug) => `/admin/landing-pages?nueva=${encodeURIComponent(slug)}`,
              onRedirigir: async (landingId, slug) => {
                await espera(700);
                fallar();
                const l = rotos.landings.find((x) => x.id === landingId);
                setRotos((r) => ({ ...r, enlaces: r.enlaces.map((e) => (e.slug === slug ? { ...e, resueltaA: l.slug } : e)) }));
              },
            }}
          />
        ) : resPestana === 'productos' ? (
          <PaginaProductosResultados
            datos={vacio || con('cargando') ? null : datosRes}
            cargando={con('cargando')}
            error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
            productoDe={productoDeDemo}
            nombreCategoria={nombreCategoriaDemo}
            perfiles={PERFILES_DEMO}
          />
        ) : resPestana === 'clientes' ? (
          <PaginaClientesResultados
            datos={vacio ? {} : datosRes}
            perfiles={PERFILES_DEMO}
            cumpleanos={vacio ? { proximosCumpleanos: [] } : CUMPLES_DEMO}
            cargandoCumpleanos={con('cargando')}
            clientes={(resBusqueda ? CLIENTES_RES.filter((c) => `${c.nombre} ${c.email} ${c.dni}`.toLowerCase().includes(resBusqueda.toLowerCase())) : CLIENTES_RES.slice(0, resVisibles))}
            cargandoClientes={con('cargando')}
            errorClientes={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
            hayMas={!resBusqueda && resVisibles < CLIENTES_RES.length}
            onMas={() => setResVisibles((n) => n + 4)}
            onBuscar={setResBusqueda}
            onPrepararBusqueda={async () => { await espera(1200); fallar(); return { revisados: 812, actualizados: 37 }; }}
            onAbrir={(c) => { setResCliente(c); setResFicha('resumen'); }}
            pestanaFicha={resFicha}
            onPestanaFicha={setResFicha}
            ficha={resCliente ? {
              ficha: fichaDemo(resCliente),
              actividad: actividadDemo(resCliente),
              productoDe: productoDeDemo,
              recomendados: TIENDA.productos.slice(6, 9).map((p) => ({ id: p.id, nombre: p.name, imagen: p.mainImage, detalle: `S/ ${p.salePrice || p.price}` })),
            } : {}}
            fechasImportantes="/admin/fechas-importantes"
          />
        ) : resPestana === 'opiniones' ? (
          <PaginaOpinionesResultados encuesta={resEncuesta} onEncuesta={setResEncuesta}>
            {resEncuesta === 'entregas' ? (
              <RespuestasEntregas
                config={encuesta.entregaPanel}
                onGuardarConfig={async (e) => { await espera(600); fallar(); setEncuesta((c) => ({ ...c, entregaPanel: e })); }}
                respuestas={con('vacio') ? [] : ENTREGAS_DEMO}
                cargando={con('cargando')}
                error={con('error') ? 'resultadosEncuestaEntrega no respondió (es una prueba).' : undefined}
                onActualizar={async () => { setActualizando(true); await espera(800); setActualizando(false); setEstados((e) => e.filter((x) => x !== 'error')); }}
                actualizando={actualizando}
                desdeMs={new Date(`${diaKey(dias - 1)}T00:00`).getTime()}
                hastaMs={Date.now()}
                previo={resComparar ? { desdeMs: new Date(`${diaKey(2 * dias - 1)}T00:00`).getTime(), hastaMs: new Date(`${diaKey(dias - 1)}T00:00`).getTime() - 1, contra: dia === 'hoy' ? 'ayer' : 'el periodo anterior' } : null}
              />
            ) : (
              <RespuestasEncuesta
                usuarios={con('vacio') ? [] : USUARIOS_ENCUESTA}
                config={encuesta}
                cargando={con('cargando')}
                error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
                onActualizar={async () => { setActualizando(true); await espera(800); setActualizando(false); setEstados((e) => e.filter((x) => x !== 'error')); }}
                actualizando={actualizando}
                desde={diaKey(dias - 1)}
                hasta={diaKey(0)}
                previo={resComparar ? { desde: diaKey(2 * dias - 1), hasta: diaKey(dias), contra: dia === 'hoy' ? 'ayer' : 'el periodo anterior' } : null}
                embudo={EMBUDO_DEMO}
                embudoPrevio={resComparar ? EMBUDO_DEMO.map((p) => ({ ...p, total: Math.round(p.total * 0.8) })) : undefined}
                onVolverAPreguntar={async (que) => { await espera(700); fallar(); setEncuesta((c) => configConPregunta(c, que)); }}
                urlEditar="/admin/encuestas"
                hoy={diaKey(0)}
              />
            )}
          </PaginaOpinionesResultados>
        ) : tecnica === 'paginas' ? (
          <PaginaPaginasTecnica
            datos={vacio || con('cargando') ? null : datosRes}
            cargando={con('cargando')}
            error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
            nombrePagina={(path) => ({ '/': 'Inicio', '/tienda': 'Tienda', '/personalizar': 'Crear', '/carrito': 'Carrito', '/cuenta/pedidos': 'Mis pedidos', '/minijuegos': 'Minijuegos', '/buscar': 'Buscar', '/checkout': 'Pagar' }[path] || (path.startsWith('/producto/') ? 'Producto · Polo clásico' : path.startsWith('/combo/') ? 'Combo · Pareja Kapi' : path))}
            rutaCorta={(path) => path}
            enlacesRotos={{ ...rotos, crearLandingDe: (slug) => `/admin/landing-pages?nueva=${encodeURIComponent(slug)}`, onRedirigir: async () => { await espera(600); fallar(); } }}
          />
        ) : tecnica === 'uso' ? (
          <PaginaUsoTecnica
            datos={vacio || con('cargando') ? null : datosRes}
            origen={resOrigen}
            comparar={resComparar}
            cargando={con('cargando')}
            error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
            areas={AREAS_DEMO.map(([area, pct]) => ({ area, pct, views: Math.round(pct * 180) }))}
            nombrePagina={(path) => ({ '/': 'Inicio', '/tienda': 'Tienda', '/personalizar': 'Crear', '/carrito': 'Carrito', '/cuenta/pedidos': 'Mis pedidos' }[path] || path)}
            rutaCorta={(path) => path}
          />
        ) : tecnica === 'navegador' ? (
          <PaginaNavegadorTecnica
            datos={vacio || con('cargando') ? null : datosRes}
            anterior={{ daysWithData: dias, sessions: { app: Math.round((datosRes.byClientType?.[1]?.count || 0) * 0.8), web: Math.round((datosRes.byClientType?.[0]?.count || 0) * 1.05) } }}
            comparar={resComparar}
            cargando={con('cargando')}
            error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
            nombrePagina={(path) => ({ '/tienda': 'Tienda', '/personalizar': 'Crear', '/carrito': 'Carrito' }[path] || path)}
            periodoAnterior={`los ${dias} días de antes`}
          />
        ) : tecnica === 'mapa-de-calor' ? (
          <PaginaMapaDeCalor
            origen={resOrigen}
            onOrigen={(o) => { setResOrigen(o); if (o === 'app' && resAncho === 'escritorio') setResAncho('todos'); }}
            diseno={resDiseno}
            onDiseno={setResDiseno}
            ancho={resAncho}
            onAncho={setResAncho}
            anchos={resOrigen === 'app' ? ANCHOS_DEMO.filter((a) => a.id !== 'escritorio') : ANCHOS_DEMO}
            clics={vacio ? 0 : 18430}
            lotes={vacio ? 0 : 212}
            rango={resPeriodo === 'fechas' ? `del ${resFechas.desde} al ${resFechas.hasta}` : `últimos ${dias} días`}
            truncado={resPeriodo === '90'}
            maxDocs={300}
            sinOrigen={1240}
            incluirSinOrigen={resSinOrigen}
            onIncluirSinOrigen={setResSinOrigen}
          >
            <EstadoVacio imagen="/assets/kapi/3d/kapi-hambre-256.webp" titulo="Aquí va el visor del mapa de calor" texto="Es HeatmapViewer tal cual (la página real en una vista previa, el calor encima y los elementos más clicados): en el admin se pone en este hueco." />
          </PaginaMapaDeCalor>
        ) : resPestana === 'tecnico' && !tecnica ? (
          <PaginaDetalleTecnico
            datos={vacio ? {} : datosRes}
            rutaDe={(id) => `/admin/resultados/tecnico/${id}`}
            onReconstruirTramo={async () => { await espera(450); fallar('El servidor tardó demasiado (es una prueba).'); return { processed: 10, ok: 10 }; }}
            onRecalcular={async () => { await espera(900); fallar(); }}
          />
        ) : resPestana === 'visitantes' ? (
          <PaginaVisitantesResultados
            datos={vacio || con('cargando') ? null : datosRes}
            cargando={con('cargando')}
            error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
          />
        ) : (
          <EstadoVacio imagen="/assets/kapi/3d/kapi-hambre-256.webp" titulo="Esta pestaña todavía no está en el kit" texto={`Se arma en ${{ tecnico: 'D4d' }[resPestana] || 'D4'} (guia/ADMIN.md).`} />
        )}
      </MarcoResultados>
    );
  } else if (ruta === '/admin/referidos') {
    pagina = <PaginaReferidosAdmin referidos={vacio ? [] : REFERIDOS_DEMO} cargando={con('cargando')} error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined} onReintentar={() => setEstados((e) => e.filter((x) => x !== 'error'))} />;
  } else if (ruta === '/admin/recompensas') {
    pagina = (
      <PaginaRecompensasAdmin
        {...comunes}
        recompensas={vacio ? [] : recompensas}
        productos={PRODUCTOS}
        subirImagen={subir}
        onGuardar={(datos, id) => guardarRecompensaCruda(recompensaAdminDesdeFirestore({ id, ...recompensaAdminAFirestore(datos) }), id)}
        onEliminar={eliminarRecompensa}
      />
    );
  } else if (rutaSola === '/admin/whatsapp') {
    pagina = (
      <PaginaWhatsAppAdmin
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        config={whatsappDemo}
        onGuardar={async (c) => { await espera(600); fallar(); setWhatsappDemo(whatsappDesdeMensajes(whatsappAMensajes(c))); }}
      />
    );
  } else if (rutaSola === '/admin/backups') {
    pagina = (
      <PaginaHistorialAdmin
        pestana={historialPestana}
        onPestana={setHistorialPestana}
        cambios={vacio ? [] : conVersionActual(copias)}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        onRestaurar={async (x) => {
          await espera(700);
          fallar();
          // Como el conector: restaurar deja su propia copia, así la de arriba sigue siendo la puesta.
          setCopias((l) => [cambioDisenoDesde({ id: `log-${Date.now()}`, timestamp: new Date().toISOString(), pageId: x.pagina, user: 'Admin', description: 'Restaurada desde el historial', config: x.config }), ...l]);
        }}
        movimientos={vacio ? [] : MOVIMIENTOS_DEMO}
        cargandoMovimientos={con('cargando')}
        errorMovimientos={con('error') ? 'No se pudieron leer los cambios de stock (es una prueba).' : undefined}
        onReintentarMovimientos={comunes.onReintentar}
      />
    );
  } else if (rutaSola === '/admin/configuracion') {
    pagina = (
      <PaginaConfiguracionAdmin
        esSuperadmin={p.permisos.includes('superadmin')}
        yo={YO_DEMO}
        pestana={configPestana}
        onPestana={setConfigPestana}
        admins={vacio ? [] : admins}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        onGuardarAdmin={async (d, id) => {
          await espera(600);
          fallar();
          const { correo, datos } = adminAFirestore(d);
          const a = adminDesdeFirestore({ id: correo, email: correo, ...datos });
          setAdmins((l) => (id ? l.map((x) => (x.id === id ? a : x)) : [...l, a]));
        }}
        onEliminarAdmin={async (id) => { await espera(500); fallar(); setAdmins((l) => l.filter((x) => x.id !== id)); }}
        paginas={paginasBloqueables(landings.map((x) => ({ id: x.id, title: x.nombre, slug: x.slug })), bloqueadas)}
        cargandoPaginas={con('cargando')}
        errorPaginas={con('error') ? 'No se pudieron leer las páginas (es una prueba).' : undefined}
        onReintentarPaginas={comunes.onReintentar}
        onBloquear={async (id, si) => { await espera(400); fallar(); setBloqueadas((b) => conBloqueo(b, id, si)); }}
        onRevisarImagenes={async (ambito) => { await espera(700); fallar('No se pudieron leer los documentos (es una prueba).'); return imagenesPendientes.current[ambito]; }}
        onConvertirImagenes={async (ambito, { alAvanzar }) => {
          const c = imagenesPendientes.current[ambito];
          for (let i = 1; i <= c.apariciones; i += 1) {
            await espera(ambito === 'productos' ? 60 : 300);
            alAvanzar?.({ hechas: i, total: c.apariciones, actual: ambito === 'productos' ? `producto-${i}.jpg` : `banner-${i}.png` });
          }
          imagenesPendientes.current = { ...imagenesPendientes.current, [ambito]: { imagenes: 0, documentos: 0, apariciones: 0 } };
          return ambito === 'productos'
            ? { convertidas: c.imagenes - 2, documentos: c.documentos, saltadas: 1, errores: ['producto-12.jpg: no se pudo descargar (es una prueba).'] }
            : { convertidas: c.imagenes, documentos: c.documentos, saltadas: 0, errores: [] };
        }}
        onRevisarTraducciones={async () => { await espera(300); return traduccionesDemo.current; }}
        onPublicarTraducciones={async () => {
          await espera(800);
          fallar();
          const guardadas = Object.values(traduccionesDemo.current).reduce((t, n) => t + n, 0);
          traduccionesDemo.current = {};
          return { guardadas };
        }}
      />
    );
  } else if (rutaSola === '/admin/ruleta') {
    pagina = (
      <PaginaRuletaAdmin
        pestana={ruletaPestana}
        onPestana={setRuletaPestana}
        hoy={diaKey(0)}
        diaSemana={new Date().getDay()}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        premios={vacio ? [] : premiosRuleta}
        onGuardarPremio={async (d, id) => {
          await espera(600);
          fallar();
          const previo = premiosRuleta.find((x) => x.id === id);
          const p = normalizarPremio({ ...premioRuletaAFirestore(d), id: id || `r-${Date.now()}`, stockUsado: previo?.stockUsado || 0 });
          setPremiosRuleta((l) => (id ? l.map((x) => (x.id === id ? p : x)) : [...l, p]));
        }}
        onEliminarPremio={async (id) => { await espera(500); fallar(); setPremiosRuleta((l) => l.filter((x) => x.id !== id)); }}
        onReiniciarContador={async (id) => { await espera(500); fallar(); setPremiosRuleta((l) => l.map((x) => (x.id === id ? { ...x, stockUsado: 0 } : x))); }}
        productos={PRODUCTOS}
        subirImagen={subir}
        config={configRuleta}
        onGuardarConfig={async (c) => { await espera(600); fallar(); setConfigRuleta(c); }}
        ganados={vacio ? [] : ganadosRuleta}
        cargandoGanados={con('cargando')}
        errorGanados={con('error') ? 'No se pudieron leer los premios ganados (es una prueba).' : undefined}
        onReintentarGanados={comunes.onReintentar}
        onMarcarEntregado={async (id, v) => { await espera(500); fallar(); setGanadosRuleta((l) => l.map((x) => (x.id === id ? { ...x, entregado: v } : x))); }}
      />
    );
  } else if (rutaSola === '/admin/mascota') {
    pagina = (
      <PaginaKapiAdmin
        imagen={vacio ? '' : kapi}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        onGuardar={async (url) => { await espera(600); fallar(); setKapi(url); }}
        subirImagen={subir}
      />
    );
  } else if (rutaSola === '/admin/wordle') {
    pagina = (
      <PaginaPalabraAdmin
        {...comunes}
        palabras={vacio ? [] : palabras.map((x) => palabraDiaDesde(x, diaKey(0)))}
        hoy={diaKey(0)}
        onGuardar={async ({ fecha, palabra }, id) => { await espera(600); fallar(); setPalabras((l) => [...l.filter((x) => x.id !== id && x.id !== fecha), { id: fecha, word: palabra }]); }}
        onEliminar={async (id) => { await espera(500); fallar(); setPalabras((l) => l.filter((x) => x.id !== id)); }}
      />
    );
  } else if (rutaSola === '/admin/bolitas') {
    pagina = (
      <PaginaBolitasAdmin
        pestana={bolitasPestana}
        onPestana={setBolitasPestana}
        marcas={MARCAS_PAGINAS.map((m) => ({ valor: m.id, texto: m.name }))}
        hoy={diaKey(0)}
        cargando={con('cargando')}
        error={con('error') ? 'adminBolitasSecure no respondió (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        patrocinios={vacio ? [] : patrocinios.map((p) => patrocinioDesde(p, diaKey(0))).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))}
        onGuardarPatrocinio={async (d, id) => { await espera(600); fallar(); setPatrocinios((l) => [...l.filter((x) => x.fecha !== id && x.fecha !== d.fecha), { ...d, entregados: l.find((x) => x.fecha === id)?.entregados || 0 }]); }}
        onQuitarPatrocinio={async (id) => { await espera(500); fallar(); setPatrocinios((l) => l.filter((x) => x.fecha !== id)); }}
        mundos={mundosBolitas}
        onGuardarMundos={async (lista) => { await espera(600); fallar(); setMundosBolitas(lista); }}
        premios={premiosBolitas}
        onGuardarPremios={async (p) => { await espera(600); fallar(); setPremiosBolitas(p); }}
        onPremiarSemana={async () => { await espera(900); fallar(); return { entregados: 5 }; }}
        metricas={vacio ? { porDia: [] } : metricasBolitasDemo(diasBolitas)}
        dias={diasBolitas}
        onDias={setDiasBolitas}
        cargandoMetricas={con('cargando')}
      />
    );
  } else if (rutaSola === '/admin/popups') {
    pagina = (
      <PaginaPopupsAdmin
        {...comunes}
        popups={vacio ? [] : popups}
        onGuardarPopups={async (lista) => { await espera(600); fallar(); setPopups(lista); }}
        subirImagen={subir}
        estadisticas={ESTADISTICAS_POPUPS_DEMO}
        onReiniciarLocal={() => {}}
      />
    );
  } else if (rutaSola === '/admin/landing-pages') {
    pagina = (
      <PaginaLandingsAdmin
        {...comunes}
        paginas={vacio ? [] : landings}
        marcas={MARCAS_PAGINAS.map((m) => ({ valor: m.id, texto: m.name }))}
        onGuardar={(d, id) => {
          const previa = landings.find((x) => x.id === id);
          const f = landingAFirestore(d, previa);
          return guardarLandingCruda(landingDesde({ id: id || f.slug, ...f }, MARCAS_PAGINAS), id);
        }}
        onEliminar={eliminarLanding}
        onDisenar={(ruta) => toast({ tipo: 'info', titulo: 'En el admin abriría la página con el editor', texto: `${ruta}?editar`, duracion: 2400 })}
        nuevaDireccion={new URLSearchParams(ruta.split('?')[1] || '').get('nueva') || undefined}
      />
    );
  } else if (rutaSola === '/admin/temas') {
    pagina = (
      <PaginaTemasAdmin
        {...comunes}
        temas={vacio ? [] : temas}
        onGuardar={(d, id) => guardarTemaCrudo(temaDesde({ id, ...temaAFirestore(d) }), id)}
        onEliminar={eliminarTema}
        onImportarZip={async (archivo) => {
          await espera(1000);
          fallar('No se pudo leer el .zip (es una prueba).');
          const t = temaDesde({ id: `t-${Date.now()}`, ...temaAFirestore(temaDesdeCss({ principal: '/* Theme Name: Importado de prueba\nAuthor: WordPress\nVersion: 2.0 */', todos: ['body{}', 'h1{}'], archivo: archivo.name })) });
          setTemas((l) => [...l, t]);
          return t;
        }}
      />
    );
  } else if (rutaSola === '/admin/enlaces') {
    pagina = (
      <PaginaEnlacesAdmin
        {...comunes}
        paginas={vacio ? [] : paginasEnlaces}
        onCrear={async ({ titulo, slug }) => {
          await espera(600);
          fallar();
          const id = `enl-${Date.now()}`;
          setPaginasEnlaces((l) => [...l, paginaEnlacesDesde({ id, titulo, slug, estado: 'activo' })]);
          return id;
        }}
        onAbrir={(p) => { setEnlacePestana('contenido'); navegar.current(`/admin/enlaces/${p.id}`); }}
        onEliminar={eliminarPaginaEnlaces}
      />
    );
  } else if (rutaSola.startsWith('/admin/enlaces/')) {
    const pag = paginasEnlaces.find((x) => x.id === rutaSola.split('/')[3]);
    pagina = (
      <PaginaEnlaceAdmin
        pagina={pag}
        paginas={paginasEnlaces}
        cargando={con('cargando')}
        error={!pag ? 'Esa página no existe.' : con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        onGuardar={(d) => guardarPaginaEnlacesCruda(paginaEnlacesDesde({ ...paginaEnlacesAFirestore(d), id: pag.id, visitas: pag.visitas }), pag.id)}
        subirImagen={subir}
        clics={vacio ? {} : CLICS_DEMO}
        analitica={vacio ? undefined : ANALITICA_ENLACES_DEMO}
        pestana={enlacePestana}
        onPestana={setEnlacePestana}
      />
    );
  } else if (rutaSola === '/admin/sorteos-suscripcion') {
    pagina = (
      <PaginaSuscripcionesAdmin
        {...comunes}
        campanas={vacio ? [] : campanasSus}
        subirImagen={subir}
        onGuardar={(datos, id) => {
          const f = campanaSuscripcionAFormulario(datos);
          const previa = campanasSus.find((x) => x.id === id) || {};
          return guardarCampanaSusCruda(campanaSuscripcionDesde({ ...f, id, premios: f.premios, contadorSuscriptores: previa.suscriptores ?? 0, ganadores: previa.ganadores }), id);
        }}
        onEliminar={eliminarCampanaSus}
        onDetalle={(c, p) => { setSusPestana(p || 'suscriptores'); navegar.current(`/admin/sorteos-suscripcion/${c.id}`); }}
      />
    );
  } else if (rutaSola.startsWith('/admin/sorteos-suscripcion/')) {
    const campana = campanasSus.find((x) => x.id === rutaSola.split('/')[3]);
    pagina = (
      <PaginaSuscripcionAdmin
        campana={campana}
        contador={campana?.suscriptores}
        cargando={con('cargando')}
        error={!campana ? 'Esa campaña no existe.' : con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        pestana={susPestana}
        onPestana={setSusPestana}
        urlPublica={(c) => `/suscrito-sorteo/${c.slug}`}
        suscriptores={vacio ? [] : suscriptores}
        onDarChances={async (d) => {
          await espera(700);
          fallar('grantChancesSuscripcion no respondió (es una prueba).');
          const x = suscriptores.find((y) => (d.correo && y.correo === d.correo) || (d.telefono && y.telefono === d.telefono));
          if (!x) throw new Error('No encontramos a ese suscriptor en la campaña.');
          const total = Math.max(0, x.chances + d.chances);
          setSuscriptores((l) => l.map((y) => (y.id === x.id ? { ...y, chances: total } : y)));
          return { chancesTotal: total };
        }}
        onDecidirGanadores={async ({ numGanadores, excluirUids = [] }) => {
          await espera(1100);
          fallar('decidirGanadoresSuscripcion no respondió (es una prueba).');
          const pool = suscriptores.filter((y) => y.estado === 'activo' && !excluirUids.includes(y.id));
          const ganadores = pool.sort((a, b) => b.chances - a.chances).slice(0, numGanadores || campana.numGanadores).map((y) => ({ uid: y.id, nombre: y.nombre, correo: y.correo, pesoUsado: y.chances }));
          setCampanasSus((l) => l.map((y) => (y.id === campana.id ? { ...y, ganadores } : y)));
          return { ganadores, drawId: `draw_${Date.now().toString(36)}`, seed: '2f7a9c1e4b6d8f0a3c5e7b9d1f2a4c6e', poolHash: 'sha256:91ce…0b3f', totalElegibles: pool.length };
        }}
        beneficios={vacio ? [] : beneficiosSus}
        onGuardarBeneficio={guardarBeneficioSus}
        onEliminarBeneficio={eliminarBeneficioSus}
        galeria={vacio ? [] : galeriaSus}
        onGuardarGanador={guardarGanadorSus}
        onEliminarGanador={eliminarGanadorSus}
        subirImagen={subir}
      />
    );
  } else if (rutaSola === '/admin/sorteos') {
    pagina = (
      <PaginaSorteosAdmin
        {...comunes}
        sorteos={vacio ? [] : sorteos}
        subirImagen={subir}
        onGuardar={(datos, id) => {
          const f = sorteoAFormulario(datos);
          const previo = sorteos.find((x) => x.id === id) || {};
          return guardarSorteoCrudo(sorteoDesdeFirestore({ ...f, id, premio: { nombre: f.premioNombre, imagenUrl: f.premioImagenUrl, valor: f.premioValor }, contadorParticipantes: previo.participantes ?? 0, ganadores: previo.ganadores }), id);
        }}
        onEliminar={eliminarSorteo}
        onDetalle={(x) => navegar.current(`/admin/sorteos/${x.id}`)}
      />
    );
  } else if (rutaSola.startsWith('/admin/sorteos/')) {
    const sorteo = sorteos.find((x) => x.id === rutaSola.split('/')[3]);
    const buscar = (d) => participantes.find((p) => (d.correo && p.correo === d.correo) || (d.telefono && p.telefono === d.telefono) || (d.dni && p.dni === d.dni));
    pagina = (
      <PaginaSorteoAdmin
        sorteo={sorteo}
        participantes={vacio ? [] : participantes}
        cargando={con('cargando')}
        error={!sorteo ? 'Ese sorteo no existe.' : con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        urlPublica={(x) => `/sorteos/${x.slug}`}
        onSumarTickets={async (d) => {
          await espera(700);
          fallar('asignarTicketsManual no respondió (es una prueba).');
          const p = buscar(d);
          if (!p) throw new Error('No encontramos a nadie con esos datos en el sorteo.');
          setParticipantes((ps) => ps.map((x) => (x.id === p.id ? { ...x, tickets: x.tickets + d.cantidad, chances: x.chances + d.cantidad } : x)));
        }}
        onDarChances={async (d) => {
          await espera(700);
          fallar('grantRaffleChancesSecure no respondió (es una prueba).');
          const p = buscar(d);
          if (!p) throw new Error('No encontramos a nadie con esos datos en el sorteo.');
          const total = Math.max(0, p.chances + d.chances);
          setParticipantes((ps) => ps.map((x) => (x.id === p.id ? { ...x, chances: total } : x)));
          return { chancesTotal: total };
        }}
        onDecidirGanadores={async ({ numGanadores, excluirUids = [] }) => {
          await espera(1100);
          fallar('decidirGanadoresSorteo no respondió (es una prueba).');
          const n = numGanadores || sorteo.numGanadores;
          const pool = participantes.filter((p) => !excluirUids.includes(p.id));
          const ganadores = [...pool].sort((a, b) => b.chances - a.chances || a.nombre.localeCompare(b.nombre)).slice(0, n).map((p) => ({ uid: p.id, nombre: p.nombre, correo: p.correo, telefono: p.telefono, pesoUsado: p.chances }));
          setSorteos((l) => l.map((x) => (x.id === sorteo.id ? { ...x, ganadores, estado: 'cerrado' } : x)));
          return { ganadores, drawId: `draw_${Date.now().toString(36)}`, seed: '9c1f4e7a2b8d3c6f0e5a1b9d7c3f2e8a', poolHash: 'sha256:4be1…77ad', totalElegibles: pool.length };
        }}
      />
    );
  } else if (ruta === '/admin/encuestas') {
    pagina = (
      <PaginaEncuestaAdmin
        config={encuesta}
        guardada={encuesta}
        categoriasTienda={CATEGORIAS_TIENDA_DEMO}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        onGuardar={async (c) => { await espera(700); fallar(); setEncuesta(c); }}
        pestana={encuestaPestana}
        onPestana={setEncuestaPestana}
      />
    );
  } else if (ruta === '/admin/notificaciones') {
    const sinRed = con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined;
    pagina = (
      <PaginaNotificacionesAdmin
        pestana={notifPestana}
        onPestana={setNotifPestana}
        config={configNotif}
        cargandoConfig={con('cargando')}
        errorConfig={sinRed}
        onReintentarConfig={comunes.onReintentar}
        onGuardarConfig={async (c) => { await espera(700); fallar(); setConfigNotif(c); }}
        onProbarAutomatico={async () => { await espera(900); fallar('La función probarAvisoAutomatico no respondió (es una prueba).'); return { push: 1, tieneApp: true }; }}
        guardadas={vacio ? [] : guardadasNotif}
        onGuardarBorrador={async (d, id) => {
          await espera(600);
          fallar();
          const nuevo = id || `bor-${Date.now()}`;
          const fila = { id: nuevo, titulo: d.titulo, mensaje: d.mensaje, enlace: d.enlace, imagen: d.imagen, segmento: d.segmento, productoId: d.productoId, productoNombre: d.productoNombre, fechaMs: Date.now() };
          setGuardadasNotif((g) => (id ? g.map((x) => (x.id === id ? { ...x, ...fila } : x)) : [fila, ...g]));
          return nuevo;
        }}
        onEliminarBorrador={async (id) => { await espera(500); fallar(); setGuardadasNotif((g) => g.filter((x) => x.id !== id)); }}
        productos={PRODUCTOS}
        subirImagen={subir}
        onProbarOferta={async () => { await espera(800); fallar(); return { tieneApp: false }; }}
        onEnviarOferta={async (d, { programadaIso: cuando, forzar }) => {
          await espera(900);
          fallar('sendManualPromoNotification no respondió (es una prueba).');
          const hora = new Date().getHours();
          const { desde, hasta } = configNotif.horarios.promos;
          const hh = `${String(hora).padStart(2, '0')}:00`;
          if (!cuando && !forzar && (!configNotif.activos.promos || hh < desde || hh >= hasta)) {
            throw Object.assign(new Error('Fuera del horario de ofertas.'), { motivo: configNotif.activos.promos ? 'promos_fuera_horario' : 'promos_apagado' });
          }
          const fila = campanaDesde({ id: `c-${Date.now()}`, title: d.titulo, body: d.mensaje, image: d.imagen, segment: d.segmento, link: d.enlace, status: cuando ? 'scheduled' : 'sent', scheduledAt: cuando || undefined, sentAt: cuando ? undefined : Date.now(), pushUsers: cuando ? undefined : 380, inAppUsers: cuando ? undefined : 1790, opened: 0 });
          setCampanas((c) => [fila, ...c]);
          return cuando ? { programada: true, cuandoMs: Date.parse(cuando) } : { programada: false, push: 380, campanita: 1790 };
        }}
        campanas={vacio ? [] : campanas}
        estadisticas={vacio ? [] : ESTADISTICAS_DEMO}
        cargandoHistorial={con('cargando') || actualizando}
        errorHistorial={sinRed}
        onActualizarHistorial={async () => { setActualizando(true); await espera(800); setActualizando(false); setEstados((e) => e.filter((x) => x !== 'error')); }}
        onCancelarCampana={async (id) => { await espera(600); fallar(); setCampanas((c) => c.map((x) => (x.id === id ? { ...x, estado: 'cancelled' } : x))); }}
      />
    );
  } else if (ruta === '/admin/fechas-importantes') {
    const sinRed = con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined;
    pagina = (
      <PaginaFechasAdmin
        pestana={fechasPestana}
        onPestana={setFechasPestana}
        hoy={HOY_DEMO}
        festivas={vacio ? [] : festivas}
        cargandoFestivas={con('cargando')}
        errorFestivas={sinRed}
        onReintentarFestivas={comunes.onReintentar}
        onGuardarFestivas={async (lista) => { await espera(600); fallar(); setFestivas(lista); }}
        diasAviso={diasAviso}
        cargandoDiasAviso={con('cargando')}
        onGuardarDiasAviso={async (d) => { await espera(600); fallar(); setDiasAviso(d); }}
        onProbarAviso={async (id) => {
          await espera(900);
          fallar('La función probarAvisoFechas no respondió (es una prueba).');
          const f = festivas.find((x) => x.id === id);
          return f
            ? { titulo: `${f.emoji} ${f.nombre} en 7 días`, cuerpo: 'Te armamos ideas de regalo para Lucía. Pide con tiempo y llega perfecto.', imagen: PRODUCTOS[0].imagen, tieneApp: true, push: 1 }
            : { titulo: '🎂 Mañana es el cumpleaños de Lucía', cuerpo: 'Mira esta idea de regalo para ella: llega a tiempo si pides hoy.', imagen: PRODUCTOS[1].imagen, tieneApp: false, push: 0 };
        }}
        fechas={vacio ? [] : FECHAS_DEMO}
        paquetes={paquetes}
        cargandoFechas={con('cargando')}
        errorFechas={sinRed}
        onReintentarFechas={comunes.onReintentar}
        productos={PRODUCTOS}
        sugerirProductos={async (f) => {
          await espera(500);
          const gustos = f.gustos.map((g) => g.toLowerCase().slice(0, 4));
          return gustos.length ? PRODUCTOS.filter((p, i) => gustos.some((g) => p.nombre.toLowerCase().includes(g)) || i % 9 === gustos.length).slice(0, 3) : [];
        }}
        onGuardarPaquete={async (productosPaquete, f, id) => {
          await espera(700);
          fallar();
          setPaquetes((ps) => (id
            ? ps.map((p) => (p.id === id ? { ...p, productos: productosPaquete } : p))
            : [...ps, { id: `paq-${Date.now()}`, clienteId: f.clienteId, personaId: f.personaId, eventoId: f.eventoId, evento: f.evento, estado: 'pending_notification', elegido: paquetesDeFecha(ps, f).length === 0, productos: productosPaquete }]));
        }}
        onElegirPaquete={async (paquete, f) => {
          await espera(500);
          fallar();
          setPaquetes((ps) => {
            const cambios = cambiosAlElegir(paquetesDeFecha(ps, f), paquete.id);
            return ps.map((p) => { const c = cambios.find((x) => x.id === p.id); return c ? { ...p, elegido: c.elegido } : p; });
          });
        }}
        onEliminarPaquete={async (paquete, f) => {
          await espera(500);
          fallar();
          setPaquetes((ps) => {
            const siguiente = siguienteElegido(paquetesDeFecha(ps, f), paquete);
            return ps.filter((p) => p.id !== paquete.id).map((p) => (p.id === siguiente ? { ...p, elegido: true } : p));
          });
        }}
      />
    );
  } else if (ruta === '/admin/misiones') {
    pagina = (
      <PaginaMisionesAdmin
        {...comunes}
        misiones={vacio ? [] : misiones}
        verificaciones={VERIFICACIONES_DEMO}
        onGuardar={(datos, id) => guardarMisionCruda(misionDesdeFirestore({ id, ...misionAFirestore(datos) }), id)}
        onEliminar={eliminarMision}
      />
    );
  } else if (ruta === '/admin/retos') {
    const evs = evidencias.map((e) => evidenciaDesde(e, retos, retoActivo));
    pagina = (
      <PaginaRetosAdmin
        {...comunes}
        retos={vacio ? [] : retos}
        activo={vacio ? null : retoActivo}
        evidencias={vacio ? [] : evs}
        onGuardar={(datos, id) => guardarRetoCrudo(retoDesdeFirestore({ id, ...retoAFirestore(datos) }), id)}
        onEliminar={eliminarReto}
        onActivar={async (r) => { await espera(600); fallar(); setRetoActivo(retoActivoDesde(r)); }}
        onAprobar={async (e) => { await espera(700); fallar(); setEvidencias((l) => l.filter((x) => x.id !== e.id)); }}
        onRechazar={async (e) => { await espera(700); fallar(); setEvidencias((l) => l.filter((x) => x.id !== e.id)); }}
      />
    );
  } else if (ruta === '/admin/libro-reclamaciones') {
    pagina = (
      <PaginaReclamos
        reclamos={vacio ? [] : reclamos}
        plazo={15}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        actualizando={actualizando}
        onActualizar={async () => { setActualizando(true); await espera(900); setActualizando(false); setEstados((e) => e.filter((x) => x !== 'error')); }}
        onResponder={async (id, datos) => {
          await espera(700);
          fallar();
          setReclamos((l) => l.map((x) => (x.id === id ? { ...x, estado: 'respondido', respuesta: datos.respuestaProveedor, respondidoMs: Date.parse(datos.respondidoEn) } : x)));
        }}
      />
    );
  } else if (ruta === '/admin/destacados') {
    pagina = (
      <PaginaDestacados
        {...comunes}
        productos={vacio ? [] : productos}
        masVendidos={{ filas: MAS_VENDIDOS, disponible: !vacio, cargando: con('cargando') }}
        onDestacar={async (id) => {
          await espera(500);
          fallar();
          setProductos((ps) => {
            const ultimo = ps.filter((x) => x.destacado).reduce((m2, x) => Math.max(m2, x.ordenDestacado + 1), 0);
            return ps.map((x) => (x.id === id ? { ...x, destacado: true, ordenDestacado: ultimo } : x));
          });
        }}
        onQuitar={async (id) => { await espera(500); fallar(); setProductos((ps) => ps.map((x) => (x.id === id ? { ...x, destacado: false, ordenDestacado: 0 } : x))); }}
        onGuardarOrden={async (ids) => { await espera(700); fallar(); setProductos((ps) => ps.map((x) => (ids.includes(x.id) ? { ...x, ordenDestacado: ids.indexOf(x.id) } : x))); }}
      />
    );
  } else {
    const productosD2 = ['/admin/productos', '/admin/publico-productos'];
    const grupo = productosD2.includes(dePaso?.item.to) ? 'D2 · Productos' : APARTADOS[dePaso?.grupo.id];
    pagina = (
      <>
        <CabezaAdmin icono={dePaso?.item.icono} tono={dePaso?.grupo.tono} titulo={dePaso?.item.texto || 'Sección'} migas={[{ texto: 'Inicio', to: '/admin' }, { texto: dePaso?.item.texto }]} />
        <div className={s.pronto}>
          <EstadoVacio imagen="/assets/kapi/3d/kapi-hambre-256.webp" titulo="Esta sección todavía no está en el kit" texto={grupo ? `Se arma en el apartado ${grupo} (guia/ADMIN.md).` : 'Se arma en un apartado de guia/ADMIN.md.'}>
            <Boton to="/admin/categorias" variante="secundario">Ver Categorías</Boton>
          </EstadoVacio>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={cs.controlesInicio}>
        <div>
          <span className={cs.controlesTitulo}>Ver como</span>
          <Pestanas opciones={PERFILES} valor={perfil} onChange={setPerfil} etiqueta="Permisos del admin" />
        </div>
        <div>
          <span className={cs.controlesTitulo}>Tamaño</span>
          <Pestanas opciones={TAMANOS} valor={tamano} onChange={setTamano} etiqueta="Tamaño del panel" />
        </div>
        <div>
          <span className={cs.controlesTitulo}>Estado</span>
          <div className={cs.controlesChips}>
            {ESTADOS.map(([id, texto]) => (
              <Chip key={id} tamano="sm" activo={con(id)} onClick={() => setEstados((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
            ))}
          </div>
        </div>
        <div>
          <span className={cs.controlesTitulo}>Ir a</span>
          <div className={cs.controlesChips}>
            {HECHAS.map(([to, texto]) => (
              <Chip key={to} tamano="sm" activo={rutaSola === to} onClick={() => navegar.current(to)}>{texto}</Chip>
            ))}
            <Chip tamano="sm" onClick={() => { setCategorias(CATEGORIAS); setProductos(PRODUCTOS); }}>Restaurar datos</Chip>
          </div>
        </div>
      </div>
      <div ref={marco} className={[s.lienzo, tamano === 'celular' && s.lienzoCelular].filter(Boolean).join(' ')}>
        <ProveedorEnlaces componente={EnlaceAdmin}>
          {/* Mientras se confirma quién entra (AdminRoute) o baja el marco. */}
          {con('abriendo') ? <CargandoPanel fijo={false} /> : (
          <MarcoAdmin
            grupos={grupos}
            activo={marcaDeRuta ? '/admin/marcas' : rutaSola}
            accesos={accesos}
            usuario={{ nombre: 'Isaac Castro', email: 'isaac@correo.com', rol: p.rol }}
            onCerrarSesion={() => toast({ tipo: 'info', titulo: 'En el admin cerraría la sesión', duracion: 2000 })}
          >
            {pagina}
          </MarcoAdmin>
          )}
        </ProveedorEnlaces>
      </div>
    </>
  );
}

/* ── Piezas sueltas ── */

const FILAS_DEMO = [
  { id: 'a', nombre: 'Sorteo de Navidad', estado: 'activo', fin: '24 dic' },
  { id: 'b', nombre: 'Rifa del polo firmado', estado: 'borrador', fin: '—' },
  { id: 'c', nombre: 'Sorteo de octubre', estado: 'cerrado', fin: '31 oct' },
];

function PiezasAdmin() {
  const toast = useToast();
  const [imagen, setImagen] = useState('');
  const [elegidas, setElegidas] = useState(['a']);
  const subir = (blob, { alAvanzar } = {}) => new Promise((r) => {
    let n = 0;
    const t = window.setInterval(() => { n += 25; alAvanzar?.(n); if (n >= 100) { window.clearInterval(t); r(URL.createObjectURL(blob)); } }, 200);
  });
  return (
    <div className={s.piezas}>
      <div className={s.ficha}>
        <h3>InsigniaEstado</h3>
        <p>Siempre con texto y su punto de color (nunca solo el color). Una página puede pasar sus propios estados.</p>
        <div className={s.fila}>
          {Object.keys(ESTADOS_ADMIN).map((k) => <InsigniaEstado key={k} estado={k} />)}
        </div>
      </div>
      <div className={s.ficha}>
        <h3>TablaAdmin con casillas + AccionesLote</h3>
        <p>Cambia el ancho de la ventana: a menos de 720 px la misma tabla son tarjetas. Clic derecho en una fila abre sus opciones.</p>
        <TablaAdmin
          etiqueta="Sorteos de ejemplo"
          columnas={[
            { id: 'nombre', titulo: 'Sorteo', tarjeta: 'titulo', celda: (f) => f.nombre },
            { id: 'fin', titulo: 'Termina', tarjeta: 'detalle', celda: (f) => f.fin },
            { id: 'estado', titulo: 'Estado', tarjeta: 'estado', celda: (f) => <InsigniaEstado estado={f.estado} /> },
          ]}
          filas={FILAS_DEMO}
          nombreDe={(f) => f.nombre}
          seleccion={elegidas}
          onSeleccion={setElegidas}
          onFila={(f) => toast({ tipo: 'info', titulo: `Abriría «${f.nombre}»`, duracion: 1800 })}
          acciones={(f) => [
            { id: 'ver', etiqueta: 'Ver en la tienda', Icono: Eye, accion: () => toast({ titulo: f.nombre }) },
            { id: 'ocultar', etiqueta: 'Ocultar', Icono: EyeOff, accion: () => {} },
            'separador',
            { id: 'eliminar', etiqueta: 'Eliminar', Icono: Trash2, peligro: true, accion: () => {} },
          ]}
        />
        <AccionesLote
          cantidad={elegidas.length}
          onLimpiar={() => setElegidas([])}
          acciones={[
            { id: 'archivar', texto: 'Archivar', Icono: Archive, onClick: () => { toast({ tipo: 'exito', titulo: `${elegidas.length} archivados` }); setElegidas([]); } },
            { id: 'eliminar', texto: 'Eliminar', Icono: Trash2, peligro: true, onClick: () => setElegidas([]) },
          ]}
        />
      </div>
      <div className={s.ficha}>
        <h3>CampoImagen</h3>
        <p>Elegir o soltar, recortar en círculo, el avance de la subida, cambiar y quitar.</p>
        <div className={s.campos}>
          <CampoImagen etiqueta="Burbuja (recorte en círculo)" valor={imagen} onCambiar={setImagen} subir={subir} recorte="circulo" forma="circulo" ayuda="Se recorta antes de subir." />
          <CampoImagen etiqueta="Banner (tal cual)" subir={subir} forma="ancho" ayuda="Sin recorte: se sube como llega." onCambiar={() => {}} />
          <CampoImagen etiqueta="Con error" error="Ese archivo no es una imagen (JPG, PNG o WEBP)." subir={subir} onCambiar={() => {}} />
        </div>
      </div>
    </div>
  );
}

export { PanelDePrueba, PiezasAdmin };
