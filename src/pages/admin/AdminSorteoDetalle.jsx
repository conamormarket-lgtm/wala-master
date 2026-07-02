import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSorteoById,
  getParticipantes,
  asignarTicketsManual,
  decidirGanadoresSorteo,
  grantRaffleChancesSecure,
} from '../../services/sorteos';
import {
  ArrowLeft,
  Ticket,
  Trophy,
  Loader2,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  X,
  Sparkles,
} from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminSorteoDetalle.module.css';

// Estado inicial del formulario de asignación manual de tickets.
const emptyAsignar = { correo: '', telefono: '', dni: '', cantidad: 1 };
// Estado inicial del formulario de otorgar/quitar chances (permite negativo).
const emptyChances = { correo: '', telefono: '', dni: '', chances: 1, motivo: '' };

const AdminSorteoDetalle = () => {
  const { id: sorteoId } = useParams();
  const queryClient = useQueryClient();
  const [asignar, setAsignar] = useState(emptyAsignar);
  const [asignarMsg, setAsignarMsg] = useState({ tipo: '', texto: '' });

  // Estado de "Decidir ganadores": nº de ganadores (opcional, default sorteo),
  // resultado del sorteo (ganadores + evidencia auditable) y errores.
  const [numGanadores, setNumGanadores] = useState('');
  const [draw, setDraw] = useState(null); // resultado devuelto por la CF (res.data)
  const [drawMsg, setDrawMsg] = useState({ tipo: '', texto: '' });
  const [drawModalOpen, setDrawModalOpen] = useState(false);

  // Estado del formulario de otorgar/quitar chances manual.
  const [chances, setChances] = useState(emptyChances);
  const [chancesMsg, setChancesMsg] = useState({ tipo: '', texto: '' });

  // Cabecera del sorteo (título, estado, etc.).
  const { data: sorteo } = useQuery({
    queryKey: ['admin-sorteo', sorteoId],
    queryFn: async () => {
      const { data, error } = await getSorteoById(sorteoId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!sorteoId,
  });

  // Participantes (subcolección; SOLO admin, con tope de lectura).
  const {
    data: participantesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-sorteo-participantes', sorteoId],
    queryFn: async () => {
      const { data, error: err } = await getParticipantes(sorteoId);
      if (err) throw new Error(err);
      return data;
    },
    enabled: !!sorteoId,
  });

  const participantes = participantesData ?? [];

  const asignarMutation = useMutation({
    mutationFn: (payload) => asignarTicketsManual(payload),
    onSuccess: ({ data, error: err }) => {
      if (err) {
        setAsignarMsg({ tipo: 'error', texto: err });
        return;
      }
      setAsignarMsg({ tipo: 'ok', texto: 'Tickets asignados correctamente.' });
      setAsignar(emptyAsignar);
      // Refresca la tabla de participantes tras la asignación.
      queryClient.invalidateQueries({ queryKey: ['admin-sorteo-participantes', sorteoId] });
    },
    onError: (e) => {
      setAsignarMsg({ tipo: 'error', texto: e?.message || 'No se pudieron asignar los tickets.' });
    },
  });

  const handleAsignar = (e) => {
    e.preventDefault();
    setAsignarMsg({ tipo: '', texto: '' });
    // Se exige al menos un identificador (correo, teléfono o DNI) y cantidad > 0.
    if (!asignar.correo.trim() && !asignar.telefono.trim() && !asignar.dni.trim()) {
      setAsignarMsg({ tipo: 'error', texto: 'Indica correo, teléfono o DNI del participante.' });
      return;
    }
    if ((Number(asignar.cantidad) || 0) <= 0) {
      setAsignarMsg({ tipo: 'error', texto: 'La cantidad debe ser mayor a 0.' });
      return;
    }
    asignarMutation.mutate({
      sorteoId,
      correo: asignar.correo.trim() || undefined,
      telefono: asignar.telefono.trim() || undefined,
      dni: asignar.dni.trim() || undefined,
      cantidad: Number(asignar.cantidad) || 0,
    });
  };

  // ── DECIDIR GANADORES / RE-SORTEAR ──────────────────────────────────────────
  // El sorteo real (RNG + elegibilidad + ponderación) lo hace el servidor. Aquí
  // solo disparamos la CF y mostramos ganadores + evidencia. En re-sorteo, se
  // envían los uids de los ganadores previos como excluirUids.
  const decidirMutation = useMutation({
    mutationFn: ({ excluirUids } = {}) =>
      decidirGanadoresSorteo({
        sorteoId,
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
      // Un cierre puede cambiar el estado del sorteo y los datos de ganadores:
      // refrescamos cabecera y participantes.
      queryClient.invalidateQueries({ queryKey: ['admin-sorteo', sorteoId] });
      queryClient.invalidateQueries({ queryKey: ['admin-sorteo-participantes', sorteoId] });
    },
    onError: (e) => {
      setDrawMsg({ tipo: 'error', texto: e?.message || 'No se pudo decidir los ganadores.' });
    },
  });

  const handleDecidir = () => {
    setDrawMsg({ tipo: '', texto: '' });
    // Modo cierre: sin excluirUids.
    decidirMutation.mutate({});
  };

  const handleResortear = () => {
    setDrawMsg({ tipo: '', texto: '' });
    // Excluimos a los ganadores actuales (los del último draw o los del doc).
    const previos = (draw?.ganadores || sorteo?.ganadores || [])
      .map((g) => g.uid)
      .filter(Boolean);
    decidirMutation.mutate({ excluirUids: previos });
  };

  // ── OTORGAR / QUITAR CHANCES MANUAL ─────────────────────────────────────────
  const chancesMutation = useMutation({
    mutationFn: (payload) => grantRaffleChancesSecure(payload),
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
            ? `Chances actualizadas. Total del participante: ${total}.`
            : 'Chances actualizadas correctamente.',
      });
      setChances(emptyChances);
      // Refresca la tabla de participantes para reflejar el nuevo chancesTotal.
      queryClient.invalidateQueries({ queryKey: ['admin-sorteo-participantes', sorteoId] });
    },
    onError: (e) => {
      setChancesMsg({ tipo: 'error', texto: e?.message || 'No se pudieron ajustar las chances.' });
    },
  });

  const handleChances = (e) => {
    e.preventDefault();
    setChancesMsg({ tipo: '', texto: '' });
    // Al menos un identificador (correo, teléfono o DNI).
    if (!chances.correo.trim() && !chances.telefono.trim() && !chances.dni.trim()) {
      setChancesMsg({ tipo: 'error', texto: 'Indica correo, teléfono o DNI del participante.' });
      return;
    }
    // chances entero distinto de 0 (negativo permitido para restar).
    const n = Math.trunc(Number(chances.chances));
    if (!Number.isFinite(n) || n === 0) {
      setChancesMsg({ tipo: 'error', texto: 'Las chances deben ser un entero distinto de 0 (puede ser negativo).' });
      return;
    }
    chancesMutation.mutate({
      sorteoId,
      correo: chances.correo.trim() || undefined,
      telefono: chances.telefono.trim() || undefined,
      dni: chances.dni.trim() || undefined,
      chances: n,
      motivo: chances.motivo.trim() || undefined,
    });
  };

  // Estado del sorteo (cerrado si su estado no es "activo"/"borrador") y lista
  // de ganadores ya persistida en el doc, para mostrarla aunque no se acabe de
  // ejecutar el sorteo en esta sesión.
  const estado = sorteo?.estado || '';
  const cerrado = estado === 'cerrado' || estado === 'finalizado';
  const ganadoresGuardados = Array.isArray(sorteo?.ganadores) ? sorteo.ganadores : [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Link to="/admin/sorteos" className={styles.backLink}>
          <ArrowLeft size={16} /> Volver a sorteos
        </Link>
        <h1 className={styles.title}>{sorteo?.titulo || 'Sorteo'}</h1>
        <p className={styles.subtitle}>
          {sorteo?.tipo === 'pagado'
            ? `Rifa · ticket S/ ${sorteo?.precioTicket ?? 0}`
            : 'Sorteo gratuito'}
          {sorteo?.estado ? ` · Estado: ${sorteo.estado}` : ''}
        </p>
      </div>

      <div className={styles.contentGrid}>
        {/* ASIGNAR TICKETS MANUAL */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Ticket size={18} /> Asignar tickets manual
          </h2>
          <p className={styles.helpText}>
            Busca al participante por correo, teléfono o DNI y súmale tickets. La asignación la
            realiza el servidor.
          </p>
          <form className={styles.form} onSubmit={handleAsignar}>
            <div className={styles.field}>
              <label className={styles.label}>Correo</label>
              <input
                type="email"
                placeholder="cliente@correo.com"
                value={asignar.correo}
                onChange={(e) => setAsignar((a) => ({ ...a, correo: e.target.value }))}
                className={styles.input}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>Teléfono</label>
                <input
                  type="tel"
                  placeholder="999888777"
                  value={asignar.telefono}
                  onChange={(e) => setAsignar((a) => ({ ...a, telefono: e.target.value }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>DNI</label>
                <input
                  type="text"
                  placeholder="12345678"
                  value={asignar.dni}
                  onChange={(e) => setAsignar((a) => ({ ...a, dni: e.target.value }))}
                  className={styles.input}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Cantidad de tickets</label>
              <input
                type="number"
                min="1"
                step="1"
                value={asignar.cantidad}
                onChange={(e) => setAsignar((a) => ({ ...a, cantidad: e.target.value }))}
                className={styles.input}
              />
            </div>

            {asignarMsg.texto && (
              <p className={asignarMsg.tipo === 'error' ? styles.error : styles.success}>
                {asignarMsg.texto}
              </p>
            )}

            <Button type="submit" disabled={asignarMutation.isPending}>
              {asignarMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Asignando…
                </>
              ) : (
                <>
                  <Ticket size={16} /> Asignar tickets
                </>
              )}
            </Button>
          </form>

          {/* DECIDIR GANADORES — sorteo verificable server-side. */}
          <div className={styles.winnersBox}>
            <h3 className={styles.winnersTitle}>
              <Trophy size={16} /> Decidir ganadores
            </h3>
            <p className={styles.helpText}>
              El servidor elige a los ganadores de forma aleatoria y ponderada por chances,
              considerando SOLO a los participantes elegibles. El resultado es auditable
              (semilla + hash del pool).
            </p>

            {/* Estado del sorteo */}
            <p className={styles.statusLine}>
              Estado del sorteo:{' '}
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
                placeholder={`${sorteo?.numGanadores || 1} (por defecto)`}
                value={numGanadores}
                onChange={(e) => setNumGanadores(e.target.value)}
                className={styles.input}
              />
            </div>

            <Button
              type="button"
              onClick={handleDecidir}
              disabled={decidirMutation.isPending || !sorteoId}
            >
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

            {/* Re-sortear excluyendo a los ganadores actuales. */}
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

            {/* Ganadores ya persistidos en el doc del sorteo (si existen). */}
            {ganadoresGuardados.length > 0 && !drawModalOpen && (
              <div className={styles.savedWinners}>
                <p className={styles.savedWinnersTitle}>
                  <Trophy size={14} /> Ganadores actuales
                </p>
                <ul className={styles.winnersList}>
                  {ganadoresGuardados.map((g, i) => (
                    <li key={g.uid || i}>
                      <strong>{g.nombre || g.uid || '—'}</strong>
                      {g.correo ? ` · ${g.correo}` : ''}
                      {g.telefono ? ` · ${g.telefono}` : ''}
                    </li>
                  ))}
                </ul>
                {draw?.drawId || sorteo?.drawId ? (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setDrawModalOpen(true)}
                    disabled={!draw}
                  >
                    Ver evidencia del último sorteo
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* OTORGAR / QUITAR CHANCES MANUAL */}
          <div className={styles.winnersBox}>
            <h3 className={styles.winnersTitle}>
              <Sparkles size={16} /> Otorgar chances
            </h3>
            <p className={styles.helpText}>
              Ajusta las chances de un participante (correo, teléfono o DNI). Puedes usar un
              número negativo para restar chances. Lo aplica el servidor.
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

        {/* TABLA DE PARTICIPANTES */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            {/* Se muestran solo los primeros cargados (tope de lectura, ~200). El
                total autoritativo es sorteo.contadorParticipantes cuando exista, para
                no confundir "cargados" con "total". */}
            Participantes{' '}
            {Number.isFinite(Number(sorteo?.contadorParticipantes)) &&
            Number(sorteo.contadorParticipantes) > participantes.length
              ? `(Mostrando ${participantes.length} de ${sorteo.contadorParticipantes})`
              : participantes.length
              ? `(${participantes.length})`
              : ''}
          </h2>
          {/* El sorteo real (Decidir ganadores) procesa TODOS los participantes
              server-side, no solo los que se ven en esta vista. */}
          {participantes.length > 0 && (
            <p className={styles.note}>
              Esta vista muestra una parte de los participantes. Al decidir ganadores, el
              servidor considera a TODOS los participantes, no solo los que se ven aquí.
            </p>
          )}

          {isLoading && <p className={styles.loading}>Cargando participantes...</p>}
          {error && <p className={styles.error}>{error.message}</p>}

          {!isLoading && participantes.length === 0 && (
            <div className={styles.emptyState}>
              <p>Aún no hay participantes en este sorteo.</p>
            </div>
          )}

          {participantes.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>DNI</th>
                    <th className={styles.numCol}>Tickets</th>
                    <th className={styles.numCol}>Pagados</th>
                    <th className={styles.numCol}>Chances</th>
                    <th>Estado</th>
                    <th>App</th>
                  </tr>
                </thead>
                <tbody>
                  {participantes.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre || '—'}</td>
                      <td className={styles.mono}>{p.correo || '—'}</td>
                      <td>{p.telefono || '—'}</td>
                      <td>{p.dni || '—'}</td>
                      <td className={styles.numCol}>{p.tickets ?? 0}</td>
                      <td className={styles.numCol}>{p.ticketsPagados ?? 0}</td>
                      <td className={styles.numCol}>{p.chancesTotal ?? 0}</td>
                      <td>
                        <span className={styles.estadoBadge}>{p.estado || '—'}</span>
                      </td>
                      <td>
                        {p.origenApp ? (
                          <span className={styles.appBadge}>
                            <Smartphone size={12} /> App
                          </span>
                        ) : (
                          <span className={styles.webBadge}>Web</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: GANADORES + EVIDENCIA AUDITABLE ─────────────────────────────── */}
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

            {/* Lista de ganadores devueltos por el servidor. */}
            {Array.isArray(draw.ganadores) && draw.ganadores.length > 0 ? (
              <div className={styles.winnersGrid}>
                {draw.ganadores.map((g, i) => (
                  <div key={g.uid || i} className={styles.winnerCard}>
                    <span className={styles.winnerRank}>#{i + 1}</span>
                    <div className={styles.winnerInfo}>
                      <strong>{g.nombre || g.uid || '—'}</strong>
                      <span className={styles.winnerMeta}>{g.correo || 'sin correo'}</span>
                      <span className={styles.winnerMeta}>{g.telefono || 'sin teléfono'}</span>
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
                El servidor no devolvió ganadores (¿no había participantes elegibles?).
              </p>
            )}

            {/* Evidencia auditable: prueba de que el sorteo es verificable. */}
            <div className={styles.evidenceBox}>
              <p className={styles.evidenceTitle}>
                <ShieldCheck size={15} /> Evidencia (sorteo verificable server-side)
              </p>
              <dl className={styles.evidenceList}>
                <div className={styles.evidenceRow}>
                  <dt>Draw ID</dt>
                  <dd className={styles.mono}>{draw.drawId || '—'}</dd>
                </div>
                <div className={styles.evidenceRow}>
                  <dt>Total elegibles</dt>
                  <dd>{Number.isFinite(Number(draw.totalElegibles)) ? draw.totalElegibles : '—'}</dd>
                </div>
                <div className={styles.evidenceRow}>
                  <dt>Semilla (seed)</dt>
                  <dd className={styles.monoBreak}>{draw.seed || '—'}</dd>
                </div>
                {(draw.poolHash || draw.hashPool || draw.hash) && (
                  <div className={styles.evidenceRow}>
                    <dt>Hash del pool</dt>
                    <dd className={styles.monoBreak}>
                      {draw.poolHash || draw.hashPool || draw.hash}
                    </dd>
                  </div>
                )}
              </dl>
              <p className={styles.note}>
                La semilla y el hash permiten verificar el resultado de forma independiente.
                El sorteo se ejecutó íntegramente en el servidor.
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

export default AdminSorteoDetalle;
