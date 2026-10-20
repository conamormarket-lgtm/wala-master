import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { trackPageNotFound } from '../../services/analytics/enlacesRotos';
import { PaginaNoEncontrada } from '../../componentes/kit/paginas/Generales';

/*
 * Una dirección que no existe (GENERALES.md P22): PaginaNoEncontrada. Antes
 * la tienda mandaba al inicio sin avisar (una landing que no existe) o a Mi
 * cuenta (lo demás). Ahora:
 *  - se ve con la cabecera y el pie (la landing los había ocultado mientras
 *    buscaba); Kapi ya está en la tarjeta: ni el pie ni el de la esquina lo
 *    repiten
 *  - el buscador lleva a /buscar?q=…
 *  - queda en la analítica (page_not_found, con de dónde venía): así se ven
 *    los enlaces rotos de un anuncio, un QR o una landing borrada
 *  - los buscadores no la guardan (robots: noindex mientras se ve)
 */
// La última registrada: el mismo enlace roto no se cuenta dos veces seguidas
// (al volver a montar la página, o en desarrollo con StrictMode).
let ultima = { ruta: '', en: 0 };

export default function NoEncontradaDeTienda() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const layout = useLayoutContext();
  const { setHeaderVisible, setFooterVisible, setPieSinKapi, setKapiFlotanteOculto } = layout || {};

  useEffect(() => {
    setHeaderVisible?.(true);
    setFooterVisible?.(true);
    setPieSinKapi?.(true);
    setKapiFlotanteOculto?.(true);
    return () => {
      setPieSinKapi?.(false);
      setKapiFlotanteOculto?.(false);
    };
  }, [setHeaderVisible, setFooterVisible, setPieSinKapi, setKapiFlotanteOculto]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  // Una vez por dirección (la sesión que llega después no la repite).
  useEffect(() => {
    const ruta = pathname + search;
    if (ultima.ruta === ruta && Date.now() - ultima.en < 2000) return;
    ultima = { ruta, en: Date.now() };
    // Al recargar, el referrer es la misma página: no dice de dónde vino.
    const desde = document.referrer && document.referrer !== window.location.href ? document.referrer : '';
    try {
      trackPageNotFound(ruta, desde, user || {}).catch(() => {});
    } catch { /* sin analítica */ }
  }, [pathname, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PaginaNoEncontrada
      ruta={pathname}
      onBuscar={(texto) => navigate(texto ? `/buscar?q=${encodeURIComponent(texto)}` : '/buscar')}
    />
  );
}
