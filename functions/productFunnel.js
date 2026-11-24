const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { confirmedPayment, receiptId } = require('./productFunnelLogic');

function handler(source) {
  return async (change, context) => {
    const after = confirmedPayment(change.after.exists ? change.after.data() : null, source);
    if (!after || confirmedPayment(change.before.exists ? change.before.data() : null, source)) return null;
    // A single immutable receipt follows the web order into the ERP. Retried
    // triggers and the later ERP approval cannot count the same payment twice.
    const ref = admin.firestore().collection('analytics_verified_orders').doc(receiptId(after.orderId));
    try {
      await ref.create({ ...after, confirmedAtMs: Date.parse(context.timestamp), version: 1 });
    } catch (error) {
      if (error.code !== 6 && error.code !== 'already-exists') throw error;
    }
    return null;
  };
}

exports.recordCheckoutPaymentAnalytics = functions.runWith({ failurePolicy: true }).firestore.document('checkout_payment_intents/{id}').onWrite(handler('checkout'));
exports.recordErpPaymentAnalytics = functions.runWith({ failurePolicy: true }).firestore.document('pedidos/{id}').onWrite(handler('erp'));
