/**
 * Prueba firebase/firestore.rules contra el servicio de reglas de Google
 * (projects.test) SIN desplegar nada. Sirve cuando el emulador no está a mano.
 *
 *   node scripts/probar-reglas-api.cjs
 *
 * Usa la sesión de Firebase CLI (firebase login): la clave de servicio no tiene
 * permiso para projects.test. Si el token venció, correr antes cualquier comando
 * de firebase (p. ej. firebase projects:list) para renovarlo.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROYECTO = 'sistema-gestion-3b225';
const reglas = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8');

const DOCS = '/databases/(default)/documents';
const anonimo = { uid: 'anon-erp', token: { firebase: { sign_in_provider: 'anonymous' } } };
const cliente = (uid) => ({ uid, token: { email: `${uid}@example.com`, email_verified: false, firebase: { sign_in_provider: 'password' } } });

const casos = [
  // Libreta de direcciones
  ['ALLOW', 'dueño lee su libreta', { auth: cliente('U1'), method: 'get', path: `${DOCS}/wala_direcciones/U1` }],
  ['DENY', 'otro cliente no la lee', { auth: cliente('U2'), method: 'get', path: `${DOCS}/wala_direcciones/U1` }],
  ['DENY', 'sesión anónima (ERP) no la lee', { auth: anonimo, method: 'get', path: `${DOCS}/wala_direcciones/U1` }],
  ['DENY', 'sin sesión no la lee', { method: 'get', path: `${DOCS}/wala_direcciones/U1` }],
  ['ALLOW', 'dueño la guarda', { auth: cliente('U1'), method: 'create', path: `${DOCS}/wala_direcciones/U1`, resource: { data: { lista: [{ id: 'a' }], actualizado: 1 } } }],
  ['DENY', 'dueño no agrega otros campos', { auth: cliente('U1'), method: 'create', path: `${DOCS}/wala_direcciones/U1`, resource: { data: { lista: [], admin: true } } }],
  ['DENY', 'otro cliente no la escribe', { auth: cliente('U2'), method: 'create', path: `${DOCS}/wala_direcciones/U1`, resource: { data: { lista: [], actualizado: 1 } } }],
  // ERP, visor y FinanzaPro (sesión anónima): igual que antes
  ['ALLOW', 'ERP lee pedidos', { auth: anonimo, method: 'get', path: `${DOCS}/pedidos/P1` }],
  ['ALLOW', 'ERP escribe Finanzas', { auth: anonimo, method: 'create', path: `${DOCS}/fp_transactions/T1`, resource: { data: { monto: 1 } } }],
  ['ALLOW', 'ERP lee users', { auth: anonimo, method: 'get', path: `${DOCS}/users/X` }],
  ['ALLOW', 'visor lee la cola de impresión', { auth: anonimo, method: 'get', path: `${DOCS}/print_queue/Q1` }],
  ['ALLOW', 'visor crea ticket', { auth: anonimo, method: 'create', path: `${DOCS}/print_queue/Q1`, resource: { data: { status: 'pending' } } }],
  // Tienda y cerrado sin sesión
  ['ALLOW', 'catálogo público sin sesión', { method: 'get', path: `${DOCS}/productos_wala/A` }],
  ['DENY', 'pedidos sin sesión', { method: 'get', path: `${DOCS}/pedidos/P1` }],
  ['DENY', 'ERP no toca colección solo Walá', { auth: anonimo, method: 'get', path: `${DOCS}/checkout_payment_intents/I1` }],
];

(async () => {
  const cli = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  const token = cli.tokens && cli.tokens.access_token;
  if (!token) throw new Error('No hay sesión de Firebase CLI (firebase login).');
  const body = {
    source: { files: [{ name: 'firestore.rules', content: reglas }] },
    testSuite: { testCases: casos.map(([expectation, , request]) => ({ expectation, request })) },
  };
  const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROYECTO}:test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  if (j.issues && j.issues.length) j.issues.forEach((i) => console.log('AVISO', i.severity, i.description));
  let fallas = 0;
  (j.testResults || []).forEach((t, i) => {
    const ok = t.state === 'SUCCESS';
    if (!ok) fallas += 1;
    console.log(`${ok ? 'ok   ' : 'FALLA'} ${casos[i][0].padEnd(5)} ${casos[i][1]}${ok ? '' : ' → ' + (t.debugMessages || []).join(' | ')}`);
  });
  console.log(`\n${casos.length - fallas}/${casos.length} correctas`);
  process.exitCode = fallas ? 1 : 0;
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
