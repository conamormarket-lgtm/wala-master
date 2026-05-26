import { db } from './config';
import { doc, runTransaction } from 'firebase/firestore';
import { PORTAL_USERS_COLLECTION } from '../../constants/userCollections';

export const REWARD_AMOUNT = 2; // 2 monedas por ganar

// Obtener fecha actual en formato YYYY-MM-DD
const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

export const claimBallSortReward = async (userId, userProfile) => {
  if (!userId || !userProfile) {
    return { success: false, error: 'Usuario no autenticado' };
  }

  const todayStr = getTodayString();
  if (userProfile.lastBallSortReward === todayStr) {
    return { success: false, error: 'Ya reclamaste tu recompensa de este juego hoy' };
  }

  try {
    const userRef = doc(db, PORTAL_USERS_COLLECTION, userId);
    
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error('User does not exist');
      const data = userDoc.data();
      
      // Doble verificación en la transacción por si hubo un claim simultáneo
      if (data.lastBallSortReward === todayStr) {
        throw new Error('Ya reclamaste tu recompensa de este juego hoy');
      }

      transaction.update(userRef, {
        monedas: (data.monedas || 0) + REWARD_AMOUNT,
        lastBallSortReward: todayStr,
        updatedAt: new Date()
      });
    });

    return { success: true, reward: REWARD_AMOUNT };
  } catch (error) {
    console.error('Error claiming Ball Sort reward:', error);
    return { success: false, error: error.message };
  }
};
