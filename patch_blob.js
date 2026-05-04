const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/utils/comboImageComposer.js';
let code = fs.readFileSync(filePath, 'utf-8');

// Enhancing addCacheBuster
const targetAddCache = /u\.searchParams\.set\('_cb', Date\.now\(\)\);/g;
const replaceAddCache = `u.searchParams.set('_cb', Date.now() + '_' + Math.random().toString(36).substr(2, 5));`;
code = code.replace(targetAddCache, replaceAddCache);

const targetAddCache2 = /'_cb=' \+ Date\.now\(\)/g;
const replaceAddCache2 = `'_cb=' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)`;
code = code.replace(targetAddCache2, replaceAddCache2);

// Add fetch Blob fallback before allorigins or inside the try block
const targetLoop = /try \{\s+const img = await loadImageElement\(clean\);/g;
const replaceLoop = `try {
      let objectUrlToCleanup = null;
      let finalUrlToLoad = clean;
      
      // Intentar fetch primero si es firebase para saltar caché envenenada de Chrome
      if (clean.includes('firebasestorage') && !clean.includes('allorigins')) {
          try {
              const res = await fetch(clean, { mode: 'cors', cache: 'reload' });
              if (res.ok) {
                  const blob = await res.blob();
                  finalUrlToLoad = URL.createObjectURL(blob);
                  objectUrlToCleanup = finalUrlToLoad;
              }
          } catch(e) {
             // Ignorar y seguir con carga normal
          }
      }

      const img = await loadImageElement(finalUrlToLoad);
      if (objectUrlToCleanup) URL.revokeObjectURL(objectUrlToCleanup);`;
code = code.replace(targetLoop, replaceLoop);

fs.writeFileSync(filePath, code);
console.log('Added blob fetch fallback and strict cachebusters');
