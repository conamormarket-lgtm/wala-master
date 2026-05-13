import { collection, doc, getDoc, setDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase/config';
import { getCurrentUser } from './firebase/auth';
import { DAILY_WORDS } from '../data/wordleDictionary';

const DAILY_WORDS_COLLECTION = 'wordle_daily_words';
const USERS_COLLECTION = 'portal_clientes_users';
const WORDLE_COLLECTION = 'wordle';

// Si el diccionario aún no se generó, usamos un fallback básico de 5 letras
const FALLBACK_WORDS = DAILY_WORDS.length > 5 ? DAILY_WORDS : [
  "MUNDO", "TIGRE", "PERRO", "GATOS", "LUNAS", "SOLAR", "MARTE", "PLATA", "COBRE", "LAPIZ"
];

/**
 * Obtener la palabra del día según la fecha local (formato YYYY-MM-DD).
 */
export const getDailyWord = async (dateStr) => {
  try {
    const docRef = doc(db, DAILY_WORDS_COLLECTION, dateStr);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().word.toUpperCase();
    }
  } catch (error) {
    console.error("Error fetching daily word:", error);
  }

  // Fallback: usar una palabra del arreglo basada en la fecha determinista
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_WORDS.length;
  return FALLBACK_WORDS[index];
};

/**
 * Obtener todas las palabras configuradas (Para el Admin Panel).
 */
export const getAllDailyWords = async () => {
  try {
    const q = query(collection(db, DAILY_WORDS_COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching all daily words:", error);
    return [];
  }
};

/**
 * Establecer una palabra para un día específico (Admin).
 */
export const setDailyWord = async (dateStr, word) => {
  try {
    await setDoc(doc(db, DAILY_WORDS_COLLECTION, dateStr), {
      word: word.toUpperCase()
    });
    return { success: true };
  } catch (error) {
    console.error("Error setting daily word:", error);
    return { error: error.message };
  }
};

/**
 * Eliminar una palabra configurada (Admin).
 */
export const deleteDailyWord = async (dateStr) => {
  try {
    // Importamos deleteDoc de manera dinámica para no recargar las importaciones de arriba
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, DAILY_WORDS_COLLECTION, dateStr));
    return { success: true };
  } catch (error) {
    console.error("Error deleting daily word:", error);
    return { error: error.message };
  }
};

/**
 * Actualiza o registra las estadísticas del jugador cuando termina una partida.
 */
export const saveWordleResult = async (won, attemptsUsed, timeSeconds, word, length) => {
  const user = getCurrentUser();
  if (!user) return { error: "No user authenticated" };

  try {
    const userRef = doc(db, USERS_COLLECTION, user.uid);
    const userSnap = await getDoc(userRef);
    const today = new Date().toISOString().split('T')[0];

    if (!userSnap.exists()) {
      // Rarísimo que llegue aquí sin un perfil en portal_clientes_users, pero por si acaso.
      const initialData = {
        wordlePlayed: 1,
        wordleWins: won ? 1 : 0,
        wordleCurrentStreak: won ? 1 : 0,
        wordleMaxStreak: won ? 1 : 0,
        wordleTotalAttempts: attemptsUsed,
        lastWordleDate: today,
        displayName: user.displayName || 'Anónimo',
        email: user.email
      };
      await setDoc(userRef, initialData, { merge: true });
      return { success: true, stats: initialData };
    }

    const userData = userSnap.data();
    
    // Evitar sumar dos veces el mismo día si hay recarga extraña
    if (userData.lastWordleDate === today) {
      return { success: true, stats: userData, alreadyPlayed: true };
    }

    // Calcular racha
    let newStreak = userData.wordleCurrentStreak || 0;
    
    // Validar si perdió un día
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    // Si la última vez que jugó NO fue ayer y NO fue hoy, la racha se rompió
    if (userData.lastWordleDate !== yesterdayStr && userData.lastWordleDate !== today) {
      newStreak = 0;
    }

    if (won) {
      newStreak += 1;
    } else {
      newStreak = 0;
    }

    const maxStreak = Math.max(newStreak, userData.wordleMaxStreak || 0);

    const newData = {
      wordlePlayed: (userData.wordlePlayed || 0) + 1,
      wordleWins: (userData.wordleWins || 0) + (won ? 1 : 0),
      wordleCurrentStreak: newStreak,
      wordleMaxStreak: maxStreak,
      wordleTotalAttempts: (userData.wordleTotalAttempts || 0) + attemptsUsed,
      lastWordleDate: today,
      // Campos para el ranking del día: intentos de HOY y si ganó hoy
      wordleTodayAttempts: attemptsUsed,
      wordleTodayWon: won
    };

    // Guardar en portal_clientes_users
    await setDoc(userRef, newData, { merge: true });

    // Guardar en la nueva colección wordle
    const wordleRecordRef = doc(db, WORDLE_COLLECTION, `${user.uid}_${today}`);
    const wordleRecordData = {
      userId: user.uid,
      displayName: user.displayName || 'Anónimo',
      date: today,
      word: word || '',
      length: length || 0,
      attempts: attemptsUsed,
      timeSeconds: timeSeconds || 0,
      won: won,
      currentStreak: newStreak
    };
    await setDoc(wordleRecordRef, wordleRecordData);

    return { success: true, stats: { ...userData, ...newData } };

  } catch (error) {
    console.error("Error saving wordle result:", error);
    return { error: error.message };
  }
};

/**
 * Obtener el ranking global Top 50 por racha máxima y luego por victorias totales.
 */
export const getWordleRanking = async () => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      orderBy('wordleMaxStreak', 'desc'),
      orderBy('wordleWins', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        displayName: data.displayName || data.nombres || 'Anónimo',
        maxStreak: data.wordleMaxStreak || 0,
        currentStreak: data.wordleCurrentStreak || 0,
        wins: data.wordleWins || 0,
        played: data.wordlePlayed || 0,
        totalAttempts: data.wordleTotalAttempts || 0,
        lastWordleDate: data.lastWordleDate || ''
      };
    });
  } catch (error) {
    console.error("Error fetching wordle ranking:", error);
    return [];
  }
};

/**
 * Obtener el ranking del día de hoy: SOLO los usuarios que GANARON hoy.
 * Ordenados por menor número de intentos usados.
 * Firestore no soporta este filtro compuesto directamente, se filtra en cliente.
 */
export const getWordleRankingToday = async () => {
  const today = new Date().toISOString().split('T')[0];
  try {
    // Buscar en la nueva colección 'wordle'
    // Como no podemos asegurar que hay índices complejos creados,
    // traemos los registros recientes o filtramos en memoria.
    const q = query(
      collection(db, WORDLE_COLLECTION)
    );
    const snapshot = await getDocs(q);

    const todayWinners = snapshot.docs
      .map(d => d.data())
      // Solo quienes jugaron HOY y además GANARON
      .filter(p => p.date === today && p.won === true)
      // El que lo resolvió en menos intentos va primero
      // En caso de empate, el que lo resolvió en menos tiempo
      .sort((a, b) => {
        if (a.attempts !== b.attempts) {
          return (a.attempts || 99) - (b.attempts || 99);
        }
        return (a.timeSeconds || 9999) - (b.timeSeconds || 9999);
      })
      .slice(0, 50);

    return todayWinners.map(w => ({
      id: w.userId,
      displayName: w.displayName,
      todayAttempts: w.attempts,
      timeSeconds: w.timeSeconds,
      currentStreak: w.currentStreak
    }));
  } catch (error) {
    console.error("Error fetching today's wordle ranking:", error);
    return [];
  }
};
