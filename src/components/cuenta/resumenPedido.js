import {
  getEtapaBadgeLabel,
  estadoToKey,
  etapaDeTimeline,
  getQueueStage,
  ETAPAS_TIMELINE,
  PASOS_GENERALES,
} from '../../utils/constants';
import { estadoWalaADisplay } from '../../services/walaOrders';
import { getProductosPedido, getCodigoPedido, derivarEstadoCompra } from '../../utils/estadoCompra';
import { toThumbnailImageUrl } from '../../utils/imageUrl';

/*
 * Un pedido de usePedidos → las props de SeguimientoPedido (Mis pedidos con
 * el kit). Es la misma lectura de fase que hacía CuentaRastreoPage
 * (resumirRastreo, hoy en CuentaRastreoViejo.jsx): la fase del taller cuando
 * la hay (8 etapas), si no el estado propio de Walá o el combinado (5 pasos);
 * deuda, anulado y "PAGAR DEUDA" cuando la deuda viene con falta de stock.
 */

const formatoFecha = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });

const milis = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  if (v._seconds) return v._seconds * 1000;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

/** "12 oct 2026" (o '' sin fecha). */
export const fechaCorta = (v) => {
  const ms = typeof v === 'number' ? v : milis(v);
  return ms ? formatoFecha.format(new Date(ms)) : '';
};

/** La fase de un pedido por verificar (lo que manda misPedidosSecure). */
export const ETIQUETA_FASE = {
  pagado: 'Pagado',
  produccion: 'En producción',
  enviado: 'En camino',
  entregado: 'Entregado',
  recibido: 'Recibido',
};

const ETAPAS_PROD = ['diseno', 'impresion', 'preparacion', 'estampado', 'empaquetado', 'reparto', 'finalizado', 'entregado'];
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** La foto de una línea: su diseño, la del catálogo o la que guardó al comprar. */
export const imagenDeLinea = (linea, producto) => {
  const url = linea?.urlImagenPersonalizada
    || producto?.mainImage || producto?.images?.[0]
    || linea?.urlImagen || '';
  return url ? toThumbnailImageUrl(url) : '';
};

/**
 * Un pedido → SeguimientoPedido.
 *  - productoDe(id): el producto del catálogo de una línea sin foto (o undefined)
 */
