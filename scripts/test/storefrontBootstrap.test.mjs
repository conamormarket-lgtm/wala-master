import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { storefrontBootstrap } from '../storefront-bootstrap.mjs';

function encode(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  return { stringValue: value };
}

async function run({ pathname = '/', search = '', mobile = false, response, fail = false } = {}) {
  const requests = [], links = [], timers = new Map();
  const window = { location: { pathname, search }, matchMedia: () => ({ matches: mobile }) };
  vm.runInNewContext(`(${storefrontBootstrap.toString()})('public-project', 'public-key')`, {
    window, URLSearchParams, AbortController,
    document: { createElement: () => ({}), head: { appendChild: link => links.push(link) } },
    setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (fail) throw new Error('offline');
      return response || { ok: false };
    },
  });
  const result = await window.__walaStorefrontBootstrap?.promise;
  return { result, window, requests, links, timers };
}

test('HTML bootstrap reads only public page sections and preloads the correct mobile image', async () => {
  const sections = [{ type: 'hero_carousel', order: 0, settings: { slides: [
    { imageUrl: '' }, { imageUrl: 'https://images.example/desktop.webp', mobileImageUrl: 'https://images.example/mobile.webp' },
  ], autoPlay: false, height: null } }];
  const result = await run({ mobile: true, response: { ok: true, json: async () => ({ fields: { sections: encode(sections) } }) } });
  assert.deepEqual(JSON.parse(JSON.stringify(result.result)), sections);
  assert.equal(result.links[0].href, 'https://images.example/mobile.webp');
  assert.equal(result.requests.length, 1);
  assert.match(result.requests[0].url, /documents\/pages\/home\?mask.fieldPaths=sections/);
  assert.equal(result.requests[0].options.credentials, 'omit');
  assert.equal(result.requests[0].options.cache, 'no-store');
  assert.equal(result.timers.size, 0);
});

test('private routes and editor previews never issue a public bootstrap read', async () => {
  for (const options of [{ pathname: '/admin' }, { pathname: '/editor/product' }, { pathname: '/brand' }, { search: '?t=preview' }]) {
    assert.equal((await run(options)).requests.length, 0);
  }
  assert.match((await run({ pathname: '/tienda/' })).requests[0].url, /pages\/tienda\?/);
});

test('denied, missing, malformed and offline bootstrap results preserve the SDK fallback', async () => {
  for (const options of [
    { fail: true }, { response: { ok: false } },
    { response: { ok: true, json: async () => ({}) } },
    { response: { ok: true, json: async () => ({ fields: { sections: encode('invalid') } }) } },
    { response: { ok: true, json: async () => ({ fields: { sections: { referenceValue: 'unsupported' } } }) } },
  ]) {
    const result = await run(options);
    assert.equal(result.result, null);
    assert.equal(result.links.length, 0);
    assert.equal(result.timers.size, 0);
  }
});
