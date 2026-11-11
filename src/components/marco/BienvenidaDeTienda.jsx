import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import usePrimeraCompra from '../../hooks/usePrimeraCompra';
import { tomarTurno, soltarTurno, useTurnoVentanas } from '../../utils/turnoVentanas';

// La pieza del kit baja solo si la cuenta está en su semana de bienvenida.
const PopupBienvenida = lazy(() => import('../../componentes/kit/piezas/Bienvenida').then((m) => ({ default: m.PopupBienvenida })));

// El aviso grande sale al entrar y vuelve a salir pasado este tiempo
// (pedido el 2026-11-11: "que sea un popup y aparezca cada cierto tiempo").
const POPUP_CADA_MS = 4 * 60 * 60 * 1000;
const POPUP_KEY = 'wala_bienvenida_popup_visto';
const EVENTO_ABRIR = 'wala:abrir-bienvenida';
const popupToca = () => {
  try { return Date.now() - Number(localStorage.getItem(POPUP_KEY) || 0) > POPUP_CADA_MS; } catch { return true; }
};
const marcarPopup = () => {
  try { localStorage.setItem(POPUP_KEY, String(Date.now())); } catch { /* modo privado */ }
};

// Donde el aviso no sale (ahí estorba o ya está la tarjeta).
const FUERA = ['/checkout', '/cuenta/referidos', '/admin', '/bienvenida', '/login', '/registro'];
const estaFuera = (ruta) => FUERA.some((r) => ruta.startsWith(r));

/**
 * ¿Las otras ventanas que se abren solas (Walito, la campaña) tienen que
 * esperar al aviso de bienvenida? Sí mientras se sabe si la cuenta está en su
 * semana, y si le toca salir en esta página (utils/turnoVentanas).
 */
export function useEsperaBienvenida() {
  const { bienvenida, cargando } = usePrimeraCompra();
  const { pathname } = useLocation();
  if (cargando) return true;
  return bienvenida?.fase?.estado === 'activa' && !estaFuera(pathname) && popupToca();
}

/** Abre el aviso grande desde cualquier parte (la píldora flotante). */
export const abrirAvisoBienvenida = () => window.dispatchEvent(new Event(EVENTO_ABRIR));

/*
 * El aviso grande de la semana de bienvenida (promo "Tu primera compra puede
 * salir gratis"): PopupBienvenida del kit. Sale al entrar y cada 4 horas, no
 * se puede cerrar en los primeros 5 segundos, y se vuelve a abrir tocando la
 * píldora flotante de abajo (FlotantesDeLaTienda). La franja de arriba se quitó
 * el 2026-11-11: era demasiado visible junto con el aviso. No sale en el
 * checkout, Mi cuenta → Referidos (ahí está la tarjeta), el admin, las
 * condiciones ni el acceso.
 */
export default function BienvenidaDeTienda() {
  const { bienvenida } = usePrimeraCompra();
  const { pathname } = useLocation();
  const [popup, setPopup] = useState(false);
  // Abierto por la persona (la píldora): sin los 5 segundos de espera.
  const [porLaPersona, setPorLaPersona] = useState(false);
  const navigate = useNavigate();

  const fase = bienvenida?.fase;
  const activa = fase?.estado === 'activa';
  const fuera = estaFuera(pathname);
  const turno = useTurnoVentanas();

  // Al entrar y cada 4 horas (se anota al abrirse), con su turno: una sola
  // ventana grande a la vez (utils/turnoVentanas).
  useEffect(() => {
    if (!activa || fuera || popup || !popupToca()) return;
    if (!tomarTurno('bienvenida')) return;
    marcarPopup();
    setPorLaPersona(false);
    setPopup(true);
  }, [activa, fuera, turno]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = () => {
    setPopup(false);
    soltarTurno('bienvenida');
  };
  // Si se va a una página donde no sale (p. ej. "Ver condiciones"), se cierra
  // y suelta el turno; también al desmontarse.
  useEffect(() => {
    if (fuera && popup) cerrar();
  }, [fuera]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => soltarTurno('bienvenida'), []);

  // La píldora flotante lo abre cuando quiera.
  useEffect(() => {
    const abrir = () => { setPorLaPersona(true); setPopup(true); };
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  if (!activa || fuera) return null;
  const promo = bienvenida.promo || {};
  return (
    <Suspense fallback={null}>
      <PopupBienvenida
        abierta={popup}
        espera={porLaPersona ? 0 : 5}
        onCerrar={cerrar}
        venceMs={fase.venceMs}
        saldo={bienvenida.saldo}
        pendiente={bienvenida.pendiente}
        premio={promo.premio}
        minimo={promo.minimoNeto}
        onInvitar={() => { cerrar(); navigate('/cuenta/referidos'); }}
      />
    </Suspense>
  );
}
