/**
 * Las cuentas del saldo de bienvenida en el navegador: espejo de
 * functions/primeraCompraLogic.js (saldoAplicable, totalConSaldo). El servidor
 * las vuelve a hacer al preparar el pago; si no coinciden, rechaza.
 *
 * El saldo paga solo productos (el envío va aparte), hasta el tope de las
 * marcas, y nunca deja el pedido por debajo de S/ 1.
 */
export const TOTAL_MINIMO = 1;

export function saldoAplicable({ disponible, tope, subtotal, envio = 0, minimo = TOTAL_MINIMO }) {
  const sub = Math.max(0, Number(subtotal) || 0);
  const hueco = Math.max(0, sub + Math.max(0, Number(envio) || 0) - minimo);
  const maximo = Math.min(Math.max(0, Number(disponible) || 0), Math.max(0, Number(tope) || 0), sub, hueco);
  return Math.floor(maximo * 100 + 1e-6) / 100;
}

/** Cuánto tiempo queda, en palabras cortas ("6 d 14 h", "3 h 20 min"). */
export function tiempoRestante(venceMs, ahoraMs = Date.now()) {
  const ms = Math.max(0, (Number(venceMs) || 0) - ahoraMs);
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}
