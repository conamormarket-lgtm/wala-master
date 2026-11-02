import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fuente = await readFile(new URL('./adaptadoresAdmin.js', import.meta.url), 'utf8');
const {
  menuAdminPara, accesosAdminPara, puedeVer, opcionActiva, categoriaDesdeFirestore, categoriaAFirestore, normalizarBusqueda,
} = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);

const rutas = (menu) => menu.flatMap((g) => g.items.map((it) => it.to));

test('superadmin ve todo, también la configuración', () => {
  const r = rutas(menuAdminPara(['superadmin']));
  assert.ok(r.includes('/admin/configuracion'));
  assert.ok(r.includes('/admin/landing-pages'));
  assert.ok(r.includes('/admin/resultados/clientes'));
});

test('solo inventario: el inicio y el inventario', () => {
  assert.deepEqual(rutas(menuAdminPara(['manage_inventory'])), ['/admin', '/admin/inventario']);
});

test('diseño ve Resultados sin Clientes ni Opiniones', () => {
  const r = rutas(menuAdminPara(['manage_design']));
  assert.ok(r.includes('/admin/resultados'));
  assert.ok(!r.includes('/admin/resultados/clientes'));
  assert.ok(!r.includes('/admin/resultados/opiniones'));
  assert.ok(!r.includes('/admin/configuracion'));
});

test('landing pages y temas piden productos y landing pages a la vez', () => {
  const item = { permiso: ['manage_products', 'manage_landing_pages'], todos: true };
  assert.equal(puedeVer(item, ['manage_landing_pages']), false);
  assert.equal(puedeVer(item, ['manage_products']), false);
  assert.equal(puedeVer(item, ['manage_products', 'manage_landing_pages']), true);
});

test('un grupo sin opciones no sale', () => {
  const ids = menuAdminPara(['manage_inventory']).map((g) => g.id);
  assert.deepEqual(ids, ['inicio', 'catalogo']);
});

test('la barra inferior rellena con lo que el admin puede abrir', () => {
  assert.deepEqual(accesosAdminPara(['superadmin']).map((a) => a.id), ['inicio', 'pedidos', 'productos', 'resultados']);
  assert.deepEqual(accesosAdminPara(['manage_clients']).map((a) => a.id), ['inicio', 'resultados', 'reclamos', 'referidos']);
  assert.deepEqual(accesosAdminPara(['manage_inventory']).map((a) => a.id), ['inicio', 'inventario']);
});

test('la opción activa es la más larga que coincide', () => {
  const menu = menuAdminPara(['superadmin']);
  assert.equal(opcionActiva(menu, '/admin').item.to, '/admin');
  assert.equal(opcionActiva(menu, '/admin/resultados').item.to, '/admin/resultados');
  assert.equal(opcionActiva(menu, '/admin/resultados/clientes').item.to, '/admin/resultados/clientes');
  assert.equal(opcionActiva(menu, '/admin/sorteos/abc').item.to, '/admin/sorteos');
  assert.equal(opcionActiva(menu, '/admin/productos/nuevo').item.to, '/admin/productos');
});

test('categorías: de Firestore y de vuelta, con los mismos campos', () => {
  const c = categoriaDesdeFirestore({ id: 'x', name: 'Hoodies', order: '3', imageUrl: 'u', brandIds: ['a'] });
  assert.deepEqual(c, { id: 'x', nombre: 'Hoodies', imagen: 'u', orden: 3, marcas: ['a'] });
  assert.deepEqual(categoriaAFirestore({ ...c, nombre: '  Hoodies ', marcas: ['a', 'a', 'b'] }), {
    name: 'Hoodies', order: 3, imageUrl: 'u', brandIds: ['a', 'b'],
  });
  assert.deepEqual(categoriaDesdeFirestore({ id: 'y' }), { id: 'y', nombre: '', imagen: '', orden: 0, marcas: [] });
});

test('buscar sin tildes', () => {
  assert.equal(normalizarBusqueda('  Categorías '), 'categorias');
});

const m2 = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);

test('atributos: cuenta los productos que usan cada valor (también objetos y repetidos)', () => {
  const productos = [
    { tags: ['a', 'b', 'a'], productType: 't1' },
    { tags: [{ id: 'a' }], productType: { id: 't1' } },
    { characters: ['g'] },
  ];
  assert.deepEqual(m2.usosDeAtributo(productos, 'etiquetas'), { a: 2, b: 1 });
  assert.deepEqual(m2.usosDeAtributo(productos, 'tipos'), { t1: 2 });
  assert.deepEqual(m2.usosDeAtributo(productos, 'personajes'), { g: 1 });
});

test('atributos: los tipos no guardan marcas', () => {
  assert.deepEqual(m2.atributoAFirestore({ nombre: ' Polo ', marcas: ['x'] }, 'tipos'), { name: 'Polo' });
  assert.deepEqual(m2.atributoAFirestore({ nombre: 'Goku', marcas: ['x', 'x'] }, 'personajes'), { name: 'Goku', brandIds: ['x'] });
});

test('zonas: activa salvo que diga lo contrario', () => {
  assert.equal(m2.zonaDesdeFirestore({ id: 'z' }).activa, true);
  assert.deepEqual(m2.zonaAFirestore({ nombre: ' Lima ', costo: '12.5', dias: '2', activa: false }), {
    name: 'Lima', departamento: '', cost: 12.5, etaDays: 2, order: 0, active: false,
  });
});

test('cliparts: el enlace pasa por la conversión de Drive', () => {
  assert.equal(m2.clipartAFirestore({ nombre: 'x', imagen: 'drive' }, (u) => `directa:${u}`).url, 'directa:drive');
  assert.equal(m2.clipartAFirestore({ nombre: 'x', imagen: '' }, () => 'no').url, '');
});

test('marcas: la dirección y el tope de monedas como la tienda', () => {
  assert.equal(m2.slugDeMarca('Con Amor Pájaros 2'), 'conamorpajaros2');
  assert.equal(m2.topeMonedasDe(''), 50);
  assert.equal(m2.topeMonedasDe(undefined), 50);
  assert.equal(m2.topeMonedasDe(0), 0);
  assert.equal(m2.topeMonedasDe(140), 100);
  const doc = { id: 'm', name: 'MUSSA', slug: 'mussa', logoUrl: 'l', order: 3, bgColor: '#000', topeMonedasPct: 20, whatsappNumber: '+51 9' };
  const m = m2.marcaDesdeFirestore(doc);
  assert.equal(m.topeMonedas, 20);
  assert.deepEqual(m2.marcaAFirestore(m), {
    name: 'MUSSA', slug: 'mussa', logoUrl: 'l', order: 3, bgColor: '#000', bgImage: '', bgOpacity: 100, whatsappNumber: '+51 9', storeEmpty: '', topeMonedasPct: 20,
  });
});

test('productos: oculto, archivado y precio de oferta', () => {
  assert.equal(m2.productoAdminDesde({ id: 'p', deleted: true }), null);
  const p = m2.productoAdminDesde({ id: 'p', name: 'Polo', price: 50, salePrice: 40, visible: false, images: ['i'] });
  assert.equal(p.precio, 40);
  assert.equal(p.oculto, true);
  assert.equal(p.imagen, 'i');
  assert.equal(m2.productoAdminDesde({ id: 'q', price: 50, salePrice: 0 }).precio, 50);
});
