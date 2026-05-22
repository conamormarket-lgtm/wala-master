import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTopReferrersOfMonth } from '../../services/referrals';
import styles from './ReferralRanking.module.css';

const ReferralRanking = () => {
  const { data: top10, isLoading } = useQuery({
    queryKey: ['topReferrersThisMonth'],
    queryFn: async () => {
      const res = await getTopReferrersOfMonth();
      if (res.error) throw new Error(res.error);
      return res.data;
    }
  });

  if (isLoading) {
    return <div className={styles.loading}>Cargando ranking de regaleros...</div>;
  }

  if (!top10 || top10.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>🏆 Top Regaleros del Mes</h3>
        <p className={styles.empty}>Aún no hay compras de referidos este mes. ¡Sé el primero!</p>
      </div>
    );
  }

  const top1 = top10[0];

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>🏆 Top Regaleros del Mes</h3>
      <p className={styles.subtitle}>Los usuarios con más referidos que completaron compras este mes.</p>
      
      {top1 && (
        <div className={styles.top1Banner}>
          <div className={styles.prizeIcon}>🎁</div>
          <div className={styles.prizeInfo}>
            <h4>Premio al 1er Lugar: ¡Wala Box Gratis!</h4>
            <p><strong>{top1.referrerCode}</strong> está liderando con {top1.count} referidos completados este mes.</p>
            <span className={styles.prizeDisclaimer}>El premio se asignará manualmente por el administrador al finalizar el mes.</span>
          </div>
        </div>
      )}

      <div className={styles.rankingList}>
        {top10.map((user, index) => (
          <div key={user.referrerCode} className={`${styles.rankingItem} ${index === 0 ? styles.firstPlace : ''} ${index === 1 ? styles.secondPlace : ''} ${index === 2 ? styles.thirdPlace : ''}`}>
            <div className={styles.rankPosition}>
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
            </div>
            <div className={styles.rankCode}>
              {/* Mask the code slightly for privacy if it's a real name, but typically it's KS-XXX */}
              {user.referrerCode}
            </div>
            <div className={styles.rankStats}>
              <span className={styles.statPill}>{user.count} Compras</span>
              <span className={styles.statCoins}>🪙 {user.coins} Ganadas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReferralRanking;
