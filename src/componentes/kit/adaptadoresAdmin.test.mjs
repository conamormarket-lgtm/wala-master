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
  assert.deepEqual(m2.filasMigracion({ dryRun: true, candidateUserIds: 4, wouldMigrate: 3, alreadyInTarget: 1 }).map((f) => f.texto), ['Candidatos', 'Se migrarían', 'Ya estaban en la colección nueva']);
  assert.deepEqual(m2.filasMigracion({ dryRun: false, migrated: 2 }).map((f) => [f.texto, f.valor]), [['Migrados', 2]]);
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
  assert.deepEqual(m2.resumenReferidos(r), { enlaces: 3, entraron: 2, compraron: 2, pagadas: 7, porPagar: 30 });
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
