import { motivoNoDisponible, preciosCambiados } from './carritoDisponible.mjs';

// Datos facilitados por Lumi para publicar sus medios de pago.
export const LUMI_PAYMENT = {
  whatsapp: '51963964761',
  titular: 'Rosi Garro Espinoza',
  cuentas: [
    { nombre: 'Yape', numero: '992560745' },
    { nombre: 'Plin', numero: '912881722' },
    { nombre: 'BCP', numero: '19102228394001' },
    { nombre: 'BBVA', numero: '0011-0847-0200209716' },
    { nombre: 'Cuenta interbancaria (CCI)', numero: '00219110222839400156' },
  ],
};

export const solesLumi = (valor) => `S/ ${Number(valor).toFixed(2)}`;

export function revisarPagoLumi(items, productos, { metaEnvio, costoEnvio }) {
  const elegidos = items.filter((it) => it.selected !== false);
  if (!elegidos.length) return { error: 'Elige algún producto para pagar.' };
  const cantidades = new Map();
  for (const item of elegidos) {
    const producto = productos.get(String(item.productId));
    if (producto === undefined) return { error: 'No pudimos comprobar los productos. Inténtalo de nuevo.' };
    const motivo = motivoNoDisponible(item, productos);
    if (motivo) return { error: `${item.productName}: ${motivo}` };
    if (item.status === 'pending_confirmation') return { error: 'Este carrito ya tiene un pago pendiente de confirmación.' };
    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || !(Number(item.price) > 0) || !Number.isFinite(Number(item.price))) {
      return { error: 'Revisa la cantidad y el precio de los productos.' };
    }
    const cantidad = (cantidades.get(String(item.productId)) || 0) + Number(item.quantity);
    cantidades.set(String(item.productId), cantidad);
    if (producto.inStock != null && producto.inStock !== '' && Number.isFinite(Number(producto.inStock)) && cantidad > Number(producto.inStock)) {
      return { error: `Solo quedan ${producto.inStock} unidades de ${item.productName}. Ajusta la cantidad.` };
    }
  }
  const cambios = preciosCambiados(elegidos, productos);
  if (cambios.length) return { cambios, error: 'Actualizamos los precios del carrito. Revisa el nuevo total y vuelve a pagar.' };
  const subtotal = Math.round(elegidos.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0) * 100) / 100;
  const envio = subtotal > metaEnvio ? 0 : costoEnvio;
  return { resumen: { items: elegidos, subtotal, envio, total: Math.round((subtotal + envio) * 100) / 100 } };
}

export function whatsappComprobanteLumi(resumen) {
  const productos = resumen.items.map((it) => `• ${it.quantity} × ${it.productName} — ${solesLumi(Number(it.price) * Number(it.quantity))}`);
  const texto = [
    'Hola Lumi, quiero enviar el comprobante de mi compra:',
    ...productos,
    `Subtotal: ${solesLumi(resumen.subtotal)}`,
    `Envío: ${solesLumi(resumen.envio)}`,
    `Total: ${solesLumi(resumen.total)}`,
    'Adjunto mi comprobante para que confirmen el pago y coordinemos la entrega.',
  ].join('\n');
  return `https://wa.me/${LUMI_PAYMENT.whatsapp}?text=${encodeURIComponent(texto)}`;
}
