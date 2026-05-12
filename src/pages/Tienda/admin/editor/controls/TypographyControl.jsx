import React from 'react';

const TypographyControl = ({ label, prefix, settings, onChange }) => {
  return (
    <div style={{marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '6px', border: '1px solid #e2e8f0'}}>
      <h5 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: '#334155'}}>{label}</h5>
      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Fuente</label>
          <select value={settings[`${prefix}FontFamily`] || ''} onChange={e => onChange(`${prefix}FontFamily`, e.target.value)} style={{width: '100%', padding: '6px'}}>
            <option value="">Por defecto</option>
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Roboto', sans-serif">Roboto</option>
            <option value="'Poppins', sans-serif">Poppins</option>
            <option value="'Montserrat', sans-serif">Montserrat</option>
            <option value="'Outfit', sans-serif">Outfit</option>
            <option value="'Nunito', sans-serif">Nunito</option>
            <option value="'Raleway', sans-serif">Raleway</option>
            <option value="'Ubuntu', sans-serif">Ubuntu</option>
            <option value="'Playfair Display', serif">Playfair Display</option>
            <option value="'Merriweather', serif">Merriweather</option>
            <option value="'Lora', serif">Lora</option>
            <option value="'Oswald', sans-serif">Oswald</option>
          </select>
        </div>
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Tamaño</label>
          <input type="text" placeholder="Ej: 2rem o 24px" value={settings[`${prefix}FontSize`] || ''} onChange={e => onChange(`${prefix}FontSize`, e.target.value)} style={{width: '100%', padding: '6px'}} />
        </div>
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Grosor</label>
          <select value={settings[`${prefix}FontWeight`] || ''} onChange={e => onChange(`${prefix}FontWeight`, e.target.value)} style={{width: '100%', padding: '6px'}}>
            <option value="">Por defecto</option>
            <option value="300">Light (300)</option>
            <option value="400">Normal (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semibold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="800">Extra Bold (800)</option>
            <option value="900">Black (900)</option>
          </select>
        </div>
        <div style={{flex: '1 1 45%'}}>
          <label style={{fontSize: '0.75rem', color: '#64748b'}}>Transformar</label>
          <select value={settings[`${prefix}TextTransform`] || ''} onChange={e => onChange(`${prefix}TextTransform`, e.target.value)} style={{width: '100%', padding: '6px'}}>
            <option value="">Ninguno</option>
            <option value="uppercase">MAYÚSCULAS</option>
            <option value="lowercase">minúsculas</option>
            <option value="capitalize">Capitalizar</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default TypographyControl;
