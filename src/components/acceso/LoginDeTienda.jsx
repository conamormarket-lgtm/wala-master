import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmail, signInWithGoogle } from '../../services/firebase/auth';
import { registrarConversionPopup } from '../../services/popups';
import { useAuth } from '../../contexts/AuthContext';
import { shouldPromptSurvey } from '../../utils/surveyHelper';
import { leerDestino, motivoDeRuta, tieneCuenta } from '../../utils/rutaPrivada';
import EsperaPantalla from '../carga/EsperaPantalla';
import { PaginaLogin } from '../../componentes/kit/paginas/Acceso';
import { cerroGoogle, conDestino, errorDeAuth } from './comun';

/*
 * Iniciar sesión (/login) con el kit. Lo mismo que LoginPage: correo (en
 * minúsculas) y contraseña o Google (si la cuenta de Google es nueva, cuenta
 * como la conversión del pop-up "Crear una cuenta"); cerrar la ventana de
 * Google no es un error. Al entrar, la redirección de siempre: perfil
 * completo → a donde iba (?redirect= o state.from), la encuesta o el inicio;
 * incompleto → completar perfil con el destino; sin poder leer el perfil,
 * se entra normal. Mientras tanto, la espera a pantalla completa de siempre.
 * Lo de antes: pages/LoginViejo.jsx (accesoViejo).
 */
export default function LoginDeTienda() {
  const navigate = useNavigate();
  const location = useLocation();
  const destino = leerDestino(location);
  const motivo = motivoDeRuta(destino);
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    if (loading || !tieneCuenta(user)) return;
    if (userProfile?._perfilNoCargado) {
      navigate(destino || '/', { replace: true });
      return;
    }
    if (userProfile?.dni && userProfile?.phone) {
      if (destino) navigate(destino, { replace: true });
      else if (shouldPromptSurvey(userProfile)) navigate('/encuesta-suscripcion', { replace: true });
      else navigate('/', { replace: true });
    } else {
      navigate('/completar-perfil', { replace: true, state: destino ? { from: destino } : undefined });
    }
  }, [user, userProfile, loading, navigate, destino]);

  const entrar = async ({ correo, contrasena }) => {
    const { error, errorCode } = await signInWithEmail(correo, contrasena);
    if (error) throw errorDeAuth(error, errorCode);
  };

  const conGoogle = async () => {
    const { error, errorCode, user: usuarioGoogle, esNuevo } = await signInWithGoogle();
    if (esNuevo && usuarioGoogle) {
      registrarConversionPopup('registro', { uid: usuarioGoogle.uid, email: usuarioGoogle.email });
    }
    if (error && !cerroGoogle(errorCode)) throw errorDeAuth(error, errorCode);
  };

  // Ya entró: mientras se lee el perfil y se decide a dónde ir.
  if (tieneCuenta(user)) {
    return <EsperaPantalla texto={loading ? 'Cargando tu perfil...' : 'Redirigiendo...'} />;
  }

  return (
    <PaginaLogin
      onEntrar={entrar}
      onGoogle={conGoogle}
      motivo={motivo}
      urlRegistro={conDestino('/registro', destino)}
      urlRecuperar="/recuperar-contrasena"
    />
  );
}
