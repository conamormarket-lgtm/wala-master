import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  dailyCheckIn,
  getDailyMissions,
  completeMission,
} from '../../services/loyalty';
import { tierForXp } from '../../constants/tiers';
import { trackMissionComplete } from '../../services/analytics/tracker';
import styles from './MisionesPage.module.css';

const MisionesPage = () => {
  const { user, userProfile, reloadProfile } = useAuth();
  const [missions, setMissions] = useState([]);
  const [missionsDate, setMissionsDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkInInfo, setCheckInInfo] = useState(null); // { streak, reward }
  const [completingId, setCompletingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Refresca el perfil server-side si el hook está disponible.
  const refreshProfile = useCallback(async () => {
    if (typeof reloadProfile === 'function') {
      await reloadProfile();
    }
  }, [reloadProfile]);

  // Carga las misiones de hoy.
  const loadMissions = useCallback(async () => {
    const { error: err, data } = await getDailyMissions();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setMissions(data?.items || []);
    setMissionsDate(data?.date || null);
  }, []);

  // Al montar: check-in diario (idempotente) + carga de misiones.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { error: checkErr, data: checkData } = await dailyCheckIn();
      if (active && !checkErr && checkData) {
        setCheckInInfo(checkData);
      }
      await loadMissions();
      await refreshProfile();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadMissions, refreshProfile]);

  const handleComplete = async (missionId) => {
    setCompletingId(missionId);
    setMessage('');
    setError('');
    const { error: err, data } = await completeMission(missionId);
    setCompletingId(null);

    if (err) {
      setError(err);
      return;
    }
    if (data?.reward) {
      setMessage(`¡Misión completada! +${data.reward} monedas.`);
    } else {
      setMessage('¡Misión completada!');
    }
    // Analytics aditivo (fire-and-forget): registra el éxito de completar la misión.
    // Usa el id/nombre/recompensa reales de la misión en scope; tolera undefined.
    try {
      const completed = missions.find((mm) => mm.missionId === missionId);
      trackMissionComplete(
        {
          missionId,
          missionName: completed?.title,
          coins: data?.reward ?? completed?.rewardPoints,
        },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }
      ).catch(() => {});
    } catch {}
    // Refresca lista de misiones y saldos del perfil.
    await loadMissions();
    await refreshProfile();
  };

  const monedas = userProfile?.monedas ?? 0;
  const xp = userProfile?.xp ?? 0;
  const streakCount =
    checkInInfo?.streak ?? userProfile?.dailyStreak?.count ?? 0;
  const checkInReward = checkInInfo?.reward ?? 0;

  // Nivel/tier derivado de la XP acumulada (solo presentación).
  const tier = tierForXp(xp);
  const progressPct = Math.round(tier.progress * 100);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Misiones diarias</h2>
      <p className={styles.subtitle}>
        Completa tus misiones cada día y mantén tu racha para ganar monedas y
        experiencia.
      </p>

      {/* Resumen de saldos */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Monedas</span>
          <span className={styles.statValue}>🪙 {monedas}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Experiencia</span>
          <span className={styles.statValue}>⭐ {xp} XP</span>
        </div>
      </div>

      {/* Nivel / tier por XP */}
      <div className={styles.tierCard}>
        <div className={styles.tierHeader}>
          <div className={styles.tierInfo}>
            <span className={styles.tierBadge}>Nivel {tier.current.name}</span>
            <span className={styles.tierXp}>{xp} XP acumulada</span>
          </div>
          {!tier.isMax ? (
            <span className={styles.tierNext}>
              Faltan {tier.xpRemaining} XP para {tier.next.name}
            </span>
          ) : (
            <span className={styles.tierNext}>¡Nivel máximo alcanzado!</span>
          )}
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tarjeta de racha / check-in */}
      <div className={styles.streakCard}>
        <div className={styles.streakInfo}>
          <span className={styles.streakIcon}>🔥</span>
          <div>
            <div className={styles.streakCount}>{streakCount} días</div>
            <div className={styles.streakLabel}>Racha diaria</div>
          </div>
        </div>
        <div className={styles.streakStatus}>
          {checkInInfo ? (
            <span className={styles.checkedIn}>
              ✓ Check-in de hoy registrado
              {checkInReward > 0 ? ` (+${checkInReward} monedas)` : ''}
            </span>
          ) : (
            <span className={styles.checkPending}>
              Abre la app cada día para no perder tu racha.
            </span>
          )}
        </div>
      </div>

      {/* Mensajes */}
      {message && <div className={styles.messageBox}>{message}</div>}
      {error && <div className={styles.errorBox}>{error}</div>}

      {/* Lista de misiones */}
      {loading ? (
        <div className={styles.loading}>Cargando misiones…</div>
      ) : missions.length === 0 ? (
        <div className={styles.empty}>
          No hay misiones disponibles hoy. ¡Vuelve mañana!
        </div>
      ) : (
        <ul className={styles.missionList}>
          {missions.map((m) => (
            <li
              key={m.missionId}
              className={`${styles.missionItem} ${
                m.completed ? styles.missionDone : ''
              }`}
            >
              <div className={styles.missionMain}>
                <h3 className={styles.missionTitle}>{m.title}</h3>
                {m.description && (
                  <p className={styles.missionDesc}>{m.description}</p>
                )}
              </div>
              <div className={styles.missionAside}>
                <span className={styles.rewardBadge}>🪙 {m.rewardPoints}</span>
                {m.completed ? (
                  <span className={styles.doneBadge}>✓ Completada</span>
                ) : (
                  <button
                    type="button"
                    className={styles.completeBtn}
                    disabled={completingId === m.missionId}
                    onClick={() => handleComplete(m.missionId)}
                  >
                    {completingId === m.missionId ? 'Completando…' : 'Completar'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {missionsDate && (
        <p className={styles.dateNote}>Misiones del {missionsDate}</p>
      )}
    </div>
  );
};

export default MisionesPage;
