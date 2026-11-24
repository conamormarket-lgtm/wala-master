import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { rutaCompra, productoLandingDeCompra } from '../../src/utils/checkoutOrigin.mjs';

test('el origen landing sobrevive al checkout, al carrito y a una recarga', () => {
  const path = rutaCompra({ pathname: '/producto/billetera/landing/', search: '?utm_source=ig' });
  assert.equal(path, '/checkout?landing=billetera');
  const checkout = new URL(path, 'https://www.wala.pe');
  assert.equal(productoLandingDeCompra(checkout), 'billetera');
  const cart = new URL(rutaCompra(checkout, '/carrito'), checkout);
  assert.equal(rutaCompra(cart), path);
});

test('la ficha normal y los parámetros ajenos no habilitan el checkout invitado', () => {
  for (const path of ['/producto/billetera', '/tienda?landing=billetera', '/checkout', '/checkout?landing=', '/checkout?landing=a%2Fb']) {
    const loc = new URL(path, 'https://www.wala.pe');
    assert.equal(productoLandingDeCompra(loc), null);
    assert.equal(rutaCompra(loc), '/checkout');
  }
});

let server, PaginaCheckout;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ PaginaCheckout } = await server.ssrLoadModule('/src/componentes/kit/paginas/Checkout.jsx'));
});
after(async () => server?.close());
const render = (props) => renderToStaticMarkup(React.createElement(PaginaCheckout, {
  items: [{ id: 'a', nombre: 'Billetera', precio: 120, cantidad: 1 }], ...props,
}));

test('el envío de la landing permite continuar sin cuenta y pide los datos de contacto', () => {
  const html = render({ permitirInvitado: true });
  assert.match(html, /Continuar al pago/);
  assert.match(html, /Correo/);
  assert.doesNotMatch(html, /Inicia sesión para pagar|Para pagar necesitas tu cuenta/);
  assert.match(render({}), /Inicia sesión para pagar/);
  assert.match(render({ sesion: true }), /Continuar al pago/);
});

test('el comprobante invitado no obliga a abrir una cuenta para ver pedidos', () => {
  const props = { listo: { numero: 'PD-PRUEBA', metodo: 'tarjeta' } };
  const html = render({ ...props, permitirInvitado: true });
  assert.match(html, /Pago aprobado/);
  assert.match(html, /PD-PRUEBA/);
  assert.match(html, /Seguir comprando/);
  assert.doesNotMatch(html, /Ver mi pedido/);
  assert.match(render({ ...props, sesion: true }), /Ver mi pedido/);
});
