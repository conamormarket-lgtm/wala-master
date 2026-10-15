// Prueba reglas de Storage con el servicio de pruebas de Google (projects.test):
// no despliega nada. Uso: node scripts/probar-reglas-storage.cjs [archivo.rules]
// (por defecto firebase/storage.rules). Usa la sesión de Firebase CLI; si venció,
// correr antes cualquier comando de firebase (p. ej. `npx firebase projects:list`).
const fs = require('fs'); const path = require('path'); const os = require('os');
const P = 'sistema-gestion-3b225';
const B = 'sistema-gestion-3b225.firebasestorage.app';
const anon = { uid: 'anon-1', token: { firebase: { sign_in_provider: 'anonymous' } } };
const img = { size: 1000, contentType: 'image/jpeg' };
const pdf = { size: 1000, contentType: 'application/pdf' };

// [descripción, esperado, auth, método, ruta, recurso nuevo]
const CASOS = [
  ['listar backups sin sesión', 'DENY', null, 'list', 'backups/x.json'],
  ['leer backup sin sesión', 'DENY', null, 'get', 'backups/aimunay/b.json'],
  ['leer backup con sesión anónima', 'DENY', anon, 'get', 'backups/b.json'],
  ['borrar backup con sesión anónima', 'DENY', anon, 'delete', 'backups/b.json'],
  ['crear backup con sesión anónima', 'DENY', anon, 'create', 'backups/b.json', pdf],
  // Lo de hoy sigue igual (no romper ERP, visor ni tienda)
  ['leer foto de producto sin sesión', 'ALLOW', null, 'get', 'productos/a.jpg'],
  ['subir foto de producto (ERP, anónima)', 'ALLOW', anon, 'create', 'productos/a.jpg', img],
  ['subir boleta de envío', 'ALLOW', anon, 'create', 'boletas_envio/9240/a.jpg', img],
  ['leer boleta de envío', 'ALLOW', null, 'get', 'boletas_envio/9240/a.jpg'],
  ['subir comprobante de pago (ERP)', 'ALLOW', anon, 'create', 'comprobantes_pago/9240/a.pdf', pdf],
  ['leer comprobante de pago', 'ALLOW', null, 'get', 'comprobantes_pago/9240/a.pdf'],
  ['subir documento RRHH (ERP)', 'ALLOW', anon, 'create', 'usuarios_documentos/123/documentos/a.pdf', pdf],
  ['subir diseño de cliente (tienda)', 'ALLOW', anon, 'create', 'designs/u1/a.png', img],
  ['leer imagen de producto v2', 'ALLOW', null, 'get', 'productos_v2/x/y.webp'],
  ['leer archivo en la raíz', 'ALLOW', null, 'get', 'logo.png'],
  ['una carpeta parecida no se bloquea', 'ALLOW', null, 'get', 'backups-viejos/x.png'],
];

(async () => {
  const fuente = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'firebase', 'storage.rules'), 'utf8');
  const cli = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  const testCases = CASOS.map(([, esp, auth, method, ruta, nuevo]) => ({
    expectation: esp,
    request: {
      auth: auth || undefined,
      method,
      path: `/b/${B}/o/${ruta}`,
      ...(nuevo ? { resource: { size: nuevo.size, contentType: nuevo.contentType } } : {}),
    },

  }));
  const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${P}:test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cli.tokens.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: { files: [{ name: 'storage.rules', content: fuente }] }, testSuite: { testCases } }),
  });
  const j = await r.json();
  if (!j.testResults) { console.log(JSON.stringify(j).slice(0, 800)); process.exit(1); }
  let ok = 0;
  j.testResults.forEach((t, i) => {
    const bien = t.state === 'SUCCESS';
    if (bien) ok++;
    console.log(bien ? 'OK ' : 'MAL', CASOS[i][0], `(esperado ${CASOS[i][1]})`, bien ? '' : JSON.stringify(t.debugMessages || t.errorPosition || '').slice(0, 200));
  });
  console.log(`${ok}/${CASOS.length}`);
})();
