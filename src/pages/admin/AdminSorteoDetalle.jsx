import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSorteoById,
  getParticipantes,
  asignarTicketsManual,
} from '../../services/sorteos';
import { ArrowLeft, Ticket, Trophy, Loader2, Smartphone } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminSorteoDetalle.module.css';

// Estado inicial del formulario de asignación manual de tickets.
const emptyAsignar = { correo: '', telefono: '', dni: '', cantidad: 1 };

const AdminSorteoDetalle = () => {
  const { id: sorteoId } = useParams();
  const queryClient = useQueryClient();
  const [asignar, setAsignar] = useState(emptyAsignar);
  const [asignarMsg, setAsignarMsg] = useState({ tipo: '', texto: '' });

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

          {/* DECIDIR GANADORES — se cablea en Build 3. */}
          <div className={styles.winnersBox}>
            <h3 className={styles.winnersTitle}>
              <Trophy size={16} /> Decidir ganadores
            </h3>
            <p className={styles.helpText}>Selecciona a los ganadores del sorteo de forma aleatoria.</p>
            <Button type="button" variant="outline" disabled title="Disponible en el siguiente paso">
              Decidir ganadores
            </Button>
            <p className={styles.note}>Disponible en el siguiente paso.</p>
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
    </div>
  );
};

export default AdminSorteoDetalle;
