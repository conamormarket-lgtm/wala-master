/* Prueba de punta a punta de la promo "primera compra gratis" (functions/primeraCompra.js)
 * contra los emuladores (demo-wala), con Functions. No toca producción.
 * Uso: emuladores con functions (firebase emulators:start --project demo-wala
 * --only firestore,auth,storage,functions) + npm run seed, y luego
 *   node functions/test/primeraCompra.emulator.test.js */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require(require.resolve('firebase-admin', { paths: [path.join(ROOT, 'functions', 'node_modules')] }));
admin.initializeApp({ projectId: 'demo-wala' });
const db = admin.firestore();
const assert = require('assert');

const FN = 'http://127.0.0.1:5001/demo-wala/us-central1/';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:';
const sufijo = Date.now().toString(36);

async function post(url, body, token) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return r.json();
}
async function cuenta(email) {
  const r = await post(`${AUTH}signUp?key=fake`, { email, password: 'wala1234', returnSecureToken: true });
  if (!r.idToken) throw new Error(JSON.stringify(r));
  return { uid: r.localId, token: r.idToken };
}
async function entrar(email) {
  const r = await post(`${AUTH}signInWithPassword?key=fake`, { email, password: 'wala1234', returnSecureToken: true });
  return { uid: r.localId, token: r.idToken };
}
async function llamar(nombre, data, token) {
  const r = await post(FN + nombre, { data }, token);
  if (r.error) { const e = new Error(r.error.message); e.status = r.error.status; throw e; }
  return r.result;
}
async function falla(nombre, data, token, texto) {
  try { await llamar(nombre, data, token); } catch (e) { assert.ok(e.message.includes(texto), `${nombre}: esperaba «${texto}», llegó «${e.message}»`); return; }
  throw new Error(`${nombre} debía fallar con «${texto}»`);
}
const paso = (t) => console.log(`✔ ${t}`);

