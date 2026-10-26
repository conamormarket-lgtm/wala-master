import test from 'node:test';
import assert from 'node:assert/strict';
import { configurarDisenoYoryo, medidasMockupYoryo, prepararMockupYoryo } from './mockupYoryo.mjs';
import { PLANTILLAS_IMPRESION_YORYO, EQUIPOS_YORYO, encajePlantillaYoryo } from './plantillasYoryo.mjs';
import { fijarDistribucion } from './distribucionYoryo.mjs';

test('el marco de cuadro y mousepad sigue la plantilla completa sin bandas ni deformación', () => {
  for (const nombre of ['Cuadro', 'Mousepad']) for (const p of PLANTILLAS_IMPRESION_YORYO) for (const [equipo] of EQUIPOS_YORYO) {
    const datos = { plantillaVisual: p.id, formatoPlantilla: 3, equipo };
    const config = configurarDisenoYoryo({ nombre, tecnica: 'impresion', proporcion: .8 }, datos);
    const encaje = encajePlantillaYoryo(datos, config), m = medidasMockupYoryo(config);
    assert.ok(Math.abs(encaje.x) < 1e-12 && Math.abs(encaje.y) < 1e-12);
    assert.ok(Math.abs(encaje.w - 1) < 1e-12 && Math.abs(encaje.h - 1) < 1e-12);
    assert.ok(Math.abs(m.h / m.w - config.proporcion) < 1e-12);
    assert.equal(m.mousepad, nombre === 'Mousepad');
    assert.equal(m.radio > 0, nombre === 'Mousepad');
  }
});

test('las medidas de fabricación confirmadas y el láser conservan su configuración', () => {
  const confirmado = { nombre: 'Cuadro', tecnica: 'impresion', proporcion: .8, produccion: { anchoMm: 100, altoMm: 80, medidasConfirmadas: true } };
  assert.equal(configurarDisenoYoryo(confirmado, { plantillaVisual: 'floral', formatoPlantilla: 3 }), confirmado);
  const laser = { tecnica: 'laser', proporcion: 1.25 };
  assert.equal(configurarDisenoYoryo(laser, { formatoPlantilla: 3 }), laser);
});

test('al quitar las bandas de un borrador se conservan las posiciones relativas, textos, fotos y escalas', () => {
  const config = { nombre: 'Cuadro', tecnica: 'impresion', proporcion: .8 };
  const datos = { plantilla: 'aniversario', plantillaVisual: 'floral', formatoPlantilla: 2, nombre: 'Isaac', fotos: [{ url: 'foto-del-cliente' }], distribucion: { version: 3, elementos: { nombre: { x: .81, y: .7, w: .3, h: .075, escala: 87, fuente: 'Manuscrita' } } } };
  const antes = encajePlantillaYoryo(datos, config), nuevo = prepararMockupYoryo(datos, config);
  assert.equal(nuevo.formatoPlantilla, 3); assert.equal(datos.formatoPlantilla, 2);
  assert.equal(nuevo.nombre, datos.nombre); assert.equal(nuevo.fotos, datos.fotos);
  const n = nuevo.distribucion.elementos.nombre;
  assert.ok(Math.abs(n.y - (datos.distribucion.elementos.nombre.y - antes.y) / antes.h) < 1e-12);
  assert.equal(n.escala, 87); assert.equal(n.fuente, 'Manuscrita');
  assert.equal(prepararMockupYoryo(nuevo, config), nuevo);
  const guardado = fijarDistribucion(nuevo, configurarDisenoYoryo(config, nuevo));
  assert.deepEqual(prepararMockupYoryo(JSON.parse(JSON.stringify(guardado)), config), guardado);
});

test('un diseño libre y un termo no pierden sus ajustes al abrir el editor', () => {
  const libre = { distribucion: { version: 3, elementos: { nombre: { x: .4, y: .8, escala: 73 } } } };
  assert.deepEqual(prepararMockupYoryo(libre, { tecnica: 'impresion', proporcion: .8 }).distribucion, libre.distribucion);
  assert.equal(prepararMockupYoryo(libre, { tecnica: 'laser' }), libre);
});
