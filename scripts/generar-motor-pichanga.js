// Copia a functions/ lo que el servidor necesita de La Pichanga de Kapi para
// comprobar una partida y guardar el progreso: el motor, los niveles (con
// los retos), sus soluciones y el progreso, desde src/componentes/kit/piezas/.
// Se copian enteros, tal cual, con un encabezado (sus import relativos
// siguen valiendo); functions/test/pichangaLogic.test.js avisa si una copia
// quedó vieja.
//
// Uso: node scripts/generar-motor-pichanga.js   (npm run gen:motor-pichanga)
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const ARCHIVOS = ['pichangaMotor.mjs', 'pichangaNiveles.mjs', 'pichangaSoluciones.mjs', 'pichangaProgreso.mjs'];

const encabezado = (archivo) => `// =========================================================================
// La Pichanga de Kapi — COPIA DE SERVIDOR
// -------------------------------------------------------------------------
// GENERADO por scripts/generar-motor-pichanga.js desde
// src/componentes/kit/piezas/${archivo}. No editar a mano.
// =========================================================================

`;

function generar() {
  for (const archivo of ARCHIVOS) {
    const origen = path.join(raiz, 'src', 'componentes', 'kit', 'piezas', archivo);
    const destino = path.join(raiz, 'functions', archivo);
    const src = fs.readFileSync(origen, 'utf8').replace(/\r\n/g, '\n');
    fs.writeFileSync(destino, encabezado(archivo) + src, 'utf8');
    console.log('Generado:', path.relative(raiz, destino));
  }
}

if (require.main === module) generar();

module.exports = { ARCHIVOS, encabezado };
