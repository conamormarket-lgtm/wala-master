import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getGlobalAnalytics } from '../../../services/adminAnalytics';
import { AuroraBackground, GlassButton } from '../../../components/ui';
import styles from '../AdminDashboard.module.css';
import extra from './dashShared.extra.module.css';

/* ============================================================================
 * dashShared — utilidades compartidas por el HUB y las sub-páginas del panel.
 *
 * Centraliza: formateadores, helpers de ruta, selector de rango (7/30/90),
 * el hook de datos globales (react-query, refresco SOLO manual, staleTime alto)
 * y un header reutilizable con título + botón "← Volver al resumen".
 *
 * Cada sub-página carga SOLO su parte de la UI, pero todas comparten la MISMA
 * query global cacheada por react-query (mismo queryKey por rango), de modo que
 * navegar entre sub-páginas no dispara lecturas extra mientras los datos estén
 * frescos.
 * ========================================================================== */

/* ------------------------------ formateadores ------------------------------ */

export const fmtInt = (v) => new Intl.NumberFormat('es-PE').format(Math.round(Number(v) || 0));

export function fmtDuration(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function shortPath(path) {
  if (!path) return '/';
  return path.length > 26 ? `…${path.slice(-25)}` : path;
}

/* Convierte una ruta en un nombre legible para humanos. */
export function prettyRouteName(path) {
  if (!path || path === '/') return 'Inicio';
  const clean = path.split('?')[0].replace(/\/+$/, '');
  const segs = clean.split('/').filter(Boolean);
  if (!segs.length) return 'Inicio';
  const map = {
    tienda: 'Tienda',
    producto: 'Producto',
    productos: 'Productos',
    categoria: 'Categoría',
    categorias: 'Categorías',
    coleccion: 'Colección',
    colecciones: 'Colecciones',
    checkout: 'Checkout',
    carrito: 'Carrito',
    cuenta: 'Mi cuenta',
    wishlist: 'Lista de deseos',
    editor: 'Editor',
    ofertas: 'Ofertas',
    buscar: 'Búsqueda',
  };
  const titled = segs.map((s) => {
    if (map[s]) return map[s];
    const decoded = decodeURIComponent(s).replace(/[-_]/g, ' ');
    return decoded.charAt(0).toUpperCase() + decoded.slice(1);
  });
  if (titled.length === 1) return titled[0];
  return `${titled[0]} · ${titled[titled.length - 1]}`;
}

export const ADD_TO_CART = 'add_to_cart';

export const CHART_COLORS = ['#6D28D9', '#8B5CF6', '#A78BFA', '#C4B5FD', '#10B981', '#34D399', '#F59E0B'];

/* ------------------------------ tooltip glass ------------------------------ */

export function GlassTooltip({ active, payload, label, suffix = '', formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className={styles.tooltip}>
      {label != null && <div className={styles.tooltipLabel}>{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color || p.fill }} />
          <span className={styles.tooltipName}>{p.name}</span>
          <strong>
            {formatter ? formatter(p.value) : fmtInt(p.value)}
            {suffix}
          </strong>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ animaciones ------------------------------ */

export const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ------------------------------ rango de fechas ------------------------------ */

export const RANGES = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
];

/**
 * useDateRange — calcula {startDateMs, endDateMs} a partir de un nº de días.
 * Devuelve también [rangeDays, setRangeDays] para enlazar al selector.
 */
export function useDateRange(initialDays = 30) {
  const [rangeDays, setRangeDays] = useState(initialDays);
  const dateRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - rangeDays);
    start.setHours(0, 0, 0, 0);
    return { startDateMs: start.getTime(), endDateMs: end.getTime() };
  }, [rangeDays]);
  return { rangeDays, setRangeDays, dateRange };
}

/**
 * useGlobalAnalytics — query global compartida (mismo queryKey por rango que el
 * hub). Sin refetch automático: refresco SOLO manual. staleTime alto para que
 * navegar entre sub-páginas reutilice la caché y no dispare lecturas.
 */
