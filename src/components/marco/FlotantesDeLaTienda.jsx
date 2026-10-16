import React, { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { PilaFlotante, BotonWhatsApp } from '../../componentes/kit/piezas/Flotantes';
import useWhatsAppDeLaRuta from './useWhatsAppDeLaRuta';

const KapiPet = lazy(() => import('../common/KapiPet/KapiPet'));

// Páginas con su propio botón fijo abajo: en el celular la pila tapaba
// título, precio y opciones (antes, .App:has(.product-detail-page)).
const CON_BOTON_FIJO = ['/producto/', '/combo/', '/creacion/'];

/*
 * Lo que flota sobre la página (M7-M10) con el kit: PilaFlotante, abajo a la
 * derecha y sobre la barra inferior en el celular. El primero queda abajo:
 * WhatsApp y encima Kapi. Cada uno decide si sale. Reemplaza al
 * .floating-action-stack de App.jsx.
 */
export default function FlotantesDeLaTienda() {
  const { pathname } = useLocation();
  const whatsapp = useWhatsAppDeLaRuta();

  return (
    <PilaFlotante ocultarEnCelular={CON_BOTON_FIJO.some((r) => pathname.startsWith(r))}>
      {whatsapp && <BotonWhatsApp numero={whatsapp.numero} mensaje={whatsapp.mensaje} />}
      <Suspense fallback={null}><KapiPet /></Suspense>
    </PilaFlotante>
  );
}
