const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Crear core/connection.js
const coreDir = path.join(srcDir, 'core');
if (!fs.existsSync(coreDir)) {
  fs.mkdirSync(coreDir, { recursive: true });
}
const connectionPath = path.join(coreDir, 'connection.js');
if (!fs.existsSync(connectionPath)) {
  fs.writeFileSync(connectionPath, `// Core centralizado para conexiones y API
export * from '../services/firebase/config';
export { getDocument, setDocument, updateDocument, deleteDocument } from '../services/firebase/firestore';
export { uploadFile, deleteFile, getFileUrl } from '../services/firebase/storage';
`);
}

// Mapeo de carpetas a mover
const moves = [
  { old: 'src/landing_pages/pages/TiendaPage.jsx', new: 'src/pages/Tienda/TiendaPage.jsx' },
  { old: 'src/landing_pages/pages/DynamicLandingPage.jsx', new: 'src/pages/Tienda/DynamicLandingPage.jsx' },
  { old: 'src/landing_pages/components', new: 'src/pages/Tienda/components' },
  { old: 'src/landing_pages/contexts', new: 'src/pages/Tienda/contexts' },
  { old: 'src/landing_pages/services', new: 'src/pages/Tienda/services' },
  { old: 'src/landing_pages/admin', new: 'src/pages/Tienda/admin' },
  { old: 'src/pages/admin/AdminProductoForm.jsx', new: 'src/pages/AdminProducto/AdminProductoForm.jsx' },
  { old: 'src/pages/admin/AdminProductoForm.module.css', new: 'src/pages/AdminProducto/AdminProductoForm.module.css' }
];

// Helper para escanear archivos
function getAllFiles(dirPath, arrayOfFiles) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// 1. Recopilar todos los archivos existentes antes de mover
const allSrcFiles = getAllFiles(srcDir, []);

// 2. Construir mapa de archivos individuales: path_viejo -> path_nuevo
const fileMoveMap = new Map();

allSrcFiles.forEach(file => {
  const relPath = file.split(path.sep).join('/').replace(/.*\/src\//, 'src/');
  
  for (const move of moves) {
    if (relPath === move.old) {
      fileMoveMap.set(relPath, move.new);
      break;
    } else if (relPath.startsWith(move.old + '/')) {
      const newPath = relPath.replace(move.old, move.new);
      fileMoveMap.set(relPath, newPath);
      break;
    }
  }
});

// Función para obtener la nueva ruta (relativa a src) si el archivo se movió, o su ruta actual si no.
function getNewRelPath(oldRelPath) {
  // Manejar imports a directorios (index.js implicit)
  let checkPath = oldRelPath;
  if (fileMoveMap.has(checkPath)) return fileMoveMap.get(checkPath);
  
  checkPath = oldRelPath + '.js';
  if (fileMoveMap.has(checkPath)) return fileMoveMap.get(checkPath).replace(/\.js$/, '');
  
  checkPath = oldRelPath + '.jsx';
  if (fileMoveMap.has(checkPath)) return fileMoveMap.get(checkPath).replace(/\.jsx$/, '');
  
  checkPath = oldRelPath + '/index.js';
  if (fileMoveMap.has(checkPath)) return fileMoveMap.get(checkPath).replace(/\/index\.js$/, '');
  
  checkPath = oldRelPath + '/index.jsx';
  if (fileMoveMap.has(checkPath)) return fileMoveMap.get(checkPath).replace(/\/index\.jsx$/, '');
  
  return oldRelPath;
}

// 3. Crear directorios y mover archivos físicamente
fileMoveMap.forEach((newRel, oldRel) => {
  const oldAbs = path.join(__dirname, oldRel.split('/').join(path.sep));
  const newAbs = path.join(__dirname, newRel.split('/').join(path.sep));
  
  const newDir = path.dirname(newAbs);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
  }
  
  if (fs.existsSync(oldAbs)) {
    fs.renameSync(oldAbs, newAbs);
  }
});

// 4. Limpiar carpetas vacías (como landing_pages)
const landingPagesDir = path.join(srcDir, 'landing_pages');
if (fs.existsSync(landingPagesDir)) {
  fs.rmSync(landingPagesDir, { recursive: true, force: true });
}

// 5. Escanear todos los archivos en sus nuevas ubicaciones para actualizar imports
const newSrcFiles = getAllFiles(srcDir, []);
const extensionsToUpdate = ['.js', '.jsx', '.ts', '.tsx'];

newSrcFiles.forEach(file => {
  if (!extensionsToUpdate.includes(path.extname(file))) return;

  const content = fs.readFileSync(file, 'utf8');
  const relPath = file.split(path.sep).join('/').replace(/.*\/src\//, 'src/');
  
  // Archivo original antes de mover (para calcular paths relativos si el archivo se movió)
  // Pero espera, el archivo en disco YA está movido. Así que la ruta actual ES relPath.
  const currentFileDir = path.dirname(relPath);

  // Expresiones regulares para imports estáticos y dinámicos (soporta multilínea)
  const importRegex = /(import\s+[\s\S]*?from\s+['"])(.*?)(['"])/g;
  const exportRegex = /(export\s+[\s\S]*?from\s+['"])(.*?)(['"])/g;
  const dynamicImportRegex = /(import\s*\(\s*['"])(.*?)(['"]\s*\))/g;

  function replacer(match, p1, importPath, p3) {
    if (!importPath.startsWith('.')) return match; // Node modules or aliases

    // 1. Resolver el path absoluto (relativo a root) que estaba intentando importar EL ARCHIVO ORIGINAL.
    // Ojo: el importPath en el archivo fue escrito basado en el OLD path del archivo.
    // Necesitamos saber cuál era el OLD path de ESTE archivo.
    let oldSelfPath = relPath;
    for (const [oldP, newP] of fileMoveMap.entries()) {
      if (newP === relPath) {
        oldSelfPath = oldP;
        break;
      }
    }
    
    const oldSelfDir = path.dirname(oldSelfPath);
    const resolvedTargetOldPath = path.resolve('/' + oldSelfDir, importPath).slice(1).replace(/\\/g, '/');
    
    // 2. ¿A dónde se movió el target (si es que se movió)?
    const finalTargetRelPath = getNewRelPath(resolvedTargetOldPath);
    
    // 3. Calcular la nueva ruta relativa desde el directorio ACTUAL del archivo al NUEVO target.
    let newImportPath = path.relative('/' + currentFileDir, '/' + finalTargetRelPath).replace(/\\/g, '/');
    
    if (!newImportPath.startsWith('.')) {
      newImportPath = './' + newImportPath;
    }

    return p1 + newImportPath + p3;
  }

  let newContent = content
    .replace(importRegex, replacer)
    .replace(exportRegex, replacer)
    .replace(dynamicImportRegex, replacer);

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
  }
});

console.log('¡Refactorización FSD (Fase 1) completada con éxito!');
