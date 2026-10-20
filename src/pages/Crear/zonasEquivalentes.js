/**
 * Pasar un diseño de una prenda a otra distinta (en un conjunto, "Copiar de
 * la prenda 1": de la casaca al polo). Las zonas se llaman parecido pero no
 * igual (la casaca tiene "frente-pecho-derecho", el polo "frente-pecho"):
 * cada zona del diseño va a la misma zona si existe y, si no, a la de su misma
 * familia (pecho con pecho, manga con manga, espalda con espalda: el id sin el
 * "-derecho/-izquierda" del final). Si dos zonas caen en la misma, va la
 * primera. Lo que no tiene dónde ir (el pecho en un jogger) se queda afuera.
 */

const familia = (id) => String(id || '').replace(/-(derech|izquierd)[oa]$/, '');
const lado = (id) => (/-derech[oa]$/.test(id) ? 'derecho' : /-izquierd[oa]$/.test(id) ? 'izquierdo' : '');

/**
 * { [idZonaOrigen]: idZonaDestino } para las zonas que tienen equivalente.
 *  - origen: ids de las zonas con diseño
 *  - destino: [{ id }] las zonas de la otra prenda (listarZonas)
 */
export const mapearZonas = (origen, destino) => {
  const ids = (destino || []).map((z) => z.id);
  const usadas = new Set();
  const mapa = {};
  (origen || []).forEach((id) => {
    let elegida = ids.includes(id) ? id : null;
    if (!elegida) {
      const misma = ids.filter((d) => familia(d) === familia(id));
      // Mismo lado si lo hay (pecho derecho con pecho derecho); si no, la primera.
      elegida = misma.find((d) => lado(d) === lado(id) && !usadas.has(d)) || misma.find((d) => !usadas.has(d)) || null;
    }
    if (elegida && !usadas.has(elegida)) {
      usadas.add(elegida);
      mapa[id] = elegida;
    }
  });
  return mapa;
};

/** Las capas de un diseño pasadas a las zonas de la otra prenda ({} si nada encaja). */
export const capasEnOtraPrenda = (capasPorZona, zonasDestino) => {
  const conDiseno = Object.entries(capasPorZona || {}).filter(([, c]) => Array.isArray(c) && c.length);
  const mapa = mapearZonas(conDiseno.map(([id]) => id), zonasDestino);
  return Object.fromEntries(conDiseno.filter(([id]) => mapa[id]).map(([id, c]) => [mapa[id], c]));
};
