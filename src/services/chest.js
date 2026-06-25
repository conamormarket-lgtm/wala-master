// ── Servicio del Cofre Diario (Fase 5) ──────────────────────────────────
// Wrapper de la Cloud Function callable `openDailyChestSecure`.
// El cliente nunca acredita monedas: todo pasa por el servidor (idempotente por día Lima).
// Devuelve { error, data } para un manejo de errores uniforme.
import { getFunctions, httpsCallable } from 'firebase/functions';

// Abre el cofre diario. Respuesta del servidor:
//   { alreadyOpened: true }                 -> ya se abrió hoy
//   { reward, monedas }                     -> recompensa acreditada (5..20) y saldo nuevo
export const openDailyChest = async () => {
  try {
    const res = await httpsCallable(getFunctions(), 'openDailyChestSecure')();
    return { error: null, data: res.data };
  } catch (e) {
    return { error: e?.message || 'Error en el servidor', data: null };
  }
};
