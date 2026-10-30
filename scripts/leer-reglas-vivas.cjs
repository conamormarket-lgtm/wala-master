/**
 * Baja las reglas de Firestore que corren HOY en producción, sin cambiar nada.
 *
 *   node scripts/leer-reglas-vivas.cjs [salida.rules]
 *
 * Lista todas las publicaciones del proyecto (la base principal y las de otros
 * negocios: lumi, mussa, wala, negocio-cliente-1) y guarda solo la de la base
 * principal: la publicación cuyo nombre termina EXACTO en
 * /releases/cloud.firestore. Las demás empiezan igual (cloud.firestore/lumi…);
 * tomar la primera que coincida ya hizo leer las de otra base por error.
 *
 * Usa la sesión de Firebase CLI global (firebase login). Para comparar con el
 * archivo del repo: node scripts/probar-reglas-api.cjs --contra salida.rules
 */
const fs = require('fs');
const path = require('path');

const PROYECTO = 'sistema-gestion-3b225';
const salida = process.argv[2] || path.join(require('os').tmpdir(), 'reglas-vivas-principal.rules');
const lib = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib');
const { requireAuth } = require(path.join(lib, 'requireAuth.js'));
const { configstore } = require(path.join(lib, 'configstore.js'));
const rules = require(path.join(lib, 'gcp', 'rules.js'));

(async () => {
  await requireAuth({ user: configstore.get('user'), tokens: configstore.get('tokens'), project: PROYECTO });
  const publicaciones = await rules.listAllReleases(PROYECTO);
  let principal = null;
  publicaciones.forEach((p) => {
    console.log(`${p.name.split('/releases/')[1].padEnd(60)} ${p.updateTime}`);
    if (p.name.endsWith('/releases/cloud.firestore')) principal = p;
  });
  if (!principal) throw new Error('No hay publicación de la base principal.');
  const [archivo] = await rules.getRulesetContent(principal.rulesetName);
  fs.writeFileSync(salida, archivo.content);
  console.log(`\nBase principal: ${archivo.content.length} caracteres → ${salida}`);
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