async function main() {
  // Productos: una marca propia y Lumi (margen bajo, 10 % pagable con saldo).
  await db.doc('productos_wala/pc-polo').set({ name: 'Polo PC', price: 60, brandId: 'propia', visible: true });
  await db.doc('productos_wala/pc-serum').set({ name: 'Serum PC', price: 80, brandId: 'lumi', visible: true });
  const adm = await entrar('admin@wala.test');
  assert.ok(adm.token, 'falta el admin del seed (npm run seed)');

  // 0) El admin prende la promo y configura Lumi.
  const cfg = await llamar('primeraCompraConfigSecure', { config: { activa: true, marcas: { lumi: { margenPct: 25, saldoPct: 10 } } } }, adm.token);
  assert.strictEqual(cfg.config.activa, true);
  assert.ok(cfg.config.desdeMs);
  paso('el admin prende la promo (desde = ahora)');

  // 1) Ana se registra: empieza su semana.
  const A = await cuenta(`ana-${sufijo}@wala.test`);
  await db.doc(`portal_clientes_users/${A.uid}`).set({ displayName: 'Ana Prueba', referralCode: `ANA${sufijo}`.toUpperCase().slice(0, 12), dni: String(10000000 + Math.floor(Math.random() * 89999999)), phone: `9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, monedas: 30 });
  const codigoA = (await db.doc(`portal_clientes_users/${A.uid}`).get()).get('referralCode');
  let ea = await llamar('primeraCompraEstadoSecure', {}, A.token);
  assert.strictEqual(ea.fase.estado, 'activa');
  assert.ok(ea.fase.venceMs - Date.now() > 167 * 3600e3);
  assert.strictEqual(ea.enPausa, true);
  paso('Ana se registra: semana activa de 168 h, monedas en pausa');

  // 2) Beto abre la invitación de Ana, crea su cuenta y la acepta.
  const visita = await llamar('registrarVisitaReferidoSecure', { code: codigoA, tipo: 'invitacion' });
  assert.ok(visita.id, JSON.stringify(visita));
  const B = await cuenta(`beto-${sufijo}@wala.test`);
  await db.doc(`portal_clientes_users/${B.uid}`).set({ displayName: 'Beto Prueba', referralCode: `BET${sufijo}`.toUpperCase().slice(0, 12), dni: String(10000000 + Math.floor(Math.random() * 89999999)), phone: `9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` });
  // Al entrar a la tienda, la franja pide su estado: empieza su propia semana.
  assert.strictEqual((await llamar('primeraCompraEstadoSecure', {}, B.token)).fase.estado, 'activa');
  const acepta = await llamar('aceptarInvitacionSecure', { referralId: visita.id }, B.token);
  assert.strictEqual(acepta.aceptada, true, JSON.stringify(acepta));
  paso('Beto llega con la invitación de Ana y crea su cuenta');

  // 3) Beto ve antes de pagar si su compra premia a Ana.
  const cotB = await llamar('primeraCompraCotizarSecure', { productos: { l1: { productoId: 'pc-serum', precio: 80, cantidad: 1 } } }, B.token);
  assert.strictEqual(cotB.invitador.genera, false);
  assert.strictEqual(cotB.invitador.motivo, 'margen');
  const cotB2 = await llamar('primeraCompraCotizarSecure', { productos: { l1: { productoId: 'pc-polo', precio: 60, cantidad: 1 } } }, B.token);
  assert.strictEqual(cotB2.invitador.genera, true);
  assert.strictEqual(cotB2.invitador.nombre, 'Ana');
  paso('Beto ve antes de pagar: Lumi S/ 80 no alcanza (margen); polo S/ 60 sí premia a Ana');

  // 4) Beto compra el polo por WhatsApp: premio pendiente para Ana.
  const pedidoB = `PD-B${sufijo}`.toUpperCase();
  await llamar('prepareCheckoutPayment', {
    referralId: visita.id,
    orderPayload: { numeroPedido: pedidoB, montoTotal: 75, clienteNombre: 'Beto Prueba', productos: { l1: { productoId: 'pc-polo', producto: 'Polo PC', precio: 60, cantidad: 1 } } },
  }, B.token);
  await llamar('crearSolicitudWhatsappSecure', { intentId: pedidoB }, B.token);
  const premio = (await db.doc(`portal_clientes_users/${A.uid}/primeraCompraPremios/${B.uid}`).get()).data();
  assert.strictEqual(premio.estado, 'pendiente');
  assert.strictEqual(premio.monto, 10);
  const ref = (await db.doc(`referrals/${visita.id}`).get()).data();
  assert.strictEqual(ref.premioModo, 'primera_compra');
  ea = await llamar('primeraCompraEstadoSecure', {}, A.token);
  assert.strictEqual(ea.saldo, 0);
  assert.strictEqual(ea.pendiente, 10);
  paso('Beto compra por WhatsApp: Ana tiene S/ 10 por confirmar; el referido no paga monedas');
  const eb = await llamar('primeraCompraEstadoSecure', {}, B.token);
  assert.strictEqual(eb.fase.estado, 'usada');
  paso('la compra de Beto cierra su propia semana');

  // 5) El pago de Beto se confirma (lo haría la revisión de cada hora).
  await db.doc(`portal_clientes_users/${A.uid}/primeraCompraPremios/${B.uid}`).update({ estado: 'disponible', pagado: true });
  ea = await llamar('primeraCompraEstadoSecure', {}, A.token);
  assert.strictEqual(ea.saldo, 10);
  paso('pago confirmado: Ana tiene S/ 10 disponibles');

  // 6) Pausa: Ana no puede usar monedas ni cupones.
  await falla('prepareCheckoutPayment', { orderPayload: { numeroPedido: `PD-AM${sufijo}`, montoTotal: 70, descuentoMonedas: 5, productos: { l1: { productoId: 'pc-polo', precio: 60, cantidad: 1 } } } }, A.token, 'monedas están en pausa');
  await falla('validarCuponSecure', { code: 'CUALQUIERA' }, A.token, 'cupones están en pausa');
  await falla('spendCoinsSecure', { amount: 1 }, A.token, 'monedas están en pausa');
  await falla('redeemRewardSecure', { rewardId: 'x' }, A.token, 'monedas están en pausa');
  paso('en su semana, Ana no puede usar monedas, cupones ni canjear');

  // 7) Saldo: más de lo que tiene, falla; en Lumi solo el 10 %.
  await falla('prepareCheckoutPayment', { orderPayload: { numeroPedido: `PD-AX${sufijo}`, montoTotal: 55, saldoBienvenida: 20, productos: { l1: { productoId: 'pc-polo', precio: 60, cantidad: 1 } } } }, A.token, 'puedes usar hasta S/ 10.00');
  await falla('prepareCheckoutPayment', { orderPayload: { numeroPedido: `PD-AL${sufijo}`, montoTotal: 85, saldoBienvenida: 10, productos: { l1: { productoId: 'pc-serum', precio: 80, cantidad: 1 } } } }, A.token, 'puedes usar hasta S/ 8.00');
  const cotA = await llamar('primeraCompraCotizarSecure', { productos: { l1: { productoId: 'pc-serum', precio: 80, cantidad: 1 } } }, A.token);
  assert.strictEqual(cotA.topeSaldo, 8);
  paso('el saldo no pasa de lo disponible ni del 10 % de Lumi');

  // 8) Ana usa sus S/ 10 en el polo: paga 60 − 10 + 15 = 65.
  const pedidoA = `PD-A${sufijo}`.toUpperCase();
  const prep = await llamar('prepareCheckoutPayment', { orderPayload: { numeroPedido: pedidoA, montoTotal: 65, saldoBienvenida: 10, productos: { l1: { productoId: 'pc-polo', producto: 'Polo PC', precio: 60, cantidad: 1 } } } }, A.token);
  assert.strictEqual(prep.amountPen, 65);
  const intent = (await db.doc(`checkout_payment_intents/${pedidoA}`).get()).data();
  assert.strictEqual(intent.orderPayload.saldoBienvenida, 10);
  assert.strictEqual(intent.totalesServidor.esperado, 65);
  const reserva = (await db.doc(`portal_clientes_users/${A.uid}/primeraCompra/estado`).get()).data().reserva;
  assert.strictEqual(reserva.monto, 10);
  paso('Ana prepara su pedido con S/ 10 de saldo: cobra S/ 65 y reserva el saldo');

  // 9) Un total por debajo (como si el saldo fuera 20) se rechaza.
  await falla('prepareCheckoutPayment', { orderPayload: { numeroPedido: `PD-AB${sufijo}`, montoTotal: 55, saldoBienvenida: 10, productos: { l1: { productoId: 'pc-polo', precio: 60, cantidad: 1 } } } }, A.token, 'no coincide');
  paso('un total menor al del servidor se rechaza');

  // 10) Ana termina por WhatsApp: su semana se cierra con S/ 10 usados y se liberan sus monedas.
  await llamar('crearSolicitudWhatsappSecure', { intentId: pedidoA }, A.token);
  ea = await llamar('primeraCompraEstadoSecure', {}, A.token);
  assert.strictEqual(ea.fase.estado, 'usada');
  assert.strictEqual(ea.fase.usado, 10);
  assert.strictEqual(ea.enPausa, false);
  const pedidoErp = (await db.doc(`pedidos_web/${pedidoA}`).get()).data();
  assert.strictEqual(pedidoErp.saldoBienvenida, 10);
  await llamar('spendCoinsSecure', { amount: 1 }, A.token);
  paso('la primera compra de Ana cierra su semana (S/ 10 usados) y sus monedas vuelven a servir');

  // 11) El admin ve todo y puede revertir; el pedido gratis de Ana no premia a nadie.
  const lista = await llamar('primeraCompraListaSecure', {}, adm.token);
  assert.ok(lista.premios.some((p) => p.id === B.uid && p.invitadorNombre === 'Ana'));
  assert.ok(lista.fases.some((f) => f.uid === A.uid && f.estado === 'usada'));
  paso('el admin ve el premio y las cuentas');

  // 12) Con la promo apagada, una cuenta nueva no empieza semana y compra normal.
  await llamar('primeraCompraConfigSecure', { config: { activa: false } }, adm.token);
  // Cada instancia guarda la config un minuto.
  await new Promise((r) => setTimeout(r, 61000));
  const C = await cuenta(`cami-${sufijo}@wala.test`);
  await db.doc(`portal_clientes_users/${C.uid}`).set({ displayName: 'Cami', monedas: 20 });
  const ec = await llamar('primeraCompraEstadoSecure', {}, C.token);
  assert.strictEqual(ec.fase, null);
  await llamar('prepareCheckoutPayment', { orderPayload: { numeroPedido: `PD-C${sufijo}`, montoTotal: 70, descuentoMonedas: 5, productos: { l1: { productoId: 'pc-polo', precio: 60, cantidad: 1 } } } }, C.token);
  assert.strictEqual((await db.doc(`portal_clientes_users/${C.uid}/primeraCompra/estado`).get()).exists, false);
  paso('promo apagada: una cuenta nueva compra con monedas como siempre');

  console.log('\nTodo OK');
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n✘', e.message); process.exit(1); });
