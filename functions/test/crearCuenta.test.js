const test = require('node:test');
const assert = require('node:assert/strict');
const { eliminarCreacion, llevarEnCombo } = require('../crearCuenta');

const BUCKET = 'demo.appspot.com';
const url = (ruta) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}?alt=media&token=t`;
const TS = Symbol('ts');

function fixture(docs) {
  const data = new Map(Object.entries(docs));
  let n = 0;
  const ref = (key) => ({ id: key.split('/')[1],
    async get() { const d = data.get(key); return { exists: !!d, data: () => d }; },
    async update(patch) { data.set(key, { ...data.get(key), ...patch }); },
    async delete() { data.delete(key); } });
  const db = {
    collection: (c) => ({ doc: (id = `nuevo${++n}`) => ref(`${c}/${id}`),
      where: (campo, _op, valor) => ({ async get() { return { forEach: (fn) => [...data].filter(([k, d]) => k.startsWith(`${c}/`) && d[campo] === valor)
        .forEach(([k, d]) => fn({ id: k.slice(c.length + 1), data: () => d })) }; } }) }),
    batch: () => { const sets = []; return { set: (r, v) => sets.push([`designs/${r.id}`, v]), async commit() { sets.forEach(([k, v]) => data.set(k, v)); } }; },
  };
  const borrados = [];
  const bucket = { name: BUCKET, file: (ruta) => ({ async delete() { borrados.push(ruta); } }) };
  const fail = (message, code = 'failed-precondition') => { const e = new Error(message); e.code = code; throw e; };
  return { data, borrados, fail, deps: { db, bucket, FieldValue: { serverTimestamp: () => TS }, ahora: () => 1 } };
}
const archivos = (id) => ({ archivosImpresion: [{ url: url(`designs/u1/crear/impresion/${id}.png`) }], vistasPrevias: [{ url: url(`designs/u1/crear/previas/${id}.jpg`) }] });

test('borra una creación y solo los archivos que ningún otro diseño usa; nunca los de un pedido', async () => {
  const foto = url('designs/u1/crear/originales/foto.png');
  const f = fixture({
    'designs/a': { userId: 'u1', tipo: 'crear', estado: 'guardada', ...archivos('a'), layersByView: { pecho: [{ type: 'image', src: foto }] } },
    'designs/b': { userId: 'u1', tipo: 'crear', estado: 'guardada', ...archivos('b'), layersByView: { pecho: [{ type: 'image', src: foto }] } },
    'designs/p': { userId: 'u1', tipo: 'crear', estado: 'guardada', enPedido: true, ...archivos('p') },
  });
  await eliminarCreacion({ uid: 'u1', designId: 'a', deps: f.deps, fail: f.fail });
  assert.equal(f.data.has('designs/a'), false);
  assert.deepEqual(f.borrados.sort(), ['designs/u1/crear/impresion/a.png', 'designs/u1/crear/previas/a.jpg']);
  await eliminarCreacion({ uid: 'u1', designId: 'p', deps: f.deps, fail: f.fail });
  assert.equal(f.data.has('designs/p'), false);
  assert.equal(f.borrados.length, 2);
  await assert.rejects(eliminarCreacion({ uid: 'u2', designId: 'b', deps: f.deps, fail: f.fail }), (e) => e.code === 'not-found');
});

test('una prenda de un combo no se borra sola; el "Mi combo" se borra con sus prendas o se archiva si está en un pedido', async () => {
  const docs = () => ({
    'designs/m': { userId: 'u1', tipo: 'comboCrear', comboId: 'c1', piezas: [{ designId: 'x' }, { designId: 'y' }] },
    'designs/x': { userId: 'u1', tipo: 'crear', combo: { id: 'c1', pieza: 0 }, ...archivos('x') },
    'designs/y': { userId: 'u1', tipo: 'crear', combo: { id: 'c1', pieza: 1 }, ...archivos('y') },
    'designs/suelta': { userId: 'u1', tipo: 'crear', ...archivos('x') },
  });
  const f = fixture(docs());
  await assert.rejects(eliminarCreacion({ uid: 'u1', designId: 'x', deps: f.deps, fail: f.fail }), /parte de tu combo/);
  const out = await eliminarCreacion({ uid: 'u1', designId: 'm', deps: f.deps, fail: f.fail });
  assert.deepEqual(out, { archivado: false, prendasBorradas: ['x', 'y'] });
  assert.deepEqual(['m', 'x', 'y', 'suelta'].map((id) => f.data.has(`designs/${id}`)), [false, false, false, true]);
  // Los archivos de x los sigue usando la creación suelta: solo se borran los de y.
  assert.deepEqual(f.borrados.sort(), ['designs/u1/crear/impresion/y.png', 'designs/u1/crear/previas/y.jpg']);
  const g = fixture({ ...docs(), 'designs/m': { ...docs()['designs/m'], enPedido: true } });
  assert.equal((await eliminarCreacion({ uid: 'u1', designId: 'm', deps: g.deps, fail: g.fail })).archivado, true);
  assert.equal(g.data.get('designs/m').archivado, true);
});

test('"Llevar en combo" copia la creación en cada pieza de su prenda y arma el "Mi combo"', async () => {
  const f = fixture({
    'designs/c': { userId: 'u1', tipo: 'crear', estado: 'guardada', name: 'Mía', productId: 'polera', productName: 'Polera', variant: { size: 'M' },
      color: { id: 'negro', nombre: 'Negro' }, layersByView: { pecho: [] }, ...archivos('c') },
    'productos_wala/c1': { name: 'Pack', esComboCrear: true, comboCrear: { publicado: true,
      piezas: [{ prendaId: 'polera' }, { prendaId: 'polera' }, { prendaId: 'reloj', fija: true, imagen: 'https://x.test/r.png', color: { id: 'oro', nombre: 'Oro' } }] } },
    'productos_wala/c2': { name: 'Otro', esComboCrear: true, comboCrear: { publicado: true, piezas: [{ prendaId: 'polo' }, { prendaId: 'polo' }] } },
  });
  const { miComboId, piezas } = await llevarEnCombo({ uid: 'u1', designId: 'c', comboId: 'c1', deps: f.deps, fail: f.fail });
  assert.deepEqual(piezas, [0, 1]);
  const mio = f.data.get(`designs/${miComboId}`);
  assert.equal(mio.tipo, 'comboCrear'); assert.equal(mio.estado, 'guardada'); assert.equal(mio.comboId, 'c1');
  assert.equal(mio.piezas[2].fija, true); assert.equal(mio.piezas[0].talla, 'M');
  const copia = f.data.get(`designs/${mio.piezas[1].designId}`);
  assert.deepEqual(copia.combo, { id: 'c1', nombre: 'Pack', pieza: 1 });
  assert.deepEqual(copia.archivosImpresion, archivos('c').archivosImpresion);
  assert.equal(f.data.get('designs/c').combo, undefined);
  await assert.rejects(llevarEnCombo({ uid: 'u1', designId: 'c', comboId: 'c2', deps: f.deps, fail: f.fail }), /no está disponible/);
  f.data.set('designs/c', { ...f.data.get('designs/c'), estado: 'borrador' });
  await assert.rejects(llevarEnCombo({ uid: 'u1', designId: 'c', comboId: 'c1', deps: f.deps, fail: f.fail }), /Termina/);
});
