import test from 'node:test';
import assert from 'node:assert/strict';
import { grisDe, textoEnGrises, pixelesEnGrises } from './laser.mjs';

test('los colores del texto pasan a gris con su luminancia', () => {
  assert.equal(grisDe('#FFFFFF'), '#FFFFFF');
  assert.equal(grisDe('#000000'), '#000000');
  assert.equal(grisDe('#FF0000'), '#4C4C4C');
  assert.equal(grisDe('rgba(0,0,0,0)'), 'rgba(0,0,0,0)');
  const capa = textoEnGrises({ text: 'Ana', color: '#7C3AED', contornoColor: '#FFFFFF', tamano: 90 });
  assert.equal(capa.color, grisDe('#7C3AED'));
  assert.equal(capa.contornoColor, '#FFFFFF');
  assert.equal(capa.sombraColor, undefined);
  assert.equal(capa.tamano, 90);
});

test('las imágenes quedan en grises y conservan su transparencia', () => {
  const datos = pixelesEnGrises(new Uint8ClampedArray([255, 0, 0, 128, 0, 0, 255, 0]));
  assert.deepEqual([...datos], [76, 76, 76, 128, 29, 29, 29, 0]);
});
