import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import {
  registrarVisita,
  aceptarInvitacion,
  leerReferidoGuardado,
  guardarReferido,
  getNombreInvitacion,
} from '../../services/referrals';

// Completa el link guardado con el primer nombre de quien invitó, para que
// AvisoInvitacion muestre "María te invitó a Walá". Si no llega, el aviso sale
// sin nombre ("Llegaste con una invitación").
async function completarNombre(referralId) {
  const nombre = await getNombreInvitacion(referralId);
  const actual = leerReferidoGuardado();
  // null también se guarda: así no se vuelve a preguntar en cada carga.
  if (actual?.referralId === referralId) guardarReferido({ ...actual, nombre: nombre || null });
}

/**
 * Links de referido:
 *  - ?ref=CODIGO en cualquier página (en /producto/:id es el link de ese
 *    producto). &tipo=invitacion = link de invitación (lo arma /invitar/:codigo).
 *    &shareId= son los links generados con el sistema anterior.
 *  - Cada persona que abre un link queda registrada aparte en el servidor, con
 *    sus propias 36 h. Este navegador guarda SU registro para el checkout.
 *  - Si llegó con una invitación y ya tiene cuenta con DNI y teléfono, se pide
 *    aceptarla: si es cuenta nueva recibe el bono de bienvenida.
 */
const ReferralTracker = () => {
  const location = useLocation();
  const { user, userProfile, loading } = useAuth();
  const toast = useGlobalToast();
  const miCodigo = (userProfile?.referralCode || '').toUpperCase();
  const aceptando = useRef(false);
  const ultimoIntento = useRef(0);

  // Links guardados antes de existir el aviso (o cuyo nombre no llegó): se
  // completa una vez al cargar.
  useEffect(() => {
    const guardado = leerReferidoGuardado();
    if (guardado && guardado.nombre === undefined) completarNombre(guardado.referralId);
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const code = (searchParams.get('ref') || '').trim().toUpperCase();
    // Se espera a saber quién entra: el dueño que abre su propio link no lo cuenta.
    if (!code || loading) return;
    if (miCodigo && code === miCodigo) return;

    const tipo = searchParams.get('tipo') === 'invitacion' ? 'invitacion' : 'producto';
    const shareId = searchParams.get('shareId') || null;
    const enProducto = location.pathname.match(/^\/producto\/([^/?#]+)/);
    const productId = tipo === 'producto' && enProducto ? decodeURIComponent(enProducto[1]) : null;

    // El mismo link ya registrado y vigente: no se registra otra vez en cada
    // navegación. Uno distinto (otro producto, otro código) sí: es el último
    // que abrió, y es el que vale para su compra.
    const guardado = leerReferidoGuardado();
    if (guardado && guardado.referrerCode === code && (guardado.tipo || 'producto') === tipo &&
        (guardado.productId || null) === productId && (guardado.shareId || null) === shareId) {
      return;
    }

    (async () => {
      const { id, nombre } = await registrarVisita({ code, tipo, productId, shareId });
      if (!id) return;
      guardarReferido({
        referrerCode: code,
        referralId: id, // su registro en `referrals`
        timestamp: Date.now(),
        tipo,
        ...(productId && { productId }),
        ...(shareId && { shareId }),
        nombre: nombre || null,
      });
    })();
  }, [location.search, location.pathname, miCodigo, loading]);

  // Invitación: en cuanto hay cuenta (no la sesión anónima de las landings).
  // El servidor decide: si el perfil todavía no tiene DNI y teléfono responde
  // "pendiente" y se vuelve a intentar al navegar (el registro guarda el perfil
  // directo en la base, sin pasar por este contexto). Como mucho cada 5 s.
  const conCuenta = !!(user && !user.isAnonymous);
  useEffect(() => {
    if (!conCuenta || loading || aceptando.current) return;
    if (Date.now() - ultimoIntento.current < 5000) return;
    const guardado = leerReferidoGuardado();
    if (!guardado || guardado.tipo !== 'invitacion' || guardado.invitacion) return;
    if (miCodigo && guardado.referrerCode === miCodigo) return;
    aceptando.current = true;
    ultimoIntento.current = Date.now();
    aceptarInvitacion(guardado.referralId)
      .then((res) => {
        const actual = leerReferidoGuardado();
        if (res?.pendiente || actual?.referralId !== guardado.referralId) return;
        if (res?.aceptada) {
          guardarReferido({ ...actual, invitacion: 'aceptada', aceptadaMs: Date.now() });
          if (res.bono) {
            const quien = res.nombre || actual.nombre;
            toast.success(quien
              ? `¡${quien} te regaló ${res.bono} monedas de bienvenida!`
              : `¡Recibiste ${res.bono} monedas de bienvenida!`);
          }
        } else {
          // No es cuenta nueva: el link sigue valiendo como uno de compra (36 h).
          guardarReferido({ ...actual, invitacion: 'no_aplica' });
        }
      })
      .catch(() => { /* sin red: se reintenta en la próxima carga */ })
      .finally(() => { aceptando.current = false; });
  }, [conCuenta, loading, location.pathname, user?.uid, userProfile?.dni, userProfile?.phone, miCodigo, toast]);

  return null;
};

export default ReferralTracker;
