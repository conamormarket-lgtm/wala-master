import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { recomendarRegalos, palabrasClave, sugerenciasRespuestas, normalizar } from './giftRecommender.mjs';

const require = createRequire(import.meta.url);
const servidor = require('../../functions/giftLogic.js');

// Catálogo de prueba con IDs de etiquetas/personajes/colecciones, como en producción.
const dicts = {
  tags: { t1: 'Alianza Lima', t2: 'Demon Slayer', t3: 'Parejas', t4: 'Fútbol', t5: 'nezuko' },
  characters: { c1: 'Nezuko Kamado', c2: 'Paolo Guerrero' },
  collections: { k1: 'Fútbol peruano', k2: 'Anime' },
};
const productos = [
  { id: 'al1', name: 'Casaca Alianza Lima · Soy Grone', tags: ['t1', 't4'], characters: [], collections: ['k1'], categories: ['casacas'], price: 120, inStock: 5 },
  { id: 'al2', name: 'Casaca Blanquiazul', tags: ['t1'], characters: ['c2'], categories: ['casacas'], price: 110, inStock: 3 },
  { id: 'ds1', name: 'Casaca Demon Slayer · Tanjiro', tags: ['t2'], collections: ['k2'], categories: ['casacas'], price: 109, inStock: 4 },
  { id: 'ds2', name: 'Casaca Nezuko Fucsia', tags: ['t2', 't5'], characters: ['c1'], categories: ['casacas'], price: 109, inStock: 4 },
  { id: 'par', name: 'Set Yoryo Alianza · Él & Ella', tags: ['t3'], categories: ['relojes'], price: 240, inStock: 4 },
  { id: 'oculto', name: 'Casaca Alianza Lima vieja', tags: ['t1'], visible: false, price: 50, inStock: 1 },
  { id: 'agotado', name: 'Polo Alianza Lima', tags: ['t1'], price: 49, inStock: 0 },
  { id: 'taza', name: 'Taza mágica', tags: [], categories: ['tazas'], price: 30, inStock: 9 },
];
const persona = (extra) => ({ roleKey: 'amigos', gender: 'Masculino', events: [], ...extra });

test('recomienda por lo que respondió (equipo, jugador) y explica por qué', () => {
  const r = recomendarRegalos({
    recipient: persona({ categoryAnswers: { cat_deportes: { q1: 'Futbol', q2: 'Alianza Lima', q3: 'Guerrero' } } }),
    productos, dicts,
  });
  assert.deepEqual(r.map((x) => x.producto.id).slice(0, 2).sort(), ['al1', 'al2']);
  assert.match(r[0].motivo, /Alianza Lima|Guerrero/);
  assert.ok(!r.some((x) => ['oculto', 'agotado'].includes(x.producto.id)), 'no recomienda ocultos ni agotados');
});

test('el personaje pesa más que solo la serie', () => {
  const r = recomendarRegalos({
    recipient: persona({ categoryAnswers: { cat_geek: { q1: 'Demon slayer', q2: 'Nezuko' } } }),
    productos, dicts,
  });
  assert.equal(r[0].producto.id, 'ds2');
  assert.equal(r[1].producto.id, 'ds1');
});

test('pareja / aniversario sube los productos "Parejas" / "Él & Ella"', () => {
  const r = recomendarRegalos({ recipient: persona({ roleKey: 'pareja' }), productos, dicts });
  assert.equal(r[0].producto.id, 'par');
  assert.equal(r[0].motivo, 'Para regalar en pareja');
});

test('conjunto ligado a categorías de la tienda', () => {
  const r = recomendarRegalos({
    recipient: persona({ selectedCategories: ['cat_hogar'] }), productos, dicts,
    conjuntoCategorias: { cat_hogar: ['tazas'] },
  });
  assert.deepEqual(r.map((x) => x.producto.id), ['taza']);
});

test('presupuesto: lo caro baja y deja de aparecer si no hay otra señal fuerte', () => {
  const r = recomendarRegalos({ recipient: persona({ roleKey: 'pareja', budget: 'hasta50' }), productos, dicts });
  assert.ok(!r.some((x) => x.producto.id === 'par'));
});

test('excluye lo ya comprado y sin señales no inventa', () => {
  const r = recomendarRegalos({
    recipient: persona({ categoryAnswers: { g: { q: 'Alianza Lima' } } }), productos, dicts, excluir: new Set(['al1', 'al2']),
  });
  assert.ok(!r.some((x) => ['al1', 'al2'].includes(x.producto.id)));
  assert.deepEqual(recomendarRegalos({ recipient: persona({}), productos, dicts }), []);
});

test('sin respuestas, usa lo etiquetado "Para regalar" como respaldo', () => {
  const conRegalo = [...productos, { id: 'reg', name: 'Taza personalizada', tags: ['t9'], price: 35, inStock: 10 }];
  const r = recomendarRegalos({ recipient: persona({}), productos: conRegalo, dicts: { ...dicts, tags: { ...dicts.tags, t9: 'Para regalar' } } });
  assert.deepEqual(r.map((x) => x.producto.id), ['reg']);
  assert.equal(r[0].motivo, 'Ideal para regalar');
});

test('palabras clave sin relleno y normalizadas', () => {
  assert.deepEqual(palabrasClave('Del universitario deportes y del Barza'), ['universitario', 'barza']);
  assert.equal(normalizar('Fútbol  Perú!'), 'futbol peru');
});

test('sugerencias para autocompletar salen de etiquetas, personajes y colecciones', () => {
  const s = sugerenciasRespuestas(dicts);
  assert.ok(s.includes('Alianza Lima') && s.includes('Nezuko Kamado') && s.includes('Fútbol peruano'));
});

test('la copia del servidor (functions/giftLogic.js) da exactamente lo mismo', () => {
  const casos = [
    persona({ categoryAnswers: { a: { q: 'Alianza Lima' } } }),
    persona({ categoryAnswers: { b: { q: 'Demon slayer', r: 'Nezuko' } }, gender: 'Femenino' }),
    persona({ roleKey: 'pareja', budget: '100a200' }),
  ];
  for (const recipient of casos) {
    const web = recomendarRegalos({ recipient, productos, dicts }).map((x) => [x.producto.id, x.score, x.motivo]);
    const srv = servidor.recomendarRegalos({ recipient, productos, dicts }).map((x) => [x.producto.id, x.score, x.motivo]);
    assert.deepEqual(srv, web);
  }
});
