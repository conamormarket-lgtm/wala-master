import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCuestionariosTemplates, createCuestionarioTemplate, updateCuestionarioTemplate } from '../../../services/cuestionarios';
import Button from '../../common/Button';
import AdminCuestionarioTemplateModal from '../AdminCuestionarioTemplateModal/AdminCuestionarioTemplateModal';
import styles from './AdminButtonModal.module.css';

function AdminButtonModal({ isOpen, onClose, onInsert, defaultNumber, initialData }) {
  const [buttonType, setButtonType] = useState('whatsapp');
  const [text, setText] = useState('Contactar por WhatsApp');
  const [url, setUrl] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const queryClient = useQueryClient();
  const { data: templatesRaw, isLoading } = useQuery({
    queryKey: ['cuestionario-templates'],
    queryFn: async () => {
      const res = await getCuestionariosTemplates();
      return res.data || [];
    },
    enabled: isOpen
  });
  const templates = templatesRaw || [];

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setButtonType(initialData.type || 'whatsapp');
        setText(initialData.text || 'Contactar por WhatsApp');
        if (initialData.type === 'cuestionario') {
          setSelectedTemplate(initialData.url.replace('cuestionario://', ''));
          setUrl('');
        } else {
          setUrl(initialData.url || '');
          setSelectedTemplate('');
        }
      } else {
        setButtonType('whatsapp');
        setText('Contactar por WhatsApp');
        
        const numClean = (defaultNumber || '').replace(/[\s\-\(\)]/g, '');
        const formatNum = numClean.startsWith('+') ? numClean.replace('+','') : '51'+numClean;
        setUrl(`https://wa.me/${formatNum}?text=Hola,%20quiero%20más%20información`);
        setSelectedTemplate('');
      }
    }
  }, [isOpen, defaultNumber, initialData]);

  const handleTypeChange = (newType) => {
    setButtonType(newType);
    if (newType === 'whatsapp') {
      setText('Contactar por WhatsApp');
      const numClean = (defaultNumber || '').replace(/[\s\-\(\)]/g, '');
      const formatNum = numClean.startsWith('+') ? numClean.replace('+','') : '51'+numClean;
      setUrl(`https://wa.me/${formatNum}?text=Hola,%20quiero%20más%20información`);
    } else if (newType === 'cuestionario') {
      setText('PAGA EN CASA');
      setUrl('');
      if (templates.length > 0) setSelectedTemplate(templates[0].id);
    } else {
      setText('Ver más detalles');
      setUrl('https://');
    }
  };

  const handleSaveTemplate = async (templateData) => {
    if (templateData.id) {
      await updateCuestionarioTemplate(templateData.id, templateData);
    } else {
      await createCuestionarioTemplate(templateData);
    }
    queryClient.invalidateQueries(['cuestionario-templates']);
    setTemplateModalOpen(false);
  };

  if (!isOpen) return null;

  const handleInsert = (e) => {
    e.preventDefault();
    if (buttonType === 'cuestionario') {
      if (!selectedTemplate) {
        alert('Por favor selecciona o crea una plantilla de cuestionario.');
        return;
      }
      if (!text) {
        alert('Por favor ingresa el texto del botón.');
        return;
      }
      onInsert({ type: buttonType, text, url: `cuestionario://${selectedTemplate}` });
      return;
    }

    if (!text || !url) {
      alert('Por favor completa todos los campos.');
      return;
    }
    onInsert({ type: buttonType, text, url });
  };

  return (
    <>
      <div className={styles.overlay} style={{ zIndex: templateModalOpen ? 10 : 10000 }}>
        <div className={styles.modal}>
          <div className={styles.header}>
            <h3 className={styles.title}>{initialData ? 'Editar Botón Personalizado' : 'Insertar Botón Personalizado'}</h3>
            <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
          </div>
          
          <form onSubmit={handleInsert} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Tipo de Botón</label>
              <div className={styles.typeSelector}>
                <button 
                  type="button"
                  className={`${styles.typeBtn} ${buttonType === 'whatsapp' ? styles.activeWsp : ''}`}
                  onClick={() => handleTypeChange('whatsapp')}
                >
                  WhatsApp
                </button>
                <button 
                  type="button"
                  className={`${styles.typeBtn} ${buttonType === 'normal' ? styles.activeNormal : ''}`}
                  onClick={() => handleTypeChange('normal')}
                >
                  Enlace Normal
                </button>
                <button 
                  type="button"
                  className={`${styles.typeBtn} ${buttonType === 'cuestionario' ? styles.activeCuestionario : ''}`}
                  onClick={() => handleTypeChange('cuestionario')}
                >
                  Cuestionario
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Texto del Botón</label>
              <input 
                type="text" 
                className={styles.input} 
                value={text} 
                onChange={e => setText(e.target.value)} 
                placeholder="Ej: Contactar"
                required
              />
            </div>

            {buttonType === 'cuestionario' ? (
               <div className={styles.field}>
                 <label className={styles.label}>Plantilla del Cuestionario</label>
                 <div style={{ display: 'flex', gap: '8px' }}>
                    <select 
                      className={styles.input} 
                      value={selectedTemplate} 
                      onChange={e => setSelectedTemplate(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Selecciona una plantilla...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        const templateToEdit = templates.find(t => t.id === selectedTemplate);
                        setEditingTemplate(templateToEdit || null);
                        setTemplateModalOpen(true);
                      }}
                    >
                       {selectedTemplate ? 'Editar' : '+ Nuevo'}
                    </Button>
                 </div>
               </div>
            ) : (
              <div className={styles.field}>
                <label className={styles.label}>Enlace (URL)</label>
                <input 
                  type="url" 
                  className={styles.input} 
                  value={url} 
                  onChange={e => setUrl(e.target.value)} 
                  placeholder="https://..."
                  required={buttonType !== 'cuestionario'}
                />
                {buttonType === 'whatsapp' && (
                  <p className={styles.hint}>Se usó tu número configurado por defecto. Puedes editar el mensaje en el enlace.</p>
                )}
              </div>
            )}

            <div className={styles.footer}>
              <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" type="submit">Insertar Botón</Button>
            </div>
          </form>
        </div>
      </div>
      
      <AdminCuestionarioTemplateModal 
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSave={handleSaveTemplate}
        initialData={editingTemplate}
      />
    </>
  );
}

export default AdminButtonModal;
