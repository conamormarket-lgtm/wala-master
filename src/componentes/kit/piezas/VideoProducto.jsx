import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { Texto, useTexto } from '../Traduccion';
import s from './VideoProducto.module.css';

/** Montar solo el vídeo elegido: al cambiar de lámina se detiene y libera. */
export function VideoProducto({ url, nombre, portada }) {
  const [error, setError] = useState(false);
  const [preparado, setPreparado] = useState(false);
  const [iniciado, setIniciado] = useState(false);
  const player = useRef(null);
  const fotograma = useRef(null);
  const etiqueta = useTexto(nombre || 'Vídeo del producto');
  const reproducirEtiqueta = useTexto(`Reproducir ${nombre || 'vídeo del producto'}`);
  useEffect(() => {
    const video = player.current;
    return () => { video?.pause(); };
  }, []);

  const prepararVistaPrevia = (event) => {
    const video = event.currentTarget;
    if (!video.paused || video.currentTime > 0 || !Number.isFinite(video.duration) || video.duration <= 0) return;
    // Pedir un fotograma, sin reproducir: funciona también para vídeos ya
    // subidos que no tienen una portada guardada.
    fotograma.current = Math.min(0.1, video.duration / 2);
    video.currentTime = fotograma.current;
  };
  const mostrarFotograma = (event) => {
    if (!event.currentTarget.seeking && event.currentTarget.readyState >= 2) setPreparado(true);
  };
  const alReproducir = (event) => {
    const video = event.currentTarget;
    // La vista previa no debe saltarse el principio al pulsar play. Si la
    // persona ya adelantó el vídeo con la barra, respetamos esa posición.
    if (fotograma.current !== null && Math.abs(video.currentTime - fotograma.current) < 0.05) video.currentTime = 0;
    fotograma.current = null;
    setIniciado(true);
    setPreparado(true);
  };
  return (
    <div className={s.contenedor}>
      <video
        ref={player}
        src={url}
        className={s.video}
        controls
        playsInline
        preload="metadata"
        aria-label={etiqueta}
        onLoadedMetadata={prepararVistaPrevia}
        onLoadedData={mostrarFotograma}
        onSeeked={mostrarFotograma}
        onPlay={alReproducir}
        onError={() => setError(true)}
      />
      {!preparado && !iniciado && !error && (
        <div className={s.cargando}>
          {portada && <img src={portada} className={s.portada} alt="" />}
          <span role="status"><Texto>Cargando vista previa…</Texto></span>
        </div>
      )}
      {!iniciado && !error && (
        <button
          type="button"
          className={s.reproducir}
          aria-label={reproducirEtiqueta}
          onClick={() => { player.current?.play()?.catch(() => setError(true)); }}
        ><Play aria-hidden="true" /></button>
      )}
      {error && (
        <div className={s.error} role="status">
          <Texto>No se pudo reproducir este vídeo.</Texto>{' '}
          <a href={url} target="_blank" rel="noopener noreferrer"><Texto>Abrir vídeo</Texto></a>
        </div>
      )}
    </div>
  );
}
