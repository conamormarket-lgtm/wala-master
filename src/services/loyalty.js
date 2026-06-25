// ── Servicio de fidelización (Fase 2) ───────────────────────────────────
// Wrappers de Cloud Functions callable + lectura del ledger.
// El cliente NUNCA escribe saldos/xp/rachas: todo pasa por funciones servidor.
// Cada wrapper devuelve { error, data } para un manejo de errores uniforme.
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase/config';

// Invoca una Cloud Function callable y normaliza la respuesta.
const callFn = async (name, payload = {}) => {
  try {
    const res = await httpsCallable(getFunctions(), name)(payload);
    return { error: null, data: res.data };
  } catch (e) {
    return { error: e?.message || 'Error en el servidor', data: null };
  }
};

// Check-in diario idempotente. Devuelve { streak, reward }.
export const dailyCheckIn = async () => callFn('dailyCheckInSecure');

// Asegura/lee las misiones diarias de hoy. Devuelve { date, items:[...] }.
export const getDailyMissions = async () => callFn('getDailyMissionsSecure');

// Marca una misión como completada (idempotente). Devuelve { success, reward }.
export const completeMission = async (missionId) =>
  callFn('completeMissionSecure', { missionId });

// Lee las últimas 50 entradas del ledger de fidelización del usuario.
// Lectura directa con el SDK (las reglas restringen a uid == dueño).
export const getLedger = async (uid) => {
  if (!db) return { error: 'Firestore no está configurado', data: null };
  if (!uid) return { error: 'Falta uid', data: null };
  try {
    const q = query(
      collection(db, 'loyaltyLedger'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { error: null, data };
  } catch (e) {
    return { error: e?.message || 'Error al leer el historial', data: null };
  }
};
