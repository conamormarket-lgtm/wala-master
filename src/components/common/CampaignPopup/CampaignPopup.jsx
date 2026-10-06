// ──────────────────────────────────────────────────────────────────────────────
// CampaignPopup — muestra, como mucho, UN popup de campaña por sesión.
//
// Los popups se configuran en /admin/popups (doc storeConfig/popups). Las reglas
// de a quién/cuándo están en services/popupsLogic.mjs; aquí solo se espera el
// disparador (tiempo, scroll o intención de salida) y se registran las métricas.
// ──────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { useVisualEditor } from '../../../pages/Tienda/contexts/VisualEditorContext';
import {
  getPopups,
  leerEstadoLocal,
  registrarMostrado,
  trackCierre,
  trackClic,
  trackVista,
  yaHuboPopupEnSesion,
} from '../../../services/popups';
import { elegirPopup } from '../../../services/popupsLogic.mjs';
import PopupCard from './PopupCard';

const RUTA_ENCUESTA = '/encuesta-suscripcion';

const esMovil = () =>
  Boolean(window.Capacitor?.isNativePlatform?.())
  || Boolean(window.matchMedia?.('(max-width: 768px)').matches);

// Si al visitante todavía le toca el aviso de idioma (LanguagePopup), no le
// encimamos otro popup en la misma visita.
const avisoIdiomaPendiente = () => {
  try {
    const base = String(navigator.language || '').toLowerCase().split('-')[0];
    return base !== '' && base !== 'es' && !window.localStorage.getItem('wala_lang');
  } catch {
    return false;
  }
};

const porcentajeScroll = () => {
  const doc = document.documentElement;
  const recorrible = doc.scrollHeight - window.innerHeight;
  if (recorrible <= 0) return 0;
  return (window.scrollY / recorrible) * 100;
};

const CampaignPopup = () => {
  const { user, userProfile, loading } = useAuth();
  const { isEditModeActive } = useVisualEditor();
  const location = useLocation();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(null);
  // Los segundos del disparador "tiempo" cuentan desde que se entró al sitio,
  // no desde cada página: si no, quien navega rápido nunca lo vería.
  const inicioRef = useRef(Date.now());

  const userCtx = {
    uid: user?.uid || null,
    email: user?.email || userProfile?.email || null,
    displayName: userProfile?.displayName || user?.displayName || null,
  };
  const userCtxRef = useRef(userCtx);
  userCtxRef.current = userCtx;

  const { data: popups } = useQuery({
    queryKey: ['popups-config'],
    queryFn: async () => {
      const { data, error } = await getPopups();
      // Si no se pudo leer, mejor no mostrar nada que mostrar algo que el
      // admin quizá ya apagó.
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const pathname = location.pathname;

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

    const disparar = () => {
      if (yaHuboPopupEnSesion()) return;
      const p = elegirPopup(popups, contexto());
      if (!p || p.id !== candidato.id) return;
      registrarMostrado(p);
      trackVista(p, userCtxRef.current);
      setAbierto(p);
    };

    let disparador = candidato.disparador;
    // La intención de salida solo existe con mouse.
    if (disparador === 'salida' && esMovil()) disparador = 'tiempo';

    if (disparador === 'scroll') {
      const alScroll = () => {
        if (porcentajeScroll() >= candidato.scrollPct) disparar();
      };
      window.addEventListener('scroll', alScroll, { passive: true });
      return () => window.removeEventListener('scroll', alScroll);
    }

    if (disparador === 'salida') {
      const alSalir = (e) => {
        if (!e.relatedTarget && e.clientY <= 0) disparar();
      };
      document.addEventListener('mouseout', alSalir);
      return () => document.removeEventListener('mouseout', alSalir);
    }

    const espera = Math.max(0, candidato.segundos * 1000 - (Date.now() - inicioRef.current));
    const t = setTimeout(disparar, espera);
    return () => clearTimeout(t);
  }, [popups, pathname, user, userProfile, loading, isEditModeActive, abierto]);

  const cerrar = useCallback(() => {
    if (abierto) trackCierre(abierto, userCtxRef.current);
    setAbierto(null);
  }, [abierto]);

  const alClicBoton = useCallback(() => {
    if (!abierto) return;
    trackClic(abierto, userCtxRef.current);
    const p = abierto;
    setAbierto(null);

    if (p.objetivo === 'encuesta') {
      // Sin sesión no se puede guardar la encuesta: primero login (o registro
      // desde ahí) y luego de vuelta a la encuesta.
      if (user) navigate(RUTA_ENCUESTA);
      else navigate('/login', { state: { from: RUTA_ENCUESTA } });
      return;
    }

    const url = String(p.botonUrl || '').trim();
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url.startsWith('/') ? url : `/${url}`);
    }
  }, [abierto, navigate, user]);

  if (!abierto) return null;
  return <PopupCard popup={abierto} onCta={alClicBoton} onClose={cerrar} />;
};

export default CampaignPopup;
