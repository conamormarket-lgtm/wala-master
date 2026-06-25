import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBlueprints, createBlueprint, updateBlueprint, deleteBlueprint } from '../../services/blueprints';
import { Edit2, Trash2, Plus, X } from 'lucide-react';
import Button from '../../components/common/Button';
import styles from './AdminBlueprints.module.css';

// Un área de impresión por defecto (cm + dpi de imprenta estándar).
const emptyPrintArea = () => ({ name: '', widthCm: 30, heightCm: 40, dpi: 300 });

const emptyForm = {
  name: '',
  baseGarment: '',
  basePrintCost: 0,
  order: 0,
  active: true,
  // Siempre arrancamos con al menos un área para que el blueprint sea útil.
  printAreas: [emptyPrintArea()],
  decorationMethods: 'DTG'   // editado como texto separado por comas en el form
};

// Convierte el array de printAreas a la forma que espera el servicio.
const parsePrintAreas = (areas) =>
  (areas || [])
    .filter((a) => (a.name || '').trim())
    .map((a) => ({
      name: a.name.trim(),
      widthCm: Number(a.widthCm) || 0,
      heightCm: Number(a.heightCm) || 0,
      dpi: Number(a.dpi) || 300
    }));

const AdminBlueprints = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: blueprintsData, isLoading, error } = useQuery({
    queryKey: ['admin-blueprints'],
    queryFn: async () => {
      const { data, error: err } = await getBlueprints();
      if (err) throw new Error(err);
      return data;
    }
  });

  const blueprints = blueprintsData ?? [];

  const resetForm = (nextOrder) =>
    setForm({ ...emptyForm, printAreas: [emptyPrintArea()], order: nextOrder ?? blueprints.length });

  const createMutation = useMutation({
    mutationFn: (data) => createBlueprint(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
      resetForm((blueprintsData?.length ?? 0) + 1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBlueprint(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
      setEditingId(null);
      resetForm(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteBlueprint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blueprints'] });
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
      setDeleteConfirm(null);
    }
  });

  // ── Edición de áreas de impresión (lista dinámica) ──────────────────────────
  const updateArea = (index, field, value) => {
    setForm((f) => {
      const printAreas = f.printAreas.map((a, i) => (i === index ? { ...a, [field]: value } : a));
      return { ...f, printAreas };
    });
  };

  const addArea = () => {
    setForm((f) => ({ ...f, printAreas: [...f.printAreas, emptyPrintArea()] }));
  };

  const removeArea = (index) => {
    setForm((f) => {
      const printAreas = f.printAreas.filter((_, i) => i !== index);
      // Garantiza siempre al menos un área editable.
      return { ...f, printAreas: printAreas.length ? printAreas : [emptyPrintArea()] };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      baseGarment: form.baseGarment.trim(),
      basePrintCost: Number(form.basePrintCost) || 0,
      order: Number(form.order) || 0,
      active: !!form.active,
      printAreas: parsePrintAreas(form.printAreas),
      // El textarea/input de métodos se guarda como array de strings.
      decorationMethods: (form.decorationMethods || '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (bp) => {
    setEditingId(bp.id);
    setForm({
      name: bp.name || '',
      baseGarment: bp.baseGarment || '',
      basePrintCost: bp.basePrintCost ?? 0,
      order: bp.order ?? 0,
      active: bp.active !== false,
      printAreas:
        Array.isArray(bp.printAreas) && bp.printAreas.length
          ? bp.printAreas.map((a) => ({
              name: a.name || '',
              widthCm: a.widthCm ?? 0,
              heightCm: a.heightCm ?? 0,
              dpi: a.dpi ?? 300
            }))
          : [emptyPrintArea()],
      decorationMethods: Array.isArray(bp.decorationMethods) ? bp.decorationMethods.join(', ') : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm(blueprints.length);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Blueprints (POD)</h1>
          <p className={styles.subtitle}>
            Plantillas de prendas imprimibles estilo Printful: áreas de impresión, métodos de
            decoración y costo base. Son la base del arte de producción.
          </p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* FORMULARIO */}
        <div className={styles.formSection}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              {editingId ? 'Editar Blueprint' : 'Nuevo Blueprint'}
            </h2>
            <form className={styles.form} onSubmit={handleSubmit}>

              <div className={styles.field}>
                <label className={styles.label}>Nombre</label>
                <input
                  type="text"
                  placeholder="Ej. Polo Unisex Algodón"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Prenda Base (baseGarment)</label>
                <input
                  type="text"
                  placeholder="Ej. polo, taza, hoodie, totebag"
                  value={form.baseGarment}
                  onChange={(e) => setForm((f) => ({ ...f, baseGarment: e.target.value }))}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label className={styles.label}>Costo base impresión</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.basePrintCost}
                    onChange={(e) => setForm((f) => ({ ...f, basePrintCost: e.target.value }))}
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
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className={styles.checkbox}
                  />
                  <span>Blueprint activo</span>
                </label>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Métodos de decoración</label>
                <input
                  type="text"
                  placeholder="DTG, bordado, sublimación"
                  value={form.decorationMethods}
                  onChange={(e) => setForm((f) => ({ ...f, decorationMethods: e.target.value }))}
                  className={styles.input}
                />
                <p className={styles.helpText}>Separa los métodos con comas.</p>
              </div>

              {/* EDITOR DE ÁREAS DE IMPRESIÓN */}
              <div className={styles.field}>
                <label className={styles.label}>Áreas de impresión</label>
                <div className={styles.areasList}>
                  {form.printAreas.map((area, idx) => (
                    <div key={idx} className={styles.areaRow}>
                      <div className={styles.areaGrid}>
                        <input
                          type="text"
                          placeholder="Nombre (ej. Frente)"
                          value={area.name}
                          onChange={(e) => updateArea(idx, 'name', e.target.value)}
                          className={styles.input}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Ancho cm"
                          value={area.widthCm}
                          onChange={(e) => updateArea(idx, 'widthCm', e.target.value)}
                          className={styles.input}
                          title="Ancho (cm)"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Alto cm"
                          value={area.heightCm}
                          onChange={(e) => updateArea(idx, 'heightCm', e.target.value)}
                          className={styles.input}
                          title="Alto (cm)"
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="DPI"
                          value={area.dpi}
                          onChange={(e) => updateArea(idx, 'dpi', e.target.value)}
                          className={styles.input}
                          title="DPI"
                        />
                      </div>
                      <button
                        type="button"
                        className={styles.removeAreaBtn}
                        onClick={() => removeArea(idx)}
                        title="Quitar área"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className={styles.addAreaBtn} onClick={addArea}>
                  <Plus size={16} /> Añadir área
                </button>
                <p className={styles.helpText}>
                  Define el tamaño físico (cm) y el DPI de cada zona imprimible.
                </p>
              </div>

              <div className={styles.formActions}>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Blueprint'}
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
            <h2 className={styles.cardTitle}>Tus Blueprints</h2>

            {isLoading && <p className={styles.loading}>Cargando...</p>}
            {error && <p className={styles.error}>{error.message}</p>}

            <div className={styles.bpGrid}>
              {blueprints.map((bp) => (
                <div key={bp.id} className={styles.bpCard}>
                  <div className={styles.bpInfo}>
                    <div className={styles.bpHead}>
                      <h3 className={styles.bpName}>{bp.name}</h3>
                      <span
                        className={`${styles.statusBadge} ${
                          bp.active !== false ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {bp.active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {bp.baseGarment && <span className={styles.bpGarment}>{bp.baseGarment}</span>}
                    <div className={styles.badgeRow}>
                      <span className={styles.bpBadge}>
                        Costo: {Number(bp.basePrintCost ?? 0).toFixed(2)}
                      </span>
                      <span className={styles.bpBadge}>
                        {(bp.printAreas?.length ?? 0)} área(s)
                      </span>
                      <span className={styles.bpBadge}>Orden: {bp.order ?? 0}</span>
                    </div>
                    {Array.isArray(bp.decorationMethods) && bp.decorationMethods.length > 0 && (
                      <div className={styles.badgeRow}>
                        {bp.decorationMethods.map((m) => (
                          <span key={m} className={styles.methodBadge}>{m}</span>
                        ))}
                      </div>
                    )}
                    {Array.isArray(bp.printAreas) && bp.printAreas.length > 0 && (
                      <ul className={styles.areaSummary}>
                        {bp.printAreas.map((a, i) => (
                          <li key={i}>
                            {a.name || 'Área'} — {a.widthCm}×{a.heightCm} cm @ {a.dpi} dpi
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className={styles.bpActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEdit(bp)}
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(bp)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {blueprints.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No tienes blueprints creados todavía.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>¿Eliminar blueprint?</h3>
            <p className={styles.modalText}>
              Estás a punto de eliminar <strong>{deleteConfirm.name}</strong>. Esta acción no se puede deshacer.
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

export default AdminBlueprints;
