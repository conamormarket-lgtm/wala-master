import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getRuletaEligibility } from '../../services/firebase/ruleta';
import { recordMissionAction } from '../../services/loyalty';
import { getMiPartidaDeHoy } from '../../services/wordle';
import { limaTodayStr, msHastaMananaLima, msHastaLunesLima } from '../../utils/fechaLima';
import { diseno, disenoNum, hayModoDiseno } from '../../utils/modoDiseno';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaMinijuegos } from '../../componentes/kit/paginas/Minijuegos';
import { Aviso } from '../../componentes/kit/Feedback';
import { juegosDelArcade } from '../../componentes/kit/adaptadoresArcade';

/*
 * La Zona Arcade (/minijuegos) con el kit (paso 6, MINIJUEGOS.md):
 * PaginaMinijuegos con las cuatro tarjetas de juegosDelArcade. La misma
 * lógica que MinijuegosPage:
 *  - el día lo decide la hora de Lima (limaTodayStr); la moneda de Kapi
 *    (lastKapiClaimDate), las bolitas (lastBallSortReward), el doble del reto
 *    semanal (kapi_double_3d vigente) y la ruleta (getRuletaEligibility)
 *    salen del perfil; la palabra, de getMiPartidaDeHoy
 *  - al entrar con sesión, la misión diaria visit_minijuegos
 *  - "Reclamar moneda" abre a Kapi (open-kapi-pet); ya reclamada, un toast
 *  - mientras se resuelve la sesión no se anuncia nada (botones cargando)
 *  - el modo diseño (?sesion=, ?moneda=, ?bolitas=, ?palabra=, ?ruleta=,
 *    ?dias=, solo en local) cambia lo que se pinta, con su aviso
 * Diferente: la sesión anónima (la de algunas landings) no cuenta como
 * cuenta (tieneCuenta), como en el resto de la tienda.
 * Lo de antes: pages/Minijuegos/MinijuegosViejo.jsx (interruptor minijuegosViejo).
 */
export default function MinijuegosDeTienda() {
  const { user, userProfile, loading } = useAuth();
  const { addToast } = useGlobalToast();

  const forzarSesion = diseno('sesion');
  const sesion = forzarSesion ? forzarSesion === 'activa' : tieneCuenta(user);
  const cargando = loading && !forzarSesion;

  const hoy = limaTodayStr();
  const kapiReclamado = diseno('moneda') ? diseno('moneda') === 'reclamada' : userProfile?.lastKapiClaimDate === hoy;
  const kapiDoble = userProfile?.activeMultiplier === 'kapi_double_3d'
    && Boolean(userProfile?.multiplierExpiresAt) && new Date(userProfile.multiplierExpiresAt) > new Date();
  const bolitasHechas = diseno('bolitas') ? diseno('bolitas') === 'completado' : userProfile?.lastBallSortReward === hoy;

  // La palabra: lo dice el servidor (wordle/{uid}_{fecha}), lo mismo que mira el juego.
  const [palabraHecha, setPalabraHecha] = useState(false);
  const forzarPalabra = diseno('palabra');
  useEffect(() => {
    if (forzarPalabra) { setPalabraHecha(forzarPalabra === 'jugada'); return undefined; }
    if (!tieneCuenta(user)) { setPalabraHecha(false); return undefined; }
    let vivo = true;
    getMiPartidaDeHoy().then((partida) => { if (vivo) setPalabraHecha(Boolean(partida)); });
    return () => { vivo = false; };
  }, [user, forzarPalabra]);

  // Misiones diarias: que entró aquí de verdad.
  useEffect(() => {
    if (tieneCuenta(user)) recordMissionAction('visit_minijuegos').catch(() => {});
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegibilidad = getRuletaEligibility(userProfile);
  const forzarRuleta = diseno('ruleta');
  const ruleta = forzarRuleta ? {
    desbloqueada: forzarRuleta === 'desbloqueada' || forzarRuleta === 'pendiente',
    girada: forzarRuleta === 'girada',
    perdida: forzarRuleta === 'perdida',
    empezada: forzarRuleta !== 'bloqueada',
    pendienteAnterior: forzarRuleta === 'pendiente',
    dias: disenoNum('dias', 0, 7) ?? elegibilidad.days,
  } : {
    desbloqueada: elegibilidad.isUnlocked,
    girada: elegibilidad.hasSpun,
    perdida: elegibilidad.hasLost,
    empezada: elegibilidad.haEmpezado,
    pendienteAnterior: elegibilidad.esPendienteAnterior,
    dias: disenoNum('dias', 0, 7) ?? elegibilidad.days,
  };

  const alimentar = () => {
    if (kapiReclamado) {
      addToast('¡Ya alimentaste a Kapi hoy! Vuelve mañana por tu moneda.', 'info');
      return;
    }
    window.dispatchEvent(new CustomEvent('open-kapi-pet'));
  };

  const ahora = Date.now();
  const { juegos, listos } = juegosDelArcade({
    sesion,
    cargando,
    palabraHecha,
    kapiReclamado,
    kapiDoble,
    bolitasHechas,
    ruleta,
    hasta: {
      manana: new Date(ahora + msHastaMananaLima()).toISOString(),
      lunes: new Date(ahora + msHastaLunesLima()).toISOString(),
    },
    onAlimentar: alimentar,
    urlLogin: '/login?redirect=%2Fminijuegos',
  });

  return (
    <PaginaMinijuegos
      juegos={juegos}
      listos={listos}
      sesion={sesion}
      cargando={cargando}
      urlLogin="/login?redirect=%2Fminijuegos"
      aviso={hayModoDiseno() ? (
        <Aviso compacto tipo="info">
          Modo diseño activo (solo en local): lo que ves está forzado por la URL, el servidor sigue aplicando sus reglas.
        </Aviso>
      ) : null}
    />
  );
}
