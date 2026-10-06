import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { recomendarRegalos, palabrasClave, sugerenciasRespuestas, normalizar, sugerenciasPorCampo, publicoDe, edadDe, equipoDe, edadMinimaDe } from './giftRecommender.mjs';

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

test('aniversario sube los productos "Parejas" / "Él & Ella"; sin ocasión romántica, un conjunto de pareja solo no alcanza', () => {
  const r = recomendarRegalos({ recipient: persona({ roleKey: 'pareja' }), productos, dicts, ocasion: 'Aniversario' });
  assert.equal(r[0].producto.id, 'par');
  assert.equal(r[0].motivo, 'Para regalar en pareja');
  assert.equal(r[0].tipo, 'gusto');
  assert.deepEqual(recomendarRegalos({ recipient: persona({ roleKey: 'pareja' }), productos, dicts, ocasion: 'Cumpleaños' }), []);
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
  const conRegalo = [...productos, { id: 'reg', name: 'Taza personalizada', tags: ['t9'], publico: 'unisex', price: 35, inStock: 10 }];
  const r = recomendarRegalos({ recipient: persona({}), productos: conRegalo, dicts: { ...dicts, tags: { ...dicts.tags, t9: 'Para regalar' } } });
  assert.deepEqual(r.map((x) => x.producto.id), ['reg']);
  assert.equal(r[0].motivo, 'Ideal para regalar');
});

test('variedad: no más de 2 por el mismo motivo ni de la misma marca', () => {
  const muchos = [
    ...['a', 'b', 'c', 'd'].map((x) => ({ id: `sp${x}`, name: `Polo Spider-Man ${x}`, tags: [], price: 80, inStock: 5 })),
    { id: 'par2', name: 'Conjunto Parejas Dragon Ball', tags: [], price: 90, inStock: 5 },
    ...['1', '2', '3'].map((x) => ({ id: `rel${x}`, name: `Reloj para regalo ${x}`, tags: [], brandId: 'yoryo', publico: 'hombre', price: 90, inStock: 5 })),
  ];
  const r = recomendarRegalos({ recipient: persona({ roleKey: 'pareja', categoryAnswers: { g: { q: 'Spider Man' } } }), productos: muchos, ocasion: 'Aniversario' });
  const spider = r.filter((x) => x.producto.id.startsWith('sp')).length;
  assert.equal(spider, 2);
  assert.equal(r[2].producto.id, 'par2', 'en un aniversario, después de 2 de Spider-Man viene lo de pareja, no lo genérico');
  const cumple = recomendarRegalos({ recipient: persona({ roleKey: 'pareja', categoryAnswers: { g: { q: 'Spider Man' } } }), productos: muchos });
  assert.deepEqual(cumple.map((x) => x.tipo), ['gusto', 'gusto', 'general', 'general'], 'después de sus gustos, como mucho 2 genéricas');
  const conOtras = [...muchos, ...['x', 'y'].map((x) => ({ id: `taza${x}`, name: `Taza para regalo ${x}`, tags: [], brandId: 'otra', publico: 'unisex', price: 40, inStock: 5 }))];
  const sinGustos = recomendarRegalos({ recipient: persona({}), productos: conOtras });
  assert.equal(sinGustos.length, 4);
  assert.equal(sinGustos.filter((x) => x.producto.brandId === 'yoryo').length, 2);
});

test('lo de pareja no se recomienda a un hermano, y lo muy caro no entra', () => {
  const ps = [
    { id: 'parSp', name: 'Conjunto Pareja · Spider-Man', tags: [], price: 90, inStock: 5 },
    { id: 'casSp', name: 'Casaca Spider-Man', tags: [], price: 95, inStock: 5 },
    { id: 'caroSp', name: 'Polera Spider-Man edición especial', tags: [], price: 188, inStock: 5 },
  ];
  const r = recomendarRegalos({
    recipient: persona({ roleKey: 'hermanos', budget: '50a100', categoryAnswers: { g: { q: 'Spider-Man' } } }), productos: ps,
  });
  assert.equal(r[0].producto.id, 'casSp');
  assert.ok(!r.some((x) => x.producto.id === 'caroSp'), 'S/ 188 no entra en S/ 50–100');
  const idx = r.findIndex((x) => x.producto.id === 'parSp');
  assert.ok(idx === -1 || idx > 0);
});

