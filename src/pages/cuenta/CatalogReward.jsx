import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Gift } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCollection } from '../../services/firebase/firestore';
import { textoPremio } from '../../utils/ruletaModel';
import styles from './CatalogReward.module.css';
import { T } from '../../i18n/useTranslatedText';

// Texto de lo que gana el cliente, calculado igual que en la Ruleta
// (ver AdminRecompensas.jsx: mismo helper, mismo criterio) para que el
// catálogo muestre el beneficio real en vez del texto libre `value`.
const beneficioDe = (reward) => {
  if (!reward || !reward.tipo || reward.tipo === 'manual') return '';
  return textoPremio({
    tipo: reward.tipo,
    nombre: reward.title,
    descuentoPct: Number(reward.descuentoPct) || 0,
    descuentoMonto: Number(reward.descuentoMonto) || 0,
    topeDescuento: Number(reward.topeDescuento) || 0,
    productName: reward.productName,
    monedas: 0,
  });
};

const CatalogReward = () => {
  const { userProfile, activeMainCoins, reloadProfile } = useAuth();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [message, setMessage] = useState('');
  const [showCuponesLink, setShowCuponesLink] = useState(false);

  // Carga el catálogo público de recompensas activas, ordenadas por `order`.
  const loadRewards = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await getCollection(
      'rewardsCatalog',
      [{ field: 'active', operator: '==', value: true }],
      { field: 'order', direction: 'asc' }
    );
    if (err) {
      // `err` es el mensaje crudo de Firestore (ej. "The query requires an
      // index. You can create it here: https://..."): un detalle técnico
      // para quien despliega la app, no algo que un cliente deba leer. Se
      // deja en consola para depurar y se muestra un mensaje genérico.
      console.error('Error al cargar el catálogo de recompensas:', err);
      setError('No pudimos cargar el catálogo. Intenta de nuevo en unos minutos.');
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
    setConfirmingId(null);
    setClaimingId(reward.id);
    setMessage('');
    setShowCuponesLink(false);
    setError('');

    try {
      const redeem = httpsCallable(getFunctions(), 'redeemRewardSecure');
      const res = await redeem({ rewardId: reward.id });
      const coupon = res?.data?.coupon;
      if (coupon?.code) {
        setMessage(
          `¡Has canjeado "${reward.title}"! Tu código de cupón es ${coupon.code}.`
        );
      } else {
        setMessage(`¡Has canjeado "${reward.title}" con éxito!`);
      }
      setShowCuponesLink(true);
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
      <h2 className={styles.title}><T>Catálogo de Recompensas</T></h2>
      <p className={styles.subtitle}>
        Canjea tus monedas por beneficios exclusivos.
      </p>

      {message && (
        <div className={styles.messageBox}>
          <span>{message}</span>
          {showCuponesLink && (
            <Link to="/cuenta/cupones" className={styles.messageLink}>
              Ver mis cupones →
            </Link>
          )}
        </div>
      )}
      {error && <div className={styles.errorBox}>{error}</div>}

      {loading ? (
        <div className={styles.stateBox}><T>Cargando recompensas…</T></div>
      ) : rewards.length === 0 ? (
        <div className={styles.stateBox}>
          No hay recompensas disponibles por ahora. ¡Vuelve pronto!
        </div>
      ) : (
        <div className={styles.grid}>
          {rewards.map((reward) => {
            const canAfford = activeMainCoins >= reward.cost;
            const beneficio = beneficioDe(reward);
            const isConfirming = confirmingId === reward.id;
            return (
              <div
                key={reward.id}
                className={`${styles.card} ${canAfford ? '' : styles.disabled}`}
              >
                <div className={styles.rewardImageWrap}>
                  {reward.imageUrl ? (
                    <img src={reward.imageUrl} alt={reward.title} className={styles.rewardImg} />
                  ) : (
                    <div className={styles.rewardImgFallback}>
                      <Gift size={28} aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className={styles.cardHeader}>
                  <h3 className={styles.rewardTitle}>{reward.title}</h3>
                  {beneficio ? (
                    <span className={styles.rewardValue}>{beneficio}</span>
                  ) : reward.value && (
                    <span className={styles.rewardValue}>{reward.value}</span>
                  )}
                </div>
                {reward.description && (
                  <p className={styles.rewardDesc}>{reward.description}</p>
                )}

                <div className={styles.cardFooter}>
                  <div className={styles.costBadge}>
                    <span className={styles.costLabel}>Cuesta</span>
                    <span className={styles.costAmount}>🪙 {reward.cost}</span>
                  </div>
                  {isConfirming ? (
                    <div className={styles.confirmRow}>
                      <button
                        type="button"
                        className={styles.confirmCancelBtn}
                        onClick={() => setConfirmingId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className={styles.claimBtn}
                        disabled={claimingId === reward.id}
                        onClick={() => handleClaim(reward)}
                      >
                        {claimingId === reward.id ? 'Canjeando…' : 'Sí, canjear'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.claimBtn}
                      disabled={!canAfford}
                      onClick={() => setConfirmingId(reward.id)}
                    >
                      {canAfford
                        ? 'Canjear'
                        : `Faltan ${reward.cost - activeMainCoins} 🪙`}
                    </button>
                  )}
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
