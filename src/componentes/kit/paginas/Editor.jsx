import React, { useState } from 'react';
import { Eye, Sparkles, Pencil, RotateCcw } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio, HojaInferior } from '../Feedback';
import { BloqueSeccion } from '../Seccion';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { PaginaEstudio } from './Estudio';
import s from './Editor.module.css';

/*
 * El editor de un producto del catálogo (/editor/:id). En la tienda es el
 * editor viejo de fabric.js (EditorPage); en el kit es el MISMO estudio de
 * Crear (PaginaEstudio) con la prenda que arma prendaEditorDesde: un solo
 * estudio para todo lo que se personaliza.
 */

/**
 * La página.
 *  - prenda: prendaEditorDesde(producto) · personalizable: false si el
 *    producto no se personaliza (o ya no existe)
 *  - precioCapas: lo que suma cada capa ({ texto: 5, imagen: 10 })
 *  - pendiente: { nombre, fecha } si hay un diseño de este producto sin
 *    terminar: se pregunta si seguir con él (onContinuar) o empezar de nuevo
 *  - urlProducto (volver y "Ver el producto") · urlCrear
 *  - el resto son las props de PaginaEstudio (inicial, modo, sesion, fuentes,
 *    onSubirImagen, onQuitarFondo, onGuardar, onAgregar, onDescargar, estado…)
 */
export function PaginaEditor({ prenda, personalizable = true, precioCapas = { texto: 5, imagen: 10 }, pendiente, onContinuar, urlProducto = '/tienda', urlCrear = '/personalizar', estado, ...estudio }) {
  const [preguntar, setPreguntar] = useState(Boolean(pendiente));

  if (estado !== 'cargando' && estado !== 'error' && (!personalizable || !prenda)) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio
          imagen={CARAS_KAPI.triste}
          titulo={prenda ? 'Este producto no se personaliza' : 'Este producto ya no está disponible'}
          texto={prenda ? 'Puedes comprarlo tal cual o crear tu propio diseño en una prenda de Crear.' : 'Fue retirado del catálogo, pero hay muchas otras opciones esperándote.'}
        >
          <div className={s.botones}>
            {prenda && <Boton to={urlProducto} variante="secundario" icono={<Eye aria-hidden="true" />}>Ver el producto</Boton>}
            <Boton to={urlCrear} icono={<Sparkles aria-hidden="true" />}>Ir a Crear</Boton>
          </div>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }

  return (
    <>
      <PaginaEstudio
        prenda={prenda}
        precioCapas={precioCapas}
        urlVolver={urlProducto}
        urlCrear={urlCrear}
        estado={estado}
        {...estudio}
      />
      <HojaInferior
        abierta={preguntar}
        onCerrar={() => setPreguntar(false)}
        titulo="Tienes un diseño sin terminar"
        pie={(
          <div className={s.hojaBotones}>
            <Boton bloque icono={<Pencil aria-hidden="true" />} onClick={() => { setPreguntar(false); onContinuar?.(); }}>Seguir con mi diseño</Boton>
            <Boton bloque variante="secundario" icono={<RotateCcw aria-hidden="true" />} onClick={() => setPreguntar(false)}>Empezar de nuevo</Boton>
          </div>
        )}
      >
        <p className={s.texto}>
          Encontramos «{pendiente?.nombre || 'tu diseño'}»{pendiente?.fecha ? `, del ${pendiente.fecha}` : ''}, de este mismo producto. ¿Sigues con él o empiezas uno nuevo?
        </p>
      </HojaInferior>
    </>
  );
}
