import React from 'react';
import Boton from '../Boton';
import { Campo, Cantidad, Deslizador, SelectorColor, Casilla, Interruptor } from '../Formulario';
import { Texto, useTexto } from '../Traduccion';

/** Las etiquetas accesibles conservan su tipo cadena al traducirse. */
export function BotonEstudio({ children, title, 'aria-label': etiqueta, ...props }) {
  const titulo = useTexto(title);
  const accesible = useTexto(etiqueta);
  return <Boton {...props} title={titulo} aria-label={accesible}>{typeof children === 'string' ? <Texto>{children}</Texto> : children}</Boton>;
}

function conTextoEstudio(Componente) {
  return function ControlEstudio({ etiqueta, descripcion, ...props }) {
    const rotulo = useTexto(etiqueta);
    const detalle = useTexto(descripcion);
    return <Componente {...props} etiqueta={rotulo} descripcion={detalle} />;
  };
}

export const CampoEstudio = conTextoEstudio(Campo);
export const CantidadEstudio = conTextoEstudio(Cantidad);
export const DeslizadorEstudio = conTextoEstudio(Deslizador);
export const SelectorColorEstudio = conTextoEstudio(SelectorColor);
export const CasillaEstudio = conTextoEstudio(Casilla);
export const InterruptorEstudio = conTextoEstudio(Interruptor);
