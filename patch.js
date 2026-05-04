const fs = require('fs');

const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

if (code.includes('activeSides')) {
    console.log('Already applied!');
    process.exit(0);
}

// Add activeSides
code = code.replace(
    /const \[activeColors, setActiveColors\] = useState\(\(\) => \{/g,
    "const [activeSides, setActiveSides] = useState({});\n  const [activeColors, setActiveColors] = useState(() => {"
);

// Helper config
code = code.replace(
    /const FALLBACK_VIEW_PREFIX = 'combo-fallback-';/g,
    "const FALLBACK_VIEW_PREFIX = 'combo-fallback-';\nconst getVId = (idx, c, sides) => `${FALLBACK_VIEW_PREFIX}${idx}-${c}${sides?.[idx] === 'back' ? '-back' : ''}`;"
);

// Replace strict viewId templating
code = code.replace(/`\$\{FALLBACK_VIEW_PREFIX\}\$\{([a-zA-Z0-9_\.]+)\}-\$\{([a-zA-Z0-9_\.]+)\}`/g, "getVId($1, $2, activeSides)");

// Replace viewIds where it wasn't strictly matching
code = code.replace(/`\$\{FALLBACK_VIEW_PREFIX\}\$\{([^}]+)\}-\$\{([^}]+)\}`/g, "getVId($1, $2, activeSides)");

// Switch image src & view obj
const targetImg = "const rawImgUrl = colorsMap[currentColor] || imgUrl;";
const replacementImg = "const viewObj = itemViews?.[index];\n                const rawImgUrl = activeSides[index] === 'back' && viewObj?.backSide?.imagesByColor?.[currentColor] ? viewObj.backSide.imagesByColor[currentColor] : (colorsMap[currentColor] || imgUrl);";
code = code.replace(targetImg, replacementImg);

const targetProps = "itemColorsHex";
const replacementProps = "itemColorsHex,\n  itemViews";
code = code.replace(targetProps, replacementProps);
// note: only replaces the first instance (in the destructuring) if we are lucky, wait, no, itemColorsHex appears 6 times!

code = code.replace(/itemColorsHex\n\}\) => \{/g, "itemColorsHex,\n  itemViews\n}) => {");

// Switch print Areas
const targetPrint = "printAreas={cust.printAreas || []}";
const replacementPrint = "printAreas={activeSides[index] === 'back' ? (itemViews?.[index]?.backSide?.printAreas || []) : (cust.printAreas || [])}";
code = code.replace(targetPrint, replacementPrint);

// Setup passing itemViews
const targetSetup1 = "const resolvedItemColorsHex = [];";
const replacementSetup1 = "const resolvedItemColorsHex = [];\n        const resolvedItemViews = [];";
code = code.replace(targetSetup1, replacementSetup1);

const targetSetup2 = "const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];";
const replacementSetup2 = "const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];\n          resolvedItemViews[i] = view;";
code = code.replace(targetSetup2, replacementSetup2);

const targetSetup3 = "setState({ composed: null, itemImages: urls, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex });";
const replacementSetup3 = "setState({ composed: null, itemImages: urls, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex, itemViews: resolvedItemViews });";
code = code.replace(targetSetup3, replacementSetup3);

const targetSetup4 = "itemColorsHex={state.itemColorsHex}";
const replacementSetup4 = "itemColorsHex={state.itemColorsHex}\n      itemViews={state.itemViews}";
code = code.replace(/itemColorsHex=\{state.itemColorsHex\}/g, replacementSetup4);

// Add tabs
const btnTarget = "<div className={styles.itemTitle}>Producto {index + 1}</div>";
const newBtn = `<div className={styles.itemTitle}>Producto {index + 1}</div>
                          {itemViews?.[index]?.hasBackSide && (
                            <div className={styles.viewTabs} style={{ marginLeft: '1rem', display: 'flex', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className={\`\${styles.viewTab} \${activeSides[index] !== 'back' ? styles.viewTabActive : ''}\`}
                                onClick={(e) => { e.stopPropagation(); setActiveSides(prev => ({...prev, [index]: 'front'})); }}
                                style={activeSides[index] !== 'back' ? {fontWeight: 'bold', background: '#333', color: '#fff', padding: '2px 8px', borderRadius: '4px'} : {padding: '2px 8px'}}
                              >
                                Frente
                              </button>
                              <button
                                type="button"
                                className={\`\${styles.viewTab} \${activeSides[index] === 'back' ? styles.viewTabActive : ''}\`}
                                onClick={(e) => { e.stopPropagation(); setActiveSides(prev => ({...prev, [index]: 'back'})); }}
                                style={activeSides[index] === 'back' ? {fontWeight: 'bold', background: '#333', color: '#fff', padding: '2px 8px', borderRadius: '4px'} : {padding: '2px 8px'}}
                              >
                                {itemViews?.[index]?.backSide?.name || 'Espalda'}
                              </button>
                            </div>
                          )}`;
code = code.replace(btnTarget, newBtn);

fs.writeFileSync(filePath, code);
console.log('Success');
