const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

const targetLayersCapture = /const layers = layersByView\[vId\] \|\| cust\.initialLayersByColor\?\.\[currentColor\] \|\| \[\];/g;
const replacementLayersCapture = "const layers = layersByView[vId] || (activeSides[index] === 'back' ? cust.backSide?.initialLayersByColor?.[currentColor] : cust.initialLayersByColor?.[currentColor]) || [];";
code = code.replace(targetLayersCapture, replacementLayersCapture);

const targetBaseImg = /let baseImageUrl = getCloudinaryOptimized\(colorsMap\[currentColor\]\);\s+if \(!baseImageUrl\) \{\s+baseImageUrl = getCloudinaryOptimized\(itemImages\[index\]\) \|\| '';\s+\}/g;
const replacementBaseImg = `
        const viewObj = itemViews?.[index];
        let baseImageUrl = getCloudinaryOptimized(
           activeSides[index] === 'back' && viewObj?.backSide?.imagesByColor?.[currentColor]
             ? viewObj.backSide.imagesByColor[currentColor]
             : colorsMap[currentColor]
        );
        if (!baseImageUrl) {
          baseImageUrl = getCloudinaryOptimized(itemImages[index]) || '';
        }
`;
code = code.replace(targetBaseImg, replacementBaseImg);

fs.writeFileSync(filePath, code);
console.log('Fixed capture logic');
