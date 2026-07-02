// ── SorteosPage — Página pública del Módulo Sorteos (Build 1) ────────────────
// Móvil-first (el tráfico viene de lives en el teléfono). Muestra el sorteo
// activo con hero del premio, countdown, reglas de cómo ganar chances, gate de
// login, y el botón PARTICIPAR (gratis via callable; pagado se cablea en Build 2).
//
// PRINCIPIOS DE POCAS LECTURAS (regla dura):
//   - Contador en vivo = suma de shards (getContadorSorteo), refresco suave con
//     react-query refetchInterval (NO onSnapshot, NO escaneo de participantes).
//   - "Mi participación" = 1 doc por uid (getMiParticipacion), staleTime 30s.
//   - El estado del sorteo (contador/tickets) vive en Firestore, nunca en
//     localStorage.
import React, { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getClientType } from '../services/analytics/tracker';
import { GlassCard, GlassButton, GlassPanel, Badge } from '../components/ui';
import {
  getSorteoActivo,
  getMiParticipacion,
  getContadorSorteo,
  participarGratis,
} from '../services/sorteos';
import styles from './SorteosPage.module.css';

// Imagen de reemplazo si falla la carga del hero/premio.
const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#2A2640"/><text x="50%" y="50%" fill="#C7C1D8" font-family="sans-serif" font-size="20" text-anchor="middle" dominant-baseline="middle">Sorteo Walá</text></svg>',
  );

