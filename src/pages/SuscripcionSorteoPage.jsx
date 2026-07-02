// ── SuscripcionSorteoPage — Página pública del "Sorteo por Suscripción" ──────
// Estilo jorgitoluna.com ("No Hay Sin Suerte"): la gente se SUSCRIBE con
// auto-débito (Culqi en Perú, PayPal internacional) a un plan y por eso participa
// en los sorteos. Más meses suscritos = más chances; SOLO suscriptores vigentes
// pueden ganar. El BACKEND ya está hecho: esta página SOLO consume el contrato de
// services/suscripcionSorteos.js.
//
// Rutas públicas: /suscrito-sorteo  y  /suscrito-sorteo/:slug
//   - Con :slug → getCampaignBySlug(slug).
//   - Sin slug → intenta getCampaignBySlug("suscrito-sorteo") y, si no hay,
//     cae a la primera campaña ACTIVA (getCampaigns()[0] activa).
//
// PRINCIPIOS DE POCAS LECTURAS (regla dura del proyecto):
//   - 1 doc de campaña (react-query staleTime alto).
//   - contador = suma de shards, refetch suave (NO onSnapshot).
//   - beneficios/ganadores = subcolecciones cacheadas (staleTime alto).
//   - "Mi suscripción" = 1 doc por uid; recibos = 1 query por uid bajo demanda.
//   - Estado en la nube, NUNCA en localStorage.
//
// THEMING: los colores de la campaña (campaign.colores) se inyectan como
// variables CSS locales (--sus-*) en el contenedor raíz. Fallback morado.
import React, { useMemo, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalToast } from '../contexts/ToastContext';
import { signInWithGoogle } from '../services/firebase/auth';
import { getClientType } from '../services/analytics/tracker';
import { GlassCard, GlassButton, GlassModal, Badge } from '../components/ui';
import {
  getCampaignBySlug,
  getCampaigns,
  getContadorSuscriptores,
  getMiSuscripcion,
  getBeneficios,
  getGanadoresGaleria,
  getRecibos,
  cancelarSuscripcion,
  formatoPrecioPen,
  formatoPrecioUsd,
} from '../services/suscripcionSorteos';
import { CulqiSuscripcionButton, PaypalSuscripcionButtons } from './suscripcion/PagoSuscripcion';
import styles from './SuscripcionSorteoPage.module.css';

// Slug por defecto de la campaña "principal" si la ruta no trae uno.
const SLUG_DEFECTO = 'suscrito-sorteo';

// Colores morados por defecto (estilo Jorge Luna) si la campaña no define paleta.
const COLORES_DEFECTO = {
  primario: '#7c3aed',
  fondo: '#faf7ff',
  texto: '#1a1030',
  acento: '#f59e0b',
};

// Imagen de reemplazo si falla una foto (premio/ganador/beneficio).
const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="100%" height="100%" fill="#e9e3f5"/><text x="50%" y="50%" fill="#9b8bc4" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">Walá</text></svg>',
  );

