import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPayouts,
  createPayout,
  updatePayout,
  deletePayout,
  getVendorPayoutSummary,
  PAYOUT_STATUSES,
} from '../../services/payouts';
import { Edit2, Trash2, Wallet } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminPayouts.module.css';

const emptyForm = {
  vendorId: '',
  amount: 0,
  status: 'pending',
  note: '',
};

const statusLabel = (s) =>
  ({ pending: 'Por pagar', paid: 'Pagado', cancelled: 'Cancelado' }[s] || s);

const AdminPayouts = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: payoutsData, isLoading, error } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: async () => {
      const { data, error: err } = await getPayouts();
      if (err) throw new Error(err);
      return data;
    },
  });

  const { data: summaryData } = useQuery({
    queryKey: ['admin-payouts-summary'],
    queryFn: async () => {
      const { data, error: err } = await getVendorPayoutSummary();
      if (err) throw new Error(err);
      return data;
    },
  });

  const payouts = payoutsData ?? [];
  const summary = summaryData ?? [];

  const resetForm = () => setForm(emptyForm);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-payouts-summary'] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => createPayout(data),
    onSuccess: () => { invalidate(); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updatePayout(id, data),
    onSuccess: () => { invalidate(); setEditingId(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deletePayout(id),
    onSuccess: () => { invalidate(); setDeleteConfirm(null); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.vendorId.trim()) return;
    const payload = {
      vendorId: form.vendorId.trim(),
      amount: Number(form.amount) || 0,
      status: form.status,
      note: form.note.trim(),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setForm({
      vendorId: p.vendorId || '',
      amount: p.amount ?? 0,
      status: PAYOUT_STATUSES.includes(p.status) ? p.status : 'pending',
      note: p.note || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  // Prellenar el formulario desde una fila del resumen por vendedor.
  const handleUseSummary = (row) => {
    setEditingId(null);
    setForm({
      vendorId: row.vendorId,
      amount: row.pendingAmount,
      status: 'pending',
      note: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Pagos a Vendedores</h1>
          <p className={styles.subtitle}>
            Liquida a cada vendedor su parte (payout) de las sub-órdenes del marketplace.
          </p>
        </div>
      </div>

      {/* RESUMEN POR VENDEDOR (desde subOrders no pagadas) */}
      {summary.length > 0 && (
        <div className={styles.card} style={{ marginBottom: '2rem' }}>
          <h2 className={styles.cardTitle}>Por liquidar (según sub-órdenes)</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Sub-órdenes</th>
                <th>Monto pendiente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.vendorId}>
                  <td>{row.vendorId}</td>
                  <td>{row.subOrderCount}</td>
                  <td>S/ {row.pendingAmount.toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => handleUseSummary(row)}
                    >
                      Registrar pago
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Pago' : 'Nuevo Pago'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label}>ID del Vendedor</label>
                <input
                  type="text"
                  placeholder="vendorId"
                  value={form.vendorId}
                  onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Monto (S/)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className={styles.input}
                  >
                    {PAYOUT_STATUSES.map((s) => (
                      <option key={s} value={s}>{statusLabel(s)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Nota (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Transferencia BCP 12/06"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className={styles.input}
                />
              </div>

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Pago'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* LISTA */}
        <div className={styles.listSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Pagos Registrados</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.payoutsGrid}>
              {payouts.map((p) => (
                <div key={p.id} className={styles.payoutCard}>
                  <div className={styles.payoutVisual}>
                    <div className={styles.payoutIcon}>
                      <Wallet size={22} />
                    </div>
                  </div>
                  <div className={styles.payoutInfo}>
                    <h3 className={styles.payoutName}>{p.vendorId}</h3>
                    <div className={styles.badgeRow}>
                      <span className={styles.payoutBadge}>S/ {Number(p.amount ?? 0).toFixed(2)}</span>
                      <span
                        className={`${styles.statusBadge} ${
                          p.status === 'paid'
                            ? styles.statusPaid
                            : p.status === 'cancelled'
                            ? styles.statusCancelled
                            : styles.statusPending
                        }`}
                      >
                        {statusLabel(p.status)}
                      </span>
                    </div>
                    {p.note && <span className={styles.payoutNote}>{p.note}</span>}
                  </div>
                  <div className={styles.payoutActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEdit(p)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(p)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {payouts.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>Aún no has registrado pagos a vendedores.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar pago?</h3>
            <p className={styles.modalText}>
              Estás a punto de eliminar el pago a <strong>{deleteConfirm.vendorId}</strong> por
              S/ {Number(deleteConfirm.amount ?? 0).toFixed(2)}. Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                style={{ backgroundColor: '#ff4757', borderColor: '#ff4757' }}
              >
                Sí, eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayouts;
