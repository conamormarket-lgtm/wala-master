import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import GlassCard from '../../components/dashboard/GlassCard';
import KpiRow from '../../components/dashboard/KpiRow';
import { AuroraBackground, GlassButton, GlassInput, GlassModal, Badge, Reveal } from '../../components/ui';
import { getAppUsers } from '../../services/adminAppUsers';
import { getUserAnalytics } from '../../services/adminAnalytics';
import styles from './AdminUsuariosApp.module.css';

/* ============================================================================
 * AdminUsuariosApp — vista "Usuarios de la App".
 *
 * Muestra TODA la actividad capturada de la APP nativa (Capacitor, sesiones con
 * clientType === "APP") agrupada por usuario identificado. Fuente ligera:
 *   - getAppUsers()  → lista + KPIs (una sola query acotada a analytics_sessions
 *     con un único where clientType == 'APP'; enriquecida con
 *     portal_clientes_users por uid). POCAS lecturas por diseño.
 *   - getUserAnalytics(uid, email) → SOLO al abrir el modal de detalle. Devuelve
 *     el desglose { total, app, web } por ruta (columnas APP/WEB del modal), las
 *     pantallas más visitadas, el tiempo total y los últimos eventos.
 *
 * react-query v5 con staleTime alto para no releer en cada montaje/enfoque.
 * Estética del sistema de diseño (GlassCard, KpiRow, GlassModal, Badge).
 * ========================================================================== */

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

/* ------------------------------ formateadores ------------------------------ */

function fmtInt(value) {
  return new Intl.NumberFormat('es-PE').format(Number(value || 0));
}

