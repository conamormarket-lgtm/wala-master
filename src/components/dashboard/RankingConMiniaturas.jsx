import React from 'react';
import { motion } from 'framer-motion';
import styles from './RankingConMiniaturas.module.css';

/**
 * RankingConMiniaturas — lista rankeada reutilizable con:
 *   miniatura/avatar + etiqueta (+ sublínea opcional) + barra de proporción + valor.
 *
 * Pensado para los paneles del dashboard (productos vistos, carrito, categorías,
 * rutas, tags). NO hace ninguna lectura: recibe los items ya resueltos por el
 * componente padre, evitando refetches y exceso de lecturas en Firestore.
 *
 * Props:
 *  - items: Array<{
 *      id: string,
 *      label: string,          // texto principal (nombre del producto, categoría…)
 *      value: number,          // valor numérico principal (vistas, agregados…)
 *      sub?: string,           // sublínea opcional bajo el label
 *      image?: string|null,    // URL de miniatura; si falta se usa la inicial
 *      badge?: string|number,  // pill secundaria (p.ej. "12 al carrito")
 *    }>
 *  - valueLabel?: string       // etiqueta bajo el número (ej "vistas")
 *  - formatValue?: (n) => string
 *  - emptyIcon?: string
 *  - emptyText?: string
 *  - max?: number              // recorte de seguridad (default 10)
 */

const DEFAULT_FORMAT = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));

const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  show: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

function initialOf(label) {
  const s = String(label || '?').trim();
  return s ? s[0] : '?';
}

export default function RankingConMiniaturas({
  items = [],
  valueLabel = '',
  formatValue = DEFAULT_FORMAT,
  emptyIcon = '📊',
  emptyText = 'Aún sin datos en este periodo.',
  max = 10,
}) {
  const list = (items || []).slice(0, max);

  if (!list.length) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">{emptyIcon}</span>
        {emptyText}
      </div>
    );
  }

  const top = list.reduce((m, it) => Math.max(m, Number(it.value) || 0), 0) || 1;

  return (
    <ul className={styles.list}>
      {list.map((it, i) => {
        const val = Number(it.value) || 0;
        const pct = Math.max(4, Math.round((val / top) * 100));
        return (
          <motion.li
            key={it.id ?? `${it.label}-${i}`}
            className={styles.row}
            custom={i}
            variants={rowVariants}
            initial="hidden"
            animate="show"
          >
            <span className={`${styles.rank} ${i < 3 ? styles.rankTop : ''}`}>{i + 1}</span>

            <span className={styles.thumb}>
              {it.image ? (
                <img
                  className={styles.thumbImg}
                  src={it.image}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    // Si la imagen falla, ocultarla y dejar el fallback de inicial.
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className={styles.thumbFallback}>{initialOf(it.label)}</span>
              )}
            </span>

            <span className={styles.main}>
              <span className={styles.label} title={it.label}>{it.label}</span>
              {it.sub && <span className={styles.sub}>{it.sub}</span>}
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${pct}%` }} />
              </span>
              {it.badge != null && it.badge !== '' && (
                <span className={styles.pill}>🛒 {it.badge}</span>
              )}
            </span>

            <span className={styles.value}>
              <span className={styles.valueNum}>{formatValue(val)}</span>
              {valueLabel && <span className={styles.valueLabel}>{valueLabel}</span>}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