// Imagen con fallback a placeholder si el src falla o falta.
function ImgFallback({ src, alt, className }) {
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

// Ícono "G" de Google para el botón de login (SVG multicolor oficial simplificado).
function GoogleIcon() {
  return (
    <svg className={styles.googleIcon} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7C43.7 37.9 46.5 31.8 46.5 24.5z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.7-2.9-.7-4.3s.3-3 .7-4.3l-7.8-6.1C.9 16.7 0 20.2 0 24s.9 7.3 2.6 10.4l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.4-5.7c-2 1.4-4.7 2.3-7.8 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

// Convierte un Timestamp de Firestore (o Date/número/ISO) a texto legible es-PE.
function fechaLegible(ts) {
  if (!ts) return '—';
  let ms = 0;
  if (typeof ts.toMillis === 'function') ms = ts.toMillis();
  else if (typeof ts.seconds === 'number') ms = ts.seconds * 1000;
  else if (ts instanceof Date) ms = ts.getTime();
  else if (typeof ts === 'number') ms = ts;
  else { const p = Date.parse(ts); ms = Number.isNaN(p) ? 0 : p; }
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Etiqueta y tono del estado de la suscripción (para el Badge de "Mi cuenta").
const ESTADO_SUSC = {
  activo: { label: 'Activa', tone: 'success' },
  pendiente_pago: { label: 'Pendiente de pago', tone: 'warning' },
  vencido: { label: 'Vencida', tone: 'danger' },
  cancelado: { label: 'Cancelada', tone: 'neutral' },
};

const SuscripcionSorteoPage = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // origenApp: distingue app (Capacitor) vs web para el backend (tracker.js).
  const origenApp = useMemo(() => getClientType() === 'APP', []);

  // ── 1) Campaña: por slug de la ruta, o la de SLUG_DEFECTO, o la 1ª activa ──
  const {
    data: campaign,
    isLoading: cargandoCampaign,
    error: errorCampaign,
  } = useQuery({
    queryKey: ['susc-campaign', slug || SLUG_DEFECTO],
    queryFn: async () => {
      // a) Slug explícito de la ruta.
      if (slug) {
        const { data, error } = await getCampaignBySlug(slug);
        if (error) throw new Error(error);
        return data;
      }
      // b) Slug por defecto de la campaña principal.
      const porDefecto = await getCampaignBySlug(SLUG_DEFECTO);
      if (porDefecto.data) return porDefecto.data;
      // c) Fallback: primera campaña ACTIVA (getCampaigns ya ordena por reciente).
      const { data: todas } = await getCampaigns();
      const activa = (todas || []).find((c) => c.estado === 'activo');
      return activa || null;
    },
    staleTime: 5 * 60 * 1000, // 5 min: la campaña casi no cambia.
  });

  const campaignId = campaign?.id || null;
  const colores = { ...COLORES_DEFECTO, ...(campaign?.colores || {}) };

  // Variables CSS del theming (se aplican en el contenedor raíz).
  const themeVars = useMemo(
    () => ({
      '--sus-primario': colores.primario,
      '--sus-fondo': colores.fondo,
      '--sus-texto': colores.texto,
      '--sus-acento': colores.acento,
    }),
    [colores.primario, colores.fondo, colores.texto, colores.acento],
  );

  // Solo mostramos la campaña si está publicada (activo/cerrado). borrador = oculta.
  const disponible = !!campaign && campaign.estado !== 'borrador';

  // ── 2) Contador de suscriptores en vivo (suma de shards, refetch suave) ──
  const { data: contador } = useQuery({
    queryKey: ['susc-contador', campaignId],
    queryFn: async () => {
      const { data } = await getContadorSuscriptores(campaignId);
      return data;
    },
    enabled: !!campaignId && disponible,
    staleTime: 25000,
    refetchInterval: 30000, // refresco suave; NO onSnapshot.
  });
  const totalSuscriptores =
    typeof contador === 'number' ? contador : campaign?.contadorSuscriptores || 0;

  // ── 3) Beneficios (subcolección cacheada, staleTime alto) ──
  const { data: beneficios = [] } = useQuery({
    queryKey: ['susc-beneficios', campaignId],
    queryFn: async () => {
      const { data } = await getBeneficios(campaignId);
      return data || [];
    },
    enabled: !!campaignId && disponible,
    staleTime: 5 * 60 * 1000,
  });

  // ── 4) Galería de ganadores (subcolección cacheada) ──
  const { data: ganadores = [] } = useQuery({
    queryKey: ['susc-ganadores', campaignId],
    queryFn: async () => {
      const { data } = await getGanadoresGaleria(campaignId);
      return data || [];
    },
    enabled: !!campaignId && disponible,
    staleTime: 5 * 60 * 1000,
  });

  // ── 5) Mi suscripción (1 doc por uid) — solo si logueado ──
  const { data: miSuscripcion } = useQuery({
    queryKey: ['susc-mia', campaignId, user?.uid],
    queryFn: async () => {
      const { data } = await getMiSuscripcion(campaignId, user.uid);
      return data;
    },
    enabled: !!campaignId && !!user?.uid && disponible,
    staleTime: 60000,
  });

  const refrescarMiSuscripcion = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['susc-mia', campaignId, user?.uid] });
    queryClient.invalidateQueries({ queryKey: ['susc-contador', campaignId] });
  }, [queryClient, campaignId, user?.uid]);

  // ── Estado del modal de suscripción ──
  const [planElegido, setPlanElegido] = useState(null); // plan sobre el que se suscribe

  const abrirSuscripcion = useCallback((plan) => {
    setPlanElegido(plan);
  }, []);
  const cerrarModal = useCallback(() => setPlanElegido(null), []);

  // ── Beneficios: filtro por categoría / ubicación ──
  const [filtro, setFiltro] = useState('todas');
  const categorias = useMemo(() => {
    const set = new Set();
    (beneficios || []).forEach((b) => { if (b.categoria) set.add(b.categoria); });
    return ['todas', ...Array.from(set)];
  }, [beneficios]);
  const beneficiosFiltrados = useMemo(() => {
    if (filtro === 'todas') return beneficios;
    return (beneficios || []).filter((b) => b.categoria === filtro);
  }, [beneficios, filtro]);

  // ── Pestañas de "Mi cuenta" ──
  const [tabCuenta, setTabCuenta] = useState('suscripcion'); // 'suscripcion'|'chances'|'recibos'

  // ── Estados de carga / no disponible ──
  if (cargandoCampaign) {
    return (
      <div className={styles.page} style={themeVars}>
        <div className={styles.stateWrap}>
          <div className={styles.stateBox}>Cargando…</div>
        </div>
      </div>
    );
  }

  if (errorCampaign || !disponible) {
    return (
      <div className={styles.page} style={themeVars}>
        <div className={styles.stateWrap}>
          <div className={styles.stateBox}>
            <div className={styles.stateEmoji} aria-hidden="true">🎁</div>
            <h1 className={styles.stateTitle}>No disponible</h1>
            <p className={styles.stateText}>
              Este sorteo por suscripción no está disponible por ahora. ¡Vuelve pronto!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const premios = Array.isArray(campaign.premios) ? campaign.premios : [];
  const planes = Array.isArray(campaign.planes)
    ? [...campaign.planes].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0))
    : [];

  return (
    <div className={styles.page} style={themeVars}>
      {/* NAV STICKY por anclas -------------------------------------------- */}
      <nav className={styles.nav} aria-label="Secciones">
        <a className={styles.navLink} href="#planes">Planes</a>
        <a className={styles.navLink} href="#premios">Premios</a>
        <a className={styles.navLink} href="#ganadores">Ganadores</a>
        <a className={styles.navLink} href="#beneficios">Beneficios</a>
        {user && <a className={styles.navLink} href="#mi-cuenta">Mi cuenta</a>}
      </nav>

      <div className={styles.contenido}>
        {/* HERO ----------------------------------------------------------- */}
        <section className={styles.hero}>
          {campaign.heroImagenUrl && (
            <img className={styles.heroBg} src={campaign.heroImagenUrl} alt="" aria-hidden="true" />
          )}
          <div className={styles.heroInner}>
            {campaign.logoUrl && (
              <img className={styles.heroLogo} src={campaign.logoUrl} alt={`Logo ${campaign.titulo}`} />
            )}
            <h1 className={styles.heroTitle}>{campaign.titulo}</h1>
            {campaign.descripcion && <p className={styles.heroDesc}>{campaign.descripcion}</p>}

            {/* Contador de suscriptores EN VIVO (suma de shards) */}
            <div className={styles.contadorVivo}>
              <span className={styles.contadorPulso} aria-hidden="true" />
              <span className={styles.contadorNum}>{totalSuscriptores.toLocaleString('es-PE')}</span>
              <span>suscriptores participando</span>
            </div>

            <div className={styles.heroCta}>
              <GlassButton
                as="a"
                href="#planes"
                variant="primary"
                size="lg"
                className={styles.btnCampana}
              >
                ¡Quiero suscribirme!
              </GlassButton>
            </div>
          </div>
        </section>

        {/* PLANES --------------------------------------------------------- */}
        <section id="planes" className={styles.seccion}>
          <h2 className={styles.seccionTitulo}>Elige tu plan</h2>
          <p className={styles.seccionSub}>
            Suscríbete con cobro automático y participa en cada sorteo. Mientras más
            tiempo suscrito, más chances de ganar.
          </p>
          <div className={styles.planes}>
            {planes.map((plan) => {
              // "Es como pagar S/X al mes": precio total / meses del ciclo.
              const meses = Number(plan.meses) || 1;
              const porMes = meses > 1 ? Math.round((Number(plan.precioCentimos) || 0) / meses) : null;
              return (
                <div
                  key={plan.id}
                  className={`${styles.planCard} ${plan.destacado ? styles.planDestacado : ''}`}
                >
                  {plan.destacado && <span className={styles.planBadge}>⭐ Recomendado</span>}
                  <div>
                    <h3 className={styles.planNombre}>{plan.nombre}</h3>
                    <span className={styles.planIntervalo}>{plan.intervalo}</span>
                  </div>
                  <div className={styles.planPrecio}>
                    <span className={styles.planPrecioValor}>{formatoPrecioPen(plan.precioCentimos)}</span>
                    {plan.precioUsd > 0 && (
                      <span className={styles.planPrecioUsd}>· {formatoPrecioUsd(plan.precioUsd)}</span>
                    )}
                  </div>
                  {porMes != null && (
                    <p className={styles.planEquivalente}>
                      Es como pagar <strong>{formatoPrecioPen(porMes)}</strong> al mes
                    </p>
                  )}
                  <span className={styles.planChances}>
                    🎟️ {plan.chancesPorCiclo} chance{plan.chancesPorCiclo === 1 ? '' : 's'} por ciclo
                  </span>
                  {Array.isArray(plan.beneficios) && plan.beneficios.length > 0 && (
                    <ul className={styles.planBeneficios}>
                      {plan.beneficios.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  )}
                  <div className={styles.planBtn}>
                    <GlassButton
                      variant="primary"
                      size="md"
                      fullWidth
                      className={styles.btnCampana}
                      onClick={() => abrirSuscripcion(plan)}
                    >
                      ¡Suscribirme!
                    </GlassButton>
                  </div>
                </div>
              );
            })}
            {planes.length === 0 && (
              <p className={styles.stateText}>Aún no hay planes configurados.</p>
            )}
          </div>
        </section>

        {/* PREMIOS -------------------------------------------------------- */}
        {premios.length > 0 && (
          <section id="premios" className={styles.seccion}>
            <h2 className={styles.seccionTitulo}>Premios</h2>
            <p className={styles.seccionSub}>Esto es lo que puedes ganar siendo suscriptor.</p>
            <div className={styles.premios}>
              {premios.map((p, i) => (
                <div key={i} className={styles.premioCard}>
                  <ImgFallback src={p.imagenUrl} alt={p.nombre} className={styles.premioImg} />
                  <div className={styles.premioNombre}>{p.nombre}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GANADORES ------------------------------------------------------ */}
        <section id="ganadores" className={styles.seccion}>
          <h2 className={styles.seccionTitulo}>Ganadores</h2>
          <p className={styles.seccionSub}>Ellos ya ganaron. El próximo puedes ser tú.</p>
          {ganadores.length > 0 ? (
            <div className={styles.ganadores}>
              {ganadores.map((g) => (
                <div key={g.id} className={styles.ganadorCard}>
                  <ImgFallback src={g.fotoUrl} alt={g.nombre} className={styles.ganadorFoto} />
                  <div className={styles.ganadorInfo}>
                    <p className={styles.ganadorNombre}>{g.nombre}</p>
                    {g.premio && <p className={styles.ganadorPremio}>{g.premio}</p>}
                    {g.fecha && <p className={styles.ganadorFecha}>{g.fecha}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.stateText}>Pronto anunciaremos a los primeros ganadores.</p>
          )}
        </section>

        {/* BENEFICIOS ----------------------------------------------------- */}
        {beneficios.length > 0 && (
          <section id="beneficios" className={styles.seccion}>
            <h2 className={styles.seccionTitulo}>Beneficios para suscriptores</h2>
            <p className={styles.seccionSub}>Descuentos exclusivos en marcas aliadas.</p>
            {categorias.length > 1 && (
              <div className={styles.filtros}>
                {categorias.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.filtroChip} ${filtro === c ? styles.filtroChipActivo : ''}`}
                    onClick={() => setFiltro(c)}
                  >
                    {c === 'todas' ? 'Todas' : c}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.beneficios}>
              {beneficiosFiltrados.map((b) => {
                const Wrapper = b.url ? 'a' : 'div';
                const wrapperProps = b.url
                  ? { href: b.url, target: '_blank', rel: 'noopener noreferrer' }
                  : {};
                return (
                  <Wrapper key={b.id} className={styles.beneficioCard} {...wrapperProps}>
                    <ImgFallback src={b.imagenUrl} alt={b.marca} className={styles.beneficioImg} />
                    <div className={styles.beneficioTextos}>
                      {b.marca && <span className={styles.beneficioMarca}>{b.marca}</span>}
                      {b.titulo && <p className={styles.beneficioTitulo}>{b.titulo}</p>}
                      {b.descuento && <span className={styles.beneficioDescuento}>{b.descuento}</span>}
                      {b.ubicacion && <span className={styles.beneficioUbicacion}>📍 {b.ubicacion}</span>}
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          </section>
        )}

        {/* MI CUENTA (solo logueado) -------------------------------------- */}
        {user && (
          <section id="mi-cuenta" className={styles.seccion}>
            <h2 className={styles.seccionTitulo}>Mi cuenta</h2>
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tabCuenta === 'suscripcion'}
                className={`${styles.tab} ${tabCuenta === 'suscripcion' ? styles.tabActivo : ''}`}
                onClick={() => setTabCuenta('suscripcion')}
              >
                Mi suscripción
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tabCuenta === 'chances'}
                className={`${styles.tab} ${tabCuenta === 'chances' ? styles.tabActivo : ''}`}
                onClick={() => setTabCuenta('chances')}
              >
                Mis chances
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tabCuenta === 'recibos'}
                className={`${styles.tab} ${tabCuenta === 'recibos' ? styles.tabActivo : ''}`}
                onClick={() => setTabCuenta('recibos')}
              >
                Mis recibos
              </button>
            </div>

            {tabCuenta === 'suscripcion' && (
              <TabMiSuscripcion
                campaignId={campaignId}
                miSuscripcion={miSuscripcion}
                onCancelado={refrescarMiSuscripcion}
                onIrAPlanes={() => {
                  const el = document.getElementById('planes');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            )}
            {tabCuenta === 'chances' && (
              <TabMisChances miSuscripcion={miSuscripcion} />
            )}
            {tabCuenta === 'recibos' && (
              <TabMisRecibos campaignId={campaignId} uid={user.uid} />
            )}
          </section>
        )}
      </div>

      {/* MODAL: flujo de suscripción -------------------------------------- */}
      {planElegido && (
        <ModalSuscripcion
          campaign={campaign}
          plan={planElegido}
          origenApp={origenApp}
          onClose={cerrarModal}
          onSuscrito={() => {
            cerrarModal();
            refrescarMiSuscripcion();
          }}
        />
      )}
    </div>
  );
};

// ── Pestaña: Mi suscripción (estado + vigencia + cancelar) ───────────────────
function TabMiSuscripcion({ campaignId, miSuscripcion, onCancelado, onIrAPlanes }) {
  const toast = useGlobalToast();
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancel, setConfirmarCancel] = useState(false);

  if (!miSuscripcion) {
    return (
      <GlassCard variant="soft" padding="md">
        <p className={styles.miCuentaVacia}>
          Aún no tienes una suscripción activa en esta campaña.
        </p>
        <GlassButton variant="primary" size="md" fullWidth className={styles.btnCampana} onClick={onIrAPlanes}>
          Ver planes y suscribirme
        </GlassButton>
      </GlassCard>
    );
  }

  const est = ESTADO_SUSC[miSuscripcion.estado] || { label: miSuscripcion.estado, tone: 'neutral' };
  const puedeCancelar = miSuscripcion.estado === 'activo' || miSuscripcion.estado === 'pendiente_pago';

  const handleCancelar = async () => {
    setCancelando(true);
    const { error } = await cancelarSuscripcion(campaignId);
    setCancelando(false);
    setConfirmarCancel(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Tu suscripción fue cancelada. Seguirás vigente hasta el fin del periodo pagado.');
    if (onCancelado) onCancelado();
  };

  return (
    <GlassCard variant="soft" padding="md">
      <div className={styles.miSuscKV}>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Estado</span>
          <span className={styles.kvValor}>
            <Badge tone={est.tone} variant="soft" dot>{est.label}</Badge>
          </span>
        </div>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Plan</span>
          <span className={styles.kvValor}>
            {miSuscripcion.planId || '—'}
            {miSuscripcion.intervalo ? ` · ${miSuscripcion.intervalo}` : ''}
          </span>
        </div>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Método de pago</span>
          <span className={styles.kvValor}>{miSuscripcion.metodoPago || '—'}</span>
        </div>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Vigente hasta</span>
          <span className={styles.kvValor}>{fechaLegible(miSuscripcion.vigenciaHasta)}</span>
        </div>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Próximo cobro</span>
          <span className={styles.kvValor}>{fechaLegible(miSuscripcion.proximoCobro)}</span>
        </div>
      </div>

      {puedeCancelar && (
        confirmarCancel ? (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <p className={styles.stateText}>
              ¿Seguro que quieres cancelar el cobro automático? No se harán más cobros;
              seguirás participando hasta el fin del periodo ya pagado.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <GlassButton variant="ghost" size="md" onClick={() => setConfirmarCancel(false)} disabled={cancelando}>
                No, mantener
              </GlassButton>
              <GlassButton variant="danger" size="md" loading={cancelando} disabled={cancelando} onClick={handleCancelar}>
                Sí, cancelar
              </GlassButton>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <GlassButton variant="ghost" size="md" onClick={() => setConfirmarCancel(true)}>
              Cancelar suscripción
            </GlassButton>
          </div>
        )
      )}
    </GlassCard>
  );
}

// ── Pestaña: Mis chances (total + explicación) ───────────────────────────────
function TabMisChances({ miSuscripcion }) {
  const chances = miSuscripcion?.chancesTotal ?? 0;
  return (
    <GlassCard variant="soft" padding="md">
      <div className={styles.chancesBig}>
        <div className={styles.chancesNum}>{chances}</div>
        <div className={styles.chancesLabel}>chances acumuladas para el sorteo</div>
      </div>
      <p className={styles.stateText}>
        Cada ciclo pagado te suma chances según tu plan. Mientras más tiempo sigas
        suscrito, más chances acumulas. Solo los suscriptores vigentes pueden ganar.
      </p>
    </GlassCard>
  );
}

// ── Pestaña: Mis recibos (getRecibos bajo demanda) ───────────────────────────
function TabMisRecibos({ campaignId, uid }) {
  // Se lee solo al abrir la pestaña (query habilitada aquí). staleTime alto.
  const { data: recibos = [], isLoading } = useQuery({
    queryKey: ['susc-recibos', campaignId, uid],
    queryFn: async () => {
      const { data } = await getRecibos(campaignId, uid);
      return data || [];
    },
    enabled: !!campaignId && !!uid,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return <GlassCard variant="soft" padding="md"><p className={styles.miCuentaVacia}>Cargando recibos…</p></GlassCard>;
  }
  if (recibos.length === 0) {
    return <GlassCard variant="soft" padding="md"><p className={styles.miCuentaVacia}>Aún no tienes recibos de cobro.</p></GlassCard>;
  }
  return (
    <GlassCard variant="soft" padding="md">
      <ul className={styles.recibosList}>
        {recibos.map((r) => {
          // El monto puede venir en céntimos PEN o USD según el método.
          const montoTxt =
            typeof r.montoCentimos === 'number'
              ? formatoPrecioPen(r.montoCentimos)
              : typeof r.montoUsd === 'number'
                ? formatoPrecioUsd(r.montoUsd)
                : (r.monto || '—');
          return (
            <li key={r.id} className={styles.reciboRow}>
              <span className={styles.reciboFecha}>{fechaLegible(r.fecha)}</span>
              <span className={styles.reciboMonto}>{montoTxt}</span>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

// ── Modal del FLUJO DE SUSCRIPCIÓN ───────────────────────────────────────────
// Pasos: (1) gate de login (prioriza Google) → (2) datos mínimos + consentimiento
// de cobro recurrente → (3) método de pago (Culqi Perú / PayPal internacional) →
// (4) éxito. Reutiliza signInWithGoogle() (web + nativo) y los botones de pago.
function ModalSuscripcion({ campaign, plan, origenApp, onClose, onSuscrito }) {
  const { user, userProfile } = useAuth();
  const toast = useGlobalToast();

  const [error, setError] = useState('');
  const [logueando, setLogueando] = useState(false);
  const [consentido, setConsentido] = useState(false);
  const [enPago, setEnPago] = useState(false); // avanzó del form al método de pago
  const [pendiente, setPendiente] = useState(false); // PayPal pendiente de 1er cobro

  // Prefill del formulario desde Google/perfil. correo autocompletado (no editable).
  const [datos, setDatos] = useState(() => {
    const dn = String(userProfile?.displayName || user?.displayName || '').trim();
    const partes = dn ? dn.split(/\s+/) : [];
    return {
      nombres: partes.length ? partes[0] : '',
      apellidos: partes.length > 1 ? partes.slice(1).join(' ') : '',
      telefono: userProfile?.phone || '',
      dni: userProfile?.dni || '',
      tipoDocumento: userProfile?.documentType || 'DNI',
      fechaNacimiento: '',
      pais: userProfile?.country || 'PE',
    };
  });

  // Paso: sin usuario → login; con usuario y sin haber avanzado → datos; tras
  // pulsar "Continuar" (con consentimiento marcado) → pago. Se usa un estado
  // explícito (enPago) para que marcar el checkbox NO salte solo al pago.
  const paso = !user ? 'login' : enPago ? 'pago' : 'datos';

  const correo = userProfile?.email || user?.email || '';
  const set = (campo) => (e) => setDatos((prev) => ({ ...prev, [campo]: e.target.value }));

  // Login con Google (reusa signInWithGoogle: web popup + nativo Capacitor).
  const handleGoogle = useCallback(async () => {
    setError('');
    setLogueando(true);
    const { error: e, errorCode } = await signInWithGoogle();
    setLogueando(false);
    if (errorCode === 'auth/cancelled') return; // el usuario cerró el selector
    if (e) setError(e);
  }, []);

  // Payload de datos para las callables (correo obligatorio del contrato).
  const datosPayload = useMemo(
    () => ({
      nombres: datos.nombres.trim(),
      apellidos: datos.apellidos.trim(),
      correo,
      telefono: datos.telefono.trim(),
      dni: datos.dni.trim(),
      tipoDocumento: datos.tipoDocumento,
      fechaNacimiento: datos.fechaNacimiento,
      pais: (datos.pais || '').trim(),
    }),
    [datos, correo],
  );

  // Avanza de "datos" a "pago": exige nombres + consentimiento de cobro recurrente.
  const continuarAPago = () => {
    setError('');
    if (!datos.nombres.trim()) {
      setError('Ingresa al menos tus nombres.');
      return;
    }
    if (!correo) {
      setError('No pudimos leer tu correo. Vuelve a iniciar sesión.');
      return;
    }
    if (!consentido) {
      setError('Debes autorizar el cobro automático para continuar.');
      return;
    }
    setEnPago(true); // avanza al paso de método de pago
  };

  const onOkPago = useCallback((data) => {
    void data;
    toast.success('¡Suscripción activada! Ya participas en los sorteos. 🎉');
    if (onSuscrito) onSuscrito();
  }, [toast, onSuscrito]);

  const onErrorPago = useCallback((msg) => {
    setError(msg || 'No se pudo completar la suscripción.');
  }, []);

  const onPendientePago = useCallback(() => {
    setPendiente(true);
  }, []);

  // Texto del consentimiento con el monto y periodicidad reales del plan.
  const cadaCuanto = plan.intervalo || 'mensual';

  return (
    <GlassModal
      open
      onClose={onClose}
      size="md"
      title={pendiente ? 'Casi listo' : `Suscribirme — ${plan.nombre}`}
    >
      {/* Resumen del plan siempre visible arriba */}
      {!pendiente && (
        <div className={styles.modalPlanResumen}>
          <span className={styles.modalPlanNombre}>{plan.nombre} · {plan.intervalo}</span>
          <span className={styles.modalPlanPrecio}>{formatoPrecioPen(plan.precioCentimos)}</span>
        </div>
      )}

      {error && <div className={styles.errorBox} style={{ marginTop: '0.8rem' }}>{error}</div>}

      {/* PASO PENDIENTE (PayPal aún no cobró el primer ciclo) */}
      {pendiente ? (
        <div className={styles.exitoBox}>
          <div className={styles.exitoEmoji} aria-hidden="true">⏳</div>
          <h3>Tu suscripción se está activando</h3>
          <p className={styles.stateText}>
            Se activará automáticamente cuando se confirme tu primer cobro. Te avisaremos
            por correo. ¡Gracias por suscribirte!
          </p>
          <GlassButton variant="primary" size="md" className={styles.btnCampana} onClick={onSuscrito}>
            Entendido
          </GlassButton>
        </div>
      ) : paso === 'login' ? (
        // ── PASO 1: gate de login (PRIORIZA Google) ──
        <div className={styles.modalPaso} style={{ marginTop: '1rem' }}>
          <p className={styles.stateText}>
            Inicia sesión para suscribirte y participar. Es rápido con Google.
          </p>
          <button type="button" className={styles.googleBtn} onClick={handleGoogle} disabled={logueando}>
            <GoogleIcon />
            {logueando ? 'Conectando…' : 'Continuar con Google'}
          </button>
        </div>
      ) : paso === 'datos' ? (
        // ── PASO 2: datos mínimos + consentimiento de cobro recurrente ──
        <div className={styles.modalPaso} style={{ marginTop: '1rem' }}>
          <div className={styles.formGrid}>
            <div className={styles.formRow2}>
              <label className={styles.formField}>
                <span>Nombres *</span>
                <input className={styles.formInput} value={datos.nombres} onChange={set('nombres')} required />
              </label>
              <label className={styles.formField}>
                <span>Fecha de nacimiento (opcional)</span>
                <input className={styles.formInput} type="date" value={datos.fechaNacimiento} onChange={set('fechaNacimiento')} />
              </label>
            </div>
            <label className={styles.formField}>
              <span>Correo</span>
              <input className={styles.formInput} type="email" value={correo} readOnly />
            </label>
          </div>

          {/* CONSENTIMIENTO EXPLÍCITO de cobro recurrente (obligatorio) */}
          <div className={styles.consentimiento}>
            <input
              id="consentimiento-cobro"
              type="checkbox"
              checked={consentido}
              onChange={(e) => setConsentido(e.target.checked)}
            />
            <label htmlFor="consentimiento-cobro">
              Autorizo el cobro automático de <strong>{formatoPrecioPen(plan.precioCentimos)}</strong>{' '}
              cada <strong>{plan.meses} mes{plan.meses === 1 ? '' : 'es'}</strong> ({cadaCuanto}) de forma
              recurrente hasta que yo cancele mi suscripción.
            </label>
          </div>

          <GlassButton
            variant="primary"
            size="lg"
            fullWidth
            className={styles.btnCampana}
            onClick={continuarAPago}
          >
            Continuar al pago
          </GlassButton>
        </div>
      ) : (
        // ── PASO 3: método de pago (Culqi Perú / PayPal internacional) ──
        <div className={styles.modalPaso} style={{ marginTop: '1rem' }}>
          <p className={styles.stateText}>
            Elige cómo pagar. El monto lo procesa el servidor de forma segura.
          </p>
          <div className={styles.metodos}>
            <CulqiSuscripcionButton
              campaignId={campaign.id}
              plan={plan}
              email={correo}
              datos={datosPayload}
              origenApp={origenApp}
              onOk={onOkPago}
              onError={onErrorPago}
            />
            <div className={styles.divisor}>o paga desde el extranjero</div>
            <PaypalSuscripcionButtons
              campaignId={campaign.id}
              plan={plan}
              datos={datosPayload}
              onOk={onOkPago}
              onError={onErrorPago}
              onPendiente={onPendientePago}
            />
          </div>
          <button type="button" className={styles.linkCancelar} onClick={onClose}>
            Cancelar
          </button>
        </div>
      )}
    </GlassModal>
  );
}

export default SuscripcionSorteoPage;
