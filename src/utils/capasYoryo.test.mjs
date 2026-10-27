import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import { aplicarPresetYoryo, clavePlantillaYoryo, dimensionesExportacionYoryo, plantillaCapasBaseYoryo, validarPresetYoryo, resolucionFondoYoryo } from './capasYoryo.mjs';
import { RECURSOS_CAPAS_YORYO } from './recursosCapasYoryo.mjs';
import { EQUIPOS_YORYO } from './plantillasYoryo.mjs';
import { FUENTES_YORYO, cambiarSeccion, fijarDistribucion } from './distribucionYoryo.mjs';
import { componerArteYoryo } from '../pages/Crear/arteYoryo.mjs';
import { configurarDisenoYoryo, prepararMockupYoryo } from './mockupYoryo.mjs';
import { establecerPppPng } from './resolucionPng.mjs';

const fuentes = {};
for (const f of FUENTES_YORYO) {
  const bytes = await readFile(new URL(`../../public/fonts/${f.archivo}`, import.meta.url));
  fuentes[f.id] = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const config = { nombre: 'Cuadro', tecnica: 'impresion', proporcion: 250 / 310, produccion: { medidasConfirmadas: true, anchoMm: 310, altoMm: 250 } };
const inicial = (equipo) => ({ plantillaVisual: 'deportivo', plantilla: 'equipo', formatoPlantilla: 3, equipo, nombre: 'Daniel', frase: 'Mi equipo, mi pasión', dedicatoria: 'Con todo mi amor', fotos: [{ url: 'cliente.png' }], distribucion: { version: 3, elementos: {} } });
const componer = (datos, c = config) => componerArteYoryo({ datos, config: c, fuentes: Object.fromEntries(datos.plantillaConfig.elementos.filter((e) => e.fuente).map((e) => [e.id, fuentes[e.fuente]])), fotos: ['cliente.png'], plantilla: { capas: datos.plantillaConfig.recursos } });

test('18 PNG normalizados conservan alfa y los escudos tienen lienzo 1000 × 1400', async () => {
  assert.equal(Object.keys(RECURSOS_CAPAS_YORYO).length, 6);
  for (const recursos of Object.values(RECURSOS_CAPAS_YORYO)) for (const [tipo, r] of Object.entries(recursos)) {
    const png = await readFile(new URL(`../../public${r.url}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), r.size[0]); assert.equal(png.readUInt32BE(20), r.size[1]);
    assert.equal(png[25], 6); // PNG RGBA, sin aplanar el fondo transparente.
    if (tipo === 'escudo') { assert.deepEqual(r.size, [1000, 1400]); assert.equal(r.alphaRange[0], 0); }
    await readFile(new URL(`../../${r.original}`, import.meta.url));
  }
});

test('los seis equipos dibujan las siete capas en orden y calculan el escudo por su tinta visible', () => {
  for (const [equipo] of EQUIPOS_YORYO) {
    const datos = aplicarPresetYoryo(inicial(equipo), config), arte = componer(datos);
    assert.equal(datos.formatoPlantilla, 4);
    assert.deepEqual(arte.elementos.map((e) => e.id), ['fondo', 'foto', 'escudo', 'nombre', 'frase', 'pincelada', 'dedicatoria']);
    const escudo = arte.elementos.find((e) => e.id === 'escudo'), r = datos.plantillaConfig.recursos.escudo;
    assert.ok(Math.abs(escudo.w / (escudo.h * config.proporcion) - r.size[0] * r.visible[2] / (r.size[1] * r.visible[3])) < 1e-8);
    assert.match(escudo.fragmento, /viewBox=/); assert.match(arte.elementos[1].fragmento, /xMidYMid meet/);
    assert.match(arte.elementos[0].fragmento, /xMidYMid slice/);
    assert.doesNotMatch(arte.svg, /<text\b/); // Exportación independiente de fuentes del navegador.
  }
});

test('presets independientes por equipo/producto y copia del diseño inmutable tras cambios del admin', () => {
  const base = inicial('Alianza Lima'), preset = plantillaCapasBaseYoryo('Alianza Lima');
  preset.elementos.find((e) => e.id === 'nombre').x = .31;
  const presets = { [preset.clave]: preset };
  const datos = aplicarPresetYoryo(base, config, presets), svg = componer(datos).svg;
  presets[preset.clave].elementos[2].w = .6;
  const reabierto = aplicarPresetYoryo(JSON.parse(JSON.stringify(datos)), config, presets);
  assert.equal(componer(reabierto).svg, svg);
  assert.notEqual(clavePlantillaYoryo(base, config), clavePlantillaYoryo(base, { ...config, nombre: 'Mousepad' }));
  const otro = aplicarPresetYoryo({ ...datos, equipo: 'Barcelona' }, config, presets);
  assert.equal(otro.plantillaConfig.equipo, 'Barcelona');
  const raton = aplicarPresetYoryo(base, { ...config, nombre: 'Mousepad' }, presets);
  assert.notDeepEqual(raton.plantillaConfig.elementos, datos.plantillaConfig.elementos);
});

test('mover, escalar, ordenar y cambiar estilo persiste y reproduce el mismo archivo al reabrir', () => {
  let datos = aplicarPresetYoryo(inicial('Alianza Lima'), config);
  datos = cambiarSeccion(datos, 'escudo', { x: .3, y: .26, escala: 80, orden: 7 });
  datos = cambiarSeccion(datos, 'nombre', { color: '#EECC99', alineacion: 'izquierda', w: .38, fuente: 'Fuerte' });
  const guardado = fijarDistribucion(datos, config), reabierto = prepararMockupYoryo(JSON.parse(JSON.stringify(guardado)), config);
  assert.equal(componer(guardado).svg, componer(reabierto).svg);
  assert.equal(componer(guardado).elementos.at(-1).id, 'escudo');
  assert.match(componer(guardado).svg, /#EECC99/);
  assert.equal(guardado.distribucion.elementos.nombre.alineacion, 'izquierda');
});

test('exporta el cuadro a 3661 × 2953 y el mousepad a 2776 × 2303, sin depender de la vista', () => {
  const datos = aplicarPresetYoryo(inicial('Alianza Lima'), config);
  const c = configurarDisenoYoryo({ ...config, proporcion: 2 / 3 }, datos);
  assert.equal(c.proporcion, 250 / 310);
  assert.deepEqual(dimensionesExportacionYoryo(datos, {}), { ancho: 3661, alto: 2953, anchoMm: 310, altoMm: 250 });
  assert.deepEqual(dimensionesExportacionYoryo(datos, { nombre: 'Mousepad' }), { ancho: 2776, alto: 2303, anchoMm: 235, altoMm: 195 });
  assert.equal(resolucionFondoYoryo(datos, config), 114);
});

test('rechaza presets corruptos y registra una única resolución de 300 ppp en el PNG', async () => {
  const preset = plantillaCapasBaseYoryo(); validarPresetYoryo(preset);
  const invalido = structuredClone(preset); invalido.elementos[0].w = NaN;
  assert.throws(() => validarPresetYoryo(invalido), /posición/);
  const original = await readFile(new URL('../../public/yoryo/capas/equipos/alianza_lima/02_ESCUDO.png', import.meta.url));
  let png = new Uint8Array(await (await establecerPppPng(new Blob([original]))).arrayBuffer());
  png = new Uint8Array(await (await establecerPppPng(new Blob([png]))).arrayBuffer());
  let pos = 8, encontrados = 0;
  while (pos < png.length) {
    const len = new DataView(png.buffer, pos, 4).getUint32(0), tipo = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    if (tipo === 'pHYs') { encontrados++; assert.equal(new DataView(png.buffer, pos + 8, 4).getUint32(0), 11811); assert.equal(png[pos + 16], 1); }
    pos += 12 + len;
  }
  assert.equal(encontrados, 1);
});
