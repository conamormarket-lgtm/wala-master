const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Fix "newBackLayers is not defined" at lines 285 & 963.
// Right now, before the loop, it says:
// const newInitialLayers = { ...(cust.initialLayersByColor || {}) };
// const colorsMap = itemImagesByColor?.[i] || { default: '' };
const targetNewInitial = /const newInitialLayers = \{ \.\.\.\(cust\.initialLayersByColor \|\| \{\}\) \};\s+const colorsMap = itemImagesByColor\?\.\[i\] \|\| \{ default: '' \};\s+Object\.keys\(colorsMap\)\.forEach\(color => \{\s+const vId = getVId\(i, color, activeSides\);\s+newInitialLayers\[color\] = layersByView(Ref\.current)?\[vId\] \|\| newInitialLayers\[color\] \|\| \[\];\s+\}\);/g;

const replaceNewInitial = `      const newInitialLayers = { ...(cust.initialLayersByColor || {}) };
      const newBackLayers = { ...(cust.backSide?.initialLayersByColor || {}) };

      const colorsMap = itemImagesByColor?.[i] || { default: '' };
      Object.keys(colorsMap).forEach(color => {
        const frontId = \`\${FALLBACK_VIEW_PREFIX}\${i}-\${color}\`;
        const backId = \`\${FALLBACK_VIEW_PREFIX}\${i}-\${color}-back\`;
        newInitialLayers[color] = layersByView$1[frontId] || newInitialLayers[color] || [];
        if (layersByView$1[backId] || newBackLayers[color]) {
            newBackLayers[color] = layersByView$1[backId] || newBackLayers[color] || [];
        }
      });`;
code = code.replace(targetNewInitial, replaceNewInitial);

// 2. Fix 'i' is not defined inside getUrl
const targetGetUrl = /const view = data\?\.customizationViews\?\.find\(v => v\.id === item\.viewId\) \|\| data\?\.customizationViews\?\.\[0\];\s+resolvedItemViews\[i\] = view;/g;
const replaceGetUrl = `const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];
          resolvedItemViews[index] = view;`;
code = code.replace(targetGetUrl, replaceGetUrl);

// 3. Fix 'resolvedItemViews' is not defined in load()
const targetResolvedArray = /const resolvedItemColorsHex = \[\];\s+for \(let i = 0;/g;
const replaceResolvedArray = `const resolvedItemColorsHex = [];
        const resolvedItemViews = [];
        for (let i = 0;`;
code = code.replace(targetResolvedArray, replaceResolvedArray);

fs.writeFileSync(filePath, code);
console.log('Fixed undefined variables');
