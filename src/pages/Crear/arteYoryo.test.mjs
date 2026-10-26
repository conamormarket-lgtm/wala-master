import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { validarVectorSvg, crearArteYoryo } from './arteYoryo.mjs';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { ESCUDOS_LASER_YORYO, vectorLaserDeEquipo } from '../../utils/vectoresLaserYoryo.mjs';

const { esSvgLaser } = createRequire(import.meta.url)('../../../functions/yoryoProduccion.js');
globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const svg = (contenido, atributos = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 100 150" ${atributos}>${contenido}</svg>`;
const trazo = '<path d="M10 20H110V170H10Z"/>';

test('los seis originales de Laser conservan su geometría y producen un maestro vectorial aceptado por el taller', async () => {
  assert.equal(Object.keys(ESCUDOS_LASER_YORYO).length, 6);
  for (const [equipo, original] of Object.entries(ESCUDOS_LASER_YORYO)) {
    const archivo = await readFile(new URL(`../../../public${original.url}`, import.meta.url), 'utf8');
    const vector = validarVectorSvg(archivo);
    assert.deepEqual(vector.viewBox, original.viewBox, equipo);
    assert.doesNotMatch(vector.svg, /<(?:image|text|tspan)\b|href=/);
    const arte = crearArteYoryo({ datos: { plantilla: 'escudo', nombre: '', frase: '', equipo, vector }, config: { tecnica: 'laser', proporcion: 1.25, produccion: { medidasConfirmadas: true, anchoMm: 80, altoMm: 100 } } });
    assert.equal(esSvgLaser(arte, 80, 100), true, equipo);
    assert.equal(vectorLaserDeEquipo(equipo, { tecnica: 'laser' }), original);
  }
});

test('la impresión conserva sus propias imágenes y una plantilla administrada puede reemplazar un escudo de catálogo', () => {
  assert.equal(vectorLaserDeEquipo('Alianza Lima', { tecnica: 'impresion' }), null);
  assert.equal(vectorLaserDeEquipo('', { tecnica: 'laser' }), null);
  const propio = { url: 'https://ejemplo.test/escudo-nuevo.svg' };
  assert.equal(vectorLaserDeEquipo('Alianza Lima', { tecnica: 'laser', produccion: { vectoresPorEquipo: { 'Alianza Lima': propio } } }), propio);
});

test('importa escudos con metadatos, defs sin uso y datos de procedencia sin grabarlos', () => {
  const limpio = validarVectorSvg(svg(`<metadata xmlns:fl="https://ejemplo.test">Procedencia</metadata><title>Escudo</title><desc>Vector</desc><defs><path d="M999 999H1000"/></defs>${trazo.replace('/>', ' data-source="https://ejemplo.test"/>')}`, 'fill="#000"'));
  assert.deepEqual(limpio.viewBox, [10, 20, 100, 150]);
  assert.match(limpio.svg, /M10 20H110V170H10Z/);
  assert.doesNotMatch(limpio.svg, /metadata|title|desc|defs|data-source|M999|Procedencia/);
});

test('admite clip-rule y estilos vectoriales, conservando rellenos blancos y herencia', () => {
  const limpio = validarVectorSvg(svg('<path clip-rule="evenodd" style="fill: #fff; stroke: #123456; stroke-width: 2" d="M10 20H110V170Z"/>', 'fill="none" stroke="#222" transform="translate(1 2)"'));
  assert.match(limpio.svg, /clip-rule="evenodd"/);
  assert.match(limpio.svg, /fill="#FFFFFF"/);
  assert.match(limpio.svg, /<g fill="none" stroke="#000000" transform="translate\(1 2\)"/);
  assert.doesNotMatch(limpio.svg, /style=/);
  const nuevamente = validarVectorSvg(limpio.svg);
  assert.equal(nuevamente.svg, limpio.svg);
});

test('la importación corregida produce un maestro de grabado aceptado por el checkout', () => {
  const vector = validarVectorSvg(svg(`<metadata>Editor</metadata>${trazo}`, 'fill="none" stroke="black"'));
  const maestro = crearArteYoryo({ datos: { plantilla: 'escudo', vector, nombre: '', frase: '' }, config: { tecnica: 'laser', proporcion: 1.25, produccion: { anchoMm: 80, altoMm: 100, medidasConfirmadas: true } } });
  assert.equal(esSvgLaser(maestro, 80, 100), true);
  assert.match(maestro, /<g fill="none" stroke="#000000"/);
});

test('sigue rechazando imágenes incrustadas, texto editable y efectos que alteran el grabado', () => {
  assert.throws(() => validarVectorSvg(svg('<image href="data:image/png;base64,AAAA"/>')), /imagen incrustada/);
  assert.throws(() => validarVectorSvg(svg('<text>Daniel</text>')), /texto editable/);
  for (const contenido of ['<script/>', '<foreignObject/>', '<use href="#escudo"/>', trazo.replace('/>', ' fill="url(#fondo)"/>'), trazo.replace('/>', ' onclick="alert(1)"/>'), trazo.replace('/>', ' style="filter:blur(2px)"/>')]) {
    assert.throws(() => validarVectorSvg(svg(contenido)));
  }
  assert.throws(() => validarVectorSvg(svg('<defs><path d="M0 0H10"/></defs>')), /trazos visibles/);
});
