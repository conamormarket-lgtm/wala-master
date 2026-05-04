import React, { useState, useEffect } from 'react';
import Button from '../../common/Button';
import styles from './AdminCuestionarioTemplateModal.module.css';

function AdminCuestionarioTemplateModal({ isOpen, onClose, onSave, initialData }) {
  const [name, setName] = useState('');
  const [fields, setFields] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setFields(initialData.fields || []);
      } else {
        setName('');
        setFields([]);
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleAddField = () => {
    setFields([
      ...fields,
      {
        id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        label: '',
        type: 'text',
        required: true,
        options: [] // For select type
      }
    ]);
  };

  const handleFieldChange = (index, key, value) => {
    const updated = [...fields];
    updated[index][key] = value;
    setFields(updated);
  };

  const handleRemoveField = (index) => {
    const updated = [...fields];
    updated.splice(index, 1);
    setFields(updated);
  };

  const handleMoveField = (index, direction) => {
    const updated = [...fields];
    if (direction === 'up' && index > 0) {
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
      setFields(updated);
    } else if (direction === 'down' && index < fields.length - 1) {
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
      setFields(updated);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Debes ingresar un nombre para la plantilla.');
      return;
    }
    const cleanFields = fields.map(f => ({
      ...f,
      label: f.label.trim()
    })).filter(f => f.label);

    onSave({
      id: initialData?.id,
      name: name.trim(),
      fields: cleanFields
    });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>{initialData ? 'Editar Plantilla de Cuestionario' : 'Nueva Plantilla de Cuestionario'}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldRow}>
            <label className={styles.label}>Nombre de Plantilla</label>
            <input 
              type="text" 
              className={styles.input} 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Ej: Cuestionario Venta Libre"
              required
            />
          </div>

          <p className={styles.subtitle}>
            Nota: Este cuestionario se construirá EXCLUSIVAMENTE con los campos que definas aquí abajo. Es 100% libre. Asegúrate de pedir "Nombre" y "Celular" si necesitas esos datos para el envío.
          </p>

          <h4 className={styles.customFieldsTitle}>Construye tu Cuestionario:</h4>

          <div className={styles.fieldsContainer}>
            {fields.map((f, i) => (
              <div key={f.id} className={styles.fieldItem}>
                <div className={styles.fieldTopRow}>
                  <div className={styles.moveButtons}>
                    <button type="button" className={styles.moveBtn} onClick={() => handleMoveField(i, 'up')} disabled={i === 0}>↑</button>
                    <button type="button" className={styles.moveBtn} onClick={() => handleMoveField(i, 'down')} disabled={i === fields.length - 1}>↓</button>
                  </div>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={f.label} 
                    onChange={e => handleFieldChange(i, 'label', e.target.value)} 
                    placeholder="Pregunta o título del campo"
                    required
                  />
                  <select 
                    className={styles.select} 
                    value={f.type} 
                    onChange={e => handleFieldChange(i, 'type', e.target.value)}
                  >
                    <option value="text">Texto corto</option>
                    <option value="textarea">Texto largo</option>
                    <option value="number">Número</option>
                  </select>
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={f.required} 
                      onChange={e => handleFieldChange(i, 'required', e.target.checked)} 
                    />
                    Oblig.
                  </label>
                  <button type="button" className={styles.removeBtn} onClick={() => handleRemoveField(i)}>X</button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={handleAddField} className={styles.addFieldBtn}>
            + Añadir Pregunta Personalizada
          </Button>

          <div className={styles.footer}>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar Plantilla</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminCuestionarioTemplateModal;
