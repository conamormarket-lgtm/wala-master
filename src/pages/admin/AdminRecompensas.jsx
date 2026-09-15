import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRewards, createReward, updateReward, deleteReward } from '../../services/rewardsCatalog';
import { uploadFile } from '../../services/firebase/storage';
import { textoPremio } from '../../utils/ruletaModel';
import { Edit2, Trash2, Gift, PackageOpen, ImagePlus, Loader2 } from 'lucide-react';
import Button from '../../components/common/Button';
import AdminImageCropper from '../../components/admin/AdminImageCropper/AdminImageCropper';
import BuscadorProducto from '../../components/admin/BuscadorProducto/BuscadorProducto';
import styles from './AdminRecompensas.module.css';

// Mismo vocabulario que los premios de la Ruleta (ver src/utils/ruletaModel.js):
// así redeemRewardSecure puede generar el mismo cupón auto-aplicable que ya
// genera spinRuletaSecure. Se excluyen 'monedas' (no tiene sentido pagar
// monedas para ganar monedas) y 'nada' (son propios del sorteo de la ruleta).
const ETIQUETA_TIPO = {
  manual: 'Se entrega a mano (sin cupón automático)',
  descuento: 'Descuento en el pedido (cupón automático)',
  producto_descuento: 'Descuento en un producto (cupón automático)',
  producto_gratis: 'Producto gratis (cupón automático)',
  envio_gratis: 'Envío gratis (cupón automático)',
};
const TIPOS_RECOMPENSA = Object.keys(ETIQUETA_TIPO);
const NECESITA_PRODUCTO = ['producto_descuento', 'producto_gratis'];
const TIPOS_CON_VIGENCIA = ['descuento', 'producto_descuento', 'producto_gratis', 'envio_gratis'];

const emptyForm = {
  title: '',
  description: '',
  cost: 0,
  value: '',
  order: 0,
  active: true,
  tipo: 'manual',
  descuentoPct: 0,
  descuentoMonto: 0,
  topeDescuento: 0,
  productId: '',
  productName: '',
  vigenciaDias: 30,
  imageUrl: '',
};

// Texto de lo que gana el cliente, calculado igual que en la Ruleta
// (textoPremio) para que ambos catálogos "hablen" igual. Vacío para 'manual':
// ahí no hay nada que calcular, el título ya lo dice todo.
const beneficioDe = (r) => {
  if (!r || !r.tipo || r.tipo === 'manual') return '';
  return textoPremio({
    tipo: r.tipo,
    nombre: r.title,
    descuentoPct: Number(r.descuentoPct) || 0,
    descuentoMonto: Number(r.descuentoMonto) || 0,
    topeDescuento: Number(r.topeDescuento) || 0,
    productName: r.productName,
    monedas: 0,
  });
};

// Extraída del map original (antes vivía duplicada -misma tarjeta- para
// poder separar Activas de Inactivas sin repetir el JSX dos veces).
const RewardCard = ({ reward, onEdit, onDelete }) => {
  const beneficio = beneficioDe(reward);
  return (
  <div className={styles.rewardCard}>
    <div className={styles.rewardVisual}>
      {reward.imageUrl ? (
        <img src={reward.imageUrl} alt={reward.title} className={styles.rewardImage} />
      ) : (
        <div className={styles.rewardBubble}>
          <Gift size={22} />
        </div>
      )}
    </div>
    <div className={styles.rewardInfo}>
      <h3 className={styles.rewardName}>{reward.title}</h3>
      {reward.description && (
        <p className={styles.rewardDesc}>{reward.description}</p>
      )}
      <div className={styles.badgeRow}>
        <span className={styles.costBadge}>{reward.cost ?? 0} pts</span>
        {beneficio && <span className={styles.rewardBadge}>{beneficio}</span>}
        <span className={styles.rewardBadge}>Orden: {reward.order ?? 0}</span>
        <span
          className={`${styles.statusBadge} ${
            reward.active !== false ? styles.statusActive : styles.statusInactive
          }`}
        >
          {reward.active !== false ? 'Activa' : 'Inactiva'}
        </span>
      </div>
      {!beneficio && reward.value && (
        <span className={styles.rewardValue}>{reward.value}</span>
      )}
    </div>
    <div className={styles.rewardActions}>
      <button
        type="button"
        className={styles.actionBtn}
        onClick={() => onEdit(reward)}
        title="Editar"
      >
        <Edit2 size={16} />
      </button>
      <button
        type="button"
        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
        onClick={() => onDelete(reward)}
        title="Eliminar"
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
  );
};

