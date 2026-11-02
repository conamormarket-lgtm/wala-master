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
let handlerSource; let prepareSource; let cancelSource; let whatsappSource;
for (const statement of ast.program.body) {
  const node = statement.expression;
  if (node?.type === 'AssignmentExpression' && node.left?.object?.name === 'exports' && node.left?.property?.name === 'processCulqiPayment') {
    const handler = node.right.arguments[0]; handlerSource = source.slice(handler.start, handler.end);
  }
  if (node?.type === 'AssignmentExpression' && node.left?.object?.name === 'exports' && node.left?.property?.name === 'prepareCheckoutPayment') {
    const handler = node.right.arguments[0]; prepareSource = source.slice(handler.start, handler.end);
  }
  if (node?.type === 'AssignmentExpression' && node.left?.object?.name === 'exports' && node.left?.property?.name === 'crearSolicitudWhatsappSecure') {
    const handler = node.right.arguments[0]; whatsappSource = source.slice(handler.start, handler.end);
  }
  if (node?.type === 'AssignmentExpression' && node.left?.object?.name === 'exports' && node.left?.property?.name === 'cancelMobileCheckoutSecure') {
    const handler = node.right.arguments[0]; cancelSource = source.slice(handler.start, handler.end);
  }
}
assert.ok(handlerSource, 'charge handler must exist');
// Una escritura con los valores especiales de FieldValue (sumar, borrar) del fixture.
const merge = (before = {}, data) => { const out = { ...before };
  for (const [key, value] of Object.entries(data)) {
    if (value && value.delete === true) delete out[key];
    else if (value && typeof value.increment === 'number') out[key] = (Number(out[key]) || 0) + value.increment;
    else out[key] = value;
  }
  return out; };
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
async function fixture(provider) {
  const raw = new Map([['polo', { name: 'Polo', price: 149.7, inStock: 5 }]]);
  const input = { contract: 'mobile-v1', expectedUid: 'a', requestId: 'abcdefghijklmnopqrst', expectedTotal: 164.7,
    address: { customerName: 'Prueba', docType: 'DNI', dni: '12345678', phone: '912345678', country: 'PE', city: 'Lima', district: 'Miraflores', address: 'Calle de prueba' },
    email: 'cliente@wala.test', items: [{ productId: 'polo', quantity: 1, selection: { variantId: null, size: null, pieces: {} } }] };
  const prepared = await mobile.build(input, 'a', async () => raw);
  const intent = { uid: 'a', status: 'prepared', amountPen: 164.7, mobile: prepared.meta, orderPayload: prepared.payload };
  const ledger = new Map(); let tail = Promise.resolve(); let calls = 0; let orders = 0; let anomalies = 0;
  // Las tarjetas guardadas de la cuenta "a" (tarjetas_a/guardadas) y las que se guardan al pagar.
  const savedCards = new Map([['crd_test_guardada01', { culqiCardId: 'crd_test_guardada01', marca: 'Visa', ultimos4: '4242' }]]); const newCards = [];
  const ref = { async set(data) { Object.assign(intent, data); } };
  const context = {
    functions: { https: { HttpsError } }, process: { env: { CULQI_SECRET_KEY: 'sk_test_fixture', CULQI_PUBLIC_KEY: 'pk_test_fixture', MOBILE_CHECKOUT_ENABLED: 'true' } },
    console: { warn() {}, error() {} }, esPrecalentamiento: () => false, precalentar() {},
    erpCobranza: { USUARIO_PORTAL: 'test@wala.test' }, CULQI_API: 'https://fake.invalid', mobileCheckout: mobile,
    mobileCheckoutError: (error) => new HttpsError('failed-precondition', error.message), readMobileProducts: async () => raw, readMobileDesigns: async () => new Map(),
    readCheckoutIntent: async (id, ctx) => { if (ctx.auth.uid !== intent.uid) throw new HttpsError('permission-denied', 'owner'); return { id, intent: { ...intent }, ref }; },
    pagos: { cobroDeIntencion: (i) => i.amountPen, aCentimos: (n) => Math.round(n * 100), coincideMonto: (a, b) => a === b },
    formatoSoles: (n) => String(n), FieldValue: { serverTimestamp: () => 1, increment: (n) => ({ increment: n }), delete: () => ({ delete: true }) },
    applyDebit: require('../economyLogic').applyDebit,
    tarjetas: require('../tarjetasGuardadas'),
    refTarjetas: (owner) => ({ collection: () => ({ doc: (id) => ({ get: async () => ({ exists: owner === 'a' && savedCards.has(id), data: () => savedCards.get(id) }) }) }) }),
    guardarTarjetaCulqi: async ({ tokenId }) => { const tarjeta = { culqiCardId: 'crd_test_nueva00001', marca: 'Mastercard', ultimos4: '5555' };
      newCards.push(tokenId); return { culqiCardId: tarjeta.culqiCardId, tarjeta }; },
    db: { collection: (name) => ({ doc: (id) => ({ name, id, async get() { return { exists: ledger.has(id), data: () => ledger.get(id) }; }, async set(data) { ledger.set(id, { ...ledger.get(id), ...data }); } }) }),
      runTransaction(action) { const run = tail.then(() => action({
        get: async (r) => ({ exists: ledger.has(r.id), data: () => ledger.get(r.id) }),
        create: (r, data) => ledger.set(r.id, data), update: (r, data) => ledger.set(r.id, merge(ledger.get(r.id), data)),
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
  const cancelHandler = vm.runInNewContext(`(${cancelSource})`, context);
  const data = { tokenId: 'tkn_test_token0001', amount: 16470, currency: 'PEN', email: input.email, checkoutIntentId: prepared.key.id, deviceId: 'device_test0001' };
  return { pay: (extra = {}, uid = 'a') => handler({ ...data, ...extra }, { auth: { uid, token: { email: input.email, firebase: { sign_in_provider: 'password' } } } }), intent, ledger, newCards,
    prepare: (data) => prepareHandler(data, { auth: { uid: 'a', token: { email: input.email } } }), input, context,
    cancel: (requestId) => cancelHandler({ requestId }, { auth: { uid: 'a', token: { email: input.email } } }),
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
test('preparación REAL con monedas: tope de la marca y saldo del servidor, se reservan y vuelven al cancelar', async () => {
  const f = await fixture(approved);
  f.context.verificarPreciosYStock = async () => ({ subtotal: 149.7, topeMonedas: 74 });
  f.ledger.set('a', { monedas: 30, monedasEnEspera: 0, historialMonedasEspera: [] });
  const withCoins = { ...f.input, requestId: 'monedasmonedas000001', coins: 30, expectedTotal: 134.7 };
  const session = await f.prepare({ mobileCheckout: withCoins });
  assert.equal(session.totals.coins, 30); assert.equal(session.totals.total, 134.7);
  assert.equal(f.ledger.get(session.intentId).amountPen, 134.7); assert.equal(f.ledger.get(session.intentId).totalesServidor.monedas, 30);
  assert.equal(f.ledger.get('a').monedas, 0); assert.equal(f.ledger.get('a').monedasEnEspera, 30);
  assert.equal(JSON.stringify(f.ledger.get('a').reservaMonedasCheckout), JSON.stringify({ intentId: session.intentId, amount: 30 }));
  // Más de las que tiene, o más que el tope de sus marcas: no se prepara nada.
  await assert.rejects(f.prepare({ mobileCheckout: { ...withCoins, requestId: 'monedasmonedas000002', coins: 31, expectedTotal: 133.7 } }), /monedas/);
  f.context.verificarPreciosYStock = async () => ({ subtotal: 149.7, topeMonedas: 10 });
  f.ledger.set('a', { ...f.ledger.get('a'), monedas: 50 });
  await assert.rejects(f.prepare({ mobileCheckout: { ...withCoins, requestId: 'monedasmonedas000003', coins: 20, expectedTotal: 144.7 } }), /hasta 10 monedas/);
  f.ledger.set('a', { ...f.ledger.get('a'), monedas: 0 });
  // Cancelar devuelve las 30 una sola vez.
  assert.equal((await f.cancel(withCoins.requestId)).cancelled, true);
  assert.equal(f.ledger.get(session.intentId).status, 'vencida');
  assert.equal(f.ledger.get('a').monedas, 30); assert.equal(f.ledger.get('a').monedasEnEspera, 0);
  assert.equal(f.ledger.get('a').reservaMonedasCheckout, undefined);
  assert.equal(f.ledger.get('a').historialMonedasEspera[0].status, 'released');
  await f.cancel(withCoins.requestId);
  assert.equal(f.ledger.get('a').monedas, 30);
});
test('preparación REAL con regalo: el pedido guardado lleva giftDetails y la app ve para quién es', async () => {
  const f = await fixture(approved);
  const gift = { recipientName: 'María', message: '¡Feliz cumpleaños!', sticker: 'kapi-love' };
  const session = await f.prepare({ mobileCheckout: { ...f.input, requestId: 'regaloregaloregalo01', gift } });
  assert.equal(session.gift.recipientName, 'María'); assert.equal(session.totals.total, 164.7);
  assert.equal(JSON.stringify(f.ledger.get(session.intentId).orderPayload.giftDetails), JSON.stringify({ isGift: true, ...gift }));
});
const savedCard = { tokenId: undefined, deviceId: undefined, tarjetaId: 'crd_test_guardada01', intentoId: 'intentotarjeta0001' };
const challenge = () => ({ ok: true, status: 201, json: async () => ({ object: 'error', action_code: '3DS_VALIDATION_NEEDED' }) });
test('tarjeta guardada en la app: se cobra con su id, sin formulario ni dispositivo, y crea un solo pedido', async () => {
  let body;
  const f = await fixture((sent) => { body = sent; return approved(sent); });
  assert.equal((await f.pay(savedCard)).success, true);
  assert.equal(body.source_id, 'crd_test_guardada01'); assert.equal(body.antifraud_details, undefined); assert.equal(body.authentication_3DS, undefined);
  assert.deepEqual(f.counts(), { calls: 1, orders: 1, anomalies: 0 });
});
test('tarjeta guardada en la app: si el banco pide verificación se corta como en la web, sin cobrar y con el pago libre', async () => {
  const f = await fixture(challenge);
  await assert.rejects(f.pay(savedCard), /tarjeta nueva/);
  assert.equal(f.intent.status, 'prepared'); assert.equal(f.intent.mobilePending3DS, undefined); assert.equal(f.counts().orders, 0);
  assert.equal(f.ledger.get('tarjeta_a_intentotarjeta0001').status, 'failed');
});
test('tarjeta guardada en la app: ajena, de otro entorno o con verificación inventada no llega a Culqi', async () => {
  const f = await fixture(approved);
  await assert.rejects(f.pay({ ...savedCard, tarjetaId: 'crd_test_ajena00001' }), /ya no está guardada/);
  await assert.rejects(f.pay({ ...savedCard, tarjetaId: 'crd_live_guardada01' }));
  await assert.rejects(f.pay({ ...savedCard, intentoId: 'intentotarjeta0002', authentication3DS: { eci: '05', xid: 'x', cavv: 'c', protocolVersion: '2.1.0' } }), /verificación/);
  assert.equal(f.counts().calls, 0);
});
test('guardar esta tarjeta en la app: se guarda antes de cobrar y se cobra con ella; con verificación se corta y queda guardada', async () => {
  let body;
  const f = await fixture((sent) => { body = sent; return approved(sent); });
  const paid = await f.pay({ guardarTarjeta: true });
  assert.equal(paid.success, true); assert.equal(body.source_id, 'crd_test_nueva00001'); assert.equal(paid.tarjetaGuardada.ultimos4, '5555');
  assert.equal(body.antifraud_details.device_finger_print_id, 'device_test0001');
  const g = await fixture(challenge);
  await assert.rejects(g.pay({ guardarTarjeta: true }), /quedó guardada/);
  assert.equal(g.intent.mobilePending3DS, undefined); assert.equal(g.counts().orders, 0); assert.equal(g.newCards.length, 1);
});
test('la vuelta de la verificación del banco no vuelve a guardar la tarjeta', async () => {
  const f = await fixture(approved);
  f.ledger.set('tkn_test_token0001', { status: 'challenge', uid: 'a', objetivo: `checkout:${mobile.identity(f.input, 'a').id}`,
    deviceId: 'device_test0001', amount: 16470, currency: 'PEN' });
  assert.equal((await f.pay({ guardarTarjeta: true, authentication3DS: { eci: '05', xid: 'x', cavv: 'c', protocolVersion: '2.1.0' } })).success, true);
  assert.equal(f.newCards.length, 0); assert.equal(f.counts().calls, 1);
});
test('un pedido de la app pedido por WhatsApp ya no se cancela (sus monedas siguen reservadas) y la app lo ve', async () => {
  const f = await fixture(approved);
  const session = await f.prepare({ mobileCheckout: { ...f.input, requestId: 'whatsappwhatsapp0001' } });
  f.ledger.set(session.intentId, { ...f.ledger.get(session.intentId), whatsappSolicitado: true });
  await assert.rejects(f.cancel('whatsappwhatsapp0001'), /WhatsApp/);
  assert.equal(f.ledger.get(session.intentId).status, 'prepared');
  assert.equal(mobile.view(session.intentId, f.ledger.get(session.intentId)).whatsappRequested, true);
  assert.equal(mobile.view(session.intentId, { ...f.ledger.get(session.intentId), whatsappSolicitado: false }).whatsappRequested, undefined);
});
test('pedir por WhatsApp desde la app marca el cupón usado una sola vez; el de la web lo sigue canjeando el navegador', async () => {
  const run = async (intent) => {
    const coupons = new Map([['c1', { status: 'active', code: 'WALA-10' }]]); const erp = new Map(); const writes = [];
    const ref = { id: 'MC-intento', set: async (data) => writes.push(data) };
    const context = {
      functions: { https: { HttpsError } }, esPrecalentamiento: () => false, precalentar() {}, console: { warn() {}, error() {} },
      INTENCION_NO_COBRABLE: new Set(['reemplazada', 'vencida']), checkoutOrderId: (p) => p.numeroPedido, FieldValue: { serverTimestamp: () => 1 },
      readCheckoutIntent: async () => ({ id: 'MC-intento', ref, intent, orderPayload: intent.orderPayload }),
      getErpDb: () => ({ collection: () => ({ doc: (id) => ({ id, get: async () => ({ exists: erp.has(id) }), set: async (d) => erp.set(id, d) }) }),
        runTransaction: async (fn) => fn({ get: async (r) => ({ exists: erp.has(r.id) }), set: (r, d) => erp.set(r.id, { ...erp.get(r.id), ...d }) }) }),
      congelarDisenos: async (p) => p, camposErpWala: async () => ({}), ERP_CANAL_WALA: 'WALA', WALA_ORDERS_COLLECTION: 'wala_pedidos', sanearWalaDocId: (x) => x,
      pagos: { resumirProductos: () => [] }, marcarCreacionesDelPedido: async () => {}, vincularCompraReferido: async () => {},
      buscarCupon: async (_uid, code) => { const [id, cupon] = [...coupons].find(([, c]) => c.code === code) || []; return id ? { ref: { id }, cupon } : null; },
      db: { runTransaction: async (fn) => fn({ update: (r, d) => coupons.set(r.id, { ...coupons.get(r.id), ...d }) }) },
    };
    const handler = vm.runInNewContext(`(${whatsappSource})`, context);
    const result = await handler({ intentId: 'MC-intento' }, { auth: { uid: 'a' } });
    await handler({ intentId: 'MC-intento' }, { auth: { uid: 'a' } });
    return { result, coupon: coupons.get('c1'), erp, writes };
  };
  const payload = { numeroPedido: 'MC-intento', cuponCode: 'WALA-10', descuentoCupon: 10, productos: {} };
  const app = await run({ uid: 'a', status: 'prepared', mobile: { contract: 'mobile-v1' }, orderPayload: payload });
  assert.equal(app.result.id, 'MC-intento'); assert.equal(app.coupon.status, 'used'); assert.equal(app.coupon.orderId, 'MC-intento');
  assert.equal(app.coupon.descuentoAplicado, 10); assert.equal(app.erp.get('MC-intento').metodoPago, 'whatsapp');
  assert.equal(app.writes.every((w) => w.whatsappSolicitado === true), true);
  const web = await run({ uid: 'a', status: 'prepared', orderPayload: payload });
  assert.equal(web.coupon.status, 'active');
});
test('saldo de un pedido desde la app: el token del formulario cobra el saldo del servidor, sin 3DS como la web', async () => {
  let body; let registered = 0;
  const f = await fixture((sent) => { body = sent; return approved(sent); });
  Object.assign(f.context, {
    objetivoSaldoPedido: async (id) => ({ tipo: 'saldo', clave: `saldo:pedidos/${id}`, coleccion: 'pedidos', pedidoId: id, montoCentimos: 3500, moneda: 'PEN' }),
    reservarCobroGenerico: async () => 'cerrojo', liberarCobroGenerico: async () => {},
    registrarPagoSaldo: async () => { registered++; }, marcarWalaPedidoPagado: async () => {},
  });
  const handler = vm.runInNewContext(`(${handlerSource})`, f.context);
  const pay = (extra) => handler({ tokenId: 'tkn_test_saldo0001', amount: 3500, currency: 'PEN', email: 'cliente@wala.test', description: 'Pago de saldo en Walá',
    metadata: { pedidoId: 'PED-1' }, ...extra }, { auth: { uid: 'a', token: { email: 'cliente@wala.test' } } });
  assert.equal((await pay()).success, true);
  assert.equal(body.amount, 3500); assert.equal(body.source_id, 'tkn_test_saldo0001'); assert.equal(body.antifraud_details, undefined); assert.equal(registered, 1);
  await assert.rejects(pay({ tokenId: 'tkn_test_saldo0002', amount: 3000 }), /S\/ 35|35\.00|3500/);
  const g = await fixture(() => ({ ok: true, status: 201, json: async () => ({ object: 'error', action_code: '3DS_VALIDATION_NEEDED' }) }));
  Object.assign(g.context, f.context, { fetch: g.context.fetch });
  const challenge = vm.runInNewContext(`(${handlerSource})`, g.context);
  await assert.rejects(challenge({ tokenId: 'tkn_test_saldo0003', amount: 3500, currency: 'PEN', email: 'cliente@wala.test', metadata: { pedidoId: 'PED-1' } },
    { auth: { uid: 'a', token: { email: 'cliente@wala.test' } } }), /verificación adicional/);
});
