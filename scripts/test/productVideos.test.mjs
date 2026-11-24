import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { normalizeProductVideos, validateProductVideo, MAX_PRODUCT_VIDEO_BYTES, galleryWithProductVideos } from '../../src/utils/productVideos.mjs';

let server, fichaProductoDesde, tarjetaDesdeProducto, GaleriaProducto, PaginaProducto, fichaDesdeProducto, fichaAProducto;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ fichaProductoDesde, tarjetaDesdeProducto } = await server.ssrLoadModule('/src/componentes/kit/adaptadores.js'));
  ({ GaleriaProducto } = await server.ssrLoadModule('/src/componentes/kit/piezas/GaleriaProducto.jsx'));
  ({ PaginaProducto } = await server.ssrLoadModule('/src/componentes/kit/paginas/Producto.jsx'));
  ({ fichaDesdeProducto, fichaAProducto } = await server.ssrLoadModule('/src/componentes/kit/adaptadoresAdmin.js'));
});
after(async () => { await server?.close(); });
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const video = { url: 'https://example.test/demo.mp4?alt=media', name: 'Cómo se ve' };

test('guarda color, posición, portada y reproducción a través del editor y la ficha', () => {
  const value = { ...video, variantId: 'blue', afterImage: 1, poster: 'https://example.test/poster.webp', autoPlay: true, muted: false, loop: true };
  const expected = { ...value, muted: true };
  const saved = normalizeProductVideos(fichaAProducto(fichaDesdeProducto({ videos: [value] })).videos);
  assert.deepEqual(saved, [expected]);
  const slide = fichaProductoDesde({ videos: saved }).videos[0];
  assert.equal(slide.variantId, 'blue');
  const html = render(GaleriaProducto, { imagenes: [slide], nombre: 'Demo' });
  assert.match(html, /poster="https:\/\/example.test\/poster.webp"/);
  assert.match(html, /autoplay=""/);
  assert.match(html, /loop=""/);
});

test('al cambiar de color solo mezcla sus vídeos y los comunes, conservando orden', () => {
  const photos = [{ id: 'a' }, { id: 'b' }];
  const videos = [{ id: 'common' }, { id: 'blue', variantId: 'blue', afterImage: 1 }, { id: 'red', variantId: 'red', afterImage: 0 }, { id: 'tail', variantId: 'blue', afterImage: 20 }];
  assert.deepEqual(galleryWithProductVideos(photos, videos, 'blue').map(x => x.id), ['a', 'blue', 'b', 'tail', 'common']);
  assert.deepEqual(galleryWithProductVideos(photos, videos, 'red').map(x => x.id), ['red', 'a', 'b', 'common']);
  assert.deepEqual(galleryWithProductVideos([], videos, 'blue').map(x => x.id), ['blue', 'tail', 'common']);
  assert.deepEqual(photos, [{ id: 'a' }, { id: 'b' }]);
});

test('los archivos de vista previa se aceptan solo en modo local explícito', () => {
  const value = { url: '/output/product-media/consul/videos/G-AZ-01.mp4', poster: 'local:poster' };
  assert.deepEqual(normalizeProductVideos([value]), []);
  assert.equal(normalizeProductVideos([value], { allowLocal: true })[0].poster, value.poster);
  assert.deepEqual(normalizeProductVideos([{ url: '/output/product-media/../secret.mp4' }, { url: 'blob:temp' }], { allowLocal: true }), []);
});

test('el editor actual conserva los vídeos al reabrir, guardar borradores y quitar el último', () => {
  const initial = fichaDesdeProducto({ name: 'Demo', videos: [video] });
  assert.deepEqual(initial.videos, [video]);
  const saved = fichaAProducto(initial);
  assert.deepEqual(saved.videos, [video]);
  assert.deepEqual(fichaDesdeProducto(saved).videos, [video]);
  assert.deepEqual(fichaAProducto({ ...initial, videos: [] }).videos, []);
  assert.deepEqual(fichaDesdeProducto(null).videos, []);
});

