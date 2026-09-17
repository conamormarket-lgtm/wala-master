/**
 * capacitor-google-auth trae un build.gradle escrito para AGP 8: usa `jcenter()`
 * (repositorio que Gradle 9 ya no resuelve) y el proguard por defecto sin
 * optimizar (que AGP 9 rechaza). Sin este parche `gradlew bundleRelease` falla
 * al evaluar el proyecto. Corre en postinstall para sobrevivir a npm install.
 */
const fs = require('fs');
const path = require('path');

const gradleFile = path.join(
  __dirname,
  '..',
  'node_modules',
  '@codetrix-studio',
  'capacitor-google-auth',
  'android',
  'build.gradle'
);

if (!fs.existsSync(gradleFile)) {
  process.exit(0);
}

const original = fs.readFileSync(gradleFile, 'utf8');
const patched = original
  .replace(/^(\s*)jcenter\(\)\s*$/gm, '$1mavenCentral()')
  .replace(
    /getDefaultProguardFile\('proguard-android\.txt'\)/g,
    "getDefaultProguardFile('proguard-android-optimize.txt')"
  )
  // jcenter() convivía con mavenCentral(); tras el reemplazo queda duplicado.
  .replace(/^(\s*mavenCentral\(\)\n)\1+/gm, '$1');

if (patched !== original) {
  fs.writeFileSync(gradleFile, patched);
  console.log('[patch] capacitor-google-auth: build.gradle adaptado a Gradle 9 / AGP 9');
}
