import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useIsMobile from '../../hooks/useIsMobile';
import { esAppNativa } from '../../utils/vistaPreviaCalor';
import { BannerApp } from '../../componentes/kit/piezas/Marco';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.wala.tienda';

// Primero la app de Play Store; si no abrió en un segundo, la web.
const abrirPlayStore = () => {
  window.location.href = 'market://details?id=com.wala.tienda';
  setTimeout(() => window.location.replace(PLAY_STORE), 1000);
};

/*
 * Banner "Walá App" (M2) con el kit. Mismas reglas que AppDownloadBanner:
 *  - Solo en el navegador del celular, nunca dentro de la app.
 *  - Se monta donde siempre (TiendaPage, sin landing, categoría ni búsqueda)
 *    pero se pinta ANTES de la cabecera, en #app-top-banner-slot (App.jsx).
 *  - La X lo cierra hasta recargar.
 */
export default function BannerDeLaApp() {
  const { isMobileDevice } = useIsMobile();
  const [cerrado, setCerrado] = useState(false);
  // useLayoutEffect: se engancha antes de pintar, sin un cuadro sin banner.
  const [destino, setDestino] = useState(null);
  useLayoutEffect(() => {
    setDestino(document.getElementById('app-top-banner-slot'));
  }, []);

  if (cerrado || !isMobileDevice || esAppNativa() || !destino) return null;
  return createPortal(
    <BannerApp url={PLAY_STORE} onAccion={abrirPlayStore} onCerrar={() => setCerrado(true)} />,
    destino,
  );
}
