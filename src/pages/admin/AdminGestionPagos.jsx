import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getMessage, setMessage } from '../../services/messages';
import { createDocument } from '../../services/firebase/firestore';
import { getEnlacesPago } from '../../services/enlacesPago';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  Badge,
  Reveal,
} from '../../components/ui';
import KpiRow from '../../components/dashboard/KpiRow';
import TrendChart from '../../components/dashboard/charts/TrendChart';
import styles from './AdminGestionPagos.module.css';

/* =========================================================================
   AdminGestionPagos — MÓDULO UNIFICADO "Gestión de Pagos"
   -------------------------------------------------------------------------
   Reúne en UNA sola página, con estética de dashboard, tres cosas que antes
   vivían separadas:

     (a) CONFIGURACIÓN de métodos de pago  — replica AdminPagos.jsx
         (Yape / Plin / WhatsApp de pagos vía messages.js).
     (b) GENERAR ENLACE                     — replica AdminGeneradorPagos.jsx
         (crea doc en "enlaces_pago" y muestra la URL /pago-rapido/{id}).
     (c) HISTORIAL + ANALÍTICAS (NUEVO)     — lee "enlaces_pago" (POCAS
         lecturas, react-query) y muestra KPIs, un gráfico y una tabla
         filtrable de TODOS los enlaces generados.

   Regla de datos: nada de localStorage para estado; la caché vive en la nube
   (react-query con staleTime alto). La analítica se calcula en cliente sobre
   un único snapshot acotado por límite.
   ========================================================================= */

const CONFIG_INICIAL = {
  yape_number: '',
  yape_name: '',
  plin_number: '',
  plin_name: '',
  whatsapp_pagos: '',
  whatsapp_pagos_text:
    'Hola, quiero pagar mi saldo pendiente del pedido *#{id}*. Adjunto mi comprobante por S/ *{monto}*.',
};

const WA_TEXT_DEFAULT = CONFIG_INICIAL.whatsapp_pagos_text;

/* Formateadores locales (mismo estilo es-PE del panel). */
const fmtInt = (v) => new Intl.NumberFormat('es-PE').format(Math.round(Number(v) || 0));

const fmtMoneda = (monto, moneda) => {
  if (monto == null) return '—';
  const simbolo = moneda === 'USD' ? '$' : moneda === 'PEN' ? 'S/' : '';
  return `${simbolo} ${Number(monto).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
};

const fmtFechaHora = (ms) => {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* Duración legible (para el "tiempo créado→pagado" y su promedio). */
const fmtDuracion = (ms) => {
  if (ms == null) return '—';
  const total = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

/* Clave DD/MM a partir de epoch ms (para agrupar por día en el gráfico). */
const claveDia = (ms) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const TABS = [
  { id: 'historial', label: '📊 Historial y analíticas' },
  { id: 'generar', label: '🔗 Generar enlace' },
  { id: 'config', label: '⚙️ Configuración' },
];

export default function AdminGestionPagos() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('historial');

  return (
    <div className={styles.page}>
      {/* Fondo con orbes difuminados (estética de dashboard). */}
      <div className={styles.bg} aria-hidden="true">
        <span className={`${styles.orb} ${styles.orb1}`} />
        <span className={`${styles.orb} ${styles.orb2}`} />
        <span className={`${styles.orb} ${styles.orb3}`} />
      </div>

      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>💳 Gestión de Pagos</h1>
            <p className={styles.subtitle}>
              Configura tus métodos de cobro, genera enlaces de pago y analiza su rendimiento en un solo lugar.
            </p>
          </div>
          <nav className={styles.tabs} aria-label="Secciones de gestión de pagos">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ''}`}
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        {tab === 'historial' && <SeccionHistorial />}
        {tab === 'generar' && <SeccionGenerar queryClient={queryClient} onCambioTab={setTab} />}
        {tab === 'config' && <SeccionConfig queryClient={queryClient} />}
      </div>
    </div>
  );
}

/* =========================================================================
   (c) HISTORIAL + ANALÍTICAS
   ========================================================================= */
