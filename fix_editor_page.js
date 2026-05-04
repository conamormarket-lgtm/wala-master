
const fs = require('fs');
let code = fs.readFileSync('src/pages/EditorPage.jsx', 'utf8');

const match = code.match(/setSavingDesign\(true\);\s*<ComboUserEditor[^]*?\/>/);
if (match) {
  code = code.replace(match[0], 'setSavingDesign(true);');
  console.log('Removed accidental injection.');
}

const badEndMatch = code.match(/  const productImage = \(\(\) => \{\s*>\s*<svg viewBox/);
if (badEndMatch) {
  console.log('File got brutally truncated! We must restore from a backup or manual rebuild.');
}

