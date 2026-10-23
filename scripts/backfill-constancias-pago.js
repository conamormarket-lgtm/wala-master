/**
 * Constancias de los pagos de deuda hechos en Walá antes del 2026-10-23.
 * ────────────────────────────────────────────────────────────────────────────
 * Desde ese día cada pago online del saldo de un pedido lleva su constancia en
 * imagen como comprobante (functions/constanciaPago.js). Los anteriores
 * quedaron en Cobranza y en Finanzas sin nada que mirar. Este script les genera
 * la suya con lo que ya está guardado: monto, fecha, cobro de Culqi o PayPal.
 *
 * Solo toca movimientos de `fp_transactions` que registró el portal
 * (createdBy portal-web@wala.pe) para un pedido validado (sourceCollection
 * "pedidos") y que no tienen comprobante. De esos escribe únicamente
 * comprobanteUrl / comprobantePath / comprobanteHashes (en el movimiento y en
 * su pago del pedido) y la llave de cobranzaPaymentKeys, como lo hace el pago
 * nuevo. Los pagos de antes eran con tarjeta: la constancia dice "Tarjeta" sin
 * los últimos dígitos (no se guardaban).
 *
 * Uso (desde la raíz; usa firebase-admin de functions/):
 *   node scripts/backfill-constancias-pago.js            → muestra cuáles faltan
 *   node scripts/backfill-constancias-pago.js --aplicar  → las genera
 * Credenciales: serviceAccountKey.json en la raíz o GOOGLE_APPLICATION_CREDENTIALS.
 */
const path = require('path');
const fs = require('fs');

const funciones = path.join(__dirname, '..', 'functions');
const admin = require(path.join(funciones, 'node_modules', 'firebase-admin'));
const { FieldValue } = require(path.join(funciones, 'node_modules', 'firebase-admin', 'lib', 'firestore'));
const { asegurarConstancia } = require(path.join(funciones, 'constanciaPago'));
const { USUARIO_PORTAL } = require(path.join(funciones, 'erpCobranzaLogic'));

const llave = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp({
  ...(fs.existsSync(llave)
    ? { credential: admin.credential.cert(require(llave)) }
    : { credential: admin.credential.applicationDefault() }),
  storageBucket: 'sistema-gestion-3b225.firebasestorage.app',
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const APLICAR = process.argv.includes('--aplicar');

(async () => {
  const movimientos = await db.collection('fp_transactions').where('createdBy', '==', USUARIO_PORTAL).get();
  const pendientes = movimientos.docs.filter((d) => {
    const m = d.data();
    return m.sourceCollection === 'pedidos' && m.pasarela && m.pasarela.id && !m.comprobanteUrl && !m.deletedAt;
  });
  console.log(`Movimientos del portal: ${movimientos.size}. Pagos de deuda sin constancia: ${pendientes.length}.`);
  for (const d of pendientes) {
    const m = d.data();
    console.log(`  ${m.date || '¿fecha?'}  pedido ${m.sourcePedidoId}  S/ ${Number(m.amount).toFixed(2)}  ${m.pasarela.metodo} ${m.pasarela.id}`);
  }
  if (!APLICAR || !pendientes.length) {
    if (pendientes.length) console.log('\nSimulación: nada escrito. Para generarlas: --aplicar');
    return;
  }

  let hechas = 0;
  for (const d of pendientes) {
    const m = d.data();
    const pago = {
      metodo: m.pasarela.metodo, id: String(m.pasarela.id), montoPen: Number(m.amount),
      ...(m.pasarela.montoUsd != null && { montoUsd: Number(m.pasarela.montoUsd) }),
    };
    try {
      const url = await asegurarConstancia({
        db, bucket, FieldValue, coleccion: 'pedidos', pedidoId: m.sourcePedidoId, pago, txId: d.id,
      });
      if (url) hechas++;
      console.log(`  ${url ? '✔' : '–'} pedido ${m.sourcePedidoId} (${d.id})`);
    } catch (e) {
      console.error(`  ✖ pedido ${m.sourcePedidoId} (${d.id}): ${e.message}`);
    }
  }
  console.log(`\nConstancias generadas: ${hechas} de ${pendientes.length}.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
