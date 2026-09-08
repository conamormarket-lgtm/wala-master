/**
 * Despliega solo las reglas de Firestore usando el project ID de .env.
 * Uso: npm run deploy:firestore-rules -- --fusionado-con-erp
 * Requiere: Firebase CLI instalado (npm i -g firebase-tools) y haber hecho firebase login.
 *
 * OJO: publicar reglas NO es aditivo. Reemplaza el ruleset vivo ENTERO por este
 * archivo, y lo que no esté listado aquí queda denegado por defecto. El proyecto
 * `sistema-gestion-3b225` lo comparten el portal y el ERP (aimunayerp.com), y las
 * reglas vivas han estado abiertas justamente por el ERP: ya hubo una publicación
 * que lo rompió y hubo que revertirla (ver CHANGELOG). De ahí la regla de la casa:
 * jamás desplegar reglas sin haberlas fusionado antes con las vivas del ERP.
 *
 * Por eso este script exige el flag --fusionado-con-erp: no protege de nada por sí
 * mismo, obliga a parar diez segundos y confirmar que la fusión se hizo.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

if (!process.argv.includes('--fusionado-con-erp')) {
  console.error([
    '',
    'DESPLIEGUE DETENIDO.',
    '',
    'Publicar reglas reemplaza el ruleset vivo entero, y este proyecto lo comparte',
    'el ERP (aimunayerp.com). Si el archivo no cubre las colecciones del ERP, sus',
    'pantallas dejan de cargar: ya pasó una vez y hubo que revertir en la consola.',
    '',
    'Antes de desplegar:',
    '  1. Mira las reglas vivas en Firebase Console > Firestore > Reglas.',
    '  2. Comprueba que firebase/firestore.rules cubre TODO lo que ellas permiten.',
    '  3. Repite el despliegue con el flag:',
    '',
    '       npm run deploy:firestore-rules -- --fusionado-con-erp',
    '',
    'Si algo sale mal: Firebase Console > Firestore > Reglas > Historial de',
    'versiones > publicar la anterior. La reversión es de un clic.',
    '',
  ].join('\n'));
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('No se encontró .env. Copia .env.example a .env y configura REACT_APP_FIREBASE_PROJECT_ID.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/REACT_APP_FIREBASE_PROJECT_ID=(.+)/);
const projectId = match ? match[1].trim().replace(/^["']|["']$/g, '') : '';

if (!projectId || projectId === 'your-project-id') {
  console.error('Configura REACT_APP_FIREBASE_PROJECT_ID en .env con tu ID de proyecto de Firebase.');
  process.exit(1);
}

console.log('Desplegando reglas de Firestore para proyecto:', projectId);

const child = spawn(
  'firebase',
  ['deploy', '--only', 'firestore:rules', '--project', projectId],
  { stdio: 'inherit', shell: true, cwd: path.join(__dirname, '..') }
);

child.on('close', (code) => {
  process.exit(code !== null ? code : 0);
});

child.on('error', (err) => {
  console.error('Error al ejecutar Firebase CLI:', err.message);
  console.error('Asegúrate de tener Firebase CLI instalado: npm i -g firebase-tools');
  process.exit(1);
});
