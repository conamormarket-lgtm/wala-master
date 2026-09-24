import test from 'node:test';
import assert from 'node:assert/strict';
import { createInFlightReads } from './inFlightReads.mjs';

test('concurrent readers share work, completed requests are never cached', async () => {
  const reads = createInFlightReads();
  let count = 0;
  const load = () => ++count;
  assert.deepEqual(await Promise.all(Array.from({ length: 20 }, () => reads.run('catalog', load))), Array(20).fill(1));
  assert.equal(await reads.run('catalog', load), 2);
  assert.deepEqual(await Promise.all([reads.run('a', load), reads.run('b', load)]), [3, 4]);
});

test('failures do not poison future requests', async () => {
  const reads = createInFlightReads();
  await assert.rejects(reads.run('catalog', () => { throw Error('offline'); }), /offline/);
  assert.equal(await reads.run('catalog', () => 'fresh'), 'fresh');
});

test('old request completion cannot evict a new read after invalidation', async () => {
  const reads = createInFlightReads();
  let releaseOld, releaseNew;
  const old = reads.run('catalog', () => new Promise(resolve => { releaseOld = resolve; }));
  await Promise.resolve();
  reads.clear();
  const fresh = reads.run('catalog', () => new Promise(resolve => { releaseNew = resolve; }));
  await Promise.resolve();
  releaseOld('old');
  await old;
  assert.equal(reads.run('catalog', () => { throw Error('duplicate read'); }), fresh);
  releaseNew('fresh');
  assert.equal(await fresh, 'fresh');
});
