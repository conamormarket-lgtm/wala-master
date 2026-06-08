const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\danie\\.gemini\\antigravity\\brain\\16d97e99-1c7a-4622-b544-b6f2982b322d\\.system_generated\\steps\\249\\content.md', 'utf-8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<script')) {
    console.log(lines[i].trim().substring(0, 100));
  }
}
