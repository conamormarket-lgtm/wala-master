
const fs = require('fs');
let code = fs.readFileSync('src/pages/EditorPage.jsx', 'utf8');

// Replace all instances of URL strings with template literal weirdness.
code = code.replace(/\$\{size \? \\?\&size=\\\$\{size\}\\?\ : ''\}/g, \\\);
code = code.replace(/\$\{color \? \\?\&color=\\\$\{color\}\\?\ : ''\}/g, \\\);

fs.writeFileSync('src/pages/EditorPage.jsx', code);

