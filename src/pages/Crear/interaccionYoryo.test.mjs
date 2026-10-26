import test from 'node:test';
import assert from 'node:assert/strict';
import { crearHistorialYoryo } from './historialYoryo.mjs';
import { limitarCamaraYoryo, transformarSeccionYoryo, zoomCamaraYoryo } from '../../utils/gestosYoryo.mjs';

test('una acción se deshace y rehace completa sin alterar el resto del pack', () => {
  const base = [{ nombre: 'Daniel', x: .5 }, { nombre: 'Cuadro' }];
  const h = crearHistorialYoryo(base);
  h.cambiar((anterior) => anterior.map((p, i) => i === 0 ? { ...p, x: .7 } : p));
  assert.equal(h.actual[0].x, .7); assert.equal(h.actual[1], base[1]);
  assert.equal(h.deshacer(), base); assert.equal(h.puedeDeshacer, false);
  assert.equal(h.rehacer()[0].x, .7); assert.equal(h.puedeRehacer, false);
  h.deshacer(); h.cambiar([{ nombre: 'Carlos' }, base[1]]);
  assert.equal(h.puedeRehacer, false);
});

test('las pulsaciones seguidas se agrupan; otro control y una pausa crean pasos nuevos', () => {
  const h = crearHistorialYoryo('');
  h.cambiar('D', 'nombre', 1000); h.cambiar('Da', 'nombre', 1100); h.cambiar('Daniel', 'nombre', 1200);
  assert.equal(h.deshacer(), ''); assert.equal(h.rehacer(), 'Daniel');
  h.cambiar('Carlos', 'nombre', 3000); h.cambiar('Frase', 'frase', 3100);
  assert.equal(h.deshacer(), 'Carlos'); assert.equal(h.deshacer(), 'Daniel');
});

test('el historial es acotado y los cambios sin efecto no consumen pasos', () => {
  const h = crearHistorialYoryo(0, 3);
  for (let i = 1; i <= 8; i++) h.cambiar(i);
  h.cambiar(8); assert.equal(h.deshacer(), 7); assert.equal(h.deshacer(), 6); assert.equal(h.deshacer(), 5);
  assert.equal(h.puedeDeshacer, false);
});

test('arrastre, esquina y pellizco conservan proporción y límites, con imán al centro', () => {
  const e = { x: .3, y: .3, w: .4, h: .2, centroX: .5, centroY: .4 };
  const mover = transformarSeccionYoryo(e, { dx: .01, dy: .1 });
  assert.equal(mover.centroX, .5); assert.equal(mover.iman, true);
  const libre = transformarSeccionYoryo(e, { dx: .01, iman: 0 }); assert.equal(libre.centroX, .51);
  const eje = transformarSeccionYoryo(e, { dx: .1, dy: .01, eje: true }); assert.equal(eje.centroY, .4);
  const grande = transformarSeccionYoryo(e, { dx: 10, dy: -10, factor: 10 });
  assert.equal(grande.escala, 160);
  assert.ok(grande.x >= .01999 && grande.y >= .01999 && grande.x + grande.w <= .98001 && grande.y + grande.h <= .98001);
  assert.equal(grande.w / grande.h, 2);
});

test('el zoom y el recorrido de la vista no permiten dejar el producto fuera de pantalla', () => {
  assert.deepEqual(limitarCamaraYoryo({ z: 1, x: 999, y: -999 }, 400, 600), { z: 1, x: 0, y: 0 });
  assert.deepEqual(limitarCamaraYoryo({ z: 2, x: 999, y: -999 }, 400, 600), { z: 2, x: 200, y: -300 });
  assert.equal(limitarCamaraYoryo({ z: 8 }, 400, 600).z, 3);
});

test('una foto a sangre llega al borde sin deformarse ni cambiar de tamaño al soltar el gesto', () => {
  const foto = { x: 0, y: 0, w: 1, h: .72, centroX: .5, centroY: .36, margen: 0 };
  const resultado = transformarSeccionYoryo(foto, { factor: 1.5 });
  assert.equal(resultado.w, 1); assert.equal(resultado.h, .72); assert.equal(resultado.escala, 100);
  assert.equal(resultado.x, 0); assert.equal(resultado.y, 0);
});

test('el zoom conserva el punto bajo el cursor y volver al 100% centra el producto', () => {
  const camara = { z: 1.5, x: 20, y: -30 }, punto = { x: 60, y: 80 };
  const ampliada = zoomCamaraYoryo(camara, 1.2, 400, 600, punto);
  assert.ok(Math.abs((punto.x - ampliada.x) / ampliada.z - (punto.x - camara.x) / camara.z) < 1e-9);
  assert.ok(Math.abs((punto.y - ampliada.y) / ampliada.z - (punto.y - camara.y) / camara.z) < 1e-9);
  assert.deepEqual(zoomCamaraYoryo(ampliada, .1, 400, 600, punto), { z: 1, x: 0, y: 0 });
});
