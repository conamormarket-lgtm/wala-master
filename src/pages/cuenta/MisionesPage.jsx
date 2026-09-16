import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Coins,
  Sparkles,
  Flame,
  ListChecks,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  dailyCheckIn,
  getDailyMissions,
  completeMission,
} from '../../services/loyalty';
import { TIERS, tierForXp } from '../../constants/tiers';
import { MISSION_ACTIONS } from '../../constants/missionActions';
import { trackMissionComplete } from '../../services/analytics/tracker';
import { GlassCard, Badge, Reveal, Stagger, StaggerItem } from '../../components/ui';
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

  // Avance del día: cuántas de las misiones de hoy ya están completadas.
  const totalMisiones = missions.length;
  const hechas = missions.filter((m) => m.completed).length;
  const todasHechas = totalMisiones > 0 && hechas === totalMisiones;

  return (
    <div className={styles.page}>
      {/* ── Cabecera: misma insignia + título que Mi Perfil / Rastreo ───── */}
      <Reveal>
        <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.headerIcon}>
              <Trophy size={20} aria-hidden="true" />
            </div>
            <h2>Misiones diarias</h2>
          </div>
          <p className={styles.headerSub}>
            Completa tus misiones cada día y mantén tu racha para ganar monedas y
            experiencia.
          </p>
        </GlassCard>
      </Reveal>

      {/* ── Resumen: monedas / experiencia / racha ───────────────────────
          Antes eran dos cuadros grises (monedas y XP) y, aparte, una tarjeta
          ámbar entera para la racha. Son tres lecturas del mismo marcador, así
          que ahora van en una sola fila con el mismo molde: insignia de color +
          etiqueta + número grande + una línea de contexto. */}
      <Stagger className={styles.statsGrid}>
        <StaggerItem>
          <GlassCard variant="solid" padding="md" animate={false} className={styles.statCard} bodyClassName={styles.statBody}>
            <div className={`${styles.statIcon} ${styles.statIconGold}`}>
              <Coins size={18} aria-hidden="true" />
            </div>
            <span className={styles.statLabel}>Monedas</span>
            <span className={styles.statValue}>{monedas}</span>
            <Link to="/cuenta/catalogo" className={styles.statLink}>
              Canjéalas en el catálogo <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </GlassCard>
        </StaggerItem>

        <StaggerItem>
          <GlassCard variant="solid" padding="md" animate={false} className={styles.statCard} bodyClassName={styles.statBody}>
            <div className={`${styles.statIcon} ${styles.statIconViolet}`}>
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <span className={styles.statLabel}>Experiencia</span>
            <span className={styles.statValue}>
              {xp} <small>XP</small>
            </span>
            <span className={styles.statHint}>La XP sube tu nivel, no se gasta.</span>
          </GlassCard>
        </StaggerItem>

        <StaggerItem>
          <GlassCard variant="solid" padding="md" animate={false} className={styles.statCard} bodyClassName={styles.statBody}>
            <div className={`${styles.statIcon} ${styles.statIconFlame}`}>
              <Flame size={18} aria-hidden="true" />
            </div>
            <span className={styles.statLabel}>Racha diaria</span>
            <span className={styles.statValue}>
              {streakCount} <small>{streakCount === 1 ? 'día' : 'días'}</small>
            </span>
            {checkInInfo ? (
              <span className={`${styles.statHint} ${styles.statHintOk}`}>
                <Check size={13} aria-hidden="true" />
                Check-in de hoy registrado
                {checkInReward > 0
                  ? ` · +${checkInReward} ${checkInReward === 1 ? 'moneda' : 'monedas'}`
                  : ''}
              </span>
            ) : (
              <span className={styles.statHint}>Entra cada día para no perderla.</span>
            )}
          </GlassCard>
        </StaggerItem>
      </Stagger>

      {/* ── Nivel por XP ─────────────────────────────────────────────────
          La barra sola no decía a dónde lleva el progreso; debajo va la escala
          completa de niveles con los ya alcanzados marcados, para que
          "Faltan 30 XP para Plata" tenga contra qué leerse. */}
      <Reveal>
        <GlassCard variant="solid" padding="lg" animate={false} className={styles.card}>
          <div className={styles.tierTop}>
            <div className={styles.tierIdent}>
              <span className={styles.tierMedal} aria-hidden="true">
                {tier.current.icon}
              </span>
              <div className={styles.tierTexts}>
                <p className={styles.tierName}>Nivel {tier.current.name}</p>
                <p className={styles.tierXp}>{xp} XP acumulada</p>
              </div>
            </div>
            {!tier.isMax ? (
              <Badge tone="violet" variant="soft">
                Faltan {tier.xpRemaining} XP para {tier.next.name}
              </Badge>
            ) : (
              <Badge tone="violet" variant="solid">
                <T>¡Nivel máximo alcanzado!</T>
              </Badge>
            )}
          </div>

          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso hacia el nivel ${tier.next ? tier.next.name : tier.current.name}`}
          >
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>

          <ol className={styles.tierScale}>
            {TIERS.map((t) => {
              const alcanzado = xp >= t.min;
              const esActual = t.key === tier.current.key;
              return (
                <li
                  key={t.key}
                  className={[
                    styles.tierStep,
                    alcanzado ? styles.tierStepDone : '',
                    esActual ? styles.tierStepCurrent : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={esActual ? 'step' : undefined}
                >
                  <span className={styles.tierStepIcon} aria-hidden="true">
                    {t.icon}
                  </span>
                  <span className={styles.tierStepName}>{t.name}</span>
                  <span className={styles.tierStepMin}>{t.min} XP</span>
                </li>
              );
            })}
          </ol>
        </GlassCard>
      </Reveal>

      {/* ── Mensajes ─────────────────────────────────────────────────────── */}
      {message && (
        <div className={`${styles.alert} ${styles.alertOk}`} role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Lista de misiones. Si hay un error no se muestra el vacío debajo:
          son dos explicaciones distintas de "no veo misiones" y mostrarlas
          juntas confunde más de lo que aclara. ───────────────────────────── */}
      <div className={styles.listHead}>
        <h3 className={styles.listTitle}>Misiones de hoy</h3>
        <div className={styles.listMeta}>
          {!loading && !error && totalMisiones > 0 && (
            <span className={`${styles.listCount} ${todasHechas ? styles.listCountDone : ''}`}>
              {hechas} de {totalMisiones} completadas
            </span>
          )}
          {missionsDate && (
            <span className={styles.dateNote}>{fechaLegible(missionsDate)}</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.skeletonList} aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className={styles.skeletonItem} />
          ))}
        </div>
      ) : error ? null : missions.length === 0 ? (
        <Reveal>
          <GlassCard variant="solid" padding="lg" animate={false} className={styles.empty} bodyClassName={styles.emptyBody}>
            <div className={styles.emptyIcon}>
              <ListChecks size={26} aria-hidden="true" />
            </div>
            <p className={styles.emptyTitle}>Todavía no hay misiones activas.</p>
            <p className={styles.emptyText}>Vuelve pronto — se agregan seguido.</p>
          </GlassCard>
        </Reveal>
      ) : (
        <Stagger as="ul" className={styles.missionList}>
          {missions.map((m) => {
            const accion = m.actionKey ? MISSION_ACTIONS[m.actionKey] : null;
            return (
              <StaggerItem as="li" key={m.missionId} className={styles.missionRow}>
                <GlassCard
                  as="article"
                  variant="solid"
                  padding="md"
                  animate={false}
                  className={`${styles.missionCard} ${m.completed ? styles.missionDone : ''}`}
                  bodyClassName={styles.missionBody}
                >
                  <span
                    className={`${styles.missionMark} ${m.completed ? styles.missionMarkDone : ''}`}
                    aria-hidden="true"
                  >
                    {m.completed ? <Check size={16} /> : null}
                  </span>

                  <div className={styles.missionMain}>
                    <h4 className={styles.missionTitle}>{m.title}</h4>
                    {m.description && <p className={styles.missionDesc}>{m.description}</p>}
                  </div>

                  <div className={styles.missionAside}>
                    {/* Etiqueta explícita: el ícono de moneda solo no distingue
                        "lo que ganas" de "lo que cuesta" — mismo criterio que el
                        badge "CUESTA" del Catálogo de Recompensas, al revés. */}
                    <span className={styles.rewardBadge}>
                      <span className={styles.rewardLabel}>Ganas</span>
                      <span className={styles.rewardAmount}>🪙 +{m.rewardPoints}</span>
                    </span>

                    {/* Ranura de ancho mínimo fijo: sin ella, el badge de
                        recompensa se corre a distinta altura horizontal en cada
                        tarjeta según lo largo que sea el botón de al lado. */}
                    <span className={styles.missionActionSlot}>
                      {m.completed ? (
                        <span className={styles.doneBadge}>
                          <Check size={14} aria-hidden="true" /> Completada
                        </span>
                      ) : m.actionKey && !m.verified ? (
                        // Todavía no se registró la acción real de esta misión: en
                        // vez de "Completar" (que la pagaría sin comprobar nada), se
                        // manda al cliente a hacerla. Al volver aquí, verified ya
                        // estará en true y el botón pasa a ser "Completar".
                        <Link to={accion?.path || '/cuenta/misiones'} className={styles.btnGhost}>
                          {accion?.goLabel || 'Ir a hacerlo'}
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnSolido}
                          disabled={completingId === m.missionId}
                          onClick={() => handleComplete(m.missionId)}
                        >
                          {completingId === m.missionId ? 'Completando…' : 'Completar'}
                        </button>
                      )}
                    </span>
                  </div>
                </GlassCard>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
};

export default MisionesPage;
