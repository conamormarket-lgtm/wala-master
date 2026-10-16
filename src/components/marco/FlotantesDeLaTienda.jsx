import React, { Suspense, lazy, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PilaFlotante, BotonWhatsApp, PildoraRecompensa } from '../../componentes/kit/piezas/Flotantes';
import useWhatsAppDeLaRuta from './useWhatsAppDeLaRuta';

const KapiPet = lazy(() => import('../common/KapiPet/KapiPet'));

// Páginas con su propio botón fijo abajo: en el celular la pila tapaba
// título, precio y opciones (antes, .App:has(.product-detail-page)).
const CON_BOTON_FIJO = ['/producto/', '/combo/', '/creacion/'];

// Donde la píldora de la encuesta estorba: pagar, carrito, panel, páginas con
// un botón fijo abajo y el flujo de cuenta (lo mismo que tenía Header.jsx).
const SIN_PILDORA = [
  '/encuesta-suscripcion', '/checkout', '/carrito', '/admin', '/pago', '/crear/',
  '/producto/', '/creacion/', '/login', '/registro', '/completar-perfil', '/recuperar-contrasena',
];
// La X la oculta 3 días en este navegador (misma clave que antes).
const CLAVE_PILDORA = 'surveyFabHiddenUntil';
const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;

const pildoraOculta = () => {
  try {
    return Number(localStorage.getItem(CLAVE_PILDORA) || 0) > Date.now();
  } catch {
    return false;
  }
};

/*
 * Lo que flota sobre la página (M7-M10) con el kit: PilaFlotante, abajo a la
 * derecha y sobre la barra inferior en el celular. El primero queda abajo:
 * WhatsApp y encima Kapi. A la izquierda, la píldora "Gana 15 monedas".
 * Cada uno decide si sale. Reemplaza al .floating-action-stack de App.jsx y
 * a la píldora que dibujaba Header.jsx.
 */
export default function FlotantesDeLaTienda() {
  const { pathname } = useLocation();
  const { user, userProfile } = useAuth();
  const whatsapp = useWhatsAppDeLaRuta();
  const [sinPildora, setSinPildora] = useState(pildoraOculta);

  const ocultarPildora = () => {
    setSinPildora(true);
    try {
      localStorage.setItem(CLAVE_PILDORA, String(Date.now() + TRES_DIAS));
    } catch {
      /* sin storage: queda oculta solo en esta visita */
    }
  };

  // Se espera a que llegue el perfil: con !userProfile?.hasCompletedSurvey
  // salía a todos un segundo mientras cargaba.
  const conPildora = Boolean(user && userProfile && !userProfile._perfilNoCargado && !userProfile.hasCompletedSurvey)
    && !sinPildora && !SIN_PILDORA.some((r) => pathname.startsWith(r));

  return (
    <PilaFlotante
      ocultarEnCelular={CON_BOTON_FIJO.some((r) => pathname.startsWith(r))}
      izquierda={conPildora && (
        <PildoraRecompensa
          titulo="Gana 15 monedas"
          texto="Completa tu perfil de regalos"
          monedas={15}
          to="/encuesta-suscripcion"
          onCerrar={ocultarPildora}
        />
      )}
    >
      {whatsapp && <BotonWhatsApp numero={whatsapp.numero} mensaje={whatsapp.mensaje} />}
      <Suspense fallback={null}><KapiPet /></Suspense>
    </PilaFlotante>
  );
}
