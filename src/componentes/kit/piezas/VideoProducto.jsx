import React, { useEffect, useRef, useState } from 'react';
import { Texto, useTexto } from '../Traduccion';
import s from './VideoProducto.module.css';

/** Montar solo el vídeo elegido: al cambiar de lámina se detiene y libera. */
export function VideoProducto({ url, nombre }) {
  const [error, setError] = useState(false);
  const player = useRef(null);
  const etiqueta = useTexto(nombre || 'Vídeo del producto');
  useEffect(() => {
    const video = player.current;
    return () => { video?.pause(); };
  }, []);
  return (
    <div className={s.contenedor}>
      <video
        ref={player}
        src={url}
        className={s.video}
        controls
        playsInline
        preload="none"
        aria-label={etiqueta}
        onError={() => setError(true)}
      />
      {error && (
        <div className={s.error} role="status">
          <Texto>No se pudo reproducir este vídeo.</Texto>{' '}
          <a href={url} target="_blank" rel="noopener noreferrer"><Texto>Abrir vídeo</Texto></a>
        </div>
      )}
    </div>
  );
}
