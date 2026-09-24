import test from 'node:test';
import assert from 'node:assert/strict';
import { firstHeroUrl, criticalQueryNames, initialSectionCount, resolveCatalogFacet } from './startup.mjs';
import { collectFontFamilies, localFontRules } from '../../../services/shared/fontFamilies.mjs';
import { readFileSync } from 'node:fs';

test('preloads the first configured image by display order without mutating the configuration', () => {
  const sections = [
    { type: 'hero_banner', order: 8, settings: { mediaUrl: 'later.webp' } },
    { type: 'hero_banner', order: 0, settings: { mediaType: 'video', mediaUrl: 'movie.mp4' } },
    { type: 'hero_carousel', order: 2, settings: { slides: [{ imageUrl: 'first.webp' }] } },
  ];
  assert.equal(firstHeroUrl(sections), 'first.webp');
  assert.equal(sections[0].order, 8);
  assert.equal(firstHeroUrl([{ type: 'hero_carousel', settings: {} }]), '');
  assert.equal(firstHeroUrl([]), '');
});

test('hero homepage does not wait for fonts, catalog or lower sections', () => {
  const critical = criticalQueryNames([
    { type: 'sidebar_catalog', order: 1 },
    { type: 'hero_banner', order: 0 },
  ]);
  assert.deepEqual([...critical], ['storefront-config', 'store-config-custom']);
});

test('mobile preload matches the first valid picture source and ignores empty slides', () => {
  const sections = [{ type: 'hero_carousel', settings: { slides: [
    { imageUrl: '' }, { imageUrl: 'desktop.webp', mobileImageUrl: 'mobile.webp' },
  ] } }];
  assert.equal(firstHeroUrl(sections, true), 'mobile.webp');
  assert.equal(firstHeroUrl(sections, false), 'desktop.webp');
});

test('small announcement and header above the catalog do not bypass its loading state', () => {
  const names = criticalQueryNames([
    { type: 'announcement_bar', order: 0 }, { type: 'header', order: 1 },
    { type: 'product_grid', order: 2 }, { type: 'category_grid', order: 3 },
  ]);
  assert.ok(names.has('products-infinite'));
  assert.ok(!names.has('storefront-category-grid-products'));
  assert.equal(initialSectionCount([{ type: 'announcement_bar' }, { type: 'header' }, { type: 'product_grid' }]), 3);
});

test('page navigation cannot leak a previous category or brand into another catalog', () => {
  const selection = { pageId: 'home', facet: { type: 'category', value: 'shirts' } };
  assert.deepEqual(resolveCatalogFacet(selection, 'home', null), selection.facet);
  assert.equal(resolveCatalogFacet(selection, 'tienda', null), null);
  assert.deepEqual(resolveCatalogFacet(selection, 'brand-b', 'b'), { type: 'brand', value: 'b' });
  assert.equal(resolveCatalogFacet({ pageId: 'brand-a', facet: { type: 'brand', value: 'a' } }, 'home', null), null);
});

test('a catalog-first page waits for its first product page', () => {
  const critical = criticalQueryNames([{ type: 'sidebar_catalog' }]);
  assert.ok(critical.has('products-infinite'));
  assert.ok(critical.has('products'));
  assert.ok(critical.has('categories'));
  assert.ok(!critical.has('storefront-category-grid-products'));
});

test('carousel-first pages wait for their actual data readers', () => {
  for (const type of ['new_arrivals_carousel', 'sale_carousel', 'category_carousel']) {
    assert.ok(criticalQueryNames([{ type }]).has('query-carousel'));
  }
  assert.ok(criticalQueryNames([{ type: 'featured_carousel' }]).has('featured-products'));
});

test('collects only explicitly used public fonts, including nested settings and rich text', () => {
  const config = { sections: [
    { settings: { titleFontFamily: "'Super Bubble', sans-serif", subtitleFontFamily: 'Poppins' } },
    { settings: { content: '<p style="font-family: Montserrat;">Hola</p>' } },
  ], nav: { fontFamily: 'Super Bubble' } };
  assert.deepEqual(collectFontFamilies(config), ['Montserrat', 'Super Bubble']);
  assert.deepEqual(collectFontFamilies(undefined), []);
});

test('selecting a local public font does not install the Segoe face or unrelated editor fonts', () => {
  const css = readFileSync(new URL('../../../../public/fonts/fonts.css', import.meta.url), 'utf8');
  const subset = localFontRules(css, ['Super Bubble']);
  assert.deepEqual(subset.map(({ family }) => family), ['Super Bubble']);
  assert.match(subset[0].rule, /url\("\/fonts\/Super Bubble.ttf"\)/);
  assert.match(subset[0].rule, /font-display: swap/);
  assert.ok(localFontRules(css, [], true).some(({ family }) => family === 'Segoe UI'));
  assert.equal(localFontRules(css, ['Unknown']).length, 0);
});
