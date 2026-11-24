import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { consulLocalProduct, CONSUL_PRODUCT_ID } from '../../src/componentes/demo/consulLanding.mjs';
import { normalizeDetailComposition, validateDetailComposition } from '../../src/utils/productDetails.mjs';
import { normalizeProductVideos } from '../../src/utils/productVideos.mjs';

test('la propuesta local conserva el inventario y utiliza el esquema editable de Walá', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../../src/componentes/demo/producto.json', import.meta.url)));
  const source = data.productos.find(p => p.id === CONSUL_PRODUCT_ID);
  const before = JSON.stringify(source);
  const product = consulLocalProduct(source);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(product.variants.map(v => 1 + v.images.length), [15, 15, 14]);
  assert.deepEqual(product.variants.map(v => product.videos.filter(video => video.variantId === v.id).length), [2, 2, 1]);
  assert.equal(normalizeProductVideos(product.videos, { allowLocal: true }).length, 5);
  const composition = normalizeDetailComposition(product.detailComposition, { allowLocal: true });
  assert.equal(validateDetailComposition(composition, { allowLocal: true }), null);
  const media = composition.blocks.flatMap(b => b.media);
  assert.equal(media.filter(m => m.type === 'video').length, 9);
  assert.equal(media.filter(m => m.type === 'image').length, 6);
  assert.equal(media.filter(m => m.mobileUrl).length, 3);
  assert.ok(media.filter(m => m.type === 'video').every(m => m.poster && m.autoPlay && m.muted && m.loop));
  assert.deepEqual(normalizeDetailComposition(JSON.parse(JSON.stringify(composition)), { allowLocal: true }), composition);
  assert.ok(validateDetailComposition(composition), 'la configuración local no puede guardarse como producción');
});
