import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2, Undo2, Redo2, Save, Image, Video, Columns2, Type, Grid2X2 } from 'lucide-react';
import { useBorrador } from '../editor/useBorrador';
import { useConfirmar } from '../Feedback';
import EditorInformacionCompra from './EditorInformacionCompra';
import { BeneficiosProducto, InformacionCompra, ColeccionDestacadaProducto } from './InformacionCompra';
import { ComposicionDetalles } from './ComposicionDetalles';
import { MAX_DETAIL_BLOCKS, MAX_DETAIL_MEDIA, MULTI_DETAIL_KINDS, DETAIL_MEDIA_ACCEPT, newDetailBlock, moveDetailItem, normalizeDetailComposition, validateDetailComposition, validateDetailFile, detailMediaType, detailMediaUrl } from '../../../utils/productDetails.mjs';
import { flexibleMosaic, mosaicCell, hasOwnMediaRatio } from '../../../utils/productMosaic.mjs';
import s from './EditorDetallesProducto.module.css';

const TIPOS = [['image', 'Foto', Image], ['video', 'Vídeo', Video], ['split', 'Foto o vídeo + texto', Columns2], ['gallery', 'Galería', Grid2X2], ['mosaic', 'Mosaico', Grid2X2], ['carousel', 'Carrusel', Video], ['text', 'Texto', Type]];
const nombreTipo = kind => TIPOS.find(([k]) => k === kind)?.[1] || 'Bloque';
function Campo({ label, children }) { return <label className={s.campo}><span>{label}</span>{children}</label>; }
function leerBorrador(key, allowLocal) {
  try { return normalizeDetailComposition(JSON.parse(sessionStorage.getItem(key)), { allowLocal }); } catch { return null; }
}

