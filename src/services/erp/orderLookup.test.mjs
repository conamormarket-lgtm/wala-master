import test from 'node:test';
import assert from 'node:assert/strict';
import { readOrdersByDocument } from './orderLookup.mjs';

test('both sources start before either completes; preserves ids and source order', async () => {
  const started = [];
  const releases = [];
  const result = readOrdersByDocument((name, field, value) => {
    started.push([name, field, value]);
    return new Promise(resolve => releases.push(resolve));
  }, '00123', '00123');
  assert.equal(started.length, 2);
  releases[1]([{ id: '0002' }]);
  releases[0]([{ id: '0001' }]);
  assert.deepEqual(await result, [{ id: '0001' }, { id: '0002' }]);
  assert.deepEqual(started, [
    ['pedidos', 'clienteNumeroDocumento', '00123'],
    ['pedidos_web', 'clienteNumeroDocumento', '00123'],
  ]);
});

test('legacy fields and raw document values remain lazy fallbacks per source', async () => {
  const calls = [];
  const result = await readOrdersByDocument(async (name, field, value) => {
    calls.push([name, field, value]);
    if (name === 'pedidos_web' && field === 'dni' && value === '00123') return [{ id: 'web' }];
    if (name === 'pedidos' && field === 'dni' && value === ' 00123 ') return [{ id: 'legacy' }];
    return [];
  }, ' 00123 ', '00123');
  assert.deepEqual(result, [{ id: 'legacy' }, { id: 'web' }]);
  assert.equal(calls.length, 6);
  assert.equal(calls.filter(([name]) => name === 'pedidos_web').length, 2);
});

test('empty sources finish and real read failures are surfaced', async () => {
  let count = 0;
  assert.deepEqual(await readOrdersByDocument(async () => { count++; return []; }, '00123', '00123'), []);
  assert.equal(count, 4);
  await assert.rejects(readOrdersByDocument(async () => { throw Error('permission-denied'); }, '1', '1'), /permission-denied/);
});
