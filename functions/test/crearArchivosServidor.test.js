const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas } = require('canvas');
const render = require('../crearRender');
const { generarArchivosCreacion, rutaPropia } = require('../crearArchivosServidor');

const BUCKET = 'demo.appspot.com';
const png = (w, h, color) => { const c = createCanvas(w, h); const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); return c.toBuffer('image/png'); };
const url = (ruta) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}?alt=media&token=t`;
const DELETE = Symbol('delete');

function fixture(diseno, { enPedido = false } = {}) {
  const docs = new Map([
    ['designs/d1', { userId: 'u1', tipo: 'crear', estado: 'borrador', productId: 'polera', color: { id: 'negro' }, enPedido,
      archivosImpresion: [{ url: url('designs/u1/crear/impresion/1_pecho.png') }], imagenConjunta: url('designs/u1/crear/previas/1_conjunto.jpg'), ...diseno }],
    ['productos_wala/polera', { name: 'Polera', esPrendaBase: true, variants: [{ id: 'negro', name: 'Negro', colorHex: '#111111' }],
      prendaBase: { vistas: [{ id: 'frente', nombre: 'Frente', imagen: 'https://x.test/prenda.png', zonas: [{ id: 'pecho', nombre: 'Pecho', x: 0.3, y: 0.3, w: 0.4, proporcion: 1 }] }] } }],
  ]);
  const ref = (key) => ({
    async get() { const data = docs.get(key); return { exists: !!data, data: () => data }; },
    async update(patch) {
      const next = { ...docs.get(key) };
      for (const [k, v] of Object.entries(patch)) { if (v === DELETE) delete next[k]; else next[k] = v; }
      docs.set(key, next);
    },
  });
  const db = { collection: (c) => ({ doc: (id) => ref(`${c}/${id}`) }), runTransaction: async (fn) => fn({ get: (r) => r.get(), update: (r, p) => r.update(p) }) };
  const files = new Map([['designs/u1/fotos/a.png', png(200, 100, '#22C55E')], ['designs/u1/crear/impresion/1_pecho.png', png(1, 1, '#000')]]);
  const borrados = [];
  const bucket = { name: BUCKET, file: (ruta) => ({
    async download() { if (!files.has(ruta)) throw new Error('no existe'); return [files.get(ruta)]; },
    async save(buffer, options) { files.set(ruta, buffer); this.options = options; },
    async delete() { borrados.push(ruta); files.delete(ruta); },
  }) };
  const descargas = [];
  const deps = { db, bucket, render, FieldValue: { delete: () => DELETE, serverTimestamp: () => 'ahora' }, ahora: () => 1_800_000_000_000,
    descargar: async (src) => { descargas.push(src); return png(800, 1000, '#F2F2F2'); } };
  const fail = (message, code = 'failed-precondition') => { const e = new Error(message); e.code = code; throw e; };
  return { docs, files, borrados, descargas, deps, fail };
}
const capas = { pecho: [
  { id: 'f', type: 'image', src: url('designs/u1/fotos/a.png'), anchoNatural: 200, altoNatural: 100, left: 500, top: 500, escalaX: 3, escalaY: 3, angulo: 0 },
  { id: 't', type: 'text', text: 'Hola', fuente: 'Montserrat', color: '#FFFFFF', tamano: 120, negrita: true, cursiva: false, left: 500, top: 800, escalaX: 1, escalaY: 1, angulo: 0 },
] };

test('dibuja, sube a las rutas de la web y deja la creación guardada con sus archivos propios', async () => {
  const f = fixture({ layersByView: capas });
  const out = await generarArchivosCreacion({ uid: 'u1', designId: 'd1', deps: f.deps, fail: f.fail });
  assert.equal(out.archivosImpresion.length, 1);
  assert.match(out.archivosImpresion[0].url, /designs%2Fu1%2Fcrear%2Fimpresion%2F1800000000000_pecho\.png\?alt=media&token=/);
  assert.equal(out.vistasPrevias[0].vista, 'frente');
  const guardado = f.docs.get('designs/d1');
  assert.equal(guardado.estado, 'guardada');
  assert.equal(guardado.generandoDesde, undefined);
  assert.deepEqual(guardado.color, { id: 'negro', nombre: 'Negro', hex: '#111111' });
  assert.ok(f.files.has('designs/u1/crear/previas/1800000000000_conjunto.jpg'));
  // La prenda se lee de su URL; la foto del cliente, del bucket. Los archivos viejos se borran.
  assert.deepEqual(f.descargas, ['https://x.test/prenda.png']);
  assert.deepEqual(f.borrados.sort(), ['designs/u1/crear/impresion/1_pecho.png', 'designs/u1/crear/previas/1_conjunto.jpg']);
});

test('en un pedido conserva los archivos anteriores', async () => {
  const f = fixture({ layersByView: capas }, { enPedido: true });
  await generarArchivosCreacion({ uid: 'u1', designId: 'd1', deps: f.deps, fail: f.fail });
  assert.deepEqual(f.borrados, []);
});

test('rechaza otra cuenta, fotos ajenas o de otra web, zonas inventadas, textos largos y dos dibujos a la vez', async () => {
  const ajena = { ...capas.pecho[0], src: url('designs/otra/fotos/a.png') };
  const casos = [
    [{ layersByView: capas }, 'u2', 'not-found'],
    [{ layersByView: { pecho: [ajena] } }, 'u1', /no es tuya/],
    [{ layersByView: { pecho: [{ ...ajena, src: 'https://evil.test/a.png' }] } }, 'u1', /no es tuya/],
    [{ layersByView: { manga: capas.pecho } }, 'u1', /zona/],
    [{ layersByView: { pecho: [{ ...capas.pecho[1], text: 'x'.repeat(121) }] } }, 'u1', /texto/],
    [{ layersByView: {} }, 'u1', /Agrega/],
    [{ layersByView: capas, combo: { id: 'c' } }, 'u1', /wala\.pe/],
    [{ layersByView: capas, generandoDesde: 1_800_000_000_000 - 1000 }, 'u1', 'resource-exhausted'],
  ];
  for (const [diseno, uid, esperado] of casos) {
    const f = fixture(diseno);
    await assert.rejects(generarArchivosCreacion({ uid, designId: 'd1', deps: f.deps, fail: f.fail }),
      (e) => (typeof esperado === 'string' ? e.code === esperado : esperado.test(e.message)));
  }
  assert.equal(rutaPropia(url('designs/u1/../u2/a.png'), 'u1', BUCKET), null);
});
