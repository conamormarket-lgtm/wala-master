
const fs = require('fs');
let c = fs.readFileSync('src/pages/EditorPage.jsx','utf8');
c = c.replace(/navigate\(\\/editor\/\\\$\{id\}\?designId=\\\$\{existingDesignPrompt\.id\}.*?\,/g, 'navigate(\/editor/\?designId=\\\\,');
fs.writeFileSync('src/pages/EditorPage.jsx',c);