export function useGlobalAnalytics(dateRange) {
  return useQuery({
    queryKey: ['admin-dashboard-global', dateRange.startDateMs, dateRange.endDateMs],
    queryFn: async () => {
      const res = await getGlobalAnalytics(dateRange);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/* ------------------------------ controles UI ------------------------------ */

/**
 * RangePicker — selector de rango 7/30/90 (segmentado glass premium).
 * Mantiene la misma API y semántica tablist; el look se eleva con el design
 * system (superficie glass + píldora activa con gradiente de marca).
 */
export function RangePicker({ rangeDays, setRangeDays }) {
  return (
    <div
      className={`${styles.rangePicker} ${extra.rangePicker}`}
      role="tablist"
      aria-label="Rango de fechas"
    >
      {RANGES.map((r) => {
        const activo = rangeDays === r.days;
        return (
          <button
            key={r.days}
            type="button"
            role="tab"
            aria-selected={activo}
            className={`${styles.rangeBtn} ${extra.rangeBtn} ${
              activo ? `${styles.rangeActive} ${extra.rangeActive}` : ''
            }`}
            onClick={() => setRangeDays(r.days)}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * RefreshButton — botón de refresco manual sobre GlassButton (variante glass).
 * Preserva el comportamiento: onClick dispara la recarga, isFetching deshabilita
 * e indica el estado. Usa el icono ⟳ giratorio propio (en vez del spinner de
 * carga de GlassButton) para mantener la metáfora visual de "actualizar".
 */
export function RefreshButton({ onClick, isFetching }) {
  return (
    <GlassButton
      variant="glass"
      size="sm"
      onClick={onClick}
      disabled={isFetching}
      title="Actualizar datos"
      icon={
        <span
          className={`${extra.refreshIcon} ${isFetching ? extra.spinning : ''}`}
          aria-hidden="true"
        >
          ⟳
        </span>
      }
    >
      {isFetching ? 'Actualizando…' : 'Actualizar'}
    </GlassButton>
  );
}

/**
 * DashHeader — encabezado estándar de sub-página:
 *   enlace "← Volver al resumen" + título + subtítulo,
 *   y a la derecha el selector de rango (opcional) + botón Actualizar.
 */
export function DashHeader({
  title,
  subtitle,
  rangeDays,
  setRangeDays,
  showRange = true,
  onRefresh,
  isFetching,
  lastUpdated,
}) {
  return (
    <header className={`${styles.header} ${extra.header}`}>
      <div className={extra.headerMain}>
        <Link to="/admin/dashboard" className={`${styles.backLink} ${extra.backLink}`}>
          <span className={extra.backArrow} aria-hidden="true">
            ←
          </span>
          Volver al resumen
        </Link>
        <h1 className={`${styles.title} ${extra.title}`}>{title}</h1>
        {subtitle && (
          <p className={`${styles.subtitle} ${extra.subtitle}`}>
            <span>{subtitle}</span>
            {lastUpdated && (
              <span className={extra.subtitleUpdated}>
                <span className={extra.subtitleDot} aria-hidden="true" />
                actualizado {lastUpdated}
              </span>
            )}
          </p>
        )}
      </div>
      <div className={`${styles.headerControls} ${extra.headerControls}`}>
        {showRange && setRangeDays && (
          <RangePicker rangeDays={rangeDays} setRangeDays={setRangeDays} />
        )}
        {onRefresh && <RefreshButton onClick={onRefresh} isFetching={isFetching} />}
      </div>
    </header>
  );
}

/**
 * DashBackground — fondo de marca reutilizado en todas las páginas del panel.
 * Eleva los orbes manuales a la malla "aurora" del design system
 * (AuroraBackground), sobre un lavado de gradiente premium casi blanco. Sigue
 * siendo puramente decorativo (aria-hidden, detrás del contenido).
 */
export function DashBackground() {
  return (
    <div className={extra.bgBase} aria-hidden="true">
      <AuroraBackground variant="vivid" />
    </div>
  );
}

/** Estados de carga/error compartidos. */
export function DashStates({ isLoading, hasData, error }) {
  return (
    <>
      {error && <div className={styles.errorBox}>Error al cargar datos: {error.message}</div>}
      {isLoading && !hasData && <div className={styles.loading}>Cargando analítica…</div>}
    </>
  );
}
