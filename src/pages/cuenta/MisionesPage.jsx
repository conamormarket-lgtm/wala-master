import React, { useState, useEffect, useCallback } from 'react';
import { ListChecks } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  dailyCheckIn,
  getDailyMissions,
  completeMission,
} from '../../services/loyalty';
import { tierForXp } from '../../constants/tiers';
import { trackMissionComplete } from '../../services/analytics/tracker';
import styles from './MisionesPage.module.css';
import { T } from '../../i18n/useTranslatedText';
import { volarMonedasGanadas } from '../../utils/animations';

// Fecha legible en español (ej. "16 de septiembre"). `missionsDate` llega
// como 'YYYY-MM-DD' del servidor (limaTodayStr); mismo patrón inline que ya
// usan CuentaFechasImportantesPage.jsx / CuentaCompraDetallePage.jsx — no hay
// un helper de fechas legibles compartido en el repo.
const fechaLegible = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
};

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
      // `err` puede ser un código técnico crudo (ej. "internal") si la función
      // no respondió, no solo el mensaje en español que arma el servidor. Se
      // deja en consola para depurar y se muestra un mensaje genérico.
      console.error('Error al cargar las misiones diarias:', err);
      setError('No pudimos cargar tus misiones. Intenta de nuevo en unos minutos.');
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
        // El check-in ocurre al entrar, sin botón: las monedas salen del centro.
        volarMonedasGanadas(null, Number(checkData.reward) || 0);
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
      console.error('Error al completar la misión:', err);
      setError('No pudimos completar la misión. Intenta de nuevo.');
      return;
    }
    if (data?.reward) {
      volarMonedasGanadas(null, Number(data.reward) || 0);
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
            <span className={styles.tierBadge}>
              {tier.current.icon} Nivel {tier.current.name}
            </span>
            <span className={styles.tierXp}>{xp} XP acumulada</span>
          </div>
          {!tier.isMax ? (
            <span className={styles.tierNext}>
              Faltan {tier.xpRemaining} XP para {tier.next.name}
            </span>
          ) : (
            <span className={styles.tierNext}><T>¡Nivel máximo alcanzado!</T></span>
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
            <div className={styles.streakCount}>{streakCount} días seguidos</div>
            <div className={styles.streakLabel}>
              Racha diaria · entras a la app día tras día
            </div>
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

      {/* Lista de misiones. Si hay un error no se muestra el vacío debajo: son
          dos explicaciones distintas de "no veo misiones" y mostrarlas juntas
          confunde más de lo que aclara. */}
      {loading ? (
        <div className={styles.loading}><T>Cargando misiones…</T></div>
      ) : error ? null : missions.length === 0 ? (
        <div className={styles.empty}>
          <ListChecks size={32} aria-hidden="true" className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Todavía no hay misiones activas.</p>
          <p className={styles.emptyText}>Vuelve pronto — se agregan seguido.</p>
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
        <p className={styles.dateNote}>Misiones del {fechaLegible(missionsDate)}</p>
      )}
    </div>
  );
};

export default MisionesPage;