// Convierte un Timestamp de Firestore (o Date/número) a milisegundos.
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Cuenta regresiva sencilla hacia una fecha objetivo (en ms). Se actualiza cada
// segundo con un intervalo local (NO toca Firestore). Devuelve texto legible.
function useCountdown(targetMs) {
  const [now, setNow] = useState(() => Date.now());
  React.useEffect(() => {
    if (!targetMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!targetMs) return { texto: '', terminado: false };
  const diff = targetMs - now;
  if (diff <= 0) return { texto: 'Finalizado', terminado: true };

  const dias = Math.floor(diff / 86400000);
  const horas = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const segs = Math.floor((diff % 60000) / 1000);
  const partes = [];
  if (dias > 0) partes.push(`${dias}d`);
  partes.push(`${String(horas).padStart(2, '0')}h`);
  partes.push(`${String(mins).padStart(2, '0')}m`);
  partes.push(`${String(segs).padStart(2, '0')}s`);
  return { texto: partes.join(' '), terminado: false };
}

// Imagen con fallback a placeholder si el src falla.
function ImagenConFallback({ src, alt, className }) {
  const [error, setError] = useState(false);
  return (
    <img
      className={className}
      src={error || !src ? PLACEHOLDER_IMG : src}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

const SorteosPage = () => {
  const { user, profileIncomplete } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // origenApp: detecta si venimos del app (Capacitor) o de la web. tracker.js:50.
  const origenApp = useMemo(() => getClientType() === 'APP', []);

  const [accionError, setAccionError] = useState('');
  const [participando, setParticipando] = useState(false);

  // 1) Sorteo activo (1 query barata). staleTime 30s: no re-consulta al enfocar.
  const {
    data: sorteo,
    isLoading: cargandoSorteo,
    error: errorSorteo,
  } = useQuery({
    queryKey: ['sorteo-activo'],
    queryFn: async () => {
      const { data, error } = await getSorteoActivo();
      if (error) throw new Error(error);
      return data; // puede ser null si no hay sorteo activo
    },
    staleTime: 30000,
  });

  const sorteoId = sorteo?.id || null;

  // 2) Mi participación (1 doc, id=uid). Solo si hay usuario y sorteo.
  const { data: miParticipacion } = useQuery({
    queryKey: ['mi-participacion', sorteoId, user?.uid],
    queryFn: async () => {
      const { data, error } = await getMiParticipacion(sorteoId, user.uid);
      if (error) throw new Error(error);
      return data; // null si aún no participa
    },
    enabled: !!sorteoId && !!user?.uid,
    staleTime: 30000,
  });

  // 3) Contador en vivo (suma de shards). Refresco suave cada 20s, sin onSnapshot.
  const { data: contador } = useQuery({
    queryKey: ['contador-sorteo', sorteoId],
    queryFn: async () => {
      const { data } = await getContadorSorteo(sorteoId);
      return data;
    },
    enabled: !!sorteoId,
    staleTime: 20000,
    refetchInterval: 20000,
  });

  // Total mostrado: prioriza la suma de shards; cae al denormalizado aprox.
  const totalParticipantes =
    typeof contador === 'number' ? contador : sorteo?.contadorParticipantes || 0;

  const fechaFinMs = useMemo(() => toMillis(sorteo?.fechaFin), [sorteo?.fechaFin]);
  const { texto: countdown, terminado } = useCountdown(fechaFinMs);

  const yaParticipa = !!miParticipacion;
  const esGratis = sorteo?.tipo === 'gratis';
  const esPagado = sorteo?.tipo === 'pagado';
  const requiereApp = sorteo?.requisitoApp === 'obligatorio';
  const bloqueadoPorApp = requiereApp && !origenApp;

  // Refresca los datos server-side tras participar (mi participación + contador).
  const refrescarTrasParticipar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mi-participacion', sorteoId, user?.uid] });
    queryClient.invalidateQueries({ queryKey: ['contador-sorteo', sorteoId] });
  }, [queryClient, sorteoId, user?.uid]);

  // Handler PARTICIPAR (solo sorteos gratis en Build 1).
  const handleParticipar = useCallback(async () => {
    setAccionError('');
    if (!sorteoId) return;

    // El perfil debe estar completo (dni + phone). El servidor lo revalida.
    if (profileIncomplete) {
      navigate('/completar-perfil', { state: { from: '/sorteos' } });
      return;
    }

    setParticipando(true);
    const { data, error } = await participarGratis(sorteoId, origenApp);
    setParticipando(false);

    if (error) {
      setAccionError(error);
      return;
    }
    if (data?.ok) {
      refrescarTrasParticipar();
    }
  }, [sorteoId, profileIncomplete, origenApp, navigate, refrescarTrasParticipar]);

  // ── Estados de carga / error / vacío ─────────────────────────────────────
  if (cargandoSorteo) {
    return (
      <div className={styles.page}>
        <div className={styles.stateBox}>Cargando sorteos…</div>
      </div>
    );
  }

  if (errorSorteo) {
    return (
      <div className={styles.page}>
        <GlassCard variant="soft" padding="lg" className={styles.stateBox}>
          <p className={styles.stateText}>No pudimos cargar los sorteos ahora.</p>
        </GlassCard>
      </div>
    );
  }

  if (!sorteo) {
    return (
      <div className={styles.page}>
        <GlassCard variant="soft" padding="lg" className={styles.stateBox}>
          <div className={styles.emptyEmoji} aria-hidden="true">🎁</div>
          <h1 className={styles.emptyTitle}>Pronto habrá sorteos</h1>
          <p className={styles.stateText}>
            Aún no hay un sorteo activo. ¡Vuelve pronto para participar y ganar!
          </p>
        </GlassCard>
      </div>
    );
  }

  const premioNombre = sorteo.premio?.nombre || sorteo.titulo || 'un gran premio';
  const heroSrc = sorteo.heroImagenUrl || sorteo.premio?.imagenUrl;

  // Sorteo cerrado: mostrar ganadores si existen.
  const cerrado = sorteo.estado === 'cerrado' || terminado;

  return (
    <div className={styles.page}>
      {/* HERO ---------------------------------------------------------------- */}
      <section className={styles.hero}>
        <div className={styles.heroImgWrap}>
          <ImagenConFallback src={heroSrc} alt={premioNombre} className={styles.heroImg} />
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroBadges}>
            <Badge tone="violet" variant="solid">
              {esGratis ? 'GRATIS' : `${sorteo.moneda || 'PEN'} ${sorteo.precioTicket || 0} / ticket`}
            </Badge>
            {sorteo.numGanadores > 1 && (
              <Badge tone="neutral" variant="soft">
                {sorteo.numGanadores} ganadores
              </Badge>
            )}
          </div>
          <h1 className={styles.heroTitle}>GANA: {premioNombre}</h1>
          {sorteo.descripcion && <p className={styles.heroDesc}>{sorteo.descripcion}</p>}

          {/* Countdown a fechaFin */}
          {!cerrado && countdown && (
            <div className={styles.countdown}>
              <span className={styles.countdownLabel}>Termina en</span>
              <span className={styles.countdownValue}>{countdown}</span>
            </div>
          )}
          {cerrado && (
            <Badge tone="danger" variant="soft" className={styles.cerradoBadge}>
              Sorteo cerrado
            </Badge>
          )}

          {/* Contador en vivo (suma de shards) */}
          <p className={styles.contador}>
            <span aria-hidden="true">👥</span> {totalParticipantes.toLocaleString('es-PE')} personas ya participan
          </p>
        </div>
      </section>

      {/* Estado del usuario (si ya participa) -------------------------------- */}
      {user && yaParticipa && (
        <GlassPanel variant="solid" padding="md" className={styles.miEstado}>
          <span>🎟️ Tus tickets: {miParticipacion.ticketsPagados ?? miParticipacion.tickets ?? 0}</span>
          <span aria-hidden="true">·</span>
          <span>⭐ Chances: {miParticipacion.chancesTotal ?? miParticipacion.chancesBase ?? 1}</span>
          <span aria-hidden="true">·</span>
          <span className={styles.participandoOk}>Participando ✓</span>
        </GlassPanel>
      )}

      {/* Reglas: cómo ganar chances ------------------------------------------ */}
      <GlassCard
        variant="soft"
        padding="md"
        title="Cómo ganar más chances"
        className={styles.reglas}
      >
        <ul className={styles.reglasList}>
          <li>Participar te da 1 chance base.</li>
          {sorteo.requisitoApp === 'chanceExtra' && (
            <li>Entrar desde el <strong>app de Walá</strong> te da 1 chance extra.</li>
          )}
          {sorteo.chanceExtraCompartir && (
            <li>Compartir el sorteo suma una chance extra (próximamente).</li>
          )}
          {sorteo.chanceExtraReferido && (
            <li>Invitar a un amigo con tu código suma una chance extra (próximamente).</li>
          )}
          {requiereApp && (
            <li>Este sorteo requiere participar <strong>desde el app</strong>.</li>
          )}
        </ul>
      </GlassCard>

      {/* Cerrado: mostrar ganadores si existen ------------------------------- */}
      {cerrado && Array.isArray(sorteo.ganadores) && sorteo.ganadores.length > 0 && (
        <GlassCard variant="soft" padding="md" title="Ganadores" className={styles.ganadores}>
          <ul className={styles.ganadoresList}>
            {sorteo.ganadores.map((g, i) => (
              <li key={g?.uid || g?.nombre || i}>🏆 {g?.nombre || 'Ganador'}</li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Zona de acción ------------------------------------------------------ */}
      <section className={styles.accion}>
        {accionError && <div className={styles.errorBox}>{accionError}</div>}

        {/* Gate de login: si no hay usuario, invitar a iniciar sesión. */}
        {!user ? (
          <GlassCard variant="soft" padding="md" className={styles.loginGate}>
            <p className={styles.loginPrompt}>Inicia sesión en Walá para participar</p>
            <GlassButton
              as={Link}
              to="/login"
              state={{ from: '/sorteos' }}
              variant="primary"
              size="lg"
              fullWidth
            >
              Iniciar sesión
            </GlassButton>
          </GlassCard>
        ) : cerrado ? (
          <GlassButton variant="glass" size="lg" fullWidth disabled>
            Sorteo cerrado
          </GlassButton>
        ) : esPagado ? (
          // Build 1: los sorteos pagados aún no venden tickets aquí.
          <GlassCard variant="soft" padding="md" className={styles.loginGate}>
            <p className={styles.loginPrompt}>Compra de tickets: disponible pronto</p>
          </GlassCard>
        ) : bloqueadoPorApp ? (
          // requisitoApp == 'obligatorio' y no venimos del app.
          <>
            <p className={styles.appHint}>Este sorteo solo está disponible desde el app.</p>
            <GlassButton as={Link} to="/descargar" variant="primary" size="lg" fullWidth>
              Descargar app
            </GlassButton>
          </>
        ) : yaParticipa ? (
          <GlassButton variant="glass" size="lg" fullWidth disabled>
            Ya estás participando ✓
          </GlassButton>
        ) : (
          <GlassButton
            variant="primary"
            size="lg"
            fullWidth
            loading={participando}
            onClick={handleParticipar}
          >
            {participando ? 'Registrando…' : '¡Participar gratis!'}
          </GlassButton>
        )}

        {/* Aviso de perfil incompleto (no bloquea el render; el click lo maneja). */}
        {user && esGratis && !cerrado && !yaParticipa && profileIncomplete && (
          <p className={styles.perfilHint}>
            Necesitas <Link to="/completar-perfil" state={{ from: '/sorteos' }}>completar tu perfil</Link> para participar.
          </p>
        )}
      </section>
    </div>
  );
};

export default SorteosPage;
