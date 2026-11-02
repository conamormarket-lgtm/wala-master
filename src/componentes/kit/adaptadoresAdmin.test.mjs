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

test('productos: qué sale en Tienda, las piezas y las etiquetas de Todos', () => {
  const de = (x) => m2.productoAdminDesde({ id: 'x', ...x });
  assert.equal(m2.esDeLaTienda(de({})), true);
  assert.equal(m2.esDeLaTienda(de({ reemplazadoPor: 'y' })), false);
  assert.equal(m2.esDeLaTienda(de({ esComboCrear: true })), false);
  assert.equal(m2.esDeLaTienda(de({ esPrendaBase: true })), false);
  assert.equal(m2.esDeLaTienda(de({ esPrendaBase: true, enTienda: true })), true);
  const piezas = m2.piezasDeCombos([de({ isComboProduct: true, comboItems: [{ productId: 'a' }, { productId: 'b' }] }), de({ comboItems: [{ productId: 'c' }] })]);
  assert.deepEqual([...piezas], ['a', 'b']);
  assert.deepEqual(m2.etiquetasDeProducto(de({ esComboCrear: true, comboCrear: { publicado: true }, enTienda: true })), ['Pack de Crear', 'En Crear', 'En la tienda']);
  assert.deepEqual(m2.etiquetasDeProducto(de({ esPrendaBase: true, visible: false })), ['Personalizable', 'Borrador']);
  assert.deepEqual(m2.etiquetasDeProducto(de({ isComboProduct: true, reemplazadoPor: 'y' })), ['Combo', 'Reemplazado por su personalizable']);
  assert.deepEqual(m2.etiquetasDeProducto(de({ visible: false })), ['Oculto']);
  assert.equal(m2.rutaAdminDeProducto(de({ esPrendaBase: true })), '/admin/prendas-crear/x');
});

test('productos: personalización de antes y la foto', () => {
  const de = (x) => m2.productoAdminDesde({ id: 'x', ...x });
  assert.equal(de({ customizable: true }).personalizacionVieja, true);
  assert.equal(de({ comboItems: [{ YoryoPersonalizado: {} }] }).personalizacionVieja, true);
  assert.equal(de({ customizable: true, esPrendaBase: true }).personalizacionVieja, false);
  assert.equal(de({ variants: [{ id: 'v1', imageUrl: 'v1' }, { id: 'v2', imageUrl: 'v2' }], defaultVariantId: 'v2', mainImage: 'm' }).imagen, 'v2');
  assert.equal(de({ thumbnailImageUrl: 't', mainImage: 'm' }).imagen, 't');
  assert.equal(m2.estadoDeStock(0), 'agotado');
  assert.equal(m2.estadoDeStock(3), 'ultimas');
  assert.equal(m2.estadoDeStock(4), 'disponible');
});

test('ficha: un producto de antes sin variantes arma la Principal', () => {
  const f = m2.fichaDesdeProducto({ id: 'p', name: 'Polo', price: 50, mainImage: 'm', images: ['m', 'g1'], mainSizes: ['S', 'M'], thumbnailCrop: { percentages: { x: 1 } } });
  assert.equal(f.variantes.length, 1);
  assert.equal(f.variantes[0].nombre, 'Principal');
  assert.equal(f.variantes[0].foto, 'm');
  assert.deepEqual(f.variantes[0].galeria, ['g1']);
  assert.deepEqual(f.variantes[0].tallas, ['S', 'M']);
  assert.equal(f.principal, f.variantes[0].id);
});

test('ficha: de vuelta, con las mismas reglas del formulario', () => {
  const original = {
    id: 'p', name: 'Polo', price: 50, salePrice: 40, isComboProduct: false, defaultVariantId: 'v2',
    variants: [
      { id: 'v1', name: 'Negro', colorHex: '#000', imageUrl: 'a', images: ['b'], sizes: ['S'], imagesVariantes: { a: { 160: 'a160' }, z: { 160: 'z160' } } },
      { id: 'v2', name: 'Blanco', colorHex: '#fff', imageUrl: 'c', images: [], sizes: [] },
    ],
  };
  const f = m2.fichaDesdeProducto(original);
  assert.equal(f.principal, 'v2');
  assert.equal(f.oferta, 40);
  const p = m2.fichaAProducto({ ...f, nombre: ' Polo nuevo ' }, original);
  assert.equal(p.name, 'Polo nuevo');
  assert.equal(p.mainImage, 'c');
  assert.equal(p.defaultVariantId, 'v2');
  assert.equal(p.hasVariants, true);
  assert.deepEqual(p.mainSizes, []);
  assert.deepEqual(p.variants[0].imagesVariantes, { a: { 160: 'a160' } });
  assert.equal(p.variants[0].showSizeConfig, true);
  assert.equal(p.customizable, false);
  assert.equal(p.isV2, true);
});

