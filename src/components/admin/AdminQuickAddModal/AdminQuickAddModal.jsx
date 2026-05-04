import React, { useState } from 'react';
import Button from '../../common/Button';
import styles from './AdminQuickAddModal.module.css';

const AdminQuickAddModal = ({ isOpen, onClose, title, onSubmit, label, isImageNeeded = false }) => {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSubmit({ name, ...(isImageNeeded && { imageUrl }) });
    setSaving(false);
    setName('');
    setImageUrl('');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>{label || 'Nombre'}</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              autoFocus 
            />
          </div>
          {isImageNeeded && (
            <div className={styles.formGroup}>
              <label>URL de la imagen (Logo)</label>
              <input 
                type="text" 
                value={imageUrl} 
                onChange={e => setImageUrl(e.target.value)} 
                placeholder="https://..." 
              />
            </div>
          )}
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminQuickAddModal;
