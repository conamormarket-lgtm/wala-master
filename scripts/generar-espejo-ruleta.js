// Genera src/utils/ruletaModel.js (ESM) a partir de functions/ruletaLogic.js (CJS).
// El cliente y el servidor DEBEN filtrar y ordenar los premios igual; en vez de
// mantener dos copias a mano, la del cliente se deriva de la del servidor.
// Uso: node scripts/generar-espejo-ruleta.js
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const origen = path.join(raiz, 'functions', 'ruletaLogic.js');
const destino = path.join(raiz, 'src', 'utils', 'ruletaModel.js');

// El árbol de trabajo está en CRLF (core.autocrlf), pero aquí se normaliza a LF
// para que el archivo no acabe con finales de línea mezclados.
const src = fs.readFileSync(origen, 'utf8').replace(/\r\n/g, '\n');
const m = src.match(/module\.exports = \{([\s\S]*?)\};\s*$/);
if (!m) throw new Error('No se encontró el bloque module.exports en ' + origen);

const nombres = new Set(
  m[1]
    .split('\n')
    .map((n) => n.trim().replace(/,$/, ''))
    .filter((n) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n))
);

// Se marcan las declaraciones línea a línea en vez de con expresiones regulares
// construidas a mano: es lo que hay que leer, y no depende de acertar con los
// escapes (un '\b' mal puesto convierte el patrón en un retroceso y no marca nada).
const marcadas = new Set();
const cuerpo = src
  .slice(0, m.index)
  .trimEnd()
  .split('\n')
  .map((linea) => {
    for (const prefijo of ['const ', 'function ']) {
      if (!linea.startsWith(prefijo)) continue;
      const resto = linea.slice(prefijo.length);
      const nombre = (resto.match(/^[A-Za-z_$][A-Za-z0-9_$]*/) || [])[0];
      if (nombre && nombres.has(nombre)) {
        marcadas.add(nombre);
        return 'export ' + linea;
      }
    }
    return linea;
  })
  .join('\n') + '\n';

const faltan = [...nombres].filter((n) => !marcadas.has(n));
if (faltan.length > 0) {
  throw new Error('No se pudo exportar: ' + faltan.join(', ') +
    '. ¿Se declaran en una sola línea al principio de línea?');
}

const cabecera = [
  '// =========================================================================',
  '// Ruleta Semanal — modelo de premios y disponibilidad (ESPEJO DE CLIENTE)',
  '// -------------------------------------------------------------------------',
  '// GENERADO por scripts/generar-espejo-ruleta.js desde functions/ruletaLogic.js.',
  '// No lo edites a mano: edita el original y vuelve a ejecutar el script. El',
  '// servidor sortea y el cliente pinta la rueda; si los dos no filtran y ordenan',
  '// igual, la rueda para en un gajo que no es el premio ganado.',
  '// =========================================================================',
  '',
].join('\n');

fs.writeFileSync(destino, cuerpo.replace(/^\/\/ =+\n(\/\/.*\n)+/, cabecera), 'utf8');
console.log('Espejo generado:', path.relative(raiz, destino), '-', marcadas.size, 'exportaciones');
