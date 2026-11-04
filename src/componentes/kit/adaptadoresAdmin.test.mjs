import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fuente = await readFile(new URL('./adaptadoresAdmin.js', import.meta.url), 'utf8');
const {
  menuAdminPara, accesosAdminPara, puedeVer, opcionActiva, categoriaDesdeFirestore, categoriaAFirestore, ordenConParte, normalizarBusqueda,
} = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);

const rutas = (menu) => menu.flatMap((g) => g.items.map((it) => it.to));

test('superadmin ve todo, también la configuración', () => {
  const r = rutas(menuAdminPara(['superadmin']));
  assert.ok(r.includes('/admin/configuracion'));
  assert.ok(r.includes('/admin/landing-pages'));
  assert.ok(r.includes('/admin/resultados'));
});

test('solo inventario: el inicio y productos (donde está el stock)', () => {
  assert.deepEqual(rutas(menuAdminPara(['manage_inventory'])), ['/admin', '/admin/productos']);
});

test('diseño ve Resultados (una sola entrada: Clientes y Opiniones los filtra la página)', () => {
  const r = rutas(menuAdminPara(['manage_design']));
  assert.ok(r.includes('/admin/resultados'));
  assert.ok(!r.some((x) => x.startsWith('/admin/resultados/')));
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
  assert.deepEqual(accesosAdminPara(['manage_inventory']).map((a) => a.id), ['inicio', 'productos']);
});

test('la opción activa es la más larga que coincide', () => {
  const menu = menuAdminPara(['superadmin']);
  assert.equal(opcionActiva(menu, '/admin').item.to, '/admin');
  assert.equal(opcionActiva(menu, '/admin/resultados').item.to, '/admin/resultados');
  assert.equal(opcionActiva(menu, '/admin/resultados/clientes').item.to, '/admin/resultados');
  assert.equal(opcionActiva(menu, '/admin/sorteos/abc').item.to, '/admin/sorteos');
  assert.equal(opcionActiva(menu, '/admin/productos/nuevo').item.to, '/admin/productos');
});

test('categorías: de Firestore y de vuelta, con los mismos campos', () => {
  const c = categoriaDesdeFirestore({ id: 'x', name: 'Hoodies', order: '3', imageUrl: 'u', brandIds: ['a'] });
  assert.deepEqual(c, { id: 'x', nombre: 'Hoodies', imagen: 'u', orden: 3, marcas: ['a'], tipo: '' });
  assert.deepEqual(categoriaAFirestore({ ...c, nombre: '  Hoodies ', marcas: ['a', 'a', 'b'] }), {
    name: 'Hoodies', order: 3, imageUrl: 'u', brandIds: ['a', 'b'], productType: '',
  });
  assert.deepEqual(categoriaDesdeFirestore({ id: 'y' }), { id: 'y', nombre: '', imagen: '', orden: 0, marcas: [], tipo: '' });
});

test('ordenar una parte sin mover lo demás', () => {
  // b y d son de la marca: se cambian entre ellas y a, c, e se quedan donde estaban.
  assert.deepEqual(ordenConParte(['a', 'b', 'c', 'd', 'e'], ['d', 'b']), ['a', 'd', 'c', 'b', 'e']);
  assert.deepEqual(ordenConParte(['a', 'b', 'c'], ['c', 'a', 'b']), ['c', 'a', 'b']);
  // Una parte que no está entera en la lista no cambia nada.
  assert.deepEqual(ordenConParte(['a', 'b'], ['b', 'z']), ['a', 'b']);
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
    topeMonedasTipo: 'pct', topeMonedasCantidad: '',
  });
  assert.equal(m.tipoTope, 'pct');
  assert.equal(m2.textoTopeMonedas(m), 'Hasta 20 %');
  // Monedas por producto: se guarda la cantidad entera y el % se conserva.
  const fija = m2.marcaDesdeFirestore({ ...doc, topeMonedasTipo: 'monedas', topeMonedasCantidad: 10 });
  assert.deepEqual([fija.tipoTope, fija.monedasPorProducto], ['monedas', 10]);
  assert.equal(m2.textoTopeMonedas(fija), '10 por producto');
  assert.deepEqual(m2.marcaAFirestore({ ...fija, monedasPorProducto: '7.8' }), {
    ...m2.marcaAFirestore(m), topeMonedasTipo: 'monedas', topeMonedasCantidad: 7,
  });
  assert.equal(m2.textoTopeMonedas({ tipoTope: 'monedas', monedasPorProducto: 0 }), null);
  assert.equal(m2.textoTopeMonedas({ tipoTope: 'monedas', monedasPorProducto: '', topeMonedas: 30 }), 'Hasta 30 %');
  assert.equal(m2.textoTopeMonedas({ topeMonedas: 0 }), null);
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
  assert.equal(m2.estadoDeStock(null), 'sinLimite');
  assert.equal(de({}).stock, null);
  assert.equal(de({ inStock: 0 }).stock, 0);
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
  // Guardar la ficha no mueve el producto en Destacados.
  assert.equal(m2.fichaAProducto(f, { ...original, featured: true, featuredOrder: 7 }).featuredOrder, 7);
  assert.equal(p.featuredOrder, 0);
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
  // Sin tocar la categoría conserva todas; cambiada, solo la nueva.
  assert.deepEqual(m2.packAGuardar({ ...k, categorias: ['k', 'z'] }).categories, ['k', 'z']);
  assert.deepEqual(m2.packAGuardar({ ...k, categorias: ['k', 'z'], categoria: 'w' }).categories, ['w']);
  assert.deepEqual(m2.packAGuardar({ ...k, categoria: '' }).categories, []);
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

test('pagos: filtros, cifras, serie por día, enlace nuevo y configuración', () => {
  const d = (dia, h = 10) => new Date(2026, 9, dia, h).getTime();
  const enlaces = [
    { id: 'a', concepto: 'Envío a España', moneda: 'PEN', monto: 40, estado: 'pagado', metodo: 'culqi', createdMs: d(1), pagadoMs: d(3), tiempoPagoMs: d(3) - d(1) },
    { id: 'b', concepto: 'Saldo', moneda: 'USD', monto: 20, estado: 'pagado', metodo: 'paypal', createdMs: d(3), pagadoMs: d(3, 12), tiempoPagoMs: 7200000 },
    { id: 'c', concepto: 'Saldo extra', moneda: 'PEN', monto: 15, estado: 'pendiente', metodo: 'culqi', createdMs: d(4), pagadoMs: null, tiempoPagoMs: null },
  ];
  assert.deepEqual(enlaces.filter((e) => m2.enlaceEnFiltro(e, { q: 'envio' })).map((e) => e.id), ['a']);
  assert.deepEqual(enlaces.filter((e) => m2.enlaceEnFiltro(e, { metodo: 'culqi', estado: 'pagado' })).map((e) => e.id), ['a']);
  assert.deepEqual(enlaces.filter((e) => m2.enlaceEnFiltro(e, { rango: m2.rangoDePeriodo('fechas', { desde: '2026-10-03', hasta: '2026-10-03' }) })).map((e) => e.id), ['b']);
  assert.deepEqual(m2.rangoDePeriodo('7', {}, d(10)), [new Date(2026, 9, 4).getTime(), null]);
  const r = m2.resumenEnlaces(enlaces);
  assert.equal(r.pagados, 2);
  assert.equal(r.cobradoPEN, 40);
  assert.equal(r.cobradoUSD, 20);
  assert.equal(Math.round(r.conversion), 67);
  const serie = m2.serieDiariaEnlaces(enlaces);
  assert.deepEqual(serie.map((x) => x.etiqueta), ['01/10', '02/10', '03/10', '04/10']);
  assert.deepEqual(serie.map((x) => x.valores.pagados), [0, 0, 2, 0]);
  assert.deepEqual(serie.map((x) => x.valores.generados), [1, 0, 1, 1]);
  assert.equal(m2.duracionCorta(7200000), '2h 0m');
  assert.equal(m2.duracionCorta(null), '—');
  assert.deepEqual(m2.enlaceNuevo({ concepto: ' ', monto: '0' }).errores, { concepto: 'Escribe qué se está cobrando.', monto: 'Pon un monto mayor a 0.' });
  assert.deepEqual(m2.enlaceNuevo({ concepto: 'Envío', moneda: 'USD', monto: '12,5' }).datos, { concepto: 'Envío', moneda: 'USD', monto: 12.5, montoUSD: 12.5, estado: 'pendiente' });
  const c = m2.configPagosDesde({ yape_number: ' 987 ', whatsapp_number_cuenta: '+51 999' });
  assert.equal(c.whatsapp, '+51 999');
  assert.equal(c.mensaje, m2.MENSAJE_PAGOS_POR_DEFECTO);
  assert.equal(m2.configPagosAMensajes(c).yape_number, '987');
  assert.equal(m2.configPagosAMensajes(c).whatsapp_number_pagos, '+51 999');
});

