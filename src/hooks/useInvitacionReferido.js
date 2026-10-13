import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  leerReferidoGuardado,
  EVENTO_REFERIDO,
  REFERRAL_STORAGE_KEY,
  VENTANA_REFERIDO_MS,
} from '../services/referrals';

/**
 * La invitación con la que llegó este navegador, mientras siga vigente:
 * { referralId, nombre (primer nombre o null), vence (Date) }. null si no hay,
 * si ya venció o si quien mira es el propio dueño del enlace.
 *
 * Se actualiza sola cuando ReferralTracker guarda el enlace o su nombre, cuando
 * el checkout lo olvida tras comprar y cuando otra pestaña lo cambia.
 */
export default function useInvitacionReferido() {
  const { userProfile } = useAuth();
  const [guardado, setGuardado] = useState(() => leerReferidoGuardado());

  useEffect(() => {
    const releer = () => setGuardado(leerReferidoGuardado());
    const porStorage = (e) => { if (e.key === REFERRAL_STORAGE_KEY) releer(); };
    window.addEventListener(EVENTO_REFERIDO, releer);
    window.addEventListener('storage', porStorage);
    return () => {
      window.removeEventListener(EVENTO_REFERIDO, releer);
      window.removeEventListener('storage', porStorage);
    };
  }, []);

  // Al vencer el plazo, el aviso se va solo.
  useEffect(() => {
    if (!guardado) return undefined;
    const resta = guardado.timestamp + VENTANA_REFERIDO_MS - Date.now();
    const id = setTimeout(() => setGuardado(leerReferidoGuardado()), Math.max(0, resta) + 1000);
    return () => clearTimeout(id);
  }, [guardado]);

  if (!guardado) return null;
  const miCodigo = (userProfile?.referralCode || '').toUpperCase();
  if (miCodigo && guardado.referrerCode === miCodigo) return null;
  return {
    referralId: guardado.referralId,
    nombre: guardado.nombre || null,
    vence: new Date(guardado.timestamp + VENTANA_REFERIDO_MS),
  };
}

/** "hoy 9:20 p. m." / "mañana 9:20 p. m." / "el jueves 16, 9:20 p. m." */
export function plazoLegible(fecha) {
  const hora = fecha.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const mismoDia = (a, b) => a.toDateString() === b.toDateString();
  if (mismoDia(fecha, hoy)) return `hoy ${hora}`;
  if (mismoDia(fecha, manana)) return `mañana ${hora}`;
  const dia = fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric' });
  return `el ${dia}, ${hora}`;
}
