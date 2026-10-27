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
import { transformarSeccionYoryo } from './gestosYoryo.mjs';
import { plantillaParejasBaseYoryo } from './presetsParejasYoryo.mjs';
import { REFERENCIAS_EQUIPOS_YORYO, RECURSOS_PAREJAS_YORYO } from './recursosParejasYoryo.mjs';
import { ajusteSeccion } from './distribucionYoryo.mjs';

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

test('solo el preset del administrador cambia posiciones, orden y estilo de la estructura', () => {
  let datos = aplicarPresetYoryo(inicial('Alianza Lima'), config);
  assert.equal(cambiarSeccion(datos, 'escudo', { x: .3, orden: 7 }), datos);
  assert.equal(cambiarSeccion(datos, 'nombre', { color: '#EECC99', fuente: 'Fuerte' }), datos);
  const preset = structuredClone(datos.plantillaConfig);
  Object.assign(preset.elementos.find((e) => e.id === 'escudo'), { x: .3, y: .26, escala: 80, orden: 7 });
  Object.assign(preset.elementos.find((e) => e.id === 'nombre'), { color: '#EECC99', alineacion: 'izquierda', w: .38, fuente: 'Fuerte' });
  datos = { ...datos, plantillaConfig: preset };
  const guardado = fijarDistribucion(datos, config), reabierto = prepararMockupYoryo(JSON.parse(JSON.stringify(guardado)), config);
  assert.equal(componer(guardado).svg, componer(reabierto).svg);
  assert.equal(componer(guardado).elementos.at(-1).id, 'escudo');
  assert.match(componer(guardado).svg, /#EECC99/);
  assert.equal(guardado.distribucion.elementos.nombre.alineacion, 'izquierda');
});

test('el cliente no altera la estructura mediante ajustes guardados antiguos; sí mueve su foto deportiva', () => {
  const datos = aplicarPresetYoryo(inicial('Barcelona'), config);
  const limpio = componer(datos).svg;
  const alterado = { ...datos, distribucion: { version: 3, elementos: { fondo: { x: -3, escala: 300 }, escudo: { x: .99, orden: 20 }, nombre: { x: .9, fuente: 'Fuerte', color: '#FF0000' } } } };
  assert.equal(componer(alterado).svg, limpio);
  const movido = cambiarSeccion(datos, 'foto', { x: .68, escala: 110, orden: 20, w: .99 });
  assert.deepEqual(movido.distribucion.elementos.foto, { x: .68, escala: 110 });
  assert.notEqual(componer(movido).svg, limpio);
  assert.notEqual(componer({ ...datos, nombre: 'Otro nombre' }).svg, limpio);
});

test('el admin desplaza y escala fuera del lienzo; el maestro conserva las coordenadas y recorta al exportar', () => {
  const datos = aplicarPresetYoryo(inicial('Alianza Lima'), config);
  const fondo = componer(datos).elementos[0];
  const cambio = transformarSeccionYoryo(fondo, { dx: -.7, factor: 1.4, escala: 100, libre: true });
  assert.ok(cambio.x < 0); assert.ok(cambio.w > 1);
  datos.plantillaConfig.elementos[0] = { ...datos.plantillaConfig.elementos[0], x: cambio.centroX, y: cambio.centroY, escala: cambio.escala };
  validarPresetYoryo(datos.plantillaConfig);
  const resultado = componer(datos);
  assert.ok(resultado.elementos[0].x < 0); assert.ok(resultado.elementos[0].w > 1);
  assert.match(resultado.svg, /overflow="hidden"/);
  assert.equal(componer(JSON.parse(JSON.stringify(fijarDistribucion(datos, config)))).svg, resultado.svg);
});

test('las tres parejas usan sus nuevos PNG, conservan ventanas fijas y permiten reemplazar las fotos', async () => {
  for (const modelo of ['dorado', 'floral', 'botanico']) {
    const preset = plantillaParejasBaseYoryo(modelo);
    assert.equal(preset.estructuraFija, true);
    const png = await readFile(new URL(`../../public${RECURSOS_PAREJAS_YORYO[modelo].url}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), preset.recursos.superposicion.size[0]); assert.equal(png[25], 6);
    const datos = aplicarPresetYoryo({ ...inicial(''), plantillaVisual: modelo, plantilla: modelo === 'botanico' ? 'collage' : 'nombre' }, config);
    assert.equal(cambiarSeccion(datos, 'foto', { x: .8, w: .8 }), datos);
    assert.equal(datos.plantillaConfig.elementos.filter((s) => s.indiceFoto !== undefined).length, modelo === 'botanico' ? 3 : 1);
    const foto = datos.plantillaConfig.elementos.find((s) => s.id === 'foto');
    assert.equal(ajusteSeccion({ ...datos, distribucion: { version: 3, elementos: { foto: { x: .9 } } } }, foto).x, foto.x);
  }
});

test('las referencias de los seis equipos se conservan y sus efectos forman parte del SVG y de su caja visible', async () => {
  for (const url of Object.values(REFERENCIAS_EQUIPOS_YORYO)) await readFile(new URL(`../../public${url}`, import.meta.url));
  const datos = aplicarPresetYoryo(inicial('Barcelona'), config);
  const arte = componer(datos);
  assert.match(arte.svg, /fill="#F5D24D"/); assert.match(arte.svg, /feDropShadow/); assert.match(arte.svg, /paint-order="stroke fill"/);
  const sinEfecto = structuredClone(datos);
  Object.assign(sinEfecto.plantillaConfig.elementos.find((e) => e.id === 'nombre'), { sombraOpacidad: 0, contornoAncho: 0 });
  assert.ok(arte.elementos.find((e) => e.id === 'nombre').w > componer(sinEfecto).elementos.find((e) => e.id === 'nombre').w);
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
