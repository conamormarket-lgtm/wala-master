const fs = require('fs');

const originalPath = 'c:\\Users\\danie\\OneDrive\\Desktop\\Trabajo\\wala-master\\src\\pages\\admin\\AdminUsuariosAnalyticsPage.jsx';
let code = fs.readFileSync(originalPath, 'utf8');

// 1. Imports
code = code.replace(
  "import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';",
  "import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend, LineChart, Line } from 'recharts';"
);

// 2. MetricCard3Way helper
const helperCode = `
function MetricCard3Way({ label, metric, isDuration }) {
  if (!metric) return null;
  const valTotal = isDuration ? fmtDuration(metric.total) : fmtNumber(metric.total);
  const valApp = isDuration ? fmtDuration(metric.app) : fmtNumber(metric.app);
  const valWeb = isDuration ? fmtDuration(metric.web) : fmtNumber(metric.web);
  
  return (
    <div className={styles.metricCard}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{valTotal}</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #eaeaea' }}>
        <span>APP: <strong>{valApp}</strong></span>
        <span>WEB: <strong>{valWeb}</strong></span>
      </div>
    </div>
  );
}
`;
code = code.replace('const AdminUsuariosAnalyticsPage = () => {', helperCode + '\nconst AdminUsuariosAnalyticsPage = () => {');

// 3. State
const stateCode = `  const [tab, setTab] = useState('usuarios');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [dateRange, setDateRange] = useState({ label: 'Todo el tiempo', start: null, end: null });
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
`;
code = code.replace(/  const \[tab, setTab\] = useState\('usuarios'\);\n  const \[search, setSearch\] = useState\(''\);\n  const \[selectedUser, setSelectedUser\] = useState\(null\);/, stateCode);

// 4. Query
const queryCode = `  const globalQuery = useQuery({
    queryKey: ['admin-analytics-global', dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await getGlobalAnalytics({ startDateMs: dateRange.start, endDateMs: dateRange.end });
      if (error) throw new Error(error);
      return data;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });`;
code = code.replace(/  const globalQuery = useQuery\({[\s\S]*?refetchIntervalInBackground: true,\n  }\);/, queryCode);

// 5. Date Filter logic
const filterLogic = `
  const handlePreset = (label, days) => {
    if (days === null) {
      setDateRange({ label, start: null, end: null });
      return;
    }
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    if (days === 0) {
      start.setHours(0, 0, 0, 0);
    } else if (days === 1) {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);
    }
    setDateRange({ label, start: start.getTime(), end: end.getTime() });
  };

  const handleCustomRange = () => {
    if (!customStart || !customEnd) return;
    const s = new Date(customStart + 'T00:00:00').getTime();
    const e = new Date(customEnd + 'T23:59:59').getTime();
    setDateRange({ label: 'Personalizado', start: s, end: e });
  };
  
  const chartData = useMemo(() => {
    if (!globalQuery.data?.eventsForCharts) return [];
    const events = globalQuery.data.eventsForCharts;
    const byDay = new Map();
    events.forEach(e => {
      if (e.type !== 'page_view') return;
      const d = new Date(e.clientTsMs || e.createdAt);
      const key = \`\${d.getDate()}/\${d.getMonth()+1}\`;
      if (!byDay.has(key)) byDay.set(key, { name: key, total: 0, app: 0, web: 0, timestamp: d.setHours(0,0,0,0) });
      byDay.get(key).total++;
      if (e.clientType === 'APP') byDay.get(key).app++; else byDay.get(key).web++;
    });
    return Array.from(byDay.values()).sort((a,b) => a.timestamp - b.timestamp);
  }, [globalQuery.data?.eventsForCharts]);
`;
code = code.replace('const detail = userInfoQuery.data;', filterLogic + '\n  const detail = userInfoQuery.data;');

// 6. UI Filters
const uiFilters = `
      <div className={styles.card} style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{marginRight: '1rem'}}>Filtro de Fecha:</strong>
          <Button variant={dateRange.label === 'Hoy' ? 'primary' : 'secondary'} onClick={() => handlePreset('Hoy', 0)}>Hoy</Button>
          <Button variant={dateRange.label === 'Ayer' ? 'primary' : 'secondary'} onClick={() => handlePreset('Ayer', 1)}>Ayer</Button>
          <Button variant={dateRange.label === 'Últimos 7 días' ? 'primary' : 'secondary'} onClick={() => handlePreset('Últimos 7 días', 7)}>Últimos 7 días</Button>
          <Button variant={dateRange.label === 'Este mes' ? 'primary' : 'secondary'} onClick={() => handlePreset('Este mes', 30)}>Este mes</Button>
          <Button variant={dateRange.label === 'Todo el tiempo' ? 'primary' : 'secondary'} onClick={() => handlePreset('Todo el tiempo', null)}>Todo el tiempo</Button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className={styles.input} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          <span> - </span>
          <input type="date" className={styles.input} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          <Button variant="secondary" onClick={handleCustomRange}>Aplicar rango</Button>
          <span style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#666' }}>Mostrando: <strong>{dateRange.label}</strong></span>
        </div>
      </div>
`;
code = code.replace('      <section className={styles.card}>', uiFilters + '      <section className={styles.card}>');