test('"para quién es": un reloj de hombre no se recomienda a una mujer', () => {
  const ps = [
    { id: 'relH', name: 'Reloj Yoryo Titán', tags: ['t9'], publico: 'hombre', price: 90, inStock: 5 },
    { id: 'relM', name: 'Reloj Yoryo Perla', tags: ['t9'], publico: 'mujer', price: 90, inStock: 5 },
    { id: 'kids', name: 'Polo para regalo infantil', tags: ['t9'], publico: 'ninos', price: 40, inStock: 5 },
  ];
  const d = { ...dicts, tags: { ...dicts.tags, t9: 'Para regalar' } };
  const ella = recomendarRegalos({ recipient: persona({ gender: 'Femenino', roleKey: 'pareja' }), productos: ps, dicts: d }).map((x) => x.producto.id);
  assert.deepEqual(ella, ['relM']);
  const sobrino = recomendarRegalos({ recipient: persona({ gender: 'Masculino', roleKey: 'sobrinos' }), productos: ps, dicts: d }).map((x) => x.producto.id);
  assert.ok(sobrino.includes('kids') && !sobrino.includes('relM'));
  assert.equal(publicoDe({ name: 'Polo dama floral' }), 'mujer');
  assert.equal(publicoDe({ name: 'Set Él & Ella' }), null);
});

test('"Fútbol" solo no recomienda productos de cualquier equipo', () => {
  const r = recomendarRegalos({
    recipient: persona({ categoryAnswers: { d: { q1: 'Fútbol', q2: 'Alianza Lima' } } }), productos, dicts,
  });
  assert.ok(r.every((x) => x.motivo !== 'Le gusta Fútbol'));
});

test('sugerencias por pregunta: equipos, jugadores o deporte según lo que se pregunta', () => {
  const ps = [
    { id: 'a', name: 'Casaca A', tags: ['t1', 't4'], characters: ['c2'], collections: ['k1'], inStock: 1 },
    { id: 'u', name: 'Casaca U', tags: ['tu', 't4'], characters: [], inStock: 1 },
    { id: 'n', name: 'Casaca N', tags: ['t2', 't5'], characters: ['c1'], collections: ['k2'], inStock: 1 },
  ];
  const d = { ...dicts, tags: { ...dicts.tags, tu: 'Universitario' } };
  const dep = { id: 'cat_deportes', name: 'Deportes' };
  const equipos = sugerenciasPorCampo({ conjunto: dep, field: { label: '¿De qué equipo es hincha?' }, productos: ps, dicts: d });
  assert.deepEqual(equipos.sort(), ['Alianza Lima', 'Universitario']);
  const jugadores = sugerenciasPorCampo({ conjunto: dep, field: { label: '¿Jugador favorito?' }, productos: ps, dicts: d });
  assert.deepEqual(jugadores, ['Paolo Guerrero']);
  const deporte = sugerenciasPorCampo({ conjunto: dep, field: { label: '¿Cuál es su deporte favorito?' }, productos: ps, dicts: d });
  assert.ok(deporte.includes('Fútbol'));
  const geek = sugerenciasPorCampo({ conjunto: { id: 'cat_geek', name: 'Geek' }, field: { label: '¿Anime o franquicia favorita?' }, productos: ps, dicts: d });
  assert.ok(geek.includes('Demon Slayer') && !geek.includes('Alianza Lima'));
});

test('apagar un conjunto deja de usar sus respuestas (aunque sigan guardadas)', () => {
  const base = { categoryAnswers: { cat_geek: { q: 'Demon slayer' }, cat_dep: { q: 'Alianza Lima' } } };
  const soloDep = recomendarRegalos({ recipient: persona({ ...base, selectedCategories: ['cat_dep'] }), productos, dicts });
  assert.ok(soloDep.every((x) => !x.producto.id.startsWith('ds')));
  const ninguno = recomendarRegalos({ recipient: persona({ ...base, selectedCategories: [] }), productos, dicts });
  assert.ok(ninguno.every((x) => !/^(ds|al)/.test(x.producto.id)));
});

test('sin marca de "para quién es", un producto no entra como idea genérica para ella', () => {
  const ps = [
    { id: 'relSin', name: 'Reloj Yoryo Expedición', tags: ['t9'], price: 80, inStock: 5 },
    { id: 'colM', name: 'Collar Luna', tags: ['t9'], publico: 'mujer', price: 70, inStock: 5 },
  ];
  const d = { ...dicts, tags: { ...dicts.tags, t9: 'Para regalar' } };
  const r = recomendarRegalos({ recipient: persona({ gender: 'Femenino' }), productos: ps, dicts: d }).map((x) => x.producto.id);
  assert.deepEqual(r, ['colM']);
  const sinGenero = recomendarRegalos({ recipient: persona({ gender: 'Otro' }), productos: ps, dicts: d }).map((x) => x.producto.id);
  assert.equal(sinGenero.length, 2);
});