test('reclamos: el documento, responder, el plazo en días hábiles y la migración', () => {
  const r = m2.reclamoDesdeFirestore({
    id: 'x', codigo: 'WALA-20261030-0001', estado: 'pendiente', createdAt: { seconds: new Date(2026, 9, 30, 10).getTime() / 1000 },
    consumidor: { nombre: 'Ana', tipoDocumento: 'DNI', numeroDocumento: '71234567', email: 'a@b.pe' },
    bien: { tipo: 'producto', montoReclamado: '89.9', descripcion: 'Polo' }, reclamo: { tipo: 'queja', detalle: 'Llegó tarde', pedido: 'Que me devuelvan el envío' },
  });
  assert.equal(r.tipo, 'queja');
  assert.equal(r.consumidor.documento, 'DNI 71234567');
  assert.equal(r.bien.monto, 89.9);
  assert.equal(m2.respuestaDeReclamo('  ').error, 'Escribe la respuesta antes de marcarlo como respondido.');
  assert.deepEqual(m2.respuestaDeReclamo(' Listo ', new Date('2026-11-02T15:00:00Z')).datos, { estado: 'respondido', respuestaProveedor: 'Listo', respondidoEn: '2026-11-02T15:00:00.000Z' });
  // Viernes 30/10 → lunes 2/11: un día hábil; → viernes 6/11: cinco.
  assert.equal(m2.diasHabilesEntre(new Date(2026, 9, 30, 10).getTime(), new Date(2026, 10, 2, 9).getTime()), 1);
  assert.equal(m2.diasHabilesEntre(new Date(2026, 9, 30, 10).getTime(), new Date(2026, 10, 6, 9).getTime()), 5);
  assert.deepEqual(m2.plazoDeReclamo(r, 15, new Date(2026, 10, 2, 9).getTime()), { dias: 1, quedan: 14, estado: 'a_tiempo' });
  assert.equal(m2.plazoDeReclamo(r, 15, new Date(2026, 10, 17, 9).getTime()).estado, 'por_vencer');
  assert.equal(m2.plazoDeReclamo(r, 15, new Date(2026, 10, 23, 9).getTime()).estado, 'vencido');
  assert.equal(m2.plazoDeReclamo({ ...r, estado: 'respondido' }), null);
});

test('resultados: cambios, cifras del resumen, comparativa y otros cobros', () => {
  assert.deepEqual(m2.cambioPorcentual(120, 100), { texto: '▲ 20%', bueno: true });
  assert.deepEqual(m2.cambioPorcentual(80, 100), { texto: '▼ 20%', bueno: false });
  assert.deepEqual(m2.cambioPorcentual(5, 0), { texto: '▲ nuevo', bueno: true });
  assert.deepEqual(m2.cambioPorcentual(0, 0), { texto: '= 0%', bueno: true });
  assert.equal(m2.cambioPorcentual(1, null), null);
  assert.deepEqual(m2.cambioEnPuntos(2.5, 2.1), { texto: '▲ 0.4 pp', bueno: true });
  const datos = { visitas: { total: { total: 1200 } }, ventas: { pedidos: { total: 30 }, ingresosCents: { total: 450000 } } };
  const anterior = { visitas: { total: 1000 }, pedidos: { total: 30 }, ingresosCents: { total: 500000 }, diasConVentas: 7 };
  const r = m2.cifrasDelResumen({ datos, anterior, comparar: true });
  assert.deepEqual(r.cifras.map((c) => c.valor), ['1,200', '30', 'S/ 4,500.00', '2.5']);
  assert.deepEqual(r.cifras.map((c) => c.cambio?.texto), ['▲ 20%', '= 0%', '▼ 10%', '▼ 0.5 pp']);
  assert.equal(r.comparativa[2].diferencia, '−S/ 500.00');
  assert.equal(r.comparativa[3].diferencia, null);
  // Sin comparar o con un canal elegido, sin cambios; el canal manda en visitas y pedidos.
  assert.equal(m2.cifrasDelResumen({ datos, anterior }).cifras[0].cambio, null);
  const c = m2.cifrasDelResumen({ datos, anterior, comparar: true, canal: { canal: 'Instagram', visitas: 300, pedidos: 9 } });
  assert.deepEqual(c.cifras.map((x) => x.valor), ['300', '9', 'S/ 4,500.00', '3']);
  assert.equal(c.cifras[0].cambio, null);
  assert.deepEqual(m2.otrosCobrosDe({ sorteo: { cantidad: 3, porMoneda: { PEN: 3000 } }, saldo: { cantidad: 1, porMoneda: { PEN: 4500, USD: 2000 } } }), { montos: 'S/ 75.00 + USD 20.00', detalle: '3 tickets de sorteo · 1 pago de saldo' });
  assert.equal(m2.otrosCobrosDe({}), null);
  assert.deepEqual(m2.serieDeVisitas([{ day: '2026-10-03', total: 4 }]), [{ etiqueta: '03/10', valores: { visitas: 4 } }]);
});

test('resultados: las listas de Productos y de Visitantes', () => {
  const catalogo = { p1: { nombre: 'Polo clásico', imagen: 'polo.webp' } };
  const productoDe = (id) => catalogo[id];
  const datos = {
    topProducts: [{ productId: 'p1', total: 320 }, { productId: 'zz', name: 'Retirado', total: 1 }],
    topVendidos: [{ productId: 'p1', ingresosCents: 5000, unidades: 1, pedidos: 1, linea: 'polos' }, { productId: 'p2', ingresosCents: 3000, unidades: 4, pedidos: 2, linea: 'polos' }],
    interes: { productos: [{ productId: 'p1', dwellMs: 125000, personas: 0 }] },
    topSearches: [{ query: 'tomatodo azul', total: 14 }],
  };
  const l = m2.listasDeProductos({ datos, productoDe, nombreCategoria: (id) => ({ polos: 'Polos' }[id] || id) });
  assert.deepEqual(l.vistos.map((x) => [x.nombre, x.texto, x.imagen]), [['Polo clásico', '320 vistas', 'polo.webp'], ['Retirado', '1 vista', '']]);
  assert.deepEqual(l.vendidos.map((x) => x.id), ['p1', 'p2']);
  assert.deepEqual(m2.listasDeProductos({ datos, productoDe, medida: 'unidades' }).vendidos.map((x) => [x.id, x.texto]), [['p2', '4 u.'], ['p1', '1 u.']]);
  assert.deepEqual(l.lineasVendidas, [{ id: 'polos', nombre: 'Polos', valor: 8000, texto: 'S/ 80.00', sub: '5 u.' }]);
  assert.equal(l.masMirados[0].texto, '2m 5s');
  assert.equal(l.masMirados[0].sub, 'Solo visitantes sin cuenta');
  assert.equal(l.busquedas[0].nombre, '«tomatodo azul»');
  const v = m2.listasDeVisitantes({
    visitas: { total: { total: 200 }, conInteraccion: { total: 50 }, paginas: { total: 500 }, dwellMs: { total: 200 * 90000 } },
    canales: [{ canal: 'Instagram', visitas: 80, conInteraccion: 20, pedidos: 2 }],
    byCountryAprox: [{ name: 'Perú', count: 150 }, { name: 'unknown', count: 50 }],
    byDevice: [{ name: 'Mobile', count: 3 }, { name: 'Desktop', count: 1 }],
  });
  assert.deepEqual(v.cifras.map((c) => c.valor), ['200', '—', '25%', '2.5', '1m 30s']);
  assert.deepEqual(v.canales[0], { id: 'Instagram', canal: 'Instagram', visitas: '80', parte: '40%', interaccion: '25%', pedidos: '2', conversion: '2.5' });
  assert.equal(v.paisAproximado, true);
  assert.deepEqual(v.paises.map((p) => [p.nombre, p.texto]), [['Perú', '75%'], ['No se sabe', '25%']]);
  assert.deepEqual(v.dispositivos.map((p) => p.nombre), ['Celular', 'Computadora']);
  assert.deepEqual(m2.listasDeVisitantes({ byCountry: [{ name: 'PE', count: 3 }, { name: 'US', count: 1 }] }).paises.map((p) => p.nombre), ['Perú', 'Estados Unidos']);
});

