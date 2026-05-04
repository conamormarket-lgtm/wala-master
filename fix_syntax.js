const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

const errorBlock = / si este color no fue guardado aún\s+if \(\(!lyrs \|\| lyrs\.length === 0\) && cust\?\.initialLayersByColor\?\.\['default'\]\) \{\s+lyrs = \[\.\.\.cust\.initialLayersByColor\['default'\]\];\s+\}\s+if \(Array\.isArray\(lyrs\) && lyrs\.length > 0\) \{\s+setLayersForView\(vId, \[\.\.\.lyrs\]\);\s+initializedViewsRef\.current\.add\(vId\);\s+\} else if \(cust\) \{\s+\/\/ Si el objeto de personalización existe pero no tiene capas, lo marcamos como inicializado \s+\/\/ para que no se sobreescriba si el usuario empieza a editar\.\s+initializedViewsRef\.current\.add\(vId\);\s+\}/g;

code = code.replace(errorBlock, "");
fs.writeFileSync(filePath, code);
console.log('Fixed syntax error');