// ── Casos reales del diagnóstico (2026-10-06) ──────────────────────────────
const real = {
  dicts: {
    tags: { f: 'Fútbol', al: 'Alianza Lima', u: 'Universitario', ds: 'Demon Slayer', bc: 'Black Clover', db: 'Dragon Ball', pr: 'Para regalar', re: 'Reloj', le: 'Lentes', hu: 'Humor', par: 'Parejas', ni: 'Niños' },
    characters: { gk: 'Goku', pg: 'Paolo Guerrero', zt: 'Zenitsu Agatsuma', as: 'Asta' },
    collections: { fp: 'Fútbol peruano', an: 'Anime' },
  },
  productos: [
    { id: 'alGoku', name: 'Casaca Alianza Lima · Goku Blanquiazul', tags: ['f', 'al'], characters: ['gk'], collections: ['fp'], price: 109, inStock: 3 },
    { id: 'alGuerrero', name: 'Casaca Alianza Lima · Guerrero 34', tags: ['f', 'al'], characters: ['pg'], collections: ['fp'], price: 109, inStock: 3 },
    { id: 'uPolo', name: 'Polo Universitario · 100 Años', tags: ['f', 'u'], price: 45, inStock: 3 },
    { id: 'dbGoku', name: 'Casaca Dragon Ball · Goku Ultra Instinto', tags: ['db'], characters: ['gk'], collections: ['an'], price: 109, inStock: 3 },
    { id: 'dsZen', name: 'Casaca Demon Slayer · Zenitsu Thunder', tags: ['ds'], characters: ['zt'], collections: ['an'], price: 109, inStock: 3 },
    { id: 'bcAsta', name: 'Casaca Black Clover · Asta Demonio', tags: ['bc'], characters: ['as'], collections: ['an'], price: 109, inStock: 3 },
    { id: 'setAlianza', name: 'Set Yoryo Alianza · Él & Ella', tags: ['re', 'pr'], publico: 'unisex', price: 240, inStock: 3 },
    { id: 'reloj', name: 'Reloj Yoryo Titán', tags: ['re', 'pr'], publico: 'hombre', price: 90, inStock: 3 },
    { id: 'lentes', name: 'Lentes Yoryo Imperial', tags: ['le', 'pr'], price: 120, inStock: 3 },
    { id: 'poloHumor', name: 'Polo Solo Vine a Ver', tags: ['hu'], description: 'Para el que siempre llega con sus lentes oscuros.', price: 45, inStock: 3 },
    { id: 'parBB', name: 'Conjunto Pareja · Bella y Bestia', tags: ['par'], price: 188, inStock: 3 },
    { id: 'kids', name: 'Casaca para niños', tags: ['ni', 'pr'], publico: 'ninos', price: 60, inStock: 3 },
  ],
};
const ids = (r) => r.map((x) => x.producto.id);
const recReal = (extra, opts = {}) => recomendarRegalos({ recipient: persona(extra), ...real, hoy: new Date(2026, 9, 6), ...opts });

test('"La U" / "De la u" es Universitario, y el motivo usa el nombre del catálogo', () => {
  const r = recReal({ categoryAnswers: { d: { q: 'De la u' } } });
  assert.equal(r[0].producto.id, 'uPolo');
  assert.equal(r[0].motivo, 'Le gusta Universitario');
});

test('equipos: nada de otro club, ni "Alianza" en productos que no son de fútbol', () => {
  const goku = ids(recReal({ categoryAnswers: { g: { q: 'Goku' } } }));
  assert.ok(goku.includes('dbGoku') && !goku.includes('alGoku'), 'a un fan de Goku no se le da la casaca de Alianza');
  const crema = ids(recReal({ categoryAnswers: { d: { q: 'Universitario' }, g: { q: 'Goku' } } }));
  assert.ok(!crema.includes('alGoku'), 'menos a un hincha de la U');
  const grone = ids(recReal({ categoryAnswers: { d: { q: 'Alianza' }, g: { q: 'Goku' } } }));
  assert.equal(grone[0], 'alGoku', 'al hincha de Alianza que ama a Goku, sí y primero');
  const r = recReal({ categoryAnswers: { d: { q: 'Alianza' } } });
  assert.ok(r.every((x) => x.producto.id !== 'setAlianza' || x.tipo === 'general'), '"Set Yoryo Alianza" no es por su equipo');
  assert.ok(ids(recReal({ categoryAnswers: { d: { q: 'Paolo Guerrero' } } })).includes('alGuerrero'), 'su ídolo cuenta como su club');
});

test('errores de tipeo y palabras sueltas: "Zenitzu" sí, "Demon" no es "Demonio"', () => {
  assert.equal(recReal({ categoryAnswers: { g: { q: 'Zenitzu' } } })[0].producto.id, 'dsZen');
  assert.ok(!ids(recReal({ categoryAnswers: { g: { q: 'Demon slayer' } } })).includes('bcAsta'));
});

test('lo que solo dice la descripción no basta ("Lentes" no es un polo de humor)', () => {
  const r = ids(recReal({ categoryAnswers: { a: { q: 'Lentes' } } }));
  assert.equal(r[0], 'lentes');
  assert.ok(!r.includes('poloHumor'));
});

