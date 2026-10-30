// Execute the ACTUAL exported web charge handler in an isolated VM with an
// in-memory ledger and fake provider. No Admin SDK, network or live keys.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const parser = require('@babel/parser');
const mobile = require('../mobileCheckout');
const source = fs.readFileSync(require.resolve('../index'), 'utf8');
const ast = parser.parse(source, { sourceType: 'script' });
let handlerSource; let prepareSource;
for (const statement of ast.program.body) {
  const node = statement.expression;
  if (node?.type === 'AssignmentExpression' && node.left?.object?.name === 'exports' && node.left?.property?.name === 'processCulqiPayment') {
    const handler = node.right.arguments[0]; handlerSource = source.slice(handler.start, handler.end);
  }
  if (node?.type === 'AssignmentExpression' && node.left?.object?.name === 'exports' && node.left?.property?.name === 'prepareCheckoutPayment') {
    const handler = node.right.arguments[0]; prepareSource = source.slice(handler.start, handler.end);
  }
}
assert.ok(handlerSource, 'charge handler must exist');
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
async function fixture(provider) {
  const raw = new Map([['polo', { name: 'Polo', price: 149.7, inStock: 5 }]]);
  const input = { contract: 'mobile-v1', expectedUid: 'a', requestId: 'abcdefghijklmnopqrst', expectedTotal: 164.7,
    address: { customerName: 'Prueba', docType: 'DNI', dni: '12345678', phone: '912345678', country: 'PE', city: 'Lima', district: 'Miraflores', address: 'Calle de prueba' },
    email: 'cliente@wala.test', items: [{ productId: 'polo', quantity: 1, selection: { variantId: null, size: null, pieces: {} } }] };
  const prepared = await mobile.build(input, 'a', async () => raw);
  const intent = { uid: 'a', status: 'prepared', amountPen: 164.7, mobile: prepared.meta, orderPayload: prepared.payload };
  const ledger = new Map(); let tail = Promise.resolve(); let calls = 0; let orders = 0; let anomalies = 0;
  const ref = { async set(data) { Object.assign(intent, data); } };
  const context = {
    functions: { https: { HttpsError } }, process: { env: { CULQI_SECRET_KEY: 'sk_test_fixture', CULQI_PUBLIC_KEY: 'pk_test_fixture', MOBILE_CHECKOUT_ENABLED: 'true' } },
    console: { warn() {}, error() {} }, esPrecalentamiento: () => false, precalentar() {},
    erpCobranza: { USUARIO_PORTAL: 'test@wala.test' }, CULQI_API: 'https://fake.invalid', mobileCheckout: mobile,
    mobileCheckoutError: (error) => new HttpsError('failed-precondition', error.message), readMobileProducts: async () => raw, readMobileDesigns: async () => new Map(),
    readCheckoutIntent: async (id, ctx) => { if (ctx.auth.uid !== intent.uid) throw new HttpsError('permission-denied', 'owner'); return { id, intent: { ...intent }, ref }; },
    pagos: { cobroDeIntencion: (i) => i.amountPen, aCentimos: (n) => Math.round(n * 100), coincideMonto: (a, b) => a === b },
    formatoSoles: (n) => String(n), FieldValue: { serverTimestamp: () => 1 },
    db: { collection: (name) => ({ doc: (id) => ({ name, id, async get() { return { exists: ledger.has(id), data: () => ledger.get(id) }; }, async set(data) { ledger.set(id, { ...ledger.get(id), ...data }); } }) }),
      runTransaction(action) { const run = tail.then(() => action({
        get: async (r) => ({ exists: ledger.has(r.id), data: () => ledger.get(r.id) }),
        create: (r, data) => ledger.set(r.id, data), update: (r, data) => ledger.set(r.id, { ...ledger.get(r.id), ...data }),
      })); tail = run.catch(() => {}); return run; } },
    reservarCobroIntencion: async () => { if (intent.status !== 'prepared') throw new HttpsError('already-exists', 'locked'); intent.status = 'cobrando'; },
    liberarCobroIntencion: async () => { intent.status = 'prepared'; },
    registrarAnomaliaPago: async () => { anomalies++; },
    constancia: { medioDeCargoCulqi: () => 'tarjeta' },
    createPaidWebOrderFromIntent: async () => { if (intent.status !== 'paid_order_created') orders++; Object.assign(intent, { status: 'paid_order_created', pedidoCreado: true, pedidoWebId: prepared.key.id }); return prepared.key.id; },
    fetch: async (_url, options) => { calls++; return provider(JSON.parse(options.body)); },
    requireAuth: (ctx) => ctx.auth.uid, CHECKOUT_INTENTS_COLLECTION: 'checkout_payment_intents', PORTAL_USERS_COLLECTION: 'portal_clientes_users',
    checkoutOrderId: (payload) => payload.numeroPedido, reservaCheckoutLiberable: async () => null, referidoParaCheckout: async () => null,
    verificarPreciosYStock: async (products) => ({ subtotal: Object.values(products).reduce((sum, p) => sum + p.precio * p.cantidad, 0), topeMonedas: 0 }),
    totalEsperadoCheckout: require('../checkoutTotals').totalEsperadoCheckout, ENVIO_ESTANDAR: 15, ENVIO_GRATIS_DESDE: 100,
    toleranciaCheckout: () => 0.01,
    mobileCheckoutResponse: (id, i) => ({ ...mobile.view(id, i), publicKey: 'pk_test_fixture' }),
  };
  context.pagos.limpiarPayloadCliente = (payload) => payload;
  context.pagos.redondear = (amount) => Math.round(amount * 100) / 100;
  const handler = vm.runInNewContext(`(${handlerSource})`, context);
  const prepareHandler = vm.runInNewContext(`(${prepareSource})`, context);
  const data = { tokenId: 'tkn_test_token0001', amount: 16470, currency: 'PEN', email: input.email, checkoutIntentId: prepared.key.id, deviceId: 'device_test0001' };
  return { pay: (extra = {}, uid = 'a') => handler({ ...data, ...extra }, { auth: { uid, token: { email: input.email } } }), intent, ledger,
    prepare: (data) => prepareHandler(data, { auth: { uid: 'a', token: { email: input.email } } }), input, context,
    counts: () => ({ calls, orders, anomalies }) };
}
const approved = (body) => ({ ok: true, status: 200, json: async () => ({ object: 'charge', id: 'chr_test_charge0001', amount: body.amount, currency_code: body.currency_code, outcome: { type: 'venta_exitosa' } }) });
test('el handler web crea un solo pedido al confirmar Culqi y reutiliza el recibo al reintentar', async () => {
  const f = await fixture(approved);
  assert.equal((await f.pay()).success, true);
  f.context.readMobileProducts = async () => new Map(); // Sold inventory may be gone by recovery time.
  assert.equal((await f.pay()).success, true);
  assert.deepEqual(f.counts(), { calls: 1, orders: 1, anomalies: 0 });
});

