import React, { useMemo, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

import GlassCard from '../../../components/dashboard/GlassCard';
import { GlassButton, GlassInput } from '../../../components/ui';
import styles from './BackfillAnaliticaButton.module.css';

/* ============================================================================
 * BackfillAnaliticaButton — control de admin para reconstruir el histórico de
 * analítica pre-agregada (colección analytics_daily).
 *
 * Llama a la Cloud Function callable 'aggregateAnalyticsDailyBackfill'
 * (functions/analyticsDaily.js), que re-agrega los eventos crudos de cada día
 * en su doc diario. Acepta:
 *    - { fromDay, toDay }  (rango, ambos 'YYYY-MM-DD', tope 120 días por llamada;
 *                           aquí se manda por tramos de 10 días)
 *    - { day }             (un único día)
 * y exige el claim admin === true (mismo gating que <AdminRoute>), así que este
 * control SOLO tiene sentido bajo el panel de admin.
 *
 * Patrón de invocación = el canónico del repo (services/loyalty.js,
 * AdminNotifications.jsx): httpsCallable(getFunctions(), name)(payload), envuelto
 * en try/catch que normaliza a { error, data }. No bloquea la página: el estado
 * de carga/resultado/error vive aquí dentro.
 *
 * OJO: el backfill es de ANALÍTICA (analytics_events → analytics_daily), NO de
 * pedidos. Por eso vive como acción del dashboard de analítica.
 * ========================================================================== */

// Formatea un Date a la clave 'YYYY-MM-DD' que espera la Cloud Function.
const toDayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Devuelve { fromDay, toDay } para los últimos `n` días (incluye hoy).
const presetUltimosDias = (n) => {
  const hoy = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - (n - 1));
  return { fromDay: toDayKey(desde), toDay: toDayKey(hoy) };
};

// Tope del rango: lo más largo que muestra Resultados (365 días). Va por tramos,
// así que no choca con el tope de 120 días por llamada de la Cloud Function.
const MAX_DIAS = 365;

// Valida el formato de clave de día (mismo contrato que isValidDayKey en server).
const esDiaValido = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

// Nº de días inclusive entre dos claves 'YYYY-MM-DD' (o null si no se puede calcular).
const diasEnRango = (fromDay, toDay) => {
  if (!esDiaValido(fromDay) || !esDiaValido(toDay)) return null;
  const ini = new Date(`${fromDay}T00:00:00`);
  const fin = new Date(`${toDay}T00:00:00`);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return null;
  if (fin < ini) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((fin - ini) / dayMs) + 1;
};

// Invoca la callable y normaliza a { error, data } (mismo estilo que callFn de loyalty.js).
// El navegador espera hasta 9 min (lo mismo que la función): con el tope por
// defecto (70 s) avisaba "deadline-exceeded" aunque el servidor terminara bien.
const llamarBackfill = async (payload) => {
  try {
    const res = await httpsCallable(getFunctions(), 'aggregateAnalyticsDailyBackfill', { timeout: 540000 })(payload);
    return { error: null, data: res.data };
  } catch (e) {
    return { error: e?.message || 'Error en el servidor', data: null };
  }
};

// Se reconstruye por tramos de pocos días: cada llamada termina rápido y se
// ve el avance (90 días de una sola vez tardaban más de 3 minutos).
const DIAS_POR_TRAMO = 10;

// Parte [fromDay, toDay] en tramos consecutivos de hasta DIAS_POR_TRAMO días.
const tramosDe = (fromDay, toDay) => {
  const tramos = [];
  const cursor = new Date(`${fromDay}T00:00:00`);
  const fin = new Date(`${toDay}T00:00:00`);
  while (cursor <= fin) {
    const desde = toDayKey(cursor);
    cursor.setDate(cursor.getDate() + DIAS_POR_TRAMO - 1);
    const hasta = cursor < fin ? toDayKey(cursor) : toDay;
    tramos.push({ fromDay: desde, toDay: hasta });
    cursor.setDate(cursor.getDate() + 1);
  }
  return tramos;
};

