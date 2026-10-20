import React from 'react';
import { ArrowLeft, ArrowLeftRight, Images, ImagePlus, Type } from 'lucide-react';
import Boton from '../Boton';
import { Pestanas } from '../Navegacion';
import { Texto, useTexto } from '../Traduccion';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { soles } from '../TarjetaProducto';
import s from './Estudio.module.css';

/** El marco visual de P12. El lienzo y el estado llegan desde fuera. */
export function MarcoEstudio({
  nombre, color, lados = [], precio, precioAntes, sesion,
  urlVolver = '/personalizar', etiquetaVolver = 'Volver', urlCreaciones = '/cuenta/creaciones',
  avisos, lienzo, panel, compra, children, className, claseCuerpo, clasePanel,
  clasePanelContenido, panelRef, panelContenidoRef,
}) {
  const volver = useTexto(etiquetaVolver);
  const creaciones = useTexto('Mis creaciones');
  return (
    <div className={[s.pagina, className].filter(Boolean).join(' ')} data-componente="PaginaEstudio">
      {/* El modo móvil de Fabric oculta los header globales: esta cabeza
          forma parte del editor y debe seguir visible. */}
      <div className={s.cabeza}>
        <Boton to={urlVolver} variante="fantasma" tamano="sm" soloIcono aria-label={volver} title={volver} icono={<ArrowLeft aria-hidden="true" />} />
        <div className={s.titulo}>
          <h1><Texto>{nombre}</Texto></h1>
          <span className={s.subtitulo}>
            <span className={s.punto} style={{ background: color?.hex }} aria-hidden="true" />
            <Texto>{color?.nombre}</Texto>
            {lados.length > 0 && <> · <Texto>{lados.join(' + ')}</Texto></>}
          </span>
        </div>
        <span className={s.precio}>
          {soles(precio)}
          {precioAntes > precio && <s>{soles(precioAntes)}</s>}
        </span>
        {sesion && <Boton to={urlCreaciones} variante="fantasma" tamano="sm" icono={<Images aria-hidden="true" />} className={s.misCreaciones} aria-label={creaciones} title={creaciones}><Texto>Mis creaciones</Texto></Boton>}
      </div>
      {avisos && <div className={s.aviso} data-avisos-estudio="">{avisos}</div>}
      <div className={[s.cuerpo, claseCuerpo].filter(Boolean).join(' ')}>
        {lienzo}
        <aside ref={panelRef} className={[s.panel, clasePanel].filter(Boolean).join(' ')}>
          <div ref={panelContenidoRef} className={[s.panelCuerpo, clasePanelContenido].filter(Boolean).join(' ')}>{panel}</div>
          {compra}
        </aside>
      </div>
      {children}
    </div>
  );
}

/** El mismo inicio sobre la prenda, tanto con Fabric como en la demo. */
export function InicioLienzoEstudio({ zona, onImagen, onTexto, subiendo }) {
  return (
    <div className={s.empezar}>
      <p><TextoResaltado resaltar={[zona]}>{`Empieza tu diseño en ${zona}`}</TextoResaltado></p>
      <span className={s.empezarBotones}>
        <Boton tamano="sm" icono={<ImagePlus aria-hidden="true" />} onClick={onImagen} cargando={subiendo}><Texto>Subir imagen</Texto></Boton>
        <Boton tamano="sm" variante="secundario" icono={<Type aria-hidden="true" />} onClick={onTexto}><Texto>Escribir texto</Texto></Boton>
      </span>
    </div>
  );
}

/**
 * La escena de P12, igual en la demo y en la tienda: las pestañas de los
 * lados (con cuántos diseños lleva cada uno), la prenda, la barra y la zona
 * elegida. La prenda llega de fuera (LienzoPrenda en la demo; el lienzo de
 * Fabric en la tienda).
 *  - lados: [{ id, nombre, cuenta }] · lado · onLado(id)
 *  - barra: la BarraLienzo · zona: "Frente · Pecho"
 *  - escenaRef y el resto (soltar archivos…) van a la <section>
 */
export function EscenaEstudio({ lados = [], lado, onLado, barra, zona, escenaRef, className, children, ...props }) {
  const etiqueta = useTexto('Tu prenda');
  return (
    <section ref={escenaRef} className={[s.escena, className].filter(Boolean).join(' ')} aria-label={etiqueta} {...props}>
      {lados.length > 1 && (
        <Pestanas
          etiqueta="Lado de la prenda"
          opciones={lados.map((l) => ({ id: l.id, texto: <Texto>{l.nombre}</Texto>, cuenta: l.cuenta || undefined }))}
          valor={lado}
          onChange={onLado}
        />
      )}
      {children}
      {barra}
      {zona && <p className={s.zonaInfo}><Texto>Zona elegida</Texto>: <strong><Texto>{zona}</Texto></strong></p>}
    </section>
  );
}

/**
 * Mientras se arrastra algo, arriba de la prenda: a qué otro lado se puede
 * pasar. Cada destino lleva data-soltar-lado (el lienzo lo busca bajo el
 * puntero, en la demo y con Fabric).
 *  - lados: [{ id, nombre }] (los otros) · activo: el que está bajo el puntero
 */
export function SoltarLados({ lados = [], activo }) {
  return (
    <div className={s.soltarLados} role="status">
      {lados.map((v) => (
        <span key={v.id} data-soltar-lado={v.id} className={[s.soltarLado, activo === v.id && s.soltarLadoActivo].filter(Boolean).join(' ')}>
          <ArrowLeftRight aria-hidden="true" /> <TextoResaltado resaltar={[v.nombre]}>{`Suelta aquí para pasar a ${v.nombre}`}</TextoResaltado>
        </span>
      ))}
    </div>
  );
}
