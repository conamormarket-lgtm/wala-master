import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  leerReferidoGuardado,
  EVENTO_REFERIDO,
  REFERRAL_STORAGE_KEY,
  venceReferido,
} from '../services/referrals';

/**
 * La invitación con la que llegó este navegador, mientras siga vigente:
 * { referralId, nombre (primer nombre o null), vence (Date), tipo
 * ('producto' | 'invitacion'), invitacion ('aceptada' | 'no_aplica' |
 * undefined mientras no se decide) }. null si no hay,
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
    // setTimeout no acepta más de ~24 días: si falta más, se revisa entonces.
    const resta = Math.min(venceReferido(guardado) - Date.now(), 2 ** 31 - 5000);
    const id = setTimeout(() => setGuardado(leerReferidoGuardado()), Math.max(0, resta) + 1000);
    return () => clearTimeout(id);
  }, [guardado]);

  if (!guardado) return null;
  const miCodigo = (userProfile?.referralCode || '').toUpperCase();
  if (miCodigo && guardado.referrerCode === miCodigo) return null;
  return {
    referralId: guardado.referralId,
    nombre: guardado.nombre || null,
    vence: new Date(venceReferido(guardado)),
    tipo: guardado.tipo || 'producto',
    invitacion: guardado.invitacion,
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
  // A más de una semana (invitación: 30 días) la hora sobra.
  if (fecha - hoy > 6 * 24 * 60 * 60 * 1000) {
    return `el ${fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}`;
  }
  const dia = fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric' });
  return `el ${dia}, ${hora}`;
}