test('ficha: un combo guarda sus piezas sin perder lo que la ficha no muestra', () => {
  const original = { id: 'c', name: 'Pareja', price: 99, isComboProduct: true, comboItems: [{ productId: 'a', name: 'Ella', imageUrl: 'x', scale: 0.8, YoryoPersonalizado: { z: 1 }, variantMapping: { allowedColors: ['Negro'], color: 'Negro' } }] };
  const f = m2.fichaDesdeProducto(original);
  assert.equal(f.variantes.length, 0);
  f.combo.piezas[0].color = 'Blanco';
  const p = m2.fichaAProducto(f, original);
  assert.deepEqual(p.variants, []);
  assert.equal(p.hasVariants, false);
  assert.equal(p.comboItems[0].scale, 0.8);
  assert.deepEqual(p.comboItems[0].YoryoPersonalizado, { z: 1 });
  assert.deepEqual(p.comboItems[0].variantMapping, { allowedColors: ['Negro'], color: 'Blanco' });
});

test('ficha: lo que falta antes de guardar', () => {
  const f = m2.fichaDesdeProducto(null, { marcaId: 'm' });
  assert.equal(f.marcaId, 'm');
  const e = m2.erroresDeFicha(f);
  assert.ok(e.nombre && e.precio);
  assert.equal(m2.erroresDeFicha({ ...f, nombre: 'x', precio: 10, oferta: 12 }).oferta.pestana, 'general');
  assert.equal(m2.erroresDeFicha({ ...f, nombre: 'x', precio: 0 }).precio, undefined);
  assert.equal(m2.erroresDeFicha({ ...f, nombre: 'x', precio: 10, esCombo: true }).piezas.pestana, 'colores');
});

test('crear: un personalizable con sus cuentas y los packs que lo usan', () => {
  const prenda = {
    id: 'h', name: 'Hoodie', variants: [{ id: 'v1', imageUrl: '' }, { id: 'v2' }], defaultVariantId: 'v1', enTienda: true, seVendeTalCual: true,
    prendaBase: { vistas: [{ id: 'f', imagen: 'f.png', zonas: [{}, {}] }, { id: 'e', imagen: '', zona: {} }], plantillas: [{ id: 'p', capas: { f: [{}] } }, { id: 'vacia', capas: {} }] },
  };
  const packs = [{ id: 'c1', name: 'Pareja', comboCrear: { publicado: true, piezas: [{ prendaId: 'h' }, { prendaId: 'h' }] } }, { id: 'c2', deleted: true, comboCrear: { piezas: [{ prendaId: 'h' }] } }];
  const r = m2.personalizableDesde(prenda, packs);
  assert.equal(r.foto, 'f.png');
  assert.deepEqual([r.colores, r.vistas, r.zonas, r.plantillas], [2, 2, 3, 1]);
  assert.equal(r.faltanZonas, true);
  assert.equal(r.talCual, true);
  assert.deepEqual(r.packs, [{ id: 'c1', nombre: 'Pareja', publicado: true }]);
});

test('crear: un pack de ida y vuelta, y lo que le falta', () => {
  const doc = { id: 'c', name: 'Trío', price: 150, salePrice: 0, brandId: 'm', categories: ['k'], mainImage: 'img', enTienda: true, comboCrear: { publicado: true, tallas: 'una', piezas: [{ prendaId: 'a', nombre: 'Polo', imagen: 'x' }, { prendaId: 'b', fija: true, color: { id: '1', nombre: 'Negro', hex: '#000' } }] } };
  const k = m2.packDesdeFirestore(doc);
  assert.equal(k.tallas, 'una');
  assert.equal(k.oferta, '');
  assert.deepEqual(m2.packAGuardar(k).piezas, [{ prendaId: 'a' }, { prendaId: 'b', fija: true, color: { id: '1', nombre: 'Negro', hex: '#000' } }]);
  assert.equal(m2.packAGuardar(k).salePrice, '');
  assert.deepEqual(Object.keys(m2.erroresDePack(k)), []);
  assert.ok(m2.erroresDePack({ ...k, piezas: [k.piezas[1], k.piezas[1]] }).piezas.includes('diseñarse'));
  assert.ok(m2.erroresDePack({ ...k, piezas: [k.piezas[0]] }).piezas.includes('al menos'));
  assert.ok(m2.erroresDePack({ ...k, piezas: [k.piezas[0], { prendaId: 'b', fija: true, color: null }] }).piezas.includes('color'));
});

