import React, { lazy, Suspense, useState } from 'react';
import { Play, ArrowUpRight } from 'lucide-react';
import Acordeon from '../Acordeon';
import { BloqueSeccion } from '../Seccion';
import { Texto } from '../Traduccion';
import { Enlace } from '../Enlace';
import { VideoProducto } from './VideoProducto';
import { ComposicionDetalles } from './ComposicionDetalles';
import { ColeccionDestacadaProducto } from './InformacionCompra';
import { normalizeProductCommerce } from '../../../utils/productCommerce.mjs';
import { initialDetailComposition } from '../../../utils/productDetails.mjs';
import s from './DetallesProducto.module.css';

const EditorDetallesProducto = lazy(() => import('./EditorDetallesProducto'));

/** Contenido de la ficha individual: solo medios y descripción del catálogo. */
export function DetallesProducto({ productoId, nombre, descripcion, imagenes = [], videos = [], categoria, personalizable, soloPersonalizar, composicion, editor, biblioteca = [], onInteraccion }) {
  const [videoActivo, setVideoActivo] = useState(null);
  const [editando, setEditando] = useState(false);
  const detalle = imagenes.filter((f) => f.tipo !== 'video' && !f.juntas)[1];
  const portada = imagenes.find((f) => f.tipo !== 'video' && !f.juntas);
  const c = normalizeProductCommerce(composicion?.commerce, { allowLocal: editor?.local });
  const preguntasBase = [
    ...(!soloPersonalizar ? [{ id: 'opciones', question: '¿Cómo elijo mi producto?', answer: <Texto>Selecciona el color o modelo y, si corresponde, la talla. Revisa la cantidad antes de agregarlo al carrito. La foto principal cambia para mostrar la variante elegida cuando tiene imágenes disponibles.</Texto> }] : []),
    ...(personalizable ? [{ id: 'personalizar', question: '¿Puedo personalizarlo?', answer: <Texto>Este producto tiene una opción de personalización. Usa el botón de personalizar de la ficha para abrir las opciones disponibles y preparar tu diseño.</Texto> }] : []),
    { id: 'compra', question: '¿Cómo continúo con mi compra?', answer: <Texto>{soloPersonalizar ? 'Abre el personalizador para preparar tu diseño y elegir las opciones de tu producto antes de agregarlo al carrito.' : 'Agrega tus productos al carrito para revisarlos juntos, o usa Comprar ahora para continuar con este producto. Completa tus datos de entrega y revisa el resumen antes de confirmar.'}</Texto> },
  ];
  const preguntas = c.faqMode === 'custom' ? c.faqs.map(q => ({ id: q.id, question: q.question, answer: <p style={{ whiteSpace: 'pre-wrap' }}><Texto>{q.answer}</Texto></p> })) : preguntasBase;
  return (
    <>
      {editor?.guardar && !editando && <BloqueSeccion className={s.accesoEditor}><div className={s.editarFila}>
        <span>{composicion ? 'Ficha de venta de este producto' : 'Configura beneficios, condiciones, fotos, vídeos y preguntas'}</span>
        <button type="button" onClick={() => setEditando(true)}>Editar composición</button>
      </div></BloqueSeccion>}
      {editando && editor?.guardar ? <BloqueSeccion id="detalles-producto" className={s.seccion}>
        <Suspense fallback={<p role="status">Abriendo editor…</p>}>
          <EditorDetallesProducto inicial={composicion || initialDetailComposition({ descripcion, imagenes, videos })} productoId={productoId} biblioteca={biblioteca} onGuardar={editor.guardar} onSubir={editor.subir} onCerrar={() => setEditando(false)} local={editor.local} resolverMedia={editor.resolverMedia} />
        </Suspense>
      </BloqueSeccion> : composicion ? (composicion.visible && <BloqueSeccion id="detalles-producto" className={s.seccion}>
        <ComposicionDetalles composicion={composicion} resolverMedia={editor?.resolverMedia} />
      </BloqueSeccion>) : <>
      {videos.length > 0 && (
        <BloqueSeccion className={s.seccion}>
          <div className={s.encabezado}><span className={s.eyebrow}><Texto>Una mirada más de cerca</Texto></span><h2><Texto>Velo en movimiento</Texto></h2></div>
          <div className={s.videos}>
            {videos.map((v, i) => (
              <div key={v.url} className={s.video}>
                {videoActivo === v.url
                  ? <VideoProducto url={v.url} nombre={v.nombre || nombre} />
                  : <button type="button" onClick={() => setVideoActivo(v.url)}>
                    {portada && <img src={portada.url} srcSet={portada.srcSet} sizes="300px" alt="" loading="lazy" />}
                    <span className={s.reproducir}><Play aria-hidden="true" /><Texto>{v.nombre || `Ver vídeo ${i + 1}`}</Texto></span>
                  </button>}
              </div>
            ))}
          </div>
        </BloqueSeccion>
      )}
      {descripcion && (
        <BloqueSeccion id="detalles-producto" className={s.seccion}>
          <div className={[s.detalles, detalle && s.conImagen].filter(Boolean).join(' ')}>
            {detalle && <div className={s.fotografia}><img src={detalle.url} srcSet={detalle.srcSet} sizes="(max-width: 899px) 100vw, 48vw" alt={[nombre, detalle.nombre].filter(Boolean).join(' · ')} loading="lazy" /></div>}
            <div className={s.contenido}>
              <span className={s.eyebrow}><Texto>Conoce tu próxima elección</Texto></span>
              <h2><Texto>Todos los detalles</Texto></h2>
              <div className={s.descripcion} dangerouslySetInnerHTML={{ __html: descripcion }} />
              {categoria?.url && <Enlace className={s.categoria} to={categoria.url}><Texto>{`Explorar ${categoria.nombre}`}</Texto><ArrowUpRight aria-hidden="true" /></Enlace>}
            </div>
          </div>
        </BloqueSeccion>
      )}
      </>}
      {!editando && <BloqueSeccion><ColeccionDestacadaProducto resolverMedia={editor?.resolverMedia} config={c} /></BloqueSeccion>}
      {!editando && c.faqMode !== 'hidden' && <BloqueSeccion className={`${s.seccion} ${s.faq}`}>
        <div className={s.preguntas}>
          <div className={s.encabezado}><span className={s.eyebrow}><Texto>Antes de elegir</Texto></span><h2><Texto>{c.faqTitle}</Texto></h2><p><Texto>Un poco de ayuda para preparar tu pedido.</Texto></p></div>
          <Acordeon variante="lista" items={preguntas} onAbrir={id => onInteraccion?.('faq_open', id)} />
        </div>
      </BloqueSeccion>}
    </>
  );
}
