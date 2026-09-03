import React, { useState, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Button from '../../common/Button';
import { toDirectImageUrl } from '../../../utils/imageUrl';

// Relación de aspecto de la tarjeta del catálogo principal (PremiumProductCard,
// aspect-ratio 3/4). El recorte se autoriza con este mismo aspecto para que la
// portada NO se deforme al mostrarse en la tienda. (Las demás listas usan 4/5,
// diferencia mínima e imperceptible.)
const CARD_ASPECT = 3 / 4;

// Ancho mínimo del recuadro en píxeles (sobre la imagen mostrada) para evitar
// recortes diminutos.
const MIN_WIDTH_PX = 40;

/**
 * Editor INLINE de encuadre (crop no destructivo) de la portada de una variante.
 *
 * Usa react-image-crop: el recuadro se REDIMENSIONA arrastrando sus esquinas,
 * manteniendo la proporción 3/4 bloqueada (`aspect`) y sin poder salirse de la
 * imagen (react-image-crop restringe la selección a los límites de la imagen).
 *
 * No sube ni modifica el archivo: emite coordenadas en el formato
 * { percentages: {x,y,width,height} } (0–100) que ya lee OptimizedImage vía
 * `cropData` y que las tarjetas del catálogo aplican.
 */
const ThumbnailCropEditor = ({ imageUrl, initialCrop, onSave, onCancel }) => {
  const preview = toDirectImageUrl(imageUrl || '');

  // Estado del recuadro en unidades porcentuales (mismo formato que guardamos).
  const [crop, setCrop] = useState(() => {
    const p = initialCrop?.percentages;
    return p && p.width > 0 && p.height > 0
      ? { unit: '%', x: p.x, y: p.y, width: p.width, height: p.height }
      : undefined;
  });

  // Al cargar la imagen, si aún no hay recuadro creamos uno centrado 3/4 que
  // SIEMPRE entre dentro de la imagen: si la imagen es más ancha que 3/4, la
  // altura es el límite (fijamos height); si es más angosta, el límite es el ancho.
  const onImageLoad = useCallback((e) => {
    if (crop) return;
    const { width, height } = e.currentTarget;
    const imageAspect = width / height;
    const partial = imageAspect >= CARD_ASPECT
      ? { unit: '%', height: 90 }
      : { unit: '%', width: 90 };
    const initial = centerCrop(
      makeAspectCrop(partial, CARD_ASPECT, width, height),
      width,
      height
    );
    setCrop(initial);
  }, [crop]);

  const handleSave = () => {
    if (crop && crop.width > 0 && crop.height > 0) {
      onSave({
        percentages: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
      });
    } else {
      onSave(null);
    }
  };

  const handleReset = () => {
    setCrop(undefined);
    onSave(null);
  };

  if (!preview) {
    return (
      <div style={{ padding: '2rem 0', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
        Primero agrega una imagen de portada a la variante.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
        Arrastra las esquinas para cambiar el <strong>tamaño</strong> del recuadro
        (mantiene la proporción 3:4) y muévelo para elegir qué parte se ve en la
        miniatura del catálogo. El recuadro no puede salirse de la imagen.
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#111',
          borderRadius: '8px',
          padding: '0.5rem',
          maxHeight: '460px',
          overflow: 'hidden',
        }}
      >
        <ReactCrop
          crop={crop}
          onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
          aspect={CARD_ASPECT}
          minWidth={MIN_WIDTH_PX}
          keepSelection
          ruleOfThirds
        >
          <img
            src={preview}
            alt="Portada de la variante"
            onLoad={onImageLoad}
            crossOrigin="anonymous"
            style={{ display: 'block', maxHeight: '440px', maxWidth: '100%', objectFit: 'contain' }}
          />
        </ReactCrop>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <Button
          type="button"
          variant="secondary"
          onClick={handleReset}
          title="Quitar el encuadre y mostrar la imagen completa"
        >
          Quitar encuadre
        </Button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={handleSave}>
            Guardar encuadre
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ThumbnailCropEditor;
