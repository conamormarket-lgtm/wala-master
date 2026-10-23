/**
 * Lógica PURA del aviso "Encuesta pendiente" (categoría survey del panel de
 * notificaciones). Sin firebase-admin: se testea con Node puro
 * (functions/test/encuestaRecordatorioLogic.test.js).
 *
 * A quien creó su cuenta y no respondió la encuesta le llegan dos avisos: a
 * los 3 días y a los 10 días. Después ninguno más. Cada aviso tiene una
 * ventana de 7 días para salir (por si la categoría estuvo apagada); pasada
 * la ventana ya no sale, así las cuentas viejas no reciben el aviso de golpe.
 */

const DIA_MS = 86400 * 1000;
const VENTANA_DIAS = 7;

const AVISOS = [
  { type: "survey_3d", desdeDia: 3 },
  { type: "survey_10d", desdeDia: 10 },
];

/**
 * Qué aviso le toca hoy a una cuenta, o null.
 * @param {{creadaMs: number, ahoraMs: number, enviados?: object}} p
 *   enviados: { survey_3d: iso, survey_10d: iso } de los que ya salieron.
 */
function avisoQueToca({ creadaMs, ahoraMs, enviados = {} }) {
  if (!Number.isFinite(creadaMs) || !Number.isFinite(ahoraMs)) return null;
  const dias = (ahoraMs - creadaMs) / DIA_MS;
  // Del más nuevo al más viejo: a los 10 días no se manda el de 3 atrasado.
  for (let i = AVISOS.length - 1; i >= 0; i--) {
    const a = AVISOS[i];
    if (dias >= a.desdeDia && dias < a.desdeDia + VENTANA_DIAS) {
      return enviados[a.type] ? null : a.type;
    }
  }
  return null;
}

// Hasta qué antigüedad hay que mirar las cuentas (el último aviso + su ventana).
const MAX_DIAS = AVISOS[AVISOS.length - 1].desdeDia + VENTANA_DIAS;

module.exports = { avisoQueToca, AVISOS, MAX_DIAS, DIA_MS };
