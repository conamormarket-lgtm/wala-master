import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let servidor;
let tarjetaDesdeProducto;
let fichaProductoDesde;
let TarjetaProducto;
let TarjetaCreacion;
before(async () => {
  servidor = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  ({ tarjetaDesdeProducto, fichaProductoDesde } = await servidor.ssrLoadModule('/src/componentes/kit/adaptadores.js'));
  ({ default: TarjetaProducto } = await servidor.ssrLoadModule('/src/componentes/kit/TarjetaProducto.jsx'));
  ({ TarjetaCreacion } = await servidor.ssrLoadModule('/src/componentes/kit/piezas/Creaciones.jsx'));
});
after(async () => { await servidor?.close(); });

const combo = {
  id: 'pareja', name: 'Pareja', price: 188, inStock: 4, isComboProduct: true,
  images: ['/images/placeholder.svg'], mainImage: '/images/placeholder.svg',
  comboItems: [
    { productId: 'ella', name: 'Nombre antiguo', imageUrl: '/ella-antigua.png', variantMapping: { color: ' blanco ' } },
    { productId: 'el', name: 'Él', imageUrl: '/el.png' },
  ],
};
const render = (Componente, props) => renderToStaticMarkup(React.createElement(Componente, props));

test('un combo sin portada usa el mismo bloque de fotos de Crear, sin la imagen de relleno', () => {
  const props = tarjetaDesdeProducto(combo);
  assert.equal(props.imagen, undefined);
  assert.equal(props.imagenHover, undefined);
  const tarjeta = render(TarjetaProducto, props);
  const creacion = render(TarjetaCreacion, { nombre: 'Pareja', combo: '2', imagenes: props.piezas.map((p) => p.imagen) });
  for (const html of [tarjeta, creacion]) {
    assert.match(html, /data-componente="FotosCombo"/);
    assert.match(html, /src="\/ella-antigua.png"/);
    assert.match(html, /src="\/el.png"/);
    assert.doesNotMatch(html, /placeholder/);
  }
});

test('un combo con portada conserva su foto y no compone las prendas', () => {
  const props = tarjetaDesdeProducto({ ...combo, comboPreviewImage: '/portada.png' });
  assert.equal(props.imagen, '/portada.png');
  const html = render(TarjetaProducto, props);
  assert.match(html, /src="\/portada.png"/);
  assert.doesNotMatch(html, /data-componente="FotosCombo"/);
});

test('las fotos y los nombres del hover vienen del producto actual, en el color del combo', () => {
  const subproductos = { ella: {
    id: 'ella', name: 'Ella actualizada', hasVariants: true, defaultVariantId: 'negro',
    variants: [
      { id: 'negro', name: 'Negro', imageUrl: '/negro.png' },
      { id: 'blanco', name: 'Blanco', imageUrl: '/blanco-actualizado.png' },
    ],
  } };
  const props = tarjetaDesdeProducto(combo, { subproductos });
  assert.deepEqual(props.piezas[0], { nombre: 'Ella actualizada', imagen: '/blanco-actualizado.png' });
  const html = render(TarjetaProducto, props);
  assert.match(html, /blanco-actualizado.png/);
  assert.match(html, /Ella actualizada/);
  assert.doesNotMatch(html, /ella-antigua|Nombre antiguo|\/negro.png/);
  assert.equal(props.piezas[1].imagen, '/el.png');
});

test('una pieza sin foto actual válida conserva su respaldo y no usa placeholders', () => {
  const props = tarjetaDesdeProducto(combo, { subproductos: { ella: { id: 'ella', images: ['/images/placeholder.svg'] } } });
  assert.equal(props.piezas[0].imagen, '/ella-antigua.png');
});

test('los productos sueltos conservan portada, hover y miniatura elegida', () => {
  const producto = { id: 'solo', name: 'Solo', price: 99, inStock: true, images: ['/frente.png', '/espalda.png'] };
  const props = tarjetaDesdeProducto(producto);
  assert.equal(props.imagen, '/frente.png');
  assert.equal(props.imagenHover, '/espalda.png');
  assert.equal(props.piezas.length, 0);
  assert.equal(tarjetaDesdeProducto(producto, { imagen: '/miniatura.png' }).imagen, '/miniatura.png');
});

test('la ficha sin portada solo incluye fotos reales de sus prendas, sin miniatura de relleno', () => {
  const ficha = fichaProductoDesde(combo, { subproductos: {
    ella: { id: 'ella', mainImage: '/images/placeholder.svg', images: ['/ella-actual.png', '/images/placeholder.svg'] },
    el: { id: 'el', hasVariants: true, variants: [{ id: 'negro', name: 'Negro', imageUrl: '/el-actual.png', images: ['/images/placeholder.svg'] }] },
  } });
  assert.equal(ficha.fotos.combo.portada.length, 0);
  assert.equal(ficha.fotos.combo.producto.length, 0);
  assert.doesNotMatch(JSON.stringify(ficha.fotos), /placeholder/);
  assert.ok(ficha.fotos.base.some((f) => f.url === '/ella-antigua.png'));
  assert.ok(ficha.fotos.combo.piezas[0].general.includes('/ella-actual.png'));
  assert.ok(ficha.fotos.combo.piezas[1].porColor.Negro.includes('/el-actual.png'));
});

test('la ficha conserva una portada real y sus fotos adicionales', () => {
  const ficha = fichaProductoDesde({ ...combo, comboPreviewImage: '/portada.png', images: ['/images/placeholder.svg', '/detalle.png'] });
  assert.equal(ficha.fotos.base[0].url, '/portada.png');
  assert.deepEqual(ficha.fotos.combo.portada, ['/portada.png']);
  assert.deepEqual(ficha.fotos.combo.producto, ['/detalle.png']);
  assert.doesNotMatch(JSON.stringify(ficha.fotos), /placeholder/);
});

test('mientras se leen las prendas no se muestra ninguna foto antigua del combo', () => {
  const props = tarjetaDesdeProducto(combo, { piezasCargando: true });
  assert.equal(props.piezas.length, 2);
  assert.ok(props.piezas.every((p) => !p.imagen));
  const html = render(TarjetaProducto, props);
  assert.match(html, /data-componente="FotosCombo"/);
  assert.doesNotMatch(html, /ella-antigua.png|\/el.png/);
});

test('las prendas llegan por separado sin usar la foto antigua de la que todavía carga', () => {
  const props = tarjetaDesdeProducto(combo, { piezasCargando: true, subproductos: {
    ella: { id: 'ella', mainImage: '/ella-actual.png' },
  } });
  const html = render(TarjetaProducto, props);
  assert.match(html, /ella-actual.png/);
  assert.doesNotMatch(html, /ella-antigua.png|\/el.png/);
});

test('al terminar la carga se muestran las fotos actuales y se permite respaldo si alguna lectura falló', () => {
  const props = tarjetaDesdeProducto(combo, { piezasCargando: false, subproductos: {
    ella: { id: 'ella', mainImage: '/ella-actual.png' },
    el: { id: 'el', mainImage: '/el-actual.png' },
  } });
  const html = render(TarjetaProducto, props);
  assert.match(html, /ella-actual.png/);
  assert.match(html, /el-actual.png/);
  assert.doesNotMatch(html, /ella-antigua.png|src="\/el.png"/);
  const respaldo = tarjetaDesdeProducto(combo, { piezasCargando: false });
  assert.equal(respaldo.piezas[0].imagen, '/ella-antigua.png');
});
