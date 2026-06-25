// ── Servicio de Inteligencia / Segmentación (Fase 5) ────────────────────
// Wrapper de la Cloud Function callable `computeSegmentsSecure` (solo admin).
// Recalcula los segmentos RFM de los clientes a partir de la colección 'orders'.
// Devuelve { error, data } para un manejo de errores uniforme.
import { getFunctions, httpsCallable } from 'firebase/functions';

// Recalcula segmentos. Respuesta del servidor:
//   { processed, counts: { vip, activo, en_riesgo, nuevo, ... } }
export const computeSegments = async () => {
  try {
    const res = await httpsCallable(getFunctions(), 'computeSegmentsSecure')();
    return { error: null, data: res.data };
  } catch (e) {
    return { error: e?.message || 'Error en el servidor', data: null };
  }
};
