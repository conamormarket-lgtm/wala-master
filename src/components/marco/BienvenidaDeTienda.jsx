import React, { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import usePrimeraCompra from '../../hooks/usePrimeraCompra';

// La pieza del kit baja solo si la cuenta está en su semana de bienvenida.
const BannerBienvenida = lazy(() => import('../../componentes/kit/piezas/Bienvenida').then((m) => ({ default: m.BannerBienvenida })));
const PopupBienvenida = lazy(() => import('../../componentes/kit/piezas/Bienvenida').then((m) => ({ default: m.PopupBienvenida })));

// El aviso grande sale al entrar y vuelve a salir pasado este tiempo
// (pedido el 2026-11-11: "que sea un popup y aparezca cada cierto tiempo").
const POPUP_CADA_MS = 4 * 60 * 60 * 1000;
const POPUP_KEY = 'wala_bienvenida_popup_visto';
const popupToca = () => {
  try { return Date.now() - Number(localStorage.getItem(POPUP_KEY) || 0) > POPUP_CADA_MS; } catch { return true; }
};
const marcarPopup = () => {
  try { localStorage.setItem(POPUP_KEY, String(Date.now())); } catch { /* modo privado */ }
};

const CERRADO_KEY = 'wala_bienvenida_cerrada';
const leerCerrado = () => {
  try { return sessionStorage.getItem(CERRADO_KEY) === '1'; } catch { return false; }
};

/*
 * La franja de la semana de bienvenida (promo "Tu primera compra puede salir
 * gratis"), sobre la cabecera (#app-top-banner-slot), como el aviso de una
 * invitación. Sale mientras la cuenta está en su fase: el tiempo que queda, el
 * saldo y "Invitar amigos" o "Usar mi saldo". No sale en el checkout (ahí va
 * la fila del saldo), en Mi cuenta → Referidos (ahí va la tarjeta) ni en el
 * admin. Cerrarla dura la sesión.
 * Además, el aviso grande (PopupBienvenida): al entrar y cada 4 horas, y no se
 * puede cerrar en los primeros 5 segundos.
 */
export default function BienvenidaDeTienda() {
  const { bienvenida } = usePrimeraCompra();
  const { pathname } = useLocation();
  const [cerrado, setCerrado] = useState(leerCerrado);
  const [destino, setDestino] = useState(null);
  const [popup, setPopup] = useState(false);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    setDestino(document.getElementById('app-top-banner-slot'));
  }, []);

  const fase = bienvenida?.fase;
  const activa = fase?.estado === 'activa';
  const fuera = ['/checkout', '/cuenta/referidos', '/admin', '/bienvenida', '/login', '/registro'].some((r) => pathname.startsWith(r));
  // El aviso grande: al entrar y cada 4 horas (se anota al abrirse).
  useEffect(() => {
    if (!activa || fuera || popup || !popupToca()) return;
    marcarPopup();
    setPopup(true);
  }, [activa, fuera]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activa || fuera) return null;
  const promo = bienvenida.promo || {};
  const aviso = (
    <Suspense fallback={null}>
      <PopupBienvenida
        abierta={popup}
        onCerrar={() => setPopup(false)}
        venceMs={fase.venceMs}
        saldo={bienvenida.saldo}
        pendiente={bienvenida.pendiente}
        premio={promo.premio}
        minimo={promo.minimoNeto}
        onInvitar={() => { setPopup(false); navigate('/cuenta/referidos'); }}
      />
    </Suspense>
  );
  if (!destino || cerrado) return aviso;

  const cerrar = () => {
    try { sessionStorage.setItem(CERRADO_KEY, '1'); } catch { /* modo privado */ }
    setCerrado(true);
  };
  return (
    <>
      {createPortal(
        <Suspense fallback={null}>
          <div style={{ padding: '0.5rem 0.75rem 0', maxWidth: 1200, margin: '0 auto' }}>
        <BannerBienvenida
          compacta
          venceMs={fase.venceMs}
          saldo={bienvenida.saldo}
          pendiente={bienvenida.pendiente}
          premio={promo.premio}
          minimo={promo.minimoNeto}
          onCerrar={cerrar}
        />
      </div>
        </Suspense>,
        destino,
      )}
      {aviso}
    </>
  );
}