export function seguimientoDesdePedido(pedido, productoDe = () => undefined) {
  const fuente = (pedido && pedido._raw) || pedido;
  const lineas = getProductosPedido(fuente);
  const codigo = getCodigoPedido(fuente) || pedido?.id;

  // Los productos (el detalle se abre en "Ver productos"). Sin precio en la
  // línea (pedidos hechos en el taller) no se inventa uno.
  let items = lineas.map((l) => {
    const cantidad = num(l?.cantidad) || 1;
    const subtotal = num(l?.subtotal);
    const precio = subtotal != null ? subtotal / cantidad : num(l?.precio);
    const producto = l?.productoId != null && !l?.urlImagenPersonalizada ? productoDe(String(l.productoId)) : undefined;
    return {
      nombre: l?.combo || l?.prendaNombre || l?.producto || l?.nombre || producto?.name || 'Producto',
      imagen: imagenDeLinea(l, producto) || undefined,
      variante: [l?.talla && `Talla ${l.talla}`, l?.color || l?.colorPrenda].filter(Boolean).join(' · ') || undefined,
      cantidad,
      precio: precio != null ? precio : undefined,
    };
  });
  if (!items.length) {
    // Sin líneas: la imagen del diseño del pedido y su marca (como antes).
    const diseno = (Array.isArray(fuente?.imageURLs) && fuente.imageURLs[0]) || (Array.isArray(pedido?.imageURLs) && pedido.imageURLs[0]) || '';
    items = [{ nombre: String(fuente?.marca || pedido?.marca || 'Tu pedido Walá'), imagen: diseno ? toThumbnailImageUrl(diseno) : undefined, cantidad: 1 }];
  }

  // ── La fase ──
  const estadoGeneral = String(fuente?.estadoGeneral ?? pedido?.estadoGeneral ?? '').trim();
  const faseKey = estadoGeneral ? (getQueueStage(estadoGeneral) || estadoToKey(estadoGeneral)) : null;
  // usePedidos pone 'Pendiente' por defecto: hay fase real del taller si la
  // clave es una etapa, si hay fechas de etapa o si el texto nombra una.
  const hayFechasEtapa = pedido?.fechas && typeof pedido.fechas === 'object' && Object.keys(pedido.fechas).length > 0;
  const hayFaseErpReal = (!!faseKey && ETAPAS_PROD.includes(faseKey)) || !!hayFechasEtapa
    || /stock|anul|cancel|entreg|final|listo|reparto|estamp|empaq|impres|dise|prepar/i.test(estadoGeneral.toLowerCase());

  const montoPendiente = num(pedido?.montoDeuda);
  const deuda = pedido?.conDeuda && montoPendiente > 0 ? montoPendiente : 0;
  const anulado = /anul|cancel/.test(estadoGeneral.toLowerCase());
  const problemaStock = estadoGeneral.toUpperCase().includes('STOCK');

  let texto;
  let tono = 'violeta';
  let pasos;
  let paso;
  if (hayFaseErpReal) {
    texto = getEtapaBadgeLabel(estadoGeneral);
    pasos = ETAPAS_TIMELINE.map((e) => e.nombre);
    const idx = ETAPAS_TIMELINE.findIndex((e) => e.key === etapaDeTimeline(faseKey));
    paso = idx >= 0 ? idx : 0;
    if (paso === pasos.length - 1) tono = 'exito';
    if (deuda > 0 && problemaStock) { texto = 'PAGAR DEUDA'; tono = 'peligro'; }
  } else {
    pasos = PASOS_GENERALES;
    const estadoWala = fuente?.estadoWala || pedido?.estadoWala || null;
    let coarse;
    if (estadoWala) {
      const d = estadoWalaADisplay(estadoWala); // { label, color, paso }
      coarse = { texto: d.label, paso: d.paso, color: d.color };
    } else {
      const der = derivarEstadoCompra(fuente);
      const mapaPaso = { por_confirmar_pago: 0, pago_confirmado: 1, en_preparacion: 2, entregado: 4, anulado: -1 };
      coarse = der ? { texto: der.label, paso: mapaPaso[der.key] ?? 0 } : { texto: 'Pendiente de pago', paso: 0 };
    }
    texto = coarse.texto;
    paso = Math.max(0, coarse.paso);
    if (coarse.paso === 0 || coarse.color === 'warning') tono = 'aviso';
    if (coarse.paso >= 4 || coarse.color === 'success') tono = 'exito';
    if (coarse.paso < 0 || coarse.color === 'danger') tono = 'peligro';
  }
  if (anulado) { texto = 'Anulado'; tono = 'peligro'; }

  const total = num(fuente?.montoTotal ?? pedido?.montoTotal);
  return {
    id: pedido?.id,
    codigo,
    fecha: fechaCorta(pedido?.createdAt || fuente?.createdAt),
    total: total > 0 ? total : undefined,
    items,
    pasos,
    paso,
    estado: { texto, tono },
    deuda,
    anulado,
    urlDetalle: `/cuenta/pedidos/${pedido?.id}`,
  };
}

/** Los ids de producto que hacen falta para las fotos (líneas sin foto propia, las 3 que se ven). */
export const productosSinFoto = (pedidos = []) => [...new Set(pedidos.flatMap((p) => getProductosPedido((p && p._raw) || p)
  .slice(0, 3)
  .filter((l) => l?.productoId != null && !l?.urlImagenPersonalizada && !l?.urlImagen)
  .map((l) => String(l.productoId))))];
