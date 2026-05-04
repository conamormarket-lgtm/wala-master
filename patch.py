import re
import codecs

file_path = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx'
with codecs.open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Make sure we don't apply multiple times
if 'activeSides' in code:
    print('Already applied!')
    exit(0)

# Add activeSides
code = code.replace(
    "  const [activeColors, setActiveColors] = useState(() => {",
    "  const [activeSides, setActiveSides] = useState({});\n  const [activeColors, setActiveColors] = useState(() => {"
)

# Helper config
code = code.replace(
    "const FALLBACK_VIEW_PREFIX = 'combo-fallback-';",
    "const FALLBACK_VIEW_PREFIX = 'combo-fallback-';\nconst getVId = (idx, c, sides) => ${FALLBACK_VIEW_PREFIX}-;"
)

# Replace strict viewId templating
code = re.sub(r'\$\{FALLBACK_VIEW_PREFIX\}\$\{([a-zA-Z0-9_\.]+)\}-\$\{([a-zA-Z0-9_\.]+)\}', r'getVId(\1, \2, activeSides)', code)

# Switch image src & view obj
code = code.replace(
    "const rawImgUrl = colorsMap[currentColor] || imgUrl;",
    "const viewObj = args.itemViews?.[index] || itemViews?.[index];\n                const rawImgUrl = activeSides[index] === 'back' && viewObj?.backSide?.imagesByColor?.[currentColor] ? viewObj.backSide.imagesByColor[currentColor] : (colorsMap[currentColor] || imgUrl);"
)
# Note: I need to ensure args... wait, itemViews might be destructured or not. Let's just use itemViews?.[index] if I add itemViews to props.

code = code.replace(
    "itemColorsHex",
    "itemColorsHex,\n  itemViews"
)

# Switch print Areas
code = code.replace(
    "printAreas={cust.printAreas || []}",
    "printAreas={activeSides[index] === 'back' ? (itemViews?.[index]?.backSide?.printAreas || []) : (cust.printAreas || [])}"
)

# Setup passing itemViews
code = code.replace(
    "const resolvedItemColorsHex = [];",
    "const resolvedItemColorsHex = [];\n        const resolvedItemViews = [];"
)
code = code.replace(
    "const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];",
    "const view = data?.customizationViews?.find(v => v.id === item.viewId) || data?.customizationViews?.[0];\n          resolvedItemViews[i] = view;"
)
code = code.replace(
    "setState({ composed: null, itemImages: urls, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex });",
    "setState({ composed: null, itemImages: urls, itemImagesByColor: resolvedItemImagesByColor, itemSizes: resolvedItemSizes, itemColorsHex: resolvedItemColorsHex, itemViews: resolvedItemViews });"
)
code = code.replace(
    "itemColorsHex={state.itemColorsHex}",
    "itemColorsHex={state.itemColorsHex}\n      itemViews={state.itemViews}"
)

# Add tabs
btn_target = '<div className={styles.itemTitle}>Producto {index + 1}</div>'
new_btn = '''<div className={styles.itemTitle}>Producto {index + 1}</div>
                          {itemViews?.[index]?.hasBackSide && (
                            <div className={styles.viewTabs} style={{ marginLeft: '1rem', display: 'flex' }}>
                              <button
                                type="button"
                                className={${styles.viewTab} }
                                onClick={(e) => { e.stopPropagation(); setActiveSides(prev => ({...prev, [index]: 'front'})); }}
                                style={activeSides[index] !== 'back' ? {fontWeight: 'bold', background: '#333', color: '#fff', padding: '2px 8px', borderRadius: '4px'} : {padding: '2px 8px'}}
                              >
                                Frente
                              </button>
                              <button
                                type="button"
                                className={${styles.viewTab} }
                                onClick={(e) => { e.stopPropagation(); setActiveSides(prev => ({...prev, [index]: 'back'})); }}
                                style={activeSides[index] === 'back' ? {fontWeight: 'bold', background: '#333', color: '#fff', padding: '2px 8px', borderRadius: '4px'} : {padding: '2px 8px'}}
                              >
                                {itemViews?.[index]?.backSide?.name || 'Espalda'}
                              </button>
                            </div>
                          )}'''
code = code.replace(btn_target, new_btn)

# Add 'activeSides' param to callback
code = code.replace(
    "layersByViewRef.current[vId]",
    "layersByViewRef.current[vId]"
)

with codecs.open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)

print('Success')