test('resultados: carritos, cumpleaños y la ficha de un cliente', () => {
  assert.equal(m2.quienDelCarrito({ uid: 'u' }, { displayName: 'Ana' }), 'Ana');
  assert.equal(m2.quienDelCarrito({}), 'Visitante sin cuenta');
  assert.equal(m2.quienDelCarrito({ uid: 'u' }), 'Cliente');
  assert.deepEqual(m2.cumpleanosDe([{ uid: 'u', nombre: 'Ana', dePersona: 'Luis', esTitular: false, fecha: '11-14', fechaLegible: '14 de noviembre', enDias: 5 }])[0],
    { id: 'u-11-14-Luis-0', enDias: 5, cuando: 'En 5 días', pronto: true, quien: 'Luis', detalle: '14 de noviembre · lo agendó Ana' });
  const ficha = {
    nombre: 'Ana Pérez', email: 'ana@correo.pe', dni: '71234567', phone: '987654321', monedas: 1200, hasCompletedSurvey: true, marketingConsent: { whatsapp: true },
    wishlist: { count: 1, items: [{ productId: 'p1', productName: 'Polo', price: 59.9, isGifted: true, giftedBy: 'Luis' }] },
    cart: { count: 1, unidades: 2, totalEstimado: 119.8, items: [{ productId: 'p1', productName: 'Polo', quantity: 2, price: 59.9, subtotal: 119.8, selected: false }] },
    giftRecipients: [{ id: 'g', name: 'Luis', roleDisplay: 'Pareja', events: [{ label: 'Cumpleaños', dateLegible: '14 de noviembre' }] }],
  };
  const r = m2.resumenDeFicha(ficha, { metrics: { totalSessions: 12, totalDwellMs: 125000 }, sessions: [{ clientType: 'APP' }, { clientType: 'WEB' }] });
  assert.equal(r.contacto, 'ana@correo.pe · Doc. 71234567 · 987654321');
  assert.deepEqual(r.chips, ['1,200 monedas', 'Completó la encuesta', 'Acepta WhatsApp']);
  assert.deepEqual(r.cifras.map((c) => c.valor), ['12', '0', '2m 5s', '0', '—', 'Sí']);
  assert.equal(r.notas[0], '1 en su lista de deseos · 1 en su carrito · 1 personas agendadas');
  assert.deepEqual(m2.resumenDeFicha(ficha, null).cifras, []);
  const l = m2.listasDeFicha(ficha, { productInterest: [{ productId: 'p1', dwellMs: 61000, views: 1 }] }, () => ({ nombre: 'Polo clásico', imagen: 'i' }));
  assert.equal(l.mira[0].detalle, '1m 1s · 1 vista');
  assert.equal(l.deseos[0].marca, 'Ya se lo regalaron (Luis)');
  assert.equal(l.carrito[0].detalle, '2 × S/ 59.90 = S/ 119.80');
  assert.equal(l.carrito[0].marca, 'Lo dejó para después');
  assert.equal(l.personas[0].fechas, 'Cumpleaños: 14 de noviembre');
  assert.equal(l.cumpleanos, 'No registró su cumpleaños.');
});

test('detalle técnico: rangos, tramos de 10 días y la calidad de los datos', () => {
  assert.deepEqual(m2.ultimosDias(30, new Date(2026, 10, 2)), { desde: '2026-10-04', hasta: '2026-11-02' });
  assert.equal(m2.diasEntreClaves('2026-10-04', '2026-11-02'), 30);
  assert.equal(m2.diasEntreClaves('2026-11-02', '2026-10-04'), null);
  const t = m2.tramosDeDias('2026-10-04', '2026-11-02');
  assert.deepEqual(t.map((x) => [x.fromDay, x.toDay]), [['2026-10-04', '2026-10-13'], ['2026-10-14', '2026-10-23'], ['2026-10-24', '2026-11-02']]);
  assert.deepEqual(m2.tramosDeDias('2026-11-02', '2026-11-02'), [{ fromDay: '2026-11-02', toDay: '2026-11-02' }]);
  assert.equal(m2.ayudaDeRango('2026-10-04', '2026-11-02').texto, 'Se reconstruirán 30 días.');
  assert.equal(m2.ayudaDeRango('2025-01-01', '2026-11-02').valido, false);
  assert.equal(m2.filasDeCalidad({ diasMedidos: 0 }), null);
  const f = m2.filasDeCalidad({ diasMedidos: 7, sesionesRegistradas: 1500, sesionesBot: 200, sesionesAdmin: 40, sinPaginas: 60, unidas: 100 }, { total: { total: 1100 } });
  assert.deepEqual(f.map((x) => x.valor), ['1,500', '200', '40', '60', '100', '1,100']);
  assert.equal(f[5].total, true);
});

test('pantallas técnicas: origen, tráfico por día, seguimiento, uso y navegador', () => {
  assert.deepEqual(m2.segunOrigen({ total: 10, app: 3, web: 7 }, 'app'), { valor: 3, sinDesglose: false });
  assert.deepEqual(m2.segunOrigen({ total: 10 }, 'web'), { valor: 10, sinDesglose: true });
  assert.deepEqual(m2.segunOrigen(5), { valor: 5, sinDesglose: false });
  const d1 = new Date(2026, 9, 1, 10).getTime();
  const d2 = new Date(2026, 9, 2, 10).getTime();
  const t = m2.traficoPorDia([{ type: 'page_view', clientTsMs: d2, clientType: 'APP' }, { type: 'page_view', clientTsMs: d1 }, { type: 'route_dwell', clientTsMs: d1 }, { type: 'page_view', createdAt: { seconds: d1 / 1000 } }]);
  assert.deepEqual(t.map((x) => [x.etiqueta, x.valores.total, x.valores.app, x.valores.web]), [['01/10', 2, 0, 2], ['02/10', 1, 1, 0]]);
  assert.deepEqual(m2.seguimientoDePedidos({ eventsForCharts: [
    { type: 'page_view', path: '/cuenta/pedidos?x=1', uid: 'a' }, { type: 'route_dwell', path: '/cuenta/pedidos/9', dwellMs: 4000, uid: 'a' },
    { type: 'route_dwell', path: '/cuenta/pedidos', dwellMs: 2000, anonymousId: 'b' }, { type: 'page_view', path: '/cuenta/pedidosx' },
  ] }), { views: 1, uniqueUsers: 2, totalDwellMs: 6000, avgDwellMs: 3000 });
  assert.equal(m2.claveAnonimaCorta('anon_3f9a1b2c'), 'anon_3f9a1b');
  const u = m2.listasDeUso({
    origen: 'app',
    datos: { __source: 'analytics_daily', totalSessions: { total: 100, app: 30, web: 70 }, pageViews: { total: 400 }, scrollDepth: { avgTotal: 52, avgApp: 61 }, avgDwellPerSessionMs: { total: 90000, app: 120000 },
      topIdentities: [{ clave: 'anon_x1', views: 3 }, { clave: 'u', logueado: true, nombre: 'Ana', views: 9, dwellMs: 60000 }],
      topRoutesByViews: [{ path: '/tienda', views: { total: 40, app: 0 } }, { path: '/', views: { total: 90, app: 12 } }] },
  });
  assert.equal(u.sinDesglose, true);
  assert.deepEqual(u.cifras.map((c) => c.valor), ['30', '400', '61%', '2m 0s']);
  assert.deepEqual(u.visitantes.map((v) => v.nombre), ['Ana', 'Visitante anónimo (anon_x1)']);
  assert.deepEqual(u.rutasVistas.map((r) => [r.id, r.valor]), [['/', 12]]);
  assert.equal(m2.nombreDePais('unknown'), 'Sin identificar');
  assert.equal(m2.nombreDePais('PE'), 'Perú');
  const n = m2.listasDeNavegador({
    comparar: true, anterior: { daysWithData: 5, sessions: { app: 10, web: 100 } },
    datos: { byClientType: [{ name: 'APP', count: 15 }, { name: 'WEB', count: 85 }], byDevice: [{ name: 'Mobile', count: 3 }, { name: 'Desktop', count: 1 }], extendedCoverage: { closedDocs: 30, docsWithBreakdowns: 26 } },
  });
  assert.deepEqual(n.cambioTipo.app, { texto: '▲ 50%', bueno: true });
  assert.deepEqual(n.tipos.map((x) => [x.nombre, x.texto]), [['App (instalada)', '15%'], ['Web (navegador)', '85%']]);
  assert.equal(n.cifras[1].valor, '4');
  assert.equal(n.diasSinPais, 4);
});

