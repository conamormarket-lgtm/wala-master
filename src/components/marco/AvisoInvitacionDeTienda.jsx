import React, { lazy, Suspense, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useLoViejo from '../../hooks/useLoViejo';
import useInvitacionReferido, { plazoLegible } from '../../hooks/useInvitacionReferido';
import { BONO_BIENVENIDA_INVITACION } from '../../services/referrals';
import { tieneCuenta } from '../../utils/rutaPrivada';

// El aviso del kit baja solo si hay una invitación que mostrar: quien no
// llegó por un link no descarga nada más que este archivo.
const AvisoDelKit = lazy(() => import('../../componentes/kit/piezas/Campanas').then((m) => ({ default: m.AvisoInvitacion })));
// El de antes, solo con el interruptor campanasViejo.
const AvisoViejo = lazy(() => import('../common/AvisoInvitacion/AvisoInvitacion'));

const CERRADO_KEY = 'wala_aviso_invitacion_cerrado';
const leerCerrado = () => {
  try { return sessionStorage.getItem(CERRADO_KEY); } catch { return null; }
};

/*
 * El aviso de una invitación, sobre la cabecera (#app-top-banner-slot), con
 * AvisoInvitacion del kit (paso 6, CAMPANAS.md). Lo mismo que el de antes:
 *  - sale mientras el link guardado siga vigente (useInvitacionReferido)
 *  - 'nueva' (invitación sin cuenta: "Crear cuenta", salvo en el registro),
 *    'aceptada' (ya tiene el bono; su primera compra hasta …) o 'compra'
 *  - no sale en el checkout (ahí va la línea del resumen); cerrarlo dura la
 *    sesión (wala_aviso_invitacion_cerrado)
 * Diferente: no sale en /invitar/ (ahí está la página de la invitación) y la
 * sesión anónima no cuenta como cuenta.
 * Lo de antes: components/common/AvisoInvitacion (interruptor campanasViejo).
 */
export default function AvisoInvitacionDeTienda() {
  const campanasViejo = useLoViejo('campanas');
  const invitacion = useInvitacionReferido();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [cerrado, setCerrado] = useState(leerCerrado);
  const [destino, setDestino] = useState(null);

  // Mismo hueco que el aviso de la app, antes de la cabecera.
  useLayoutEffect(() => {
    setDestino(document.getElementById('app-top-banner-slot'));
  }, []);

  if (campanasViejo) return <Suspense fallback={null}><AvisoViejo /></Suspense>;
  if (!invitacion || !destino || pathname.startsWith('/checkout') || pathname.startsWith('/invitar/')) return null;
  if (cerrado === invitacion.referralId) return null;

  const cerrar = () => {
    try { sessionStorage.setItem(CERRADO_KEY, invitacion.referralId); } catch { /* modo privado */ }
    setCerrado(invitacion.referralId);
  };
  const { tipo, invitacion: decision } = invitacion;
  let estado = 'compra';
  if (tipo === 'invitacion' && decision === 'aceptada') estado = 'aceptada';
  else if (tipo === 'invitacion' && !decision && !tieneCuenta(user)) estado = 'nueva';

  return createPortal(
    <Suspense fallback={null}>
      <AvisoDelKit
        nombre={invitacion.nombre}
        estado={estado}
        plazo={estado === 'nueva' ? undefined : `hasta ${plazoLegible(invitacion.vence)}`}
        bono={BONO_BIENVENIDA_INVITACION}
        urlRegistro={pathname === '/registro' ? null : '/registro'}
        onCerrar={cerrar}
      />
    </Suspense>,
    destino,
  );
}
