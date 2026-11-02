const test = require('node:test');
const assert = require('node:assert/strict');
const mobile = require('../mobileCheckout');
const { totalEsperadoCheckout } = require('../checkoutTotals');
const address = { customerName: 'Cliente de prueba', docType: 'DNI', dni: '12345678', phone: '912345678', country: 'PE', city: 'Lima', department: '', province: '', district: 'Miraflores', address: 'Calle de prueba 123' };
const input = (price = 149.7) => ({ contract: 'mobile-v1', requestId: 'abcdefghijklmnopqrst', expectedUid: 'a', items: [{ productId: 'polo', quantity: 1, selection: { variantId: null, size: null, pieces: {} } }], address, email: 'cliente@wala.test', expectedTotal: price + mobile.shipping(price) });
const read = (extra = {}) => async (ids) => new Map(ids.map((id) => [id, { name: 'Polo', price: 149.7, inStock: 5, ...extra }]));
test('nuevo contrato cobra S/15 entre 100 y 200; el contrato anterior sigue en 100', async () => {
  assert.equal((await mobile.build(input(), 'a', read())).payload.montoTotal, 164.7);
  assert.equal(totalEsperadoCheckout({ subtotal: 149.7, envioEstandar: 15, envioGratisDesde: 100 }).total, 149.7);
  assert.equal(mobile.shipping(200), 15); assert.equal(mobile.shipping(200.01), 0);
});
test('el pedido usa datos del servidor y no privilegios ni precios inyectados', async () => {
  const raw = { ...input(), role: 'admin', userId: 'otra', pagado: true };
  const result = await mobile.build(raw, 'a', read());
  assert.equal(result.payload.userId, 'a'); assert.equal(result.payload.pagado, undefined); assert.equal(result.payload.role, undefined);
  assert.equal(result.payload.productos.item_0.precio, 149.7); assert.equal(result.meta.input.role, undefined);
  await assert.rejects(mobile.build({ ...raw, expectedTotal: 1 }, 'a', read()));
});
test('idempotencia es por cuenta e intento y detecta cambios de datos', () => {
  const first = mobile.identity(input(), 'a');
  assert.deepEqual(mobile.identity(input(), 'a'), first);
  assert.notEqual(mobile.identity({ ...input(), expectedUid: 'b' }, 'b').id, first.id);
  assert.notEqual(mobile.identity({ ...input(), email: 'otra@wala.test' }, 'a').hash, first.hash);
  assert.throws(() => mobile.identity(input(), 'b'));
});
test('revalida talla, color y stock general en el backend', async () => {
  await assert.rejects(mobile.build(input(), 'a', read({ inStock: 0 })));
  const variants = [{ id: 'negro', name: 'Negro', sizes: ['M'] }];
  await assert.rejects(mobile.build(input(), 'a', read({ hasVariants: true, variants })));
  const selected = { ...input(), items: [{ ...input().items[0], quantity: 2, selection: { variantId: 'negro', size: 'M', pieces: {} } }], expectedTotal: 299.4 };
  assert.equal((await mobile.build(selected, 'a', read({ hasVariants: true, variants }))).meta.summary.items[0].selection.size, 'M');
  await assert.rejects(mobile.build({ ...selected, items: [{ ...selected.items[0], quantity: 6 }], expectedTotal: 898.2 }, 'a', read({ hasVariants: true, variants })));
});
test('estado de pago no implica pedido creado hasta confirmación del backend', () => {
  const intent = { status: 'paid_order_created', pedidoCreado: false, mobile: { contract: 'mobile-v1', requestId: input().requestId, summary: {} } };
  assert.equal(mobile.view('id', intent).state, 'order-pending');
  assert.equal(mobile.view('id', { ...intent, pedidoCreado: true }).state, 'paid');
  assert.equal(mobile.view('id', { ...intent, status: 'cobrando' }).state, 'processing');
  assert.equal(mobile.view('id', { ...intent, status: 'prepared', mobilePending3DS: true }).state, 'challenge');
});
test('3DS solo deja pasar los campos documentados, sin dar por válido un objeto vacío', () => {
  assert.throws(() => mobile.threeDS({}));
  assert.deepEqual(mobile.threeDS({ eci: '05', xid: 'id', cavv: 'value', protocolVersion: '2.1.0', extra: 'drop' }), { eci: '05', xid: 'id', cavv: 'value', protocolVersion: '2.1.0' });
});
test('el cupón cuenta para el intento y llega al pedido como cuponCode, sin cambiar los intentos sin cupón', async () => {
  const plain = mobile.identity(input(), 'a');
  assert.deepEqual(mobile.identity({ ...input(), couponCode: '' }, 'a'), plain);
  const withCoupon = mobile.identity({ ...input(), couponCode: ' wala-10 ' }, 'a');
  assert.equal(withCoupon.id, plain.id);
  assert.notEqual(withCoupon.hash, plain.hash);
  assert.deepEqual(mobile.identity({ ...input(), couponCode: 'WALA-10' }, 'a'), withCoupon);
  const built = await mobile.build({ ...input(), couponCode: 'wala-10' }, 'a', read());
  assert.equal(built.payload.cuponCode, 'WALA-10');
  assert.equal(built.payload.montoTotal, 164.7);
  assert.equal(built.meta.input.couponCode, 'WALA-10');
  assert.equal((await mobile.build(input(), 'a', read())).payload.cuponCode, undefined);
  assert.throws(() => mobile.identity({ ...input(), couponCode: 'x; drop' }, 'a'));
});

