import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCampaignById,
  getSuscriptores,
  getContadorSuscriptores,
  decidirGanadoresSuscripcion,
  grantChancesSuscripcion,
  formatoPrecioPen,
} from '../../services/suscripcionSorteos';
import {
  ArrowLeft,
  Trophy,
  Loader2,
  ShieldCheck,
  RefreshCw,
  X,
  Sparkles,
} from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminSuscripcionDetalle.module.css';

// Estado inicial del formulario de otorgar/quitar chances (permite negativo).
const emptyChances = { correo: '', telefono: '', dni: '', chances: 1, motivo: '' };

// Etiqueta legible del estado del suscriptor.
const ESTADO_SUS = {
  activo: 'Activo',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
  pendiente_pago: 'Pendiente de pago',
};

// Formatea un Timestamp de Firestore (o valor con seconds) como fecha local.
const fmtFecha = (t) => {
  const ms = t?.toMillis?.() ?? (t?.seconds ? t.seconds * 1000 : null);
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const AdminSuscripcionDetalle = () => {
  const { id: campaignId } = useParams();
  const queryClient = useQueryClient();

  // Decidir ganadores: nº opcional, resultado (evidencia) y modal.
  const [numGanadores, setNumGanadores] = useState('');
  const [draw, setDraw] = useState(null);
  const [drawMsg, setDrawMsg] = useState({ tipo: '', texto: '' });
  const [drawModalOpen, setDrawModalOpen] = useState(false);

  // Otorgar/quitar chances manual.
  const [chances, setChances] = useState(emptyChances);
  const [chancesMsg, setChancesMsg] = useState({ tipo: '', texto: '' });

  // Cabecera de la campaña.
  const { data: campaign } = useQuery({
    queryKey: ['admin-suscripcion-campaign', campaignId],
    queryFn: async () => {
      const { data, error } = await getCampaignById(campaignId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!campaignId,
  });

  // Contador autoritativo de suscriptores (suma de shards).
  const { data: contadorData } = useQuery({
    queryKey: ['admin-suscripcion-contador', campaignId],
    queryFn: async () => {
      const { data } = await getContadorSuscriptores(campaignId);
      return data;
    },
    enabled: !!campaignId,
  });
  const contador = contadorData ?? 0;

  // Suscriptores (subcolección; SOLO admin, con tope de lectura).
  const {
    data: suscriptoresData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-suscripcion-suscriptores', campaignId],
    queryFn: async () => {
      const { data, error: err } = await getSuscriptores(campaignId);
      if (err) throw new Error(err);
      return data;
    },
    enabled: !!campaignId,
  });
  const suscriptores = suscriptoresData ?? [];

  // ── DECIDIR GANADORES / RE-SORTEAR ─────────────────────────────────────────
  // El sorteo real (elegibilidad = solo suscriptores vigentes + ponderación por
  // chances) lo ejecuta el servidor. Aquí solo disparamos la CF y mostramos
  // ganadores + evidencia auditable. En re-sorteo se excluyen los previos.
  const decidirMutation = useMutation({
    mutationFn: ({ excluirUids } = {}) =>
      decidirGanadoresSuscripcion({
        campaignId,
        numGanadores:
          Number.isFinite(Number(numGanadores)) && Number(numGanadores) > 0
            ? Number(numGanadores)
            : undefined,
        excluirUids,
      }),
    onSuccess: ({ data, error: err }) => {
      if (err) {
        setDrawMsg({ tipo: 'error', texto: err });
        return;
      }
      setDraw(data);
      setDrawModalOpen(true);
      setDrawMsg({ tipo: 'ok', texto: 'Sorteo ejecutado en el servidor.' });
      queryClient.invalidateQueries({ queryKey: ['admin-suscripcion-campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['admin-suscripcion-suscriptores', campaignId] });
    },
    onError: (e) => {
      setDrawMsg({ tipo: 'error', texto: e?.message || 'No se pudo decidir los ganadores.' });
    },
  });

  const handleDecidir = () => {
    setDrawMsg({ tipo: '', texto: '' });
    decidirMutation.mutate({});
  };

  const handleResortear = () => {
    setDrawMsg({ tipo: '', texto: '' });
    const previos = (draw?.ganadores || campaign?.ganadores || [])
      .map((g) => g.uid)
      .filter(Boolean);
    decidirMutation.mutate({ excluirUids: previos });
  };

  // ── OTORGAR / QUITAR CHANCES MANUAL ────────────────────────────────────────
  const chancesMutation = useMutation({
    mutationFn: (payload) => grantChancesSuscripcion(payload),
    onSuccess: ({ data, error: err }) => {
      if (err) {
        setChancesMsg({ tipo: 'error', texto: err });
        return;
      }
      const total = data?.chancesTotal;
      setChancesMsg({
        tipo: 'ok',
        texto:
          typeof total === 'number'
            ? `Chances actualizadas. Total del suscriptor: ${total}.`
            : 'Chances actualizadas correctamente.',
      });
      setChances(emptyChances);
      queryClient.invalidateQueries({ queryKey: ['admin-suscripcion-suscriptores', campaignId] });
    },
    onError: (e) => {
      setChancesMsg({ tipo: 'error', texto: e?.message || 'No se pudieron ajustar las chances.' });
    },
  });

  const handleChances = (e) => {
    e.preventDefault();
    setChancesMsg({ tipo: '', texto: '' });
    if (!chances.correo.trim() && !chances.telefono.trim() && !chances.dni.trim()) {
      setChancesMsg({ tipo: 'error', texto: 'Indica correo, teléfono o DNI del suscriptor.' });
      return;
    }
    const n = Math.trunc(Number(chances.chances));
    if (!Number.isFinite(n) || n === 0) {
      setChancesMsg({
        tipo: 'error',
        texto: 'Las chances deben ser un entero distinto de 0 (puede ser negativo).',
      });
      return;
    }
    chancesMutation.mutate({
      campaignId,
      correo: chances.correo.trim() || undefined,
      telefono: chances.telefono.trim() || undefined,
      dni: chances.dni.trim() || undefined,
      chances: n,
      motivo: chances.motivo.trim() || undefined,
    });
  };

  const estado = campaign?.estado || '';
  const cerrado = estado === 'cerrado';
  const ganadoresGuardados = Array.isArray(campaign?.ganadores) ? campaign.ganadores : [];

  // Mapa planId → nombre del plan (para mostrar el plan legible en la tabla).
  const planNombre = (planId) =>
    campaign?.planes?.find((p) => p.id === planId)?.nombre || planId || '—';
  // El precio NO se guarda en el suscriptor; se deriva del plan de la campaña por planId.
  const planPrecioCentimos = (planId) =>
    Number(campaign?.planes?.find((p) => p.id === planId)?.precioCentimos) || 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Link to="/admin/sorteos-suscripcion" className={styles.backLink}>
          <ArrowLeft size={16} /> Volver a campañas
        </Link>
        <h1 className={styles.title}>{campaign?.titulo || 'Campaña de suscripción'}</h1>
        <p className={styles.subtitle}>
          {contador} suscriptor{contador === 1 ? '' : 'es'}
          {campaign?.estado ? ` · Estado: ${campaign.estado}` : ''}
        </p>
      </div>

      <div className={styles.contentGrid}>
        {/* PANEL DE ACCIONES */}
        <div className={styles.card}>
          {/* DECIDIR GANADORES */}
          <div className={styles.actionBlock}>
            <h2 className={styles.cardTitle}>
              <Trophy size={18} /> Decidir ganadores
            </h2>
            <p className={styles.helpText}>
              El servidor elige a los ganadores de forma aleatoria y ponderada por chances,
              considerando SOLO a los suscriptores vigentes. El resultado es auditable (semilla +
              hash del pool).
            </p>

            <p className={styles.statusLine}>
              Estado de la campaña:{' '}
              <span className={cerrado ? styles.statusClosed : styles.statusOpen}>
                {estado || '—'}
              </span>
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Nº de ganadores (opcional)</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder={`${campaign?.numGanadores || 1} (por defecto)`}
                value={numGanadores}
                onChange={(e) => setNumGanadores(e.target.value)}
                className={styles.input}
              />
            </div>

            <Button type="button" onClick={handleDecidir} disabled={decidirMutation.isPending || !campaignId}>
              {decidirMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sorteando…
                </>
              ) : (
                <>
                  <Trophy size={16} /> {cerrado ? 'Volver a decidir ganadores' : 'Decidir ganadores'}
                </>
              )}
            </Button>

            {(draw?.ganadores?.length || ganadoresGuardados.length) ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleResortear}
                disabled={decidirMutation.isPending}
                className={styles.resortearBtn}
              >
                <RefreshCw size={16} /> Re-sortear (excluir ganadores actuales)
              </Button>
            ) : null}

            {drawMsg.texto && (
              <p className={drawMsg.tipo === 'error' ? styles.error : styles.success}>
                {drawMsg.texto}
              </p>
            )}

            {ganadoresGuardados.length > 0 && !drawModalOpen && (
              <div className={styles.savedWinners}>
                <p className={styles.savedWinnersTitle}>
                  <Trophy size={14} /> Ganadores actuales
                </p>
                <ul className={styles.winnersList}>
                  {ganadoresGuardados.map((g, i) => (
                    <li key={g.uid || i}>
                      <strong>{g.nombre || g.uid || '—'}</strong>
                    </li>
                  ))}
                </ul>
                {draw ? (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setDrawModalOpen(true)}
                  >
                    Ver evidencia del último sorteo
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* OTORGAR CHANCES */}
          <div className={styles.actionBlock}>
            <h2 className={styles.cardTitle}>
              <Sparkles size={18} /> Otorgar chances
            </h2>
            <p className={styles.helpText}>
              Ajusta las chances de un suscriptor (correo, teléfono o DNI). Puedes usar un número
              negativo para restar. Lo aplica el servidor.
            </p>
            <form className={styles.form} onSubmit={handleChances}>
              <div className={styles.field}>
                <label className={styles.label}>Correo</label>
                <input
                  type="email"
                  placeholder="cliente@correo.com"
                  value={chances.correo}
                  onChange={(e) => setChances((c) => ({ ...c, correo: e.target.value }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Teléfono</label>
                  <input
                    type="tel"
                    placeholder="999888777"
                    value={chances.telefono}
                    onChange={(e) => setChances((c) => ({ ...c, telefono: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>DNI</label>
                  <input
                    type="text"
                    placeholder="12345678"
                    value={chances.dni}
                    onChange={(e) => setChances((c) => ({ ...c, dni: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Chances (± permite negativo)</label>
                  <input
                    type="number"
                    step="1"
                    value={chances.chances}
                    onChange={(e) => setChances((c) => ({ ...c, chances: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label className={styles.label}>Motivo (opcional)</label>
                  <input
                    type="text"
                    placeholder="Compensación, promo…"
                    value={chances.motivo}
                    onChange={(e) => setChances((c) => ({ ...c, motivo: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>

              {chancesMsg.texto && (
                <p className={chancesMsg.tipo === 'error' ? styles.error : styles.success}>
                  {chancesMsg.texto}
                </p>
              )}

              <Button type="submit" disabled={chancesMutation.isPending}>
                {chancesMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Aplicando…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Aplicar chances
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* TABLA DE SUSCRIPTORES */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            Suscriptores{' '}
            {contador > suscriptores.length
              ? `(Mostrando ${suscriptores.length} de ${contador})`
              : suscriptores.length
              ? `(${suscriptores.length})`
              : ''}
          </h2>
          {suscriptores.length > 0 && (
            <p className={styles.note}>
              Esta vista muestra una parte de los suscriptores. Al decidir ganadores, el servidor
              considera a TODOS los suscriptores vigentes, no solo los que se ven aquí.
            </p>
          )}

          {isLoading && <p className={styles.loading}>Cargando suscriptores…</p>}
          {error && <p className={styles.error}>{error.message}</p>}

          {!isLoading && suscriptores.length === 0 && (
            <div className={styles.emptyState}>
              <p>Aún no hay suscriptores en esta campaña.</p>
            </div>
          )}

          {suscriptores.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Plan</th>
                    <th>Estado</th>
                    <th>Vigencia</th>
                    <th className={styles.numCol}>Chances</th>
                    <th>Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {suscriptores.map((s) => (
                    <tr key={s.id}>
                      <td>{s.nombre || s.nombres || s.correo || s.id || '—'}</td>
                      <td>
                        {planNombre(s.planId)}
                        {planPrecioCentimos(s.planId) > 0 ? (
                          <span className={styles.planPrecio}>
                            {' '}
                            · {formatoPrecioPen(planPrecioCentimos(s.planId))}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={`${styles.estadoBadge} ${
                            styles[`estado_${s.estado}`] || ''
                          }`}
                        >
                          {ESTADO_SUS[s.estado] || s.estado || '—'}
                        </span>
                      </td>
                      <td>{fmtFecha(s.vigenciaHasta)}</td>
                      <td className={styles.numCol}>{s.chancesTotal ?? 0}</td>
                      <td>
                        <span className={styles.metodoBadge}>{s.metodoPago || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: GANADORES + EVIDENCIA AUDITABLE */}
      {drawModalOpen && draw && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Resultado del sorteo"
          onClick={() => setDrawModalOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Trophy size={18} /> Ganadores del sorteo
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDrawModalOpen(false)}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {Array.isArray(draw.ganadores) && draw.ganadores.length > 0 ? (
              <div className={styles.winnersGrid}>
                {draw.ganadores.map((g, i) => (
                  <div key={g.uid || i} className={styles.winnerCard}>
                    <span className={styles.winnerRank}>#{i + 1}</span>
                    <div className={styles.winnerInfo}>
                      <strong>{g.nombre || g.uid || '—'}</strong>
                      {g.correo && <span className={styles.winnerMeta}>{g.correo}</span>}
                    </div>
                    {typeof g.pesoUsado === 'number' && (
                      <span className={styles.winnerPeso} title="Peso usado en el sorteo ponderado">
                        peso {g.pesoUsado}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.helpText}>
                El servidor no devolvió ganadores (¿no había suscriptores elegibles?).
              </p>
            )}

            <div className={styles.evidenceBox}>
              <p className={styles.evidenceTitle}>
                <ShieldCheck size={15} /> Evidencia (sorteo verificable server-side)
              </p>
              <dl className={styles.evidenceList}>
                <div className={styles.evidenceRow}>
                  <dt>Draw ID</dt>
                  <dd className={styles.monoBreak}>{draw.drawId || '—'}</dd>
                </div>
                <div className={styles.evidenceRow}>
                  <dt>Total elegibles</dt>
                  <dd>{Number.isFinite(Number(draw.totalElegibles)) ? draw.totalElegibles : '—'}</dd>
                </div>
                <div className={styles.evidenceRow}>
                  <dt>Semilla (seed)</dt>
                  <dd className={styles.monoBreak}>{draw.seed || '—'}</dd>
                </div>
                {draw.poolHash && (
                  <div className={styles.evidenceRow}>
                    <dt>Hash del pool</dt>
                    <dd className={styles.monoBreak}>{draw.poolHash}</dd>
                  </div>
                )}
              </dl>
              <p className={styles.note}>
                La semilla y el hash permiten verificar el resultado de forma independiente. El
                sorteo se ejecutó íntegramente en el servidor.
              </p>
            </div>

            <div className={styles.modalActions}>
              <Button
                type="button"
                variant="outline"
                onClick={handleResortear}
                disabled={decidirMutation.isPending}
              >
                {decidirMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Re-sorteando…
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} /> Re-sortear (excluir estos ganadores)
                  </>
                )}
              </Button>
              <Button type="button" onClick={() => setDrawModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSuscripcionDetalle;
