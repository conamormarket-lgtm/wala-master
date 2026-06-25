import React, { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { getCollection } from '../../services/firebase/firestore';
import styles from './CatalogReward.module.css';

const CatalogReward = () => {
  const { userProfile, activeMainCoins, reloadProfile } = useAuth();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const [message, setMessage] = useState('');

  // Carga el catálogo público de recompensas activas, ordenadas por `order`.
  const loadRewards = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await getCollection(
      'rewardsCatalog',
      [{ field: 'active', operator: '==', value: true }],
      { field: 'order', direction: 'asc' }
    );
    if (err) {
      setError(err);
      setRewards([]);
    } else {
      setError('');
      setRewards(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  if (!userProfile) return null;

  const handleClaim = async (reward) => {
    if (activeMainCoins < reward.cost) return;
    setClaimingId(reward.id);
    setMessage('');
    setError('');

    try {
      const redeem = httpsCallable(getFunctions(), 'redeemRewardSecure');
      const res = await redeem({ rewardId: reward.id });
      const coupon = res?.data?.coupon;
      if (coupon?.code) {
        setMessage(
          `¡Has canjeado "${reward.title}"! Tu código de cupón es ${coupon.code}. Lo encontrarás en tus cupones.`
        );
      } else {
        setMessage(`¡Has canjeado "${reward.title}" con éxito!`);
      }
      // Refresca saldo/perfil server-side.
      if (typeof reloadProfile === 'function') await reloadProfile();
    } catch (e) {
      setError(e?.message || 'No se pudo canjear la recompensa.');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Catálogo de Recompensas</h2>
      <p className={styles.subtitle}>
        Canjea tus monedas por beneficios exclusivos.
      </p>

      {message && <div className={styles.messageBox}>{message}</div>}
      {error && <div className={styles.errorBox}>{error}</div>}

      {loading ? (
        <div className={styles.stateBox}>Cargando recompensas…</div>
      ) : rewards.length === 0 ? (
        <div className={styles.stateBox}>
          No hay recompensas disponibles por ahora. ¡Vuelve pronto!
        </div>
      ) : (
        <div className={styles.grid}>
          {rewards.map((reward) => {
            const canAfford = activeMainCoins >= reward.cost;
            return (
              <div
                key={reward.id}
                className={`${styles.card} ${canAfford ? '' : styles.disabled}`}
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.rewardTitle}>{reward.title}</h3>
                  {reward.value && (
                    <span className={styles.rewardValue}>
                      Valor ref: {reward.value}
                    </span>
                  )}
                </div>
                {reward.description && (
                  <p className={styles.rewardDesc}>{reward.description}</p>
                )}

                <div className={styles.cardFooter}>
                  <div className={styles.costBadge}>🪙 {reward.cost}</div>
                  <button
                    type="button"
                    className={styles.claimBtn}
                    disabled={!canAfford || claimingId === reward.id}
                    onClick={() => handleClaim(reward)}
                  >
                    {claimingId === reward.id
                      ? 'Canjeando…'
                      : canAfford
                      ? 'Canjear'
                      : 'Faltan monedas'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CatalogReward;
