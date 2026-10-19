import React from 'react';
import { ArrowLeft, Images, ImagePlus, Type } from 'lucide-react';
import Boton from '../Boton';
import { Texto, useTexto } from '../Traduccion';
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
      <p><Texto>Empieza tu diseño en</Texto> <strong><Texto>{zona}</Texto></strong></p>
      <span className={s.empezarBotones}>
        <Boton tamano="sm" icono={<ImagePlus aria-hidden="true" />} onClick={onImagen} cargando={subiendo}><Texto>Subir imagen</Texto></Boton>
        <Boton tamano="sm" variante="secundario" icono={<Type aria-hidden="true" />} onClick={onTexto}><Texto>Escribir texto</Texto></Boton>
      </span>
    </div>
  );
}
