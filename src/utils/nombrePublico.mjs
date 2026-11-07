/**
 * El nombre que se ve en los rankings de los juegos: el primer nombre y la
 * inicial del apellido ("Lucía R."). La misma regla que el servidor usa en las
 * Bolitas (functions/bolitasLogic.js, nombrePublico). Nunca el correo; sin
 * nombre, null (la pantalla pone "Anónimo" o "Jugador").
 */

// Rellenos que algún camino viejo guardó como si fueran nombres.
const RELLENOS = new Set(['anónimo', 'anonimo', 'jugador']);

export function nombrePublico(perfil) {
  const p = perfil || {};
  const crudo = [p.displayName, p.nombres && p.apellidos ? `${p.nombres} ${p.apellidos}` : p.nombres, p.clienteNombre, p.name, p.nombre]
    .map((v) => String(v == null ? '' : v).trim())
    .find((v) => v && !v.includes('@') && !RELLENOS.has(v.toLocaleLowerCase('es')));
  if (!crudo) return null;
  const palabras = crudo.split(/\s+/).map((w) => w.replace(/[^\p{L}'-]/gu, '')).filter(Boolean);
  if (!palabras.length || palabras[0].length < 2) return null;
  const capital = (w) => w.charAt(0).toLocaleUpperCase('es') + w.slice(1).toLocaleLowerCase('es');
  const nombre = capital(palabras[0].slice(0, 20));
  const inicial = palabras[1] ? ` ${palabras[1].charAt(0).toLocaleUpperCase('es')}.` : '';
  return nombre + inicial;
}

/** El de la ficha y, si la ficha no tiene (entró con Google), el de la cuenta. */
export function nombreParaRanking(perfil, cuenta) {
  return nombrePublico(perfil) || nombrePublico({ displayName: cuenta && cuenta.displayName });
}

/** Un nombre ya publicado (quizá completo, de antes), en corto. */
export function acortarNombre(nombre) {
  return nombrePublico({ displayName: nombre });
}