test('niños: sin relojes, lentes, parejas ni humor; como idea genérica, solo lo de niños', () => {
  const nino = { roleKey: 'hijos', events: [{ type: 'Cumpleaños', date: '2018-03-10' }] };
  assert.deepEqual(ids(recReal({ ...nino, categoryAnswers: { d: { q: 'Real Madrid' } } })), ['kids']);
  const adulto = { roleKey: 'hijos', events: [{ type: 'Cumpleaños', date: '1995-03-10' }] };
  const r = recReal({ ...adulto, categoryAnswers: { d: { q: 'Real Madrid' } } });
  assert.ok(r.length <= 2 && r.every((x) => x.tipo === 'general'), 'adulto sin producto de su gusto: como mucho 2 genéricas');
  assert.ok(!ids(r).includes('kids'));
  assert.equal(edadDe({ events: [{ type: 'Cumpleaños', date: '2026-12-01' }] }, new Date(2026, 9, 6)), null, 'el año de la próxima fecha no es su edad');
});

test('club nuevo sin tocar código: etiqueta "Fútbol" + la del equipo (o el campo equipo)', () => {
  const d = { tags: { f: 'Fútbol', bj: 'Boca Juniors', db: 'Dragon Ball' }, characters: { gk: 'Goku' } };
  const ps = [
    { id: 'bocaGoku', name: 'Casaca Boca · Goku', tags: ['f', 'bj'], characters: ['gk'], price: 109, inStock: 3 },
    { id: 'dbGoku', name: 'Casaca Dragon Ball · Goku', tags: ['db'], characters: ['gk'], price: 109, inStock: 3 },
    { id: 'garci', name: 'Polo Garcilaso Campeón', equipo: 'Deportivo Garcilaso', tags: [], characters: ['gk'], price: 45, inStock: 3 },
  ];
  const fanGoku = recomendarRegalos({ recipient: persona({ categoryAnswers: { g: { q: 'Goku' } } }), productos: ps, dicts: d }).map((x) => x.producto.id);
  assert.deepEqual(fanGoku, ['dbGoku'], 'ni Boca ni Garcilaso para quien solo ama a Goku');
  const bostero = recomendarRegalos({ recipient: persona({ categoryAnswers: { d: { q: 'Boca' }, g: { q: 'Goku' } } }), productos: ps, dicts: d }).map((x) => x.producto.id);
  assert.equal(bostero[0], 'bocaGoku');
  assert.ok(!bostero.includes('garci'));
  const garcilasino = recomendarRegalos({ recipient: persona({ categoryAnswers: { d: { q: 'Garcilaso' } } }), productos: ps, dicts: d }).map((x) => x.producto.id);
  assert.deepEqual(garcilasino, ['garci']);
  assert.deepEqual(equipoDe(ps[0], d), { nombre: 'Boca Juniors', deducido: true });
  assert.deepEqual(equipoDe(ps[2], d), { nombre: 'Deportivo Garcilaso', deducido: false });
  assert.equal(equipoDe(ps[1], d).nombre, '');
});

test('edad mínima marcada manda sobre lo deducido', () => {
  const ps = [
    { id: 'perfume', name: 'Perfume Noche', edadMinima: 18, tags: ['pr'], publico: 'unisex', price: 80, inStock: 3 },
    { id: 'relojKids', name: 'Reloj Paw Patrol', edadMinima: 0, tags: ['pr'], publico: 'ninos', price: 50, inStock: 3 },
  ];
  const d = { tags: { pr: 'Para regalar' } };
  const nino = persona({ roleKey: 'hijos', events: [{ type: 'Cumpleaños', date: '2018-03-10' }] });
  const r = recomendarRegalos({ recipient: nino, productos: ps, dicts: d, hoy: new Date(2026, 9, 6) }).map((x) => x.producto.id);
  assert.deepEqual(r, ['relojKids'], 'un reloj marcado "todas las edades" sí; un perfume "solo adultos" no');
  assert.deepEqual(edadMinimaDe(ps[0]), { valor: 18, deducida: false });
  assert.deepEqual(edadMinimaDe({ name: 'Reloj Titán' }), { valor: 13, deducida: true });
  assert.deepEqual(edadMinimaDe({ name: 'Polo Grosería', tags: ['h'] }, ' polo groseria humor '), { valor: 18, deducida: true });
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
    const web = recomendarRegalos({ recipient, productos, dicts }).map((x) => [x.producto.id, x.score, x.motivo, x.tipo]);
    const srv = servidor.recomendarRegalos({ recipient, productos, dicts }).map((x) => [x.producto.id, x.score, x.motivo, x.tipo]);
    assert.deepEqual(srv, web);
  }
});
