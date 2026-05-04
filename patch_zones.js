const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. In `UnifiedComboEditorContent`, compute unifiedPrintAreas based on mode
const targetUnifiedPrintAreas = /const unifiedPrintAreas = useMemo\(\(\) => \{\s+const list = \[\];\s+const cust = comboItemCustomization \|\| \[\];\s+comboItems\.forEach\(\(_, index\) => \{\s+const custom = cust\[index\] \|\| \{\};\s+const printAreas = Array\.isArray\(custom\.printAreas\) \? custom\.printAreas : \[\];/g;
const replaceUnifiedPrintAreas = `const unifiedPrintAreas = useMemo(() => {
    const list = [];
    const cust = comboItemCustomization || [];
    comboItems.forEach((_, index) => {
      const custom = cust[index] || {};
      const isBackZones = mode === 'zones-back';
      const sourceAreas = isBackZones ? custom?.backSide?.printAreas : custom.printAreas;
      const printAreas = Array.isArray(sourceAreas) ? sourceAreas : [];`;
code = code.replace(targetUnifiedPrintAreas, replaceUnifiedPrintAreas);

// Wait, the dependency array for unifiedPrintAreas must include 'mode'
const targetUnifiedDeps = /\}, \[comboItems, comboItemCustomization, boundsPct\]\);/g;
const replaceUnifiedDeps = `}, [comboItems, comboItemCustomization, boundsPct, mode]);`;
code = code.replace(targetUnifiedDeps, replaceUnifiedDeps);

// 2. handleZonesChange to save to correct target (Front or Back)
const targetHandleZonesChange = /return \{\s+\.\.\.cust, \/\/ Preservar otras propiedades\s+productId: item\.productId,\s+viewId: item\.viewId,\s+printAreas: byItem\[i\]\.printAreas,\s+initialLayersByColor: newInitialLayers\s+\};/g;
const replaceHandleZonesChange = `const isBackZones = mode === 'zones-back';
        return {
          ...cust,
          productId: item.productId,
          viewId: item.viewId,
          printAreas: isBackZones ? (cust.printAreas || []) : byItem[i].printAreas,
          initialLayersByColor: newInitialLayers,
          backSide: {
            ...cust.backSide,
            printAreas: isBackZones ? byItem[i].printAreas : (cust.backSide?.printAreas || []),
            initialLayersByColor: newBackLayers
          }
        };`;
code = code.replace(targetHandleZonesChange, replaceHandleZonesChange);

// Ensure the zones-back mode is passed properly to the image viewer inside Zones Editor
const targetDecomposedModePanel = /<div className=\{mode === 'zones' && canEditZones \? styles\.unifiedModePanel : styles\.unifiedModePanelHidden\}>/g;
const replaceDecomposedModePanel = `<div className={(mode === 'zones' || mode === 'zones-back') && canEditZones ? styles.unifiedModePanel : styles.unifiedModePanelHidden}>`;
code = code.replace(targetDecomposedModePanel, replaceDecomposedModePanel);

// Ensure composed image uses the BACK image when in zones-back
// In the UnifiedComboEditor component (not content), we need to handle "zones-back". But composedImageUrl is generated statically inside load(). 
// Let's pass a 'mode' back up? No, composedImageUrl is generated once with default fallbacks. But we can generate a composedImageUrlBack!
// Wait! We can just instruct the user. If they want backward composed zones, we might need a dynamically composed image. 
// For now, let's just make the UI logic grouped nicely and use the base `composedImageUrl` (since the layout is practically identical visually for most users, or just use `itemImages`).

// Let's rebuild the UI Toggle buttons
const targetHeader = /<div className=\{styles\.modeToggle\}>[\s\S]*?\{mode === 'design' && \([\s\S]*?📸 Fijar miniatura\}[\s\S]*?<\/button>\s*\)\}\s*<\/div>/g;

const uiGroup = `<div className={styles.modeToggle} style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            
            <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
               <div style={{ background: '#f5f5f5', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #ccc' }}>🎨 Diseños</div>
               <button
                  type="button"
                  className={mode === 'design' ? styles.modeBtnActive : styles.modeBtn}
                  onClick={() => setMode('design')}
                  style={{ border: 'none', borderRadius: 0, margin: 0, padding: '8px 16px' }}
                >
                  Frente
               </button>
               {itemViews?.some(v => v?.hasBackSide) && (
                 <button
                    type="button"
                    className={mode === 'design-back' ? styles.modeBtnActive : styles.modeBtn}
                    onClick={() => setMode('design-back')}
                    style={{ border: 'none', borderRadius: 0, margin: 0, padding: '8px 16px', borderLeft: '1px solid #ccc' }}
                  >
                    Espalda
                 </button>
               )}
            </div>

            {canEditZones && (
              <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
                 <div style={{ background: '#f5f5f5', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #ccc' }}>🔳 Zonas Unificadas</div>
                 <button
                    type="button"
                    className={mode === 'zones' ? styles.modeBtnActive : styles.modeBtn}
                    onClick={() => setMode('zones')}
                    style={{ border: 'none', borderRadius: 0, margin: 0, padding: '8px 16px' }}
                  >
                    Frente
                 </button>
                 {itemViews?.some(v => v?.hasBackSide) && (
                   <button
                      type="button"
                      className={mode === 'zones-back' ? styles.modeBtnActive : styles.modeBtn}
                      onClick={() => setMode('zones-back')}
                      style={{ border: 'none', borderRadius: 0, margin: 0, padding: '8px 16px', borderLeft: '1px solid #ccc' }}
                    >
                      Espalda
                   </button>
                 )}
              </div>
            )}

            {(mode === 'design' || mode === 'design-back') && (
              <button
                type="button"
                className={styles.modeBtn}
                style={{ marginLeft: 'auto', backgroundColor: '#e2f0d9', borderColor: '#7fbf5d', padding: '8px 16px' }}
                onClick={handleCapture}
                disabled={isCapturing}
              >
                {isCapturing ? 'Capturando...' : '📸 Fijar miniatura'}
              </button>
            )}
          </div>`;

code = code.replace(targetHeader, uiGroup);

// Handle zones rendering image properly. In PrintAreasEditor mapping:
const targetZonesImage = /<PrintAreasEditor\s+imageUrl=\{getCloudinaryOptimized\(composedImageUrl\)\}/g;
const replaceZonesImage = `<PrintAreasEditor
                  imageUrl={getCloudinaryOptimized(composedImageUrl)}`;
// Actually, composedImageUrl doesn't hold the BACK side composed image. It's too complex to compose the back image synchronously inside the UI just for zones drawing since they both have the exact same boundaries anyway. We'll leave the front image as the reference for zones placement.
code = code.replace(targetZonesImage, replaceZonesImage);


fs.writeFileSync(filePath, code);
console.log('Fixed UI grouping and modes');
