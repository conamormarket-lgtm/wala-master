import React, { useEffect, useMemo } from 'react';
import { PaginaDescargarApp } from '../../componentes/kit/paginas/Generales';
import { plataformaDesdeNavegador } from '../../componentes/kit/adaptadoresGenerales';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.wala.tienda';

/*
 * Descargar la app (/descargar y /app, GENERALES.md P23): PaginaDescargarApp.
 * La app es solo para Android:
 *  - en Android, como antes: abre la Play Store del teléfono (market://) y,
 *    al segundo, la de la web; la página deja el botón por si no se abrió
 *  - en un iPhone o la computadora ya no manda a la Play Store (no sirve
 *    ahí): dice que la app es para Android y deja seguir en la web
 */
export default function DescargarAppDeTienda() {
  const plataforma = useMemo(() => plataformaDesdeNavegador(
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
    typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
  ), []);

  useEffect(() => {
    if (plataforma !== 'android') return undefined;
    window.location.href = 'market://details?id=com.wala.tienda';
    const respaldo = setTimeout(() => window.location.replace(PLAY_STORE), 1000);
    return () => clearTimeout(respaldo);
  }, [plataforma]);

  return <PaginaDescargarApp plataforma={plataforma} urlPlayStore={PLAY_STORE} />;
}
