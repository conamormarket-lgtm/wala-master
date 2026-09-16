/**
 * "hace 3 minutos", "hace 2 días", "en 1 hora".
 *
 * Existe para no arrastrar date-fns al bundle de arranque. La campanita del
 * Header es lo único que mostraba tiempos relativos en la tienda, y por ese
 * `formatDistanceToNow` + el locale español entraban 56 KB de date-fns en el
 * chunk que se descarga al abrir la app. Las pantallas de admin que hacen
 * aritmética de fechas de verdad (calendarios, rangos) siguen usando date-fns;
 * viven en sus propios chunks y ahí no molesta.
 *
 * Se apoya en Intl.RelativeTimeFormat, que va en todos los navegadores desde
 * 2020 y ya conoce las reglas del plural en español ("hace 1 día" / "hace
 * 2 días"), así que no hay tabla de traducciones que mantener. Si no estuviera
 * disponible, cae a un formato simple en vez de romper.
 */

// De mayor a menor: se usa la primera unidad en la que la diferencia llega a 1.
const UNIDADES = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

const formateador = (() => {
  try {
    return new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  } catch {
    return null;
  }
})();

/**
 * @param {Date|number} fecha
 * @param {Date|number} [ahora] referencia; por defecto, el momento actual
 * @returns {string} '' si la fecha no es válida
 */
export function tiempoRelativo(fecha, ahora = Date.now()) {
  const ms = (fecha instanceof Date ? fecha.getTime() : Number(fecha));
  if (!Number.isFinite(ms)) return '';

  const diferencia = ms - (ahora instanceof Date ? ahora.getTime() : Number(ahora));
  const absoluta = Math.abs(diferencia);

  // Menos de un minuto: no tiene sentido decir "hace 0 minutos".
  if (absoluta < 60 * 1000) return 'hace unos segundos';

  for (const [unidad, tamano] of UNIDADES) {
    if (absoluta >= tamano) {
      // trunc y no round: a los 89 minutos seguimos en "hace 1 hora", igual que
      // haría cualquiera al contarlo en voz alta.
      const cantidad = Math.trunc(diferencia / tamano);
      if (formateador) return formateador.format(cantidad, unidad);
      return diferencia < 0 ? `hace ${Math.abs(cantidad)} ${unidad}` : `en ${cantidad} ${unidad}`;
    }
  }

  return 'hace unos segundos';
}

export default tiempoRelativo;