test('fidelidad: referidos, misiones y retos', () => {
  const estimar = (total) => Math.round(total * (total > 200 ? 0.1 : 0.05));
  const r = [
    m2.referidoDesdeFirestore({ id: 'a', status: 'sent', referrerCode: 'ANA1' }, estimar),
    m2.referidoDesdeFirestore({ id: 'b', status: 'purchased', referrerCode: 'ANA1', tipo: 'invitacion', orderId: 'P1', orderTotal: 300, visitanteNombre: 'Luis' }, estimar),
    m2.referidoDesdeFirestore({ id: 'c', status: 'claimed', referrerCode: 'ANA1', productId: 'x', orderId: 'P2', orderTotal: 100, earnedCoins: 7 }, estimar),
  ];
  assert.deepEqual(r.map((x) => [x.enlace, x.quien, x.monedas, x.estimado]), [['Enlace anterior', '', null, false], ['Invitación', 'Luis', 30, true], ['Producto x', 'Visitante sin cuenta', 7, false]]);
  assert.deepEqual(m2.resumenReferidos(r), { personas: 1, entraron: 2, sinAbrir: 1, cuentas: 0, compraron: 2, pagadas: 7, porPagar: 30 });
  const nuevos = [
    ...r,
    m2.referidoDesdeFirestore({ id: 'd', status: 'registered', referrerCode: 'BETO', tipo: 'invitacion', invitadoUid: 'u9', clickedAt: { seconds: 200 } }, estimar),
    m2.referidoDesdeFirestore({ id: 'e', status: 'clicked', referrerCode: 'BETO', tipo: 'producto', productId: 'p1', clickedAt: { seconds: 300 } }, estimar, (id) => (id === 'p1' ? 'Polo Kapi' : '')),
    m2.referidoDesdeFirestore({ id: 'f', status: 'sent', referrerCode: 'CARLA' }, estimar),
  ];
  const g = m2.referentesDesde(nuevos, { ANA1: { nombre: 'Ana Pérez', uid: 'u1' } });
  assert.deepEqual(g.map((x) => [x.codigo, x.nombre, x.abrieron, x.sinAbrir, x.cuentas, x.compraron, x.ventas, x.estado]), [
    ['ANA1', 'Ana Pérez', 2, 1, 0, 2, 400, 'compraron'],
    ['BETO', '', 2, 0, 1, 0, 0, 'visitas'],
    ['CARLA', '', 0, 1, 0, 0, 0, 'sinVisitas'],
  ]);
  assert.deepEqual(g[1].visitas.map((v) => v.enlace), ['Polo Kapi', 'Invitación']);
  const mi = m2.misionDesdeFirestore({ id: 'm', title: 'Visita', rewardPoints: '5', active: false });
  assert.equal(mi.activa, false);
  assert.deepEqual(m2.misionAFirestore({ ...mi, nombre: ' Visita ', monedas: '8' }), { title: 'Visita', description: '', rewardPoints: 8, order: 0, active: false, actionKey: '' });
  const re = m2.retoDesdeFirestore({ id: 'r', title: 'Tres deseos', actionType: 'add_wishlist', goal: 3, rewardCoins: 20 });
  assert.equal(m2.recompensaDeReto(re), '20 monedas');
  assert.deepEqual(m2.retoAFirestore({ ...re, tipo: 'kapi_double_3d', meta: 0 }), { title: 'Tres deseos', description: '', actionType: 'add_wishlist', goal: 1, rewardCoins: 0, rewardType: 'kapi_double_3d' });
  const act = m2.retoActivoDesde(re, new Date('2026-11-02T10:00:00Z'));
  assert.equal(act.challengeId, 'r');
  assert.equal(act.expiresAt, '2026-11-09T10:00:00.000Z');
  const ev = m2.evidenciaDesde({ id: 'e', challengeId: 'r', userName: 'Ana', evidenceType: 'image', evidenceUrl: 'u' }, [re]);
  assert.deepEqual([ev.reto, ev.tipo, ev.monedas], ['Tres deseos', 'imagen', 20]);
  assert.equal(m2.evidenciaDesde({ id: 'e2', challengeId: 'zz' }, [re], act).reto, 'Tres deseos');
});

test('recompensas: lo que da, lo que se guarda y sus errores', () => {
  assert.equal(m2.beneficioDeRecompensa({ tipo: 'descuento', descuentoPct: 10, topeDescuento: 20 }), '10% de descuento (hasta S/ 20.00)');
  assert.equal(m2.beneficioDeRecompensa({ tipo: 'descuento', descuentoMonto: 15 }), 'S/ 15.00 de descuento');
  assert.equal(m2.beneficioDeRecompensa({ tipo: 'producto_gratis', productoNombre: 'Taza Kapi' }), 'Taza Kapi gratis');
  assert.equal(m2.beneficioDeRecompensa({ tipo: 'manual' }), '');
  const r = m2.recompensaAdminDesdeFirestore({ id: 'x', title: 'Stickers', cost: '120', tipo: 'raro' });
  assert.equal(r.tipo, 'manual');
  assert.equal(r.vigenciaDias, 30);
  const g = m2.recompensaAdminAFirestore({ ...r, nombre: ' Taza ', tipo: 'envio_gratis', productoId: 'p1', productoNombre: 'Taza' });
  assert.equal(g.title, 'Taza');
  assert.equal(g.productId, '');
  assert.equal(m2.recompensaAdminAFirestore({ ...r, tipo: 'producto_gratis', productoId: 'p1', productoNombre: 'Taza' }).productName, 'Taza');
  assert.deepEqual(Object.entries(m2.erroresDeRecompensa({ nombre: '', tipo: 'producto_gratis' })).filter(([, v]) => v).map(([k]) => k), ['nombre', 'productoId']);
  assert.equal(m2.erroresDeRecompensa({ nombre: 'a', tipo: 'descuento', descuentoPct: 10 }).topeDescuento, 'Pon un tope en soles para el descuento por porcentaje.');
  assert.equal(m2.erroresDeRecompensa({ nombre: 'a', tipo: 'descuento', descuentoPct: 120, topeDescuento: 5 }).descuentoPct, 'El porcentaje va de 0 a 100.');
});

test('fechas importantes: el mes, las fechas de clientes y los paquetes', () => {
  const nov = m2.semanasDelMes(2026, 11, '2026-11-02');
  assert.equal(nov.titulo, 'noviembre de 2026');
  assert.equal(nov.semanas[0][0].iso, '2026-10-26');
  assert.equal(nov.semanas.flat().find((d) => d.hoy).iso, '2026-11-02');
  assert.equal(nov.semanas[0].at(-1).iso, '2026-11-01');
  assert.ok(nov.semanas.every((s) => s.length === 7));
  assert.equal(nov.semanas.at(-1).at(-1).iso, '2026-12-06');
  assert.deepEqual(m2.mesVecino(2026, 12, 1), { anio: 2027, mes: 1 });
  assert.deepEqual(m2.mesVecino(2026, 1, -1), { anio: 2025, mes: 12 });

  const f = m2.fechaClienteDesde({ userId: 'u', userEmail: 'a@b.pe', recipientId: 'r', recipientName: 'Lucía', eventId: 'e', eventType: 'Cumpleaños', eventDate: '1990-11-03' }, '2026-11-02');
  assert.deepEqual([f.id, f.dias, f.proxima, f.fecha, f.cumple], ['u_r_e', 1, '2026-11-03', '3 de noviembre de 1990', 36]);
  assert.equal(m2.cuandoFecha(f.dias), 'Mañana');
  const pasada = m2.fechaClienteDesde({ eventDate: '0000-10-01' }, '2026-11-02');
  assert.deepEqual([pasada.proxima, pasada.cumple, pasada.fecha], ['2027-10-01', null, '1 de octubre']);
  assert.equal(m2.fechaClienteDesde({ eventDate: '2000-02-29' }, '2027-02-01').proxima, '2027-02-28');
  assert.equal(m2.fechaClienteDesde({}, '2026-11-02').dias, null);
  assert.equal(m2.fechaEnVentana(f, '1'), true);
  assert.equal(m2.fechaEnVentana(pasada, '30'), false);

  const ps = [
    m2.paqueteDesdeFirestore({ id: 'a', userId: 'u', recipientId: 'r', eventType: 'Cumpleaños', isSelected: true, products: [{ id: 'p', name: 'Taza', price: 30 }] }),
    m2.paqueteDesdeFirestore({ id: 'b', userId: 'u', recipientId: 'r', eventType: 'Cumpleaños' }),
    m2.paqueteDesdeFirestore({ id: 'c', userId: 'u', recipientId: 'otra', eventType: 'Cumpleaños' }),
  ];
  const deF = m2.paquetesDeFecha(ps, f);
  assert.deepEqual(deF.map((p) => p.id), ['a', 'b']);
  assert.deepEqual(m2.cambiosAlElegir(deF, 'b'), [{ id: 'a', elegido: false }, { id: 'b', elegido: true }]);
  assert.equal(m2.siguienteElegido(deF, deF[0]), 'b');
  assert.equal(m2.siguienteElegido(deF, deF[1]), null);
  assert.equal(m2.estadoDePaquetes(deF).texto, 'Elegido (de 2)');
  assert.equal(m2.estadoDePaquetes([deF[1]]).texto, '1 borrador');
  assert.deepEqual(m2.paqueteAFirestore(deF[0].productos, f, true), { userId: 'u', recipientId: 'r', eventId: 'e', eventType: 'Cumpleaños', products: [{ id: 'p', name: 'Taza', price: 30, image: '' }], status: 'pending_notification', isSelected: true });

  assert.deepEqual(m2.diasDesdeTexto('7, 14 7 0 x'), [14, 7]);
  assert.deepEqual(m2.diasDesdeTexto('0, 1', 0), [1, 0]);
  assert.equal(m2.idDeFestiva('Día del Abuelo', ['dia_del_abuelo']), 'dia_del_abuelo_2');
});

