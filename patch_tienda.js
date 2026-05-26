const fs = require('fs');

const tiendaPath = './src/pages/Tienda/TiendaPage.jsx';
let lines = fs.readFileSync(tiendaPath, 'utf8').split(/\r?\n/);

const importIdx = lines.findIndex(l => l.includes("import AppDownloadBanner from './components/AppDownloadBanner';"));
if (importIdx !== -1 && !lines.find(l => l.includes("MobileCategorySubheader"))) {
  lines.splice(importIdx + 1, 0, "import MobileCategorySubheader from './components/MobileCategorySubheader/MobileCategorySubheader';");
}

const containerIdx = lines.findIndex(l => l.includes("<div className={styles.container}>"));
if (containerIdx !== -1 && !lines.find(l => l.includes("<MobileCategorySubheader"))) {
  // Line: <div className={styles.container}> is at containerIdx. We want to insert right after it.
  // There are two such lines, one for loading state and one for main render. The main render is after `if (isConfigLoading && !storefrontConfig)`
  // So we find the LAST occurrence of `<div className={styles.container}>`.
  
  let lastContainerIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("<div className={styles.container}>")) {
      lastContainerIdx = i;
      break;
    }
  }

  if (lastContainerIdx !== -1) {
    lines.splice(lastContainerIdx + 1, 0, "      <MobileCategorySubheader categories={categoriesData} />");
  }
}

fs.writeFileSync(tiendaPath, lines.join('\n'), 'utf8');
console.log("TiendaPage.jsx patched.");
