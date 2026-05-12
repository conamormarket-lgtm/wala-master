import React from 'react';

const BackgroundStylesControl = ({ settings, onChange }) => {
  return (
    <div style={{marginBottom: '15px', padding: '15px', background: '#f5f5f5', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
      <h5 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: '#334155'}}>Fondo y Espaciado</h5>
      
      {/* Espaciado */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
        <div style={{flex: 1}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Padding Superior</label>
          <input type="text" placeholder="Ej: 2rem o 0" value={settings.paddingTop || '0rem'} onChange={e => onChange('paddingTop', e.target.value)} style={{width: '100%', padding: '6px'}} />
        </div>
        <div style={{flex: 1}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Padding Inferior</label>
          <input type="text" placeholder="Ej: 2rem o 0" value={settings.paddingBottom || '0rem'} onChange={e => onChange('paddingBottom', e.target.value)} style={{width: '100%', padding: '6px'}} />
        </div>
      </div>

      {/* Tipo de fondo */}
      <div style={{marginBottom: '10px'}}>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Color Sólido</label>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
          <input type="color" value={(!settings.backgroundColor || settings.backgroundColor === 'transparent') ? '#ffffff' : settings.backgroundColor} onChange={e => onChange('backgroundColor', e.target.value)} disabled={!settings.backgroundColor || settings.backgroundColor === 'transparent'} style={{height: '32px', padding: 0, width: '40px', cursor: (!settings.backgroundColor || settings.backgroundColor === 'transparent') ? 'not-allowed' : 'pointer'}} />
          <label style={{display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontSize: '0.85rem', cursor: 'pointer'}}>
            <input type="checkbox" checked={!settings.backgroundColor || settings.backgroundColor === 'transparent'} onChange={e => onChange('backgroundColor', e.target.checked ? 'transparent' : '#ffffff')} style={{margin: 0}} />
            Transparente
          </label>
        </div>
      </div>

      <div style={{marginBottom: '10px'}}>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Wallpaper (URL de Imagen)</label>
        <input type="text" placeholder="https://..." value={settings.backgroundImageUrl || ''} onChange={e => onChange('backgroundImageUrl', e.target.value)} style={{width: '100%', padding: '6px'}} />
      </div>

      <div style={{marginBottom: '10px'}}>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Gradiente CSS (Opcional)</label>
        <input type="text" placeholder="Ej: linear-gradient(90deg, #000, #fff)" value={settings.backgroundGradient || ''} onChange={e => onChange('backgroundGradient', e.target.value)} style={{width: '100%', padding: '6px'}} />
      </div>

      {(settings.backgroundImageUrl || settings.backgroundGradient) && (
        <>
          <div style={{marginBottom: '10px'}}>
            <label style={{fontSize: '0.75rem', color: '#64748b'}}>Difuminar Fondo (Blur px)</label>
            <input type="number" min="0" max="100" placeholder="Ej: 10" value={settings.backgroundBlur || ''} onChange={e => onChange('backgroundBlur', e.target.value)} style={{width: '100%', padding: '6px'}} />
          </div>
        </>
      )}

      <div>
        <label style={{fontSize: '0.75rem', color: '#64748b'}}>Filtro Oscuro/Color (Overlay)</label>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
          <input type="color" value={settings.backgroundOverlay || '#000000'} onChange={e => onChange('backgroundOverlay', e.target.value)} disabled={!settings.backgroundOverlay} style={{height: '32px', padding: 0, width: '40px', cursor: !settings.backgroundOverlay ? 'not-allowed' : 'pointer'}} />
          <label style={{display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontSize: '0.85rem', cursor: 'pointer'}}>
            <input type="checkbox" checked={!settings.backgroundOverlay} onChange={e => onChange('backgroundOverlay', e.target.checked ? '' : 'rgba(0,0,0,0.5)')} style={{margin: 0}} />
            Sin filtro
          </label>
        </div>
      </div>
    </div>
  );
};

export default BackgroundStylesControl;
