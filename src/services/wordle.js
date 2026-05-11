import { collection, doc, getDoc, setDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase/config';
import { getCurrentUser } from './firebase/auth';

const DAILY_WORDS_COLLECTION = 'wordle_daily_words';
const USERS_COLLECTION = 'portal_clientes_users';

// Lista de respaldo (fallback) de 100 palabras de 5 a 8 letras (sin tildes, en mayúsculas)
const FALLBACK_WORDS = [
  "MUNDO", "TIEMPO", "CORAZON", "ARBOL", "PERRO", "GATO", "CAMINO", "FUEGO", "AGUA", "TIERRA",
  "VIENTO", "CIELO", "MAR", "SOL", "LUNA", "ESTRELLA", "MONTAÑA", "RIO", "FLOR", "BOSQUE",
  "VIDA", "AMOR", "PAZ", "LUZ", "SOMBRA", "SUEÑO", "ESPERA", "VERDAD", "RAZON", "MENTE",
  "ALMA", "CUERPO", "MANO", "PIE", "CABEZA", "OJOS", "BOCA", "NARIZ", "OREJA", "PIEL",
  "SANGRE", "HUESO", "DOLOR", "SALUD", "ENFERMO", "MEDICO", "HOSPITAL", "MEDICINA", "CURA", "SANO",
  "CASA", "HOGAR", "FAMILIA", "PADRE", "MADRE", "HIJO", "HERMANO", "AMIGO", "ENEMIGO", "VECINO",
  "PUEBLO", "CIUDAD", "CALLE", "PLAZA", "PUENTE", "PUERTA", "VENTANA", "PARED", "TECHO", "SUELO",
  "MESA", "SILLA", "CAMA", "PLATO", "VASO", "AGUA", "COMIDA", "PAN", "CARNE", "FRUTA",
  "ROPA", "ZAPATO", "ABRIGO", "CAMISA", "PANTALON", "SOMBRERO", "GUANTE", "RELOJ", "ANILLO", "COLLAR",
  "DINERO", "PRECIO", "TRABAJO", "EMPLEO", "OFICIO", "NEGOCIO", "MERCADO", "TIENDA", "COMPRA", "VENTA"
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
export const saveWordleResult = async (won, attemptsUsed) => {
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
      lastWordleDate: today
    };

    await setDoc(userRef, newData, { merge: true });
    return { success: true, stats: { ...userData, ...newData } };

  } catch (error) {
    console.error("Error saving wordle result:", error);
    return { error: error.message };
  }
};

/**
 * Obtener el ranking Top 50 por racha máxima y luego por victorias.
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
        wins: data.wordleWins || 0,
        played: data.wordlePlayed || 0
      };
    });
  } catch (error) {
    console.error("Error fetching wordle ranking:", error);
    return [];
  }
};