test('revalidación fallida antes de cobrar no deja el token en proceso', async () => {
  const f = await fixture(approved); f.context.readMobileProducts = async () => new Map();
  await assert.rejects(f.pay()); assert.equal(f.counts().calls, 0);
  assert.equal(f.ledger.get('tkn_test_token0001').status, 'failed'); assert.equal(f.intent.status, 'prepared');
});
test('preparación REAL aplica S/200 a mobile-v1 y mantiene S/100 al checkout anterior', async () => {
  const f = await fixture(approved);
  const modern = await f.prepare({ mobileCheckout: f.input });
  assert.equal(modern.totals.shipping, 15); assert.equal(modern.totals.total, 164.7);
  assert.equal((await f.prepare({ mobileCheckout: f.input })).intentId, modern.intentId);
  assert.equal(f.ledger.get(modern.intentId).totalesServidor.envio, 15);
  const legacy = await f.prepare({ orderPayload: { numeroPedido: 'WEB-legacy', montoTotal: 149.7, productos: { item: { productoId: 'polo', precio: 149.7, cantidad: 1 } } } });
  assert.equal(legacy.amountPen, 149.7); assert.equal(f.ledger.get('WEB-legacy').totalesServidor.envio, 0);
});
test('preparación REAL desactivada no genera una intención de cobro', async () => {
  const f = await fixture(approved); f.context.process.env.MOBILE_CHECKOUT_ENABLED = 'false';
  await assert.rejects(f.prepare({ mobileCheckout: f.input })); assert.equal(f.ledger.size, 0);
});
test('desactivar pagos móviles frena un cobro nuevo, pero no pierde un recibo confirmado', async () => {
  const f = await fixture(approved); await f.pay(); f.context.process.env.MOBILE_CHECKOUT_ENABLED = 'false';
  assert.equal((await f.pay()).success, true); assert.equal(f.counts().calls, 1);
  const disabled = await fixture(approved); disabled.context.process.env.MOBILE_CHECKOUT_ENABLED = 'false';
  await assert.rejects(disabled.pay()); assert.equal(disabled.counts().calls, 0);
});
test('los pagos legacy aprobados siguen funcionando y un 201 sin cargo no fabrica un pedido', async () => {
  const legacy = await fixture(approved); delete legacy.intent.mobile;
  assert.equal((await legacy.pay()).success, true); assert.equal(legacy.counts().orders, 1);
  const challenge = await fixture(() => ({ ok: true, status: 201, json: async () => ({ object: 'error' }) })); delete challenge.intent.mobile;
  await assert.rejects(challenge.pay()); assert.equal(challenge.counts().orders, 0);
});
test('dos callbacks simultáneos no cobran dos veces', async () => {
  const f = await fixture(approved); const result = await Promise.allSettled([f.pay(), f.pay()]);
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1); assert.equal(f.counts().calls, 1); assert.equal(f.counts().orders, 1);
});
test('201 pide 3DS, conserva token/dispositivo y solo crea pedido tras el cargo real', async () => {
  let count = 0;
  const f = await fixture((body) => ++count === 1 ? { ok: true, status: 201, json: async () => ({ object: 'error', action_code: '3DS_VALIDATION_NEEDED' }) } : approved(body));
  assert.equal((await f.pay()).requires3DS, true); assert.equal(f.counts().orders, 0);
  await assert.rejects(f.pay({ deviceId: 'device_otro0001', authentication3DS: { eci: '05', xid: 'id', cavv: 'proof', protocolVersion: '2.1.0' } }));
  const result = await f.pay({ authentication3DS: { eci: '05', xid: 'id', cavv: 'proof', protocolVersion: '2.1.0' } });
  assert.equal(result.success, true); assert.equal(f.counts().orders, 1); assert.equal(f.counts().calls, 2);
});
test('respuesta perdida mantiene cerrojo y no permite un nuevo token', async () => {
  const f = await fixture(async () => { throw new Error('lost'); });
  await assert.rejects(f.pay(), { code: 'unavailable' });
  assert.equal(f.intent.status, 'cobrando');
  await assert.rejects(f.pay({ tokenId: 'tkn_test_otro0002' }));
  assert.equal(f.counts().calls, 1); assert.equal(f.counts().orders, 0);
});
test('importe o cuenta distintos no llegan a Culqi', async () => {
  const f = await fixture(approved);
  await assert.rejects(f.pay({ amount: 1 })); await assert.rejects(f.pay({}, 'b'));
  assert.equal(f.counts().calls, 0);
});
test('un JSON ambiguo o un monto distinto nunca se marca pagado', async () => {
  for (const reply of [{ success: true }, { object: 'charge', id: 'chr_test_wrong0001', amount: 1, currency_code: 'PEN' }]) {
    const f = await fixture(() => ({ ok: true, status: 200, json: async () => reply }));
    await assert.rejects(f.pay(), { code: 'unavailable' }); assert.equal(f.counts().orders, 0); assert.equal(f.intent.status, 'cobrando');
  }
});
test('rechazo explícito no crea pedido y permite cancelar la intención', async () => {
  const f = await fixture(() => ({ ok: false, status: 400, json: async () => ({ object: 'error', user_message: 'rechazado' }) }));
  await assert.rejects(f.pay()); assert.equal(f.counts().orders, 0); assert.equal(f.intent.status, 'prepared');
});
