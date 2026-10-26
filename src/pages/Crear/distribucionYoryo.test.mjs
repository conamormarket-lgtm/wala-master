import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import { DOMParser } from '@xmldom/xmldom';
import { componerArteYoryo } from './arteYoryo.mjs';
import { datosYoryoVacios } from '../../utils/yoryoPersonalizacion.mjs';
import { FUENTES_YORYO, areaVistaYoryo, cambiarSeccion, distribucionRecomendada, fijarDistribucion, firmaDeDisenoYoryo, normalizarFirmaYoryo, seccionesYoryo, vistaYoryo } from '../../utils/distribucionYoryo.mjs';
import { serializarTrazos } from './trazosYoryo.mjs';
import { PLANTILLAS_CUADRO, plantillaImpresionYoryo } from '../../utils/plantillasYoryo.mjs';

const fuentes = {};
for (const f of FUENTES_YORYO) {
  const bytes = await readFile(new URL(`../../../public/fonts/${f.archivo}`, import.meta.url));
  fuentes[f.id] = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const config = { tecnica: 'laser', proporcion: 1.25, vista: { x: .32, y: .27, w: .29, h: .30 }, produccion: { anchoMm: 80, altoMm: 100, medidasConfirmadas: true } };
const datos = { ...datosYoryoVacios(), plantilla: 'escudo', nombre: 'Daniel', frase: 'Blanquiazul\nde corazón', vector: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><path d="M0 0H100V140H0Z"/></svg>', viewBox: [0, 0, 100, 140] } };
const componer = (d, c = config) => componerArteYoryo({ datos: d, config: c, fuentes: { escudo: fuentes.Fuerte, nombre: fuentes[d.distribucion?.elementos?.nombre?.fuente || 'Elegante'], frase: fuentes.Manuscrita, fecha: fuentes.Clásica }, fuente: fuentes.Clásica });

test('las plantillas imprimen fondo, fotos, decoración y textos en ese orden', () => {
  const d = { ...datosYoryoVacios(), plantilla: 'equipo', plantillaVisual: 'deportivo', equipo: 'Alianza Lima', nombre: 'Daniel', frase: 'Blanquiazul', dedicatoria: 'Con amor' };
  const { svg, elementos } = componerArteYoryo({ datos: d, config: { tecnica: 'impresion', proporcion: .8 }, fuente: fuentes.Clásica, fotos: ['foto-cliente.png'], plantilla: { fondo: 'fondo-estadio.png', superposicion: 'escudo-delante.png' } });
  assert.ok(svg.indexOf('fondo-estadio.png') < svg.indexOf('foto-cliente.png'));
  assert.ok(svg.indexOf('foto-cliente.png') < svg.indexOf('escudo-delante.png'));
  assert.ok(svg.indexOf('escudo-delante.png') < svg.indexOf('data-yoryo-elemento="nombre"'));
  assert.equal(elementos[0].orden, 1); assert.equal(elementos.at(-1).orden, 3);
  assert.equal(plantillaImpresionYoryo(d).fondo, '/yoryo/cuadros/equipos/alianza_lima_fondo.png');
});

test('cada foto del collage se ajusta y persiste por separado; todas las plantillas conservan posiciones al reabrir', async () => {
  const c = { tecnica: 'impresion', proporcion: .8 };
  for (const p of PLANTILLAS_CUADRO) {
    const d = { ...datosYoryoVacios(), plantilla: p.tipo, plantillaVisual: p.id, nombre: 'Daniel', fecha: '2026', equipo: 'Alianza Lima', fotos: [{ url: 'uno' }, { url: 'dos' }, { url: 'tres' }] };
    let ajustado = cambiarSeccion(d, 'nombre', { x: .64, y: .6, escala: 73, fuente: 'Manuscrita' });
    if (p.id === 'botanico') ajustado = cambiarSeccion(ajustado, 'foto2', { x: .23, y: .56, escala: 85 });
    const guardado = fijarDistribucion(ajustado, c), reabierto = JSON.parse(JSON.stringify(guardado));
    assert.deepEqual(componer(guardado, c).elementos, componer(reabierto, c).elementos);
    if (p.id === 'botanico') { assert.equal(seccionesYoryo(guardado, c).filter((s) => s.indiceFoto !== undefined).length, 3); assert.equal(guardado.distribucion.elementos.foto2.escala, 85); assert.equal(guardado.distribucion.elementos.foto.escala, 100); }
    const imagen = p.id === 'deportivo' ? plantillaImpresionYoryo(d).fondo : p.imagen;
    assert.ok((await readFile(new URL(`../../../public${imagen}`, import.meta.url))).length > 1000);
  }
});

test('la distribución recomendada aprovecha el área y da letras independientes al nombre y la frase', () => {
  const { svg, elementos } = componer(datos);
  assert.equal(elementos.length, 3);
  assert.ok(elementos.find((e) => e.id === 'nombre').w > .8);
  assert.ok(elementos.find((e) => e.id === 'escudo').h >= .54);
  assert.match(svg, /width="80mm" height="100mm"/);
  assert.doesNotMatch(svg, /<text|<image|clip-path/);
  const distinto = componer(cambiarSeccion(datos, 'nombre', { fuente: 'Fuerte', escala: 70 }));
  const elementosSvg = (s) => new DOMParser().parseFromString(s, 'image/svg+xml').getElementsByTagName('g');
  const frase = (s) => Array.from(elementosSvg(s)).find((g) => g.getAttribute('data-yoryo-elemento') === 'frase').toString();
  assert.equal(frase(svg), frase(distinto.svg));
  assert.notEqual(svg, distinto.svg);
  const automatico = componer({ ...datos, frase: 'Blanquiazul de corazón' });
  const fraseAutomatica = Array.from(elementosSvg(automatico.svg)).find((g) => g.getAttribute('data-yoryo-elemento') === 'frase');
  assert.equal(fraseAutomatica.getElementsByTagName('path').length, 2);
});

test('los tamaños, posiciones y letras resueltos se guardan juntos y no cambian al reabrir', () => {
  const guardado = fijarDistribucion(datos, config);
  assert.equal(guardado.distribucion.elementos.nombre.fuente, 'Elegante');
  assert.equal(guardado.distribucion.elementos.frase.fuente, 'Manuscrita');
  assert.equal(guardado.distribucion.elementos.nombre.h, .12);
  assert.deepEqual(fijarDistribucion(guardado, config), guardado);
  assert.equal(componer(guardado).svg, componer(datos).svg);
  assert.deepEqual(datos.distribucion.elementos, {});
  const reordenado = (obj) => Array.isArray(obj) ? obj.map(reordenado) : obj && typeof obj === 'object' ? Object.fromEntries(Object.keys(obj).sort().reverse().map((k) => [k, reordenado(obj[k])])) : obj;
  assert.equal(firmaDeDisenoYoryo(guardado, config.produccion), firmaDeDisenoYoryo(reordenado(guardado), reordenado(config.produccion)));
  assert.equal(normalizarFirmaYoryo(JSON.stringify({ datos: guardado, medidas: config.produccion })), firmaDeDisenoYoryo(guardado, config.produccion));
});

test('mover o agrandar no permite sacar la geometría del área ni deformar el escudo', () => {
  let cambiados = datos;
  for (const id of ['escudo', 'nombre', 'frase']) cambiados = cambiarSeccion(cambiados, id, { x: -10, y: 20, escala: 900 });
  const { elementos } = componer(cambiados);
  for (const e of elementos) {
    assert.ok(e.x >= .01999 && e.y >= .01999);
    assert.ok(e.x + e.w <= .98001 && e.y + e.h <= .98001);
  }
  const escudo = elementos.find((e) => e.id === 'escudo');
  assert.ok(Math.abs(escudo.w / (escudo.h * config.proporcion) - 100 / 140) < .0001);
  assert.equal(datos.distribucion.elementos.nombre, undefined);
});

test('nombres y frases largos se encajan sin recortar trazos; las fotos también quedan delimitadas', () => {
  const largos = componer({ ...datos, nombre: 'María José Fernández del Castillo y de la Vega', frase: 'Siempre blanquiazul de corazón, juntos en cada momento de nuestras vidas, con mucho cariño para ti y para toda nuestra familia.' });
  for (const e of largos.elementos) assert.ok(e.w > 0 && e.h > 0 && e.x + e.w <= .98001 && e.y + e.h <= .98001);
  const cuadro = componer({ ...datos, plantilla: 'collage', fotos: [], distribucion: distribucionRecomendada() }, { ...config, tecnica: 'impresion', proporcion: .8 });
  assert.ok(cuadro.elementos.some((e) => e.id === 'foto'));
  assert.match(cuadro.svg, /data-yoryo-elemento="nombre"/);
});

test('los diseños anteriores conservan distribución, tipografía y encuadre hasta elegir la nueva', () => {
  const anterior = { ...datos }; delete anterior.distribucion;
  assert.equal(vistaYoryo(config, anterior), config.vista);
  assert.equal(componer(anterior).elementos.length, 0);
  assert.doesNotMatch(componer(anterior).svg, /data-yoryo-elemento/);
  const area = areaVistaYoryo(config, datos);
  const vista = vistaYoryo(config, datos);
  assert.ok(area.x >= vista.x && area.y >= vista.y && area.x + area.w <= vista.x + vista.w + .00001);
  assert.ok(Math.abs(area.h * 4 / 3 / area.w - config.proporcion) < .0001);
  const primeraVersion = { ...datos, distribucion: { version: 2, elementos: {} } };
  assert.equal(seccionesYoryo(primeraVersion, config).find((e) => e.id === 'nombre').y, .72);
  assert.equal(fijarDistribucion(primeraVersion, config).distribucion.version, 2);
});

test('todas las letras conservan sus contornos, incluso con errores de precisión decimal de OpenType', () => {
  for (const font of Object.values(fuentes)) {
    const path = font.getPath('DANIEL María José 2026', 0, 0, 100);
    const d = serializarTrazos(path);
    assert.doesNotMatch(d, /NaN|Infinity|undefined/);
    assert.equal((d.match(/[MLQCZ]/g) || []).length, path.commands.length);
  }
  assert.equal(serializarTrazos({ commands: [{ type: 'M', x: 80.00000000000001, y: -1 }] }), 'M80 -1');
});

test('mover una sección reutiliza sus trazos y solo cambia la posición del maestro', () => {
  const original = fuentes.Elegante.getPath;
  let llamadas = 0;
  fuentes.Elegante.getPath = function (...args) { llamadas++; return original.apply(this, args); };
  try {
    const inicio = { ...datos, nombre: 'Valentina' }, antes = componer(inicio), trasTrazar = llamadas;
    assert.ok(trasTrazar > 0);
    const despues = componer(cambiarSeccion(inicio, 'nombre', { x: .48, y: .6 }));
    assert.equal(llamadas, trasTrazar);
    assert.equal(antes.elementos.find((e) => e.id === 'nombre').fragmento, despues.elementos.find((e) => e.id === 'nombre').fragmento);
    assert.notEqual(antes.svg, despues.svg);
  } finally { fuentes.Elegante.getPath = original; }
});