test('una creación propia y guardada entra al pedido con sus archivos y el precio de la prenda', async () => {
  const file = (n) => `https://firebasestorage.googleapis.com/v0/b/x/o/designs%2Fa%2Fcrear%2Fimpresion%2F${n}.png?alt=media`;
  const design = { userId: 'a', tipo: 'crear', estado: 'guardada', name: 'Mi polera', productId: 'polera', color: { id: 'negro', nombre: 'Negro', hex: '#111' },
    layersByView: { pecho: [{ type: 'text', text: 'Hola' }, { type: 'image', src: 'https://x.test/foto.png' }], espalda: [] },
    vistasPrevias: [{ vista: 'frente', nombre: 'Frente', url: 'https://x.test/previa.jpg', zonas: ['pecho'] }],
    archivosImpresion: [{ vista: 'pecho', nombre: 'Pecho', url: file(1), ancho: 3000, alto: 3000, anchoCm: 25, altoCm: 25 }] };
  const polera = { name: 'Polera clásica', esPrendaBase: true, price: 89.9, salePrice: 79.9, variants: [{ id: 'negro', sizes: ['S', 'M'] }] };
  const readP = async (ids) => new Map(ids.map((id) => [id, id === 'polera' ? polera : { name: 'Polo', price: 149.7, inStock: 5 }]));
  const readD = (extra = {}) => async (ids) => new Map(ids.map((id) => [id, { ...design, ...extra }]));
  const creation = { designId: 'd1', quantity: 1, size: 'M' };
  const onlyCreation = { ...input(), items: [creation], expectedTotal: 79.9 + 15 };
  const built = await mobile.build(onlyCreation, 'a', readP, readD());
  const line = built.payload.productos.item_0;
  assert.equal(line.designId, 'd1'); assert.equal(line.personalizado, true); assert.equal(line.precio, 79.9); assert.equal(line.talla, 'M');
  assert.equal(line.disenoVistas.pecho.archivoImpresion, file(1)); assert.equal(line.disenoVistas.pecho.medida, '25 x 25 cm');
  assert.deepEqual(line.disenoVistas.pecho.textos, ['Hola']); assert.deepEqual(line.vistasPersonalizadas, ['pecho']);
  assert.equal(built.payload.montoTotal, 94.9); assert.equal(built.payload.esPersonalizado, true);
  assert.equal(built.payload.cantidad, 1); assert.match(built.payload.prendas, /x1/);
  assert.deepEqual(built.meta.input.items, [{ designId: 'd1', quantity: 1, size: 'M' }]);
  assert.equal(built.meta.summary.creations[0].name, 'Mi polera');
  // Junto con un producto del catálogo.
  const mixed = await mobile.build({ ...input(), items: [...input().items, creation], expectedTotal: 149.7 + 79.9 }, 'a', readP, readD());
  assert.equal(mixed.payload.productos.item_1.designId, 'd1');
  // Lo que no se acepta.
  await assert.rejects(mobile.build(onlyCreation, 'a', readP, readD({ userId: 'otra' })));
  await assert.rejects(mobile.build(onlyCreation, 'a', readP, readD({ estado: 'borrador' })));
  await assert.rejects(mobile.build(onlyCreation, 'a', readP, readD({ archivosImpresion: [] })));
  await assert.rejects(mobile.build(onlyCreation, 'a', readP, readD({ archivosImpresion: [{ vista: 'pecho', url: 'https://firebasestorage.googleapis.com/v0/b/x/o/designs%2Fotra%2Fa.png' }] })));
  await assert.rejects(mobile.build({ ...onlyCreation, items: [{ ...creation, size: 'XL' }] }, 'a', readP, readD()));
  await assert.rejects(mobile.build({ ...onlyCreation, items: [creation, creation], expectedTotal: 79.9 * 2 + 15 }, 'a', readP, readD()));
  await assert.rejects(mobile.build({ ...onlyCreation, expectedTotal: 1 }, 'a', readP, readD()));
});

