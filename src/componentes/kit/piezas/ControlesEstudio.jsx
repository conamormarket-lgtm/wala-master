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

/* Estos controles ya traducen su etiqueta y su descripción: el estudio les
   pasa el español tal cual (traducirlo aquí lo traducía dos veces). */
export const CampoEstudio = Campo;
export const CantidadEstudio = Cantidad;
export const DeslizadorEstudio = Deslizador;
export const SelectorColorEstudio = SelectorColor;
export const CasillaEstudio = Casilla;
export const InterruptorEstudio = Interruptor;
