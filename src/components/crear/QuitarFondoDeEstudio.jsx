import React from 'react';
import { QuitarFondo } from '../../componentes/kit/piezas/QuitarFondo';
import * as motor from '../../pages/Crear/fondoPixeles';

/** El motor de píxeles solo baja cuando se abre esta herramienta. */
export default function QuitarFondoDeEstudio(props) {
  return <QuitarFondo {...props} motor={motor} />;
}
