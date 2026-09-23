import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackCulqiPurchase, trackPaypalPurchase } from './metaPixel.mjs';

test('confirmed payments, currency conversion, deduplication and failure isolation', async () => {
  const events = [];
  const storage = new Map();
  globalThis.window = {
    fbq: (...args) => events.push(args),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  };
  assert.equal(trackCulqiPurchase({ success: false, charge_id: 'failed', amount: 2000 }, 'PEN'), false);
  assert.equal(trackPaypalPurchase({ status: 'APPROVED' }), false);
  assert.equal(trackPaypalPurchase({ success: true, status: 'COMPLETED', amountUsd: 20 }), false);
  assert.equal(events.length, 0);
  const charge = { success: true, charge_id: 'charge-1', amount: 4590 };
  assert.equal(trackCulqiPurchase(charge, 'PEN'), true);
  assert.deepEqual(events[0], ['trackSingle', '1696511731424872', 'Purchase', { value: 45.9, currency: 'PEN' }, { eventID: 'culqi_charge-1' }]);
  assert.equal(trackCulqiPurchase(charge, 'PEN'), false);
  const freshModule = await import('./metaPixel.mjs?reload');
  assert.equal(freshModule.trackCulqiPurchase(charge, 'PEN'), false);
  assert.equal(trackPaypalPurchase({ success: true, status: 'COMPLETED', captureId: 'cap-1', amountUsd: '20.00' }), true);
  assert.deepEqual(events[1][3], { value: 20, currency: 'USD' });
  const legacy = { status: 'COMPLETED', purchase_units: [{ payments: { captures: [
    { status: 'PENDING', id: 'pending', amount: { value: '5', currency_code: 'USD' } },
    { status: 'COMPLETED', id: 'cap-2', amount: { value: '12.50', currency_code: 'USD' } },
  ] } }] };
  assert.equal(trackPaypalPurchase(legacy), true);
  assert.equal(events.length, 3);
  assert.equal(trackCulqiPurchase({ ...charge, charge_id: 'bad', amount: 'invalid' }, 'PEN'), false);
  window.localStorage.getItem = () => { throw new Error('blocked'); };
  window.localStorage.setItem = () => { throw new Error('blocked'); };
  assert.equal(trackCulqiPurchase({ ...charge, charge_id: 'private' }, 'PEN'), true);
  window.fbq = () => { throw new Error('blocked'); };
  assert.equal(trackCulqiPurchase({ ...charge, charge_id: 'error' }, 'PEN'), false);
  delete window.fbq;
  assert.equal(trackCulqiPurchase({ ...charge, charge_id: 'missing' }, 'PEN'), false);
  delete globalThis.window;
});
