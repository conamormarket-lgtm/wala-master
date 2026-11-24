import React, { useState } from 'react';
import { Play, X } from 'lucide-react';
import { HojaInferior } from '../Feedback';
import { MedioDetalle } from './ComposicionDetalles';
import s from './HistoriaProducto.module.css';

export function HistoriaProducto({ composicion, resolverMedia = url => url }) {
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState(false);
  const media = composicion.blocks.flatMap(b => b.media.map(m => ({ ...m, key: `${b.id}:${m.id}` }))).find(m => m.key === composicion.commerce?.storyMediaId && m.type === 'video');
  if (!media || closed) return null;
  return <><aside className={s.historia} data-componente="HistoriaProducto">
    <button type="button" className={s.cerrar} aria-label="Ocultar vídeo destacado" onClick={() => setClosed(true)}><X size={14} /></button>
    <button type="button" className={s.abrir} aria-label="Ver vídeo destacado del producto" onClick={() => setOpen(true)}>{media.poster && <img src={resolverMedia(media.poster)} alt="" loading="lazy" />}<span><Play size={20} />Ver en vídeo</span></button>
  </aside><HojaInferior abierta={open} onCerrar={() => setOpen(false)} titulo={media.alt || 'El producto en vídeo'}>{open && <div className={s.video}><MedioDetalle media={media} resolverMedia={resolverMedia} /></div>}</HojaInferior></>;
}
