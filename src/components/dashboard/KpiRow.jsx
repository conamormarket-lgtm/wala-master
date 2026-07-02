import React, { useId, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import {
  GlassPanel,
  AnimatedNumber,
  Badge,
  Stagger,
  StaggerItem,
} from '../ui';
import { useReducedMotionSafe } from '../../theme/motion';
import styles from './KpiRow.module.css';

/* =========================================================================
   KpiRow — Grilla responsive de tarjetas KPI premium
   -------------------------------------------------------------------------
   Recibe un array `items` y dibuja una rejilla de KPIs sobre superficies de
   vidrio (ui/GlassPanel). Cada tarjeta muestra:
     - número grande con contador animado (ui/AnimatedNumber) en color accent,
     - etiqueta descriptiva,
     - delta opcional como pastilla (ui/Badge) verde/rojo,
     - mini-sparkline opcional (recharts AreaChart sin ejes, con degradado del
       accent),
     - icono opcional.

   La entrada es escalonada (ui/Stagger + StaggerItem). Mobile-first: una
   columna en móvil, 2-4 en pantallas mayores. Todo es tolerante a datos
   vacíos/indefinidos (optional chaining + fallbacks) y respeta
   prefers-reduced-motion (los wrappers ui/ y el sparkline ya lo hacen).

   Forma de cada item:
     {
       label: string,            // etiqueta del KPI
       value: number,            // valor crudo (se anima desde 0)
       format: (n) => string,    // formateador opcional del número
       accent: string,           // color CSS del acento (default: violeta marca)
       delta: string,            // texto de variación opcional, p.ej. "+12%"
       deltaPositive: boolean,   // tono del delta (verde si true, rojo si false)
       sparkData: number[] | {value:number}[], // serie para la mini-sparkline
       icon: ReactNode,          // icono opcional (esquina superior derecha)
       info: string,             // leyenda opcional: qué significa el KPI (ⓘ)
     }

   Leyenda (`info`): si llega texto, se pinta un botón ⓘ junto a la etiqueta
   que muestra una nota en lenguaje claro al pasar el cursor, enfocar con
   teclado o tocar (móvil). Accesible: el trigger es un <button> real con
   aria-label y aria-describedby hacia el texto (role="tooltip"), que SIEMPRE
   existe en el DOM (los lectores de pantalla leen la descripción aunque esté
   visualmente oculta). Escape la cierra. Sin `info` no se renderiza nada
   (retrocompatible con todos los usos actuales).
   ========================================================================= */

// Acento por defecto: violeta de marca (token CSS con fallback al hex canónico).
const ACENTO_POR_DEFECTO = '#6D28D9';

/**
 * Normaliza la serie del sparkline a objetos { i, value } que entiende recharts.
 * Acepta tanto un array de números como un array de objetos con `value`.
 */
function normalizarSerie(sparkData) {
  if (!Array.isArray(sparkData)) return [];
  return sparkData.map((dato, indice) =>
    typeof dato === 'number'
      ? { i: indice, value: dato }
      : { i: indice, value: Number(dato?.value) || 0 },
  );
}

/**
 * KpiTarjeta — una sola tarjeta KPI. Interna a KpiRow (no se exporta).
 * Vive en su propia función para aislar el id único del degradado del sparkline.
 */
function KpiTarjeta({
  label,
  value = 0,
  format,
  accent = ACENTO_POR_DEFECTO,
  delta,
  deltaPositive = true,
  sparkData,
  icon,
  info,
}) {
  // Id único y estable por tarjeta para no colisionar los gradientes de recharts.
  const reactId = useId();
  const gradId = `kpirow-grad-${reactId.replace(/[:]/g, '')}`;
  const infoId = `kpirow-info-${reactId.replace(/[:]/g, '')}`;

  // Leyenda ⓘ: abierta por hover/focus/click (click cubre pantallas táctiles).
  // Nota: la nota vive FUERA del GlassPanel (que recorta con overflow:hidden),
  // como overlay absoluto del .item, para no quedar cortada por la tarjeta.
  const [infoAbierta, setInfoAbierta] = useState(false);

  const sinMovimiento = useReducedMotionSafe();

  const serie = normalizarSerie(sparkData);
  // Solo dibujamos sparkline si hay al menos dos puntos (una línea necesita 2).
  const haySpark = serie.length > 1;

  // El delta se muestra solo si llega texto; el tono lo decide deltaPositive.
  const hayDelta = delta != null && delta !== '';

  return (
    <StaggerItem as="article" className={styles.item}>
      {/* La superficie de vidrio aporta el cristal de marca; el contenido va dentro. */}
      <GlassPanel variant="soft" padding="none" className={styles.panel}>
        <div className={styles.contenido}>
          {/* Cabecera: etiqueta + leyenda ⓘ opcional + icono con halo del accent. */}
          <div className={styles.top}>
            <span className={styles.label}>
              {label}
              {info && (
                <button
                  type="button"
                  className={styles.infoBtn}
                  aria-label={`Qué significa "${label}"`}
                  aria-describedby={infoId}
                  onMouseEnter={() => setInfoAbierta(true)}
                  onMouseLeave={() => setInfoAbierta(false)}
                  onFocus={() => setInfoAbierta(true)}
                  onBlur={() => setInfoAbierta(false)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setInfoAbierta(false); }}
                  onClick={() => setInfoAbierta((v) => !v)}
                >
                  ⓘ
                </button>
              )}
            </span>
            {icon && (
              <span className={styles.icon} style={{ color: accent }} aria-hidden="true">
                {icon}
              </span>
            )}
          </div>

          {/* Número grande animado en el color del acento. */}
          <div className={styles.value} style={{ color: accent }}>
            <AnimatedNumber value={Number(value) || 0} format={format} />
          </div>

          {/* Pie: delta (badge) a la izquierda, sparkline a la derecha. */}
          <div className={styles.footer}>
            {hayDelta && (
              <Badge
                tone={deltaPositive ? 'success' : 'danger'}
                variant="soft"
                size="sm"
                className={styles.delta}
              >
                {delta}
              </Badge>
            )}

            {haySpark && (
              <div className={styles.spark} aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={serie}
                    margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
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
                      fill={`url(#${gradId})`}
                      isAnimationActive={!sinMovimiento}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* Leyenda del KPI: SIEMPRE en el DOM (aria-describedby la lee aunque esté
          oculta); visible solo con hover/focus/tap. Va fuera del panel para que
          el overflow:hidden de la tarjeta no la recorte. */}
      {info && (
        <span
          role="tooltip"
          id={infoId}
          className={`${styles.infoTip} ${infoAbierta ? styles.infoTipVisible : ''}`}
        >
          {info}
        </span>
      )}
    </StaggerItem>
  );
}

/**
 * KpiRow — grilla de tarjetas KPI con entrada escalonada.
 *
 * @param {Array} items        Lista de KPIs (ver forma arriba). Default [].
 * @param {string} [className] Clases extra para la rejilla (al final del join).
 */
export default function KpiRow({ items = [], className, ...rest }) {
  // Tolerancia total: si no llega un array usable, no renderizamos nada.
  const lista = Array.isArray(items) ? items : [];
  if (lista.length === 0) return null;

  const clases = [styles.grid, className].filter(Boolean).join(' ');

  return (
    <Stagger className={clases} {...rest}>
      {lista.map((item, indice) => (
        <KpiTarjeta
          // Clave estable: preferimos el label; caemos al índice si falta.
          key={item?.label ?? `kpi-${indice}`}
          label={item?.label}
          value={item?.value}
          format={item?.format}
          accent={item?.accent}
          delta={item?.delta}
          deltaPositive={item?.deltaPositive}
          sparkData={item?.sparkData}
          icon={item?.icon}
          info={item?.info}
        />
      ))}
    </Stagger>
  );
}
