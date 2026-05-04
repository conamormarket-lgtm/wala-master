import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import Button from '../../components/common/Button';
import { getGlobalAnalytics, getUserAnalytics, getUsersBaseList } from '../../services/adminAnalytics';
import { rebuildHistoricalAnalyticsSummary } from '../../services/adminAnalyticsBackfill';
import styles from './AdminUsuariosAnalyticsPage.module.css';

function fmtNumber(value) {
  return new Intl.NumberFormat('es-PE').format(Number(value || 0));
}

function fmtCurrency(value) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value || 0));
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

function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es-PE');
}

const AdminUsuariosAnalyticsPage = () => {
  const [tab, setTab] = useState('usuarios');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['admin-analytics-users'],
    queryFn: async () => {
      const { data, error } = await getUsersBaseList();
      if (error) throw new Error(error);
      return data;
    },
  });

  const globalQuery = useQuery({
    queryKey: ['admin-analytics-global'],
    queryFn: async () => {
      const { data, error } = await getGlobalAnalytics();
      if (error) throw new Error(error);
      return data;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const userInfoQuery = useQuery({
    queryKey: ['admin-analytics-user-detail', selectedUser?.uid, selectedUser?.email],
    queryFn: async () => {
      const { data, error } = await getUserAnalytics(selectedUser?.uid, selectedUser?.email);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!selectedUser,
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await rebuildHistoricalAnalyticsSummary();
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-analytics-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-analytics-global'] });
      if (selectedUser) {
        queryClient.invalidateQueries({ queryKey: ['admin-analytics-user-detail', selectedUser.uid, selectedUser.email] });
      }
    },
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const users = usersQuery.data || [];
    if (!q) return users;
    return users.filter((u) =>
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.dni || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [usersQuery.data, search]);

  const detail = userInfoQuery.data;
  const detailMetrics = detail?.metrics;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Usuarios y métricas</h1>
      <p className={styles.subtitle}>
        Vista completa por usuario y resumen general. Incluye métricas reales de navegación (desde ahora)
        y estimaciones históricas basadas en datos existentes.
      </p>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Dashboard en tiempo real</h2>
        {globalQuery.isLoading && <p className={styles.meta}>Cargando dashboard...</p>}
        {globalQuery.error && <p className={styles.error}>{globalQuery.error.message}</p>}
        {!!globalQuery.data && (
          <>
            <div className={styles.grid}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Usuarios (total histórico)</span>
                <span className={styles.metricValue}>{fmtNumber(globalQuery.data.totalRegisteredUsers)}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>En línea (con cuenta)</span>
                <span className={styles.metricValue}>{fmtNumber(globalQuery.data.realtimeActiveLoggedUsers)}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>En línea (sin cuenta)</span>
                <span className={styles.metricValue}>{fmtNumber(globalQuery.data.realtimeActiveVisitors)}</span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3 className={styles.sectionTitle}>Detalle de usuarios en línea</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Página actual</th>
                      <th>Dispositivo</th>
                      <th>Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(globalQuery.data.realtimeSessionsDetails || []).map((s) => (
                      <tr key={s.id}>
                        <td>
                          {s.hasAccount ? (
                            <span className={styles.badgeSuccess}>Cliente: {s.displayName || s.email || s.uid}</span>
                          ) : (
                            <span className={styles.badgeNeutral}>Visitante</span>
                          )}
                        </td>
                        <td>{s.lastPath}</td>
                        <td style={{ fontSize: '0.85rem' }}>{s.device} · {s.browser} · {s.platform}</td>
                        <td>
                          {(() => {
                            if (!s.referrer) return 'Directo';
                            try {
                              return new URL(s.referrer).hostname;
                            } catch (e) {
                              return s.referrer;
                            }
                          })()}
                        </td>
                      </tr>
                    ))}
                    {!(globalQuery.data.realtimeSessionsDetails || []).length && (
                      <tr>
                        <td colSpan="4" className={styles.empty}>Nadie en línea en este momento.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className={styles.meta}>
              Ventana realtime: últimos {Math.round((globalQuery.data.realtimeWindowMs || 0) / 60000)} minutos.
              Última actualización: {fmtDate(globalQuery.data.realtimeRefreshedAtMs)}.
            </p>
          </>
        )}
      </section>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'usuarios' ? styles.tabActive : ''}`}
            onClick={() => setTab('usuarios')}
          >
            Usuarios
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'general' ? styles.tabActive : ''}`}
            onClick={() => setTab('general')}
          >
            General y Geografía
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'ventas' ? styles.tabActive : ''}`}
            onClick={() => setTab('ventas')}
          >
            Ventas y Carritos
          </button>
        </div>
        {tab === 'usuarios' && (
          <input
            className={styles.search}
            placeholder="Buscar por nombre, DNI o correo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <Button
          variant="secondary"
          onClick={() => backfillMutation.mutate()}
          disabled={backfillMutation.isPending}
        >
          {backfillMutation.isPending ? 'Recalculando...' : 'Recalcular histórico estimado'}
        </Button>
      </div>

      {backfillMutation.error && (
        <div className={`${styles.card} ${styles.error}`}>
          Error de backfill: {backfillMutation.error.message}
        </div>
      )}
      {backfillMutation.isSuccess && (
        <div className={styles.card}>
          Histórico estimado recalculado. Usuarios actualizados: {fmtNumber(backfillMutation.data?.usersUpdated)}.
        </div>
      )}

      {tab === 'usuarios' && (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Listado de usuarios</h2>
          {usersQuery.isLoading && <p className={styles.meta}>Cargando usuarios...</p>}
          {usersQuery.error && <p className={styles.error}>{usersQuery.error.message}</p>}
          {!usersQuery.isLoading && !usersQuery.error && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>DNI/CE</th>
                    <th>Correo</th>
                    <th>Info</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.uid}>
                      <td>{u.displayName || '—'}</td>
                      <td>{u.dni || '—'}</td>
                      <td>{u.email || '—'}</td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedUser(u)}
                        >
                          Ver info
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p className={styles.empty}>No hay usuarios para mostrar.</p>}
            </div>
          )}
        </section>
      )}

      {tab === 'general' && (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Métricas generales</h2>
          {globalQuery.isLoading && <p className={styles.meta}>Cargando resumen general...</p>}
          {globalQuery.error && <p className={styles.error}>{globalQuery.error.message}</p>}
          {!!globalQuery.data && (
            <>
              <div className={styles.grid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Usuarios registrados</span>
                  <span className={styles.metricValue}>{fmtNumber(globalQuery.data.totalRegisteredUsers)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Identidades activas</span>
                  <span className={styles.metricValue}>{fmtNumber(globalQuery.data.activeIdentities)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Sesiones</span>
                  <span className={styles.metricValue}>{fmtNumber(globalQuery.data.totalSessions)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Eventos</span>
                  <span className={styles.metricValue}>{fmtNumber(globalQuery.data.totalEvents)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Tiempo total navegado</span>
                  <span className={styles.metricValue}>{fmtDuration(globalQuery.data.totalDwellMs)}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Tiempo promedio por sesión</span>
                  <span className={styles.metricValue}>{fmtDuration(globalQuery.data.avgDwellPerSessionMs)}</span>
                </div>
              </div>
              <div className={styles.listsGrid}>
                <div>
                  <h3 className={styles.sectionTitle}>Top rutas por visitas</h3>
                  <ul className={styles.list}>
                    {(globalQuery.data.topRoutesByViews || []).map((r) => (
                      <li key={r.path}>{r.path}: {fmtNumber(r.views)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className={styles.sectionTitle}>Top rutas por tiempo</h3>
                  <ul className={styles.list}>
                    {(globalQuery.data.topRoutesByDwell || []).map((r) => (
                      <li key={r.path}>{r.path}: {fmtDuration(r.dwellMs)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className={styles.sectionTitle}>Dispositivos</h3>
                  <ul className={styles.list}>
                    {(globalQuery.data.deviceStats?.topDevices || []).map((d) => (
                      <li key={d.name}>{d.name}: {fmtNumber(d.count)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className={styles.sectionTitle}>Navegadores</h3>
                  <ul className={styles.list}>
                    {(globalQuery.data.deviceStats?.topBrowsers || []).map((b) => (
                      <li key={b.name}>{b.name}: {fmtNumber(b.count)}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.listsGrid} style={{ marginTop: '2rem' }}>
                <div>
                  <h3 className={styles.sectionTitle}>Fuentes de Tráfico</h3>
                  {globalQuery.data.utmStats?.topSources?.length > 1 ? (
                    <div style={{ width: '100%', height: 250 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie 
                            data={globalQuery.data.utmStats.topSources} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={80} 
                            fill="#8884d8" 
                            label 
                          >
                            {
                              globalQuery.data.utmStats.topSources.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF'][index % 5]} />
                              ))
                            }
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className={styles.meta}>Solo tráfico directo por ahora.</p>}
                </div>
                <div>
                  <h3 className={styles.sectionTitle}>Regiones Geográficas</h3>
                  <ul className={styles.list}>
                    {(globalQuery.data.geographyStats?.topRegions || []).map((r) => (
                      <li key={r.name}>{r.name}: {fmtNumber(r.count)} visitantes</li>
                    ))}
                    {!(globalQuery.data.geographyStats?.topRegions?.length) && (
                      <li className={styles.meta}>Sin datos regionales aún.</li>
                    )}
                  </ul>
                </div>
              </div>
              {globalQuery.data.estimatedSummary?.isEstimated && (
                <p className={styles.meta}>
                  <span className={styles.pillEstimated}>Estimado</span>{' '}
                  Histórico general calculado con usuarios + pedidos ERP.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'ventas' && (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Embudo de Conversión (Funnel)</h2>
          {globalQuery.isLoading && <p className={styles.meta}>Cargando datos de ventas...</p>}
          {!!globalQuery.data && (
            <>
              <div style={{ width: '100%', height: 300, marginBottom: '2rem' }}>
                <ResponsiveContainer>
                  <BarChart
                    data={[
                      { name: 'Ven la tienda', count: globalQuery.data.funnelStats?.users?.views || 0, color: '#8884d8' },
                      { name: 'Añaden al Carrito', count: globalQuery.data.funnelStats?.users?.adds || 0, color: '#82ca9d' },
                      { name: 'Inician Pago', count: globalQuery.data.funnelStats?.users?.checkouts || 0, color: '#ffc658' },
                      { name: 'Compran', count: globalQuery.data.funnelStats?.users?.purchases || 0, color: '#ff8042' },
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {
                        [
                          { name: 'Ven la tienda', count: globalQuery.data.funnelStats?.users?.views || 0, color: '#8884d8' },
                          { name: 'Añaden al Carrito', count: globalQuery.data.funnelStats?.users?.adds || 0, color: '#82ca9d' },
                          { name: 'Inician Pago', count: globalQuery.data.funnelStats?.users?.checkouts || 0, color: '#ffc658' },
                          { name: 'Compran', count: globalQuery.data.funnelStats?.users?.purchases || 0, color: '#ff8042' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <h3 className={styles.sectionTitle}>Carritos Abandonados (Para Retargeting)</h3>
              <p className={styles.meta}>Usuarios que añadieron combos al carrito pero no completaron la compra.</p>
              <div className={styles.tableWrap} style={{ marginTop: '1rem' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Valor Estimado</th>
                      <th>Última Actividad</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(globalQuery.data.abandonedCarts || []).map((cart) => (
                      <tr key={cart.id}>
                        <td>{cart.displayName || cart.email || cart.uid || 'Visitante Anónimo'}</td>
                        <td>{fmtCurrency(cart.lastCartValue / 100)}</td>
                        <td>{fmtDate(cart.abandonedAtMs)}</td>
                        <td>
                          {cart.hasAccount && cart.displayName ? (
                             <a 
                               href={`https://wa.me/?text=Hola%20${encodeURIComponent(cart.displayName)},%20notamos%20que%20dejaste%20algo%20en%20tu%20carrito.%20Te%20regalamos%20un%20cup%C3%B3n!`} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               style={{ color: 'green', textDecoration: 'none', fontWeight: 'bold' }}
                             >
                               Contactar (WhatsApp)
                             </a>
                          ) : (
                             <span className={styles.meta}>Sin cuenta</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!(globalQuery.data.abandonedCarts || []).length && (
                      <tr>
                        <td colSpan="4" className={styles.empty}>No hay carritos abandonados recientes.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {selectedUser && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedUser(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.sectionTitle}>
                  {selectedUser.displayName || 'Usuario'} · {selectedUser.email || 'sin correo'}
                </h2>
                <p className={styles.meta}>DNI/CE: {selectedUser.dni || '—'}</p>
              </div>
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>Cerrar</Button>
            </div>

            {userInfoQuery.isLoading && <p className={styles.meta}>Cargando métricas del usuario...</p>}
            {userInfoQuery.error && <p className={styles.error}>{userInfoQuery.error.message}</p>}
            {detailMetrics && (
              <>
                <div className={styles.grid}>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Ingresos / sesiones</span>
                    <span className={styles.metricValue}>{fmtNumber(detailMetrics.totalSessions)}</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Page views</span>
                    <span className={styles.metricValue}>{fmtNumber(detailMetrics.totalPageViews)}</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Tiempo total</span>
                    <span className={styles.metricValue}>{fmtDuration(detailMetrics.totalDwellMs)}</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Tiempo promedio por sesión</span>
                    <span className={styles.metricValue}>{fmtDuration(detailMetrics.avgSessionMs)}</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Días activos</span>
                    <span className={styles.metricValue}>{fmtNumber(detailMetrics.activeDays)}</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Último acceso</span>
                    <span className={styles.metricValue}>{fmtDate(detailMetrics.lastAccessAtMs)}</span>
                  </div>
                </div>

                <div className={styles.listsGrid}>
                  <div>
                    <h3 className={styles.sectionTitle}>Top rutas por visitas</h3>
                    <ul className={styles.list}>
                      {(detailMetrics.topRoutesByViews || []).map((r) => (
                        <li key={r.path}>{r.path}: {fmtNumber(r.views)}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className={styles.sectionTitle}>Top rutas por tiempo</h3>
                    <ul className={styles.list}>
                      {(detailMetrics.topRoutesByDwell || []).map((r) => (
                        <li key={r.path}>{r.path}: {fmtDuration(r.dwellMs)}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {detail?.estimatedSummary?.isEstimated && (
                  <div className={styles.card}>
                    <h3 className={styles.sectionTitle}>Resumen histórico estimado</h3>
                    <p className={styles.meta}>
                      <span className={styles.pillEstimated}>Estimado</span> Este bloque se calcula con
                      usuarios + pedidos ERP para cubrir histórico previo sin tracking real.
                    </p>
                    <div className={styles.grid}>
                      <div className={styles.metricCard}>
                        <span className={styles.metricLabel}>Pedidos históricos</span>
                        <span className={styles.metricValue}>{fmtNumber(detail.estimatedSummary.orderCount)}</span>
                      </div>
                      <div className={styles.metricCard}>
                        <span className={styles.metricLabel}>Monto estimado</span>
                        <span className={styles.metricValue}>{fmtCurrency(detail.estimatedSummary.totalSpent)}</span>
                      </div>
                      <div className={styles.metricCard}>
                        <span className={styles.metricLabel}>Primera actividad estimada</span>
                        <span className={styles.metricValue}>{fmtDate(detail.estimatedSummary.firstOrderAtMs)}</span>
                      </div>
                      <div className={styles.metricCard}>
                        <span className={styles.metricLabel}>Última actividad estimada</span>
                        <span className={styles.metricValue}>{fmtDate(detail.estimatedSummary.lastOrderAtMs)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsuariosAnalyticsPage;
