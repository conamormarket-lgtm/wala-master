import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFlashOffers,
  createFlashOffer,
  updateFlashOffer,
  deleteFlashOffer,
} from '../../services/flashOffers';
import { computeSegments } from '../../services/intelligence';
import { Edit2, Trash2, BarChart3, Loader2 } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminFlashOffers.module.css';

const emptyForm = {
  title: '',
  productId: '',
  discountPct: 0,
  startsAt: '',
  endsAt: '',
  order: 0,
  active: true,
};

const AdminFlashOffers = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Segmentación (RFM)
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsResult, setSegmentsResult] = useState(null);
  const [segmentsError, setSegmentsError] = useState('');

  const { data: offersData, isLoading, error } = useQuery({
    queryKey: ['admin-flash-offers'],
    queryFn: async () => {
      const { data, error: err } = await getFlashOffers();
      if (err) throw new Error(err);
      return data;
    },
  });

  const offers = offersData ?? [];

  const resetForm = (nextOrder) =>
    setForm({ ...emptyForm, order: nextOrder ?? offers.length });

  const createMutation = useMutation({
    mutationFn: (data) => createFlashOffer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flash-offers'] });
      queryClient.invalidateQueries({ queryKey: ['flash-offers'] });
      resetForm((offersData?.length ?? 0) + 1);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateFlashOffer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flash-offers'] });
      queryClient.invalidateQueries({ queryKey: ['flash-offers'] });
      setEditingId(null);
      resetForm(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteFlashOffer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flash-offers'] });
      queryClient.invalidateQueries({ queryKey: ['flash-offers'] });
      setDeleteConfirm(null);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      productId: (form.productId || '').trim(),
      discountPct: Number(form.discountPct) || 0,
      startsAt: form.startsAt || '',
      endsAt: form.endsAt || '',
      order: Number(form.order) || 0,
      active: !!form.active,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (offer) => {
    setEditingId(offer.id);
    setForm({
      title: offer.title || '',
      productId: offer.productId || '',
      discountPct: offer.discountPct ?? 0,
      startsAt: offer.startsAt || '',
      endsAt: offer.endsAt || '',
      order: offer.order ?? 0,
      active: offer.active !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm(offers.length);
  };

  const handleRecomputeSegments = async () => {
    setSegmentsLoading(true);
    setSegmentsError('');
    setSegmentsResult(null);
    const { error: err, data } = await computeSegments();
    setSegmentsLoading(false);
    if (err) {
      setSegmentsError(err);
      return;
    }
    setSegmentsResult(data);
  };

  const counts = segmentsResult?.counts || {};

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Ofertas Flash</h1>
          <p className={styles.subtitle}>
            Crea promociones por tiempo limitado y segmenta a tus clientes (RFM).
          </p>
        </div>
      </div>

      {/* PANEL SEGMENTACIÓN */}
      <div className={styles.segmentCard}>
        <div className={styles.segmentInfo}>
          <h2 className={styles.cardTitle}>Inteligencia de clientes</h2>
          <p className={styles.helpText}>
            Recalcula la segmentación RFM (VIP, activo, en riesgo, nuevo) a partir de los pedidos pagados.
          </p>
          {segmentsError && <p className={styles.error}>{segmentsError}</p>}
          {segmentsResult && (
            <div className={styles.countsRow}>
              <span className={styles.countBadge}>Procesados: {segmentsResult.processed ?? 0}</span>
              {Object.entries(counts).map(([seg, n]) => (
                <span key={seg} className={styles.countBadge}>
                  {seg}: {n}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button type="button" onClick={handleRecomputeSegments} disabled={segmentsLoading}>
          {segmentsLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Recalculando…
            </>
          ) : (
            <>
              <BarChart3 size={16} /> Recalcular segmentos
            </>
          )}
        </Button>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Oferta' : 'Nueva Oferta'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label}>Título</label>
                <input
                  type="text"
                  placeholder="Ej. Liquidación de verano"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>ID de Producto (opcional)</label>
                <input
                  type="text"
                  placeholder="ID del producto asociado"
                  value={form.productId}
                  onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                  className={styles.input}
                />
                <p className={styles.helpText}>
                  Si la oferta aplica a un producto específico, pega aquí su ID.
                </p>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Descuento (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.discountPct}
                    onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Orden</label>
                  <input
                    type="number"
                    min="0"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Inicia</label>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Termina</label>
                  <input
                    type="date"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className={styles.checkbox}
                  />
                  <span>Oferta activa</span>
                </label>
              </div>

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Oferta'}
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
            <h2 className={styles.cardTitle}>Tus Ofertas</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.offersGrid}>
              {offers.map((offer) => (
                <div key={offer.id} className={styles.offerCard}>
                  <div className={styles.offerInfo}>
                    <div className={styles.offerTopRow}>
                      <span className={styles.discountPill}>-{offer.discountPct ?? 0}%</span>
                      <span
                        className={`${styles.statusBadge} ${
                          offer.active !== false ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {offer.active !== false ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <h3 className={styles.offerName}>{offer.title}</h3>
                    {offer.productId && (
                      <span className={styles.offerSlug}>Producto: {offer.productId}</span>
                    )}
                    <div className={styles.badgeRow}>
                      {offer.startsAt && (
                        <span className={styles.offerBadge}>Desde: {offer.startsAt}</span>
                      )}
                      {offer.endsAt && (
                        <span className={styles.offerBadge}>Hasta: {offer.endsAt}</span>
                      )}
                      <span className={styles.offerBadge}>Orden: {offer.order ?? 0}</span>
                    </div>
                  </div>
                  <div className={styles.offerActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEdit(offer)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(offer)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {offers.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes ofertas flash creadas todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar oferta?</h3>
            <p className={styles.modalText}>
              Estás a punto de eliminar <strong>{deleteConfirm.title}</strong>. Esta acción no se puede deshacer.
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

export default AdminFlashOffers;
