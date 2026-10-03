/**
 * Genera functions/giftLogic.js (CommonJS, para Cloud Functions) a partir de
 * src/utils/giftRecommender.mjs (ESM, para la web). Una sola fuente de verdad.
 *   npm run gen:gift-logic
 */
const fs = require('fs');
const path = require('path');

const origen = path.join(__dirname, '..', 'src', 'utils', 'giftRecommender.mjs');
const destino = path.join(__dirname, '..', 'functions', 'giftLogic.js');

let s = fs.readFileSync(origen, 'utf8');
const nombres = [...s.matchAll(/^export (?:function|const) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
s = s.replace(/^export (function|const) /gm, '$1 ');
s = s.replace(
  /^\/\/ ⚠️ Hay una COPIA en functions\/giftLogic.js[\s\S]*?ambas den lo mismo\.\n/m,
  '// ⚠️ COPIA GENERADA de src/utils/giftRecommender.mjs (la fuente es ese archivo).\n'
  + '// No la edites a mano: corre  npm run gen:gift-logic  después de cambiar el original.\n'
  + '// El test src/utils/giftRecommender.test.mjs verifica que ambas den lo mismo.\n',
);
s += `\nmodule.exports = { ${nombres.join(', ')} };\n`;
fs.writeFileSync(destino, s);
console.log(`functions/giftLogic.js generado (${nombres.length} exports).`);