test('notificaciones: la configuración, las campañas y la comparación', () => {
  const c = m2.configNotificacionesDesde({ categories: { promos: false }, schedules: { orders: { start: '07:00', end: '22:00' } }, copys: { cart_1h: { a: { text: 'Hola {nombre}', emoji: '👋', cta: 'Vuelve' }, b: { text: 'Otro' } } } });
  assert.equal(c.activos.promos, false);
  assert.equal(c.activos.survey, true);
  assert.deepEqual(c.horarios.orders, { desde: '07:00', hasta: '22:00' });
  assert.deepEqual(c.horarios.survey, { desde: '10:00', hasta: '20:00' });
  assert.equal(c.textos.cart_1h.b.texto, 'Otro');
  assert.equal(c.textos.cart_24h.b, null);
  assert.equal(m2.vistaPreviaAviso(c.textos.cart_1h.a), 'Hola María Vuelve 👋');
  const g = m2.configNotificacionesAFirestore(c);
  assert.equal(g.categories.promos, false);
  assert.deepEqual(g.schedules.orders, { start: '07:00', end: '22:00' });
  assert.deepEqual(g.copys.cart_1h.a, { text: 'Hola {nombre}', emoji: '👋', cta: 'Vuelve' });
  assert.equal(g.copys.cart_24h.b, null);
  assert.equal(m2.conDato('Tienes', 'monedas'), 'Tienes {monedas}');
  assert.equal(m2.conDato('', 'nombre'), '{nombre}');

  const camp = m2.campanaDesde({ id: 'k', title: 'Hoy 2x1', body: 'b', segment: 'raro', status: 'sent', inAppUsers: 200, opened: 30, sentAt: '2026-11-01T15:00:00Z' });
  assert.deepEqual([camp.segmento, camp.tasa, camp.abiertas, camp.fechaMs], ['all', '15 %', 30, Date.parse('2026-11-01T15:00:00Z')]);
  assert.equal(m2.campanaDesde({ status: 'scheduled' }).abiertas, null);
  assert.deepEqual(m2.ofertaAFirestore({ titulo: ' A ', mensaje: 'B', segmento: 'vip' }), { title: 'A', body: 'B', link: '', image: '', segment: 'vip', productId: '', productName: '' });
  const o = m2.ofertaDeProducto({ id: 'p', nombre: 'Taza', precio: 25, precioLista: 35.5, conOferta: true, imagen: 'i' });
  assert.equal(o.mensaje, 'Ahora a S/ 25 (antes S/ 35.50). Solo por tiempo limitado.');
  assert.equal(o.enlace, '/producto/p');
  assert.equal(m2.ofertaDeProducto({ id: 'p', nombre: 'Taza' }).titulo, '✨ Nuevo: Taza');

  const ahora = new Date(2026, 10, 2, 12).getTime();
  assert.equal(m2.programadaIso('2026-11-03', 10), new Date(2026, 10, 3, 10).toISOString());
  assert.equal(m2.programadaIso('', 10), '');
  const e1 = m2.erroresDeOferta({ titulo: '', mensaje: 'x', cuando: 'programar', dia: '2026-11-02', hora: 9 }, ahora);
  assert.deepEqual([e1.titulo, e1.dia], ['Escribe el título.', 'Esa hora ya pasó: elige una que venga.']);
  assert.equal(m2.erroresDeOferta({ titulo: 'a', mensaje: 'b', cuando: 'programar' }, ahora).dia, 'Elige el día y la hora del envío.');
  assert.equal(m2.erroresDeOferta({ titulo: 'a', mensaje: 'b', cuando: 'programar' }, ahora, true).dia, undefined);

  assert.deepEqual(m2.filaDeEstadistica({ id: 'cart_1h', a: { sent: 60, opened: 12 }, b: { sent: 55, opened: 20 } }).mejor, 'Texto 2');
  assert.equal(m2.filaDeEstadistica({ id: 'cart_1h', a: { sent: 10, opened: 1 }, b: { sent: 5 } }).mejor, 'Faltan envíos');
  const solo = m2.filaDeEstadistica({ id: 'orders', a: { sent: 8, opened: 2 } });
  assert.deepEqual([solo.nombre, solo.b, solo.mejor, solo.a.tasa], ['Pedidos', null, '', '25 %']);
});

test('encuestas: preguntas, la de entregas y volver a preguntar', () => {
  assert.deepEqual(m2.preguntaNueva('brandField', 5), { id: 'brandField_5', label: 'Nueva pregunta', type: 'text', required: false, options: [] });
  const campos = [{ id: 'a' }, { id: 'b', enEncuesta: false }, { id: 'c', enEncuesta: false }];
  const sep = m2.separarPreguntas(campos, [{ id: 'b', enEncuesta: false }, { id: 'c' }]);
  assert.deepEqual(sep.activas.map((x) => [x.pregunta.id, x.indice]), [['a', 0], ['c', 2]]);
  assert.deepEqual(sep.retiradas.map((x) => x.indice), [1]);
  assert.deepEqual(m2.conOpcion(['Sí'], ' sí '), ['Sí']);
  assert.deepEqual(m2.conOpcion(['Sí'], 'No'), ['Sí', 'No']);
  assert.deepEqual(m2.conOpcion(['Sí'], '  '), ['Sí']);

  assert.deepEqual(m2.entregaPanelDesde(null), { activo: true, monedas: 5, opcionesMejorar: m2.OPCIONES_MEJORAR_ENTREGA });
  assert.deepEqual(m2.entregaPanelDesde({ activo: false, monedas: 80, opcionesMejorar: [' Empaque ', ''] }), { activo: false, monedas: 50, opcionesMejorar: ['Empaque'] });
  assert.equal(m2.entregaPanelDesde({ monedas: 0 }).monedas, 0);
  // Como configEntregaPanel del servidor: null es 0, no 5.
  assert.equal(m2.entregaPanelDesde({ monedas: null }).monedas, 0);
  assert.deepEqual(m2.cambioEstrellas(4.6, 4.3), { texto: '▲ 0.3 ★', bueno: true });
  assert.equal(m2.cambioEstrellas(4, 4).texto, '= 0 ★');
  assert.equal(m2.estrellasTexto(4), '★★★★☆');

  assert.equal(m2.unidadDeRango('2026-10-01', '2026-11-02'), 'dia');
  assert.equal(m2.unidadDeRango('2026-01-01', '2026-11-02'), 'mes');
  assert.equal(m2.unidadDeRango('', ''), 'mes');
  assert.equal(m2.etiquetaDePeriodo('2026-11-02', 'dia'), '02/11');
  assert.equal(m2.etiquetaDePeriodo('2026-09', 'mes'), 'set 2026');
  assert.equal(m2.fechaDeDia('2026-10-23'), '23/10/2026');

  const cfg = { personPanel: { budget: false }, basicDataPanel: { fields: [{ id: 'x', enEncuesta: false }] }, brandsPanel: { categories: [{ id: 'fut', fields: [{ id: 'eq', enEncuesta: false }] }] } };
  assert.equal(m2.configConPregunta(cfg, { tipo: 'basico', id: 'x' }).basicDataPanel.fields[0].enEncuesta, true);
  assert.equal(m2.configConPregunta(cfg, { tipo: 'gusto', categoriaId: 'fut', id: 'eq' }).brandsPanel.categories[0].fields[0].enEncuesta, true);
  assert.equal(m2.configConPregunta(cfg, { tipo: 'presupuesto' }).personPanel.budget, true);
  assert.equal(cfg.basicDataPanel.fields[0].enEncuesta, false);
});

test('sorteos: ida y vuelta, errores y participantes', () => {
  assert.equal(m2.slugDeSorteo('  Gran Sorteo de Aniversario ¡2026! '), 'gran-sorteo-de-aniversario-2026');
  const s = m2.sorteoDesdeFirestore({ id: 's', titulo: 'Navidad', tipo: 'pagado', precioTicket: 5, premio: { nombre: 'Taza', valor: 30 }, estado: 'finalizado', contadorParticipantes: 12, requisitoApp: 'raro' });
  assert.deepEqual([s.estado, s.requisitoApp, s.participantes, s.premioNombre, m2.tipoDeSorteo(s)], ['cerrado', 'ninguno', 12, 'Taza', 'Rifa · S/ 5']);
  assert.equal(m2.sorteoDesdeFirestore({}).participantes, null);
  // La chance extra desde la app (la da el servidor) no se pierde al guardar.
  assert.equal(m2.sorteoDesdeFirestore({ requisitoApp: 'chanceExtra' }).requisitoApp, 'chanceExtra');
  const f = m2.sorteoAFormulario({ ...s, nombre: ' Navidad Walá ', slug: '', tipo: 'gratis', numGanadores: 0 });
  assert.deepEqual([f.titulo, f.slug, f.precioTicket, f.numGanadores, f.premioNombre], ['Navidad Walá', 'navidad-wala', 0, 1, 'Taza']);
  const e = m2.erroresDeSorteo({ nombre: '', tipo: 'pagado', precioTicket: 0, numGanadores: 1, inicio: '2026-12-10', fin: '2026-12-01' });
  assert.deepEqual(Object.entries(e).filter(([, v]) => v).map(([k]) => k), ['nombre', 'precioTicket', 'fin']);
  assert.deepEqual(m2.participanteDesde({ id: 'p', ticketsPagados: '2', origenApp: 1 }).pagados, 2);
  assert.deepEqual(m2.identificadorDe({ correo: ' a@b.pe ', telefono: '', dni: '1' }), { correo: 'a@b.pe', dni: '1' });
  assert.equal(m2.erroresDeAjuste({ cantidad: 2 }).correo, 'Escribe su correo, teléfono o DNI.');
  assert.equal(m2.erroresDeAjuste({ dni: '1', cantidad: 1.5 }).cantidad, 'Un número entero mayor a 0.');
  assert.equal(m2.erroresDeAjuste({ dni: '1', chances: -2 }, 'chances').chances, undefined);
  assert.equal(m2.erroresDeAjuste({ dni: '1', chances: 0 }, 'chances').chances, 'Un entero distinto de 0 (negativo resta).');
});

