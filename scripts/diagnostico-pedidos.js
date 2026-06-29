/**
 * Diagnóstico de pedidos — ¿por qué "Recepción de Pedidos" sale vacío?
 * ────────────────────────────────────────────────────────────────────────────
 * SOLO LECTURA. No escribe ni borra nada. Lee las colecciones del ERP
 * (pedidos_web y pedidos) en la base (default) y reporta:
 *   - cuántos docs hay,
 *   - cuántos cumplen la regla esPedidoWala (canalVenta:'Portal Web' || web===true
 *     || activador==='portal_web' || vendedor==='Portal Web'),
 *   - qué valores de canalVenta existen y cuántos de cada uno,
 *   - cuántos tienen createdAt y de qué tipo (Timestamp / string / falta) —porque el
 *     panel ordena por createdAt y Firestore EXCLUYE los docs sin ese campo—,
 *   - distribución de estadoValidacion / estadoGeneral,
 *   - una muestra de 6 docs con los campos clave.
 *
 * Lee SIN orderBy (por id) para NO excluir docs sin createdAt: así vemos TODO.
 *
 * USO (Cloud Shell, ya autenticado):
 *   cd ~/wala-master
 *   gcloud config set project sistema-gestion-3b225   # si hace falta
 *   node scripts/diagnostico-pedidos.js --project sistema-gestion-3b225
 *
 * Local con service account:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/ruta/serviceAccount.json"
 *   node scripts/diagnostico-pedidos.js --project sistema-gestion-3b225
 *
 * Flags: --project <id>  proyecto destino · --limit <n>  docs por colección (def. 500)
 */

'use strict';

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const argv = process.argv.slice(2);
const getOpt = (name, def = null) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};
const projectId =
  getOpt('--project') ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  'sistema-gestion-3b225';
const PER_COLLECTION = getOpt('--limit') ? parseInt(getOpt('--limit'), 10) : 500;
// --buscar <texto>: busca un pedido por código/numeroPedido/dni en pedidos_web y pedidos.
const BUSCAR = getOpt('--buscar');

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// Misma regla que src/services/adminOrders.js / usePedidos.js
function esPedidoWala(p) {
  return (
    !!p &&
    (p.canalVenta === 'Portal Web' ||
      p.web === true ||
      p.activador === 'portal_web' ||
      p.vendedor === 'Portal Web')
  );
}

function tipoCreatedAt(v) {
  if (v == null) return 'FALTA';
  if (typeof v === 'object' && typeof v.toDate === 'function') return 'Timestamp';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  return typeof v;
}

function tally(map, key) {
  const k = key == null || key === '' ? '(vacío)' : String(key);
  map.set(k, (map.get(k) || 0) + 1);
}

function printTally(label, map) {
  const filas = [...map.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`  ${label}:`);
  for (const [k, n] of filas) console.log(`     ${n.toString().padStart(5)}  ${k}`);
}

async function analizar(coll) {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`COLECCIÓN: ${coll}  (leyendo hasta ${PER_COLLECTION} docs, sin orderBy)`);
  console.log(`══════════════════════════════════════════════════════════`);
  let snap;
  try {
    snap = await db.collection(coll).limit(PER_COLLECTION).get();
  } catch (e) {
    console.log(`  ❌ ERROR al leer ${coll}: ${e.message}`);
    return;
  }
  const total = snap.size;
  console.log(`  Total docs leídos: ${total}`);
  if (total === 0) {
    console.log(`  (vacía o no existe en esta base)`);
    return;
  }

  let wala = 0;
  const canalVentaMap = new Map();
  const createdAtMap = new Map();
  const estadoValidacionMap = new Map();
  const estadoGeneralMap = new Map();
  const muestras = [];

  snap.forEach((doc) => {
    const d = doc.data() || {};
    const esWala = esPedidoWala(d);
    if (esWala) wala += 1;
    tally(canalVentaMap, d.canalVenta);
    tally(createdAtMap, tipoCreatedAt(d.createdAt));
    tally(estadoValidacionMap, d.estadoValidacion);
    tally(estadoGeneralMap, d.estadoGeneral || d.status);
    if (muestras.length < 6) {
      muestras.push({
        id: doc.id,
        canalVenta: d.canalVenta,
        web: d.web,
        activador: d.activador,
        vendedor: d.vendedor,
        esWala,
        estadoGeneral: d.estadoGeneral || d.status,
        estadoValidacion: d.estadoValidacion,
        pagado: d.pagado,
        estadoPago: d.estadoPago,
        montoTotal: d.montoTotal ?? d.total,
        montoPendiente: d.montoPendiente,
        createdAt: tipoCreatedAt(d.createdAt),
        cliente: d.clienteNombreCompleto || d.clienteNombre || d.nombreCompleto,
        doc: d.clienteNumeroDocumento || d.dni,
      });
    }
  });

  console.log(`  ✅ Cumplen esPedidoWala (saldrían en Recepción): ${wala} de ${total}`);
  console.log(`  ⚠️  NO-WALA (no saldrían): ${total - wala}`);
  printTally('canalVenta (valores y conteo)', canalVentaMap);
  printTally('createdAt (tipo)', createdAtMap);
  printTally('estadoValidacion', estadoValidacionMap);
  printTally('estadoGeneral/status', estadoGeneralMap);
  console.log(`  Muestra (primeros 6 docs):`);
  muestras.forEach((m, i) => console.log(`   [${i}] ${JSON.stringify(m)}`));
}

