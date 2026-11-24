import React, { useMemo } from 'react';
import LegalDeTienda from '../components/legales/LegalDeTienda';
import usePrimeraCompra from '../hooks/usePrimeraCompra';
import { documentoBienvenida } from '../config/legales/bienvenida';

/*
 * Las condiciones de la promo "Tu primera compra puede salir gratis"
 * (/bienvenida) con PaginaLegal del kit, como los términos. Con sesión, los
 * montos son los de la config de la promo; sin sesión, los del lanzamiento.
 */
export default function BienvenidaPage() {
  const { bienvenida } = usePrimeraCompra();
  const promo = bienvenida?.promo;
  const documento = useMemo(
    () => documentoBienvenida(promo ? { premio: promo.premio, minimo: promo.minimoNeto, horas: promo.horas } : {}),
    [promo],
  );
  return (
    <LegalDeTienda
      tipo="terminos"
      documento={documento}
      otro={{ pregunta: '¿Buscabas las condiciones del servicio?', texto: 'Términos y Condiciones', url: '/terminos-y-condiciones' }}
      mensaje="¡Hola Walá! Tengo una consulta sobre la promo de bienvenida."
    />
  );
}
