import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from './config';

export const REWARD_AMOUNT = 2; // 2 monedas por ganar (referencia de UI)

/**
 * Reclama la recompensa diaria de Ball Sort SIN prueba de partida.
 * H-06: la acreditación se hace server-side (callable claimBallSortRewardSecure),
 * que valida "una vez por día" y acredita en transacción. La firma se mantiene
 * (userId, userProfile) por compatibilidad, pero el servidor usa el uid del token.
 * Solo la usa la página de antes (BallSortViejo): la nueva registra cada
 * partida con registrarPartidaBolitas.
 */
export const claimBallSortReward = async () => {
  try {
    const res = await httpsCallable(getFunctions(), 'claimBallSortRewardSecure')();
    return { success: true, reward: res.data?.reward ?? REWARD_AMOUNT };
  } catch (error) {
    // code: 'functions/already-exists' si ya cobró hoy (lo usa la página del kit).
    return { success: false, error: error?.message || 'Error al reclamar la recompensa', code: error?.code };
  }
};

/**
 * Una partida ganada, para que el servidor la compruebe (rearma el nivel y
 * repite los movimientos): paga el premio del día si falta, marca la misión
 * y, si es el reto, la anota en el ranking.
 *  - partida: { modo: 'nivel' | 'reto', nivel | fecha, movimientos: [[de, a]…], tubos }
 * → { reward, ya, mejor }. Si la partida no vale o falla la red, lanza.
 */
export const registrarPartidaBolitas = async (partida) => {
  const res = await httpsCallable(getFunctions(), 'registrarPartidaBolitasSecure')(partida);
  return res.data || {};
};

/** El ranking del reto: { hoy: [...], semanal: [...], yo: { hoy, semana, jugadoresHoy, jugadoresSemana } }. */
export const getRankingBolitas = async () => {
  const res = await httpsCallable(getFunctions(), 'getRankingBolitasSecure')();
  return res.data || { hoy: [], semanal: [], yo: {} };
};

/* El progreso del juego en la cuenta (bolitasProgreso/{uid}): lo escribe el
   dueño; no vale dinero (ver firestore.rules). */
export const leerProgresoBolitas = async (uid) => {
  const snap = await getDoc(doc(db, 'bolitasProgreso', uid));
  return snap.exists() ? snap.data() : null;
};

export const guardarProgresoBolitas = (uid, progreso) => setDoc(doc(db, 'bolitasProgreso', uid), progreso);

/* ── Fase 3: marcas ── */

const leerDoc = async (...ruta) => {
  const snap = await getDoc(doc(db, ...ruta));
  return snap.exists() ? snap.data() : null;
};

/** El patrocinio del reto de un día (o null): { marcaId, marcaNombre, texto, cupo, entregados, activo }. */
export const leerPatrocinioBolitas = (fecha) => leerDoc('bolitasPatrocinios', fecha);

/** Las marcas de los mundos, en orden: { marcas: [{ id, nombre }] } (o null). */
export const leerMundosBolitas = () => leerDoc('bolitasConfig', 'mundos');

/** Los premios del ranking semanal: { activo, puestos } (o null). */
export const leerPremiosBolitas = () => leerDoc('bolitasConfig', 'premios');

/** Los patrocinios desde una fecha ('AAAA-MM-DD'), para el admin. */
export const listarPatrociniosBolitas = async (desde) => {
  const snap = await getDocs(query(collection(db, 'bolitasPatrocinios'), where('fecha', '>=', desde), orderBy('fecha')));
  return snap.docs.map((d) => d.data());
};

/** Un toque del juego hacia la tienda (marca o producto): solo suma en las métricas. */
export const contarClicBolitas = ({ marcaId, destino }) =>
  httpsCallable(getFunctions(), 'contarClicBolitasSecure')({ marcaId, destino }).catch(() => {});

/** /admin/bolitas: guardarPatrocinio, borrarPatrocinio, guardarMundos, guardarPremios, metricas, premiarSemana. */
export const adminBolitas = async (accion, datos = {}) => {
  const res = await httpsCallable(getFunctions(), 'adminBolitasSecure')({ accion, ...datos });
  return res.data || {};
};