export default function BackfillAnaliticaButton() {
  // Rango personalizado: por defecto, los últimos 30 días.
  const inicial = useMemo(() => presetUltimosDias(30), []);
  const [fromDay, setFromDay] = useState(inicial.fromDay);
  const [toDay, setToDay] = useState(inicial.toDay);

  const [cargando, setCargando] = useState(false);
  const [avance, setAvance] = useState(null); // { hechos, total } en días
  const [resultado, setResultado] = useState(null); // { processed, ok }
  const [error, setError] = useState('');

  // Nº de días del rango actual y validación local (tope MAX_DIAS).
  const dias = useMemo(() => diasEnRango(fromDay, toDay), [fromDay, toDay]);
  const rangoValido = dias !== null && dias >= 1 && dias <= MAX_DIAS;

  // Lanza el backfill con un payload ya resuelto. Centraliza estado de carga,
  // limpieza de mensajes y mapeo de error/resultado para presets y rango manual.
  // Va tramo por tramo; si uno falla se detiene y dice hasta dónde llegó (lo
  // ya reconstruido queda guardado).
  const ejecutar = async (payload) => {
    if (cargando) return;
    const tramos = tramosDe(payload.fromDay, payload.toDay);
    const total = diasEnRango(payload.fromDay, payload.toDay) || 0;
    setCargando(true);
    setError('');
    setResultado(null);
    let processed = 0;
    let ok = 0;
    setAvance({ hechos: 0, total });
    for (const tramo of tramos) {
      const { error: err, data } = await llamarBackfill(tramo);
      if (err) {
        setError(`${err}. Quedaron reconstruidos ${processed} de ${total} días (hasta antes del ${tramo.fromDay}).`);
        break;
      }
      processed += data?.processed ?? 0;
      ok += data?.ok ?? 0;
      setAvance({ hechos: processed, total });
    }
    if (processed > 0) setResultado({ processed, ok });
    setAvance(null);
    setCargando(false);
  };

  // Preset "Últimos N días": calcula el rango y dispara directamente.
  const ejecutarPreset = (n) => {
    const { fromDay: f, toDay: t } = presetUltimosDias(n);
    // Sincronizamos también los inputs para que el usuario vea qué se reconstruyó.
    setFromDay(f);
    setToDay(t);
    ejecutar({ fromDay: f, toDay: t });
  };

  // Rango personalizado desde los inputs (un solo día si from === to: se envía
  // como { fromDay, toDay } igualmente; la CF acepta rangos de 1 día).
  const ejecutarRango = () => {
    if (!rangoValido) return;
    ejecutar({ fromDay, toDay });
  };

  // Mensaje de ayuda/validación bajo los inputs de fecha.
  const hint =
    dias === null
      ? 'Usa el formato YYYY-MM-DD y que "Desde" no sea posterior a "Hasta".'
      : dias > MAX_DIAS
        ? `El rango (${dias} días) supera el máximo de ${MAX_DIAS}. Divídelo en partes.`
        : `Se reconstruirán ${dias} día(s).`;

  return (
    <GlassCard
      title="Reconstruir el resumen diario"
      subtitle="Vuelve a sumar los días elegidos con lo que registró la tienda."
      className={styles.card}
    >
      <div className={styles.body}>
        {/* Atajos rápidos: presets de rango habituales. */}
        <div className={styles.presets} role="group" aria-label="Atajos de rango">
          <GlassButton
            variant="glass"
            size="sm"
            onClick={() => ejecutarPreset(30)}
            disabled={cargando}
          >
            Últimos 30 días
          </GlassButton>
          <GlassButton
            variant="glass"
            size="sm"
            onClick={() => ejecutarPreset(90)}
            disabled={cargando}
          >
            Últimos 90 días
          </GlassButton>
        </div>

        {/* Rango personalizado (YYYY-MM-DD vía date input nativo). */}
        <div className={styles.rango}>
          <GlassInput
            type="date"
            label="Desde"
            value={fromDay}
            max={toDay || undefined}
            onChange={(e) => setFromDay(e.target.value)}
            disabled={cargando}
            className={styles.fecha}
          />
          <GlassInput
            type="date"
            label="Hasta"
            value={toDay}
            min={fromDay || undefined}
            onChange={(e) => setToDay(e.target.value)}
            disabled={cargando}
            className={styles.fecha}
          />
          <GlassButton
            variant="primary"
            size="md"
            onClick={ejecutarRango}
            loading={cargando}
            disabled={cargando || !rangoValido}
            className={styles.cta}
          >
            Reconstruir
          </GlassButton>
        </div>

        <p className={`${styles.hint} ${!rangoValido && dias !== null ? styles.hintError : ''}`}>
          {hint}
        </p>

        {avance && (
          <p className={styles.hint} role="status">
            Reconstruyendo… {avance.hechos} de {avance.total} días. Puedes seguir usando el panel, pero no cierres esta página.
          </p>
        )}

        {/* Resultado / error (no bloquea la página). */}
        {error && (
          <div className={styles.error} role="alert">
            No se pudo reconstruir: {error}
          </div>
        )}

        {resultado && (
          <div className={styles.resultado} role="status">
            <strong>Listo.</strong> Días procesados: {resultado.processed ?? 0} · Correctos:{' '}
            {resultado.ok ?? 0}
            {resultado.processed != null && resultado.ok != null && resultado.ok < resultado.processed && (
              <span className={styles.parcial}>
                {' '}
                ({resultado.processed - resultado.ok} con error; revisa la consola del servidor.)
              </span>
            )}
          </div>
        )}

        <p className={styles.nota}>
          Solo administradores. Reconstruye la analítica diaria (no afecta a pedidos ni precios).
        </p>
      </div>
    </GlassCard>
  );
}
