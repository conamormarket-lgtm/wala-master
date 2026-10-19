import React from 'react';
import { PaginaSuscripciones } from '../../componentes/kit/paginas/Suscripciones';

/*
 * La suscripción de regalos (/suscripciones) con el kit (paso 6,
 * CAMPANAS.md). Como antes, solo textos: los dos botones llevan a la
 * encuesta (/encuesta-suscripcion, que pide cuenta). Diferente: todo pasa
 * por la traducción (antes, partes sueltas) y la caja es la Walá Box del kit.
 * Lo de antes: pages/SubscriptionLandingViejo.jsx (interruptor campanasViejo).
 */
export default function SuscripcionesDeTienda() {
  return <PaginaSuscripciones urlEncuesta="/encuesta-suscripcion" />;
}
