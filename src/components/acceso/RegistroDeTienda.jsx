import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signUpWithEmail, signInWithGoogle, enviarVerificacionCorreo } from '../../services/firebase/auth';
import { registrarConversionPopup } from '../../services/popups';
import { useAuth } from '../../contexts/AuthContext';
import { shouldPromptSurvey } from '../../utils/surveyHelper';
import { detectCountry } from '../../services/geo';
import { leerDestino, tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaRegistro } from '../../componentes/kit/paginas/AccesoDatos';
import { PAISES, camposDelPedido, cerroGoogle, conDestino, errorDeAuth } from './comun';

/*
 * Crear cuenta (/registro) con el kit. Lo mismo que RegisterPage:
 *  - paso 1: signUpWithEmail (correo en minúsculas), el correo de
 *    verificación sin esperar y la conversión del pop-up "Crear una cuenta"
 *  - Google: la conversión si la cuenta es nueva y a completar el perfil (con
 *    el destino); cerrar la ventana no es un error
 *  - paso 2 (también si ya hay sesión sin datos): el documento se revisa en
 *    el servidor (checkDniAvailableSecure) y se guarda el perfil con
 *    accountOrigin 'register_form' (con updateUserProfile: la misma escritura,
 *    y la sesión queda al día); después, a donde iba o a la encuesta
 *  - con el perfil completo, a donde iba, la encuesta o el inicio; si no se
 *    pudo leer, se entra normal
 *  - el país, el detectado por IP (si falla, el Perú)
 * Lo de antes: pages/RegisterViejo.jsx (accesoViejo).
 */
export default function RegistroDeTienda() {
  const navigate = useNavigate();
  const location = useLocation();
  const destino = leerDestino(location);
  const { user, userProfile, loading, updateUserProfile } = useAuth();
  const [paisDetectado, setPaisDetectado] = useState(undefined);
  // Mientras se guardan los datos del paso 2 no se redirige por el perfil completo.
  const [registrando, setRegistrando] = useState(false);

  useEffect(() => {
    let activo = true;
    detectCountry()
      .then((r) => { if (activo && r?.code) setPaisDetectado(r.code); })
      .catch(() => { if (activo) setPaisDetectado('PE'); });
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (loading || registrando || !tieneCuenta(user)) return;
    if (userProfile?._perfilNoCargado) {
      navigate(destino || '/', { replace: true });
      return;
    }
    if (userProfile?.dni && userProfile?.phone) {
      if (destino) navigate(destino, { replace: true });
      else if (shouldPromptSurvey(userProfile)) navigate('/encuesta-suscripcion', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [user, userProfile, loading, registrando, navigate, destino]);

  const crearCuenta = async ({ correo, contrasena }) => {
    const { error, errorCode } = await signUpWithEmail(correo, contrasena);
    if (error) throw errorDeAuth(error, errorCode);
    // Con el correo verificado, los pedidos hechos con él aparecen solos en Mis pedidos.
    enviarVerificacionCorreo().catch(() => {});
    registrarConversionPopup('registro', { email: correo });
  };

  const conGoogle = async () => {
    const { error, errorCode, user: usuarioGoogle, esNuevo } = await signInWithGoogle();
    if (esNuevo && usuarioGoogle) {
      registrarConversionPopup('registro', { uid: usuarioGoogle.uid, email: usuarioGoogle.email });
    }
    if (error && !cerroGoogle(errorCode)) throw errorDeAuth(error, errorCode);
    if (errorCode === 'auth/cancelled' || !usuarioGoogle) return;
    navigate('/completar-perfil', destino ? { state: { from: destino } } : undefined);
  };

  const registrar = async (datos) => {
    if (!user) throw new Error('No encontramos tu cuenta. Refresca la página e inténtalo de nuevo.');
    const campos = camposDelPedido(datos);
    let libre;
    try {
      const { data } = await httpsCallable(getFunctions(), 'checkDniAvailableSecure')({ dni: campos.dni });
      libre = Boolean(data?.available);
    } catch (err) {
      console.warn('[Registro] checkDniAvailableSecure:', err);
      throw new Error('No se pudo verificar el documento. Revisa tu conexión e inténtalo de nuevo.');
    }
    if (!libre) throw new Error('Este documento ya está registrado en otra cuenta. Si es tuyo, inicia sesión con esa cuenta o recupera tu contraseña.');
    setRegistrando(true);
    // La misma escritura de antes (setDocument en portal_clientes_users), pero
    // por el contexto: así la sesión ve el perfil completo al tiro. Antes, si
    // venía de una página de la cuenta, el marco de la cuenta lo mandaba a
    // completar el perfil con todo vacío.
    const { error } = await updateUserProfile({
      email: user.email,
      ...campos,
      accessSystem: 'portal_clientes',
      accountOrigin: 'register_form',
    });
    if (error) {
      setRegistrando(false);
      console.warn('[Registro] guardar perfil:', error);
      throw new Error('No se pudieron guardar tus datos. Revisa tu conexión e inténtalo de nuevo.');
    }
    navigate(destino || '/encuesta-suscripcion');
  };

  // Como antes, el formulario sale al tiro; si la sesión llega después sin
  // datos, la página pasa sola al paso 2.
  const conSesion = tieneCuenta(user);
  return (
    <PaginaRegistro
      paso={conSesion ? 2 : 1}
      correo={conSesion ? user.email : undefined}
      datosIniciales={paisDetectado ? { pais: paisDetectado } : {}}
      paises={PAISES}
      onCrearCuenta={crearCuenta}
      onGoogle={conGoogle}
      onRegistrar={registrar}
      urlLogin={conDestino('/login', destino)}
    />
  );
}
