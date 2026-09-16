import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Gift } from 'lucide-react';
import { getTopReferrersOfMonth } from '../../services/referrals';
import { GlassCard } from '../ui';
import styles from './ReferralRanking.module.css';
import { T } from '../../i18n/useTranslatedText';

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

  const top1 = top10[0];

  return (
    <GlassCard variant="solid" padding="lg" animate={false} className={styles.container}>
      <Cabecera />

      {top1 && (
        <div className={styles.top1Banner}>
          <div className={styles.prizeIcon}>
            <Gift size={22} aria-hidden="true" />
          </div>
          <div className={styles.prizeInfo}>
            <h4><T>Premio al 1er lugar: ¡Wala Box gratis!</T></h4>
            <p>
              <strong>{top1.referrerCode}</strong> lidera con {top1.count}{' '}
              {top1.count === 1 ? 'referido completado' : 'referidos completados'} este mes.
            </p>
            <span className={styles.prizeDisclaimer}>
              <T>El premio lo asigna el administrador al cerrar el mes.</T>
            </span>
          </div>
        </div>
      )}

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
              <span className={styles.statCoins}>🪙 {user.coins}</span>
            </span>
          </li>
        ))}
      </ol>
    </GlassCard>
  );
};

export default ReferralRanking;
