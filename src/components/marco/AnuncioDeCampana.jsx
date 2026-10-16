import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import {
  getPopups,
  leerEstadoLocal,
  registrarMostrado,
  trackCierre,
  trackClic,
  trackVista,
  yaHuboPopupEnSesion,
} from '../../services/popups';
import { elegirPopup } from '../../services/popupsLogic.mjs';
import { VentanaCampana } from '../../componentes/kit/piezas/Marco';
import { campanaDesdePopup } from '../../componentes/kit/adaptadores';

const RUTA_ENCUESTA = '/encuesta-suscripcion';

const esMovil = () =>
  Boolean(window.Capacitor?.isNativePlatform?.())
  || Boolean(window.matchMedia?.('(max-width: 768px)').matches);

// Si todavía le toca el aviso de idioma, no se le encima otro en la misma visita.
const avisoIdiomaPendiente = () => {
  try {
    const base = String(navigator.language || '').toLowerCase().split('-')[0];
    return base !== '' && base !== 'es' && !window.localStorage.getItem('wala_lang');
  } catch {
    return false;
  }
};

// La imagen se precarga antes de abrir, para que no salga vacía y salte.
const precargarImagen = (url) => new Promise((resolve) => {
  if (!url) return resolve();
  const img = new Image();
  img.onload = resolve;
  img.onerror = resolve;
  img.src = url;
});

const porcentajeScroll = () => {
  const doc = document.documentElement;
  const recorrible = doc.scrollHeight - window.innerHeight;
  if (recorrible <= 0) return 0;
  return (window.scrollY / recorrible) * 100;
};

/*
 * Anuncio de campaña (M11) con el kit: como mucho UNO por sesión. Todo igual
 * que CampaignPopup: los popups de /admin/popups (storeConfig/popups), las
 * reglas de services/popupsLogic.mjs, el disparador (tiempo desde que entró,
 * scroll o intención de salida; en el celular la salida pasa a tiempo), nada
 * en modo edición ni con el aviso de idioma pendiente, y las métricas (vista,
 * clic, cierre). Dibuja VentanaCampana.
 */
export default function AnuncioDeCampana() {
  const { user, userProfile, loading } = useAuth();
  const { isEditModeActive } = useVisualEditor();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // El popup se guarda aparte de "abierto" para que la ventana pueda irse con
  // su animación (sin datos, cambiaría de formato al cerrar).
  const [popup, setPopup] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const inicioRef = useRef(Date.now());

  const usuario = {
    uid: user?.uid || null,
    email: user?.email || userProfile?.email || null,
    displayName: userProfile?.displayName || user?.displayName || null,
  };
  const usuarioRef = useRef(usuario);
  usuarioRef.current = usuario;

  const { data: popups } = useQuery({
    queryKey: ['popups-config'],
    queryFn: async () => {
      const { data, error } = await getPopups();
      // Si no se pudo leer, mejor nada que algo que el admin quizá apagó.
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!popups?.length || abierto || loading || isEditModeActive) return undefined;
    if (yaHuboPopupEnSesion() || avisoIdiomaPendiente()) return undefined;

    const contexto = () => ({
      pathname,
      ahora: Date.now(),
      esMovil: esMovil(),
      logueado: Boolean(user),
      perfil: userProfile,
      estadoLocal: leerEstadoLocal(),
    });

    const candidato = elegirPopup(popups, contexto());
    if (!candidato) return undefined;

    let cancelado = false;
    const imagenLista = precargarImagen(candidato.imagenUrl);

    const disparar = async () => {
      await imagenLista;
      if (cancelado || yaHuboPopupEnSesion()) return;
      const p = elegirPopup(popups, contexto());
      if (!p || p.id !== candidato.id) return;
      registrarMostrado(p);
      trackVista(p, usuarioRef.current);
      setPopup(p);
      setAbierto(true);
    };

    let disparador = candidato.disparador;
    if (disparador === 'salida' && esMovil()) disparador = 'tiempo';

    if (disparador === 'scroll') {
      const alScroll = () => {
        if (porcentajeScroll() >= candidato.scrollPct) disparar();
      };
      window.addEventListener('scroll', alScroll, { passive: true });
      return () => {
        cancelado = true;
        window.removeEventListener('scroll', alScroll);
      };
    }

    if (disparador === 'salida') {
      const alSalir = (e) => {
        if (!e.relatedTarget && e.clientY <= 0) disparar();
      };
      document.addEventListener('mouseout', alSalir);
      return () => {
        cancelado = true;
        document.removeEventListener('mouseout', alSalir);
      };
    }

    // Los segundos cuentan desde que entró al sitio, no desde cada página.
    const espera = Math.max(0, candidato.segundos * 1000 - (Date.now() - inicioRef.current));
    const t = setTimeout(disparar, espera);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [popups, pathname, user, userProfile, loading, isEditModeActive, abierto]);

  const cerrar = useCallback(() => {
    if (abierto && popup) trackCierre(popup, usuarioRef.current);
    setAbierto(false);
  }, [abierto, popup]);

  const alTocar = useCallback(() => {
    if (!abierto || !popup) return;
    trackClic(popup, usuarioRef.current);
    setAbierto(false);

    if (popup.objetivo === 'encuesta') {
      // Sin sesión no se guarda la encuesta: primero el login y de vuelta.
      if (user) navigate(RUTA_ENCUESTA);
      else navigate('/login', { state: { from: RUTA_ENCUESTA } });
      return;
    }
    // Crear cuenta: el registro cuenta la conversión (registrarConversionPopup).
    if (popup.objetivo === 'registro') {
      navigate('/registro');
      return;
    }
    const url = String(popup.botonUrl || '').trim();
    if (!url) return;
    if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
    else navigate(url.startsWith('/') ? url : `/${url}`);
  }, [abierto, popup, navigate, user]);

  if (!popup) return null;
  return <VentanaCampana abierta={abierto} onCerrar={cerrar} onAccion={alTocar} {...campanaDesdePopup(popup)} />;
}
