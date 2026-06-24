import { db } from './config';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, addDoc, deleteDoc, query, orderBy, runTransaction } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
// eslint-disable-next-line no-unused-vars
import { PORTAL_USERS_COLLECTION } from '../../constants/userCollections';

// --- UTILIDADES DE FECHA ---
export const getStartOfWeek = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const formatIsoDate = (date) => date.toISOString().split('T')[0];

export const isSameWeek = (date1, date2) => {
  return getStartOfWeek(date1).getTime() === getStartOfWeek(date2).getTime();
};

export const getRuletaEligibility = (userProfile) => {
  if (!userProfile) return { isUnlocked: false, days: 0, hasLost: false };

  const currentWeekStart = getStartOfWeek();
  
  // Analizamos los claims guardados en userProfile.weeklyClaimsData
  // Estructura: { weekStart: '2026-05-18', daysClaimed: ['2026-05-18', '2026-05-19'] }
  const data = userProfile.weeklyClaimsData || { weekStart: formatIsoDate(currentWeekStart), daysClaimed: [] };
  
  if (data.weekStart !== formatIsoDate(currentWeekStart)) {
    // Si la semana guardada no es la actual, entonces tiene 0 días esta semana
    return { isUnlocked: false, days: 0, hasLost: false };
  }

  const daysCount = data.daysClaimed.length;
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 (Domingo) - 6 (Sábado)
  
  // Para perder, debe haber pasado al menos un día en la semana sin que lo haya reclamado
  // Ej: Es miércoles (3). Debería tener 3 daysClaimed. Si tiene menos de 2, ya perdió la semana.
  // Lógica exacta de pérdida:
  let adjustedDay = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
  const missedDays = adjustedDay - daysCount;
  
  // Si hoy no ha reclamado, missedDays puede ser 1, pero aún puede reclamar hoy.
  // Si la diferencia entre el día actual de la semana y los reclamados es >= 2, seguro perdió.
  // O si ya terminó el día ayer y le faltaba 1.
  // Simplificación de pérdida: Si estamos a Domingo (7) y tiene < 6 reclamados, ya perdió seguro.
  const hasLost = (adjustedDay > daysCount + 1);

  const isUnlocked = daysCount >= 7;

  return { isUnlocked, days: daysCount, hasLost };
};

// --- PREMIOS ---
const PRIZES_COLLECTION = 'ruletaPrizes';
const CONFIG_DOC = 'ruletaConfig/settings';

export const getRuletaPrizes = async () => {
  try {
    const q = query(collection(db, PRIZES_COLLECTION), orderBy('probability', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching ruleta prizes:', error);
    return [];
  }
};

export const saveRuletaPrize = async (prizeData, id = null) => {
  try {
    if (id) {
      await updateDoc(doc(db, PRIZES_COLLECTION, id), prizeData);
    } else {
      await addDoc(collection(db, PRIZES_COLLECTION), prizeData);
    }
    return { success: true };
  } catch (error) {
    console.error('Error saving ruleta prize:', error);
    return { success: false, error };
  }
};

export const deleteRuletaPrize = async (id) => {
  try {
    await deleteDoc(doc(db, PRIZES_COLLECTION, id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting ruleta prize:', error);
    return { success: false, error };
  }
};

// --- SPIN ---
/**
 * Gira la ruleta. H-06: el sorteo (RNG) y la acreditación se hacen server-side
 * (callable spinRuletaSecure), que valida elegibilidad (7 días reclamados) y que
 * no se haya girado esta semana. La firma se mantiene por compatibilidad; el
 * servidor usa el uid del token y su propio estado, no los argumentos del cliente.
 */
export const spinRuleta = async () => {
  try {
    const res = await httpsCallable(getFunctions(), 'spinRuletaSecure')();
    return { success: true, prize: res.data?.prize };
  } catch (error) {
    return { success: false, error: error?.message || 'Error al girar la ruleta' };
  }
};
