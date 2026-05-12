import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { getSurveyConfig, saveSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../../services/encuestaConfig';
import styles from './AdminEncuestas.module.css';

const AdminEncuestas = () => {
  const [config, setConfig] = useState(DEFAULT_SURVEY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('intro'); // intro, basic, brands, completion, design

  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await getSurveyConfig();
      if (data) {
        // Hacemos un merge con default por si hay campos nuevos
        setConfig({
          ...DEFAULT_SURVEY_CONFIG,
          ...data
        });
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await saveSurveyConfig(config);
    if (!error) {
      alert('Configuración guardada correctamente.');
    } else {
      alert('Error al guardar: ' + error);
    }
    setSaving(false);
  };

  const handleIntroChange = (field, value) => {
    setConfig({ ...config, introPanel: { ...config.introPanel, [field]: value } });
  };

  const handleCompletionChange = (field, value) => {
    setConfig({ ...config, completionPanel: { ...config.completionPanel, [field]: value } });
  };

  const handleDesignChange = (field, value) => {
    setConfig({ ...config, design: { ...config.design, [field]: value } });
  };

  const handleBasicDataChange = (field, value) => {
    setConfig({ ...config, basicDataPanel: { ...config.basicDataPanel, [field]: value } });
  };

  const handleBrandsPanelChange = (field, value) => {
    setConfig({ ...config, brandsPanel: { ...config.brandsPanel, [field]: value } });
  };

  // --- Operaciones de Campos Básicos ---
  const addBasicField = () => {
    const newField = { id: `field_${Date.now()}`, label: 'Nueva Pregunta', type: 'text', required: false, options: [] };
    setConfig({
      ...config,
      basicDataPanel: { ...config.basicDataPanel, fields: [...config.basicDataPanel.fields, newField] }
    });
  };
  const removeBasicField = (index) => {
    const newFields = [...config.basicDataPanel.fields];
    newFields.splice(index, 1);
    setConfig({
      ...config,
      basicDataPanel: { ...config.basicDataPanel, fields: newFields }
    });
  };
  const updateBasicField = (index, key, value) => {
    const newFields = [...config.basicDataPanel.fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setConfig({
      ...config,
      basicDataPanel: { ...config.basicDataPanel, fields: newFields }
    });
  };

  // --- Operaciones de Categorías (Brands) ---
  const addBrandCategory = () => {
    const newCategory = { id: `cat_${Date.now()}`, name: 'Nueva Categoría', fields: [] };
    setConfig({
      ...config,
      brandsPanel: { ...config.brandsPanel, categories: [...config.brandsPanel.categories, newCategory] }
    });
  };
  const updateBrandCategoryName = (catIndex, name) => {
    const newCats = [...config.brandsPanel.categories];
    newCats[catIndex].name = name;
    setConfig({
      ...config,
      brandsPanel: { ...config.brandsPanel, categories: newCats }
    });
  };
  const removeBrandCategory = (catIndex) => {
    const newCats = [...config.brandsPanel.categories];
    newCats.splice(catIndex, 1);
    setConfig({
      ...config,
      brandsPanel: { ...config.brandsPanel, categories: newCats }
    });
  };

  // --- Operaciones de Campos dentro de Categorías ---
  const addBrandField = (catIndex) => {
    const newField = { id: `brandField_${Date.now()}`, label: 'Nueva Pregunta de Categoría', type: 'text', required: false, options: [] };
    const newCats = [...config.brandsPanel.categories];
    newCats[catIndex].fields.push(newField);
    setConfig({
      ...config,
      brandsPanel: { ...config.brandsPanel, categories: newCats }
    });
  };
  const removeBrandField = (catIndex, fieldIndex) => {
    const newCats = [...config.brandsPanel.categories];
    newCats[catIndex].fields.splice(fieldIndex, 1);
    setConfig({
      ...config,
      brandsPanel: { ...config.brandsPanel, categories: newCats }
    });
  };
  const updateBrandField = (catIndex, fieldIndex, key, value) => {
    const newCats = [...config.brandsPanel.categories];
    newCats[catIndex].fields[fieldIndex] = { ...newCats[catIndex].fields[fieldIndex], [key]: value };
    setConfig({
      ...config,
      brandsPanel: { ...config.brandsPanel, categories: newCats }
    });
  };

  // --- Renderizador de Preguntas Genérico ---
  const renderFieldEditor = (field, index, onUpdate, onRemove) => (
    <div key={index} className={styles.fieldItem}>
      <div className={styles.fieldHeader}>
        <h3>Pregunta {index + 1}</h3>
        <button className={styles.removeBtn} onClick={() => onRemove(index)}>
          <Trash2 size={16} /> Eliminar
        </button>
      </div>
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label>Etiqueta de la pregunta</label>
          <input 
            type="text" 
            className={styles.input} 
            value={field.label} 
            onChange={e => onUpdate(index, 'label', e.target.value)}
          />
        </div>
        <div className={styles.fieldGroup}>
          <label>Tipo de respuesta</label>
          <select 
            className={styles.input} 
            value={field.type}
            onChange={e => onUpdate(index, 'type', e.target.value)}
          >
            <option value="text">Texto corto</option>
            <option value="textarea">Texto largo</option>
            <option value="select">Selección múltiple (Dropdown)</option>
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label>¿Es obligatorio?</label>
          <select 
            className={styles.input} 
            value={field.required ? 'yes' : 'no'}
            onChange={e => onUpdate(index, 'required', e.target.value === 'yes')}
          >
            <option value="yes">Sí</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      {field.type === 'select' && (
        <div className={styles.fieldGroup}>
          <label>Opciones (separadas por comas)</label>
          <input 
            type="text" 
            className={styles.input} 
            value={field.options?.join(', ') || ''} 
            onChange={e => onUpdate(index, 'options', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
            placeholder="Ej: Opción 1, Opción 2, Opción 3"
          />
        </div>
      )}
    </div>
  );

  if (loading) return <div>Cargando configuración...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Configuración de Encuesta</h1>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tabBtn} ${activeTab === 'intro' ? styles.active : ''}`} onClick={() => setActiveTab('intro')}>
          Hook Inicial
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'basic' ? styles.active : ''}`} onClick={() => setActiveTab('basic')}>
          Datos Básicos
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'brands' ? styles.active : ''}`} onClick={() => setActiveTab('brands')}>
          Intereses (Marcas)
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'completion' ? styles.active : ''}`} onClick={() => setActiveTab('completion')}>
          Finalización
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'design' ? styles.active : ''}`} onClick={() => setActiveTab('design')}>
          Diseño
        </button>
      </div>

      {activeTab === 'intro' && (
        <div className={styles.panel}>
          <h2>Configurar el "Hook" Inicial</h2>
          <div className={styles.fieldGroup}>
            <label>Título</label>
            <input type="text" className={styles.input} value={config.introPanel.title} onChange={e => handleIntroChange('title', e.target.value)} />
          </div>
          <div className={styles.fieldGroup}>
            <label>Subtítulo</label>
            <input type="text" className={styles.input} value={config.introPanel.subtitle} onChange={e => handleIntroChange('subtitle', e.target.value)} />
          </div>
          <div className={styles.fieldGroup}>
            <label>Descripción / Mensaje de enganche</label>
            <textarea className={styles.textarea} value={config.introPanel.description} onChange={e => handleIntroChange('description', e.target.value)} />
          </div>
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label>Texto Botón Continuar</label>
              <input type="text" className={styles.input} value={config.introPanel.continueButtonText} onChange={e => handleIntroChange('continueButtonText', e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label>Texto Botón Descartar</label>
              <input type="text" className={styles.input} value={config.introPanel.skipButtonText} onChange={e => handleIntroChange('skipButtonText', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'basic' && (
        <div className={styles.panel}>
          <h2>Campos de Datos Básicos</h2>
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label>Título del Panel</label>
              <input type="text" className={styles.input} value={config.basicDataPanel.title} onChange={e => handleBasicDataChange('title', e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label>Subtítulo</label>
              <input type="text" className={styles.input} value={config.basicDataPanel.subtitle} onChange={e => handleBasicDataChange('subtitle', e.target.value)} />
            </div>
          </div>

          <h3>Preguntas Configurables</h3>
          <div className={styles.fieldsList}>
            {config.basicDataPanel.fields.map((field, index) => renderFieldEditor(field, index, updateBasicField, removeBasicField))}
          </div>
          <button className={styles.addBtn} onClick={addBasicField}>
            <Plus size={18} /> Añadir nueva pregunta general
          </button>
        </div>
      )}

      {activeTab === 'brands' && (
        <div className={styles.panel}>
          <h2>Configuración de Intereses (Marcas)</h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Aquí puedes crear categorías independientes (ej. Deportes, Geek, Familia). El usuario podrá seleccionarlas como "Pills" y por cada una que seleccione, se le harán las preguntas que configures debajo.
          </p>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label>Título del Panel Selector</label>
              <input type="text" className={styles.input} value={config.brandsPanel.title || ''} onChange={e => handleBrandsPanelChange('title', e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label>Subtítulo</label>
              <input type="text" className={styles.input} value={config.brandsPanel.subtitle || ''} onChange={e => handleBrandsPanelChange('subtitle', e.target.value)} />
            </div>
          </div>

          <h3>Tus Categorías Creadas</h3>
          <div className={styles.fieldsList}>
            {config.brandsPanel.categories?.map((cat, catIndex) => (
              <div key={cat.id} className={styles.fieldItem} style={{ borderColor: config.design.primaryColor, borderLeftWidth: '4px' }}>
                <div className={styles.fieldHeader}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%' }}>
                    <h3 style={{ margin: 0, minWidth: '120px' }}>Categoría:</h3>
                    <input 
                      type="text" 
                      className={styles.input} 
                      value={cat.name} 
                      onChange={e => updateBrandCategoryName(catIndex, e.target.value)}
                      style={{ padding: '0.5rem', fontWeight: 'bold' }}
                    />
                  </div>
                  <button className={styles.removeBtn} onClick={() => removeBrandCategory(catIndex)}>
                    <Trash2 size={16} /> Eliminar Categoría
                  </button>
                </div>

                <div style={{ padding: '1rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#475569' }}>Preguntas para quien seleccione "{cat.name}"</h4>
                  <div className={styles.fieldsList}>
                    {cat.fields.map((field, fieldIndex) => 
                      renderFieldEditor(
                        field, 
                        fieldIndex, 
                        (i, k, v) => updateBrandField(catIndex, i, k, v), 
                        (i) => removeBrandField(catIndex, i)
                      )
                    )}
                  </div>
                  <button className={styles.addBtn} onClick={() => addBrandField(catIndex)} style={{ padding: '0.5rem', fontSize: '0.9rem', marginBottom: 0 }}>
                    <Plus size={16} /> Añadir pregunta para {cat.name}
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <button className={styles.addBtn} onClick={addBrandCategory}>
            <Plus size={18} /> Crear nueva categoría de interés
          </button>
        </div>
      )}

      {activeTab === 'completion' && (
        <div className={styles.panel}>
          <h2>Panel de Finalización</h2>
          <div className={styles.fieldGroup}>
            <label>Título</label>
            <input type="text" className={styles.input} value={config.completionPanel.title} onChange={e => handleCompletionChange('title', e.target.value)} />
          </div>
          <div className={styles.fieldGroup}>
            <label>Mensaje de agradecimiento</label>
            <textarea className={styles.textarea} value={config.completionPanel.message} onChange={e => handleCompletionChange('message', e.target.value)} />
          </div>
          <div className={styles.fieldGroup}>
            <label>Texto del Botón Final</label>
            <input type="text" className={styles.input} value={config.completionPanel.buttonText} onChange={e => handleCompletionChange('buttonText', e.target.value)} />
          </div>
        </div>
      )}

      {activeTab === 'design' && (
        <div className={styles.panel}>
          <h2>Diseño Visual</h2>
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label>Color Principal</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="color" className={styles.colorPicker} value={config.design.primaryColor} onChange={e => handleDesignChange('primaryColor', e.target.value)} />
                <code>{config.design.primaryColor}</code>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label>Color de Fondo</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="color" className={styles.colorPicker} value={config.design.backgroundColor} onChange={e => handleDesignChange('backgroundColor', e.target.value)} />
                <code>{config.design.backgroundColor}</code>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label>Color de Texto Principal</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="color" className={styles.colorPicker} value={config.design.textColor} onChange={e => handleDesignChange('textColor', e.target.value)} />
                <code>{config.design.textColor}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEncuestas;
