import React, { useId, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from 'recharts';
import { GlassTooltip } from '../../ui';
import { brand, useReducedMotionSafe, DUR } from '../../../theme';
import styles from './CompareBars.module.css';

/**
 * CompareBars — barras horizontales para comparar / rankear conjuntos pequeños.
 * -------------------------------------------------------------------------
 * Pensado para "top N" (productos, rutas, búsquedas, categorías…). Usa un
 * BarChart de recharts en layout vertical (las barras crecen en horizontal),
 * con barras redondeadas pintadas con un gradiente del color base, etiquetas
 * de valor al final de cada barra y el GlassTooltip del sistema de diseño.
 *
 * La altura del gráfico se deriva del número de barras (cada barra ocupa una
 * banda fija), de modo que la tarjeta crece/encoge con los datos sin recortes.
 *
 * Props:
 *  - data        {Array<object>}  filas a pintar. Tolera vacío/undefined.
 *  - nameKey     {string}         clave de la etiqueta de categoría. Default 'name'.
 *  - valueKey    {string}         clave del valor numérico. Default 'value'.
 *  - color       {string}         hex base del gradiente. Default violeta de marca.
 *  - formatValue {(v:number)=>string} [opcional] formatea la etiqueta del valor.
 *  - max         {number}         máximo de barras a mostrar (top-N). Default 8.
 *  - emptyText   {string}         [opcional] texto cuando no hay datos.
 */
export default function CompareBars({
  data,
  nameKey = 'name',
  valueKey = 'value',
  color = brand.primary,
  formatValue,
  max = 8,
  emptyText = 'Sin datos para comparar todavía.',
}) {
  const reduced = useReducedMotionSafe();

  // id único por instancia: evita que dos gráficos compartan el mismo gradiente.
  const rawId = useId();
  const gradientId = `compareBarsGrad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Normaliza, descarta filas inválidas, ordena de mayor a menor y corta a `max`.
  const rows = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    return safe
      .map((d) => ({
        ...d,
        // Etiqueta de categoría como string seguro.
        _name: d?.[nameKey] != null ? String(d[nameKey]) : '',
        // Valor numérico saneado (NaN/undefined -> 0).
        _value: Number(d?.[valueKey]) || 0,
      }))
      .filter((d) => d._name !== '')
      .sort((a, b) => b._value - a._value)
      .slice(0, Math.max(1, max));
  }, [data, nameKey, valueKey, max]);

  // Sin datos útiles: estado vacío tolerante.
  if (rows.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  // Altura derivada: banda por barra + margen vertical. Acotada para no romper el layout.
  const BAND = 44; // alto reservado por barra (barra + separación)
  const PAD = 16; // respiración superior/inferior
  const height = Math.min(560, Math.max(96, rows.length * BAND + PAD));

  // Ancho del eje de categorías: proporcional a la etiqueta más larga (con tope).
  const longest = rows.reduce((m, r) => Math.max(m, r._name.length), 0);
  const yAxisWidth = Math.min(160, Math.max(72, longest * 7));

  // Formateador de la etiqueta de valor (y del tooltip, vía formatter de GlassTooltip).
  const fmt =
    typeof formatValue === 'function'
      ? formatValue
      : (v) => (Number(v) || 0).toLocaleString('es-PE');

  return (
    <div className={styles.wrapper} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
          barCategoryGap="22%"
        >
          <defs>
            {/* Gradiente horizontal del color base: arranca translúcido y asienta sólido. */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>

          {/* Eje de valor oculto: el ranking se lee por longitud + etiqueta. */}
          <XAxis type="number" hide domain={[0, 'dataMax']} />

          {/* Eje de categorías a la izquierda. */}
          <YAxis
            type="category"
            dataKey="_name"
            width={yAxisWidth}
            axisLine={false}
            tickLine={false}
            tick={{
              fontSize: 12,
              fill: '#475569',
            }}
            interval={0}
          />

          <Tooltip
            cursor={{ fill: 'rgba(109, 40, 217, 0.06)' }}
            content={<GlassTooltip formatter={(value) => fmt(value)} />}
          />

          <Bar
            dataKey="_value"
            name="Valor"
            fill={`url(#${gradientId})`}
            radius={[0, 8, 8, 0]}
            maxBarSize={26}
            isAnimationActive={!reduced}
            animationDuration={Math.round(DUR.lenta * 1000)}
          >
            {/* Etiqueta de valor al final de cada barra. */}
            <LabelList
              dataKey="_value"
              position="right"
              className={styles.valueLabel}
              formatter={(value) => fmt(value)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
