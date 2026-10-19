import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { shouldPromptSurvey } from '../../utils/surveyHelper';
import { detectCountry } from '../../services/geo';
import { esperarCumpleGoogle } from '../../services/firebase/auth';
import { leerDestino, tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaCompletarPerfil } from '../../componentes/kit/paginas/AccesoDatos';
import { PAISES, camposDelPedido } from './comun';

/*
 * Completar el perfil (/completar-perfil) con el kit. Lo mismo que
 * CompleteProfilePage:
 *  - sin cuenta, al login; con el perfil completo, a donde iba, la encuesta
 *    o el inicio; si el perfil no se pudo leer, se espera (no se muestra vacío)
 *  - lo que ya respondió a medias viene puesto (nombre, país, documento, tipo,
 *    teléfono y cumpleaños); el país, si no está, el detectado por IP; el
 *    cumpleaños de Google llega tarde y no pisa lo escrito
 *  - antes de guardar, el documento se revisa en el servidor
 *    (checkDniAvailableSecure); se guardan los mismos campos, con email,
 *    accessSystem y accountOrigin, y el cumpleaños solo si hay fecha
 * Lo de antes: pages/CompleteProfileViejo.jsx (accesoViejo).
 */
export default function CompletarPerfilDeTienda() {
  const navigate = useNavigate();
  const location = useLocation();
  const volverA = leerDestino(location);
  const { user, userProfile, loading, updateUserProfile } = useAuth();
  const [paisDetectado, setPaisDetectado] = useState(null);
  const [cumpleGoogle, setCumpleGoogle] = useState(null);

  const completo = Boolean(userProfile?.dni && userProfile?.phone);
  const seguir = () => {
    if (volverA) navigate(volverA, { replace: true });
    else if (shouldPromptSurvey(userProfile)) navigate('/encuesta-suscripcion');
    else navigate('/');
  };

  // Detección de país por IP; si falla, el Perú (como antes).
  useEffect(() => {
    let activo = true;
    detectCountry()
      .then((r) => { if (activo) setPaisDetectado(r?.code || 'PE'); })
      .catch(() => { if (activo) setPaisDetectado('PE'); });
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!tieneCuenta(user)) { navigate('/login', { replace: true }); return; }
    if (userProfile && !userProfile._perfilNoCargado && completo) seguir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile, loading, completo]);

  // El cumpleaños de Google: el login lo pide sin esperar, así que llega después.
  const tieneCumplePerfil = Boolean(userProfile?.birthDate);
  useEffect(() => {
    if (!user || tieneCumplePerfil) return undefined;
    let activo = true;
    esperarCumpleGoogle().then((fecha) => {
      if (!activo || !fecha) return;
      setCumpleGoogle(fecha);
      try { localStorage.removeItem('wala_google_birthday'); } catch { /* opcional */ }
    });
    return () => { activo = false; };
  }, [user, tieneCumplePerfil]);

  const guardar = async (datos) => {
    const campos = camposDelPedido(datos);
    // El documento repetido se revisa en el servidor: las reglas no dejan buscar por dni.
    let libre;
    try {
      const { data } = await httpsCallable(getFunctions(), 'checkDniAvailableSecure')({ dni: campos.dni });
      libre = Boolean(data?.available);
    } catch (err) {
      console.warn('[Completar perfil] checkDniAvailableSecure:', err);
      throw new Error('No se pudo verificar el documento. Revisa tu conexión e inténtalo de nuevo.');
    }
    if (!libre) throw new Error('Este documento ya está registrado en otra cuenta. Si es tuyo, inicia sesión con esa cuenta o escríbenos y te ayudamos.');
    const cambios = {
      ...campos,
      email: user.email,
      accessSystem: 'portal_clientes',
      accountOrigin: userProfile?.accountOrigin || 'google_auth',
    };
    // Opcional: solo si hay fecha, para no borrar una guardada.
    if (datos.cumpleanos) cambios.birthDate = datos.cumpleanos;
    const { error } = await updateUserProfile(cambios);
    if (error) {
      console.warn('[Completar perfil] guardar perfil:', error);
      throw new Error('No se pudieron guardar tus datos. Revisa tu conexión e inténtalo de nuevo.');
    }
    seguir();
  };

  const esperando = loading || !user || !userProfile || userProfile._perfilNoCargado;
  if (!esperando && completo) return null;

  const tipoGuardado = userProfile?.tipoDocumento || userProfile?.docType;
  const inicial = esperando ? {} : {
    nombre: userProfile.displayName || user.displayName || '',
    pais: userProfile.country || paisDetectado || undefined,
    tipoDocumento: tipoGuardado && tipoGuardado !== 'OTRO' ? tipoGuardado : undefined,
    documento: String(userProfile.dni || userProfile.clienteNumeroDocumento || '') || undefined,
    telefono: String(userProfile.phoneIntl?.localNumber || userProfile.phone || '') || undefined,
    cumpleanos: userProfile.birthDate || cumpleGoogle || undefined,
  };

  return (
    <PaginaCompletarPerfil
      cargando={esperando}
      correo={user?.email}
      inicial={inicial}
      deGoogle={{ nombre: user?.displayName || undefined, cumpleanos: tieneCumplePerfil ? undefined : cumpleGoogle || undefined }}
      paises={PAISES}
      onGuardar={guardar}
    />
  );
}
