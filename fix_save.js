const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

// Fix 1: Auto Sync useEffect
const syncBlockTarget = /const newInitialLayers = \{ \.\.\.\(cust\.initialLayersByColor \|\| \{\}\) \};\s+const colorsMap = itemImagesByColor\?\.\[i\] \|\| \{ default: '' \};\s+Object\.keys\(colorsMap\)\.forEach\(color => \{\s+const vId = getVId\(i, color, activeSides\);\s+newInitialLayers\[color\] = layersByViewRef\.current\[vId\] \|\| newInitialLayers\[color\] \|\| \[\];\s+\}\);/g;

const syncBlockReplacement = `
      const newInitialLayers = { ...(cust.initialLayersByColor || {}) };
      const newBackLayers = { ...(cust.backSide?.initialLayersByColor || {}) };

      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        const frontId = \`\${FALLBACK_VIEW_PREFIX}\${i}-\${color}\`;
        const backId = \`\${FALLBACK_VIEW_PREFIX}\${i}-\${color}-back\`;
        newInitialLayers[color] = layersByViewRef.current[frontId] || newInitialLayers[color] || [];
        if (layersByViewRef.current[backId] || newBackLayers[color]) {
            newBackLayers[color] = layersByViewRef.current[backId] || newBackLayers[color] || [];
        }
      });
`;
code = code.replace(syncBlockTarget, syncBlockReplacement);

// Fix 2: the return statement of the map
const returnTarget = /return \{\s+productId: item\.productId,\s+viewId: item\.viewId,\s+(printAreas:.*?),\s+initialLayersByColor: newInitialLayers\s+\};/g;
const returnReplacement = `return {
        productId: item.productId,
        viewId: item.viewId,
        $1,
        initialLayersByColor: newInitialLayers,
        backSide: {
          initialLayersByColor: newBackLayers
        }
      };`;
code = code.replace(returnTarget, returnReplacement);

const returnTarget2 = /return \{\s+\.\.\.cust,\s+productId: item\.productId,\s+viewId: item\.viewId,\s+(initialLayersByColor: newInitialLayers|printAreas:.*?,\s+initialLayersByColor: newInitialLayers)\s+\};/g;
const returnReplacement2 = `return {
        ...cust,
        productId: item.productId,
        viewId: item.viewId,
        $1,
        backSide: {
          initialLayersByColor: newBackLayers
        }
      };`;
code = code.replace(returnTarget2, returnReplacement2);

fs.writeFileSync(filePath, code);
console.log('Fixed sync logic');