// Busca un pedido concreto por código/numeroPedido/dni en AMBAS colecciones y
// muestra sus campos clave para saber si SIGUE EN LA NUBE o fue BORRADO.
async function buscarPedido(term) {
  const t = String(term).trim().toLowerCase();
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`BÚSQUEDA de pedido que contenga: "${term}"`);
  console.log(`══════════════════════════════════════════════════════════`);
  let encontrados = 0;
  for (const coll of ['pedidos_web', 'pedidos']) {
    let snap;
    try {
      snap = await db.collection(coll).limit(5000).get();
    } catch (e) {
      console.log(`  ❌ ${coll}: ${e.message}`);
      continue;
    }
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const campos = [
        doc.id, d.numeroPedido, d.portalPseudoOrderId, d.codigo,
        d.dni, d.dniRaw, d.clienteNumeroDocumento,
      ].map((x) => String(x == null ? '' : x).toLowerCase());
      if (!campos.some((c) => c.includes(t))) return;
      encontrados += 1;
      console.log(`\n  ✅ ENCONTRADO en "${coll}" (docId=${doc.id})`);
      console.log(`     numeroPedido=${d.numeroPedido}  codigo=${d.codigo || d.portalPseudoOrderId}`);
      console.log(`     canalVenta=${d.canalVenta}  web=${d.web}  activador=${d.activador}  vendedor=${d.vendedor}`);
      console.log(`     → esPedidoWala=${esPedidoWala(d)} (si es false, por eso NO sale en Recepción)`);
      console.log(`     estadoValidacion=${d.estadoValidacion}  estadoGeneral=${d.estadoGeneral || d.status}`);
      console.log(`     pagado=${d.pagado}  estadoPago=${d.estadoPago}  total=${d.montoTotal ?? d.total}  montoPendiente=${d.montoPendiente}`);
      console.log(`     dni=${d.dni}  dniRaw=${d.dniRaw}  clienteNumeroDocumento=${d.clienteNumeroDocumento}`);
      console.log(`     cliente=${d.clienteNombreCompleto || d.clienteNombre}  createdAt(tipo)=${tipoCreatedAt(d.createdAt)}`);
    });
  }
  if (encontrados === 0) {
    console.log(`\n  ❌ NO existe ningún pedido con "${term}" en pedidos_web NI en pedidos.`);
    console.log(`     → No está en la nube: o nunca se guardó, o fue BORRADO de la base.`);
  } else {
    console.log(`\n  Total coincidencias: ${encontrados}.`);
    console.log(`  Si aparece pero con esPedidoWala=false o sin dni que case con tu perfil,`);
    console.log(`  por eso no se ve en el panel/Mis Compras aunque SÍ siga en la nube.`);
  }
}

(async () => {
  console.log(`Proyecto: ${projectId}  ·  base: (default)`);
  if (BUSCAR) {
    await buscarPedido(BUSCAR);
    process.exit(0);
  }
  await analizar('pedidos_web');
  await analizar('pedidos');
  console.log(`\n── LECTURA ──`);
  console.log(`Si "Cumplen esPedidoWala" es 0 → tus pedidos no tienen los marcadores WALA`);
  console.log(`(canalVenta:'Portal Web' etc.) y por eso Recepción los oculta.`);
  console.log(`Si tienen createdAt tipo 'string' o 'FALTA' → el orden por createdAt del`);
  console.log(`panel también los excluiría. Pásame esta salida y te digo el fix exacto.`);
  process.exit(0);
})().catch((e) => {
  console.error('Fallo el diagnóstico:', e.message);
  process.exit(1);
});
