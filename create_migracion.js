const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const destDir = path.join(baseDir, 'migracion');

function copyRecursiveSync(src, dest) {
  if (fs.existsSync(src)) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach((child) => {
        copyRecursiveSync(path.join(src, child), path.join(dest, child));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

// Ensure base directories exist
['models', 'services', 'pages/admin', 'components/admin'].forEach(dir => {
  fs.mkdirSync(path.join(destDir, dir), { recursive: true });
});

// Copy specific files
const filesToCopy = [
  { src: 'contexto.md', dest: 'contexto.md' },
  { src: 'src/services/brands.js', dest: 'services/brands.js' },
  { src: 'src/services/categories.js', dest: 'services/categories.js' },
  { src: 'src/services/collections.js', dest: 'services/collections.js' },
  { src: 'src/services/mockups.js', dest: 'services/mockups.js' },
  { src: 'src/services/products.js', dest: 'services/products.js' }
];

filesToCopy.forEach(({src, dest}) => {
  const fullSrc = path.join(baseDir, src);
  if (fs.existsSync(fullSrc)) {
    fs.copyFileSync(fullSrc, path.join(destDir, dest));
  }
});

// Copy JSON models
const modelsDir = path.join(baseDir, 'src/models');
if (fs.existsSync(modelsDir)) {
  fs.readdirSync(modelsDir).forEach(file => {
    if (file.endsWith('.json')) {
      fs.copyFileSync(path.join(modelsDir, file), path.join(destDir, 'models', file));
    }
  });
}

// Copy specific Admin files
const adminPagesDir = path.join(baseDir, 'src/pages/admin');
if (fs.existsSync(adminPagesDir)) {
  fs.readdirSync(adminPagesDir).forEach(file => {
    if (file.startsWith('AdminMarcas') || file.startsWith('AdminCategorias') || 
        file.startsWith('AdminColecciones') || file.startsWith('AdminCliparts')) {
      fs.copyFileSync(path.join(adminPagesDir, file), path.join(destDir, 'pages/admin', file));
    }
  });
}

// Copy full V2 directories
copyRecursiveSync(path.join(baseDir, 'src/pages/Tienda'), path.join(destDir, 'pages/Tienda'));
copyRecursiveSync(path.join(baseDir, 'src/components/admin/AdminImageCropper'), path.join(destDir, 'components/admin/AdminImageCropper'));

console.log('¡Carpeta de migración creada con éxito!');
