/**
 * Métricas de Firestore (base "(default)") en una ventana de tiempo: reglas
 * permitidas/rechazadas, listeners abiertos y conexiones. Sirve para saber si un
 * despliegue de reglas le cortó los datos a alguien (el ERP o la tienda).
 *
 *   node scripts/metricas-reglas.cjs <clave-servicio.json> [inicioISO] [finISO]
 *
 * Sin fechas: los últimos 30 minutos. Usa firebase-admin de functions/node_modules.
 * Referencia: 2026-10-02 (reglas solo-Walá) los listeners cayeron de ~430 a ~60 y
 * hubo ~30 000 errores de reglas cada 5 min; 2026-10-10 (reglas fusionadas) los
 * listeners siguieron en ~450 y hubo ~50 rechazos en total.
 */
const path = require('path')
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'))

const [keyPath, inicio, fin] = process.argv.slice(2)
if (!keyPath) {
  console.error('Uso: node scripts/metricas-reglas.cjs <clave-servicio.json> [inicioISO] [finISO]')
  process.exit(1)
}
const key = require(path.resolve(keyPath))
admin.initializeApp({ credential: admin.credential.cert(key) })

const end = fin || new Date().toISOString()
const start = inicio || new Date(Date.parse(end) - 30 * 60e3).toISOString()

async function serie(token, metrica, alineador, periodo, agrupar = []) {
  const p = new URLSearchParams({
    filter: `metric.type="firestore.googleapis.com/${metrica}" AND resource.label.database_id="(default)"`,
    'interval.startTime': start,
    'interval.endTime': end,
    'aggregation.alignmentPeriod': periodo,
    'aggregation.perSeriesAligner': alineador,
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  })
  agrupar.forEach((g) => p.append('aggregation.groupByFields', g))
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${key.project_id}/timeSeries?${p}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await r.json()
  if (j.error) throw new Error(`${metrica}: ${j.error.message}`)
  return j.timeSeries || []
}

const fila = (ts) =>
  ts.points
    .map((p) => `${p.interval.endTime.slice(11, 16)}=${Math.round(p.value.doubleValue ?? p.value.int64Value)}`)
    .reverse()
    .join(' ')

;(async () => {
  const token = (await admin.app().options.credential.getAccessToken()).access_token
  console.log(`Ventana ${start} → ${end} (horas en UTC; Lima = UTC-5)\n`)

  for (const ts of await serie(token, 'rules/evaluation_count', 'ALIGN_SUM', '300s', ['metric.label.result'])) {
    console.log(`reglas ${ts.metric.labels.result.padEnd(6)} | ${fila(ts)}`)
  }
  for (const ts of await serie(token, 'api/request_count', 'ALIGN_SUM', '300s', ['metric.label.api_method', 'metric.label.response_code'])) {
    const l = ts.metric.labels
    if (l.response_code === 'PERMISSION_DENIED') console.log(`rechazo ${l.api_method} | ${fila(ts)}`)
  }
  for (const [m, nombre] of [['network/snapshot_listeners', 'listeners'], ['network/active_connections', 'conexiones']]) {
    for (const ts of await serie(token, m, 'ALIGN_MEAN', '120s')) console.log(`${nombre.padEnd(10)} | ${fila(ts)}`)
  }
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
