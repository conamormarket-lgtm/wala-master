/**
 * Revisa (solo lectura) cómo quedó un pedido de la tienda en todas partes:
 * intención de checkout, pedidos_web, wala_pedidos, pedidos del ERP, cobros
 * de Culqi, movimientos de Finanzas y anomalías de pago.
 *
 *   node scripts/revisar-pedido.cjs <clave-servicio.json> <PD-XXXX>
 */
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const [keyPath, numero] = process.argv.slice(2);
if (!keyPath || !numero) {
  console.error('Uso: node scripts/revisar-pedido.cjs <clave-servicio.json> <PD-XXXX>');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(keyPath))) });
const db = admin.firestore();

const fecha = (v) => (v && v.toDate ? v.toDate().toLocaleString('es-PE', { timeZone: 'America/Lima' }) : v);
const elegir = (o, campos) => Object.fromEntries(campos.filter((c) => o[c] !== undefined).map((c) => [c, fecha(o[c])]));

async function porCampo(coleccion, campo, valor, campos) {
  const snap = await db.collection(coleccion).where(campo, '==', valor).limit(5).get();
  return snap.docs.map((d) => ({ id: d.id, ...elegir(d.data(), campos) }));
}

(async () => {
  const salida = {};

  const web = await db.collection('pedidos_web').doc(numero).get();
  salida.pedidos_web = web.exists
    ? [{ id: web.id, ...elegir(web.data(), ['numeroPedido', 'estadoValidacion', 'origen', 'canal', 'whatsappOrigen', 'pagado', 'montoTotal', 'montoAdelanto', 'montoPendiente', 'descuentoMonedas', 'pagoOnline', 'clienteNumeroDocumento', 'buyerUid', 'createdAt', 'fechaCreacion'])}]
    : await porCampo('pedidos_web', 'numeroPedido', numero, ['estadoValidacion', 'pagado', 'montoTotal', 'montoAdelanto', 'pagoOnline', 'createdAt']);

  salida.wala_pedidos = await porCampo('wala_pedidos', 'numeroPedido', numero,
    ['estadoWala', 'pagado', 'montoTotal', 'montoPagado', 'canal', 'buyerUid', 'createdAt']);

  salida.intencion = await porCampo('checkout_payment_intents', 'orderPayload.numeroPedido', numero,
    ['status', 'amountPen', 'montoCobrar', 'whatsappSolicitado', 'uid', 'createdAt', 'updatedAt']);
  if (!salida.intencion.length) {
    salida.intencion = await porCampo('checkout_payment_intents', 'numeroPedido', numero,
      ['status', 'amountPen', 'montoCobrar', 'whatsappSolicitado', 'uid', 'createdAt', 'updatedAt']);
  }

  salida.pedidos_erp = await porCampo('pedidos', 'pedidoWebId', numero,
    ['numeroPedido', 'estadoGeneral', 'montoTotal', 'montoAdelanto', 'pagoOnline', 'createdAt']);

  salida.culqiCharges = await porCampo('culqiCharges', 'objetivo', `checkout:${numero}`,
    ['status', 'amount', 'currency', 'charge_id', 'createdAt']);

  salida.fp_transactions = await porCampo('fp_transactions', 'sourcePedidoId', numero,
    ['type', 'sourceType', 'amount', 'accountId', 'status', 'operationNumber', 'createdAt']);

  salida.pagos_anomalias = await porCampo('pagos_anomalias', 'numeroPedido', numero,
    ['tipo', 'motivo', 'createdAt']);

  console.log(JSON.stringify(salida, null, 2));
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