test('crear: la ficha de un personalizable guarda su prendaBase y su stock sin límite', () => {
  const original = { id: 'h', name: 'Hoodie', price: 90, esPrendaBase: true, inStock: null, enTienda: true, seVendeTalCual: false, variants: [{ id: 'v1', name: 'Negro', imageUrl: '' }], prendaBase: { vistas: [{ id: 'f', imagen: 'f.png', zonas: [{ id: 'z' }] }], colores: {} } };
  const f = m2.fichaDesdeProducto(original);
  assert.equal(f.esPrenda, true);
  assert.equal(f.stock, '');
  const p = m2.fichaAProducto(f, original, { prendaBaseParaGuardar: (pb, vs) => ({ limpia: true, vistas: pb.vistas.length, colores: vs.length }) });
  assert.equal(p.esPrendaBase, true);
  assert.deepEqual(p.prendaBase, { limpia: true, vistas: 1, colores: 1 });
  assert.equal(p.inStock, null);
  assert.equal(p.variants[0].imageUrl, 'f.png');
  assert.equal(p.personalizarEn, '');
  assert.equal(p.enTienda, true);
  assert.equal(p.seVendeTalCual, false);
  assert.equal(m2.erroresDeFicha({ ...f, prenda: { vistas: [{ id: 'f', imagen: '', zonas: [] }] } }).vistas.pestana, 'diseno');
  assert.equal(m2.erroresDeFicha(f).vistas, undefined);
});

test('blueprints: las áreas sin nombre no se guardan y siempre queda una para editar', () => {
  const b = m2.blueprintDesdeFirestore({ id: 'b', name: 'Polo', basePrintCost: '12', decorationMethods: ['DTG', ' Bordado '] });
  assert.equal(b.areas.length, 1);
  assert.deepEqual(b.metodos, ['DTG', 'Bordado']);
  assert.deepEqual(m2.blueprintAFirestore({ ...b, areas: [{ nombre: ' Frente ', ancho: '30', alto: 40, dpi: '' }, { nombre: '', ancho: 1 }], metodos: ['DTG', 'DTG'] }), {
    name: 'Polo', baseGarment: '', basePrintCost: 12, order: 0, active: true, decorationMethods: ['DTG'],
    printAreas: [{ name: 'Frente', widthCm: 30, heightCm: 40, dpi: 300 }],
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

test('recepción: filtros, cifras y la dirección para copiar', () => {
  const pedidos = [
    { id: 'a', montoTotal: 100.005, estado: { key: 'por_confirmar_pago', paid: false } },
    { id: 'b', montoTotal: 50, estado: { key: 'en_preparacion', paid: true } },
    { id: 'c', montoTotal: 80, estado: { key: 'entregado', paid: true } },
    { id: 'd', montoTotal: 0, estado: { key: 'anulado', paid: false } },
  ];
  assert.deepEqual(pedidos.filter((p) => m2.pedidoEnFiltro(p, 'por_entregar')).map((p) => p.id), ['a', 'b']);
  assert.deepEqual(pedidos.filter((p) => m2.pedidoEnFiltro(p, '')).length, 4);
  assert.deepEqual(m2.resumenRecepcion(pedidos), { total: 4, porEntregar: 2, pendientesPago: 1, enProduccion: 1, entregados: 1, montoTotal: 230.01 });
  assert.equal(m2.direccionParaCopiar({
    clienteNombre: 'Ana', clienteContacto: '987654321', esRegalo: true, regalo: { destinatario: 'Luis' },
    entrega: { direccion: 'Av. Sol 123', distrito: 'Surco', departamento: 'Lima' },
  }), 'Av. Sol 123, Surco, Lima\nLuis · 987654321');
});
