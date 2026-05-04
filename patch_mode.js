const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Remove my old viewTabs UI entirely!
const targetTabs = /<div className=\{styles\.itemTitle\}>Producto \{index \+ 1\}<\/div>[\s\S]*?\{itemViews\?\.\[index\]\?\.hasBackSide && \([\s\S]*?<\/div>\s*\)\}/g;
code = code.replace(targetTabs, '<div className={styles.itemTitle}>Producto {index + 1}</div>');

// 2. Change all activeSides[index] to currentSide(index) or similar, wait, if I just replace `activeSides` with `mode`?
// Let's create a proxy for `activeSides` inside UnifiedComboEditorContent
const targetActiveSides = /const \[activeSides, setActiveSides\] = useState\(\{\}\);/g;
const replaceActiveSides = "const activeSides = React.useMemo(() => {\n    const obj = {};\n    (comboItems || []).forEach((_, i) => {\n      obj[i] = mode === 'design-back' ? 'back' : 'front';\n    });\n    return obj;\n  }, [mode, comboItems]);";
code = code.replace(targetActiveSides, replaceActiveSides);

// 3. Add the mode button "Diseño Espalda" next to "Diseño por Lienzo"
const targetModeBtn = /<button\s+type="button"\s+className=\{mode === 'design' \? styles\.modeBtnActive : styles\.modeBtn\}\s+onClick=\{\(\) => setMode\('design'\)\}\s*>\s*Diseño por Lienzo\s*<\/button>/g;
const replaceModeBtn = `<button
              type="button"
              className={mode === 'design' ? styles.modeBtnActive : styles.modeBtn}
              onClick={() => setMode('design')}
            >
              Diseño por Lienzo
            </button>
            {itemViews?.some(v => v?.hasBackSide) && (
              <button
                type="button"
                className={mode === 'design-back' ? styles.modeBtnActive : styles.modeBtn}
                onClick={() => setMode('design-back')}
                style={{ backgroundColor: mode === 'design-back' ? '#2196F3' : '#e3f2fd', color: mode === 'design-back' ? '#fff' : '#1976D2', borderColor: '#2196F3' }}
              >
                Diseño Espalda
              </button>
            )}`;
code = code.replace(targetModeBtn, replaceModeBtn);

// 4. Also fix visibility of panel when mode is 'design-back'
// <div className={mode === 'design' ? styles.unifiedModePanel : styles.unifiedModePanelHidden}>
const targetPanelVis = /className=\{mode === 'design' \? styles\.unifiedModePanel : styles\.unifiedModePanelHidden\}/g;
const replacePanelVis = "className={(mode === 'design' || mode === 'design-back') ? styles.unifiedModePanel : styles.unifiedModePanelHidden}";
code = code.replace(targetPanelVis, replacePanelVis);

// 5. Ensure "Fijar miniatura" and other actions show up appropriately
const targetDesignStatus = /\{mode === 'design' && \(/g;
const replaceDesignStatus = "{(mode === 'design' || mode === 'design-back') && (";
code = code.replace(targetDesignStatus, replaceDesignStatus);

// 6. Ensure activeViewId switches with design-back properly
const targetActiveViewChange = /if \(mode === 'design'\) \{\s+const colorsMap =/g;
const replaceActiveViewChange = "if (mode === 'design' || mode === 'design-back') {\n      const colorsMap =";
code = code.replace(targetActiveViewChange, replaceActiveViewChange);

// 7. Remove the 'activeSides' declaration from the wrapper, since we use useMemo in the child now
// wait, we injected it via patch.js: const [activeSides, setActiveSides] = useState({});
// Oh, the regex above handles it. But wait, `activeSides` was added in FallbackContent too.
// The regex `const \[activeSides, setActiveSides\] = useState\(\{\}\);` matches globally, replacing both!

fs.writeFileSync(filePath, code);
console.log('Fixed toggle to use generic tabs');
