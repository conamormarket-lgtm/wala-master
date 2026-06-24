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

const child = spawn('firebase', ['emulators:start', '--project', 'demo-wala'], {
  stdio: 'inherit',
  env,
  shell: true,
});
child.on('exit', (code) => process.exit(code || 0));
