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
