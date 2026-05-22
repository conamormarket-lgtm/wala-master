import { db } from './config';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, addDoc, deleteDoc, query, orderBy, runTransaction } from 'firebase/firestore';

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
  if (!userProfile) return { isUnlocked: false, days: 0, lost: false };

  const currentWeekStart = getStartOfWeek();
  
  // Analizamos los claims guardados en userProfile.weeklyClaimsData
  // Estructura: { weekStart: '2026-05-18', daysClaimed: ['2026-05-18', '2026-05-19'] }
  const data = userProfile.weeklyClaimsData || { weekStart: formatIsoDate(currentWeekStart), daysClaimed: [] };
  
  if (data.weekStart !== formatIsoDate(currentWeekStart)) {
    // Si la semana guardada no es la actual, entonces tiene 0 días esta semana
    return { isUnlocked: false, days: 0, lost: false };
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
export const spinRuleta = async (userId, userProfile) => {
  const eligibility = getRuletaEligibility(userProfile);
  if (!eligibility.isUnlocked) {
    return { success: false, error: 'Ruleta no desbloqueada' };
  }

  // Comprobar si ya giró esta semana
  const currentWeekStart = formatIsoDate(getStartOfWeek());
  if (userProfile.lastRuletaSpinWeek === currentWeekStart) {
    return { success: false, error: 'Ya giraste la ruleta esta semana' };
  }

  try {
    const prizes = await getRuletaPrizes();
    if (prizes.length === 0) throw new Error("No hay premios configurados");

    // Sorteo basado en probabilidades
    const rand = Math.random() * 100;
    let accumulated = 0;
    let selectedPrize = prizes[prizes.length - 1]; // Fallback

    for (const prize of prizes) {
      accumulated += Number(prize.probability);
      if (rand <= accumulated) {
        selectedPrize = prize;
        break;
      }
    }

    // Usar transacción para asignar premio y marcar que ya giró
    const userRef = doc(db, 'users', userId);
    
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error("User does not exist");
      const data = userDoc.data();

      const updateData = {
        lastRuletaSpinWeek: currentWeekStart
      };

      // Si es de tipo Monedas
      if (selectedPrize.type === 'Monedas') {
        updateData.monedas = (data.monedas || 0) + Number(selectedPrize.amount || 0);
      }
      
      // Aquí se pueden agregar lógicas para otros tipos de premios
      // Ej. Accesorio (agregarlo a la mochila), Descuento (crear código y agregarlo al perfil), etc.

      transaction.update(userRef, updateData);
    });

    return { success: true, prize: selectedPrize };
  } catch (error) {
    console.error('Error spinning ruleta:', error);
    return { success: false, error: error.message };
  }
};
