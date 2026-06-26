import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { AnimatedNumber, GlassTooltip } from '../../ui';
import { chartColors } from '../../../theme';
import styles from './Donut.module.css';

/**
 * Donut — gráfico de dona reutilizable del dashboard de Walá.
 * -------------------------------------------------------------------------
 * Envoltura fina sobre el PieChart de recharts con el look "Aurora Violeta
 * Serena": dona (innerRadius), separación sutil entre segmentos, animación de
 * entrada, etiqueta central opcional (con número animado) y leyenda compacta
 * que se acomoda al lado en pantallas anchas y debajo en móvil.
 *
 * Pensado para reutilizarse en cualquier sub-página del dashboard sin acoplarse
 * a un origen de datos concreto: solo recibe una lista {name, value} ya
 * preparada por quien lo consume.
 *
 * Tolerante a datos vacíos/indefinidos: si no hay segmentos con valor positivo,
 * muestra un estado vacío discreto en vez de un gráfico roto.
 *
 * Props:
 *  - data        {Array<{name, value}>} segmentos a pintar (obligatorio).
 *  - colors      {string[]}  [opcional] paleta de relleno; por defecto chartColors.
 *  - height      {number}    [opcional] alto del lienzo del gráfico (px). Def. 260.
 *  - centerLabel {string}    [opcional] rótulo pequeño sobre el valor central.
 *  - centerValue {number|string} [opcional] valor grande en el centro de la dona.
 *  - formatValue {(n) => string} [opcional] formatea centerValue, los valores de
 *                la leyenda y los del tooltip. Si centerValue es numérico, se usa
 *                AnimatedNumber con este formato; si no, se muestra tal cual.
 *  - className   {string}    [opcional] clases extra (al final del join).
 *  - emptyText   {string}    [opcional] texto del estado vacío.
 *  - ...rest                  passthrough al contenedor raíz.
 */
function Donut({
  data,
  colors = chartColors,
  height = 260,
  centerLabel,
  centerValue,
  formatValue,
  className,
  emptyText = 'Sin datos para mostrar aún.',
  ...rest
}) {
  // Solo segmentos con valor numérico positivo: recharts no pinta ceros/negativos
  // de forma útil y un valor inválido rompería el cálculo de ángulos.
  const segments = useMemo(
    () =>
      (Array.isArray(data) ? data : []).filter(
        (d) => d && Number.isFinite(Number(d.value)) && Number(d.value) > 0
      ),
    [data]
  );

  // Paleta segura: si llega vacía o no-array, caemos a la del sistema.
  const palette =
    Array.isArray(colors) && colors.length ? colors : chartColors;

  // Resuelve el color de un segmento por índice (con rebote por módulo).
  const colorAt = (i) => palette[i % palette.length];

  // ¿Hay valor central que mostrar? Aceptamos 0 explícito como válido.
  const hasCenter =
    centerValue != null && centerValue !== '' && centerLabel !== '';
  const centerValueIsNumber =
    typeof centerValue === 'number' && Number.isFinite(centerValue);

  // Formateador por defecto para leyenda/centro: enteros con separador de miles.
  const formatNumber = formatValue || ((n) => Math.round(Number(n)).toLocaleString());

  // Estado vacío: no rompemos el layout, solo un mensaje sereno.
  if (!segments.length) {
    return (
      <div
        className={[styles.wrap, styles.empty, className].filter(Boolean).join(' ')}
        {...rest}
      >
        <p className={styles.emptyText}>{emptyText}</p>
      </div>
    );
  }

  return (
    <div
      className={[styles.wrap, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {/* Lienzo de la dona con la etiqueta central superpuesta */}
      <div className={styles.chartBox} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              // Dona: hueco interior generoso para alojar la etiqueta central.
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              // Canto de luz entre segmentos (coherente con el vidrio).
              stroke="rgba(255, 255, 255, 0.65)"
              strokeWidth={2}
              // Empieza arriba y gira en sentido horario: lectura natural.
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            >
              {segments.map((entry, i) => (
                <Cell key={entry.name ?? i} fill={colorAt(i)} />
              ))}
            </Pie>
            <Tooltip
              content={<GlassTooltip formatter={(value) => formatNumber(value)} />}
              cursor={false}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Etiqueta central: rótulo pequeño + valor grande (animado si es número) */}
        {hasCenter && (
          <div className={styles.center} aria-hidden="true">
            {centerLabel && <span className={styles.centerLabel}>{centerLabel}</span>}
            {centerValueIsNumber ? (
              <AnimatedNumber
                className={styles.centerValue}
                value={centerValue}
                format={formatNumber}
              />
            ) : (
              <span className={styles.centerValue}>{centerValue}</span>
            )}
          </div>
        )}
      </div>

      {/* Leyenda compacta: punto de color + nombre (truncado) + valor */}
      <ul className={styles.legend}>
        {segments.map((entry, i) => (
          <li key={entry.name ?? i} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ backgroundColor: colorAt(i) }}
              aria-hidden="true"
            />
            <span className={styles.legendName}>{entry.name}</span>
            <strong className={styles.legendValue}>{formatNumber(entry.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Donut;