test('normaliza vídeos sin aceptar URLs temporales, vacíos, duplicados o protocolos ejecutables', () => {
  assert.deepEqual(normalizeProductVideos(null), []);
  assert.deepEqual(normalizeProductVideos([null, {}, '', 'javascript:alert(1)', 'blob:local', 'data:video/mp4,x', video, video.url]), [video]);
  assert.deepEqual(normalizeProductVideos([' https://example.test/otro.webm ']), [{ url: 'https://example.test/otro.webm', name: '' }]);
});

test('valida formatos, MIME ausente, archivo vacío y límite de tamaño antes de subir', () => {
  assert.equal(validateProductVideo({ name: 'demo.mp4', type: 'video/mp4', size: MAX_PRODUCT_VIDEO_BYTES }), null);
  assert.equal(validateProductVideo({ name: 'DEMO.WEBM', type: '', size: 1024 }), null);
  for (const file of [
    { type: 'video/quicktime', name: 'demo.mov', size: 1000 },
    { type: 'image/png', name: 'fake.mp4', size: 1000 },
    { type: 'video/mp4', size: 0 },
    { type: 'video/mp4', size: MAX_PRODUCT_VIDEO_BYTES + 1 },
  ]) assert.ok(validateProductVideo(file));
});

test('la ficha conserva fotos por color y añade vídeos generales sin contaminar portada ni hover', () => {
  const p = { id: 'p', name: 'Producto', price: 20, inStock: 5, hasVariants: true, defaultVariantId: 'azul',
    variants: [{ id: 'azul', name: 'Azul', imageUrl: '/azul.jpg' }, { id: 'rojo', name: 'Rojo', imageUrl: '/rojo.jpg' }], videos: [video] };
  const ficha = fichaProductoDesde(p);
  assert.equal(ficha.videos[0].tipo, 'video');
  assert.equal(ficha.videos[0].url, video.url);
  assert.equal(ficha.fotos.azul[0].url, '/azul.jpg');
  assert.equal(ficha.fotos.rojo[0].url, '/rojo.jpg');
  assert.doesNotMatch(JSON.stringify(tarjetaDesdeProducto(p)), /demo\.mp4/);
  const html = render(PaginaProducto, { ...ficha, fuentes: url => { assert.notEqual(url, video.url); return { src: url }; } });
  assert.match(html, /Vídeo 1/);
  assert.match(html, /data-video-miniatura=""/);
  assert.doesNotMatch(html, /<video[^>]*controls=""/);
});

test('la galería monta miniaturas sin controles y un solo reproductor para el vídeo seleccionado', () => {
  const fotos = [{ url: '/foto.jpg', nombre: 'Foto' }];
  const videos = fichaProductoDesde({ videos: [video, { url: 'https://example.test/dos.webm' }] }).videos;
  const html = render(GaleriaProducto, { imagenes: [...fotos, ...videos], inicial: 1, nombre: 'Producto' });
  assert.equal((html.match(/data-video-miniatura=""/g) || []).length, 2);
  assert.equal((html.match(/<video[^>]*controls=""/g) || []).length, 1);
  assert.match(html, /tabindex="-1" aria-hidden="true"/);
  assert.match(html, /controls=""/);
  assert.match(html, /playsinline=""/);
  assert.match(html, /preload="metadata"/);
  assert.match(html, /aria-label="Reproducir Producto · Cómo se ve"/);
  assert.match(html, /poster="\/foto.jpg"/);
  assert.doesNotMatch(html, /Cargando vista previa/);
  assert.match(html, /aria-label="Producto · Cómo se ve"/);
  assert.doesNotMatch(html, /autoplay|Pasa el cursor|src="https:\/\/example.test\/dos.webm"/i);
});

test('un combo y un producto sin fotos también ofrecen sus vídeos', () => {
  for (const product of [{}, { isComboProduct: true, comboItems: [] }]) {
    const ficha = fichaProductoDesde({ ...product, name: 'Demo', videos: [video] });
    const html = render(PaginaProducto, ficha);
    assert.match(html, /<video /);
    assert.match(html, /demo\.mp4/);
  }
});
