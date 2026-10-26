const test = require('node:test');
const assert = require('node:assert/strict');
const { config, validarDisenoYoryo, esSvgLaser } = require('../yoryoProduccion');
const { createCartValidator } = require('../cartValidation');
const pieza = config.piezas[0];
const medidas = { anchoMm: 80, altoMm: 100, medidasConfirmadas: true };
const archivo = { url: 'vector.svg', formato: 'svg', tecnica: 'laser', anchoMm: 80, altoMm: 100, lista: true, revision: 'v1' };
const diseno = { userId: 'cliente', productId: pieza.id, datosYoryo: { nombre: 'Daniel' }, estado: 'guardada', produccionYoryo: { lista: true, tecnica: 'laser', revision: 'v1' }, archivosProduccion: [archivo], vistasPrevias: [{ url: 'previa.jpg', revision: 'v1' }] };
const svg = '<svg width="80mm" height="100mm"><path d="M0 0L1 1"/></svg>';

test('el taller recibe un vector con medidas y la misma revisión que la vista previa', () => {
  assert.equal(validarDisenoYoryo(diseno, { produccionYoryo: medidas }, pieza), '');
  assert.match(validarDisenoYoryo(diseno, {}, pieza), /área/);
  assert.match(validarDisenoYoryo({ ...diseno, productId: 'otro' }, { produccionYoryo: medidas }, pieza), /guardar/);
  assert.match(validarDisenoYoryo({ ...diseno, archivosProduccion: [{ ...archivo, formato: 'png' }] }, { produccionYoryo: medidas }, pieza), /archivos/);
  assert.match(validarDisenoYoryo(diseno, { produccionYoryo: { ...medidas, altoMm: 120 } }, pieza), /cambió/);
  assert.equal(esSvgLaser(svg, 80, 100), true);
  for (const tag of ['image', 'text', 'script', 'foreignObject', 'use']) assert.equal(esSvgLaser(svg.replace('</svg>', `<${tag}/></svg>`), 80, 100), false);
  assert.equal(esSvgLaser(svg, 90, 100), false);
});

test('checkout comprueba el diseño persistido de una compra personalizada', async () => {
  const producto = { price: 120, inStock: 4, visible: true, produccionYoryo: medidas };
  const reader = { getAll: async (...refs) => refs.filter((r) => r.id).map((r) => ({ id: r.id, exists: true, data: () => r.collection === 'designs' ? diseno : producto })) };
  const db = { ...reader, collection: (collection) => ({ doc: (id) => ({ id, collection }) }) };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  let vector = svg;
  const verificar = createCartValidator({ db, HttpsError, leerVector: async () => vector });
  const validate = (items) => verificar(items, null, 'cliente');
  const item = { productoId: pieza.id, cantidad: 1, precio: 120, personalizado: true, designId: 'd1', produccionYoryo: { revision: 'v1' } };
  assert.equal((await validate([item])).subtotal, 120);
  assert.equal(item.disenoVistas.frente.archivoVectorial, archivo.url);
  assert.equal(item.urlImagenPersonalizada, diseno.vistasPrevias[0].url);
  await assert.rejects(verificar([item], null, 'otra-cuenta'), /cuenta/);
  await assert.rejects(verificar([item]), /sesión/);
  await assert.rejects(validate([{ ...item, designId: '' }]), /Personaliza/);
  await assert.rejects(validate([{ ...item, produccionYoryo: { revision: 'vieja' } }]), /cambió/);
  vector = svg.replace('</svg>', '<image href="foto.png"/></svg>');
  await assert.rejects(validate([item]), /vectorial/);
});

test('la compra normal de Yoryo conserva precio y stock sin pedir diseños; la personalizada sigue validándose', async () => {
  const lecturas = [];
  const productos = new Map([...config.piezas.map((p) => [p.id, { price: 59, inStock: 4, visible: true }]), [config.packId, { price: 149, inStock: 4, visible: true }]]);
  const db = { collection: (collection) => ({ doc: (id) => ({ id, collection }) }), getAll: async (...refs) => refs.filter((r) => r.id).map((r) => { lecturas.push(r.collection); return { id: r.id, exists: true, data: () => productos.get(r.id) }; }) };
  class HttpsError extends Error { constructor(code, mensaje) { super(mensaje); this.code = code; } }
  const validar = createCartValidator({ db, HttpsError });
  const normal = { productoId: config.piezas[1].id, precio: 59, cantidad: 2, personalizado: false };
  assert.equal((await validar([normal])).subtotal, 118);
  assert.equal((await validar([{ productoId: config.packId, precio: 149, cantidad: 1, personalizado: false }])).subtotal, 149);
  assert.ok(lecturas.every((c) => c === 'productos_wala'));
  await assert.rejects(validar([{ ...normal, precio: 1 }]), /precio/);
  await assert.rejects(validar([{ ...normal, cantidad: 5 }]), /stock/);
  await assert.rejects(validar([{ ...normal, personalizado: true }]), /Personaliza/);
});

test('el pack del catálogo conserva sus tres piezas y cobra S/149 por unidad', async () => {
  const productos = new Map(config.piezas.map((p) => [p.id, { price: 120, inStock: 4, visible: true, produccionYoryo: medidas }]));
  productos.set(config.packId, { price: 149, visible: true, isComboProduct: true });
  const disenos = config.piezas.map((p) => ({ ...diseno, productId: p.id,
    produccionYoryo: { ...diseno.produccionYoryo, tecnica: p.tecnica },
    archivosProduccion: [{ ...archivo, tecnica: p.tecnica, formato: p.tecnica === 'laser' ? 'svg' : 'png', url: p.tecnica === 'laser' ? 'vector.svg' : 'impresion.png' }],
  }));
  const db = {
    collection: (collection) => ({ doc: (id) => ({ id, collection }) }),
    getAll: async (...refs) => refs.filter((r) => r.id).map((r) => ({ id: r.id, exists: true, data: () => r.collection === 'designs' ? disenos[Number(r.id)] : productos.get(r.id) })),
  };
  const validate = createCartValidator({ db, HttpsError: Error, leerVector: async () => svg });
  const items = config.piezas.map((p, i) => ({ productoId: p.id, cantidad: 2, precio: i === 2 ? 49.68 : 49.66, personalizado: true,
    designId: String(i), produccionYoryo: { revision: 'v1' }, comboCrear: { comboId: config.packId, grupo: 'pack', pieza: i },
  }));
  assert.equal((await validate(items, null, 'cliente')).subtotal, 298);
  assert.deepEqual(items.map((p) => p.archivosProduccion[0].formato), ['svg', 'png', 'png']);
  await assert.rejects(validate(items.slice(0, 2), null, 'cliente'));
});
