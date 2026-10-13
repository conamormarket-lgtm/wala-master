import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  recordReferralClick,
  leerReferidoGuardado,
  guardarReferido,
} from '../../services/referrals';

const ReferralTracker = () => {
  const location = useLocation();
  const { userProfile, loading } = useAuth();
  const miCodigo = (userProfile?.referralCode || '').toUpperCase();

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
      }
    };

    trackReferral();
  }, [location.search, miCodigo, loading]);

  return null;
};

export default ReferralTracker;
