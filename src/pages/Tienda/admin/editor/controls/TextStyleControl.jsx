import React from 'react';

/**
 * Bloque REUTILIZABLE de "Estilo de texto" para CUALQUIER campo de texto editable
 * (title, subtitle, heading, content, description...) en las secciones del editor visual.
 *
 * Sigue el MISMO molde que TypographyControl/BackgroundStylesControl: recibe un `prefix`
 * (el nombre base del campo) + un `onChange(key, value)`, y emite las claves del CONTRATO:
 *   - `${prefix}Align`     -> 'left' | 'center' | 'right'
 *   - `${prefix}Underline` -> boolean
 *   - `${prefix}Bg`        -> color de fondo del texto (string, '' = sin fondo)
 *   - `${prefix}Link`      -> URL de destino (string, '' = sin enlace)
 *
 * Es aditivo y retrocompatible: si los campos no existen, usa defaults seguros que
 * reproducen el comportamiento actual (sin alineación forzada, sin subrayado, sin fondo,
 * sin enlace), de modo que NO cambia lo visual de las secciones ya configuradas.
 *
 * @param {string} props.label    Etiqueta visible del bloque (ej: "Estilo del Título")
 * @param {string} props.prefix   Nombre base del campo (ej: 'title', 'subtitle', 'heading', 'content')
 * @param {object} props.settings Objeto settings de la sección
 * @param {(key:string, value:any)=>void} props.onChange  Aplica el cambio sobre settings[key]
 */
const TextStyleControl = ({ label, prefix, settings = {}, onChange }) => {
  // Lectura con defaults seguros (retrocompatibilidad)
  const align = settings[`${prefix}Align`] || '';
  const underline = settings[`${prefix}Underline`] || false;
  const bg = settings[`${prefix}Bg`] || '';
  const link = settings[`${prefix}Link`] || '';

  return (
    <div style={{marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
      <h5 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: '#334155'}}>{label}</h5>

      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px'}}>
        {/* Alineación */}
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Alineación</label>
          <select
            value={align}
            onChange={e => onChange(`${prefix}Align`, e.target.value)}
            style={{width: '100%', padding: '6px'}}
          >
            <option value="">Por defecto</option>
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </div>

        {/* Subrayado */}
        <div style={{flex: '1 1 45%', display: 'flex', alignItems: 'flex-end'}}>
          <label style={{display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '0.85rem', cursor: 'pointer'}}>
            <input
              type="checkbox"
              checked={underline}
              onChange={e => onChange(`${prefix}Underline`, e.target.checked)}
              style={{margin: 0}}
            />
            <span style={{textDecoration: 'underline'}}>Subrayado</span>
          </label>
        </div>
      </div>

      {/* Color de fondo del texto */}
      <div style={{marginBottom: '10px'}}>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Color de Fondo del Texto</label>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
          <input
            type="color"
            value={bg && bg !== 'transparent' ? bg : '#ffffff'}
            onChange={e => onChange(`${prefix}Bg`, e.target.value)}
            disabled={!bg || bg === 'transparent'}
            style={{height: '32px', padding: 0, width: '40px', cursor: (!bg || bg === 'transparent') ? 'not-allowed' : 'pointer'}}
          />
          <label style={{display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontSize: '0.85rem', cursor: 'pointer'}}>
            <input
              type="checkbox"
              checked={!bg || bg === 'transparent'}
              onChange={e => onChange(`${prefix}Bg`, e.target.checked ? '' : '#ffff00')}
              style={{margin: 0}}
            />
            Sin fondo
          </label>
        </div>
      </div>

      {/* Enlace (URL) */}
      <div>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Enlace (URL, opcional)</label>
        <input
          type="text"
          placeholder="Ej: /tienda o https://..."
          value={link}
          onChange={e => onChange(`${prefix}Link`, e.target.value)}
          style={{width: '100%', padding: '6px'}}
        />
      </div>
    </div>
  );
};

export default TextStyleControl;
