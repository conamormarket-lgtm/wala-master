import test from 'node:test';
import assert from 'node:assert/strict';
import { capasDePlantilla, tamanoParaCaja, textoEnCaja } from './plantillasACapas.mjs';

const recursos = { fondo: { src: 'https://x/fondo.png', ancho: 1400, alto: 1100 }, escudo: { src: 'https://x/escudo.png', ancho: 1000, alto: 1400 } };
const foto = { src: 'https://x/foto.png', ancho: 1200, alto: 1200 };
const preset = {
  elementos: [
    { id: 'nombre', x: 0.25, y: 0.5, w: 0.4, h: 0.1, orden: 3, fuente: 'Elegante', color: '#FFFFFF', sombraOpacidad: 0.7, sombraColor: '#09203E', mayusculas: true },
    { id: 'fondo', recurso: 'fondo', x: 0.5, y: 0.5, w: 1, h: 1, orden: 0, encaje: 'cubrir' },
    { id: 'foto', indiceFoto: 0, x: 0.75, y: 0.5, w: 0.5, h: 0.8, orden: 1, encaje: 'completa' },
    { id: 'escudo', recurso: 'escudo', x: 0.25, y: 0.25, w: 0.3, h: 0.4, orden: 2 },
    { id: 'frase', x: 0.25, y: 0.7, w: 0.4, h: 0.1, orden: 4, fuente: 'Manuscrita' },
  ],
};

test('las capas siguen el orden de la plantilla y caen en unidades de la zona', () => {
  const capas = capasDePlantilla({ preset, proporcion: 0.8, recursos, foto, textos: { nombre: 'Daniel' }, unidades: 1000 });
  assert.deepEqual(capas.map((c) => c.src || c.text), ['https://x/fondo.png', 'https://x/foto.png', 'https://x/escudo.png', 'DANIEL']);
  const [fondo, retrato, escudo, nombre] = capas;
  // El fondo llena la zona (1000 × 800) y queda fijo.
  assert.equal(fondo.left, 500);
  assert.equal(fondo.top, 400);
  assert.equal(fondo.escalaX, Math.max(1000 / 1400, 800 / 1100));
  assert.equal(fondo.fija, true);
  // La foto "completa" entra entera en su caja (500 × 640).
  assert.equal(retrato.escalaX, Math.min(500 / 1200, 640 / 1200));
  assert.equal(retrato.fija, undefined);
  assert.equal(escudo.fija, undefined);
  assert.equal(nombre.fuente, 'Cinzel');
  assert.equal(nombre.sombraColor, '#09203E');
  assert.equal(nombre.color, '#FFFFFF');
  assert.equal(nombre.top, 400);
});

test('el texto de muestra cabe en su caja', () => {
  assert.equal(tamanoParaCaja('Ana', 1000, 100), 86);
  assert.ok(tamanoParaCaja('Una dedicatoria bastante larga', 400, 100) * 30 * 0.6 <= 400);
});

test('un texto largo en una caja alta se parte en líneas parejas', () => {
  assert.equal(textoEnCaja('Gracias por hacerme sentir en casa.', 240, 110, 0.45), 'Gracias por\nhacerme sentir\nen casa.');
  assert.equal(textoEnCaja('Daniel', 440, 96, 0.72), 'Daniel');
});
