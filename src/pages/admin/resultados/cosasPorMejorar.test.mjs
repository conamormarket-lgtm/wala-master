import test from 'node:test';
import assert from 'node:assert/strict';
import { cosasPorMejorar } from './cosasPorMejorar.mjs';

const taw = (total) => ({ total, app: 0, web: total });

test('sin datos no inventa avisos', () => {
  assert.deepEqual(cosasPorMejorar({}), []);
});

test('producto muy visto y casi sin ventas, con su nombre del catálogo', () => {
  const avisos = cosasPorMejorar({
    masVistos: [
      { productId: 'taza', name: 'taza', total: 210 },
      { productId: 'polo', name: 'Polo', total: 150 },
      { productId: 'gorro', name: 'Gorro', total: 5 }, // pocas vistas: no cuenta
      { productId: 'vaso', name: 'Vaso', total: 90 },
    ],
    topVendidos: [{ productId: 'taza', unidades: 1 }, { productId: 'polo', unidades: 12 }],
    nombres: new Map([['taza', 'Taza Kapi']]),
  });
  assert.deepEqual(avisos.map((a) => a.titulo), ['Taza Kapi: 210 vistas y 1 venta', 'Vaso: 90 vistas y 0 ventas']);
  assert.ok(avisos.every((a) => a.nivel === 'alta' && a.destino === 'productos'));
});

test('carritos, embudo, rebote, búsqueda y enlaces, ordenados por urgencia', () => {
  const avisos = cosasPorMejorar({
    carritos: { cantidad: taw(9), valorCents: taw(82000) },
    embudo: { adds: taw(40), checkouts: taw(30), purchases: taw(12) },
    visitas: { total: taw(100), conInteraccion: taw(20) },
    busquedas: [{ query: 'polo pareja', total: 46 }, { query: 'taza', total: 3 }],
    enlacesRotos: 3,
  });
  assert.deepEqual(avisos.map((a) => [a.id, a.nivel]), [
    ['carritos', 'alta'], ['embudo', 'media'], ['rebote', 'media'], ['busqueda', 'baja'], ['enlaces', 'baja'],
  ]);
  assert.equal(avisos[0].titulo, '9 carritos abandonados por S/ 820.00');
  // carrito→pagar cae 25 %, pagar→pedido cae 60 %: se avisa el peor.
  assert.equal(avisos[1].titulo, 'De cada 10 que llegan a pagar, 6 no terminan');
  assert.equal(avisos[2].titulo, 'De cada 10 visitas, 8 se van sin hacer nada');
  assert.equal(avisos[3].titulo, 'Buscaron "polo pareja" 46 veces');
  assert.equal(avisos[4].titulo, '3 direcciones que no existen recibieron visitas');
});

test('por debajo de los umbrales no avisa', () => {
  const avisos = cosasPorMejorar({
    embudo: { adds: taw(3), checkouts: taw(0), purchases: taw(0) }, // muy poca gente
    visitas: { total: taw(10), conInteraccion: taw(0) },            // pocas visitas
    busquedas: [{ query: 'x', total: 2 }],
    carritos: { cantidad: taw(0), valorCents: taw(0) },
  });
  assert.deepEqual(avisos, []);
});

test('un solo carrito es urgencia media y en singular', () => {
  const [a] = cosasPorMejorar({ carritos: { cantidad: taw(1), valorCents: taw(4990) } });
  assert.equal(a.titulo, '1 carrito abandonado por S/ 49.90');
  assert.equal(a.nivel, 'media');
});
