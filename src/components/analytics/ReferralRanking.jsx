import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { getTopReferrersOfMonth } from '../../services/referrals';
import { GlassCard } from '../ui';
import styles from './ReferralRanking.module.css';
import { T } from '../../i18n/useTranslatedText';
import Moneda from '../common/Moneda';

// Cabecera compartida por los tres estados (cargando / vacío / con datos):
// misma insignia + título que el resto de las tarjetas de /cuenta.
const Cabecera = () => (
  <div className={styles.cardHeader}>
    <div className={styles.headerIcon}>
      <Trophy size={20} aria-hidden="true" />
    </div>
    <div>
      <h3 className={styles.title}><T>Top Regaleros del Mes</T></h3>
      <p className={styles.subtitle}>
        <T>Quiénes tuvieron más referidos que completaron su compra este mes.</T>
      </p>
    </div>
  </div>
);

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
    return (
      <GlassCard variant="solid" padding="lg" animate={false} className={styles.container}>
        <Cabecera />
        <div className={styles.skeletonList} aria-hidden="true">
          {[1, 2, 3].map((n) => <div key={n} className={styles.skeletonRow} />)}
        </div>
      </GlassCard>
    );
  }

  if (!top10 || top10.length === 0) {
    return (
      <GlassCard variant="solid" padding="lg" animate={false} className={styles.container}>
        <Cabecera />
        <p className={styles.empty}>
          <T>Aún no hay compras de referidos este mes. ¡Sé el primero!</T>
        </p>
      </GlassCard>
    );
  }

  // Solo el top: sin premio para el primer lugar (decisión del 2026-10-13).
  return (
    <GlassCard variant="solid" padding="lg" animate={false} className={styles.container}>
      <Cabecera />

      <ol className={styles.rankingList}>
        {top10.map((user, index) => (
          <li
            key={user.referrerCode}
            className={`${styles.rankingItem} ${index === 0 ? styles.firstPlace : ''} ${index === 1 ? styles.secondPlace : ''} ${index === 2 ? styles.thirdPlace : ''}`}
          >
            <span className={styles.rankPosition} aria-hidden="true">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
            </span>
            <span className={styles.rankCode}>{user.referrerCode}</span>
            <span className={styles.rankStats}>
              <span className={styles.statPill}>
                {user.count} {user.count === 1 ? 'compra' : 'compras'}
              </span>
              <span className={styles.statCoins}><Moneda />{user.coins}</span>
            </span>
          </li>
        ))}
      </ol>
    </GlassCard>
  );
};

export default ReferralRanking;
