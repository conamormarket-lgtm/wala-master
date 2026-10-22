// Genera functions/bolitasMotor.mjs a partir de src/componentes/kit/piezas/bolitasMotor.mjs.
//
// El servidor necesita el MISMO motor que el celular para comprobar una
// partida de Las Bolitas de Kapi: rearma el nivel (o el reto del día) con la
// misma semilla y repite los movimientos con las mismas reglas. Se copia el
// archivo entero, tal cual, con un encabezado; la prueba del motor
// (bolitasMotor.test.mjs) avisa si la copia quedó vieja.
//
// Uso: node scripts/generar-motor-bolitas.js
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const origen = path.join(raiz, 'src', 'componentes', 'kit', 'piezas', 'bolitasMotor.mjs');
const destino = path.join(raiz, 'functions', 'bolitasMotor.mjs');

const ENCABEZADO = `// =========================================================================
// Motor de Las Bolitas de Kapi — COPIA DE SERVIDOR
// -------------------------------------------------------------------------
// GENERADO por scripts/generar-motor-bolitas.js desde
// src/componentes/kit/piezas/bolitasMotor.mjs. No editar a mano.
// =========================================================================

`;

const src = fs.readFileSync(origen, 'utf8').replace(/\r\n/g, '\n');
fs.writeFileSync(destino, ENCABEZADO + src, 'utf8');
console.log('Generado:', path.relative(raiz, destino));

module.exports = { ENCABEZADO };
