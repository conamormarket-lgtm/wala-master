import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordReferralClick } from '../../services/referrals';

const REFERRAL_KEY = 'wala_referral';
const EXPIRATION_MS = 36 * 60 * 60 * 1000; // 36 horas en ms

const ReferralTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Buscar en los query params "?ref=CODE"
    const searchParams = new URLSearchParams(location.search);
    const refCode = searchParams.get('ref');
    const shareId = searchParams.get('shareId');

    if (refCode) {
      // Registrar de inmediato
      const trackReferral = async () => {
        // Chequear si ya hay un referido guardado y si es válido, para no grabar doble click innecesario.
        // Pero si es un codigo nuevo diferente al anterior, sí lo grabamos.
        let stored = null;
        try {
          const raw = localStorage.getItem(REFERRAL_KEY);
          if (raw) stored = JSON.parse(raw);
        } catch(e) {}

        const now = Date.now();
        const isValidStored = stored && (now - stored.timestamp < EXPIRATION_MS);

        if (isValidStored && stored.referrerCode === refCode.toUpperCase()) {
          // Ya lo tenemos guardado, no spammeamos a Firebase en cada navegación
          return;
        }

        // Registrar click en FB
        const { id, error } = await recordReferralClick(refCode, shareId);
        
        if (!error && id) {
          // Guardar en LocalStorage
          const referralData = {
            referrerCode: refCode.toUpperCase(),
            referralId: id, // El docId de Firestore (etapa 2)
            timestamp: now
          };
          localStorage.setItem(REFERRAL_KEY, JSON.stringify(referralData));
        }
      };

      trackReferral();
    }
  }, [location.search]);

  return null;
};

export default ReferralTracker;
