import React from 'react';
import { Check } from 'lucide-react';
import { Sello } from '../Marca';
import { Texto } from '../Traduccion';
import s from './Estudio.module.css';

/** El sello de un paso también se usa fuera del estudio, sin cargar el editor. */
export function PasoEstudio({ numero, titulo, detalle, hecho = false, children }) {
  return (
    <section className={[s.paso, hecho && s.pasoHecho].filter(Boolean).join(' ')} data-componente="PasoEstudio">
      <h2 className={s.pasoTitulo}>
        <Sello tamano={30} girar={numero % 2 ? -8 : 6} tono={hecho ? 'menta' : 'degradado'}>
          {hecho ? <Check key="hecho" className={s.pasoCheck} aria-hidden="true" /> : <b className={s.pasoNumero}>{numero}</b>}
        </Sello>
        <span><Texto>{titulo}</Texto>{detalle && <em>: <Texto>{detalle}</Texto></em>}{hecho && <span className={s.oculto}> <Texto>(listo)</Texto></span>}</span>
      </h2>
      {children}
    </section>
  );
}
