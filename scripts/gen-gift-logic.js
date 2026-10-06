/**
 * Genera las copias CommonJS (para Cloud Functions) de la lógica pura que vive
 * en src/utils (ESM, para la web). Una sola fuente de verdad por archivo.
 *   npm run gen:gift-logic
 *
 *   src/utils/giftRecommender.mjs → functions/giftLogic.js
 *   src/utils/fechasFestivas.mjs  → functions/fechasFestivasLogic.js
 */
const fs = require('fs');
const path = require('path');

const COPIAS = [
  ['src/utils/giftRecommender.mjs', 'functions/giftLogic.js'],
  ['src/utils/fechasFestivas.mjs', 'functions/fechasFestivasLogic.js'],
];

for (const [desde, hacia] of COPIAS) {
  const origen = path.join(__dirname, '..', desde);
  const destino = path.join(__dirname, '..', hacia);
  let s = fs.readFileSync(origen, 'utf8');
  const nombres = [...s.matchAll(/^export (?:function|const) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  s = s.replace(/^export (function|const) /gm, '$1 ');
  s = s.replace(
    /^\/\/ ⚠️ Hay una COPIA en functions\/[\s\S]*?ambas den lo mismo\.\r?\n/m,
    `// ⚠️ COPIA GENERADA de ${desde} (la fuente es ese archivo).\n`
    + '// No la edites a mano: corre  npm run gen:gift-logic  después de cambiar el original.\n',
  );
  s += `\nmodule.exports = { ${nombres.join(', ')} };\n`;
  fs.writeFileSync(destino, s);
  console.log(`${hacia} generado (${nombres.length} exports).`);
}
