import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  recordReferralClick,
  leerReferidoGuardado,
  guardarReferido,
  getNombreInvitacion,
} from '../../services/referrals';

// Completa el enlace guardado con el primer nombre de quien invitó, para que
// AvisoInvitacion muestre "María te invitó a Walá". Si no llega, el aviso sale
// sin nombre ("Llegaste con una invitación").
async function completarNombre(referralId) {
  const nombre = await getNombreInvitacion(referralId);
  const actual = leerReferidoGuardado();
  // null también se guarda: así no se vuelve a preguntar en cada carga.
  if (actual?.referralId === referralId) guardarReferido({ ...actual, nombre: nombre || null });
}

const ReferralTracker = () => {
  const location = useLocation();
  const { userProfile, loading } = useAuth();
  const miCodigo = (userProfile?.referralCode || '').toUpperCase();

  // Enlaces guardados antes de existir el aviso (o cuyo nombre no llegó):
  // se completa una vez al cargar.
  useEffect(() => {
    const guardado = leerReferidoGuardado();
    if (guardado && guardado.nombre === undefined) completarNombre(guardado.referralId);
  }, []);

  useEffect(() => {
    // Buscar en los query params "?ref=CODE"
    const searchParams = new URLSearchParams(location.search);
    const refCode = (searchParams.get('ref') || '').trim().toUpperCase();
    const shareId = searchParams.get('shareId');
    // Se espera a saber quién entra: sin eso, el dueño del enlace que lo abre
    // con la sesión todavía cargando lo registraba como un clic ajeno.
    if (!refCode || loading) return;

    // Quien abre SU PROPIO enlace (para probarlo o copiarlo) no lo "gasta": si
    // no, el enlace pasaba a "Entró al link" y la persona a la que se lo mandó
    // ya no podía usarlo.
    if (miCodigo && refCode === miCodigo) return;

    const trackReferral = async () => {
      // Mismo enlace ya registrado y vigente: no se escribe otra vez en cada
      // navegación. Un enlace DISTINTO (otro shareId, aunque sea del mismo
      // código) sí se registra: es el que esta persona acaba de recibir.
      const stored = leerReferidoGuardado();
      if (stored && stored.referrerCode === refCode && (!shareId || stored.referralId === shareId)) {
        return;
      }

      const { id, error } = await recordReferralClick(refCode, shareId);
      if (!error && id) {
        guardarReferido({
          referrerCode: refCode,
          referralId: id, // El docId de Firestore (etapa 2)
          timestamp: Date.now(),
        });
        completarNombre(id);
      }
    };

    trackReferral();
  }, [location.search, miCodigo, loading]);

  return null;
};

export default ReferralTracker;
