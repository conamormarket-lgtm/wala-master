const fs = require('fs');
const filePath = 'c:/Users/Usuario/Desktop/WALA0404/WALA/src/components/admin/UnifiedComboEditor/UnifiedComboEditor.jsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Add error property to state in catch block
const targetCatch = /\} catch \(err\) \{/g;
const replaceCatch = `} catch (err) {
        setState(prev => ({ ...prev, _debugError: err ? err.toString() : 'Unknown error' }));`;
code = code.replace(targetCatch, replaceCatch);

// 2. Display it in the fallback content
const targetFallbackHeader = /const UnifiedComboEditorFallbackContent = \((props|\{.*?\}|\S+)\) => \{/g;
const replaceFallbackHeader = `const UnifiedComboEditorFallbackContent = (props) => {
  const debugError = props._debugError;
  const FALLBACK_PROPS = props; // alias`;
code = code.replace(targetFallbackHeader, replaceFallbackHeader);

// Replace any missing destructuring but keeping props
const targetFallbackTitle = /<h4 className=\{styles\.fallbackTitle\}>Editor de Combo \(Modo Básico\)<\/h4>/g;
const replaceFallbackTitle = `<h4 className={styles.fallbackTitle}>Editor de Combo (Modo Básico)</h4>
              {debugError && <div style={{ color: 'red', background: '#fee', padding: '10px', borderRadius: '4px', marginBottom: '10px', fontSize: '13px' }}>Error: {debugError}</div>}`;
code = code.replace(targetFallbackTitle, replaceFallbackTitle);

// Make sure props exist in the UnifiedComboEditor returned fallback component
const targetReturnFallback = /<UnifiedComboEditorFallbackContent\s+\{\.\.\.props\}\s+fallbackUrls=\{state\.itemImages\}/g;
const replaceReturnFallback = `<UnifiedComboEditorFallbackContent
      {...props}
      _debugError={state._debugError}
      fallbackUrls={state.itemImages}`;
code = code.replace(targetReturnFallback, replaceReturnFallback);

fs.writeFileSync(filePath, code);
console.log('Added debug error display');
