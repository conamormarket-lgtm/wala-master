import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { volarMonedasGanadas } from '../../utils/animations';
import { scheduleKapiNotifications } from '../../services/kapiNotifications';
import { limaTodayStr, msHastaMananaLima } from '../../utils/fechaLima';
import { diseno, disenoNum } from '../../utils/modoDiseno';
import { KapiFlotante } from '../../componentes/kit/piezas/Flotantes';
import { sinKapiFlotante } from './kapiFlotante';
import { VentanaKapi } from '../../componentes/kit/piezas/VentanaKapi';
import { GuiaPasos } from '../../componentes/kit/piezas/GuiaPasos';
import { kapiDesdePerfil, retoDesdePerfil } from '../../componentes/kit/adaptadores';
import { retoVisto, marcarRetoVisto, EVENTO_RETO_VISTO } from '../../utils/retoVisto';
import { tomarTurno, soltarTurno, useTurnoVentanas } from '../../utils/turnoVentanas';
import { useEsperaBienvenida } from './BienvenidaDeTienda';

// Marca del navegador (compatibilidad); la que manda es userProfile.kapiTutorialVisto.
const CLAVE_TUTORIAL = 'kapiTutorialCompleted';
// El recorrido se abre solo en momentos tranquilos (inicio, Mi cuenta,
// Minijuegos): nunca encima de un producto, del carrito o del pago. En el
// resto espera; si la persona toca a Walito, empieza ahí mismo.
const esMomentoTranquilo = (ruta) => ruta === '/' || ruta.startsWith('/cuenta') || ruta.startsWith('/minijuegos');
// ?kapi= del modo diseño → estado del kit.
const ESTADOS_DISENO = { feliz: 'feliz', hambriento: 'hambre', triste: 'triste' };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// El recorrido de la primera vez (los id están en VentanaKapi).
const PASOS_RECORRIDO = [
  { selector: '#kapi-pet-container', titulo: 'Conoce a Walito', texto: '¡Esta es tu mascota! Crece contigo mientras usas Walá.' },
  { selector: '#kapi-stats', titulo: 'Su felicidad', texto: 'Si te olvidas de darle de comer, se pone triste y su barra de felicidad baja.' },
  { selector: '#kapi-feed-btn', titulo: '¡A comer!', texto: 'Dale de comer cada día aquí. A cambio te regala monedas para canjear por recompensas.' },
];

const tutorialEnNavegador = () => {
  try {
    return Boolean(localStorage.getItem(CLAVE_TUTORIAL));
  } catch {
    return false;
  }
};

/*
 * Walito (M8) con el kit: KapiFlotante en la pila y VentanaKapi. Todo lo de
 * KapiPet sigue igual:
 *  - No sale sin perfil, en landings (cabecera oculta: protege el pago) ni
 *    en el estudio de Crear (tapaba el botón de compra) ni al abrir un regalo
 *    (ya está el del sobre).
 *  - Lo abren el evento open-kapi-pet (Zona Arcade) y weekly-challenge-completed.
 *  - Recorrido de bienvenida (GuiaPasos del kit) una vez por cuenta, en
 *    momentos tranquilos y con su turno (utils/turnoVentanas); cuenta como
 *    visto si la persona lo termina o lo salta.
 *  - Al abrir con la comida pendiente se despierta el servidor (calentarKapi).
 *  - Programa sus notificaciones (scheduleKapiNotifications).
 *  - Mientras come no se cierra (lo cuida VentanaKapi).
 *  - Modo diseño: ?sesion=activa&kapi=feliz|hambriento|triste&felicidad=25.
 */
