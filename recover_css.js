const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Buscar en el log de git algún commit donde existiera el archivo (puede estar en src/pages/ o src/landing_pages/pages/)
  console.log('Buscando TiendaPage.module.css en el historial de Git...');
  
  // Buscar en todos los commits
  const result = execSync('git log --all --pretty=format:"%h" --name-status | grep -E "TiendaPage\\.module\\.css" || true').toString();
  
  if (result) {
    console.log('¡Se encontró el archivo en la historia de Git!');
    // Extraer la ruta que tenía el archivo en Git
    const match = result.match(/[A-Z]\s+(.*TiendaPage\.module\.css)/);
    if (match && match[1]) {
      const gitPath = match[1].trim();
      console.log(`Ruta antigua en git: ${gitPath}`);
      
      // Restaurar el archivo desde HEAD o el branch actual
      execSync(`git checkout HEAD -- "${gitPath}" || git checkout origin/master -- "${gitPath}"`);
      
      const newPath = path.join(__dirname, 'src', 'pages', 'Tienda', 'TiendaPage.module.css');
      
      // Asegurar que exista el destino
      if (!fs.existsSync(path.dirname(newPath))) {
        fs.mkdirSync(path.dirname(newPath), { recursive: true });
      }
      
      // Mover el archivo a su nueva ubicación
      fs.renameSync(path.join(__dirname, gitPath), newPath);
      console.log('✅ Archivo TiendaPage.module.css recuperado y movido a src/pages/Tienda/');
    }
  } else {
    // Si no está en git (raro), creamos un archivo básico para que compile
    console.log('No se encontró en Git. Creando archivo CSS básico temporal...');
    const basicCss = `
.container { width: 100%; }
.storeHeader { padding: 2rem 0; text-align: center; }
.title { font-size: 2rem; font-weight: bold; }
.sectionBlock { margin-bottom: 3rem; }
    `;
    fs.writeFileSync(path.join(__dirname, 'src', 'pages', 'Tienda', 'TiendaPage.module.css'), basicCss);
    console.log('✅ Creado CSS temporal para evitar error de compilación.');
  }
} catch (error) {
  console.error('Error al recuperar:', error.message);
}
