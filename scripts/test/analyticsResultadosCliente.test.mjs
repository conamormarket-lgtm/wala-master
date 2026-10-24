import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

// combineDailyDocs (src/services/analyticsDaily.js) con Firestore simulado: une
// los campos de "Resultados" de varios días. Correr con --experimental-vm-modules.
async function cargarLector() {
  const context = vm.createContext({ console });
  const modulos = new Map();
  const mocks = {
    './firebase/firestore': { getDocument: () => ({}), getCollection: () => ({}) },
  };
  async function cargar(id) {
    if (modulos.has(id)) return modulos.get(id);
    const m = Object.hasOwn(mocks, id)
      ? new vm.SyntheticModule(Object.keys(mocks[id]), function () {
        for (const [k, v] of Object.entries(mocks[id])) this.setExport(k, v);
      }, { context, identifier: id })
      : new vm.SourceTextModule(await readFile(id, 'utf8'), { context, identifier: id });
    modulos.set(id, m);
    return m;
  }
  const resolver = (spec, padre) => {
    if (Object.hasOwn(mocks, spec)) return cargar(spec);
    const r = path.resolve(path.dirname(padre.identifier), spec);
    return cargar(path.extname(r) ? r : `${r}.js`);
  };
  const raiz = await cargar(path.resolve('src/services/analyticsDaily.js'));
  await raiz.link(resolver);
  await raiz.evaluate();
  return raiz.namespace._combinarDocsDiarios;
}

// Los objetos vienen de otro contexto de vm: se comparan como datos planos.
const plano = (x) => JSON.parse(JSON.stringify(x));
const taw = (total, app = 0) => ({ total, app, web: total - app });

const dia1 = {
  day: '2026-10-24',
  visitas: { total: taw(10, 2), conInteraccion: taw(4, 1), paginas: taw(30), dwellMs: taw(0), pedidos: taw(1) },
  ventas: { pedidos: taw(1), ingresosCents: taw(7980), unidades: taw(2) },
  topVendidos: [{ productId: 'polo', unidades: 2, ingresosCents: 7980, pedidos: 1, linea: 'polos' }],
  otrosCobros: { sorteo: { cantidad: 1, porMoneda: { PEN: 1000 } } },
  carritosAbandonados: {
    cantidad: taw(2), valorCents: taw(6000),
    lista: [
      { sessionId: 's1', uid: 'u1', nombre: 'Lucía', valorCents: 5000, ts: 100, clientType: 'WEB' },
      { sessionId: 's2', uid: null, nombre: null, valorCents: 1000, ts: 300, clientType: 'WEB' },
    ],
  },
  interes: {
    pares: [{ uid: 'u1', productId: 'polo', nombre: 'Lucía', dwellMs: 40000, visitas: 2, ultimaMs: 100 }],
    productos: [{ productId: 'polo', dwellMs: 40000, personas: 1, anonimos: 0 }],
  },
  deseos: { agregados: taw(1), quitados: taw(0), topProductos: [{ productId: 'polo', nombre: 'Polo', agregados: 1 }] },
  crear: { aperturas: taw(3), aperturasCombo: taw(1), guardados: taw(1) },
};

const dia2 = {
  day: '2026-10-25',
  visitas: { total: taw(10, 2), conInteraccion: taw(6, 1), paginas: taw(30), dwellMs: taw(0), pedidos: taw(1) },
  ventas: { pedidos: taw(1, 1), ingresosCents: taw(2500, 2500), unidades: taw(1, 1) },
  topVendidos: [
    { productId: 'taza', unidades: 1, ingresosCents: 2500, pedidos: 1, linea: null },
    { productId: 'polo', unidades: 1, ingresosCents: 3990, pedidos: 1, linea: null },
  ],
  otrosCobros: { sorteo: { cantidad: 2, porMoneda: { PEN: 500 } }, pago_rapido: { cantidad: 1, porMoneda: { USD: 2000 } } },
  carritosAbandonados: {
    cantidad: taw(1), valorCents: taw(2000),
    lista: [{ sessionId: 's3', uid: 'u3', nombre: 'Pedro', valorCents: 2000, ts: 200, clientType: 'APP' }],
  },
  interes: {
    pares: [{ uid: 'u1', productId: 'polo', nombre: null, dwellMs: 20000, visitas: 1, ultimaMs: 500 }],
    productos: [{ productId: 'polo', dwellMs: 20000, personas: 1, anonimos: 2 }],
  },
  deseos: { agregados: taw(2), quitados: taw(1), topProductos: [{ productId: 'taza', nombre: 'Taza', agregados: 2 }] },
  crear: { aperturas: taw(1), aperturasCombo: taw(0), guardados: taw(0) },
};

// Un día anterior al 2026-10-24: sin campos de Resultados.
const diaViejo = { day: '2026-10-20', pageViews: taw(50) };

test('une ventas, cobros, carritos, interés, deseos y Crear de varios días', async () => {
  const combinar = await cargarLector();
  const r = plano(combinar([diaViejo, dia1, dia2], []));

  assert.equal(r.diasConResultados, 2);
  assert.deepEqual(r.ventas.pedidos, { total: 2, app: 1, web: 1 });
  assert.equal(r.ventas.ingresosCents.total, 10480);
  assert.deepEqual(r.topVendidos.map((p) => [p.productId, p.ingresosCents, p.pedidos, p.linea]), [
    ['polo', 11970, 2, 'polos'],
    ['taza', 2500, 1, null],
  ]);
  assert.deepEqual(r.otrosCobros, {
    sorteo: { cantidad: 3, porMoneda: { PEN: 1500 } },
    pago_rapido: { cantidad: 1, porMoneda: { USD: 2000 } },
  });

  assert.equal(r.carritosAbandonados.cantidad.total, 3);
  assert.equal(r.carritosAbandonados.valorCents.total, 8000);
  // Con cuenta primero (el más reciente arriba), después los anónimos.
  assert.deepEqual(r.carritosAbandonados.lista.map((c) => c.sessionId), ['s3', 's1', 's2']);
  assert.deepEqual(r.abandonedCarts[0], {
    id: 's3', uid: 'u3', hasAccount: true, displayName: 'Pedro', email: null,
    clientType: 'APP', lastCartValue: 2000, abandonedAtMs: 200,
  });

  assert.deepEqual(r.interes.pares, [{ uid: 'u1', productId: 'polo', nombre: 'Lucía', dwellMs: 60000, visitas: 3, ultimaMs: 500 }]);
  assert.deepEqual(r.interes.productos, [{ productId: 'polo', dwellMs: 60000, personas: 2, anonimos: 2 }]);
  assert.equal(r.deseos.agregados.total, 3);
  assert.equal(r.deseos.quitados.total, 1);
  assert.deepEqual(r.deseos.topProductos.map((p) => p.productId), ['taza', 'polo']);
  assert.deepEqual(r.crear.aperturas, { total: 4, app: 0, web: 4 });
  assert.equal(r.crear.guardados.total, 1);

  // "Se fueron sin hacer nada": 20 visitas, 10 con interacción → 50 %.
  assert.deepEqual(r.bounceRate, { total: 50, app: 50, web: 50 });
});

test('un rango sin días nuevos queda en cero y sin listas', async () => {
  const combinar = await cargarLector();
  const r = plano(combinar([diaViejo], []));
  assert.equal(r.diasConResultados, 0);
  assert.deepEqual(r.topVendidos, []);
  assert.deepEqual(r.abandonedCarts, []);
  assert.deepEqual(r.otrosCobros, {});
  assert.deepEqual(r.bounceRate, { total: 0, app: 0, web: 0 });
});
