import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicationPatch, mapMedia, encode, decode } from '../publish-consul-landing.mjs';
import { validateDetailComposition } from '../../src/utils/productDetails.mjs';

const source = JSON.parse(fs.readFileSync(new URL('../../src/componentes/demo/producto.json', import.meta.url))).productos[0];
test('publicación limitada a contenido y medios; conserva inventario y opciones de cada variante', () => {
  const live = { ...structuredClone(source), price: 127, inStock: 9 };
  live.variants[0].stock = 7;
  live.variants[0].customizationConfig = { template: 'original', price: 30 };
  const before = structuredClone(live);
  const patch = publicationPatch(live);
  assert.deepEqual(live, before);
  assert.deepEqual(Object.keys(patch).sort(), ['description', 'detailComposition', 'images', 'mainImage', 'variants', 'videos']);
  assert.equal(patch.variants[0].stock, 7);
  assert.deepEqual(patch.variants[0].customizationConfig, before.variants[0].customizationConfig);
  assert.throws(() => publicationPatch({ ...live, variants: [...live.variants, { id: 'new' }] }));
});
test('las 81 URLs locales se sustituyen por archivos definitivos válidos para Walá', () => {
  const patch = publicationPatch(source);
  const urls = [...new Set(JSON.stringify(patch).match(/\/output\/product-media\/consul\/[\w/.-]+\.(?:webp|mp4)/g))];
  assert.equal(urls.length, 81);
  const ready = mapMedia(patch, Object.fromEntries(urls.map((url, i) => [url, `https://example.test/${i}.${url.endsWith('.mp4') ? 'mp4' : 'webp'}`])));
  assert.equal(validateDetailComposition(ready.detailComposition), null);
  assert.doesNotMatch(JSON.stringify(ready), /\/output\//);
  assert.deepEqual(decode(encode(ready)), ready);
});
