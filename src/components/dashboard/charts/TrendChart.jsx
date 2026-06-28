import React, { useId, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import GlassTooltip from '../../ui/GlassTooltip';
import { chartColors, useReducedMotionSafe, DUR } from '../../../theme';
import styles from './TrendChart.module.css';

/**
 * TrendChart — gráfico de tendencia "espectacular" del sistema de diseño.
 * -------------------------------------------------------------------------
 * AreaChart de recharts con áreas de degradado animadas por serie, líneas
 * suaves (type monotone), rejilla sutil, ejes finos y el GlassTooltip del
 * sistema. Pensado para series temporales (tráfico por día, ingresos, etc.).
 *
 * La altura es CRÍTICA para recharts: el ResponsiveContainer vive DENTRO de un
 * wrapper con altura fija (prop `height`), nunca al aire. Sin altura el gráfico
 * colapsa a 0px y no se pinta.
 *
 * Props:
 *  - data    {Array<object>}            filas de la serie. Tolera vacío/undefined.
 *  - series  {Array<{key,name,color}>}  series a pintar. `key` es la clave del
 *                                        valor en cada fila; `name` la etiqueta
 *                                        (leyenda/tooltip); `color` el hex base
 *                                        del degradado (opcional: cae a chartColors).
 *  - xKey    {string}                   clave del eje X. Default 'label'.
 *  - height  {number}                   alto fijo del wrapper en px. Default 300.
 *  - formatY {(v:number)=>string}       [opcional] formatea el eje Y y el tooltip.
 *  - emptyText {string}                 [opcional] texto del estado vacío.
 */
export default function TrendChart({
  data,
  series = [],
  xKey = 'label',
  height = 300,
  formatY,
  emptyText = 'Sin datos de tendencia todavía.',
}) {
  const reduced = useReducedMotionSafe();

  // id único por instancia: evita que dos gráficos colisionen sus gradientes
  // (los <defs> son globales en el documento; ids repetidos se pisan).
  const rawId = useId();
  const baseId = `trendGrad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Series saneadas: descarta entradas sin `key` y asigna color/nombre por defecto.
  const safeSeries = useMemo(() => {
    const list = Array.isArray(series) ? series : [];
    return list
      .filter((s) => s && s.key != null && s.key !== '')
      .map((s, i) => ({
        key: String(s.key),
        name: s.name != null ? String(s.name) : String(s.key),
        // Color base del degradado: el de la serie o el de la paleta de marca.
        color: s.color || chartColors[i % chartColors.length],
        // Gradiente propio por serie (id estable dentro de la instancia).
        gradId: `${baseId}-${i}`,
      }));
  }, [series, baseId]);

  // Filas saneadas (array seguro). No mutamos los objetos originales.
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // ¿Hay algún valor numérico > 0 en alguna serie? Con datos escasos (1-2 días o
  // valores pequeños) el área puede verse plana/vacía; estas señales nos sirven
  // para forzar puntos visibles y un dominio Y razonable.
  const { maxVal, hasAnyValue } = useMemo(() => {
    let max = 0;
    let any = false;
    rows.forEach((r) => {
      safeSeries.forEach((s) => {
        const v = Number(r?.[s.key]) || 0;
        if (v > 0) any = true;
        if (v > max) max = v;
      });
    });
    return { maxVal: max, hasAnyValue: any };
  }, [rows, safeSeries]);

  // Con pocos puntos (o un único día) los segmentos casi no se ven: mostramos el
  // dot de cada punto para que el dato exista visualmente. Umbral generoso.
  const showDots = rows.length > 0 && rows.length <= 6;

  // Dominio Y: si hay datos, dejamos un techo con holgura (~15%, mínimo 1) para
  // que la serie no quede pegada al borde superior ni se vea aplastada. Si no hay
  // ningún valor, dejamos que recharts autoescale (mostrará la línea base en 0).
  const yDomain = useMemo(() => {
    if (!hasAnyValue) return [0, 'auto'];
    const top = Math.max(1, Math.ceil(maxVal * 1.15));
    return [0, top];
  }, [hasAnyValue, maxVal]);

  // Sin datos o sin series útiles: estado vacío tolerante, sin saltos de layout.
  const hasData = rows.length > 0 && safeSeries.length > 0;
  if (!hasData) {
    return (
      <div
        className={styles.empty}
        style={{ minHeight: Math.max(120, Number(height) || 0) }}
      >
        <span className={styles.emptyIcon} aria-hidden="true">📈</span>
        <p className={styles.emptyText}>{emptyText}</p>
      </div>
    );
  }

  // Formateador del eje Y y del tooltip (un único origen de verdad).
  const fmt =
    typeof formatY === 'function'
      ? formatY
      : (v) => (Number(v) || 0).toLocaleString('es-PE');

  // Duración de animación: respeta el preset del sistema; 0 si se pide menos movimiento.
  const animDuration = reduced ? 0 : Math.round(DUR.lenta * 1000);

  return (
    // Wrapper con ALTURA FIJA: requisito de recharts (ResponsiveContainer
    // necesita un padre con dimensión resuelta para medir).
    <div className={styles.wrapper} style={{ height: Number(height) || 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        >
          <defs>
            {/* Un degradado vertical por serie: del color base (arriba) al
                transparente (abajo), para el relleno del área. */}
            {safeSeries.map((s) => (
              <linearGradient
                key={s.gradId}
                id={s.gradId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.42} />
                <stop offset="55%" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {/* Rejilla sutil: solo horizontales, trazo punteado tenue. */}
          <CartesianGrid
            vertical={false}
            stroke="#E2E8F0"
            strokeOpacity={0.5}
            strokeDasharray="3 6"
          />

          {/* Eje X fino: sin línea de eje, ticks discretos. */}
          <XAxis
            dataKey={xKey}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={16}
            tick={{
              fontSize: 11,
              fill: '#475569',
            }}
          />

          {/* Eje Y fino: ancho acotado, valores formateados. Dominio con holgura
              para que con datos escasos la serie no quede aplastada en el borde. */}
          <YAxis
            axisLine={false}
            tickLine={false}
            width={48}
            domain={yDomain}
            allowDecimals={false}
            tick={{
              fontSize: 11,
              fill: '#475569',
            }}
            tickFormatter={(v) => fmt(v)}
          />

          <Tooltip
            cursor={{
              stroke: '#6D28D9',
              strokeOpacity: 0.35,
              strokeWidth: 1,
            }}
            content={<GlassTooltip formatter={(value) => fmt(value)} />}
          />

          {/* Una capa de área + línea suave por serie. */}
          {safeSeries.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              fill={`url(#${s.gradId})`}
              fillOpacity={1}
              // Con muchos puntos: ocultos en reposo (aparecen al pasar el cursor).
              // Con datos escasos: visibles, para que un día suelto no se vea vacío.
              dot={
                showDots
                  ? { r: 3, strokeWidth: 2, stroke: '#ffffff', fill: s.color }
                  : false
              }
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: '#ffffff',
                fill: s.color,
              }}
              isAnimationActive={!reduced}
              animationDuration={animDuration}
              animationEasing="ease-out"
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
