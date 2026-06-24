import { getFunctions, httpsCallable } from 'firebase/functions';

export const REWARD_AMOUNT = 2; // 2 monedas por ganar (referencia de UI)

/**
 * Reclama la recompensa diaria de Ball Sort.
 * H-06: la acreditación se hace server-side (callable claimBallSortRewardSecure),
 * que valida "una vez por día" y acredita en transacción. La firma se mantiene
 * (userId, userProfile) por compatibilidad, pero el servidor usa el uid del token.
 */
export const claimBallSortReward = async () => {
  try {
    const res = await httpsCallable(getFunctions(), 'claimBallSortRewardSecure')();
    return { success: true, reward: res.data?.reward ?? REWARD_AMOUNT };
  } catch (error) {
    return { success: false, error: error?.message || 'Error al reclamar la recompensa' };
  }
};
