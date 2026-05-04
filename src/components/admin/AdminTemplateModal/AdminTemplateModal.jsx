import React, { useState } from 'react';
import Button from '../../common/Button';
import styles from './AdminTemplateModal.module.css';

const TEMPLATES = [
  {
    id: 'tallas',
    name: 'Tabla de Tallas Ropa',
    icon: '👕',
    html: `<h3>📏 Guía de Tallas</h3>
<table style="width: 100%; border-collapse: collapse;" border="1">
  <tbody>
    <tr>
      <td style="padding: 8px; text-align: center; background-color: #f9f9f9;"><strong>Talla</strong></td>
      <td style="padding: 8px; text-align: center; background-color: #f9f9f9;"><strong>Ancho (cm)</strong></td>
      <td style="padding: 8px; text-align: center; background-color: #f9f9f9;"><strong>Largo (cm)</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px; text-align: center;">S</td>
      <td style="padding: 8px; text-align: center;">48</td>
      <td style="padding: 8px; text-align: center;">68</td>
    </tr>
    <tr>
      <td style="padding: 8px; text-align: center;">M</td>
      <td style="padding: 8px; text-align: center;">50</td>
      <td style="padding: 8px; text-align: center;">70</td>
    </tr>
    <tr>
      <td style="padding: 8px; text-align: center;">L</td>
      <td style="padding: 8px; text-align: center;">54</td>
      <td style="padding: 8px; text-align: center;">74</td>
    </tr>
  </tbody>
</table>
<p><br></p>`
  },
  {
    id: 'envios',
    name: 'Tiempos de Entrega',
    icon: '🚚',
    html: `<h3>🚚 Tiempos de Entrega</h3>
<ul>
  <li><strong>Lima Metropolitana:</strong> 1 a 2 días hábiles (Envío Express).</li>
  <li><strong>Provincias:</strong> 3 a 5 días hábiles vía Olva Courier o Shalom.</li>
</ul>
<p><em>*Nota importante: Todos nuestros regalos personalizados toman 24h adicionales para su fabricación minuciosa.</em></p>
<p><br></p>`
  },
  {
    id: 'cuidado',
    name: 'Cuidados del Producto',
    icon: '✨',
    html: `<h3>✨ Recomendaciones de Cuidado</h3>
<ul>
  <li>Lavar a mano o en ciclo delicado dentro de lavadora con agua fría.</li>
  <li>No usar lejía, secadora, ni planchar directamente sobre el estampado.</li>
  <li>Secar a la sombra para prolongar la vitalidad y duración de los colores.</li>
</ul>
<p><br></p>`
  },
  {
    id: 'garantia',
    name: 'Política de Garantía',
    icon: '🛡️',
    html: `<h3>🛡️ Garantía de Calidad YOX</h3>
<p>Todos nuestros productos pasan por un riguroso control de calidad antes de ser empaquetados y enviados a la puerta de tu casa. En el remoto caso que el producto llegue con una falla de fábrica evidente, no te preocupes, <strong>te lo reponemos sin ningún costo adicional</strong>. Sólo envíanos un mensaje por WhatsApp con una foto para solucionarlo.</p>
<p><br></p>`
  }
];

function AdminTemplateModal({ isOpen, onClose, onInsert }) {
  const [selectedId, setSelectedId] = useState('');

  if (!isOpen) return null;

  const handleInsert = (e) => {
    e.preventDefault();
    if (!selectedId) {
       alert("Selecciona una plantilla primero para continuar");
       return;
    }
    const template = TEMPLATES.find(t => t.id === selectedId);
    if(template) {
       onInsert(template.html);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Insertar Plantilla Rápida</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleInsert} className={styles.form}>
           <p className={styles.subtitle}>Selecciona un bloque pre-construido para ahorrar tiempo y tener el formato ideal en tu descripción.</p>
           
           <div className={styles.templateList}>
             {TEMPLATES.map((tmpl) => (
                 <label key={tmpl.id} className={`${styles.templateCard} ${selectedId === tmpl.id ? styles.selected : ''}`}>
                    <input 
                      type="radio" 
                      name="template" 
                      value={tmpl.id} 
                      className={styles.radioInput}
                      checked={selectedId === tmpl.id}
                      onChange={() => setSelectedId(tmpl.id)}
                    />
                    <div className={styles.cardContent}>
                       <span className={styles.icon}>{tmpl.icon}</span>
                       <span className={styles.name}>{tmpl.name}</span>
                    </div>
                 </label>
             ))}
           </div>

          <div className={styles.footer}>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={!selectedId}>Insertar Plantilla</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminTemplateModal;