// 7. Dashboard en tiempo real replacement (Metric cards)
const rtCards = `              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Usuarios (total histórico)</span>
                <span className={styles.metricValue}>{fmtNumber(globalQuery.data.totalRegisteredUsers)}</span>
              </div>
              <MetricCard3Way label="En línea (con cuenta)" metric={globalQuery.data.realtimeActiveLoggedUsers} />
              <MetricCard3Way label="En línea (sin cuenta)" metric={globalQuery.data.realtimeActiveVisitors} />`;
code = code.replace(/              <div className={styles\.metricCard}>\s*<span className={styles\.metricLabel}>Usuarios \(total histórico\)<\/span>[\s\S]*?<\/div>\s*<\/div>/, rtCards + '\n            </div>');

// 8. General metrics replacement
const generalCards = `                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Usuarios registrados</span>
                  <span className={styles.metricValue}>{fmtNumber(globalQuery.data.totalRegisteredUsers)}</span>
                </div>
                <MetricCard3Way label="Identidades activas" metric={globalQuery.data.activeIdentities} />
                <MetricCard3Way label="Sesiones" metric={globalQuery.data.totalSessions} />
                <MetricCard3Way label="Eventos" metric={globalQuery.data.totalEvents} />
                <MetricCard3Way label="Tiempo total navegado" metric={globalQuery.data.totalDwellMs} isDuration />
                <MetricCard3Way label="Tiempo promedio por sesión" metric={globalQuery.data.avgDwellPerSessionMs} isDuration />`;
code = code.replace(/                <div className={styles\.metricCard}>\s*<span className={styles\.metricLabel}>Usuarios registrados<\/span>[\s\S]*?<\/div>\s*<\/div>/, generalCards + '\n              </div>');

// 9. Add chart
const chartUI = `
              <div style={{ marginTop: '2rem' }}>
                <h3 className={styles.sectionTitle}>Tráfico a lo largo del tiempo (Page Views)</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#8884d8" name="Total" strokeWidth={3} />
                      <Line type="monotone" dataKey="app" stroke="#82ca9d" name="App" strokeWidth={2} />
                      <Line type="monotone" dataKey="web" stroke="#ffc658" name="Web" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
`;
code = code.replace('              <div className={styles.listsGrid}>', chartUI + '              <div className={styles.listsGrid}>');

// 10. Funnel update
const funnelChartData = `[
                      { name: 'Ven la tienda', Total: globalQuery.data.funnelStats?.users?.views?.total || 0, App: globalQuery.data.funnelStats?.users?.views?.app || 0, Web: globalQuery.data.funnelStats?.users?.views?.web || 0 },
                      { name: 'Añaden al Carrito', Total: globalQuery.data.funnelStats?.users?.adds?.total || 0, App: globalQuery.data.funnelStats?.users?.adds?.app || 0, Web: globalQuery.data.funnelStats?.users?.adds?.web || 0 },
                      { name: 'Inician Pago', Total: globalQuery.data.funnelStats?.users?.checkouts?.total || 0, App: globalQuery.data.funnelStats?.users?.checkouts?.app || 0, Web: globalQuery.data.funnelStats?.users?.checkouts?.web || 0 },
                      { name: 'Compran', Total: globalQuery.data.funnelStats?.users?.purchases?.total || 0, App: globalQuery.data.funnelStats?.users?.purchases?.app || 0, Web: globalQuery.data.funnelStats?.users?.purchases?.web || 0 },
                    ]`;

code = code.replace(/data=\{\[\s*\{\s*name:\s*'Ven la tienda'[\s\S]*?\}\,\s*\]\}/, \`data=\${funnelChartData}\`);

const funnelBars = \`
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Legend />
                    <Bar dataKey="Total" fill="#8884d8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="App" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Web" fill="#ffc658" radius={[4, 4, 0, 0]} />
\`;
code = code.replace(/<Tooltip cursor=\{\{fill: 'transparent'\}\} \/>[\s\S]*?<\/Bar>/, funnelBars);

fs.writeFileSync(originalPath, code, 'utf8');
console.log('Done!');