test('sorteos de suscripción: campañas, planes y suscriptores', () => {
  const c = m2.campanaSuscripcionDesde({ id: 'c', titulo: 'No Hay Sin Suerte', colores: { acento: '#7c3aed' }, planes: [{ id: 'p1', nombre: 'Mensual', intervalo: 'mensual', precioCentimos: 1990 }, { nombre: 'Anual', intervalo: 'anual', precioCentimos: 19900, chancesPorCiclo: 15 }] });
  assert.deepEqual([c.colores.acento, c.colores.fondo, c.planes[0].precio, c.planes[0].chances, c.planes[1].id, c.planes[1].chances], ['#7c3aed', '#ffffff', 19.9, 1, 'plan_1', 15]);
  assert.equal(m2.textoDePlanes(c.planes), '2 planes · desde S/ 19.90');
  assert.equal(m2.textoDePlanes([]), 'Sin planes');
  const f = m2.campanaSuscripcionAFormulario({ ...c, nombre: ' No Hay Sin Suerte ', premios: [{ nombre: '', imagen: '' }, { nombre: 'Casaca', imagen: 'u' }] });
  assert.deepEqual([f.titulo, f.slug, f.planes[0].precioCentimos, f.planes[1].meses, f.premios.length], ['No Hay Sin Suerte', 'no-hay-sin-suerte', 1990, 12, 1]);
  const pl = m2.planConIntervalo({ ...m2.planNuevo(1), chances: 1, meses: 1 }, 'trimestral');
  assert.deepEqual([pl.meses, pl.chances], [3, 3]);
  assert.equal(m2.planConIntervalo({ meses: 1, chances: 5 }, 'anual').chances, 5);
  assert.equal(m2.erroresDeCampanaSuscripcion({ nombre: 'x', numGanadores: 1, estado: 'activo', planes: [{ precio: 0 }] }).planes, 'Para activarla, agrega un plan con precio (S/ o USD) mayor a 0.');
  assert.equal(m2.erroresDeCampanaSuscripcion({ nombre: 'x', numGanadores: 1, estado: 'activo', planes: [{ precioUsd: 5 }] }).planes, undefined);
  const s = m2.suscriptorDesde({ id: 's', nombres: 'Ana', planId: 'p1', estado: 'activo', vigenciaHasta: { seconds: 10 }, chancesTotal: 3 }, c.planes);
  assert.deepEqual([s.nombre, s.plan, s.precio, s.vigenciaMs, s.chances], ['Ana', 'Mensual', 19.9, 10000, 3]);
  assert.deepEqual(m2.beneficioAFirestore(m2.beneficioDesde({ id: 'b', marca: 'Kapi', titulo: 'Tazas', descuento: '20%' })), { marca: 'Kapi', titulo: 'Tazas', descuento: '20%', imagenUrl: '', categoria: '', ubicacion: '', url: '', orden: 0 });
  assert.equal(m2.ganadorGaleriaAFirestore({ nombre: ' Rosa ', foto: 'f' }).fotoUrl, 'f');
});

test('enlaces: la página, su diseño, el enlace único y los clics', () => {
  // Un /l/… largo ya compartido no se corta (los sorteos sí, a 60).
  const largo = 'a'.repeat(70);
  assert.equal(m2.paginaEnlacesAFirestore({ slug: largo }).slug, largo);
  assert.equal(m2.slugDeSorteo(largo).length, 60);
  const p = m2.paginaEnlacesDesde({ id: 'a', titulo: 'Mis redes', slug: 'mis-redes', visitas: 9, diseno: { buttonTextColor: '#eeeeee' }, botones: [{ id: 'b2', titulo: 'Tienda', order: 1 }, { id: 'b1', titulo: 'WhatsApp', order: 0 }], redes: [{ id: 'r1', tipo: 'raro' }] });
  assert.deepEqual(p.botones.map((b) => b.id), ['b1', 'b2']);
  assert.deepEqual([p.diseno.titleColor, p.diseno.buttonColor, p.diseno.background.type, p.redes[0].tipo, p.estado], ['#eeeeee', '#111827', 'color', 'custom', 'activo']);
  const g = m2.paginaEnlacesAFirestore({ ...p, nombre: ' Mis redes ', slug: 'Mis Redes!', botones: [p.botones[1], p.botones[0]] });
  assert.deepEqual([g.titulo, g.slug, g.botones[0].id, g.botones[0].order, g.botones[1].thumbnailUrl], ['Mis redes', 'mis-redes', 'b2', 0, '']);
  assert.match(m2.botonEnlaceNuevo(5).id, /^btn_5_/);
  const otras = [{ id: 'z', slug: 'catalogo' }];
  assert.equal(m2.erroresDeEnlaces({ id: 'a', nombre: 'Catálogo', slug: '' }, otras).slug, 'Ya hay otra página en /l/catalogo: elige otro.');
  assert.equal(m2.erroresDeEnlaces({ id: 'z', nombre: 'Catálogo' }, otras).slug, undefined);
  assert.equal(m2.erroresDeEnlaces({ nombre: '' }).nombre, 'Escribe el título de la página.');
  const c = m2.clicsDeEnlaces({ b1: 3, b2: 1, r1: 4 }, p.botones, p.redes);
  assert.equal(c.total, 8);
  assert.deepEqual(c.filas.map((f) => f.texto), ['3 · 38 %', '1 · 13 %', '4 · 50 %']);
  assert.equal(c.filas[2].nombre, 'Red: Otra');
});

test('popups, páginas y temas', () => {
  assert.equal(m2.cuandoPopup({ disparador: 'scroll', scrollPct: 40 }), 'al bajar 40 %');
  assert.equal(m2.cuandoPopup({ disparador: 'tiempo', segundos: 0 }), 'apenas entra');
  const e = m2.erroresDePopup({ formato: 'imagen', titulo: '', objetivo: 'enlace', botonUrl: '', paginas: 'elegidas', rutas: [] });
  assert.deepEqual(Object.entries(e).filter(([, v]) => v).map(([k]) => k), ['titulo', 'imagenUrl', 'botonUrl', 'rutas']);
  assert.equal(m2.erroresDePopup({ formato: 'tarjeta', titulo: 'a', botonTexto: '', objetivo: 'encuesta' }).botonTexto, 'Escribe el texto del botón.');

  assert.equal(m2.slugDeLanding('/Promo Navidad '), 'promo-navidad');
  const marcas = [{ id: 'm1', slug: 'Daida', name: 'Daida Hogar' }];
  const de = m2.landingDesde({ id: 'daida', slug: 'Daida', brandId: 'm1', title: 'Daida' }, marcas);
  assert.deepEqual([de.deMarca, de.marcaNombre], [true, 'Daida Hogar']);
  assert.equal(m2.landingDesde({ id: 'x', slug: 'promo', brandId: 'm1' }, marcas).deMarca, false);
  assert.equal(m2.erroresDeLanding({ id: 'n', nombre: 'Otra', slug: 'Promo' }, [{ id: 'p', slug: 'promo' }]).slug, 'Ya hay una página con esa dirección: escoge otra.');
  assert.deepEqual(m2.landingAFirestore({ nombre: ' Promo ', slug: 'promo-2', marcaId: '' }, { slug: 'promo', slugsAnteriores: ['promo-2', 'vieja'] }), { title: 'Promo', brandId: '', slug: 'promo-2', slugsAnteriores: ['vieja', 'promo'] });
  assert.equal(m2.landingAFirestore({ nombre: 'Daida', slug: 'Daida', deMarca: true }).slug, 'Daida');

  const tz = m2.temaDesdeCss({ principal: '/*\nTheme Name: Astra\nAuthor: Brainstorm\nVersion: 4.1\n*/', todos: ['a{}', 'b{}'], archivo: 'astra.zip' });
  assert.deepEqual([tz.nombre, tz.autor, tz.version, tz.css.includes('Siguiente Archivo')], ['Astra', 'Brainstorm', '4.1', true]);
  assert.equal(m2.temaDesdeCss({ todos: ['x{}'], archivo: 'mio.zip' }).nombre, 'mio');
  assert.equal(m2.pesoTexto('a'.repeat(2048)), '2.0 KB');
  assert.deepEqual(m2.temaAFirestore({ nombre: 'Oscuro', css: 'body{}' }), { name: 'Oscuro', author: 'Custom', type: 'custom_css', cssContent: 'body{}', version: '1.0' });
});

