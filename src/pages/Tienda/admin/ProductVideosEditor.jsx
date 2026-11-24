import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2, Video } from 'lucide-react';
import { MAX_PRODUCT_VIDEOS, PRODUCT_VIDEO_ACCEPT, validateProductVideo } from '../../../utils/productVideos.mjs';
import { validateDetailFile, detailMediaType } from '../../../utils/productDetails.mjs';
import { VideoProducto } from '../../../componentes/kit/piezas/VideoProducto';
import s from './ProductVideosEditor.module.css';

export default function ProductVideosEditor({ videos = [], variants = [], productId, onChange, onUploaded, onBusyChange = () => {}, disabled = false, onSubir, onSubirImagen, resolverMedia = url => url, local = false }) {
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
        const uploader = onSubir || (async (file, options) => (await import('../../../services/productVideoUpload')).uploadProductVideo(file, productId, options));
        const video = await uploader(file, {
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

  const update = (index, patch) => onChange(videos.map((v, i) => i === index ? { ...v, ...patch } : v));
  const uploadPoster = async (event, index) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || controller.current || disabled) return;
    const invalid = validateDetailFile(file);
    if (invalid || detailMediaType(file) !== 'image') { setError(invalid || 'La portada debe ser una imagen.'); return; }
    const current = new AbortController(); controller.current = current;
    onBusyChange(true); setError(''); setProgress({ name: file.name, index: 1, total: 1, percent: 0 });
    try {
      const uploader = onSubirImagen || (async (file, options) => (await import('../../../services/productDetailUpload')).uploadProductDetailMedia(file, productId, options));
      const result = await uploader(file, { signal: current.signal, onProgress: percent => setProgress({ name: file.name, index: 1, total: 1, percent }) });
      if (!current.signal.aborted) update(index, { poster: result.url });
    } catch (err) { setError(current.signal.aborted ? 'Subida cancelada.' : err.message); }
    finally { controller.current = null; setProgress(null); onBusyChange(false); }
  };

  const move = (index, offset) => {
    const next = [...videos];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };

  return (
    <section className={s.editor} aria-label="Vídeos del producto">
      <h2>Vídeos del producto</h2>
      <p>Elige en qué color y posición aparece cada vídeo junto a las fotos. MP4 o WebM, hasta 100 MB cada uno y {MAX_PRODUCT_VIDEOS} vídeos por producto.</p>
      <div className={s.list}>
        {videos.map((video, index) => (
          <article key={video.url} className={s.item}>
            <div className={s.preview}><VideoProducto key={video.url} url={resolverMedia(video.url)} portada={resolverMedia(video.poster)} nombre={video.name} /></div>
            <label className={s.name}>
              Título del vídeo {index + 1}
              <input value={video.name || ''} maxLength={120} disabled={busy || disabled} placeholder={`Vídeo ${index + 1}`} onChange={(e) => onChange(videos.map((v, i) => i === index ? { ...v, name: e.target.value } : v))} />
            </label>
            <label className={s.name}>Color del vídeo {index + 1}<select aria-label={`Color del vídeo ${index + 1}`} value={video.variantId || ''} disabled={busy || disabled} onChange={e => update(index, { variantId: e.target.value })}><option value="">Todos los colores</option>{variants.map(v => <option key={v.id} value={v.id}>{v.name || v.nombre}</option>)}{video.variantId && !variants.some(v => v.id === video.variantId) && <option value={video.variantId}>Color eliminado: elige otro</option>}</select></label>
            <label className={s.name}>Posición del vídeo {index + 1}<select aria-label={`Posición del vídeo ${index + 1}`} value={video.afterImage ?? 'end'} disabled={busy || disabled} onChange={e => update(index, { afterImage: e.target.value === 'end' ? undefined : Number(e.target.value) })}><option value="end">Después de todas las fotos</option>{Array.from({ length: Math.max(20, video.afterImage || 0) + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Antes de la primera foto' : `Después de la foto ${n}`}</option>)}</select></label>
            <label className={s.name}>Portada del vídeo {index + 1}<input aria-label={`Portada del vídeo de galería ${index + 1}`} value={video.poster || ''} disabled={busy || disabled} placeholder="https://…" onChange={e => update(index, { poster: e.target.value })} /></label>
            <label className={s.name}>Subir portada<input aria-label={`Subir portada de galería ${index + 1}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || disabled} onChange={e => uploadPoster(e, index)} /></label>
            <label className={s.check}><input type="checkbox" checked={video.autoPlay === true} disabled={busy || disabled} onChange={e => update(index, { autoPlay: e.target.checked, ...(e.target.checked && { muted: true }) })} />Reproducir automáticamente al seleccionarlo</label>
            <label className={s.check}><input type="checkbox" checked={video.autoPlay === true || video.muted === true} disabled={busy || disabled || video.autoPlay === true} onChange={e => update(index, { muted: e.target.checked })} />Sin sonido</label>
            <label className={s.check}><input type="checkbox" checked={video.loop === true} disabled={busy || disabled} onChange={e => update(index, { loop: e.target.checked })} />Repetir en bucle</label>
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
      <p>{local ? 'Los cambios se guardan solo en este navegador.' : 'Guarda el producto para aplicar los cambios.'}</p>
    </section>
  );
}
