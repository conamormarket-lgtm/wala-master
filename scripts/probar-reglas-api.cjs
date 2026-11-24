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
const principal = { uid: 'P', token: { admin: true, email: 'p@example.com', email_verified: true, firebase: { sign_in_provider: 'password' } } };
const equipo = (nombre) => ({ uid: nombre, token: { email: `${nombre}@example.com`, email_verified: true, firebase: { sign_in_provider: 'password' } } });
// adminRoles/{nombre}@example.com con estos permisos (simula get/exists de las reglas).
const rol = (nombre, permissions) => {
  const ruta = `${DOCS}/adminRoles/${nombre}@example.com`;
  return [
    { function: 'exists', args: [{ exactValue: ruta }], result: { value: true } },
    { function: 'get', args: [{ exactValue: ruta }], result: { value: { data: { permissions } } } },
  ];
};

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
  // Pedidos web: los crea el servidor (2026-10-16, sin el cuestionario de producto)
  ['DENY', 'sin sesión no crea un pedido web con DNI', { method: 'create', path: `${DOCS}/pedidos_web/PD1`, resource: { data: { dni: '12345678', web: true } } }],
  ['ALLOW', 'ERP lee pedidos web', { auth: anonimo, method: 'get', path: `${DOCS}/pedidos_web/PD1` }],
  ['ALLOW', 'ERP borra un pedido web al validarlo', { auth: anonimo, method: 'delete', path: `${DOCS}/pedidos_web/PD1` }],
  ['DENY', 'sin sesión no crea la copia en wala_pedidos', { method: 'create', path: `${DOCS}/wala_pedidos/PD1`, resource: { data: { pagado: false, estadoWala: 'pendiente_pago' } } }],
  ['DENY', 'cliente no crea la copia en wala_pedidos', { auth: cliente('U1'), method: 'create', path: `${DOCS}/wala_pedidos/PD1`, resource: { data: { pagado: false, estadoWala: 'pendiente_pago', buyerUid: 'U1' } } }],
  ['DENY', 'plantillas del cuestionario cerradas', { method: 'get', path: `${DOCS}/cuestionarios_templates/T1` }],
  // Equipo del panel (2026-11-05): solo un superadmin cambia adminRoles; un doc sin permisos no es admin
  ['ALLOW', 'cuenta principal (claim) cambia el equipo', { auth: principal, method: 'update', path: `${DOCS}/adminRoles/x@example.com`, resource: { data: { permissions: ['catalogo'] } } }],
  ['ALLOW', 'superadmin del equipo cambia el equipo', { auth: equipo('super'), method: 'update', path: `${DOCS}/adminRoles/x@example.com`, resource: { data: { permissions: ['catalogo'] } } }, rol('super', ['superadmin'])],
  ['DENY', 'alguien de Catálogo no se pone Super Admin', { auth: equipo('cata'), method: 'update', path: `${DOCS}/adminRoles/cata@example.com`, resource: { data: { permissions: ['superadmin'] } } }, rol('cata', ['catalogo'])],
  ['ALLOW', 'alguien de Catálogo sigue editando productos', { auth: equipo('cata'), method: 'update', path: `${DOCS}/productos_wala/A`, resource: { data: { name: 'x' } } }, rol('cata', ['catalogo'])],
  ['DENY', 'un doc del equipo sin permisos no es admin', { auth: equipo('vacio'), method: 'update', path: `${DOCS}/productos_wala/A`, resource: { data: { name: 'x' } } }, rol('vacio', [])],
  ['DENY', 'sin correo verificado no es admin', { auth: { uid: 'n', token: { email: 'super@example.com', email_verified: false, firebase: { sign_in_provider: 'password' } } }, method: 'update', path: `${DOCS}/productos_wala/A`, resource: { data: { name: 'x' } } }, rol('super', ['superadmin'])],
  // Paquetes sugeridos: cada cliente los suyos
  ['ALLOW', 'cliente lee su paquete sugerido', { auth: cliente('U1'), method: 'get', path: `${DOCS}/suggested_packages/S1`, existente: { data: { userId: 'U1' } } }],
  ['DENY', 'cliente no lee el paquete de otro', { auth: cliente('U2'), method: 'get', path: `${DOCS}/suggested_packages/S1`, existente: { data: { userId: 'U1' } } }],
  ['DENY', 'sin sesión no lee paquetes', { method: 'get', path: `${DOCS}/suggested_packages/S1`, existente: { data: { userId: 'U1' } } }],
  ['ALLOW', 'admin lee todos los paquetes', { auth: principal, method: 'get', path: `${DOCS}/suggested_packages/S1`, existente: { data: { userId: 'U1' } } }],
];

(async () => {
  const cli = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  const token = cli.tokens && cli.tokens.access_token;
  if (!token) throw new Error('No hay sesión de Firebase CLI (firebase login).');
  const body = {
    source: { files: [{ name: 'firestore.rules', content: reglas }] },
    // `existente`: el documento que ya está (resource en una lectura); va aparte de la petición.
    testSuite: {
      testCases: casos.map(([expectation, , { existente, ...request }, functionMocks]) => ({
        expectation, request, ...(existente && { resource: existente }), ...(functionMocks && { functionMocks }),
      })),
    },
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
