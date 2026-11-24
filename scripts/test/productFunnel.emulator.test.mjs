import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, setDoc, doc, getDoc, terminate } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';

const enabled = process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:18080' && process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099';
test('Firebase real local: pago idempotente y colección protegida incluso ante un administrador cliente', { skip: !enabled }, async () => {
  const require = createRequire(import.meta.url);
  const admin = require('../../functions/node_modules/firebase-admin');
  const adminApp = admin.initializeApp({ projectId: 'demo-wala' });
  const db = admin.firestore();
  const { recordCheckoutPaymentAnalytics, recordErpPaymentAnalytics } = require('../../functions/productFunnel');
  const { receiptId } = require('../../functions/productFunnelLogic');
  const orderId = `qa-${Date.now()}`;
  const event = data => ({ before: { exists: false }, after: { exists: true, data: () => data } });
  const context = { timestamp: new Date().toISOString() };
  const paid = event({ status: 'paid_order_created', pedidoCreado: true, pedidoWebId: orderId, pago: { id: 'sandbox-only', montoPen: 50, metodo: 'culqi' } });
  const app = initializeApp({ projectId: 'demo-wala', apiKey: 'demo-emulator' }, 'qa-analytics-rules');
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 18080);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  try {
    await Promise.all([recordCheckoutPaymentAnalytics.run(paid, context), recordCheckoutPaymentAnalytics.run(paid, context)]);
    await recordErpPaymentAnalytics.run(event({ webAprobado: true, origenPedidoWebId: orderId, montoAdelanto: 50 }), context);
    const saved = await db.collection('analytics_verified_orders').doc(receiptId(orderId)).get();
    assert.equal(saved.data().source, 'checkout');
    assert.equal(saved.data().orderId, orderId);
    await assert.rejects(getDoc(doc(firestore, 'analytics_verified_orders', receiptId(orderId))), /permission|insufficient/i);
    await signInWithEmailAndPassword(auth, 'admin@wala.test', 'wala1234');
    assert.equal((await getDoc(doc(firestore, 'analytics_verified_orders', receiptId(orderId)))).exists(), true);
    await assert.rejects(setDoc(doc(firestore, 'analytics_verified_orders', 'fake'), { orderId: 'fake' }), /permission|insufficient/i);
  } finally {
    await terminate(firestore); await deleteApp(app); await adminApp.delete();
  }
});
