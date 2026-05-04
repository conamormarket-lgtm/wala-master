const fs = require('fs');
const path = require('path');

const deleteFolderRecursive = function(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
    console.log(`Eliminado: ${directoryPath}`);
  }
};

const legacyPaths = [
  path.join(__dirname, 'src', 'landing_pages', 'components', 'ProductCard'),
  path.join(__dirname, 'src', 'landing_pages', 'components', 'CategoryNav')
];

console.log('Iniciando limpieza de componentes antiguos...');

legacyPaths.forEach(folder => {
  if (fs.existsSync(folder)) {
    deleteFolderRecursive(folder);
  } else {
    console.log(`La carpeta ${folder} ya no existe. Saltando...`);
  }
});

console.log('¡Limpieza completada! La versión antigua ha sido eliminada.');