function fmtDuration(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDateTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* Tiempo relativo simple para la última actividad ("hace 5 min", "hace 2 h"). */
function fmtRelativo(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 0) return fmtDateTime(ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return fmtDateTime(ms);
}

/* Bandera emoji a partir del ISO-3166 alpha-2 (p.ej. "PE" → 🇵🇪). Tolerante:
 * si el código no es válido, devolvemos el propio código o "—". */
function bandera(code) {
  const cc = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return code || '—';
  const base = 0x1f1e6;
  const emoji = String.fromCodePoint(
    base + (cc.charCodeAt(0) - 65),
    base + (cc.charCodeAt(1) - 65)
  );
  return `${emoji} ${cc}`;
}

/* Ruta legible acortada para tablas/eventos. */
function shortPath(path) {
  if (!path) return '—';
  const clean = String(path).split('?')[0].split('#')[0];
  return clean.length > 40 ? `${clean.slice(0, 38)}…` : clean;
}

/* ------------------------------ modal de detalle ------------------------------ */

function DetalleUsuario({ user, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['app-user-detail', user.uid, user.email],
    queryFn: async () => {
      const { data: d, error: e } = await getUserAnalytics(user.uid, user.email);
      if (e) throw new Error(e);
      return d;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min: caché en la nube, sin relecturas al reenfocar
  });

  const metrics = data?.metrics;
  const routesViews = metrics?.topRoutesByViews || [];
  const routesDwell = metrics?.topRoutesByDwell || [];
  const recentEvents = data?.recentEvents || [];

  return (
    <GlassModal
      open
      onClose={onClose}
      size="lg"
      title={user.displayName || user.email || 'Usuario de la app'}
    >
      <div className={styles.modalHead}>
        {user.email && <span className={styles.modalMail}>{user.email}</span>}
        {user.phone && <span className={styles.modalMail}>Tel: {user.phone}</span>}
      </div>

      <p className={styles.modalNote}>
        Esta es la actividad capturada de la app (y web) de este usuario. Las
        columnas <strong>APP</strong> y <strong>WEB</strong> separan lo que hizo
        desde la aplicación nativa (Capacitor) de lo que hizo en el navegador.
      </p>

      {isLoading && <p className={styles.loading}>Cargando actividad del usuario…</p>}
      {error && <p className={styles.modalError}>Error: {error.message}</p>}

      {metrics && (
        <>
          {/* Métricas resumen del usuario */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Sesiones</span>
              <span className={styles.metricValue}>{fmtInt(metrics.totalSessions)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Páginas vistas</span>
              <span className={styles.metricValue}>{fmtInt(metrics.totalPageViews)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Tiempo total</span>
              <span className={styles.metricValue}>{fmtDuration(metrics.totalDwellMs)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Tiempo medio / sesión</span>
              <span className={styles.metricValue}>{fmtDuration(metrics.avgSessionMs)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Días activos</span>
              <span className={styles.metricValue}>{fmtInt(metrics.activeDays)}</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Último acceso</span>
              <span className={styles.metricValue} style={{ fontSize: '0.95rem' }}>
                {fmtDateTime(metrics.lastAccessAtMs)}
              </span>
            </div>
          </div>

          {/* Pantallas más visitadas con desglose APP/WEB (views: {total,app,web}) */}
          <h3 className={styles.sectionTitle}>Pantallas más visitadas</h3>
          {routesViews.length === 0 ? (
            <p className={styles.empty}>Sin páginas vistas registradas.</p>
          ) : (
            <table className={styles.breakTable}>
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th>Total</th>
                  <th>APP</th>
                  <th>WEB</th>
                </tr>
              </thead>
              <tbody>
                {routesViews.map((r) => (
                  <tr key={r.path}>
                    <td className={styles.pathCol} title={r.path}>{shortPath(r.path)}</td>
                    <td>{fmtInt(r.views?.total)}</td>
                    <td className={styles.colApp}>{fmtInt(r.views?.app)}</td>
                    <td className={styles.colWeb}>{fmtInt(r.views?.web)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Rutas con más permanencia, con desglose APP/WEB (dwellMs: {total,app,web}) */}
          <h3 className={styles.sectionTitle}>Rutas con más permanencia</h3>
          {routesDwell.length === 0 ? (
            <p className={styles.empty}>Sin tiempos de permanencia registrados.</p>
          ) : (
            <table className={styles.breakTable}>
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th>Total</th>
                  <th>APP</th>
                  <th>WEB</th>
                </tr>
              </thead>
              <tbody>
                {routesDwell.map((r) => (
                  <tr key={r.path}>
                    <td className={styles.pathCol} title={r.path}>{shortPath(r.path)}</td>
                    <td>{fmtDuration(r.dwellMs?.total)}</td>
                    <td className={styles.colApp}>{fmtDuration(r.dwellMs?.app)}</td>
                    <td className={styles.colWeb}>{fmtDuration(r.dwellMs?.web)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Últimos eventos capturados */}
          <h3 className={styles.sectionTitle}>Últimos eventos</h3>
          {recentEvents.length === 0 ? (
            <p className={styles.empty}>Sin eventos recientes.</p>
          ) : (
            <ul className={styles.events}>
              {recentEvents.slice(0, 25).map((ev, i) => (
                <li key={ev.id || `${ev.type}-${i}`} className={styles.eventItem}>
                  <span className={styles.eventType}>{ev.type}</span>
                  <span className={styles.eventPath}>{shortPath(ev.path)}</span>
                  <span className={styles.eventTime}>
                    {fmtDateTime(ev.clientTsMs || (ev.createdAt?.toMillis?.() ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </GlassModal>
  );
}

/* ------------------------------ página ------------------------------ */

export default function AdminUsuariosApp() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin-app-users'],
    queryFn: async () => {
      const { data: d, error: e } = await getAppUsers({ max: 500 });
      if (e) throw new Error(e);
      return d;
    },
    // Caché en la nube con frescura alta: evitamos releer analytics_sessions en
    // cada montaje/enfoque (regla POCAS lecturas del panel).
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const users = data?.users || [];
  const kpis = data?.kpis;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.countryCode || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const kpiItems = useMemo(
    () => [
      { label: 'Usuarios app únicos', value: kpis?.appUsersUnique || 0, format: fmtInt, accent: '#6D28D9', icon: '📱' },
      { label: 'Sesiones de la app', value: kpis?.appSessions || 0, format: fmtInt, accent: '#8B5CF6', icon: '📊' },
      { label: 'Sesiones anónimas (app)', value: kpis?.anonAppSessions || 0, format: fmtInt, accent: '#10B981', icon: '👤' },
      {
        label: 'Última actividad',
        value: kpis?.lastActivityMs || 0,
        format: (v) => (v ? fmtRelativo(v) : '—'),
        accent: '#F59E0B',
        icon: '⏱️',
      },
    ],
    [kpis]
  );

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={styles.page}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.5, pointerEvents: 'none' }}>
        <AuroraBackground />
      </div>

      <motion.div
        className={styles.content}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Cabecera */}
        <motion.header className={styles.header} variants={itemVariants}>
          <div>
            <h1 className={styles.title}>📱 Usuarios de la App</h1>
            <p className={styles.subtitle}>
              Toda la actividad capturada de la aplicación nativa (Capacitor). Cada
              fila es un usuario identificado que ha usado la app; toca una fila para
              ver su detalle con el desglose APP/WEB.
              {lastUpdated ? ` · actualizado ${lastUpdated}` : ''}
            </p>
          </div>
          <div className={styles.headerControls}>
            <GlassButton
              variant="glass"
              size="sm"
              onClick={() => refetch()}
              loading={isFetching}
            >
              Actualizar
            </GlassButton>
          </div>
        </motion.header>

        {error && <div className={styles.errorBox}>Error al cargar: {error.message}</div>}
        {isLoading && !data && <div className={styles.loading}>Cargando usuarios de la app…</div>}

        {/* KPIs */}
        <Reveal>
          <KpiRow items={kpiItems} />
        </Reveal>

        {/* Tabla de usuarios */}
        <motion.div variants={itemVariants}>
          <GlassCard
            title="Usuarios identificados"
            subtitle="Ordenados por última actividad en la app"
            actions={
              <span className={styles.count}>
                {fmtInt(filtered.length)} de {fmtInt(users.length)}
              </span>
            }
          >
            <div className={styles.toolbar}>
              <div className={styles.searchWrap}>
                <GlassInput
                  placeholder="Buscar por nombre, correo, teléfono o país"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar usuarios de la app"
                />
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Sesiones APP</th>
                    <th>Última actividad</th>
                    <th>Dispositivo / SO</th>
                    <th>País</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.uid}
                      className={styles.row}
                      onClick={() => setSelected(u)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(u); } }}
                    >
                      <td>
                        <span className={styles.userCell}>
                          <span className={styles.userName}>
                            {u.displayName || 'Sin nombre'}
                            {!u.enriched && (
                              <Badge tone="neutral" variant="soft" size="sm" style={{ marginLeft: 6 }}>
                                sin ficha
                              </Badge>
                            )}
                          </span>
                          <span className={styles.userMail}>{u.email || u.uid}</span>
                        </span>
                      </td>
                      <td className={styles.numCell}>{fmtInt(u.appSessions)}</td>
                      <td>{fmtRelativo(u.lastActivityMs)}</td>
                      <td className={styles.deviceCell}>
                        {u.device || '—'}
                        {u.os ? <span className={styles.muted}> · {u.os}</span> : null}
                      </td>
                      <td>{u.countryCode ? bandera(u.countryCode) : <span className={styles.muted}>—</span>}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={5} className={styles.empty}>
                        {users.length === 0
                          ? 'Aún no hay actividad de la app registrada.'
                          : 'Ningún usuario coincide con la búsqueda.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      {selected && (
        <DetalleUsuario user={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
