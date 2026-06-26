import styles from './GlassTooltip.module.css';

/**
 * GlassTooltip — tooltip de vidrio para gráficos de recharts.
 * -------------------------------------------------------------------------
 * Generaliza el GlassTooltip que vivía suelto en dashShared, dándole el look
 * "Aurora Violeta Serena" coherente con los tokens del sistema.
 *
 * Pensado para pasarse como `content` de un <Tooltip /> de recharts:
 *   <Tooltip content={<GlassTooltip suffix="S/" />} />
 *
 * Props (firma estándar del custom tooltip de recharts):
 *  - active    {boolean}            inyectada por recharts; si es false no se pinta.
 *  - payload   {Array}              series activas en el punto bajo el cursor.
 *  - label     {string|number}      etiqueta del eje X (categoría / fecha).
 *  - suffix    {string}  [opcional] sufijo de unidad para el valor (p.ej. 'S/', '%').
 *  - formatter {(value, entry) => string} [opcional] formatea cada valor a medida.
 *  - className {string}  [opcional] clases extra (siempre al final del join).
 *  - ...rest                        passthrough al contenedor.
 */
function GlassTooltip({
  active,
  payload,
  label,
  suffix = '',
  formatter,
  className,
  ...rest
}) {
  // Sin punto activo o sin series: recharts espera null (no renderiza nada).
  if (!active || !payload?.length) return null;

  return (
    <div
      className={[styles.tooltip, className].filter(Boolean).join(' ')}
      role="tooltip"
      {...rest}
    >
      {/* Etiqueta del eje (categoría / fecha del punto) */}
      {label != null && label !== '' && (
        <div className={styles.label}>{label}</div>
      )}

      {/* Una fila por cada serie activa */}
      {payload.map((entry, index) => {
        // recharts expone el color en .color o, en algunas series, en .fill.
        const color = entry.color || entry.fill;
        // Valor formateado: formatter a medida o valor + sufijo de unidad.
        const value = formatter
          ? formatter(entry.value, entry)
          : `${entry.value}${suffix}`;

        return (
          <div
            // dataKey suele ser único por serie; index como respaldo estable.
            key={entry.dataKey ?? entry.name ?? index}
            className={styles.row}
          >
            <span
              className={styles.swatch}
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            {entry.name != null && (
              <span className={styles.name}>{entry.name}</span>
            )}
            <span className={styles.value}>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

export default GlassTooltip;
