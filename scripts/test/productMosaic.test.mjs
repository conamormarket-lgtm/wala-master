import test from 'node:test';
import assert from 'node:assert/strict';
import { mosaicCell, mosaicStyle, flexibleMosaic, mediaAppearanceStyle } from '../../src/utils/productMosaic.mjs';
import { normalizeDetailComposition, validateDetailComposition } from '../../src/utils/productDetails.mjs';
import { isEmulatorDetailUrl } from '../../src/utils/detailMediaEnvironment.mjs';
import { rememberPersonalizationAction, readPersonalizationAction, clearPersonalizationAction } from '../../src/utils/personalizationReturn.mjs';

test('mosaico libre conserva tamaños por pieza y móvil; el clásico se mantiene intacto', () => {
  const media = [1, 2, 3].map(i => ({ id: `m${i}`, type: 'image', url: `https://example.test/${i}.png` }));
  const classic = normalizeDetailComposition({ version: 1, blocks: [{ kind: 'mosaic', media }] });
  assert.equal(classic.blocks[0].mosaicLayout, 'classic');
  const previousFlexible = normalizeDetailComposition({ version: 1, blocks: [{ kind: 'mosaic', mosaicLayout: 'flexible', ratio: 'square', media }] });
  assert.equal(previousFlexible.blocks[0].mosaicSizing, 'manual');
  const block = flexibleMosaic(classic.blocks[0]); block.media[1].cell = { width: 2, height: 3, column: 2, mobileWidth: 2, mobileHeight: 2 }; block.mobileColumns = 2;
  const saved = normalizeDetailComposition({ ...classic, blocks: [block] });
  assert.equal(validateDetailComposition(saved), null);
  assert.equal(saved.blocks[0].mosaicSizing, 'proportional');
  assert.equal(saved.blocks[0].ratio, 'portrait34');
  assert.deepEqual(saved.blocks[0].media[1].cell, block.media[1].cell);
  assert.equal(mosaicStyle(saved.blocks[0].media[1], saved.blocks[0])['--cell-column'], '2 / span 2');
  assert.equal(mosaicCell({ width: 9, column: 7, height: -2, mobileWidth: 2 }, 3, 1).column, 1);
  assert.equal(mosaicCell({ width: 9, height: -2 }, 3, 1).height, 1);
});

test('las imágenes locales de colección sobreviven al guardado local pero no al de producción', () => {
  const value = { version: 1, blocks: [], commerce: { collection: { enabled: true, title: 'Colección', href: '/tienda', image: 'local:asset-1' } } };
  assert.equal(validateDetailComposition(value, { allowLocal: true }), null);
  assert.equal(normalizeDetailComposition(value, { allowLocal: true }).commerce.collection.image, 'local:asset-1');
  assert.ok(validateDetailComposition(value));
  assert.equal(normalizeDetailComposition(value).commerce.collection.image, '');
  assert.equal(isEmulatorDetailUrl('http://localhost:9199/v0/b/demo-wala.appspot.com/o/image', true), true);
  assert.equal(isEmulatorDetailUrl('http://localhost:9199/v0/b/production/o/image', true), false);
  assert.equal(isEmulatorDetailUrl('http://localhost:9199/v0/b/demo-wala.appspot.com/o/image', false), false);
});

test('cada medio conserva su proporción y ajuste al guardar, reordenar y cambiar los valores del bloque', () => {
  const value = { version: 1, blocks: [{ id: 'mix', kind: 'mosaic', mosaicLayout: 'flexible', ratio: 'portrait34', fit: 'cover', media: [
    { id: 'a', type: 'image', url: 'https://example.test/a.jpg', ratio: 'landscape', fit: 'contain' },
    { id: 'v', type: 'video', url: 'https://example.test/v.mp4', ratio: 'story', fit: 'cover' },
    { id: 'o', type: 'image', url: 'https://example.test/o.jpg', ratio: 'auto' },
    { id: 'old', type: 'image', url: 'https://example.test/old.jpg' },
  ] }] };
  const saved = normalizeDetailComposition(value);
  assert.equal(validateDetailComposition(saved), null);
  assert.deepEqual(normalizeDetailComposition(JSON.parse(JSON.stringify(saved))), saved);
  const block = saved.blocks[0];
  block.ratio = 'square'; block.fit = 'contain'; block.media.reverse();
  const reread = normalizeDetailComposition(saved).blocks[0].media;
  assert.equal(reread[0].ratio, 'inherit'); assert.equal(reread[0].fit, 'inherit');
  assert.equal(reread[1].ratio, 'auto');
  assert.equal(reread[2].ratio, 'story'); assert.equal(reread[2].fit, 'cover');
  assert.equal(reread[3].ratio, 'landscape'); assert.equal(reread[3].fit, 'contain');
  assert.deepEqual(mediaAppearanceStyle(reread[0]), {});
  assert.equal(mediaAppearanceStyle(reread[3])['--proporcion'], String(16 / 9));
  for (const field of ['ratio', 'fit']) {
    const invalid = structuredClone(saved); invalid.blocks[0].media[0][field] = 'url(javascript:alert(1))';
    assert.ok(validateDetailComposition(invalid));
    assert.equal(normalizeDetailComposition(invalid).blocks[0].media[0][field], 'inherit');
  }
});

test('la acción pendiente de personalización está aislada por producto, vence y se puede completar', () => {
  const data = new Map(); const storage = { setItem: (k, v) => data.set(k, v), getItem: k => data.get(k), removeItem: k => data.delete(k) };
  assert.equal(rememberPersonalizationAction('wallet', 'cart', storage, 100), true);
  assert.equal(readPersonalizationAction('wallet', storage, 101), 'cart');
  assert.equal(readPersonalizationAction('other', storage, 101), null);
  assert.equal(readPersonalizationAction('wallet', storage, 100 + 86400001), null);
  clearPersonalizationAction('wallet', storage);
  assert.equal(readPersonalizationAction('wallet', storage, 101), null);
  assert.equal(rememberPersonalizationAction('wallet', 'charge', storage), false);
});
