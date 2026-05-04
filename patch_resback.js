const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Fix getUrlBack to use variant.imageUrl
const targetGetUrlBack = /if \(!previewUrlBack\) \{[\s\S]*?fallback to front[\s\S]*?\}\s*return \{ imageUrl: previewUrlBack, scale: item\.scale \|\| 1 \};/g;

const replaceGetUrlBack = `if (!previewUrlBack) {
              const frontImgObj = view?.imagesByColor || {};
              const color = item.variantMapping?.color || 'default';
              const productVariants = Array.isArray(data?.variants) ? data.variants : [];
              const variant = productVariants.find(v => v.name === color) || {};
              let fRaw = variant.imageUrl || frontImgObj[color] || frontImgObj.default || data?.mainImage || (Array.isArray(data?.images) ? data?.images[0] : '');
              fRaw = typeof fRaw === 'string' ? ensureSingleImageUrl(fRaw) : '';
              previewUrlBack = fRaw ? toDirectImageUrl(fRaw) : 'https://placehold.co/600x600?text=Sin+Imagen';
          }
          return { imageUrl: previewUrlBack, scale: item.scale || 1 };`;

code = code.replace(targetGetUrlBack, replaceGetUrlBack);

// 2. Wrap resBack in its own try-catch
const targetResCalls = /const res = await generateComboPreviewDataUrlWithBounds\(props\.comboItems, props\.comboLayout, getUrl\);\s+const resBack = await generateComboPreviewDataUrlWithBounds\(props\.comboItems, props\.comboLayout, getUrlBack\);/g;

const replaceResCalls = `const res = await generateComboPreviewDataUrlWithBounds(props.comboItems, props.comboLayout, getUrl);
        let resBack = null;
        try {
          resBack = await generateComboPreviewDataUrlWithBounds(props.comboItems, props.comboLayout, getUrlBack);
        } catch (backErr) {
          console.warn('Ignored error while generating back composed image:', backErr);
        }`;

code = code.replace(targetResCalls, replaceResCalls);

fs.writeFileSync(filePath, code);
console.log('Fixed resBack crashing main load()');
