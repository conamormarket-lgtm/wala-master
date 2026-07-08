/**
 * Lanza los emuladores de Firebase asegurando que use el JDK 21 portable instalado en
 * %LOCALAPPDATA%\jdk21 (firebase-tools 15 requiere Java 21+). Así basta con `npm run emulators`
 * sin tener que configurar JAVA_HOME/PATH a mano.
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const env = { ...process.env };

// Localizar JDK 21 portable (o usar el del PATH si ya es >= 21).
const jdkBase = path.join(os.homedir(), 'AppData', 'Local', 'jdk21');
try {
  const dir = (fs.readdirSync(jdkBase) || []).find((d) => d.startsWith('jdk-21'));
  if (dir) {
    const home = path.join(jdkBase, dir);
    env.JAVA_HOME = home;
    env.PATH = path.join(home, 'bin') + path.delimiter + env.PATH;
    console.log('[emuladores] Usando JDK:', home);
  }
} catch (e) {
  console.warn('[emuladores] No encontré JDK 21 en', jdkBase, '— usaré el java del PATH (debe ser 21+).');
}

// Asegurar que firebase.cmd encuentre node.exe al arrancar.
const nodeDir = path.dirname(process.execPath);
env.PATH = nodeDir + path.delimiter + (env.PATH || '');

const localFirebase = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'firebase.cmd' : 'firebase',
);
const globalFirebase = process.platform === 'win32'
  ? path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'firebase.cmd')
  : path.join(os.homedir(), '.npm-global', 'bin', 'firebase');

const firebaseBin = [localFirebase, globalFirebase].find((p) => fs.existsSync(p));

if (!firebaseBin) {
  console.error('[emuladores] No encontré firebase CLI.');
  console.error('Instálalo con: npm install -g firebase-tools');
  process.exit(1);
}

console.log('[emuladores] Firebase CLI:', firebaseBin);

const child = spawn(
  firebaseBin,
  ['emulators:start', '--project', 'demo-wala', '--only', 'firestore,auth'],
  {
    stdio: 'inherit',
    env,
    shell: true,
    windowsHide: true,
  },
);
child.on('exit', (code) => process.exit(code || 0));
