import React from 'react';
import { normalizeProductCommerce } from '../../../utils/productCommerce.mjs';
import { moveDetailItem } from '../../../utils/productDetails.mjs';
import SelectorProductosFicha from './SelectorProductosFicha';
import s from './EditorDetallesProducto.module.css';

export default function EditorInformacionCompra({ value, onChange, blocks = [], biblioteca = [], onSubirImagen, resolverMedia = url => url, local, productoId }) {
  const defaults = normalizeProductCommerce();
  const c = { ...defaults, ...value, collection: { ...defaults.collection, ...value?.collection } };
  const set = (key, val) => onChange({ ...c, [key]: val }, `commerce:${key}`);
  const field = (key, label, multiline = false) => <label className={s.campo}><span>{label}</span>{multiline
    ? <textarea aria-label={label} rows={3} maxLength={['delivery', 'warranty', 'information'].includes(key) ? 1200 : 800} value={c[key]} onChange={e => set(key, e.target.value)} />
    : <input aria-label={label} maxLength={key === 'policyUrl' ? 2048 : key === 'subtitle' ? 240 : 400} value={c[key]} onChange={e => set(key, e.target.value)} />}</label>;
  const check = (key, label) => <label className={s.check}><input type="checkbox" checked={c[key]} onChange={e => set(key, e.target.checked)} />{label}</label>;
  const list = (key, label, fields, max) => <><h4>{label}</h4>{c[key].map((row, i) => <div className={s.archivo} key={row.id}>
    {fields.map(([name, title]) => <label className={s.campo} key={name}><span>{title} {i + 1}</span>{name === 'answer'
      ? <textarea aria-label={`${title} ${i + 1}`} maxLength={2400} value={row[name]} onChange={e => set(key, c[key].map((r, n) => n === i ? { ...r, [name]: e.target.value } : r))} />
      : <input aria-label={`${title} ${i + 1}`} maxLength={400} value={row[name]} onChange={e => set(key, c[key].map((r, n) => n === i ? { ...r, [name]: e.target.value } : r))} />}</label>)}
    <div className={s.acciones}><button type="button" disabled={!i} aria-label={`Subir ${label} ${i + 1}`} onClick={() => set(key, moveDetailItem(c[key], i, -1))}>↑</button><button type="button" disabled={i === c[key].length - 1} aria-label={`Bajar ${label} ${i + 1}`} onClick={() => set(key, moveDetailItem(c[key], i, 1))}>↓</button><button type="button" onClick={() => set(key, c[key].filter((_, n) => n !== i))}>Quitar {label.toLowerCase()} {i + 1}</button></div>
  </div>)}<button type="button" disabled={c[key].length >= max} onClick={() => set(key, [...c[key], { id: crypto.randomUUID(), ...Object.fromEntries(fields.map(([f]) => [f, ''])) }])}>Añadir {label.toLowerCase()}</button></>;
  return <div>
    <details open><summary>Presentación y beneficios</summary>{field('subtitle', 'Frase debajo del nombre')}{list('highlights', 'Beneficio', [['text', 'Beneficio']], 6)}{field('priceNote', 'Nota junto al precio')}
      <small>Los importes se editan en General. Estos textos no cambian el precio cobrado.</small>
    </details>
    <details><summary>Compra y personalización</summary><label className={s.campo}><span>Acción principal</span><select aria-label="Acción principal" value={c.primaryAction} onChange={e => set('primaryAction', e.target.value)}><option value="add">Agregar al carrito</option><option value="buy">Comprar ahora</option><option value="personalize">Personalizar (si está disponible)</option></select></label>{field('personalizationNote', 'Qué incluye la personalización', true)}{field('paymentNote', 'Condiciones de pago', true)}{list('steps', 'Paso', [['text', 'Paso de compra']], 5)}</details>
    <details><summary>Entrega, garantía y ayuda</summary><p>Se muestran como desplegables junto a los botones de compra. Deja el contenido vacío para ocultar cada sección.</p>{field('deliveryTitle', 'Título de entrega')}{check('showShippingRate', 'Mostrar la tarifa estándar de Walá')}{field('delivery', 'Plazos y cobertura de entrega', true)}{field('warrantyTitle', 'Título de garantía')}{field('warranty', 'Garantía y cambios', true)}{field('policyUrl', 'Enlace a las condiciones')}
      <small>Indica condiciones vigentes para este producto. La tarifa se toma de Walá y la fecha final se confirma al pagar.</small>{check('showHelp', 'Mostrar consulta por WhatsApp')}{field('helpLabel', 'Texto del botón de ayuda')}<small>Usa el número y mensaje configurados en General o en la marca.</small>{check('showTrust', 'Mostrar distintivos generales de confianza')}{check('showSticky', 'Mostrar botón de compra fijo')}
    </details>
    <details><summary>Información y características</summary>{field('informationTitle', 'Título de información')}{field('information', 'Información del producto', true)}{list('specifications', 'Característica', [['label', 'Nombre de característica'], ['value', 'Valor de característica']], 16)}</details>
    <details><summary>Preguntas frecuentes</summary><label className={s.campo}><span>Preguntas visibles</span><select aria-label="Preguntas visibles" value={c.faqMode} onChange={e => set('faqMode', e.target.value)}><option value="default">Ayuda general de Walá</option><option value="custom">Preguntas de este producto</option><option value="hidden">Ocultar sección</option></select></label>{field('faqTitle', 'Título de preguntas')}{c.faqMode === 'custom' && list('faqs', 'Pregunta', [['question', 'Pregunta'], ['answer', 'Respuesta']], 16)}</details>
    <details><summary>Colección destacada</summary><label className={s.check}><input type="checkbox" checked={c.collection.enabled} onChange={e => set('collection', { ...c.collection, enabled: e.target.checked })} />Mostrar una colección o alternativa</label>
      {c.collection.enabled && [['title', 'Título de colección'], ['text', 'Descripción de colección'], ['href', 'Enlace de colección'], ['label', 'Texto del enlace de colección']].map(([key, label]) => <label className={s.campo} key={key}><span>{label}</span><input aria-label={label} value={c.collection[key]} maxLength={key === 'href' || key === 'image' ? 2048 : 400} onChange={e => onChange({ ...c, collection: { ...c.collection, [key]: e.target.value } }, `collection:${key}`)} /></label>)}
      {c.collection.enabled && <><label className={s.campo}><span>Subir imagen de colección</span><input aria-label="Subir imagen de colección" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={!onSubirImagen} onChange={onSubirImagen} /></label>
        {c.collection.image && <><img style={{ width: '100%', maxHeight: 140, objectFit: 'contain' }} src={resolverMedia(c.collection.image)} alt="Imagen de colección seleccionada" /><button type="button" onClick={() => set('collection', { ...c.collection, image: '' })}>Quitar imagen de colección</button></>}
        <details><summary>Elegir una foto del producto</summary><div className={s.biblioteca}>{biblioteca.filter(m => m.type === 'image').map((m, i) => <button type="button" key={m.url} aria-label={`Usar foto de colección ${i + 1}`} onClick={() => set('collection', { ...c.collection, image: m.url })}><img src={resolverMedia(m.url)} alt={m.alt || ''} loading="lazy" /></button>)}</div></details>
        <details><summary>Usar enlace de imagen</summary><label className={s.campo}><span>Imagen de colección (HTTPS)</span><input aria-label="Imagen de colección (HTTPS)" value={c.collection.image} onChange={e => set('collection', { ...c.collection, image: e.target.value })} /></label></details>
      </>}
    </details>
    <details><summary>Opiniones y recomendaciones</summary>{check('showReviews', 'Mostrar opiniones reales')}{check('showRelated', 'Mostrar productos relacionados')}{field('relatedTitle', 'Título de relacionados')}
      <SelectorProductosFicha ids={c.relatedIds} onChange={ids => set('relatedIds', ids)} productId={productoId} local={local} />
      {check('showRecent', 'Mostrar vistos recientemente')}{field('recentTitle', 'Título de vistos recientemente')}
    </details>
    <details><summary>Vídeo destacado flotante</summary><label className={s.campo}><span>Vídeo destacado</span><select aria-label="Vídeo destacado" value={c.storyMediaId} onChange={e => set('storyMediaId', e.target.value)}><option value="">Sin vídeo flotante</option>{blocks.flatMap(b => b.media.filter(m => m.type === 'video').map(m => <option key={`${b.id}:${m.id}`} value={`${b.id}:${m.id}`}>{b.title || 'Bloque'} · {m.alt || 'Vídeo'}</option>))}</select></label><small>El cliente lo abre voluntariamente y puede cerrarlo. Añade una portada en las propiedades del vídeo.</small></details>
  </div>;
}