export default function Kapi() {
  const { user, userProfile, feedKapi, calentarKapi, activeWeeklyChallenge, updateUserProfile } = useAuth();
  const { addToast } = useGlobalToast();
  const layout = useLayoutContext();
  const enLanding = layout && layout.isHeaderVisible === false;
  const { pathname } = useLocation();
  // El estudio, abrir un regalo, el acceso, la encuesta y Crear ya tienen su
  // propio Walito (o ninguno): ver kapiFlotante.js (también lo usa el pie).
  const sinFlotante = sinKapiFlotante(pathname);
  const enMomentoTranquilo = esMomentoTranquilo(pathname);
  const [abierta, setAbierta] = useState(false);
  // Abierta sola (la primera vez): con su turno, que se suelta al cerrar.
  const turno = useTurnoVentanas();
  const esperaBienvenida = useEsperaBienvenida();
  const porTurnoRef = useRef(false);

  useEffect(() => {
    if (userProfile) scheduleKapiNotifications(userProfile);
  }, [userProfile]);

  useEffect(() => {
    const abrir = () => setAbierta(true);
    window.addEventListener('open-kapi-pet', abrir);
    window.addEventListener('weekly-challenge-completed', abrir);
    return () => {
      window.removeEventListener('open-kapi-pet', abrir);
      window.removeEventListener('weekly-challenge-completed', abrir);
    };
  }, []);

  // Celebra el reto una sola vez: solo al pasar de pendiente a completado
  // (el perfil se relee tras cada acción del servidor). Si ya llega completado
  // al cargar, no se celebra; la marca por cuenta y reto evita repetirlo.
  const retoCompletado = Boolean(retoDesdePerfil(activeWeeklyChallenge, userProfile)?.completado);
  const retoAntesRef = useRef(null);
  useEffect(() => {
    if (!user || !userProfile || userProfile._perfilNoCargado || !activeWeeklyChallenge) return;
    const clave = `kapiRetoCelebrado:${user.uid}:${activeWeeklyChallenge.challengeId}`;
    const antes = retoAntesRef.current;
    retoAntesRef.current = { clave, completado: retoCompletado };
    if (!retoCompletado || !antes || antes.clave !== clave || antes.completado) return;
    try {
      if (localStorage.getItem(clave)) return;
      localStorage.setItem(clave, '1');
    } catch {
      /* sin storage: vale el cambio visto en esta visita */
    }
    window.dispatchEvent(new CustomEvent('weekly-challenge-completed'));
  }, [user, userProfile, activeWeeklyChallenge, retoCompletado]);

  // Reto nuevo sin abrir: el puntito de aviso. Abrir la ventana (o verlo en
  // Mi cuenta › Misiones) lo marca como visto.
  const [, setRetoVistoTick] = useState(0);
  useEffect(() => {
    const alVer = () => setRetoVistoTick((n) => n + 1);
    window.addEventListener(EVENTO_RETO_VISTO, alVer);
    return () => window.removeEventListener(EVENTO_RETO_VISTO, alVer);
  }, []);
  useEffect(() => {
    if (abierta && user && activeWeeklyChallenge) marcarRetoVisto(user.uid, activeWeeklyChallenge.challengeId);
  }, [abierta, user, activeWeeklyChallenge]);
  const retoSinVer = Boolean(user && activeWeeklyChallenge && !retoCompletado && !retoVisto(user.uid, activeWeeklyChallenge.challengeId));

  const tutorialVisto = () => Boolean(userProfile?.kapiTutorialVisto) || tutorialEnNavegador();
  const marcarTutorialVisto = () => {
    try {
      localStorage.setItem(CLAVE_TUTORIAL, 'true');
    } catch {
      /* sin storage: queda en el perfil */
    }
    if (user && !userProfile?.kapiTutorialVisto) updateUserProfile({ kapiTutorialVisto: true });
  };

  // Primera vez: se abre solo (en un momento tranquilo). Si ya lo vio en este
  // navegador antes de que existiera el campo, se pasa a su cuenta.
  useEffect(() => {
    if (enLanding || !enMomentoTranquilo || !userProfile || userProfile.kapiTutorialVisto || abierta) return;
    if (tutorialEnNavegador()) {
      updateUserProfile({ kapiTutorialVisto: true });
      return;
    }
    // Después del aviso de bienvenida y sin otra ventana encima.
    if (esperaBienvenida || !tomarTurno('walito')) return;
    porTurnoRef.current = true;
    setAbierta(true);
  }, [userProfile, enLanding, enMomentoTranquilo, turno, esperaBienvenida]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cerrarse, suelta el turno (si se abrió sola); también si Walito se va
  // de la página con la ventana abierta.
  useEffect(() => {
    if (abierta || !porTurnoRef.current) return;
    porTurnoRef.current = false;
    soltarTurno('walito');
  }, [abierta]);
  useEffect(() => () => soltarTurno('walito'), []);

  // El recorrido (GuiaPasos del kit), la primera vez que se abre. Cuenta como
  // visto si la persona lo termina o lo salta; si se cierra la ventana a la
  // mitad, no.
  const [guia, setGuia] = useState(false);
  useEffect(() => {
    if (!abierta) {
      setGuia(false);
      return undefined;
    }
    if (tutorialVisto()) return undefined;
    const espera = setTimeout(() => setGuia(true), 500); // a que la ventana tenga sus id
    return () => clearTimeout(espera);
  }, [abierta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Con la comida pendiente, al abrir se despierta el servidor: entre abrir y
  // pulsar "Alimentar" pasa lo que tarda en arrancar en frío.
  const comidaPendiente = Boolean(user) && userProfile?.lastKapiClaimDate !== limaTodayStr();
  useEffect(() => {
    if (abierta && comidaPendiente) calentarKapi();
  }, [abierta, comidaPendiente, calentarKapi]);

  // Si Walito se esconde en esta página con la ventana abierta, se cierra (y suelta el turno).
  const escondido = Boolean(enLanding || sinFlotante || layout?.kapiFlotanteOculto);
  useEffect(() => {
    if (escondido && abierta) setAbierta(false);
  }, [escondido]); // eslint-disable-line react-hooks/exhaustive-deps

  if (escondido) return null;
  // ?sesion=activa pinta a Walito sin cuenta (solo fuera de producción; no
  // concede nada: el servidor decide si se puede alimentar).
  const perfil = userProfile || (diseno('sesion') === 'activa'
    ? { lastKapiClaimDate: diseno('kapi') === 'feliz' ? limaTodayStr() : undefined }
    : null);
  if (!perfil) return null;

  const kapi = kapiDesdePerfil(perfil);
  const felicidad = disenoNum('felicidad', 0, 100) ?? kapi.felicidad;
  const estadoReal = kapi.alimentado ? 'feliz' : felicidad < 40 ? 'triste' : 'hambre';
  const estado = ESTADOS_DISENO[diseno('kapi')] || estadoReal;
  const aviso = !kapi.alimentado || !tutorialVisto() || retoSinVer;

  const alimentar = async (boton) => {
    // Se mide ya: al acreditarse, el botón se cambia por "¡Walito está lleno!".
    const rect = boton?.getBoundingClientRect();
    const [res] = await Promise.all([feedKapi(), esperar(700)]);
    if (res?.error) {
      addToast(res.error || 'No pudimos alimentar a Walito. Inténtalo de nuevo.', 'error');
      return;
    }
    // Las monedas que acreditó el servidor, volando al contador de la cabecera.
    volarMonedasGanadas(rect ? { getBoundingClientRect: () => rect } : null, Number(res?.data?.reward) || 1);
  };

  const reto = retoDesdePerfil(activeWeeklyChallenge, userProfile);

  return (
    <>
      <KapiFlotante estado={estado} aviso={aviso} onAbrir={() => setAbierta((a) => !a)} />
      <VentanaKapi
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        estado={estado}
        felicidad={felicidad}
        alimentado={kapi.alimentado}
        recompensa={kapi.recompensa}
        hasta={new Date(Date.now() + msHastaMananaLima()).toISOString()}
        onAlimentar={alimentar}
        reto={reto && {
          ...reto,
          onEnviar: (url) => httpsCallable(getFunctions(), 'submitChallengeEvidence')({
            evidenceUrl: url,
            challengeId: activeWeeklyChallenge.challengeId,
            evidenceType: 'link',
          }),
        }}
      />
      <GuiaPasos
        abierta={abierta && guia}
        pasos={PASOS_RECORRIDO}
        onTerminar={() => {
          setGuia(false);
          marcarTutorialVisto();
        }}
      />
    </>
  );
}
