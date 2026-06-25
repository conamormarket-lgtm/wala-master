import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getActiveFlashOffers } from '../services/flashOffers';
import { openDailyChest } from '../services/chest';
import { Gift, Zap, Loader2 } from 'lucide-react';
import Button from '../components/common/Button';
import styles from './OfertasFlashPage.module.css';

const OfertasFlashPage = () => {
  const { isAuthenticated, reloadProfile } = useAuth();

  const [chestLoading, setChestLoading] = useState(false);
  const [chestResult, setChestResult] = useState(null); // { reward, monedas }
  const [chestAlready, setChestAlready] = useState(false);
  const [chestError, setChestError] = useState('');

  const { data: offersData, isLoading, error } = useQuery({
    queryKey: ['flash-offers'],
    queryFn: async () => {
      const { data, error: err } = await getActiveFlashOffers();
      if (err) throw new Error(err);
      return data;
    },
  });

  const offers = offersData ?? [];

  const refreshProfile = useCallback(async () => {
    if (typeof reloadProfile === 'function') await reloadProfile();
  }, [reloadProfile]);

  const handleOpenChest = async () => {
    setChestLoading(true);
    setChestError('');
    setChestResult(null);
    setChestAlready(false);

    const { error: err, data } = await openDailyChest();
    setChestLoading(false);

    if (err) {
      setChestError(err);
      return;
    }
    if (data?.alreadyOpened) {
      setChestAlready(true);
      return;
    }
    setChestResult(data);
    await refreshProfile();
  };

  // Limpia mensajes del cofre si el usuario cierra sesión.
  useEffect(() => {
    if (!isAuthenticated) {
      setChestResult(null);
      setChestAlready(false);
      setChestError('');
    }
  }, [isAuthenticated]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>
          <Zap size={28} /> Ofertas Flash
        </h1>
        <p className={styles.subtitle}>
          Promociones por tiempo limitado. ¡Aprovecha antes de que terminen!
        </p>
      </header>

      {/* Cofre diario */}
      <section className={styles.chestCard}>
        <div className={styles.chestInfo}>
          <span className={styles.chestIcon}>
            <Gift size={32} />
          </span>
          <div>
            <h2 className={styles.chestTitle}>Cofre diario</h2>
            <p className={styles.chestText}>
              Ábrelo una vez al día y gana monedas sorpresa.
            </p>
          </div>
        </div>

        <div className={styles.chestAction}>
          {isAuthenticated ? (
            <Button type="button" onClick={handleOpenChest} disabled={chestLoading}>
              {chestLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Abriendo…
                </>
              ) : (
                <>
                  <Gift size={16} /> Abrir cofre diario
                </>
              )}
            </Button>
          ) : (
            <Link to="/login" className={styles.loginLink}>
              Inicia sesión para abrir el cofre
            </Link>
          )}
        </div>
      </section>

      {/* Feedback del cofre */}
      {chestResult && (
        <div className={styles.rewardBox}>
          🎉 ¡Ganaste <strong>{chestResult.reward}</strong> monedas! Tu saldo: {chestResult.monedas}
        </div>
      )}
      {chestAlready && (
        <div className={styles.infoBox}>
          Ya abriste tu cofre hoy. ¡Vuelve mañana!
        </div>
      )}
      {chestError && <div className={styles.errorBox}>{chestError}</div>}

      {/* Lista de ofertas */}
      <section className={styles.offersSection}>
        {isLoading ? (
          <div className={styles.loading}>Cargando ofertas…</div>
        ) : error ? (
          <div className={styles.errorBox}>{error.message}</div>
        ) : offers.length === 0 ? (
          <div className={styles.empty}>
            No hay ofertas flash activas en este momento. ¡Vuelve pronto!
          </div>
        ) : (
          <div className={styles.offersGrid}>
            {offers.map((offer) => (
              <article key={offer.id} className={styles.offerCard}>
                <div className={styles.discountPill}>-{offer.discountPct ?? 0}%</div>
                <h3 className={styles.offerName}>{offer.title}</h3>
                {(offer.startsAt || offer.endsAt) && (
                  <p className={styles.offerDates}>
                    {offer.startsAt ? `Desde ${offer.startsAt}` : ''}
                    {offer.startsAt && offer.endsAt ? ' · ' : ''}
                    {offer.endsAt ? `Hasta ${offer.endsAt}` : ''}
                  </p>
                )}
                {offer.productId && (
                  <Link to={`/producto/${offer.productId}`} className={styles.offerLink}>
                    Ver producto
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default OfertasFlashPage;
