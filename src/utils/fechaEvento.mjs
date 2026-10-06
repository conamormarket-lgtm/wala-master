// Fechas de las personas de "Fechas importantes" (cumpleaños, aniversario…).
//
// Se guardan como "YYYY-MM-DD" (el servidor y los avisos esperan ese formato),
// pero el AÑO ES OPCIONAL: casi nadie sabe en qué año nació su cuñado. Si no
// se sabe, se guarda con el año "0000" (ANIO_DESCONOCIDO). Los avisos solo usan
// día y mes, así que funcionan igual; la edad simplemente queda sin calcular
// (giftRecommender.edadDe ignora años menores a 1900).
import { proximaFecha, hoyLocal, MESES } from './fechasFestivas.mjs';

export const ANIO_DESCONOCIDO = '0000';
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const dos = (n) => String(n).padStart(2, '0');

// Días que tiene el mes (febrero con 29: el año puede no saberse).
export const diasDelMes = (mes) => (Number(mes) === 2 ? 29 : [4, 6, 9, 11].includes(Number(mes)) ? 30 : 31);

/** "2005-07-27" → { dia: 27, mes: 7, anio: 2005 }; "0000-07-27" → anio null. */
export function partesFechaEvento(iso) {
  const m = ISO.exec(String(iso || ''));
  if (!m) return null;
  const anio = Number(m[1]);
  return { dia: Number(m[3]), mes: Number(m[2]), anio: m[1] === ANIO_DESCONOCIDO || anio < 1900 ? null : anio };
}

/** { dia, mes, anio? } → "YYYY-MM-DD" ("0000-…" sin año). '' si falta día o mes o no existe. */
export function armarFechaEvento({ dia, mes, anio }) {
  const d = Number(dia);
  const m = Number(mes);
  if (!d || !m || m < 1 || m > 12 || d < 1 || d > diasDelMes(m)) return '';
  const a = Number(anio);
  const conAnio = Number.isInteger(a) && a >= 1900 && a <= 9999;
  // 29 de febrero con un año que no es bisiesto no existe.
  if (conAnio && m === 2 && d === 29 && !(a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0))) return '';
  return `${conAnio ? a : ANIO_DESCONOCIDO}-${dos(m)}-${dos(d)}`;
}

/** "27 de julio de 2005" / "27 de julio" (sin año o con conAnio: false). */
export function textoFechaEvento(iso, { conAnio = true } = {}) {
  const p = partesFechaEvento(iso);
  if (!p) return '';
  const base = `${p.dia} de ${MESES[p.mes - 1]}`;
  return conAnio && p.anio ? `${base} de ${p.anio}` : base;
}

/** Próxima vez que se celebra ("YYYY-MM-DD", hoy cuenta). Para entregas y avisos. */
export function proximaOcurrencia(iso, hoy = hoyLocal()) {
  const p = partesFechaEvento(iso);
  if (!p) return '';
  const r = proximaFecha({ tipo: 'fija', mes: p.mes, dia: p.dia }, hoy);
  return r ? r.fecha : '';
}
