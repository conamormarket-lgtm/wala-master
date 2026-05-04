/**
 * Despliega solo las reglas de Storage usando el project ID de .env.
 * Uso: npm run deploy:storage-rules
 * Requiere: Firebase CLI instalado y firebase login con cuenta con permisos.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('No se encontró .env. Configura REACT_APP_FIREBASE_PROJECT_ID.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/REACT_APP_FIREBASE_PROJECT_ID=(.+)/);
const projectId = match ? match[1].trim().replace(/^["']|["']$/g, '') : '';

if (!projectId || projectId === 'your-project-id') {
  console.error('Configura REACT_APP_FIREBASE_PROJECT_ID en .env.');
  process.exit(1);
}

console.log('Desplegando reglas de Storage para proyecto:', projectId);

const child = spawn(
  'firebase',
  ['deploy', '--only', 'storage', '--project', projectId],
  { stdio: 'inherit', shell: true, cwd: path.join(__dirname, '..') }
);

child.on('close', (code) => {
  process.exit(code !== null ? code : 0);
});

child.on('error', (err) => {
  console.error('Error al ejecutar Firebase CLI:', err.message);
  process.exit(1);
});
