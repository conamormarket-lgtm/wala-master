import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fuente = await readFile(new URL('./adaptadoresEstudio.js', import.meta.url), 'utf8');
const { capaEstudioDesde, cambiosDePanelEstudio } = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);

test('el tamaño de letra conserva la base y la proporción de un diseño anterior', () => {
  const capa = { type: 'text', text: 'Walá', tamano: 90, escalaX: 2, escalaY: 3, curva: 40 };
  assert.equal(capaEstudioDesde(capa, 1000).tamano, 0.27);
  assert.deepEqual(cambiosDePanelEstudio(capa, { tamano: 0.54, texto: 'Mi diseño' }, 1000), {
    text: 'Mi diseño', escalaX: 4, escalaY: 6,
  });
  assert.equal(capa.curva, 40);
  assert.equal(capa.tamano, 90);
});

test('el ancho de imagen usa píxeles naturales y conserva escalas y posición', () => {
  const capa = { type: 'image', anchoNatural: 2400, escalaX: 0.25, escalaY: 0.5, left: 430, flipX: true };
  assert.equal(capaEstudioDesde(capa, 1000).ancho, 0.6);
  assert.deepEqual(cambiosDePanelEstudio(capa, { ancho: 0.3 }, 1000), { escalaX: 0.125, escalaY: 0.25 });
  assert.deepEqual(cambiosDePanelEstudio(capa, { voltear: false, angulo: 90 }, 1000), { flipX: false, angulo: 90 });
  assert.equal(capa.left, 430);
});

test('cambiar efectos no añade campos del kit al formato guardado', () => {
  const capa = { type: 'text', tamano: 100 };
  assert.deepEqual(cambiosDePanelEstudio(capa, { contorno: 8, sombra: 5, sinRelleno: false }, 1000), {
    contorno: 8, sombra: 5, sinRelleno: false,
  });
});
