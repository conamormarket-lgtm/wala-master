import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { normalizeProductVideos, validateProductVideo, MAX_PRODUCT_VIDEO_BYTES } from '../../src/utils/productVideos.mjs';

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
  assert.doesNotMatch(html, /<video/);
});

test('la galería solo monta el vídeo seleccionado, con controles y sin autoplay ni zoom', () => {
  const fotos = [{ url: '/foto.jpg', nombre: 'Foto' }];
  const videos = fichaProductoDesde({ videos: [video, { url: 'https://example.test/dos.webm' }] }).videos;
  const html = render(GaleriaProducto, { imagenes: [...fotos, ...videos], inicial: 1, nombre: 'Producto' });
  assert.equal((html.match(/<video /g) || []).length, 1);
  assert.match(html, /controls=""/);
  assert.match(html, /playsinline=""/);
  assert.match(html, /preload="metadata"/);
  assert.match(html, /aria-label="Reproducir Producto · Cómo se ve"/);
  assert.match(html, /Cargando vista previa/);
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
