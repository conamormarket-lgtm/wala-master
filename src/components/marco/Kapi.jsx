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
import { VentanaKapi } from '../../componentes/kit/piezas/VentanaKapi';
import { kapiDesdePerfil, retoDesdePerfil } from '../../componentes/kit/adaptadores';

// Marca del navegador (compatibilidad); la que manda es userProfile.kapiTutorialVisto.
const CLAVE_TUTORIAL = 'kapiTutorialCompleted';
// El recorrido se abre solo en momentos tranquilos (inicio, Mi cuenta,
// Minijuegos): nunca encima de un producto, del carrito o del pago. En el
// resto espera; si la persona toca a Kapi, empieza ahí mismo.
const esMomentoTranquilo = (ruta) => ruta === '/' || ruta.startsWith('/cuenta') || ruta.startsWith('/minijuegos');
// ?kapi= del modo diseño → estado del kit.
const ESTADOS_DISENO = { feliz: 'feliz', hambriento: 'hambre', triste: 'triste' };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const tutorialEnNavegador = () => {
  try {
    return Boolean(localStorage.getItem(CLAVE_TUTORIAL));
  } catch {
    return false;
  }
};

/*
 * Kapi (M8) con el kit: KapiFlotante en la pila y VentanaKapi. Todo lo de
 * KapiPet sigue igual:
 *  - No sale sin perfil, en landings (cabecera oculta: protege el pago) ni
 *    en el estudio de Crear (tapaba el botón de compra) ni al abrir un regalo
 *    (ya está el del sobre).
 *  - Lo abren el evento open-kapi-pet (Zona Arcade) y weekly-challenge-completed.
 *  - Recorrido de bienvenida (driver.js) una vez por cuenta, en momentos
 *    tranquilos; cuenta como visto solo si la persona lo termina o lo cierra.
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
  const enEstudioCrear = pathname.startsWith('/crear/');
  // Al abrir un regalo, el Kapi del sobre es el único a la vista.
  const enRegalo = pathname.startsWith('/regalo/');
  // En el acceso, el Kapi del panel de la marca es el único (la cuenta recién
  // creada ya tiene perfil y el flotante salía al lado).
  const enAcceso = ['/login', '/registro', '/completar-perfil', '/recuperar-contrasena'].some((r) => pathname.startsWith(r));
  // En la encuesta, el Kapi de la portada (y del final) es el único.
  const enEncuesta = pathname.startsWith('/encuesta-suscripcion');
  // Crear ya tiene a Kapi diseñando en el arte de la portada (CREAR.md).
  const enCrear = pathname === '/personalizar';
  const enMomentoTranquilo = esMomentoTranquilo(pathname);
  const [abierta, setAbierta] = useState(false);

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
    if (enLanding || !enMomentoTranquilo || !userProfile || userProfile.kapiTutorialVisto) return;
    if (tutorialEnNavegador()) {
      updateUserProfile({ kapiTutorialVisto: true });
      return;
    }
    setAbierta(true);
  }, [userProfile, enLanding, enMomentoTranquilo]); // eslint-disable-line react-hooks/exhaustive-deps

  // El recorrido (driver.js solo se descarga la primera vez). Si se cierra la
  // ventana o se desmonta a la mitad, no cuenta como visto.
  const recorridoRef = useRef(null);
  const cierrePorCodigoRef = useRef(false);
  useEffect(() => {
    let cancelado = false;
    let espera = null;
    if (abierta && !tutorialVisto()) {
      espera = setTimeout(async () => {
        const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')]);
        if (cancelado) return;
        cierrePorCodigoRef.current = false;
        const recorrido = driver({
          showProgress: true,
          animate: true,
          nextBtnText: 'Siguiente',
          prevBtnText: 'Atrás',
          doneBtnText: '¡Entendido!',
          steps: [
            { element: '#kapi-pet-container', popover: { title: 'Conoce a Kapi', description: '¡Esta es tu mascota virtual! Crecerá contigo mientras usas la app.', side: 'top' } },
            { element: '#kapi-stats', popover: { title: 'Felicidad de Kapi', description: 'Kapi necesita atención. Si olvidas alimentarlo, se pondrá triste y su barra de felicidad bajará.', side: 'bottom' } },
            { element: '#kapi-feed-btn', popover: { title: '¡A comer!', description: 'Aliméntalo todos los días aquí. A cambio, él te premiará con monedas que puedes canjear por recompensas reales.', side: 'top' } },
          ],
          onDestroyed: () => {
            recorridoRef.current = null;
            if (!cierrePorCodigoRef.current) marcarTutorialVisto();
          },
        });
        recorridoRef.current = recorrido;
        recorrido.drive();
      }, 500); // a que la ventana tenga sus id
    }
    return () => {
      cancelado = true;
      clearTimeout(espera);
      if (recorridoRef.current) {
        cierrePorCodigoRef.current = true;
        recorridoRef.current.destroy();
      }
    };
  }, [abierta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Con la comida pendiente, al abrir se despierta el servidor: entre abrir y
  // pulsar "Alimentar" pasa lo que tarda en arrancar en frío.
  const comidaPendiente = Boolean(user) && userProfile?.lastKapiClaimDate !== limaTodayStr();
  useEffect(() => {
    if (abierta && comidaPendiente) calentarKapi();
  }, [abierta, comidaPendiente, calentarKapi]);

  if (enLanding || enEstudioCrear || enRegalo || enAcceso || enEncuesta || enCrear) return null;
  // ?sesion=activa pinta a Kapi sin cuenta (solo fuera de producción; no
  // concede nada: el servidor decide si se puede alimentar).
  const perfil = userProfile || (diseno('sesion') === 'activa'
    ? { lastKapiClaimDate: diseno('kapi') === 'feliz' ? limaTodayStr() : undefined }
    : null);
  if (!perfil) return null;

  const kapi = kapiDesdePerfil(perfil);
  const felicidad = disenoNum('felicidad', 0, 100) ?? kapi.felicidad;
  const estadoReal = kapi.alimentado ? 'feliz' : felicidad < 40 ? 'triste' : 'hambre';
  const estado = ESTADOS_DISENO[diseno('kapi')] || estadoReal;
  const aviso = !kapi.alimentado || !tutorialVisto();

  const alimentar = async (boton) => {
    // Se mide ya: al acreditarse, el botón se cambia por "¡Kapi está lleno!".
    const rect = boton?.getBoundingClientRect();
    const [res] = await Promise.all([feedKapi(), esperar(700)]);
    if (res?.error) {
      addToast(res.error || 'No pudimos alimentar a Kapi. Inténtalo de nuevo.', 'error');
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
    </>
  );
}
