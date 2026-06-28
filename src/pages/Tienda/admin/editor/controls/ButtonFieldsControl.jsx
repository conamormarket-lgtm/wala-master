import React from 'react';

/**
 * Bloque REUTILIZABLE de "Botón de acción" para secciones de texto que NO tienen botón propio.
 *
 * Emite las claves estándar del contrato: `buttonText` y `buttonLink`.
 * Si la sección ya tiene su propio editor de botón (ej: hero_banner) NO se debe usar este
 * control; está pensado solo para añadir un botón opcional donde faltaba.
 *
 * Es aditivo y retrocompatible: con los valores vacíos no se renderiza ningún botón en la
 * tienda (el render exige buttonText && buttonLink), así que no cambia lo visual actual.
 *
 * @param {object} props.settings Objeto settings de la sección
 * @param {(key:string, value:any)=>void} props.onChange  Aplica el cambio sobre settings[key]
 */
const ButtonFieldsControl = ({ settings = {}, onChange }) => {
  return (
    <div style={{marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
      <h5 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: '#334155'}}>Botón de Acción (Opcional)</h5>
      <div style={{display: 'flex', gap: '10px'}}>
        <div style={{flex: 1}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Texto del Botón</label>
          <input
            type="text"
            placeholder="Ej: Ver más"
            value={settings.buttonText || ''}
            onChange={e => onChange('buttonText', e.target.value)}
            style={{width: '100%', padding: '6px'}}
          />
        </div>
        <div style={{flex: 1}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Enlace del Botón</label>
          <input
            type="text"
            placeholder="Ej: /tienda"
            value={settings.buttonLink || ''}
            onChange={e => onChange('buttonLink', e.target.value)}
            style={{width: '100%', padding: '6px'}}
          />
        </div>
      </div>
    </div>
  );
};

export default ButtonFieldsControl;