test('juegos: la palabra del día y las bolitas', () => {
  assert.equal(m2.palabraLimpia(' Regaló '), 'REGALO');
  assert.deepEqual(['2026-11-01', '2026-11-02', '2026-11-09'].map((id) => m2.palabraDiaDesde({ id }, '2026-11-02').estado), ['paso', 'hoy', 'programada']);
  const lista = [{ id: '2026-11-09' }];
  assert.equal(m2.erroresDePalabra({ fecha: '2026-11-09', palabra: 'KAPI' }, lista).fecha, 'Ese día ya tiene palabra: edítala en la lista.');
  assert.equal(m2.erroresDePalabra({ fecha: '2026-11-09', palabra: 'KAPI' }, lista, '2026-11-09').palabra, 'De 5 a 8 letras.');
  assert.equal(m2.erroresDePalabra({ fecha: 'x', palabra: 'feliz dia' }).palabra, 'Solo letras, sin espacios.');
  assert.equal(m2.erroresDePalabra({ fecha: 'x', palabra: 'Canción' }).palabra, undefined);

  assert.equal(m2.modoDeCupon({ tipo: 'descuento', descuentoMonto: 10 }), 'monto');
  assert.deepEqual(m2.cuponConModo(m2.CUPON_JUEGO_VACIO, 'monto').descuentoMonto, 10);
  assert.equal(m2.textoCuponJuego({ tipo: 'descuento', descuentoPct: 10, topeDescuento: 20, vigenciaDias: 15 }), '10 % (tope S/ 20) · 15 días');
  assert.equal(m2.erroresDeCupon({ tipo: 'descuento', descuentoPct: 60, vigenciaDias: 15 }).valor, 'De 1 a 50 %.');
  const e = m2.erroresDePatrocinio({ fecha: '2026-11-01', marcaId: '', cupo: 0, cupon: m2.CUPON_JUEGO_VACIO }, [], null, '2026-11-02');
  assert.deepEqual(Object.entries(e).filter(([, v]) => v).map(([k]) => k), ['fecha', 'marcaId', 'cupo']);
  assert.equal(m2.patrocinioDesde({ fecha: '2026-11-02', cupo: 50 }, '2026-11-02').hoy, true);

  const pr = m2.premiosBolitasDesde({ puestos: [{ desde: 1, hasta: 3, cupon: { descuentoPct: 20 } }] });
  assert.deepEqual([pr.activo, pr.puestos[0].cupon.vigenciaDias], [true, 15]);
  assert.equal(m2.premiosBolitasDesde(null).activo, false);
  assert.deepEqual(m2.nuevoPuesto(pr.puestos).desde, 4);
  assert.equal(m2.erroresDePremios({ puestos: [...pr.puestos, { desde: 3, hasta: 5, cupon: m2.CUPON_JUEGO_VACIO }] }), 'Los premios 1 y 2 se pisan en los puestos.');
  assert.equal(m2.erroresDePremios({ puestos: [{ desde: 4, hasta: 2, cupon: m2.CUPON_JUEGO_VACIO }] }), 'El premio 1: «hasta» no puede ser menor que «desde».');
  assert.equal(m2.premiosBolitasAFirestore(pr, [{ id: 'm', name: 'Kapi' }]).puestos[0].marcaId, null);

  const m = m2.metricasBolitas({ porDia: [{ fecha: '2026-11-02', partidas: 5, retos: 2, clics: 1, clicsPorMarca: { a: 1 } }, { fecha: '2026-11-01', partidas: 3, niveles: { 4: 2 } }], jugadores: { jugadores: 40, vuelven: { cantidad: 10, base: 40 }, trabados: { 12: 3, 7: 5 } } });
  assert.deepEqual([m.partidas, m.retos, m.vuelven, m.siguen7, m.trabados[0].nivel, m.porDia[0].fecha, m.clicsMarca.a], [8, 2, 25, null, '7', '2026-11-01', 1]);
});

test('la ruleta: días, premios, por qué no sale hoy y entregas', () => {
  assert.equal(m2.textoDiasRuleta([]), 'Todos los días');
  assert.equal(m2.textoDiasRuleta([5, 1]), 'Solo lunes y viernes');
  assert.equal(m2.textoDiasRuleta([0]), 'Solo domingo');
  const f = m2.premioRuletaAFormulario({ id: 'p', nombre: 'Taza', stockTotal: null, color: null, dias: [1] });
  assert.deepEqual([f.stockTotal, f.color, f.desde], ['', '', '']);
  const g = m2.premioRuletaAFirestore({ ...f, nombre: ' Taza ', tipo: 'monedas', productId: 'x', stockTotal: '5', stockUsado: 3 });
  assert.deepEqual([g.nombre, g.stockTotal, g.maxPorUsuario, g.productId, g.color, 'stockUsado' in g, 'id' in g], ['Taza', 5, null, null, null, false, false]);
  const e = m2.erroresDePremioRuleta({ nombre: '', probabilidad: 0, tipo: 'descuento', descuentoPct: 10, topeDescuento: 0, desde: '2026-11-10', hasta: '2026-11-01' });
  assert.deepEqual(Object.entries(e).filter(([, v]) => v).map(([k]) => k), ['nombre', 'probabilidad', 'topeDescuento', 'hasta']);
  assert.equal(m2.erroresDePremioRuleta({ nombre: 'a', probabilidad: 5, tipo: 'producto_gratis' }).productId, 'Elige el producto del premio.');
  const base = { activo: true, probabilidad: 10, stockTotal: null, stockUsado: 0, dias: [] };
  assert.equal(m2.motivoRuletaHoy(base, '2026-11-02', 1), '');
  assert.equal(m2.motivoRuletaHoy({ ...base, stockTotal: 2, stockUsado: 2 }, '2026-11-02', 1), 'Agotado');
  assert.equal(m2.motivoRuletaHoy({ ...base, dias: [5] }, '2026-11-02', 1), 'Hoy no es su día');
  assert.equal(m2.motivoRuletaHoy({ ...base, hasta: '2026-11-01' }, '2026-11-02', 1), 'Ya terminó');
  assert.deepEqual(m2.ganadoRuletaDesde({ id: 'w', type: 'manual', name: 'Peluche', uid: 'u' }), { id: 'w', quien: '', correo: 'u', premio: 'Peluche', tipo: 'manual', cupon: '', semana: '', entregado: false, manual: true });
});

test('configuración: el equipo, los bloqueos, las imágenes y los idiomas', () => {
  const a = m2.adminDesdeFirestore({ id: 'ana@gmail.com', email: 'Ana@Gmail.com', permissions: ['manage_products'] });
  assert.deepEqual(a, { id: 'ana@gmail.com', correo: 'ana@gmail.com', nombre: 'ana', permisos: ['manage_products'] });
  assert.deepEqual(m2.adminAFirestore({ correo: ' Luis@X.pe ', nombre: '', permisos: ['manage_inventory', 'superadmin'] }), { correo: 'luis@x.pe', datos: { name: 'luis', permissions: ['superadmin'] } });
  assert.deepEqual(m2.adminAFirestore({ correo: 'a@b.c', nombre: 'A', permisos: ['manage_clients', 'manage_design'] }).datos.permissions, ['manage_design', 'manage_clients']);
  const reg = [a];
  assert.equal(m2.erroresDeAdmin({ correo: 'ana@gmail.com', permisos: ['x'] }, { registros: reg }).correo, 'Ya está en el equipo: edítalo en la lista.');
  assert.equal(m2.erroresDeAdmin({ correo: 'ana@gmail.com', permisos: ['x'] }, { id: 'ana@gmail.com', registros: reg }).correo, undefined);
  assert.equal(m2.erroresDeAdmin({ correo: 'ana@', permisos: [] }).correo, 'Ese correo no está bien escrito.');
  assert.equal(m2.erroresDeAdmin({ correo: 'yo@w.pe', permisos: ['manage_design'] }, { id: 'yo@w.pe', yo: 'Yo@w.pe' }).permisos, 'Te quitarías el acceso a esta página: deja Super Admin.');
  assert.equal(m2.textoPermisos(['manage_inventory', 'manage_products']), 'Catálogo · Inventario');
  assert.equal(m2.textoPermisos(['superadmin', 'manage_products']), 'Super Admin');
  const pags = m2.paginasBloqueables([{ id: 'l1', title: 'Navidad', slug: 'navidad' }], ['tienda', 'l1']);
  assert.deepEqual(pags.map((p) => [p.id, p.bloqueada, p.tipo]), [['home', false, 'fija'], ['tienda', true, 'fija'], ['footer', false, 'fija'], ['l1', true, 'landing']]);
  assert.deepEqual(m2.conBloqueo(['home'], 'home', true), ['home']);
  assert.deepEqual(m2.conBloqueo(['home', 'x'], 'home', false), ['x']);
  assert.equal(m2.textoConteoImagenes({ imagenes: 0 }), 'No queda ninguna imagen por convertir.');
  assert.equal(m2.textoConteoImagenes({ imagenes: 1, documentos: 1, apariciones: 3 }), 'Hay 1 imagen por revisar en 1 documento (aparecen 3 veces: una misma puede estar en varios sitios). Solo se reescriben las que lo necesitan.');
  assert.equal(m2.textoResultadoImagenes({ convertidas: 4, documentos: 2, saltadas: 1 }), '4 imágenes convertidas en 2 documentos; 1 se dejó como estaba (ya estaba bien o el WebP no la mejoraba).');
  assert.deepEqual(m2.traduccionesPorIdioma({ en: 12, pt: 0, fr: 2 }), [{ idioma: 'en', nombre: 'Inglés', cuantas: 12 }, { idioma: 'fr', nombre: 'FR', cuantas: 2 }]);
});

