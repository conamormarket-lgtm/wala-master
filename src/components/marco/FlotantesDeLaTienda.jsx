import React, { Suspense, lazy, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PilaFlotante, BotonWhatsApp, PildoraRecompensa } from '../../componentes/kit/piezas/Flotantes';
import useWhatsAppDeLaRuta from './useWhatsAppDeLaRuta';
import usePrimeraCompra from '../../hooks/usePrimeraCompra';
import { abrirAvisoBienvenida } from './BienvenidaDeTienda';
import { tiempoRestante } from '../../utils/primeraCompra';
import { esRutaDeJuego } from './modoJuego';

// Walito (con su ventana, el reto y el recorrido) llega en su propio archivo,
// como antes: no hace falta para ver la página.
const Kapi = lazy(() => import('./Kapi'));

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
 * WhatsApp y encima Walito. A la izquierda, la píldora "Gana 15 monedas".
 * Cada uno decide si sale. Reemplaza al .floating-action-stack de App.jsx, a
 * KapiPet y a la píldora que dibujaba Header.jsx.
 */
export default function FlotantesDeLaTienda() {
  const { pathname } = useLocation();
  const { user, userProfile } = useAuth();
  const whatsapp = useWhatsAppDeLaRuta();
  const [sinPildora, setSinPildora] = useState(pildoraOculta);
  const { bienvenida } = usePrimeraCompra();

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

  // Semana de bienvenida: su píldora va encima de la de la encuesta (las dos
  // se ven) y abre el aviso grande (BienvenidaDeTienda). La franja de arriba se quitó.
  const semana = bienvenida?.fase?.estado === 'activa' && !SIN_PILDORA.some((r) => pathname.startsWith(r)) && !pathname.startsWith('/cuenta/referidos');
  const pildoraBienvenida = semana && (
    <PildoraRecompensa
      icono="regalo"
      titulo={bienvenida.saldo > 0 ? `Tienes S/ ${Number(bienvenida.saldo).toFixed(2)} de regalo` : 'Tu primera compra gratis'}
      texto={`Vence en ${tiempoRestante(bienvenida.fase.venceMs)}`}
      onAbrir={abrirAvisoBienvenida}
    />
  );

  return (
    <PilaFlotante
      // Y en los minijuegos (modo juego): Walito y WhatsApp tapaban los tubos.
      ocultarEnCelular={CON_BOTON_FIJO.some((r) => pathname.startsWith(r)) || esRutaDeJuego(pathname)}
      izquierda={(pildoraBienvenida || conPildora) && (
        <>
          {conPildora && (
            <PildoraRecompensa
              titulo="Gana 15 monedas"
              texto="Completa tu perfil de regalos"
              monedas={15}
              to="/encuesta-suscripcion"
              onCerrar={ocultarPildora}
            />
          )}
          {pildoraBienvenida}
        </>
      )}
    >
      {whatsapp && <BotonWhatsApp numero={whatsapp.numero} mensaje={whatsapp.mensaje} />}
      <Suspense fallback={null}><Kapi /></Suspense>
    </PilaFlotante>
  );
}
