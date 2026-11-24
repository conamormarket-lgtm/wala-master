import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Texto } from '../Traduccion';
import { HojaInferior } from '../Feedback';
import { mosaicStyle, MOSAIC_ROW_RATIOS, mediaAppearanceStyle, hasOwnMediaRatio } from '../../../utils/productMosaic.mjs';
import { detailVideoPlayback, pauseCompetingDetailVideos } from '../../../utils/detailVideoPlayback.mjs';
import s from './ComposicionDetalles.module.css';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function MedioDetalle({ media, resolverMedia = url => url, onAmpliar, style, mixed = false, playbackEnabled = true }) {
  const url = resolverMedia(media.url);
  const figure = useRef(null);
  const video = useRef(null);
  const { autoPlay, muted, loop } = detailVideoPlayback(media);
  const [natural, setNatural] = useState(null);
  const original = media.ratio === 'auto';
  const naturalRatio = natural?.url === url ? natural.ratio : null;
  useEffect(() => {
    const el = video.current;
    if (!el || !autoPlay || !playbackEnabled) return undefined;
    // Also applies when the editor enables autoplay on an already loaded clip.
    // If the browser declines, the native play control stays available.
    el.play()?.catch(() => {});
    return () => el.pause();
  }, [autoPlay, playbackEnabled, url]);
  const readDimensions = e => {
    if (!original) return;
    const el = e.currentTarget;
    const width = el.naturalWidth || el.videoWidth;
    const height = el.naturalHeight || el.videoHeight;
    if (width > 0 && height > 0) setNatural({ url, ratio: width / height });
  };
  useBrowserLayoutEffect(() => {
    if (!original) return;
    // The editor can select Original after this asset has already loaded.
    const el = figure.current?.querySelector('img, video');
    const width = el?.naturalWidth || el?.videoWidth;
    const height = el?.naturalHeight || el?.videoHeight;
    if (width > 0 && height > 0) setNatural({ url, ratio: width / height });
  }, [original, url]);
  // Fine grid rows reserve each tile's real height, including its caption.
  // Width and column controls still work; content never overlaps after resize.
  useBrowserLayoutEffect(() => {
    if (!mixed || !figure.current) return undefined;
    const el = figure.current;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(el.parentElement).columnGap) || 0;
      el.style.setProperty('--filas-necesarias', String(Math.max(1, Math.ceil(el.getBoundingClientRect().height + gap))));
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    observer?.observe(el.parentElement);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); el.style.removeProperty('--filas-necesarias'); };
  }, [mixed, url]);
  const visual = !url ? <div className={s.pendiente}><Texto>Cargando archivo…</Texto></div>
        : media.type === 'video'
          ? <video ref={video} key={url} src={url} poster={media.poster ? resolverMedia(media.poster) : undefined} controls playsInline autoPlay={autoPlay && playbackEnabled} muted={muted} loop={loop} preload={autoPlay || original ? 'metadata' : 'none'} onLoadedMetadata={readDimensions} aria-label={media.alt || 'Vídeo del producto'} onPlay={e => pauseCompetingDetailVideos(e.currentTarget)} />
          : <img src={url} alt={media.alt || ''} loading="lazy" decoding="async" onLoad={readDimensions} />;
  const expand = onAmpliar && <button type="button" className={s.ampliar} onClick={onAmpliar} aria-label={`Ampliar ${media.alt || (media.type === 'video' ? 'vídeo' : 'foto')}`}><Texto>Ampliar</Texto> ↗</button>;
  const frameStyle = hasOwnMediaRatio(media)
    ? { aspectRatio: original ? naturalRatio || (media.type === 'video' ? 16 / 9 : 3 / 4) : 1 / MOSAIC_ROW_RATIOS[media.ratio] }
    : { height: 'var(--altura-heredada)' };
  return (
    <figure ref={figure} className={s.media} style={style} data-media-id={media.id}>
      {mixed ? <div className={s.marcoMixto} style={frameStyle}>{visual}{expand}</div> : visual}
      {media.caption && <figcaption><Texto>{media.caption}</Texto></figcaption>}
      {!mixed && expand}
    </figure>
  );
}

