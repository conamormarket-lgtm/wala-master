import { collection, doc, getDoc, setDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase/config';
import { getCurrentUser } from './firebase/auth';
import { DAILY_WORDS } from '../data/wordleDictionary';
import { limaTodayStr, limaYesterdayStr } from '../utils/fechaLima';

const DAILY_WORDS_COLLECTION = 'wordle_daily_words';
const USERS_COLLECTION = 'portal_clientes_users';
const WORDLE_COLLECTION = 'wordle';

// Id del documento de estadísticas acumuladas dentro de la colección pública
// `wordle`. Va en la misma colección (y no en portal_clientes_users) porque el
// perfil de usuario solo lo puede leer su dueño: el ranking global necesita
// datos públicos. Los documentos de partida diaria no llevan `maxStreak`, así
// que un orderBy('maxStreak') devuelve únicamente estos docs de estadísticas.
const statsDocId = (uid) => `${uid}_stats`;

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

// Publica las estadísticas acumuladas del jugador para el ranking global.
// Es best-effort: si falla, la partida ya quedó guardada igual.
const publishWordleStats = async (user, stats) => {
  try {
    await setDoc(doc(db, WORDLE_COLLECTION, statsDocId(user.uid)), {
      userId: user.uid,
      displayName: user.displayName || stats.displayName || 'Anónimo',
      maxStreak: stats.wordleMaxStreak || 0,
      currentStreak: stats.wordleCurrentStreak || 0,
      wins: stats.wordleWins || 0,
      played: stats.wordlePlayed || 0,
      totalAttempts: stats.wordleTotalAttempts || 0,
      lastPlayed: stats.lastWordleDate || null
    }, { merge: true });
  } catch (error) {
    console.error("Error publishing wordle stats:", error);
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
    // Día en hora de Lima, igual que el resto de la app: antes esto era UTC y a
    // partir de las 19:00 la partida se guardaba con la fecha de mañana, lo que
    // hacía que la partida del día siguiente se descartara por "ya jugada".
    const today = limaTodayStr();

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
      await publishWordleStats(user, initialData);
      return { success: true, stats: initialData };
    }

    const userData = userSnap.data();
    
    // Evitar sumar dos veces el mismo día si hay recarga extraña
    if (userData.lastWordleDate === today) {
      return { success: true, stats: userData, alreadyPlayed: true };
    }

    // Calcular racha
    let newStreak = userData.wordleCurrentStreak || 0;
    
    // Validar si perdió un día (ayer en hora de Lima, coherente con `today`)
    const yesterdayStr = limaYesterdayStr();

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

    // Publicar estadísticas acumuladas para el ranking global (colección pública).
    await publishWordleStats(user, { ...userData, ...newData });

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
    // Antes esto consultaba portal_clientes_users, pero las reglas solo permiten
    // que cada usuario lea su propio perfil: la consulta siempre fallaba con
    // permission-denied y el ranking global salía vacío. Ahora se lee de la
    // colección pública `wordle` (docs `<uid>_stats`). Un solo orderBy usa el
    // índice automático de campo simple: no hace falta índice compuesto, y los
    // documentos de partida diaria quedan fuera porque no tienen `maxStreak`.
    const q = query(
      collection(db, WORDLE_COLLECTION),
      orderBy('maxStreak', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => {
        const data = d.data();
        return {
          id: data.userId || d.id,
          displayName: data.displayName || 'Anónimo',
          maxStreak: data.maxStreak || 0,
          currentStreak: data.currentStreak || 0,
          wins: data.wins || 0,
          played: data.played || 0,
          totalAttempts: data.totalAttempts || 0,
          lastWordleDate: data.lastPlayed || ''
        };
      })
      // Desempate por victorias totales (el orderBy compuesto exigiría índice).
      .sort((a, b) => (b.maxStreak - a.maxStreak) || (b.wins - a.wins));
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
  const today = limaTodayStr();
  try {
    // Filtramos por fecha en el servidor (igualdad de un solo campo: usa el
    // índice automático, sin índice compuesto). Antes se descargaba la colección
    // entera y se filtraba en memoria, lo que crecía sin límite con el tiempo.
    const q = query(
      collection(db, WORDLE_COLLECTION),
      where('date', '==', today)
    );
    const snapshot = await getDocs(q);

    const todayWinners = snapshot.docs
      .map(d => d.data())
      // Solo quienes GANARON hoy
      .filter(p => p.won === true)
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
