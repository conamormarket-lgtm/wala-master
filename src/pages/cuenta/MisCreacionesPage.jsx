import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDesignsByUser } from '../../services/designs';
import MiCreacionCard from './components/MiCreacionCard';
import styles from './MisCreacionesPage.module.css';

const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  try {
    const date = typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : timestamp.seconds
        ? new Date(timestamp.seconds * 1000)
        : null;
    if (!date || isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const MisCreacionesPage = () => {
  const { user } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await getDesignsByUser(user.uid);
      if (!cancelled) {
        setDesigns(Array.isArray(data) ? data : []);
        setError(err || null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  if (!user) return null;
  if (loading) {
    return (
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Mis Creaciones</h2>
        <ul className={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i} className={`${styles.cardItem} ${styles.skeletonCard}`}>
              <div className={styles.skeletonThumb} />
              <div className={styles.cardBody}>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonDate} />
                <div className={styles.skeletonLink} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (error) {
    return (
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Mis Creaciones</h2>
        <div className={styles.card}>
          <p className={styles.error}>Error al cargar: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>Mis Creaciones</h2>
      {designs.length === 0 ? (
        <div className={styles.card}>
          <p>Aún no tienes diseños guardados. Crea uno en el editor y guárdalo para verlo aquí.</p>
          <Link to="/personalizar" className={styles.link}>
            Ir a personalizar
          </Link>
        </div>
      ) : (
        <ul className={styles.grid}>
          {designs.map((d) => (
            <MiCreacionCard key={d.id} design={d} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default MisCreacionesPage;
