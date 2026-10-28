/*
 * Vigencia de algo programado (hoy, las fotos del carrusel principal):
 * `startTime` y `endTime` son ISO de <ControlFecha>; vacíos, sin límite.
 * Una fecha que no se entiende tampoco limita: mejor mostrar la foto que
 * esconderla por un dato roto.
 *
 * scripts/storefront-bootstrap.mjs repite esta cuenta en línea (no puede
 * importar): si cambia aquí, cambia allá.
 */

const instante = (valor) => {
  if (!valor) return null;
  const ms = Date.parse(valor);
  return Number.isNaN(ms) ? null : ms;
};

/** 'vigente' | 'programada' (aún no empieza) | 'vencida' (ya terminó). */
export function estadoDeVigencia(item, ahora = Date.now()) {
  const desde = instante(item?.startTime);
  const hasta = instante(item?.endTime);
  if (desde != null && ahora < desde) return 'programada';
  if (hasta != null && ahora >= hasta) return 'vencida';
  return 'vigente';
}

export const estaVigente = (item, ahora = Date.now()) => estadoDeVigencia(item, ahora) === 'vigente';