test('cobra un "Mi combo" como la web: cada pieza en su línea, el precio repartido y la pieza fija tal cual', async () => {
  const archivo = 'https://firebasestorage.googleapis.com/v0/b/b/o/designs%2Fa%2Fcrear%2Fimpresion%2F1_pecho.png?alt=media';
  const productos = { c1: { name: 'Pack Yoryo', price: 220, salePrice: 199.99, esComboCrear: true, visible: false,
      comboCrear: { publicado: true, piezas: [{ prendaId: 'polera' }, { prendaId: 'reloj', fija: true, color: { id: 'oro', nombre: 'Oro', hex: '#D4AF37' } }] } },
    polera: { name: 'Polera', price: 129, esPrendaBase: true, variants: [{ id: 'negro', name: 'Negro', sizes: ['S', 'M'] }] },
    reloj: { name: 'Reloj', price: 120, variants: [{ id: 'oro', name: 'Oro', colorHex: '#D4AF37', images: ['https://x.test/reloj.png'] }] } };
  const disenos = { m1: { userId: 'a', tipo: 'comboCrear', comboId: 'c1', piezas: [{ designId: 'p1' }, { fija: true }] },
    p1: { userId: 'a', tipo: 'crear', estado: 'guardada', name: 'Mi polera', productId: 'polera', combo: { id: 'c1', pieza: 0 }, color: { id: 'negro', nombre: 'Negro', hex: '#111111' },
      archivosImpresion: [{ url: archivo, vista: 'pecho', ancho: 10, alto: 10 }], vistasPrevias: [{ url: 'https://x.test/p.jpg', vista: 'frente', zonas: ['pecho'] }],
      layersByView: { pecho: [{ type: 'text', text: 'Hola' }] } } };
  const leer = (fuente) => async (ids) => new Map(ids.filter((id) => fuente[id]).map((id) => [id, fuente[id]]));
  const fila = { comboId: 'c1', miComboId: 'm1', quantity: 2, piezas: [{ designId: 'p1', size: 'M' }, { fija: true }] };
  const pedido = (cambios = {}, d = disenos) => mobile.build({ ...input(), items: [{ ...fila, ...cambios }], expectedTotal: 399.98 + mobile.shipping(399.98) }, 'a', leer(productos), leer(d));
  const { payload, meta } = await pedido();
  const [polera, reloj] = [payload.productos.item_0_0, payload.productos.item_0_1];
  assert.deepEqual(polera.comboCrear, { comboId: 'c1', grupo: 0, pieza: 0, de: 2, miComboId: 'm1' });
  assert.equal(polera.precio + reloj.precio, 199.99);
  assert.deepEqual(mobile.repartirPrecio(199.99, 2), [99.99, 100]);
  assert.equal(polera.personalizado, true); assert.equal(polera.designId, 'p1'); assert.equal(polera.talla, 'M'); assert.equal(polera.cantidad, 2);
  assert.equal(polera.disenoVistas.pecho.archivoImpresion, archivo);
  assert.equal(reloj.personalizado, false); assert.equal(reloj.talCual, true); assert.equal(reloj.color, 'Oro'); assert.equal(reloj.urlImagen, 'https://x.test/reloj.png');
  assert.equal(payload.montoTotal, 399.98); assert.equal(payload.esPersonalizado, true); assert.match(payload.prendas, /\[COMBO\] Pack Yoryo: Polera \+ Reloj x2/);
  assert.deepEqual(meta.input.items, [{ comboId: 'c1', miComboId: 'm1', quantity: 2, piezas: [{ designId: 'p1', size: 'M' }, { fija: true }] }]);
  assert.equal(meta.summary.combos[0].piezas[0].name, 'Mi polera');
  // Las líneas pasan la misma validación de combos del servidor que un pedido de la web (validarCombos).
  const { createCartValidator } = require('../cartValidation');
  const db = { collection: () => ({ doc: (id) => ({ id }) }),
    getAll: async (...refs) => { refs.pop(); return refs.map((ref) => ({ id: ref.id, exists: !!productos[ref.id], data: () => productos[ref.id] })); } };
  const validar = createCartValidator({ db, HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } } });
  assert.equal((await validar(payload.productos, null)).subtotal, 399.98);
  // Otra cuenta, borrador, talla que no existe, piezas en otro orden, el "Mi combo" que no la tiene o un combo retirado.
  await assert.rejects(pedido({}, { ...disenos, m1: { ...disenos.m1, userId: 'b' } }), /ya no está disponible/);
  await assert.rejects(pedido({}, { ...disenos, p1: { ...disenos.p1, estado: 'borrador' } }), /sin terminar/);
  await assert.rejects(pedido({ piezas: [{ designId: 'p1', size: 'XL' }, { fija: true }] }), /talla/);
  await assert.rejects(pedido({ piezas: [{ fija: true }, { designId: 'p1', size: 'M' }] }), /Revisa las piezas/);
  await assert.rejects(pedido({}, { ...disenos, m1: { ...disenos.m1, piezas: [{ designId: 'otra' }, { fija: true }] } }), /cambió/);
  productos.c1.comboCrear.publicado = false;
  await assert.rejects(pedido(), /ya no está disponible/);
});
test('monedas: bajan los productos, el envío sigue midiéndose sobre el subtotal y quedan en el pedido', async () => {
  const withCoins = { ...input(), coins: 20, expectedTotal: 149.7 - 20 + 15 };
  const result = await mobile.build(withCoins, 'a', read());
  assert.equal(result.payload.montoTotal, 144.7);
  assert.equal(result.payload.descuentoMonedas, 20); assert.equal(result.payload.monedasEnEspera, 20);
  assert.deepEqual(result.meta.summary.totals, { subtotal: 149.7, shipping: 15, coins: 20, total: 144.7 });
  assert.equal(result.meta.input.coins, 20);
  // La misma cuenta que revisa prepareCheckoutPayment.
  assert.equal(totalEsperadoCheckout({ subtotal: 149.7, monedas: 20, envioEstandar: 15, envioGratisDesde: 200 }).total, 144.7);
  // El total sin descontarlas ya no coincide: el celular manda lo que mostró.
  await assert.rejects(mobile.build({ ...withCoins, expectedTotal: 164.7 }, 'a', read()));
  assert.equal((await mobile.build(input(), 'a', read())).payload.descuentoMonedas, undefined);
});
test('monedas: enteras y positivas; cambian la huella del intento, pero sin ellas es la de siempre', () => {
  for (const coins of [1.5, -1, '5', 2_000_000]) assert.throws(() => mobile.coinsOf({ coins }));
  assert.equal(mobile.coinsOf({}), 0); assert.equal(mobile.coinsOf({ coins: 0 }), 0);
  const plain = mobile.identity(input(), 'a');
  assert.equal(mobile.identity({ ...input(), coins: 0 }, 'a').hash, plain.hash);
  assert.notEqual(mobile.identity({ ...input(), coins: 10 }, 'a').hash, plain.hash);
});
test('regalo: para quién, mensaje y sticker llegan al pedido como giftDetails, como la web', async () => {
  const gift = { recipientName: '  María   José ', message: '¡Feliz cumpleaños!', sticker: 'kapi-party' };
  const result = await mobile.build({ ...input(), gift }, 'a', read());
  assert.deepEqual(result.payload.giftDetails, { isGift: true, recipientName: 'María José', message: '¡Feliz cumpleaños!', sticker: 'kapi-party' });
  assert.deepEqual(result.meta.input.gift, { recipientName: 'María José', message: '¡Feliz cumpleaños!', sticker: 'kapi-party' });
  assert.equal(result.meta.summary.gift.recipientName, 'María José');
  assert.equal(result.payload.montoTotal, 164.7);
  assert.equal((await mobile.build(input(), 'a', read())).payload.giftDetails, undefined);
});
test('regalo: rechaza datos incompletos, largos o un sticker inventado; cambia la huella solo si se manda', () => {
  const ok = { recipientName: 'María', message: 'Hola', sticker: 'kapi-love' };
  for (const gift of ['sí', [], { ...ok, recipientName: ' ' }, { ...ok, recipientName: 'a'.repeat(61) }, { ...ok, message: '' },
    { ...ok, message: 'a'.repeat(201) }, { ...ok, sticker: 'kapi-happy' }, { ...ok, sticker: undefined }]) {
    assert.throws(() => mobile.giftOf({ gift }));
  }
  assert.equal(mobile.giftOf({}), null);
  assert.equal(mobile.giftOf({ gift: { ...ok, message: 'a'.repeat(200) } }).message.length, 200);
  const plain = mobile.identity(input(), 'a');
  assert.equal(mobile.identity({ ...input(), gift: null }, 'a').hash, plain.hash);
  assert.notEqual(mobile.identity({ ...input(), gift: ok }, 'a').hash, plain.hash);
});
test('tal cual: una prenda con seVendeTalCual en la tienda se compra con la talla de su color; sin eso sigue siendo solo de Crear', async () => {
  const prenda = { name: 'Billetera', price: 59.9, esPrendaBase: true, seVendeTalCual: true, enTienda: true, brandId: 'yoryo',
    variants: [{ id: 'negro', name: 'Negro', sizes: [] }, { id: 'cafe', name: 'Café', sizes: ['Única'] }], prendaBase: { tallas: ['S', 'M'] } };
  const readRaw = (extra = {}) => async (ids) => new Map(ids.map((id) => [id, { ...prenda, ...extra }]));
  const order = (variantId, size) => ({ ...input(), items: [{ productId: 'billetera', quantity: 1, selection: { variantId, size, pieces: {} } }], expectedTotal: 74.9 });
  const result = await mobile.build(order('negro', 'M'), 'a', readRaw());
  assert.equal(result.payload.productos.item_0.color, 'Negro'); assert.equal(result.payload.productos.item_0.talla, 'M');
  assert.equal(result.payload.productos.item_0.personalizado, false); assert.equal(result.payload.productos.item_0.brandId, 'yoryo');
  assert.equal((await mobile.build(order('cafe', 'Única'), 'a', readRaw())).payload.montoTotal, 74.9);
  await assert.rejects(mobile.build(order('cafe', 'M'), 'a', readRaw()));
  await assert.rejects(mobile.build(order('negro', 'M'), 'a', readRaw({ seVendeTalCual: false })));
  await assert.rejects(mobile.build(order('negro', 'M'), 'a', readRaw({ enTienda: false })));
  await assert.rejects(mobile.build(order('negro', 'M'), 'a', readRaw({ inStock: 0 })));
  assert.equal(mobile.talCual({ ...prenda, inStock: '' }).inStock, true);
  assert.deepEqual(mobile.talCual(prenda).variants[0].sizes, ['Única', 'S', 'M']);
});
test('regalo de una lista: la fecha de entrega, la ocasión y el código llegan a giftDetails; sin ellos, el regalo de siempre', async () => {
  const gift = { recipientName: 'Ana', message: '¡Feliz cumple!', sticker: 'kapi-party', deliveryDate: '2026-12-05', deliveryEventLabel: 'Cumpleaños de Ana', wishlistUserCode: 'ana123' };
  const result = await mobile.build({ ...input(), gift }, 'a', read());
  assert.deepEqual(result.payload.giftDetails, { isGift: true, recipientName: 'Ana', message: '¡Feliz cumple!', sticker: 'kapi-party',
    deliveryDate: '2026-12-05', deliveryEventLabel: 'Cumpleaños de Ana', wishlistUserCode: 'ANA123' });
  const ok = { recipientName: 'Ana', message: 'Hola', sticker: 'kapi-love' };
  assert.deepEqual(mobile.giftOf({ gift: ok }), ok);
  assert.equal(mobile.giftOf({ gift: { ...ok, deliveryEventLabel: 'sin fecha' } }).deliveryEventLabel, undefined);
  for (const bad of [{ deliveryDate: '05/12/2026' }, { wishlistUserCode: 'a b' }, { wishlistUserCode: '../x' }]) assert.throws(() => mobile.giftOf({ gift: { ...ok, ...bad } }));
});
