
const fs = require('fs');
let code = fs.readFileSync('src/pages/EditorPage.jsx', 'utf8');
code = code.replace(/\\\/g, '\');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('src/pages/EditorPage.jsx', code);
console.log('Fixed simple escapes.');

