const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Add composedBack to state initialization
code = code.replace(
  "const [state, setState] = useState({ composed: null,",
  "const [state, setState] = useState({ composed: null, composedBack: null,"
);

// 2. Add product cache and getUrlBack to the `load` function block.
const targetLoadGetUrl = /const getUrl = async \(item, index\) => \{\s+const \{ data \} = await getProduct\(item\.productId\);/g;

const replaceLoadGetUrl = `
        const productCache = {};
        const getProductMemo = async (id) => {
          if (!productCache[id]) productCache[id] = await getProduct(id);
          return productCache[id];
        };

        const getUrlBack = async (item, index) => {
          const { data } = await getProductMemo(item.productId);
          const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];
          const colorImgObj = view?.backSide?.imagesByColor || {};
          
          let previewUrlBack = '';
          if (colorImgObj) {
            const color = item.variantMapping?.color || 'default';
            previewUrlBack = colorImgObj[color] || colorImgObj.default || Object.values(colorImgObj)[0] || '';
            previewUrlBack = typeof previewUrlBack === 'string' ? ensureSingleImageUrl(previewUrlBack) : '';
            previewUrlBack = previewUrlBack ? toDirectImageUrl(previewUrlBack) : '';
          }
          if (!previewUrlBack) {
              // fallback to front
              const frontImgObj = view?.imagesByColor || {};
              const color = item.variantMapping?.color || 'default';
              let fRaw = frontImgObj[color] || frontImgObj.default || data?.mainImage || (Array.isArray(data?.images) ? data?.images[0] : '');
              fRaw = typeof fRaw === 'string' ? ensureSingleImageUrl(fRaw) : '';
              previewUrlBack = fRaw ? toDirectImageUrl(fRaw) : 'https://placehold.co/600x600?text=Sin+Imagen';
          }

          return { imageUrl: previewUrlBack, scale: item.scale || 1 };
        };

        const getUrl = async (item, index) => {
          const { data } = await getProductMemo(item.productId);`;

code = code.replace(targetLoadGetUrl, replaceLoadGetUrl);

// 3. Generate both dataUrl bounds
const targetResGen = /const res = await generateComboPreviewDataUrlWithBounds\((props\.comboItems, props\.comboLayout, getUrl)\);[\s\S]*?if \(!cancelled\) \{[\s\S]*?setState\(\{ composed: res, itemImages: resolvedImages, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex, itemViews: resolvedItemViews \}\);/g;

const replaceResGen = `const res = await generateComboPreviewDataUrlWithBounds($1);
        const resBack = await generateComboPreviewDataUrlWithBounds(props.comboItems, props.comboLayout, getUrlBack);
        if (!cancelled) {
          setState({ composed: res, composedBack: resBack, itemImages: resolvedImages, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex, itemViews: resolvedItemViews });`;

code = code.replace(targetResGen, replaceResGen);

// 4. Pass composedBack down to UnifiedComboEditorContent
const targetContentProps = /composedImageUrl=\{state\.composed\.dataUrl\}/g;
const replaceContentProps = `composedImageUrl={state.composed.dataUrl}
      composedImageUrlBack={state.composedBack?.dataUrl}`;

code = code.replace(targetContentProps, replaceContentProps);

// 5. De-structure composedImageUrlBack inside UnifiedComboEditorContent
const targetContentDestructure = /composedImageUrl,(\s+)itemImages,/g;
const replaceContentDestructure = `composedImageUrl,$1composedImageUrlBack,$1itemImages,`;

code = code.replace(targetContentDestructure, replaceContentDestructure);

// 6. Use composedImageUrlBack in PrintAreasEditor
const targetPrintAreasEditor = /imageUrl=\{getCloudinaryOptimized\(composedImageUrl\)\}/g;
const replacePrintAreasEditor = `imageUrl={getCloudinaryOptimized(mode === 'zones-back' && composedImageUrlBack ? composedImageUrlBack : composedImageUrl)}`;

code = code.replace(targetPrintAreasEditor, replacePrintAreasEditor);

fs.writeFileSync(filePath, code);
console.log('Fixed caching and zone back image rendering');
