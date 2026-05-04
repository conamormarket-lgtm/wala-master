const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const moves = [
  { old: 'pages/TiendaPage.jsx', new: 'landing_pages/pages/TiendaPage.jsx' },
  { old: 'pages/TiendaPage.module.css', new: 'landing_pages/pages/TiendaPage.module.css' },
  { old: 'pages/DynamicLandingPage.jsx', new: 'landing_pages/pages/DynamicLandingPage.jsx' },
  { old: 'components/tienda', new: 'landing_pages/components' },
  { old: 'components/admin/VisualEditorPanel.jsx', new: 'landing_pages/admin/VisualEditorPanel.jsx' },
  { old: 'pages/admin/AdminLandingPages.jsx', new: 'landing_pages/admin/AdminLandingPages.jsx' },
  { old: 'pages/admin/AdminStoreEditor.jsx', new: 'landing_pages/admin/AdminStoreEditor.jsx' },
  { old: 'contexts/VisualEditorContext.jsx', new: 'landing_pages/contexts/VisualEditorContext.jsx' },
  { old: 'services/storefront.js', new: 'landing_pages/services/storefront.js' },
  { old: 'services/landingPages.js', new: 'landing_pages/services/landingPages.js' },
];

function getMovedPath(absPath) {
  for (const move of moves) {
    const oldAbs = path.join(srcDir, move.old);
    const newAbs = path.join(srcDir, move.new);
    if (absPath === oldAbs) return newAbs;
    if (absPath.startsWith(oldAbs + path.sep)) {
      return absPath.replace(oldAbs, newAbs);
    }
  }
  return absPath;
}

function getOldPath(absPath) {
  for (const move of moves) {
    const newAbs = path.join(srcDir, move.new);
    const oldAbs = path.join(srcDir, move.old);
    if (absPath === newAbs) return oldAbs;
    if (absPath.startsWith(newAbs + path.sep)) {
      return absPath.replace(newAbs, oldAbs);
    }
  }
  return absPath;
}

// Ensure POSIX style slashes for imports
function toPosixPath(p) {
  return p.split(path.sep).join('/');
}

// Get all files in src
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// 1. Rename files first
console.log('--- Moving files ---');
for (const move of moves) {
  const oldPath = path.join(srcDir, move.old);
  const newPath = path.join(srcDir, move.new);
  if (fs.existsSync(oldPath)) {
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    fs.renameSync(oldPath, newPath);
    console.log(`Moved: ${move.old} -> ${move.new}`);
  }
}

// 2. Process all JS/JSX/CSS files to update imports
console.log('\n--- Updating imports ---');
const allFiles = getAllFiles(srcDir);

const importRegexes = [
  /(import\s+.*?from\s+['"])(.*?)(['"])/g,
  /(import\(['"])(.*?)(['"]\))/g,
  /(require\(['"])(.*?)(['"]\))/g,
  /(@import\s+['"])(.*?)(['"])/g // for CSS
];

let updatedCount = 0;

for (const filePath of allFiles) {
  if (!filePath.match(/\.(js|jsx|ts|tsx|css)$/)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // What was the old path of THIS file before we moved it?
  const oldFilePath = getOldPath(filePath);
  const oldFileDir = path.dirname(oldFilePath);
  
  for (const regex of importRegexes) {
    content = content.replace(regex, (match, prefix, importPath, suffix) => {
      // Only process relative imports
      if (!importPath.startsWith('.')) return match;
      
      // Calculate absolute path of what it was importing
      // Import paths always use POSIX slashes, so we split by '/'
      const importedAbsPath = path.resolve(oldFileDir, ...importPath.split('/'));
      
      // Where did the imported file move to?
      // Since it could be importing without extension, check various extensions if needed.
      // Actually, path.resolve just does string manipulation. getMovedPath checks prefixes, so it works even without extension, EXCEPT if the exact file moved but import omitted extension.
      // Let's find the exact moved path.
      let targetOldAbs = importedAbsPath;
      let targetNewAbs = getMovedPath(targetOldAbs);
      
      // If we didn't find a move, try with extensions
      if (targetOldAbs === targetNewAbs) {
        for (const ext of ['.js', '.jsx', '.css']) {
          const testNew = getMovedPath(targetOldAbs + ext);
          if (testNew !== targetOldAbs + ext) {
            // It moved! Remove extension for the relative path
            targetNewAbs = testNew.substring(0, testNew.length - ext.length);
            break;
          }
        }
      }
      
      // Calculate new relative path
      const currentFileDir = path.dirname(filePath);
      let newRelative = path.relative(currentFileDir, targetNewAbs);
      newRelative = toPosixPath(newRelative);
      if (!newRelative.startsWith('.')) {
        newRelative = './' + newRelative;
      }
      
      if (newRelative !== importPath) {
        return `${prefix}${newRelative}${suffix}`;
      }
      return match;
    });
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated imports in: ${path.relative(srcDir, filePath)}`);
    updatedCount++;
  }
}

console.log(`Done. Updated ${updatedCount} files.`);
