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
 *    - { fromDay, toDay }  (rango, ambos 'YYYY-MM-DD', tope 120 días)
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

// Tope de seguridad espejo del de la Cloud Function (MAX_DAYS = 120).
const MAX_DIAS = 120;

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
const llamarBackfill = async (payload) => {
  try {
    const res = await httpsCallable(getFunctions(), 'aggregateAnalyticsDailyBackfill')(payload);
    return { error: null, data: res.data };
  } catch (e) {
    return { error: e?.message || 'Error en el servidor', data: null };
  }
};

export default function BackfillAnaliticaButton() {
  // Rango personalizado: por defecto, los últimos 30 días.
  const inicial = useMemo(() => presetUltimosDias(30), []);
  const [fromDay, setFromDay] = useState(inicial.fromDay);
  const [toDay, setToDay] = useState(inicial.toDay);

  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null); // { processed, ok, results }
  const [error, setError] = useState('');

  // Nº de días del rango actual y validación local (espejo del server: tope 120).
  const dias = useMemo(() => diasEnRango(fromDay, toDay), [fromDay, toDay]);
  const rangoValido = dias !== null && dias >= 1 && dias <= MAX_DIAS;

  // Lanza el backfill con un payload ya resuelto. Centraliza estado de carga,
  // limpieza de mensajes y mapeo de error/resultado para presets y rango manual.
  const ejecutar = async (payload) => {
    if (cargando) return;
    setCargando(true);
    setError('');
    setResultado(null);
    const { error: err, data } = await llamarBackfill(payload);
    if (err) {
      setError(err);
    } else {
      setResultado(data);
    }
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
      title="Reconstruir histórico de analítica"
      subtitle="Re-agrega los eventos crudos en los resúmenes diarios (analytics_daily)."
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
            Reconstruir histórico
          </GlassButton>
        </div>

        <p className={`${styles.hint} ${!rangoValido && dias !== null ? styles.hintError : ''}`}>
          {hint}
        </p>

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
