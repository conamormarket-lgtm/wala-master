const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { confirmedPayment, productFunnel } = require('../productFunnelLogic');

test('una solicitud, un comprobante o una aprobación sin adelanto no son un pago', () => {
  for (const data of [{ whatsappSolicitado: true }, { pagado: true }, { pagoOnline: { verificadoPor: 'servidor' } }, { webAprobado: true, origenPedidoWebId: 'web', montoAdelanto: 0 }]) {
    assert.equal(confirmedPayment(data, 'checkout'), null);
    assert.equal(confirmedPayment(data, 'erp'), null);
  }
  assert.equal(confirmedPayment({ status: 'paid_order_created', pedidoCreado: true, pedidoWebId: 'web', pago: { id: 'charge', montoPen: 120, metodo: 'culqi' } }, 'checkout').orderId, 'web');
  assert.equal(confirmedPayment({ webAprobado: true, origenPedidoWebId: 'web', montoAdelanto: 50, whatsappSolicitado: true }, 'erp').method, 'whatsapp');
});

test('el embudo separa interacciones, solicitudes y pagos confirmados sin duplicar un pedido', () => {
  const value = productFunnel([
    { type: 'product_view' }, { type: 'product_interaction', eventData: { action: 'video_play' } },
    { type: 'order_requested', eventData: { orderId: 'one' } }, { type: 'order_requested', eventData: { orderId: 'one' } },
    { type: 'purchase_complete', eventData: { orderId: 'fake-client-purchase' } },
  ], [{ orderId: 'one', method: 'whatsapp' }, { orderId: 'one', method: 'whatsapp' }]);
  assert.equal(value.productViews, 1); assert.equal(value.videoPlays, 1);
  assert.equal(value.requests, 1); assert.equal(value.confirmedOrders, 1); assert.equal(value.whatsappPaid, 1);
});

test('los reintentos y el traslado del pedido al ERP crean un solo registro; los fallos se reintentan', async () => {
  const receipts = new Map(); let unavailable = false;
  const output = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../productFunnel'), 'utf8'), {
    exports: output,
    require(name) {
      if (name === './productFunnelLogic') return require('../productFunnelLogic');
      if (name === 'firebase-functions') return { runWith: () => ({ firestore: { document: () => ({ onWrite: f => f }) } }) };
      if (name === 'firebase-admin') return { firestore: () => ({ collection: () => ({ doc: id => ({ create: async value => {
        if (unavailable) throw Error('unavailable');
        if (receipts.has(id)) throw Object.assign(Error('exists'), { code: 6 });
        receipts.set(id, value);
      } }) }) }) };
      throw Error(name);
    },
  });
  const event = data => ({ before: { exists: false }, after: { exists: true, data: () => data } });
  const context = { timestamp: '2026-11-23T12:00:00Z' };
  const online = event({ status: 'paid_order_created', pedidoCreado: true, pedidoWebId: 'web', pago: { id: 'charge', montoPen: 120, metodo: 'culqi' } });
  unavailable = true;
  await assert.rejects(output.recordCheckoutPaymentAnalytics(online, context), /unavailable/);
  unavailable = false;
  await output.recordCheckoutPaymentAnalytics(online, context);
  await output.recordCheckoutPaymentAnalytics(online, context);
  await output.recordErpPaymentAnalytics(event({ webAprobado: true, origenPedidoWebId: 'web', montoAdelanto: 120 }), context);
  assert.equal(receipts.size, 1);
  assert.equal([...receipts.values()][0].confirmedAtMs, Date.parse(context.timestamp));
});