const AdminRecompensas = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  const { data: rewardsData, isLoading, error } = useQuery({
    queryKey: ['admin-rewards'],
    queryFn: async () => {
      const { data, error: err } = await getRewards();
      if (err) throw new Error(err);
      return data;
    }
  });

  const rewards = rewardsData ?? [];

  // Separadas en dos grupos -en vez de una sola grilla mezclada- para que se
  // pueda distinguir de un vistazo qué está realmente visible para canje
  // (Activas) de lo que quedó pausado (Inactivas), sin tener que leer el
  // badge de estado de cada tarjeta una por una.
  const { activas, inactivas } = useMemo(() => {
    const act = [];
    const inact = [];
    for (const r of rewards) (r.active !== false ? act : inact).push(r);
    return { activas: act, inactivas: inact };
  }, [rewards]);

  const resetForm = (nextOrder) =>
    setForm({ ...emptyForm, order: nextOrder ?? rewards.length });

  const createMutation = useMutation({
    mutationFn: (data) => createReward(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      resetForm((rewardsData?.length ?? 0) + 1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateReward(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      setEditingId(null);
      resetForm(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteReward(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) return;

    if (NECESITA_PRODUCTO.includes(form.tipo) && !form.productId) {
      setFormError('Elige el producto de la recompensa.');
      return;
    }
    // Un porcentaje sin techo se aplica sobre el subtotal que calcula el
    // carrito, y ahí caben productos personalizados cuyo precio no está en el
    // catálogo: sin tope, el cupón es un cheque en blanco (mismo criterio que
    // la Ruleta, ver AdminRuletaPage.jsx).
    if (form.tipo === 'descuento' && Number(form.descuentoPct) > 0 && Number(form.topeDescuento) <= 0) {
      setFormError('Pon un tope en soles para el descuento por porcentaje.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      cost: Number(form.cost) || 0,
      value: form.value.trim(),
      order: Number(form.order) || 0,
      active: !!form.active,
      tipo: form.tipo,
      descuentoPct: Number(form.descuentoPct) || 0,
      descuentoMonto: Number(form.descuentoMonto) || 0,
      topeDescuento: Number(form.topeDescuento) || 0,
      productId: NECESITA_PRODUCTO.includes(form.tipo) ? form.productId : '',
      productName: NECESITA_PRODUCTO.includes(form.tipo) ? form.productName : '',
      vigenciaDias: Number(form.vigenciaDias) || 30,
      imageUrl: form.imageUrl || '',
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (reward) => {
    setEditingId(reward.id);
    setFormError('');
    setForm({
      title: reward.title || '',
      description: reward.description || '',
      cost: reward.cost ?? 0,
      value: reward.value || '',
      order: reward.order ?? 0,
      active: reward.active !== false,
      tipo: reward.tipo || 'manual',
      descuentoPct: reward.descuentoPct || 0,
      descuentoMonto: reward.descuentoMonto || 0,
      topeDescuento: reward.topeDescuento || 0,
      productId: reward.productId || '',
      productName: reward.productName || '',
      vigenciaDias: reward.vigenciaDias || 30,
      imageUrl: reward.imageUrl || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormError('');
    resetForm(rewards.length);
  };

  const handleImageUpload = (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setImageToCrop(reader.result);
      setCropModalOpen(true);
    };
  };

  const handleCropComplete = async (croppedFile) => {
    setCropModalOpen(false);
    setImageToCrop(null);
    setUploading(true);
    try {
      const path = `rewards/${Date.now()}_cropped.jpg`;
      const { url, error: err } = await uploadFile(croppedFile, path);
      if (url && !err) {
        setForm((f) => ({ ...f, imageUrl: url }));
      }
    } finally {
      setUploading(false);
    }
  };

  const beneficioPreview = beneficioDe(form);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Recompensas</h1>
          <p className={styles.subtitle}>
            Catálogo de premios que los clientes canjean con sus puntos (monedas).
          </p>
        </div>
        {rewards.length > 0 && (
          <div className={styles.headerStats}>
            <span className={styles.headerStat}>
              <strong>{activas.length}</strong> activa{activas.length === 1 ? '' : 's'}
            </span>
            {inactivas.length > 0 && (
              <span className={styles.headerStatMuted}>
                <strong>{inactivas.length}</strong> inactiva{inactivas.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Recompensa' : 'Nueva Recompensa'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>

              <div className={styles.field}>
                <label className={styles.label}>Título</label>
                <input
                  type="text"
                  placeholder="Ej. Pack de stickers"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Descripción</label>
                <textarea
                  placeholder="Breve descripción de la recompensa"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Costo (puntos)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
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

              <div className={styles.field}>
                <label className={styles.label}>¿Qué da esta recompensa?</label>
                <select
                  className={styles.input}
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                >
                  {TIPOS_RECOMPENSA.map((t) => (
                    <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>
                  ))}
                </select>
                <p className={styles.helpText}>
                  {form.tipo === 'manual'
                    ? 'El cliente recibe un código y lo canjea con un asesor (envíos, mercancía física, etc.).'
                    : 'Al canjearla se genera un cupón que el cliente aplica solo, en el carrito.'}
                </p>
              </div>

              {NECESITA_PRODUCTO.includes(form.tipo) && (
                <div className={styles.field}>
                  <label className={styles.label}>Producto</label>
                  <BuscadorProducto
                    productId={form.productId}
                    productName={form.productName}
                    onElegir={(p) => setForm((f) => ({ ...f, productId: p.id, productName: p.name }))}
                  />
                </div>
              )}

              {(form.tipo === 'descuento' || form.tipo === 'producto_descuento') && (
                <div className={styles.fieldRow}>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.label}>Descuento (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.descuentoPct}
                      onChange={(e) => setForm((f) => ({ ...f, descuentoPct: Number(e.target.value) }))}
                      className={styles.input}
                    />
                  </div>
                  {form.tipo === 'descuento' && (
                    <div className={styles.field} style={{ flex: 1 }}>
                      <label className={styles.label}>
                        {Number(form.descuentoPct) > 0 ? 'Tope en soles' : 'O monto fijo (S/)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={Number(form.descuentoPct) > 0 ? form.topeDescuento : form.descuentoMonto}
                        onChange={(e) => setForm((f) => (Number(f.descuentoPct) > 0
                          ? { ...f, topeDescuento: Number(e.target.value) }
                          : { ...f, descuentoMonto: Number(e.target.value) }))}
                        className={styles.input}
                      />
                    </div>
                  )}
                </div>
              )}

              {TIPOS_CON_VIGENCIA.includes(form.tipo) && (
                <div className={styles.field}>
                  <label className={styles.label}>El cupón caduca en (días)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.vigenciaDias}
                    onChange={(e) => setForm((f) => ({ ...f, vigenciaDias: Number(e.target.value) }))}
                    className={styles.input}
                  />
                  {beneficioPreview && (
                    <p className={styles.helpText}>
                      El cliente verá: <strong>{beneficioPreview}</strong>
                    </p>
                  )}
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>Imagen (opcional)</label>
                <div className={styles.imageUploadWrapper}>
                  {form.imageUrl ? (
                    <div className={styles.imagePreviewContainer}>
                      <img src={form.imageUrl} alt="Recompensa" className={styles.imagePreview} />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                        className={styles.removeBtn}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className={styles.uploadImageLabel}>
                      <ImagePlus size={24} />
                      <span>Subir imagen</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        hidden
                      />
                    </label>
                  )}
                  {uploading && (
                    <div className={styles.uploadOverlay}>
                      <Loader2 className="animate-spin" /> Subiendo...
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Nota interna (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. accesorio físico, código para el asesor..."
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  className={styles.input}
                />
                <p className={styles.helpText}>
                  Solo la ve el equipo admin: no se muestra al cliente.
                </p>
              </div>

              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className={styles.checkbox}
                  />
                  <span>Recompensa activa (visible para canje)</span>
                </label>
              </div>

              {formError && <p className={styles.error}>{formError}</p>}

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Recompensa'}
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
            <h2 className={styles.cardTitle}>Tus Recompensas</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            {!isLoading && !error && activas.length > 0 && (
              <div className={styles.rewardsGrid}>
                {activas.map((reward) => (
                  <RewardCard key={reward.id} reward={reward} onEdit={handleEdit} onDelete={setDeleteConfirm} />
                ))}
              </div>
            )}

            {/* Inactivas: aparte y con su propio rótulo -en vez de mezcladas
                en la misma grilla- para que pausar una recompensa no la deje
                "perdida" entre las que sí se pueden canjear hoy. */}
            {!isLoading && !error && inactivas.length > 0 && (
              <>
                <h3 className={styles.groupLabel}>Inactivas</h3>
                <div className={styles.rewardsGrid}>
                  {inactivas.map((reward) => (
                    <RewardCard key={reward.id} reward={reward} onEdit={handleEdit} onDelete={setDeleteConfirm} />
                  ))}
                </div>
              </>
            )}

            {rewards.length === 0 && !isLoading && !error && (
              <div className={styles.emptyState}>
                <PackageOpen size={36} aria-hidden="true" className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No tienes recompensas creadas todavía.</p>
                <p className={styles.emptyText}>
                  Usa el formulario de la izquierda para crear la primera: el catálogo
                  que ven tus clientes en "Mi cuenta" se llena con lo que actives acá.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar recompensa?</h3>
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

      {cropModalOpen && imageToCrop && (
        <AdminImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setCropModalOpen(false);
            setImageToCrop(null);
          }}
          aspectRatio={1}
        />
      )}
    </div>
  );
};

export default AdminRecompensas;
