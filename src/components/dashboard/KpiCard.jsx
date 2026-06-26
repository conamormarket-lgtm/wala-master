import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useInView } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import styles from './KpiCard.module.css';

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Contador animado. Cuenta desde 0 hasta `value` cuando entra en viewport.
 * `format` transforma el numero (p.ej. miles, duracion).
 */
function AnimatedNumber({ value = 0, format }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = prefersReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 1.1, bounce: 0 });
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    if (inView) mv.set(value);
  }, [inView, value, mv, reduced]);

  useEffect(() => {
    if (reduced) return undefined;
    const unsub = spring.on('change', (latest) => setDisplay(latest));
    return unsub;
  }, [spring, reduced]);

  const out = typeof format === 'function' ? format(display) : Math.round(display);
  return <span ref={ref}>{out}</span>;
}

/**
 * Tarjeta KPI liquid-glass: numero grande con contador animado,
 * label, delta opcional y mini-sparkline (AreaChart sin ejes).
 *
 * Props:
 *  - label, value (numero crudo), format (fn), accent (color css), icon (nodo)
 *  - sparkData: array de numeros o de objetos {value}
 *  - delta: string opcional (ej "+12%"), deltaPositive: bool para color
 */
export default function KpiCard({
  label,
  value = 0,
  format,
  accent = '#6D28D9',
  icon,
  sparkData = [],
  delta,
  deltaPositive = true,
}) {
  const id = useRef(`kpi-${Math.random().toString(36).slice(2, 9)}`).current;
  const series = (sparkData || []).map((d, i) =>
    typeof d === 'number' ? { i, value: d } : { i, value: d?.value ?? 0 }
  );
  const hasSpark = series.length > 1;

  return (
    <motion.article
      className={styles.card}
      variants={cardVariants}
      whileHover={{ scale: 1.02 }}
    >
      <span className={styles.highlight} aria-hidden="true" />
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && (
          <span className={styles.icon} style={{ color: accent }}>
            {icon}
          </span>
        )}
      </div>

      <div className={styles.value} style={{ color: accent }}>
        <AnimatedNumber value={Number(value) || 0} format={format} />
      </div>

      <div className={styles.footer}>
        {delta != null && (
          <span
            className={`${styles.delta} ${deltaPositive ? styles.up : styles.down}`}
          >
            {delta}
          </span>
        )}
        {hasSpark && (
          <div className={styles.spark} aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={accent}
                  strokeWidth={2}
                  fill={`url(#grad-${id})`}
                  isAnimationActive={!prefersReducedMotion()}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.article>
  );
}
