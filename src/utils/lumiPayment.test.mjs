import test from 'node:test';
import assert from 'node:assert/strict';
import { isLumiCart } from './catalogLanding.mjs';
import { revisarPagoLumi, whatsappComprobanteLumi, LUMI_PAYMENT } from './lumiPayment.mjs';

const envio = { metaEnvio: 200, costoEnvio: 15 };
const item = { id: 'a', productId: 'p', productName: 'Crema Lumi', quantity: 1, price: 89 };
const productos = (overrides = {}) => new Map([['p', { price: 89, inStock: 4, visible: true, ...overrides }]]);

test('el origen de Lumi solo cambia el carrito que lo lleva explícitamente', () => {
  assert.ok(isLumiCart({ pathname: '/carrito', search: '?catalogo=lumi' }));
  for (const location of [{ pathname: '/carrito' }, { pathname: '/checkout', search: '?catalogo=lumi' }, { pathname: '/carrito', search: '?landing=lumi' }]) assert.equal(isLumiCart(location), false);
});
test('paga solo lo seleccionado, conserva céntimos y la regla de envío del carrito', () => {
  const r = revisarPagoLumi([{ ...item, price: 17.5, quantity: 2 }, { ...item, id: 'b', selected: false, quantity: 99 }], productos({ price: 17.5 }), envio);
  assert.equal(r.resumen.subtotal, 35);
  assert.equal(r.resumen.total, 50);
  assert.equal(r.resumen.items.length, 1);
  assert.equal(revisarPagoLumi([{ ...item, price: 100, quantity: 2 }], productos({ price: 100 }), envio).resumen.envio, 15);
  assert.equal(revisarPagoLumi([{ ...item, quantity: 3 }], productos(), envio).resumen.envio, 0);
});
test('bloquea precio antiguo, producto oculto, falta de red, cantidad inválida y stock agregado insuficiente', () => {
  assert.equal(revisarPagoLumi([item], productos({ price: 99 }), envio).cambios[0].price, 99);
  for (const p of [productos({ visible: false }), new Map(), productos({ inStock: 0 })]) assert.ok(revisarPagoLumi([item], p, envio).error);
  assert.ok(revisarPagoLumi([{ ...item, quantity: 0 }], productos(), envio).error);
  assert.ok(revisarPagoLumi([{ ...item, quantity: 3 }, { ...item, id: 'b', quantity: 2 }], productos(), envio).error);
  assert.ok(revisarPagoLumi([{ ...item, status: 'pending_confirmation' }], productos(), envio).error);
});
test('WhatsApp prepara el comprobante con productos y total para el número de Lumi', () => {
  const { resumen } = revisarPagoLumi([item], productos(), envio);
  const url = new URL(whatsappComprobanteLumi(resumen));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/51963964761');
  assert.match(url.searchParams.get('text'), /Crema Lumi/);
  assert.match(url.searchParams.get('text'), /Total: S\/ 104.00/);
  assert.equal(LUMI_PAYMENT.cuentas.find((x) => x.nombre === 'Plin').numero, '912881722');
});