function MediosBloque({ bloque: b, resolverMedia }) {
  const strip = useRef(null);
  const [active, setActive] = useState(null);
  const carousel = b.kind === 'carousel';
  const mixed = b.kind === 'mosaic' && b.media.some(hasOwnMediaRatio);
  const layout = mixed && b.mosaicLayout !== 'flexible' ? { ...b, columns: 3 } : b;
  const mixedStyle = mixed ? { '--columnas': layout.columns } : undefined;
  const open = i => { strip.current?.querySelectorAll('video').forEach(v => v.pause()); setActive(i); };
  return <div className={s.medios}>
    {carousel && <div className={s.navegacion}><span><Texto>Desliza para ver más</Texto></span><button type="button" aria-label="Medios anteriores" onClick={() => strip.current?.scrollBy({ left: -strip.current.clientWidth * 0.85, behavior: 'smooth' })}>←</button><button type="button" aria-label="Medios siguientes" onClick={() => strip.current?.scrollBy({ left: strip.current.clientWidth * 0.85, behavior: 'smooth' })}>→</button></div>}
    <div ref={strip} style={mixedStyle} className={mixed ? [s.mosaicoMixto, b.mosaicSizing === 'proportional' && MOSAIC_ROW_RATIOS[b.ratio] && s.heredaProporcion].filter(Boolean).join(' ') : carousel ? s.carrusel : b.kind === 'mosaic' ? (b.mosaicLayout === 'flexible' ? [s.mosaicoLibre, b.mosaicSizing === 'proportional' && MOSAIC_ROW_RATIOS[b.ratio] && s.mosaicoProporcional].filter(Boolean).join(' ') : s.mosaico) : b.kind === 'gallery' ? s.galeria : undefined} tabIndex={carousel ? 0 : undefined} role={carousel ? 'region' : undefined} aria-label={carousel ? b.title || 'Fotos y vídeos del producto' : undefined}>
      {b.media.map((m, index) => {
        const placed = mixed && b.mosaicLayout !== 'flexible' ? { ...m, cell: { width: index === 0 ? 2 : 1, height: index === 0 ? 2 : 1, mobileWidth: index === 0 ? b.mobileColumns : 1 } } : m;
        return <MedioDetalle key={`${m.id}-${index}`} media={m} mixed={mixed} playbackEnabled={active == null} style={{ ...(b.kind === 'mosaic' && (mixed || b.mosaicLayout === 'flexible') ? mosaicStyle(placed, layout) : {}), ...mediaAppearanceStyle(m) }} resolverMedia={resolverMedia} onAmpliar={() => open(index)} />;
      })}
    </div>
    <HojaInferior abierta={active != null} onCerrar={() => setActive(null)} titulo={b.title || 'Mira el producto de cerca'}>
      {active != null && b.media[active] && <div className={s.ampliado}><MedioDetalle key={active} media={b.media[active]} resolverMedia={resolverMedia} />{b.media.length > 1 && <div className={s.navegacion}><button type="button" disabled={active === 0} onClick={() => setActive(active - 1)}>← Anterior</button><span>{active + 1} / {b.media.length}</span><button type="button" disabled={active === b.media.length - 1} onClick={() => setActive(active + 1)}>Siguiente →</button></div>}</div>}
    </HojaInferior>
  </div>;
}

export function ComposicionDetalles({ composicion, resolverMedia, onSeleccionar, seleccionado, mostrarOculta = false }) {
  if (!composicion || (!composicion.visible && !mostrarOculta)) return null;
  return (
    <div className={s.composicion} data-componente="ComposicionDetalles">
      {(composicion.heading || composicion.eyebrow) && <header className={s.cabecera}>
        {composicion.eyebrow && <span><Texto>{composicion.eyebrow}</Texto></span>}
        {composicion.heading && <h2><Texto>{composicion.heading}</Texto></h2>}
      </header>}
      <div className={s.bloques}>
        {composicion.blocks.map((b, i) => (
          <div key={b.id} className={[s.bloque, s[b.width], s[b.background], onSeleccionar && s.editable, seleccionado === b.id && s.seleccionado].filter(Boolean).join(' ')} data-bloque-detalle={b.id}>
            {onSeleccionar && <button type="button" className={s.editar} onClick={() => onSeleccionar(b.id)}>Editar bloque {i + 1}</button>}
            <div className={[s.contenido, b.kind === 'split' && s.dividido, b.side === 'right' && s.invertido].filter(Boolean).join(' ')} style={{ '--fila-mosaico': `${b.rowHeight || 200}px`, '--alto-celda': MOSAIC_ROW_RATIOS[b.ratio] || 1, '--columnas': b.columns, '--columnas-movil': b.mobileColumns, '--proporcion': { auto: 'auto', square: '1', portrait: '4 / 5', portrait34: '3 / 4', landscape: '16 / 9', story: '9 / 16' }[b.ratio], '--ajuste': b.fit, textAlign: b.align }}>
              {b.media.length > 0 && <MediosBloque bloque={b} resolverMedia={resolverMedia} />}
              {(b.title || b.text) && <div className={s.texto}>
                {b.title && <h3><Texto>{b.title}</Texto></h3>}
                {b.text && <p><Texto>{b.text}</Texto></p>}
              </div>}
              {onSeleccionar && !b.media.length && !b.title && !b.text && <p className={s.pendiente}><Texto>Selecciona este bloque para añadir contenido.</Texto></p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
