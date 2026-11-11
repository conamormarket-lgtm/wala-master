import React, { lazy, Suspense, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import usePrimeraCompra from '../../hooks/usePrimeraCompra';

// La pieza del kit baja solo si la cuenta está en su semana de bienvenida.
const BannerBienvenida = lazy(() => import('../../componentes/kit/piezas/Bienvenida').then((m) => ({ default: m.BannerBienvenida })));

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
 */
export default function BienvenidaDeTienda() {
  const { bienvenida } = usePrimeraCompra();
  const { pathname } = useLocation();
  const [cerrado, setCerrado] = useState(leerCerrado);
  const [destino, setDestino] = useState(null);

  useLayoutEffect(() => {
    setDestino(document.getElementById('app-top-banner-slot'));
  }, []);

  const fase = bienvenida?.fase;
  if (!destino || cerrado || !fase || fase.estado !== 'activa') return null;
  if (['/checkout', '/cuenta/referidos', '/admin', '/bienvenida'].some((r) => pathname.startsWith(r))) return null;

  const cerrar = () => {
    try { sessionStorage.setItem(CERRADO_KEY, '1'); } catch { /* modo privado */ }
    setCerrado(true);
  };
  const promo = bienvenida.promo || {};
  return createPortal(
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
  );
}
