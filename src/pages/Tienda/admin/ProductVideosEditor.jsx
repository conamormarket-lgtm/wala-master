import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2, Video } from 'lucide-react';
import { uploadProductVideo } from '../../../services/productVideoUpload';
import { MAX_PRODUCT_VIDEOS, PRODUCT_VIDEO_ACCEPT, validateProductVideo } from '../../../utils/productVideos.mjs';
import { VideoProducto } from '../../../componentes/kit/piezas/VideoProducto';
import s from './ProductVideosEditor.module.css';

export default function ProductVideosEditor({ videos = [], productId, onChange, onUploaded, onBusyChange, disabled = false }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const controller = useRef(null);
  const busy = progress !== null;
  useEffect(() => () => controller.current?.abort(), []);

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || controller.current || disabled) return;
    setError('');
    if (videos.length + files.length > MAX_PRODUCT_VIDEOS) {
      setError(`Puedes adjuntar hasta ${MAX_PRODUCT_VIDEOS} vídeos por producto.`);
      return;
    }
    for (const file of files) {
      const invalid = validateProductVideo(file);
      if (invalid) { setError(`${file.name}: ${invalid}`); return; }
    }
    const current = new AbortController();
    controller.current = current;
    onBusyChange(true);
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (current.signal.aborted) break;
        setProgress({ name: file.name, percent: 0, index: index + 1, total: files.length });
        const video = await uploadProductVideo(file, productId, {
          signal: current.signal,
          onProgress: (percent) => setProgress({ name: file.name, percent, index: index + 1, total: files.length }),
        });
        // Cada subida exitosa se añade inmediatamente; un fallo posterior
        // no descarta los archivos que ya se adjuntaron.
        onUploaded(video);
      }
    } catch (err) {
      setError(current.signal.aborted ? 'Subida cancelada. Los vídeos ya adjuntados se conservan.' : `No se pudo subir el vídeo. ${err.message || 'Revisa tu conexión y vuelve a intentarlo.'}`);
    } finally {
      controller.current = null;
      setProgress(null);
      onBusyChange(false);
    }
  };

  const move = (index, offset) => {
    const next = [...videos];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };

  return (
    <section className={s.editor} aria-label="Vídeos del producto">
      <h2>Vídeos del producto</h2>
      <p>Aparecen junto a las fotos en la página individual, para todos los colores. MP4 o WebM, hasta 100 MB cada uno y {MAX_PRODUCT_VIDEOS} vídeos por producto. Recomendamos MP4 con vídeo H.264.</p>
      <div className={s.list}>
        {videos.map((video, index) => (
          <article key={video.url} className={s.item}>
            <div className={s.preview}><VideoProducto url={video.url} nombre={video.name} /></div>
            <label className={s.name}>
              Título del vídeo {index + 1}
              <input value={video.name || ''} maxLength={120} disabled={busy || disabled} placeholder={`Vídeo ${index + 1}`} onChange={(e) => onChange(videos.map((v, i) => i === index ? { ...v, name: e.target.value } : v))} />
            </label>
            <div className={s.actions}>
              <button type="button" disabled={busy || disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Mover vídeo ${index + 1} antes`}><ArrowUp size={16} /></button>
              <button type="button" disabled={busy || disabled || index === videos.length - 1} onClick={() => move(index, 1)} aria-label={`Mover vídeo ${index + 1} después`}><ArrowDown size={16} /></button>
              <button type="button" disabled={busy || disabled} onClick={() => onChange(videos.filter((_, i) => i !== index))}><Trash2 size={16} /> Quitar</button>
            </div>
          </article>
        ))}
      </div>
      <label className={s.upload}>
        <Video size={20} /> Adjuntar vídeos
        <input type="file" accept={PRODUCT_VIDEO_ACCEPT} multiple onChange={upload} disabled={busy || disabled || videos.length >= MAX_PRODUCT_VIDEOS} />
      </label>
      {progress && (
        <div className={s.progress} role="status" aria-live="polite">
          <span>Subiendo {progress.index} de {progress.total}: {progress.name} · {progress.percent}%</span>
          <progress max="100" value={progress.percent} aria-label="Progreso de subida del vídeo" />
          <button type="button" onClick={() => controller.current?.abort()}>Cancelar subida</button>
        </div>
      )}
      {error && <p className={s.error} role="alert">{error}</p>}
      <p>Guarda los cambios del producto para publicar los vídeos o aplicar los cambios.</p>
    </section>
  );
}
