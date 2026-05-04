const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

const targetInit = /const vId = getVId\(i, color, activeSides\);\s+if \(initializedViewsRef\.current\.has\(vId\)\) return;\s+const cust = \(comboItemCustomization \|\| \[\]\)\[i\];\s+let lyrs = \(cust\?\.initialLayersByColor\?\.\[color\]\) \|\| \[\];\s+\/\/ Fallback al diseño default/g;

const replaceInit = `
        const cust = (comboItemCustomization || [])[i];
        const vIdFront = \`\${FALLBACK_VIEW_PREFIX}\${i}-\${color}\`;
        const vIdBack = \`\${FALLBACK_VIEW_PREFIX}\${i}-\${color}-back\`;

        if (!initializedViewsRef.current.has(vIdFront)) {
          let lyrsFront = (cust?.initialLayersByColor?.[color]) || [];
          if ((!lyrsFront || lyrsFront.length === 0) && cust?.initialLayersByColor?.['default']) {
            lyrsFront = [...cust.initialLayersByColor['default']];
          }
          if (Array.isArray(lyrsFront) && lyrsFront.length > 0) {
            setLayersForView(vIdFront, [...lyrsFront]);
          }
          initializedViewsRef.current.add(vIdFront);
        }

        if (!initializedViewsRef.current.has(vIdBack)) {
          let lyrsBack = (cust?.backSide?.initialLayersByColor?.[color]) || [];
          if ((!lyrsBack || lyrsBack.length === 0) && cust?.backSide?.initialLayersByColor?.['default']) {
            lyrsBack = [...cust.backSide.initialLayersByColor['default']];
          }
          if (Array.isArray(lyrsBack) && lyrsBack.length > 0) {
            setLayersForView(vIdBack, [...lyrsBack]);
          }
          initializedViewsRef.current.add(vIdBack);
        }

        return; // Prevent the rest of the old loop body from breaking state
`;

code = code.replace(targetInit, replaceInit);

// We need to clean up the rest of the old loop body that we bypassed
// The old body continues with:
// if ((!lyrs || lyrs.length === 0) && cust?.initialLayersByColor?.['default']) { ... }
// if (Array.isArray(lyrs) ... ) setLayersForView ... else initializedViewsRef.current.add(vId);
const targetCleanup = /return; \/\/ Prevent the rest of the old loop body from breaking state\s+if \(\(!lyrs \|\| lyrs\.length === 0\).*?\s+initializedViewsRef\.current\.add\(vId\);\s+\}\s+/gs;

code = code.replace(targetCleanup, "");

fs.writeFileSync(filePath, code);
console.log('Fixed mount logic');
