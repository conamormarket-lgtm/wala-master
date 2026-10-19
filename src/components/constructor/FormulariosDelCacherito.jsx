import React from 'react';
import BackgroundStylesControl from '../../pages/Tienda/admin/editor/controls/BackgroundStylesControl';

/*
 * Los formularios de los dos bloques de la landing del reloj (el cacherito):
 * "Primera impresión" (conversion_fold) y "Checkout de pago" (landing_payment).
 * Copiados tal cual de VisualEditorPanel.jsx (mismos campos, mismos textos,
 * mismos valores por defecto); solo cambia cómo reciben los datos: el editor
 * del kit les pasa `ajustes` y `cambiar(parche)`. Los bloques no se tocan.
 */

const campo = { width: '100%', padding: '6px', marginBottom: '10px' };

export function FormularioPrimeraImpresion({ ajustes: s, cambiar }) {
  const set = (key, val) => cambiar({ [key]: val });
  return (
    <div>
      <label>URL imagen hero</label>
      <input type="text" value={s.imageUrl || ''} onChange={e => set('imageUrl', e.target.value)} style={campo} />

      <label>Título (con emojis)</label>
      <input type="text" value={s.title || ''} onChange={e => set('title', e.target.value)} style={campo} />

      <label>Subtítulo</label>
      <input type="text" value={s.subtitle || ''} onChange={e => set('subtitle', e.target.value)} style={campo} />

      <label>Badge social proof</label>
      <input type="text" value={s.socialProofBadge || ''} onChange={e => set('socialProofBadge', e.target.value)} style={campo} />

      <label>Fin oferta (ISO datetime-local)</label>
      <input type="datetime-local" value={s.endTime ? s.endTime.slice(0, 16) : ''} onChange={e => set('endTime', e.target.value ? new Date(e.target.value).toISOString() : '')} style={campo} />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label>Precio S/</label>
          <input type="number" step="0.01" value={s.montoPEN ?? ''} onChange={e => set('montoPEN', Number(e.target.value))} style={{ width: '100%', padding: '6px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Tachado S/</label>
          <input type="number" step="0.01" value={s.precioOriginal ?? ''} onChange={e => set('precioOriginal', Number(e.target.value))} style={{ width: '100%', padding: '6px' }} />
        </div>
      </div>

      <label>Reseñas (texto)</label>
      <input type="text" value={s.reviewCount || ''} onChange={e => set('reviewCount', e.target.value)} placeholder="1867" style={campo} />

      <label>CTA principal</label>
      <input type="text" value={s.ctaPrimaryText || ''} onChange={e => set('ctaPrimaryText', e.target.value)} style={{ ...campo, marginBottom: '6px' }} />
      <input type="text" value={s.ctaPrimarySub || ''} onChange={e => set('ctaPrimarySub', e.target.value)} placeholder="Subtítulo CTA" style={campo} />

      <label>CTA secundario</label>
      <input type="text" value={s.ctaSecondaryText || ''} onChange={e => set('ctaSecondaryText', e.target.value)} style={campo} />

      <label>Texto confianza</label>
      <input type="text" value={s.trustText || ''} onChange={e => set('trustText', e.target.value)} style={campo} />

      <label>Color acento (#hex)</label>
      <input type="text" value={s.accentColor || '#dc2626'} onChange={e => set('accentColor', e.target.value)} style={campo} />
    </div>
  );
}

export function FormularioCheckoutDePago({ ajustes: s, cambiar }) {
  const set = (key, val) => cambiar({ [key]: val });
  return (
    <div>
      <label>Título de la sección</label>
      <input type="text" value={s.title || ''} onChange={e => set('title', e.target.value)} style={campo} />

      <label>Subtítulo</label>
      <input type="text" value={s.subtitle || ''} onChange={e => set('subtitle', e.target.value)} style={campo} />

      <label>Concepto del pago</label>
      <input type="text" value={s.concepto || ''} onChange={e => set('concepto', e.target.value)} style={campo} placeholder="Ej. Reloj Matador Pro 2026" />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <label>Monto PEN (S/)</label>
          <input type="number" step="0.01" min="3" value={s.montoPEN ?? ''} onChange={e => set('montoPEN', Number(e.target.value))} style={{ width: '100%', padding: '6px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Monto USD ($)</label>
          <input type="number" step="0.01" min="1" value={s.montoUSD ?? ''} onChange={e => set('montoUSD', Number(e.target.value))} style={{ width: '100%', padding: '6px' }} />
        </div>
      </div>

      <label>Precio tachado (S/ — opcional, estilo Balvi)</label>
      <input type="number" step="0.01" value={s.precioOriginal ?? ''} onChange={e => set('precioOriginal', Number(e.target.value))} style={campo} placeholder="149.90" />

      <label>Etiqueta de oferta</label>
      <input type="text" value={s.offerBadge || ''} onChange={e => set('offerBadge', e.target.value)} style={campo} placeholder="40% OFF — Oferta limitada" />

      <label>Texto botón sticky móvil</label>
      <input type="text" value={s.stickyCTA || 'COMPRAR AHORA'} onChange={e => set('stickyCTA', e.target.value)} style={campo} />

      <label>ID de producto (opcional — toma precio y nombre)</label>
      <input type="text" value={s.productId || ''} onChange={e => set('productId', e.target.value)} style={campo} placeholder="reloj-matador-pro-2026" />

      <label>Ancla HTML (para CTAs #pagar-ahora)</label>
      <input type="text" value={s.anchorId || 'pagar-ahora'} onChange={e => set('anchorId', e.target.value)} style={campo} />

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={s.showCulqi !== false} onChange={e => set('showCulqi', e.target.checked)} />
          Mostrar Culqi (PEN)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={s.showPayPal !== false} onChange={e => set('showPayPal', e.target.checked)} />
          Mostrar PayPal (USD)
        </label>
      </div>

      <BackgroundStylesControl settings={s} onChange={(key, value) => set(key, value)} />

      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <div style={{ flex: 1 }}>
          <label>Padding Superior</label>
          <input type="text" placeholder="Ej: 3rem" value={s.paddingTop || '2rem'} onChange={e => set('paddingTop', e.target.value)} style={{ width: '100%', padding: '6px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Padding Inferior</label>
          <input type="text" placeholder="Ej: 3rem" value={s.paddingBottom || '2rem'} onChange={e => set('paddingBottom', e.target.value)} style={{ width: '100%', padding: '6px' }} />
        </div>
      </div>
    </div>
  );
}
