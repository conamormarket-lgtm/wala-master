const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

const targetTrySetState = /setState\(\{ composed: res, itemImages: resolvedImages, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex \}\);/g;

const replaceTrySetState = `setState({ composed: res, itemImages: resolvedImages, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex, itemViews: resolvedItemViews });`;

code = code.replace(targetTrySetState, replaceTrySetState);

// Also let's just make absolutely sure we add resolvedItemViews[i] = view to the fallback catch loop as well if not present
const targetFallbackView = /const view = data\?\.customizationViews\?\.find\(v => v\.id === item\.viewId\) \|\| data\?\.customizationViews\?\.\[0\];\s+\/\/ Determine Sizes fallback/g;

const replaceFallbackView = `const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];
          resolvedItemViews[i] = view;

          // Determine Sizes fallback`;
          
code = code.replace(targetFallbackView, replaceFallbackView);

fs.writeFileSync(filePath, code);
console.log('Fixed state bugs');