export default function EditorDetallesProducto({ inicial, productoId, biblioteca = [], onGuardar, onSubir, onCerrar, resolverMedia, local = false, embedded = false, onDraftChange, onBusyChange }) {
  const draftKey = `wala-product-details-draft:${local ? 'local' : 'store'}:${productoId}`;
  const { secciones: draft, cambiar, deshacer, rehacer, puedeDeshacer, puedeRehacer, sinGuardar } = useBorrador(inicial);
  const [tab, setTab] = useState('venta');
  const callbacks = useRef({ onDraftChange, onBusyChange });
  callbacks.current = { onDraftChange, onBusyChange };
  const touched = useRef(false);
  const [selected, setSelected] = useState(inicial.blocks[0]?.id);
  const [movil, setMovil] = useState(false);
  const [soloVista, setSoloVista] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subida, setSubida] = useState(null);
  const [recuperable, setRecuperable] = useState(() => embedded ? null : leerBorrador(draftKey, local));
  const [url, setUrl] = useState('');
  const [tipoUrl, setTipoUrl] = useState('image');
  const controller = useRef(null);
  const confirmar = useConfirmar();
  const block = draft.blocks.find(b => b.id === selected);
  const index = draft.blocks.findIndex(b => b.id === selected);
  const busy = guardando || Boolean(subida);
  const change = (patch, key) => cambiar(d => ({ ...d, ...patch }), key);
  const update = (patch, key) => cambiar(d => ({ ...d, blocks: d.blocks.map(b => b.id === selected ? { ...b, ...patch } : b) }), key && `${selected}:${key}`);
  const limpiarBorrador = () => { try { sessionStorage.removeItem(draftKey); } catch { /* Navegador sin storage. */ } };

  useEffect(() => {
    if (!embedded) return;
    if (sinGuardar) touched.current = true;
    if (touched.current) callbacks.current.onDraftChange?.(draft);
  }, [draft, sinGuardar, embedded]);
  useEffect(() => { callbacks.current.onBusyChange?.(busy); return () => callbacks.current.onBusyChange?.(false); }, [busy]);
  useEffect(() => {
    if (embedded) return undefined;
    if (!sinGuardar) {
      if (!recuperable) { try { sessionStorage.removeItem(draftKey); } catch { /* Navegador sin storage. */ } }
      return undefined;
    }
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* El borrador permanece en memoria. */ }
    const avisar = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [draft, draftKey, sinGuardar, recuperable, embedded]);
  useEffect(() => () => controller.current?.abort(), []);

  const add = kind => {
    if (draft.blocks.length >= MAX_DETAIL_BLOCKS) return;
    const b = newDetailBlock(kind);
    cambiar(d => ({ ...d, blocks: [...d.blocks, b] }));
    setSelected(b.id); setSoloVista(false); setError('');
  };
  const attach = (media, target = selected) => {
    cambiar(d => ({ ...d, blocks: d.blocks.map(b => b.id !== target ? b : {
      ...b, media: MULTI_DETAIL_KINDS.includes(b.kind) ? [...b.media, media].slice(0, MAX_DETAIL_MEDIA) : [media],
    }) }));
  };
  const accepts = type => block && block.kind !== 'text' && (!['image', 'video'].includes(block.kind) || block.kind === type);
  const upload = async e => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length || controller.current || !block) return;
    const max = MULTI_DETAIL_KINDS.includes(block.kind) ? MAX_DETAIL_MEDIA - block.media.length : 1;
    if (files.length > max) { setError(`Puedes añadir ${max} archivo(s) a este bloque.`); return; }
    for (const file of files) {
      const invalid = validateDetailFile(file);
      if (invalid || !accepts(detailMediaType(file))) { setError(invalid || `Este bloque admite ${block.kind === 'image' ? 'fotos' : 'vídeos'}.`); return; }
    }
    const current = new AbortController(); controller.current = current;
    const target = selected;
    setError('');
    try {
      for (const file of files) {
        setSubida({ name: file.name, percent: 0 });
        const media = await onSubir(file, { signal: current.signal, onProgress: percent => setSubida({ name: file.name, percent }) });
        if (current.signal.aborted) break;
        attach(media, target);
      }
    } catch (e) { setError(current.signal.aborted ? 'Subida cancelada. Los archivos anteriores siguen en el borrador.' : e.message || 'No se pudo subir el archivo.'); }
    finally { controller.current = null; setSubida(null); }
  };
  const uploadPoster = async (e, mediaId, field = 'poster') => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || controller.current || !block) return;
    const invalid = validateDetailFile(file);
    if (invalid || detailMediaType(file) !== 'image') { setError(invalid || 'Elige una imagen.'); return; }
    const target = selected;
    const current = new AbortController(); controller.current = current;
    setError(''); setSubida({ name: file.name, percent: 0 });
    try {
      const poster = await onSubir(file, { signal: current.signal, onProgress: percent => setSubida({ name: file.name, percent }) });
      if (!current.signal.aborted) cambiar(d => ({ ...d, blocks: d.blocks.map(b => b.id === target ? { ...b, media: b.media.map(m => m.id === mediaId ? { ...m, [field]: poster.url } : m) } : b) }));
    } catch (e) { setError(current.signal.aborted ? 'Subida cancelada.' : e.message); }
    finally { controller.current = null; setSubida(null); }
  };
  const uploadCollectionImage = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || controller.current) return;
    const invalid = validateDetailFile(file);
    if (invalid || detailMediaType(file) !== 'image') { setError(invalid || 'Elige una foto para la colección.'); return; }
    const current = new AbortController(); controller.current = current;
    setError(''); setSubida({ name: file.name, percent: 0 });
    try {
      const media = await onSubir(file, { signal: current.signal, onProgress: percent => setSubida({ name: file.name, percent }) });
      if (!current.signal.aborted) cambiar(d => ({ ...d, commerce: { ...d.commerce, collection: { ...d.commerce?.collection, image: media.url } } }));
    } catch (e) { setError(current.signal.aborted ? 'Subida cancelada.' : e.message); }
    finally { controller.current = null; setSubida(null); }
  };
  const cellControl = (media, i) => {
    const cell = mosaicCell(media.cell, block.columns, block.mobileColumns);
    const changeCell = (key, value) => update({ media: block.media.map((m, n) => n === i ? { ...m, cell: mosaicCell({ ...cell, [key]: value }, block.columns, block.mobileColumns) } : m) });
    return <div className={s.dos}>{[
      ['width', 'Ancho de pieza', block.columns, 1], ['height', 'Alto de pieza', 4, 1],
      ['column', 'Columna inicial', block.columns - cell.width + 1, 0],
      ['mobileWidth', 'Ancho en móvil', block.mobileColumns, 1], ['mobileHeight', 'Alto en móvil', 3, 1],
    ].filter(([key]) => !hasOwnMediaRatio(media) || !['height', 'mobileHeight'].includes(key)).map(([key, label, max, min]) => <Campo key={key} label={label}><select aria-label={`${label} ${i + 1}`} value={cell[key]} onChange={e => changeCell(key, Number(e.target.value))}>{Array.from({ length: max - min + 1 }, (_, n) => n + min).map(n => <option key={n} value={n}>{n === 0 ? 'Automática' : n}</option>)}</select></Campo>)}</div>;
  };
  const save = async () => {
    const invalid = validateDetailComposition(draft, { allowLocal: local });
    if (invalid) { setError(invalid); return; }
    setError(''); setGuardando(true);
    try { await onGuardar(normalizeDetailComposition(draft, { allowLocal: local })); limpiarBorrador(); onCerrar(); }
    catch (e) { setError(e.message || 'No se pudo guardar. Tu borrador sigue aquí.'); }
    finally { setGuardando(false); }
  };
  const cancel = async () => {
    if (sinGuardar && !(await confirmar({ titulo: '¿Descartar los cambios?', texto: 'La composición guardada se mantendrá.', confirmar: 'Descartar cambios' }))) return;
    limpiarBorrador(); onCerrar();
  };

  return (
    <div className={s.editor} data-componente="EditorDetallesProducto">
      <div className={s.barra}>
        <div><strong>Diseñar la ficha de venta</strong><small>{embedded ? 'Se guarda con el producto' : local ? 'Guardado local en este navegador' : 'Contenido de este producto'} · {sinGuardar ? 'Cambios sin guardar' : 'Sin cambios'}</small></div>
        <div className={s.acciones}>
          <button type="button" disabled={busy || !puedeDeshacer} onClick={deshacer} aria-label="Deshacer"><Undo2 /></button>
          <button type="button" disabled={busy || !puedeRehacer} onClick={rehacer} aria-label="Rehacer"><Redo2 /></button>
          {!embedded && <button type="button" disabled={busy} onClick={cancel}>Cancelar</button>}
          {!embedded && <button type="button" className={s.guardar} disabled={busy} onClick={save}><Save />{guardando ? 'Guardando…' : 'Guardar composición'}</button>}
        </div>
      </div>
      {error && <p className={s.error} role="alert">{error}</p>}
      {recuperable && <div className={s.recuperar}>Hay un borrador de una edición anterior.
        <button type="button" disabled={busy} onClick={() => { cambiar(recuperable); setSelected(recuperable.blocks[0]?.id); setRecuperable(null); }}>Recuperar borrador</button>
        <button type="button" disabled={busy} onClick={() => { limpiarBorrador(); setRecuperable(null); }}>Descartar borrador</button>
      </div>}
      {subida && <div className={s.recuperar} role="status">Subiendo {subida.name}: {subida.percent}% <button type="button" onClick={() => controller.current?.abort()}>Cancelar subida</button></div>}
      <div className={s.espacio}>
        <fieldset className={s.panel} disabled={busy}>
          <legend>Contenido y distribución</legend>
          <div className={s.acciones}><button type="button" aria-pressed={tab === 'venta'} onClick={() => setTab('venta')}>Información de venta</button><button type="button" aria-pressed={tab === 'medios'} onClick={() => setTab('medios')}>Fotos y vídeos</button></div>
          {tab === 'venta' ? <EditorInformacionCompra value={draft.commerce} onChange={(commerce, key) => change({ commerce }, key)} blocks={draft.blocks} biblioteca={biblioteca} productoId={productoId} local={local} resolverMedia={resolverMedia} onSubirImagen={onSubir ? uploadCollectionImage : undefined} /> : <>
          <p className={s.aviso}>Combina bloques para mostrar el uso, el empaque y ejemplos de personalización.</p>
          <details open><summary>Cabecera de la sección</summary>
            <Campo label="Título de sección"><input aria-label="Título de sección" maxLength={160} value={draft.heading} onChange={e => change({ heading: e.target.value }, 'heading')} /></Campo>
            <Campo label="Antetítulo"><input aria-label="Antetítulo" maxLength={160} value={draft.eyebrow} onChange={e => change({ eyebrow: e.target.value }, 'eyebrow')} /></Campo>
            <label className={s.check}><input type="checkbox" checked={draft.visible} onChange={e => change({ visible: e.target.checked })} />Mostrar esta sección</label>
          </details>
          <h3>Bloques <span>{draft.blocks.length}/{MAX_DETAIL_BLOCKS}</span></h3>
          <ol className={s.lista}>{draft.blocks.map((b, i) => <li key={b.id}>
            <button type="button" aria-pressed={b.id === selected} onClick={() => { setSelected(b.id); setUrl(''); }}>{i + 1}. {b.title || nombreTipo(b.kind)}</button>
          </li>)}</ol>
          <div className={s.agregar}>{TIPOS.map(([kind, label, Icon]) => <button type="button" key={kind} disabled={draft.blocks.length >= MAX_DETAIL_BLOCKS} onClick={() => add(kind)}><Icon />Añadir {label.toLowerCase()}</button>)}</div>
          {block && <div className={s.propiedades}>
            <h3>Bloque {index + 1} · {nombreTipo(block.kind)}</h3>
            <Campo label="Tipo de bloque"><select aria-label="Tipo de bloque" value={block.kind} onChange={e => update({ kind: e.target.value, media: e.target.value === 'text' ? [] : MULTI_DETAIL_KINDS.includes(e.target.value) ? block.media : block.media.filter(m => !['image', 'video'].includes(e.target.value) || m.type === e.target.value).slice(0, 1) })}>{TIPOS.map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></Campo>
            <div className={s.acciones}>
              <button type="button" aria-label="Subir bloque" disabled={index <= 0} onClick={() => change({ blocks: moveDetailItem(draft.blocks, index, -1) })}><ArrowUp /></button>
              <button type="button" aria-label="Bajar bloque" disabled={index >= draft.blocks.length - 1} onClick={() => change({ blocks: moveDetailItem(draft.blocks, index, 1) })}><ArrowDown /></button>
              <button type="button" aria-label="Duplicar bloque" disabled={draft.blocks.length >= MAX_DETAIL_BLOCKS} onClick={() => { const copy = { ...block, id: crypto.randomUUID(), media: block.media.map(m => ({ ...m, id: crypto.randomUUID() })) }; change({ blocks: [...draft.blocks.slice(0, index + 1), copy, ...draft.blocks.slice(index + 1)] }); setSelected(copy.id); }}><Copy /></button>
              <button type="button" aria-label="Eliminar bloque" onClick={() => { change({ blocks: draft.blocks.filter(b => b.id !== selected) }); setSelected(draft.blocks[index - 1]?.id || draft.blocks[index + 1]?.id); }}><Trash2 /></button>
            </div>
            <Campo label="Título del bloque"><input aria-label="Título del bloque" maxLength={200} value={block.title} onChange={e => update({ title: e.target.value }, 'title')} /></Campo>
            <Campo label="Texto del bloque"><textarea aria-label="Texto del bloque" rows={5} maxLength={12000} value={block.text} onChange={e => update({ text: e.target.value }, 'text')} /></Campo>
            <div className={s.dos}>
              <Campo label="Ancho"><select aria-label="Ancho" value={block.width} onChange={e => update({ width: e.target.value })}><option value="wide">Completo</option><option value="normal">Medio</option><option value="narrow">Estrecho</option></select></Campo>
              <Campo label="Alineación"><select aria-label="Alineación" value={block.align} onChange={e => update({ align: e.target.value })}><option value="left">Izquierda</option><option value="center">Centrada</option></select></Campo>
              <Campo label="Fondo"><select aria-label="Fondo" value={block.background} onChange={e => update({ background: e.target.value })}><option value="plain">Sin recuadro</option><option value="soft">Con recuadro</option></select></Campo>
              {block.kind === 'split' && <Campo label="Posición del medio"><select aria-label="Posición del medio" value={block.side} onChange={e => update({ side: e.target.value })}><option value="left">Izquierda</option><option value="right">Derecha</option></select></Campo>}
              {MULTI_DETAIL_KINDS.includes(block.kind) && <>
                {(block.kind !== 'mosaic' || block.mosaicLayout === 'flexible') && <Campo label="Columnas escritorio"><select aria-label="Columnas escritorio" value={block.columns} onChange={e => update({ columns: Number(e.target.value) })}>{(block.kind === 'mosaic' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4]).map(n => <option key={n}>{n}</option>)}</select></Campo>}
                <Campo label="Columnas móvil"><select aria-label="Columnas móvil" value={block.mobileColumns} onChange={e => update({ mobileColumns: Number(e.target.value) })}>{[1, 2].map(n => <option key={n}>{n}</option>)}</select></Campo>
              </>}
              {block.kind !== 'text' && <>
                {(block.kind !== 'mosaic' || block.mosaicLayout === 'flexible') && <Campo label={block.kind === 'mosaic' ? 'Proporción de las celdas' : 'Proporción'}><select aria-label="Proporción" value={block.kind === 'mosaic' && block.mosaicSizing !== 'proportional' ? 'auto' : block.ratio} onChange={e => update({ ratio: e.target.value, ...(block.kind === 'mosaic' && { mosaicSizing: e.target.value === 'auto' ? 'manual' : 'proportional' }) })}><option value="auto">{block.kind === 'mosaic' ? 'Altura manual' : 'Original'}</option><option value="square">Cuadrada</option><option value="portrait34">Vertical 3:4</option><option value="portrait">Vertical 4:5</option><option value="story">Historia 9:16</option><option value="landscape">Horizontal 16:9</option></select></Campo>}
                <Campo label="Ajuste"><select aria-label="Ajuste" value={block.fit} onChange={e => update({ fit: e.target.value })}><option value="contain">Ver completo</option><option value="cover">Rellenar y recortar</option></select></Campo>
              </>}
            </div>
            {block.kind !== 'text' && <>
              {block.kind === 'mosaic' && <>
                <Campo label="Distribución del mosaico"><select aria-label="Distribución del mosaico" value={block.mosaicLayout || 'classic'} onChange={e => update(e.target.value === 'flexible' ? flexibleMosaic(block) : { mosaicLayout: 'classic' })}><option value="classic">Clásica: una pieza destacada</option><option value="flexible">Libre: tamaño por pieza</option></select></Campo>
                {block.mosaicLayout === 'flexible' && <>{block.mosaicSizing !== 'proportional' ? <><Campo label="Altura de cada fila"><input type="range" aria-label="Altura de cada fila" min="80" max="400" step="20" value={block.rowHeight || 200} onChange={e => update({ rowHeight: Number(e.target.value) })} /></Campo><small>{block.rowHeight || 200} px por fila.</small></> : <small>La altura se adapta al ancho en escritorio y móvil. Para conservar esta proporción, usa el mismo número de columnas y filas por pieza.</small>}<small>Puedes cambiar el tamaño y la columna de cada pieza. Las filas se acomodan sin superponerse; el orden sigue la lista.</small></>}
              </>}
              <h4>{MULTI_DETAIL_KINDS.includes(block.kind) ? 'Fotos y vídeos de la galería' : 'Foto o vídeo del bloque'}</h4>
              {block.media.map((m, i) => <details className={s.archivo} key={`${m.id}-${i}`} open={i === 0}>
                <summary><strong>{m.type === 'video' ? 'Vídeo' : 'Foto'} {i + 1} · {m.alt || 'Editar archivo'}</strong></summary>
                {m.type === 'image' && <img className={s.miniatura} src={resolverMedia ? resolverMedia(m.url) : m.url} alt={m.alt || ''} loading="lazy" />}
                {m.type === 'image' && <>
                  <Campo label="Reemplazar imagen"><input aria-label={`Reemplazar imagen ${i + 1}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={!onSubir} onChange={e => uploadPoster(e, m.id, 'url')} /></Campo>
                  <details><summary>Imagen alternativa para móvil</summary><small>Se muestra en pantallas de hasta 620 px. Sin alternativa se usa la misma imagen.</small>
                    <Campo label="Enlace de la imagen móvil"><input aria-label={`Imagen móvil ${i + 1}`} value={m.mobileUrl || ''} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, mobileUrl: e.target.value } : x) }, `mobile-${i}`)} /></Campo>
                    <Campo label="Subir imagen móvil"><input aria-label={`Subir imagen móvil ${i + 1}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={!onSubir} onChange={e => uploadPoster(e, m.id, 'mobileUrl')} /></Campo>
                    {m.mobileUrl && <><img className={s.miniatura} src={resolverMedia ? resolverMedia(m.mobileUrl) : m.mobileUrl} alt="Versión móvil" /><button type="button" onClick={() => update({ media: block.media.map((x, k) => k === i ? { ...x, mobileUrl: '' } : x) })}>Usar la misma imagen en móvil</button></>}
                  </details>
                </>}
                <div>
                  <Campo label="Proporción de este archivo"><select aria-label={`Proporción del archivo ${i + 1}`} value={m.ratio || 'inherit'} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, ratio: e.target.value } : x) })}><option value="inherit">Heredar del bloque</option><option value="auto">Original del archivo</option><option value="square">Cuadrada 1:1</option><option value="portrait34">Vertical 3:4</option><option value="portrait">Vertical 4:5</option><option value="story">Vertical 9:16</option><option value="landscape">Horizontal 16:9</option></select></Campo>
                  <Campo label="Ajuste de este archivo"><select aria-label={`Ajuste del archivo ${i + 1}`} value={m.fit || 'inherit'} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, fit: e.target.value } : x) })}><option value="inherit">Heredar del bloque</option><option value="contain">Mostrar completo</option><option value="cover">Rellenar y recortar</option></select></Campo>
                </div>
                {block.kind === 'mosaic' && hasOwnMediaRatio(m) && <small>La altura de esta pieza sigue su proporción en escritorio y móvil. Las demás conservan sus propios ajustes.</small>}
                {m.type === 'video' && <>
                  <label className={s.check}><input type="checkbox" aria-label={`Reproducción automática del vídeo ${i + 1}`} checked={m.autoPlay === true} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, autoPlay: e.target.checked, ...(e.target.checked && { muted: true }) } : x) })} />Reproducir automáticamente</label>
                  <label className={s.check}><input type="checkbox" aria-label={`Sin sonido en el vídeo ${i + 1}`} checked={m.autoPlay === true || m.muted === true} disabled={m.autoPlay === true} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, muted: e.target.checked } : x) })} />Sin sonido</label>
                  <label className={s.check}><input type="checkbox" aria-label={`Repetir en bucle el vídeo ${i + 1}`} checked={m.loop === true} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, loop: e.target.checked } : x) })} />Repetir en bucle</label>
                  {m.autoPlay && <small>La reproducción automática comienza sin sonido. El visitante puede pausar o activar el audio.</small>}
                </>}
                {block.kind === 'mosaic' && block.mosaicLayout === 'flexible' && cellControl(m, i)}
                <div className={s.acciones}>
                  {MULTI_DETAIL_KINDS.includes(block.kind) && <><button type="button" disabled={i === 0} aria-label={`Subir archivo ${i + 1}`} onClick={() => update({ media: moveDetailItem(block.media, i, -1) })}><ArrowUp /></button><button type="button" disabled={i === block.media.length - 1} aria-label={`Bajar archivo ${i + 1}`} onClick={() => update({ media: moveDetailItem(block.media, i, 1) })}><ArrowDown /></button></>}
                  <button type="button" aria-label={`Quitar archivo ${i + 1}`} onClick={() => update({ media: block.media.filter((_, k) => k !== i) })}><Trash2 /></button>
                </div>
                <Campo label="Descripción accesible"><input aria-label={`Descripción accesible ${i + 1}`} maxLength={240} value={m.alt} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, alt: e.target.value } : x) }, `alt-${i}`)} /></Campo>
                {m.type === 'video' && <><Campo label="Portada del vídeo (HTTPS)"><input aria-label={`Portada del vídeo ${i + 1}`} value={m.poster || ''} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, poster: e.target.value } : x) }, `poster-${i}`)} /></Campo><Campo label="Subir portada del vídeo"><input aria-label={`Subir portada del vídeo ${i + 1}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={!onSubir} onChange={e => uploadPoster(e, m.id)} /></Campo></>}
                <Campo label="Pie de foto o vídeo"><input aria-label={`Pie de archivo ${i + 1}`} maxLength={400} value={m.caption} onChange={e => update({ media: block.media.map((x, k) => k === i ? { ...x, caption: e.target.value } : x) }, `caption-${i}`)} /></Campo>
              </details>)}
              <Campo label={MULTI_DETAIL_KINDS.includes(block.kind) ? 'Subir archivos' : 'Subir o reemplazar archivo'}><input aria-label="Subir archivos" type="file" accept={block.kind === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : block.kind === 'video' ? 'video/mp4,video/webm' : DETAIL_MEDIA_ACCEPT} multiple={MULTI_DETAIL_KINDS.includes(block.kind)} onChange={upload} disabled={!onSubir || (MULTI_DETAIL_KINDS.includes(block.kind) && block.media.length >= MAX_DETAIL_MEDIA)} /></Campo>
              <small>Fotos hasta 20 MB · Vídeos MP4/WebM hasta 100 MB. {!MULTI_DETAIL_KINDS.includes(block.kind) && 'Elegir otro archivo reemplaza el actual.'}</small>
              <details><summary>Elegir del producto</summary><div className={s.biblioteca}>{biblioteca.filter(m => accepts(m.type)).map((m, i) => <button type="button" key={m.url} disabled={MULTI_DETAIL_KINDS.includes(block.kind) && block.media.length >= MAX_DETAIL_MEDIA} aria-label={`Usar ${m.type === 'video' ? 'vídeo' : 'foto'} del producto ${i + 1}`} onClick={() => attach({ ...m, id: crypto.randomUUID() })}>{m.type === 'image' ? <img src={resolverMedia ? resolverMedia(m.url) : m.url} alt="" loading="lazy" /> : <Video />}<span>{m.alt || `Archivo ${i + 1}`}</span></button>)}</div></details>
              <details><summary>Usar un enlace HTTPS</summary>
                {!['image', 'video'].includes(block.kind) && <Campo label="Tipo de enlace"><select aria-label="Tipo de enlace" value={tipoUrl} onChange={e => setTipoUrl(e.target.value)}><option value="image">Foto</option><option value="video">Vídeo MP4/WebM</option></select></Campo>}
                <Campo label="URL del archivo"><input aria-label="URL del archivo" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></Campo>
                <button type="button" disabled={MULTI_DETAIL_KINDS.includes(block.kind) && block.media.length >= MAX_DETAIL_MEDIA} onClick={() => { const safe = detailMediaUrl(url); if (!safe) { setError('Introduce una URL HTTPS válida de un archivo.'); return; } attach({ id: crypto.randomUUID(), type: ['image', 'video'].includes(block.kind) ? block.kind : tipoUrl, url: safe, alt: '', caption: '' }); setUrl(''); setError(''); }}>Añadir enlace</button>
              </details>
            </>}
          </div>}
        </>}
        </fieldset>
        <div className={s.lienzo}>
          <div className={s.vistas}><span>Vista previa</span><button type="button" aria-pressed={!movil} onClick={() => setMovil(false)}>Escritorio</button><button type="button" aria-pressed={movil} onClick={() => setMovil(true)}>Móvil</button><label><input type="checkbox" checked={soloVista} onChange={e => setSoloVista(e.target.checked)} />Ocultar controles</label></div>
          {!draft.visible && <p className={s.aviso}>La sección está oculta para los visitantes.</p>}
          {!draft.blocks.length && <p className={s.aviso}>Añade tu primer bloque desde el panel.</p>}
          <div className={movil ? s.movil : undefined}>
            {tab === 'venta' && <><BeneficiosProducto config={draft.commerce} /><InformacionCompra config={draft.commerce} personalizable /><ColeccionDestacadaProducto resolverMedia={resolverMedia} config={draft.commerce} />{draft.commerce?.faqMode === 'custom' && <div className={s.aviso}><h3>{draft.commerce.faqTitle}</h3>{draft.commerce.faqs.map(q => <div key={q.id}><strong>{q.question}</strong><p>{q.answer}</p></div>)}</div>}<p className={s.aviso}>Las recomendaciones, opiniones y WhatsApp aparecen en la ficha cuando tienen datos disponibles.</p></>}
            <ComposicionDetalles composicion={draft} resolverMedia={resolverMedia} vistaMovil={movil} seleccionado={soloVista ? null : selected} onSeleccionar={soloVista || busy ? undefined : id => { setSelected(id); setTab('medios'); }} mostrarOculta />
          </div>
        </div>
      </div>
    </div>
  );
}
