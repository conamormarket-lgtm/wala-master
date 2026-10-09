// Genera functions/wordleWords.js a partir de src/data/wordleDictionary.js.
//
// El servidor necesita la MISMA lista de palabras diarias que el cliente para
// poder comprobar que una partida enviada corresponde a la palabra de hoy. Solo
// se copia DAILY_WORDS (16 KB); la lista de intentos válidos (otros 80 KB) no
// hace falta para eso.
//
// Uso: node scripts/generar-palabras-wordle.js
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const origen = path.join(raiz, 'src', 'data', 'wordleDictionary.js');
const destino = path.join(raiz, 'functions', 'wordleWords.js');

const src = fs.readFileSync(origen, 'utf8').replace(/\r\n/g, '\n');
const m = src.match(/export const DAILY_WORDS = \[([\s\S]*?)\];/);
if (!m) throw new Error('No se encontró DAILY_WORDS en ' + origen);

const palabras = m[1]
  .split(',')
  .map((p) => p.trim().replace(/^["']|["']$/g, ''))
  .filter((p) => /^[A-ZÁÉÍÓÚÜÑ]+$/i.test(p));

const mf = src.match(/export const PALABRAS_FIJAS = (\{[\s\S]*?\});/);
const fijas = mf ? JSON.parse(mf[1]) : {};

if (palabras.length < 100) {
  throw new Error('Solo se extrajeron ' + palabras.length + ' palabras: algo va mal.');
}

const salida = `// =========================================================================
// Palabras diarias de La Palabra del Día — COPIA DE SERVIDOR
// -------------------------------------------------------------------------
// GENERADO por scripts/generar-palabras-wordle.js desde
// src/data/wordleDictionary.js. No editar a mano.
//
// Cuando no hay palabra configurada en wordle_daily_words/{fecha}, el cliente
// saca la del día de esta lista con un hash de la fecha. El servidor necesita
// hacer el mismo cálculo para comprobar que una partida enviada es de la
// palabra de hoy y no de una inventada.
// =========================================================================

const DAILY_WORDS = ${JSON.stringify(palabras)};

// Días con palabra fija (ver PALABRAS_FIJAS en src/data/wordleDictionary.js).
const PALABRAS_FIJAS = ${JSON.stringify(fijas)};

// Mismo cálculo que getDailyWord() en src/services/wordle.js. Si cambia allí,
// cambia aquí o el servidor validará contra otra palabra.
function palabraDelDia(fechaStr) {
  if (PALABRAS_FIJAS[fechaStr]) return PALABRAS_FIJAS[fechaStr];
  // Una por día, en el orden de la lista (barajada): no se repite ninguna
  // hasta recorrerla entera.
  const [y, m, d] = String(fechaStr).split('-').map(Number);
  const dia = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return DAILY_WORDS[((dia % DAILY_WORDS.length) + DAILY_WORDS.length) % DAILY_WORDS.length];
}

module.exports = { DAILY_WORDS, palabraDelDia };
`;

fs.writeFileSync(destino, salida, 'utf8');
console.log('Generado:', path.relative(raiz, destino), '-', palabras.length, 'palabras');