function SeccionHistorial() {
  // Lectura ÚNICA acotada por límite, cacheada con react-query (staleTime alto).
  // POCAS lecturas: toda la analítica se deriva en cliente de este snapshot.
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['enlaces-pago', { max: 300 }],
    queryFn: async () => {
      const { data: enlaces, error: err } = await getEnlacesPago({ max: 300 });
      if (err) throw new Error(err);
      return enlaces;
    },
    staleTime: 5 * 60 * 1000, // 5 min frescos → navegar no re-consulta
    gcTime: 30 * 60 * 1000,
  });

  const enlaces = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  /* ----- Filtros (estado local; NADA en localStorage) ----- */
  const [fEstado, setFEstado] = useState('todos'); // todos | pendiente | pagado
  const [fMetodo, setFMetodo] = useState('todos'); // todos | culqi | paypal
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [copiadoId, setCopiadoId] = useState(null);

  // Rango de fechas → epoch ms (hasta incluye el día completo).
  const desdeMs = fDesde ? new Date(`${fDesde}T00:00:00`).getTime() : null;
  const hastaMs = fHasta ? new Date(`${fHasta}T23:59:59.999`).getTime() : null;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enlaces.filter((e) => {
      if (fEstado !== 'todos' && e.estado !== fEstado) return false;
      if (fMetodo !== 'todos' && e.metodo !== fMetodo) return false;
      if (desdeMs != null && (e.createdMs == null || e.createdMs < desdeMs)) return false;
      if (hastaMs != null && (e.createdMs == null || e.createdMs > hastaMs)) return false;
      if (q && !e.concepto.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enlaces, fEstado, fMetodo, desdeMs, hastaMs, busqueda]);

  /* ----- KPIs y agregados (sobre el conjunto FILTRADO, datos validados) ----- */
  const stats = useMemo(() => {
    const generados = filtrados.length;
    const pagados = filtrados.filter((e) => e.estado === 'pagado');
    const numPagados = pagados.length;
    const conversion = generados > 0 ? (numPagados / generados) * 100 : 0;

    // Monto cobrado (solo enlaces PAGADOS con monto válido), separado por moneda.
    let cobradoPEN = 0;
    let cobradoUSD = 0;
    pagados.forEach((e) => {
      if (e.monto == null) return;
      if (e.moneda === 'PEN') cobradoPEN += e.monto;
      else if (e.moneda === 'USD') cobradoUSD += e.monto;
    });

    // Tiempo promedio de pago (créado→pagado), solo con tiempos válidos.
    const tiempos = pagados.map((e) => e.tiempoPagoMs).filter((t) => t != null);
    const tiempoPromedio =
      tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;

    return { generados, numPagados, conversion, cobradoPEN, cobradoUSD, tiempoPromedio };
  }, [filtrados]);

  // Texto del monto cobrado combinando ambas monedas de forma honesta.
  const cobradoLabel = useMemo(() => {
    const partes = [];
    if (stats.cobradoPEN > 0) partes.push(fmtMoneda(stats.cobradoPEN, 'PEN'));
    if (stats.cobradoUSD > 0) partes.push(fmtMoneda(stats.cobradoUSD, 'USD'));
    return partes.length ? partes.join(' · ') : 'S/ 0.00';
  }, [stats.cobradoPEN, stats.cobradoUSD]);

  const kpis = useMemo(
    () => [
      { label: 'Enlaces generados', value: stats.generados, accent: '#6D28D9' },
      { label: 'Enlaces pagados', value: stats.numPagados, accent: '#10B981' },
      {
        label: 'Tasa de conversión',
        value: stats.conversion,
        format: (v) => `${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`,
        accent: '#EC4899',
        info: 'Enlaces pagados ÷ enlaces generados en el conjunto filtrado.',
      },
      {
        label: 'Monto cobrado',
        value: stats.cobradoPEN + stats.cobradoUSD,
        format: () => cobradoLabel,
        accent: '#F59E0B',
        info: 'Suma de los enlaces PAGADOS, separada por moneda (PEN vía Culqi, USD vía PayPal).',
      },
      {
        label: 'Tiempo prom. de pago',
        value: stats.tiempoPromedio || 0,
        format: () => (stats.tiempoPromedio == null ? '—' : fmtDuracion(stats.tiempoPromedio)),
        accent: '#0EA5E9',
        info: 'Promedio de tiempo entre crear el enlace y confirmarse el pago.',
      },
    ],
    [stats, cobradoLabel],
  );

  /* ----- Serie diaria: generados vs pagados por día (sobre lo filtrado) ----- */
  const serieDiaria = useMemo(() => {
    const porDia = new Map();
    const asegurar = (key, ts) => {
      if (!porDia.has(key)) porDia.set(key, { name: key, generados: 0, pagados: 0, ts });
      return porDia.get(key);
    };
    filtrados.forEach((e) => {
      if (e.createdMs != null) {
        asegurar(claveDia(e.createdMs), e.createdMs).generados += 1;
      }
      // El pagado se cuenta el día en que se PAGÓ (o el de creación si no hay sello).
      if (e.estado === 'pagado') {
        const ms = e.pagadoMs ?? e.createdMs;
        if (ms != null) asegurar(claveDia(ms), ms).pagados += 1;
      }
    });
    return [...porDia.values()].sort((a, b) => a.ts - b.ts);
  }, [filtrados]);

  const serieChart = useMemo(
    () => [
      { key: 'generados', name: 'Generados', color: '#6D28D9' },
      { key: 'pagados', name: 'Pagados', color: '#10B981' },
    ],
    [],
  );

  const copiarUrl = async (id) => {
    const url = `${window.location.origin}/pago-rapido/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId((cur) => (cur === id ? null : cur)), 1600);
    } catch {
      // Silencioso: si el portapapeles falla, no rompemos la UI.
    }
  };

  const limpiarFiltros = () => {
    setFEstado('todos');
    setFMetodo('todos');
    setFDesde('');
    setFHasta('');
    setBusqueda('');
  };

  const hayFiltros =
    fEstado !== 'todos' || fMetodo !== 'todos' || !!fDesde || !!fHasta || !!busqueda.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'grid', gap: '1.1rem' }}
    >
      {error && (
        <div className={styles.errorBox}>
          Error al cargar los enlaces: {error.message}
        </div>
      )}

      {/* KPIs */}
      <Reveal>
        <KpiRow items={kpis} />
      </Reveal>

      {/* Gráfico: generados vs pagados por día */}
      <Reveal delay={0.05}>
        <GlassCard animate={false}>
          <div className={styles.chartHead}>
            <div>
              <h2 className={styles.blockTitle} style={{ margin: 0 }}>Actividad por día</h2>
              <p className={styles.subtitle} style={{ margin: 0 }}>
                Enlaces generados vs pagados
              </p>
            </div>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#6D28D9' }} />
                Generados
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#10B981' }} />
                Pagados
              </span>
            </div>
          </div>
          <TrendChart
            data={serieDiaria}
            series={serieChart}
            xKey="name"
            height={260}
            formatY={(v) => fmtInt(v)}
            emptyText="Aún no hay enlaces en el rango seleccionado."
          />
        </GlassCard>
      </Reveal>

      {/* Filtros + tabla */}
      <Reveal delay={0.1}>
        <GlassCard
          animate={false}
          title="Historial de enlaces"
          subtitle={`${fmtInt(filtrados.length)} de ${fmtInt(enlaces.length)} enlaces`}
          actions={
            <GlassButton
              variant="glass"
              size="sm"
              onClick={() => refetch()}
              loading={isFetching}
            >
              Actualizar
            </GlassButton>
          }
        >
          <div className={styles.filters}>
            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Estado</span>
              <select
                className={styles.control}
                value={fEstado}
                onChange={(e) => setFEstado(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="pagado">Pagados</option>
              </select>
            </label>

            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Método</span>
              <select
                className={styles.control}
                value={fMetodo}
                onChange={(e) => setFMetodo(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="culqi">Culqi (PEN)</option>
                <option value="paypal">PayPal (USD)</option>
              </select>
            </label>

            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Desde</span>
              <input
                type="date"
                className={styles.control}
                value={fDesde}
                onChange={(e) => setFDesde(e.target.value)}
              />
            </label>

            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Hasta</span>
              <input
                type="date"
                className={styles.control}
                value={fHasta}
                onChange={(e) => setFHasta(e.target.value)}
              />
            </label>

            <label className={`${styles.filterField} ${styles.grow}`}>
              <span className={styles.filterLabel}>Buscar concepto</span>
              <input
                type="text"
                className={styles.control}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej. Envío a España"
              />
            </label>

            {hayFiltros && (
              <GlassButton variant="ghost" size="sm" onClick={limpiarFiltros}>
                Limpiar
              </GlassButton>
            )}
          </div>

          {isLoading ? (
            <p className={styles.loading}>Cargando enlaces…</p>
          ) : filtrados.length === 0 ? (
            <p className={styles.empty}>
              {enlaces.length === 0
                ? 'Todavía no se ha generado ningún enlace de pago.'
                : 'Ningún enlace coincide con los filtros actuales.'}
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th className={styles.num}>Monto</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th>Creado</th>
                    <th>Pagado</th>
                    <th>Tiempo de pago</th>
                    <th>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((e) => (
                    <tr key={e.id}>
                      <td className={styles.concepto} title={e.concepto}>
                        {e.concepto || '—'}
                      </td>
                      <td className={styles.num}>{fmtMoneda(e.monto, e.moneda)}</td>
                      <td className={styles.metodoTag}>
                        {e.metodo === 'culqi'
                          ? 'Culqi'
                          : e.metodo === 'paypal'
                            ? 'PayPal'
                            : '—'}
                      </td>
                      <td>
                        <Badge
                          tone={e.estado === 'pagado' ? 'success' : 'warning'}
                          variant="soft"
                          size="sm"
                          dot
                        >
                          {e.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                      </td>
                      <td>{fmtFechaHora(e.createdMs)}</td>
                      <td>{e.estado === 'pagado' ? fmtFechaHora(e.pagadoMs) : '—'}</td>
                      <td>{fmtDuracion(e.tiempoPagoMs)}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.copyBtn}
                          onClick={() => copiarUrl(e.id)}
                        >
                          {copiadoId === e.id ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </Reveal>
    </motion.div>
  );
}

/* =========================================================================
   (b) GENERAR ENLACE — replica AdminGeneradorPagos.jsx
   ========================================================================= */
function SeccionGenerar({ queryClient }) {
  const [concepto, setConcepto] = useState('');
  const [moneda, setMoneda] = useState('PEN');
  const [monto, setMonto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enlaceGenerado, setEnlaceGenerado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!concepto.trim() || !monto || isNaN(monto) || Number(monto) <= 0) {
      setError('Por favor, ingresa un concepto válido y un monto mayor a 0.');
      return;
    }

    setLoading(true);
    setError(null);
    setEnlaceGenerado(null);

    // MISMA lógica que AdminGeneradorPagos.jsx: crea el doc en "enlaces_pago"
    // con montoPEN|montoUSD por retrocompat y estado "pendiente".
    const payload = {
      concepto: concepto.trim(),
      moneda,
      monto: Number(monto),
      ...(moneda === 'USD' ? { montoUSD: Number(monto) } : { montoPEN: Number(monto) }),
      estado: 'pendiente',
    };

    const { id, error: dbError } = await createDocument('enlaces_pago', payload);

    if (dbError) {
      setError(`Error al crear el enlace: ${dbError}`);
    } else if (id) {
      // PEN → Culqi, USD → PayPal (esa lógica vive en /pago-rapido/{id}).
      setEnlaceGenerado(`${window.location.origin}/pago-rapido/${id}`);
      setConcepto('');
      setMonto('');
      // Invalida el historial para que el enlace nuevo aparezca al volver a esa pestaña.
      queryClient.invalidateQueries({ queryKey: ['enlaces-pago'] });
    }

    setLoading(false);
  };

  const copiar = async () => {
    if (!enlaceGenerado) return;
    try {
      await navigator.clipboard.writeText(enlaceGenerado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* silencioso */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Reveal>
        <GlassCard
          animate={false}
          title="Generar enlace de pago"
          subtitle="Crea un enlace único para cobrar conceptos que no son pedidos de la tienda (saldos extra, envíos internacionales, etc.)."
        >
          <form onSubmit={handleSubmit} className={styles.form}>
            <GlassInput
              label="Concepto del pago"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Diferencia de envío a España"
              required
            />

            <div className={styles.formGrid}>
              <GlassInput
                as="select"
                label="Moneda"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
              >
                <option value="PEN">Soles (S/) · Culqi</option>
                <option value="USD">Dólares ($) · PayPal</option>
              </GlassInput>

              <GlassInput
                label="Monto"
                type="number"
                step="0.01"
                min="0.10"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                icon={moneda === 'PEN' ? 'S/' : '$'}
                required
              />
            </div>

            {error && <div className={styles.errMsg}>{error}</div>}

            <div className={styles.actionsRow}>
              <GlassButton type="submit" variant="primary" loading={loading}>
                Generar enlace seguro
              </GlassButton>
              <span className={styles.subtitle} style={{ margin: 0 }}>
                Los cobros en Soles usan Culqi; en Dólares, PayPal.
              </span>
            </div>
          </form>

          {enlaceGenerado && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className={styles.okMsg}>
                ✓ Enlace generado con éxito. Envíaselo a tu cliente.
              </div>
              <div className={styles.linkBox}>
                <input
                  type="text"
                  readOnly
                  value={enlaceGenerado}
                  className={styles.linkInput}
                  onFocus={(e) => e.target.select()}
                />
                <GlassButton variant="glass" size="sm" onClick={copiar}>
                  {copiado ? '✓ Copiado' : 'Copiar'}
                </GlassButton>
              </div>
            </div>
          )}
        </GlassCard>
      </Reveal>
    </motion.div>
  );
}

/* =========================================================================
   (a) CONFIGURACIÓN de métodos de pago — replica AdminPagos.jsx
   ========================================================================= */
function SeccionConfig({ queryClient }) {
  const [config, setConfig] = useState(CONFIG_INICIAL);

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['admin-pagos-config'],
    queryFn: async () => {
      const [yapeNum, yapeName, plinNum, plinName, waPagos, waText] = await Promise.all([
        getMessage('yape_number'),
        getMessage('yape_name'),
        getMessage('plin_number'),
        getMessage('plin_name'),
        getMessage('whatsapp_number_pagos'),
        getMessage('whatsapp_text_pagos'),
      ]);

      const waFallback = await getMessage('whatsapp_number_cuenta');

      return {
        yape_number: yapeNum.data?.trim() || '',
        yape_name: yapeName.data?.trim() || '',
        plin_number: plinNum.data?.trim() || '',
        plin_name: plinName.data?.trim() || '',
        whatsapp_pagos: waPagos.data?.trim() || waFallback.data?.trim() || '',
        whatsapp_pagos_text: waText.data || WA_TEXT_DEFAULT,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (savedConfig) setConfig(savedConfig);
  }, [savedConfig]);

  const saveMutation = useMutation({
    mutationFn: async (updated) => {
      await Promise.all([
        setMessage('yape_number', updated.yape_number?.trim() || ''),
        setMessage('yape_name', updated.yape_name?.trim() || ''),
        setMessage('plin_number', updated.plin_number?.trim() || ''),
        setMessage('plin_name', updated.plin_name?.trim() || ''),
        setMessage('whatsapp_number_pagos', updated.whatsapp_pagos?.trim() || ''),
        setMessage('whatsapp_text_pagos', updated.whatsapp_pagos_text || ''),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pagos-config'] });
      queryClient.invalidateQueries({ queryKey: ['user-pagos-config'] });
    },
  });

  const handleChange = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(config);
  };

  if (isLoading) {
    return <p className={styles.loading}>Cargando configuración…</p>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.1rem' }}>
        {/* Yape */}
        <Reveal>
          <GlassCard animate={false} title="Configuración de Yape">
            <div className={styles.form}>
              <GlassInput
                label="Número de Yape"
                value={config.yape_number}
                onChange={(e) => handleChange('yape_number', e.target.value)}
                placeholder="Ej: 987 654 321"
              />
              <GlassInput
                label="Nombre del titular (recomendado)"
                value={config.yape_name}
                onChange={(e) => handleChange('yape_name', e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>
          </GlassCard>
        </Reveal>

        {/* Plin */}
        <Reveal delay={0.05}>
          <GlassCard animate={false} title="Configuración de Plin">
            <div className={styles.form}>
              <GlassInput
                label="Número de Plin (déjalo vacío si no usas Plin)"
                value={config.plin_number}
                onChange={(e) => handleChange('plin_number', e.target.value)}
                placeholder="Ej: 987 654 321"
              />
              <GlassInput
                label="Nombre del titular"
                value={config.plin_name}
                onChange={(e) => handleChange('plin_name', e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>
          </GlassCard>
        </Reveal>

        {/* WhatsApp de pagos */}
        <Reveal delay={0.1}>
          <GlassCard
            animate={false}
            title="Recepción de comprobantes (WhatsApp)"
            subtitle="Número al que tus clientes enviarán sus comprobantes cuando paguen un saldo."
          >
            <div className={styles.form}>
              <GlassInput
                label="Número de WhatsApp para validar pagos"
                value={config.whatsapp_pagos}
                onChange={(e) => handleChange('whatsapp_pagos', e.target.value)}
                placeholder="Ej: +51 987 654 321"
              />
              <GlassInput
                as="textarea"
                rows={3}
                label="Mensaje predeterminado (usa {id} para el pedido y {monto} para el saldo)"
                value={config.whatsapp_pagos_text}
                onChange={(e) => handleChange('whatsapp_pagos_text', e.target.value)}
              />
            </div>
          </GlassCard>
        </Reveal>

        <div className={styles.actionsRow}>
          <GlassButton type="submit" variant="primary" loading={saveMutation.isPending}>
            Guardar métodos de pago
          </GlassButton>
          {saveMutation.isSuccess && (
            <span className={styles.okMsg}>✓ Métodos de pago guardados.</span>
          )}
          {saveMutation.isError && (
            <span className={styles.errMsg}>
              ✗ Error al guardar: {saveMutation.error?.message || 'Error desconocido'}
            </span>
          )}
        </div>
      </form>
    </motion.div>
  );
}