test('whatsapp: los números, el general, los errores y el mensaje del pedido', () => {
  const c = m2.whatsappDesdeMensajes({ whatsapp_number: '+51 900 000 001', whatsapp_number_crear: ' 987 654 321 ', whatsapp_mostrar_en_acceso: 'si' });
  assert.deepEqual(c, { tienda: '+51 900 000 001', crear: '987 654 321', cuenta: '', mensajePedido: m2.MENSAJE_PEDIDO_POR_DEFECTO, enAcceso: true });
  const g = m2.whatsappAMensajes({ ...c, enAcceso: false });
  assert.deepEqual([g.whatsapp_number, g.whatsapp_number_tienda, g.whatsapp_mostrar_en_acceso, 'whatsapp_text_crear' in g], ['+51 900 000 001', '+51 900 000 001', 'no', false]);
  // Mi cuenta vacío se guarda con el de la tienda (respaldo de "¿Problemas para pagar?").
  assert.equal(g.whatsapp_number_cuenta, '+51 900 000 001');
  assert.equal(m2.whatsappAMensajes({ ...c, cuenta: ' 911 222 333 ' }).whatsapp_number_cuenta, '911 222 333');
  assert.equal(m2.telefonoEscrito('+51 (987) abc-654'), '+51 (987) -654');
  const e = m2.erroresDeWhatsApp({ tienda: '', crear: '98765', cuenta: '' });
  assert.deepEqual([Boolean(e.tienda), e.crear, e.cuenta], [true, 'Revisa el número: tiene 5 dígitos.', undefined]);
  assert.equal(m2.mensajePedidoDeEjemplo('Pedido {id} y {id}', 'X'), 'Pedido X y X');
});

test('historial: la versión actual de cada página, el stock y el CSV', () => {
  const cambios = [
    { id: 'a', timestamp: '2026-11-02T15:00:00.000Z', description: 'Guardado desde el Editor Visual (Página: tienda)', config: {} },
    { id: 'b', timestamp: '2026-11-01T15:00:00.000Z', pageId: 'home' },
    { id: 'c', timestamp: '2026-10-30T15:00:00.000Z', pageId: 'tienda' },
  ].map(m2.cambioDisenoDesde);
  assert.equal(cambios[0].pagina, 'tienda');
  assert.equal(cambios[0].cuando, Date.parse('2026-11-02T15:00:00.000Z'));
  assert.deepEqual(m2.conVersionActual(cambios).map((x) => x.actual), [true, true, false]);
  assert.equal(m2.nombreDePaginaGuardada('home'), 'Página principal');
  assert.equal(m2.nombreDePaginaGuardada('promo-navidad'), '/promo-navidad');
  const mov = m2.movimientoInventarioDesde({ id: 'i', timestamp: Date.parse('2026-11-02T20:05:00Z'), productName: 'Polo "Kapi", talla M', oldStock: 5, newStock: 2 });
  assert.deepEqual([mov.cambio, mov.quien, m2.textoCambioStock(mov.cambio), m2.textoCambioStock(3)], [-3, 'Desconocido', '−3', '+3']);
  assert.equal(m2.csvInventario([mov]).split('\n')[1], '02/11/2026,15:05,Desconocido,"Polo ""Kapi"", talla M",5,2,-3');
  const limite = m2.movimientoInventarioDesde({ oldStock: null, newStock: 3 });
  assert.equal(limite.antes, null);
  assert.equal(limite.cambio, 0);
  assert.equal(m2.textoStock(limite.antes), 'Sin límite');
});

test('papelera: cuándo se borra, qué era y quién lo usa', () => {
  const ahora = Date.parse('2026-11-04T12:00:00Z');
  const dia = 24 * 60 * 60 * 1000;
  const lista = m2.papeleraDesde([
    { id: 'a', name: 'Polo', deleted: true, deletedAt: '2026-09-10T00:00:00Z' },
    { id: 'b', name: 'Taza', deleted: true, papeleraDesde: ahora - 29.5 * dia, visibleAntes: true },
    { id: 'c', name: 'Gorro', deleted: true, esComboCrear: true, papeleraDesde: ahora - 31 * dia },
    { id: 'combo', name: 'Combo', isComboProduct: true, comboItems: [{ productId: 'a' }] },
  ], ahora);
  assert.deepEqual(lista.map((x) => [x.id, x.que, x.dias]), [['a', 'Tienda', 30], ['b', 'Tienda', 1], ['c', 'Pack de Crear', 0]]);
  assert.deepEqual(lista[0].usadoPor, ['Combo']);
  assert.deepEqual(lista[1].usadoPor, []);
  assert.equal(lista[1].visibleAntes, true);
  assert.equal(lista[0].seFue, Date.parse('2026-09-10T00:00:00Z'));
  assert.equal(m2.textoSeBorra(0), 'Hoy');
  assert.equal(m2.textoSeBorra(1), 'En 1 día');
});

test('papelera: personalizarEn, premios, piezas en la papelera, borrar y restaurar juntos', () => {
  const ahora = Date.parse('2026-11-04T12:00:00Z');
  const productos = [
    { id: 'prenda1', name: 'Polo Crear', deleted: true, esPrendaBase: true },
    { id: 'tienda1', name: 'Polo tienda', personalizarEn: '/crear/prenda1' },
    { id: 'pieza', name: 'Pieza', deleted: true },
    { id: 'combo', name: 'Combo', deleted: true, isComboProduct: true, comboItems: [{ productId: 'pieza' }] },
    { id: 'premiado', name: 'Taza', deleted: true },
  ];
  const premios = [{ id: 'r1', nombre: 'Premio de la ruleta «Taza gratis»', productId: 'premiado' }];
  const lista = m2.papeleraDesde(productos, ahora, premios);
  const de = (id) => lista.find((x) => x.id === id);
  assert.deepEqual(de('prenda1').usadoPor, ['Polo tienda']);
  assert.deepEqual(de('premiado').usadoPor, ['Premio de la ruleta «Taza gratis»']);
  assert.deepEqual(de('pieza').usadoPor, []);
  assert.deepEqual(de('combo').necesita, ['pieza']);
  // La pieza sola no se borra (la usa el combo, que se queda); con el combo, sí.
  assert.deepEqual(m2.borrablesDePapelera(lista, ['pieza']), []);
  assert.deepEqual(m2.borrablesDePapelera(lista, ['pieza', 'combo']).sort(), ['combo', 'pieza']);
  assert.deepEqual(m2.borrablesDePapelera(lista, lista.map((x) => x.id)).sort(), ['combo', 'pieza']);
  // Restaurar el combo trae su pieza.
  assert.deepEqual(m2.restaurablesDePapelera(lista, ['combo']).sort(), ['combo', 'pieza']);
});

test('tipo por categoría: quién cambia al guardar y qué se sugiere', () => {
  const productos = [
    { id: 'a', categories: ['polos'], productType: 'prenda' },
    { id: 'b', categories: ['polos'] },
    { id: 'c', categoryId: 'polos', productType: 'accesorio' },
    { id: 'd', categories: ['tazas', 'polos'] },
    { id: 'e', categories: ['polos'], deleted: true },
    { id: 'f', categories: ['polos'], productType: { id: 'prenda' } },
  ];
  assert.deepEqual(m2.tiposParaSincronizar(productos, 'polos', 'prenda'), [{ id: 'b', productType: 'prenda' }, { id: 'c', productType: 'prenda' }]);
  assert.deepEqual(m2.tiposParaSincronizar(productos, 'polos', '').map((x) => x.id), ['a', 'c', 'f']);
  assert.equal(m2.tiposSugeridosDeCategorias(productos).get('polos'), 'prenda');
  assert.equal(m2.categoriaAFirestore({ nombre: 'Polos', tipo: 'prenda' }).productType, 'prenda');
  assert.equal(m2.categoriaDesdeFirestore({ id: 'x', productType: 'prenda' }).tipo, 'prenda');
});
