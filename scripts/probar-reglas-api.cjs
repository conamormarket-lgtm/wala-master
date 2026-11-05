/**
 * Prueba firebase/firestore.rules contra el servicio de reglas de Google
 * (projects.test) SIN desplegar nada. Sirve cuando el emulador no está a mano.
 *
 *   node scripts/probar-reglas-api.cjs
 *   node scripts/probar-reglas-api.cjs --contra vivas.rules
 *
 * Con --contra corre los mismos casos contra otro archivo (por ejemplo las
 * reglas vivas, bajadas con scripts/leer-reglas-vivas.cjs) y marca con «CAMBIA»
 * cada caso que daría distinto al publicar: es la lista de lo que se rompería
 * o se cerraría. El resultado esperado de cada caso es el del archivo del repo.
 *
 * Usa la sesión de Firebase CLI (firebase login): la clave de servicio no tiene
 * permiso para projects.test. Si el token venció, correr antes cualquier comando
 * de firebase (p. ej. firebase projects:list) para renovarlo.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROYECTO = 'sistema-gestion-3b225';
const archivoRepo = path.join(__dirname, '..', 'firebase', 'firestore.rules');
const iContra = process.argv.indexOf('--contra');
const archivoContra = iContra > -1 ? process.argv[iContra + 1] : null;

const DOCS = '/databases/(default)/documents';
const anonimo = { uid: 'anon-erp', token: { firebase: { sign_in_provider: 'anonymous' } } };
const cliente = (uid) => ({ uid, token: { email: `${uid}@example.com`, email_verified: false, firebase: { sign_in_provider: 'password' } } });
const supervision = { uid: 'sup-1', token: { metricsOnly: true, firebase: { sign_in_provider: 'custom' } } };
const datos = (data) => ({ data });

// [esperado, nombre, request, resource existente (opcional)]
const casos = [
  // Libreta de direcciones
  ['ALLOW', 'dueño lee su libreta', { auth: cliente('U1'), method: 'get', path: `${DOCS}/wala_direcciones/U1` }],
  ['DENY', 'otro cliente no la lee', { auth: cliente('U2'), method: 'get', path: `${DOCS}/wala_direcciones/U1` }],
  ['DENY', 'sesión anónima (ERP) no la lee', { auth: anonimo, method: 'get', path: `${DOCS}/wala_direcciones/U1` }],
  ['DENY', 'sin sesión no la lee', { auth: null, method: 'get', path: `${DOCS}/wala_direcciones/U1` }],
  ['ALLOW', 'dueño la guarda', { auth: cliente('U1'), method: 'create', path: `${DOCS}/wala_direcciones/U1`, resource: datos({ lista: [{ id: 'a' }], actualizado: 1 }) }],
  ['DENY', 'dueño no agrega otros campos', { auth: cliente('U1'), method: 'create', path: `${DOCS}/wala_direcciones/U1`, resource: datos({ lista: [], admin: true }) }],
  ['DENY', 'otro cliente no la escribe', { auth: cliente('U2'), method: 'create', path: `${DOCS}/wala_direcciones/U1`, resource: datos({ lista: [], actualizado: 1 }) }],
  // ERP y FinanzaPro (sesión anónima): todo lo que no es solo de Walá
  ['ALLOW', 'ERP lee pedidos', { auth: anonimo, method: 'get', path: `${DOCS}/pedidos/P1` }],
  ['ALLOW', 'ERP cambia un pedido', { auth: anonimo, method: 'update', path: `${DOCS}/pedidos/P1`, resource: datos({ estadoGeneral: 'En Producción' }) }, datos({ estadoGeneral: 'Pendiente' })],
  ['ALLOW', 'ERP escribe Finanzas', { auth: anonimo, method: 'create', path: `${DOCS}/fp_transactions/T1`, resource: datos({ monto: 1 }) }],
  ['ALLOW', 'ERP lee users', { auth: anonimo, method: 'get', path: `${DOCS}/users/X` }],
  ['ALLOW', 'ERP lee inventarios', { auth: anonimo, method: 'list', path: `${DOCS}/inventarios/I1` }],
  ['ALLOW', 'ERP crea un pedido web (con sesión)', { auth: anonimo, method: 'create', path: `${DOCS}/pedidos_web/PD2`, resource: datos({ web: true }) }],
  ['ALLOW', 'ERP lee pedidos web', { auth: anonimo, method: 'get', path: `${DOCS}/pedidos_web/PD1` }],
  ['ALLOW', 'ERP borra un pedido web al validarlo', { auth: anonimo, method: 'delete', path: `${DOCS}/pedidos_web/PD1` }],
  ['ALLOW', 'ERP lee el control de métricas financieras', { auth: anonimo, method: 'get', path: `${DOCS}/financeMetrics_meta/control` }],
  ['DENY', 'navegador no escribe métricas financieras', { auth: anonimo, method: 'update', path: `${DOCS}/financeMetrics_days/2026-10-01`, resource: datos({ total: 1 }) }, datos({ total: 0 })],
  ['ALLOW', 'ERP lee un resumen precalculado', { auth: anonimo, method: 'get', path: `${DOCS}/readModels_dashboard/hoy` }],
  ['DENY', 'navegador no escribe resúmenes precalculados', { auth: anonimo, method: 'create', path: `${DOCS}/readModels_dashboard/hoy`, resource: datos({ total: 1 }) }],
  ['DENY', 'navegador no toca la revisión de stock', { auth: anonimo, method: 'create', path: `${DOCS}/stockReview_meta/control`, resource: datos({ enabled: false }) }],
  // Visor de pedidos y servidor de impresión (sesión anónima)
  ['ALLOW', 'visor lee configuración', { auth: anonimo, method: 'get', path: `${DOCS}/configuracion/general` }],
  ['ALLOW', 'visor lee la cola de impresión', { auth: anonimo, method: 'get', path: `${DOCS}/print_queue/Q1` }],
  ['ALLOW', 'visor crea ticket', { auth: anonimo, method: 'create', path: `${DOCS}/print_queue/Q1`, resource: datos({ status: 'pending' }) }],
  ['ALLOW', 'impresora marca el ticket', { auth: anonimo, method: 'update', path: `${DOCS}/print_queue/Q1`, resource: datos({ status: 'printed' }) }, datos({ status: 'pending' })],
  ['DENY', 'sin sesión no lee la cola de impresión', { auth: null, method: 'get', path: `${DOCS}/print_queue/Q1` }],
  // Tienda
  ['ALLOW', 'catálogo público sin sesión', { auth: null, method: 'get', path: `${DOCS}/productos_wala/A` }],
  ['DENY', 'pedidos sin sesión', { auth: null, method: 'get', path: `${DOCS}/pedidos/P1` }],
  ['DENY', 'ERP no toca colección solo Walá', { auth: anonimo, method: 'get', path: `${DOCS}/checkout_payment_intents/I1` }],
  ['ALLOW', 'cliente lee su cuenta', { auth: cliente('U1'), method: 'get', path: `${DOCS}/portal_clientes_users/U1` }],
  ['ALLOW', 'cliente cambia su nombre', { auth: cliente('U1'), method: 'update', path: `${DOCS}/portal_clientes_users/U1`, resource: datos({ dni: '1', monedas: 5, nombre: 'Ana' }) }, datos({ dni: '1', monedas: 5, nombre: 'A' })],
  ['DENY', 'cliente no se sube las monedas', { auth: cliente('U1'), method: 'update', path: `${DOCS}/portal_clientes_users/U1`, resource: datos({ dni: '1', monedas: 9999 }) }, datos({ dni: '1', monedas: 5 })],
  ['DENY', 'sesión anónima no toca monedas ajenas', { auth: anonimo, method: 'update', path: `${DOCS}/portal_clientes_users/U1`, resource: datos({ dni: '1', monedas: 9999 }) }, datos({ dni: '1', monedas: 5 })],
  // Pedidos web: los crea el servidor (2026-10-16, sin el cuestionario de producto)
  ['DENY', 'sin sesión no crea un pedido web con DNI', { auth: null, method: 'create', path: `${DOCS}/pedidos_web/PD1`, resource: datos({ dni: '12345678', web: true }) }],
  ['DENY', 'sin sesión no cambia un pedido web con DNI', { auth: null, method: 'update', path: `${DOCS}/pedidos_web/PD1`, resource: datos({ dni: '12345678', pagado: true }) }, datos({ dni: '12345678' })],
  ['DENY', 'sin sesión no crea la copia en wala_pedidos', { auth: null, method: 'create', path: `${DOCS}/wala_pedidos/PD1`, resource: datos({ pagado: false, estadoWala: 'pendiente_pago' }) }],
  ['DENY', 'cliente no crea la copia en wala_pedidos', { auth: cliente('U1'), method: 'create', path: `${DOCS}/wala_pedidos/PD1`, resource: datos({ pagado: false, estadoWala: 'pendiente_pago', buyerUid: 'U1' }) }],
  ['DENY', 'plantillas del cuestionario cerradas', { auth: null, method: 'get', path: `${DOCS}/cuestionarios_templates/T1` }],
  // Las Bolitas de Kapi
  ['ALLOW', 'jugador lee su progreso', { auth: cliente('U1'), method: 'get', path: `${DOCS}/bolitasProgreso/U1` }],
  ['ALLOW', 'jugador guarda su progreso', { auth: cliente('U1'), method: 'create', path: `${DOCS}/bolitasProgreso/U1`, resource: datos({ nivel: 3 }) }],
  ['DENY', 'otro cliente no toca ese progreso', { auth: cliente('U2'), method: 'create', path: `${DOCS}/bolitasProgreso/U1`, resource: datos({ nivel: 99 }) }],
  ['DENY', 'sesión anónima no toca ese progreso', { auth: anonimo, method: 'create', path: `${DOCS}/bolitasProgreso/U1`, resource: datos({ nivel: 99 }) }],
  ['ALLOW', 'mundos del juego públicos', { auth: null, method: 'get', path: `${DOCS}/bolitasConfig/mundos` }],
  ['ALLOW', 'patrocinio del reto público', { auth: null, method: 'get', path: `${DOCS}/bolitasPatrocinios/2026-10-22` }],
  ['DENY', 'sesión anónima no cambia los premios del juego', { auth: anonimo, method: 'create', path: `${DOCS}/bolitasConfig/premios`, resource: datos({ primero: 9999 }) }],
  ['DENY', 'cliente no cambia un patrocinio', { auth: cliente('U1'), method: 'create', path: `${DOCS}/bolitasPatrocinios/2026-10-22`, resource: datos({ cupon: 'GRATIS' }) }],
  ['DENY', 'sesión anónima no cambia el ranking', { auth: anonimo, method: 'create', path: `${DOCS}/bolitasSemanas/2026-W43`, resource: datos({ top: [] }) }],
  ['DENY', 'sesión anónima no cambia el reto', { auth: anonimo, method: 'create', path: `${DOCS}/bolitasRetos/2026-10-22`, resource: datos({ premio: 9999 }) }],
  ['DENY', 'sesión anónima no se da premios', { auth: anonimo, method: 'create', path: `${DOCS}/bolitasPremios/X`, resource: datos({ monedas: 9999 }) }],
  ['DENY', 'sesión anónima no apaga la prueba de partidas', { auth: anonimo, method: 'create', path: `${DOCS}/loyaltyConfig/global`, resource: datos({ bolitasExigirPrueba: false }) }],
  // Supervisión (token metricsOnly): solo sus endpoints del servidor
  ['DENY', 'supervisión no lee el catálogo directo', { auth: supervision, method: 'get', path: `${DOCS}/productos_wala/A` }],
  ['DENY', 'supervisión no lee pedidos directo', { auth: supervision, method: 'get', path: `${DOCS}/pedidos/P1` }],
];

async function probar(reglas, token) {
  const testCases = casos.map(([expectation, , request, resource]) => (resource ? { expectation, request, resource } : { expectation, request }));
  const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROYECTO}:test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: reglas }] }, testSuite: { testCases } }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  if (j.issues && j.issues.length) j.issues.forEach((i) => console.log('AVISO', i.severity, i.description));
  return j.testResults || [];
}

(async () => {
  const cli = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  const token = cli.tokens && cli.tokens.access_token;
  if (!token) throw new Error('No hay sesión de Firebase CLI (firebase login).');
  const repo = await probar(fs.readFileSync(archivoRepo, 'utf8'), token);
  const contra = archivoContra ? await probar(fs.readFileSync(archivoContra, 'utf8'), token) : null;
  let fallas = 0;
  let cambios = 0;
  repo.forEach((t, i) => {
    const ok = t.state === 'SUCCESS';
    if (!ok) fallas += 1;
    let marca = '';
    if (contra) {
      const igual = contra[i].state === t.state;
      if (!igual) cambios += 1;
      marca = igual ? '       ' : 'CAMBIA ';
    }
    console.log(`${ok ? 'ok   ' : 'FALLA'} ${marca}${casos[i][0].padEnd(5)} ${casos[i][1]}${ok ? '' : ' → ' + (t.debugMessages || []).join(' | ')}`);
  });
  console.log(`\n${casos.length - fallas}/${casos.length} correctas`);
  if (contra) console.log(`${cambios} casos darían distinto que en ${path.basename(archivoContra)}`);
  process.exitCode = fallas ? 1 : 0;
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
