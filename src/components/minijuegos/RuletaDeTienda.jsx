import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRuletaBoard, spinRuleta, getRuletaEligibility } from '../../services/firebase/ruleta';
import { trackMinigame } from '../../services/analytics/tracker';
import { CONFIG_POR_DEFECTO } from '../../utils/ruletaModel';
import { msHastaLunesLima } from '../../utils/fechaLima';
import { diseno } from '../../utils/modoDiseno';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { IrALogin } from '../RutaPrivada/RutaPrivada';
import { PaginaRuleta } from '../../componentes/kit/paginas/Ruleta';
import entregarMonedas from './entregarMonedas';

/*
 * La Ruleta Semanal (/ruleta) con el kit (paso 6, JUEGOS.md). La misma
 * lógica que la página de antes:
 *  - sin cuenta, al login (y de vuelta aquí)
 *  - el tablero (config, premios de hoy en su orden, historial) lo arma el
 *    servidor (getRuletaBoard); el giro lo sortea y lo acredita el servidor
 *    (spinRuletaSecure) y la rueda solo para en su gajo
 *  - si el premio ganado no está en la rueda cargada (un admin la cambió),
 *    se vuelve a pedir el tablero antes de girar
 *  - la elegibilidad (racha, giro de la semana, semana perdida, giro
 *    pendiente) sale del perfil con las reglas del admin
 *  - al parar: la analítica, las monedas volando (la hoja no se cierra hasta
 *    que llegan) y el perfil refrescado
 *  - la ayuda se abre sola la primera vez (wala_ruleta_ayuda_vista)
 *  - el modo diseño (solo en local): ?sesion=activa, ?premios=demo,
 *    ?ruleta=desbloqueada|girada|pendiente|perdida, ?resultado=nada|premio|cupon
 * Diferente: si el premio ganado ya no está en la rueda ni al volver a
 * pedirla (era el último en stock), se agrega en su sitio y la rueda para
 * ahí (antes paraba en el primero); si el tablero no carga, se dice con
 * "Reintentar" (antes, "en preparación"); el cupón vence "el 8 de octubre"
 * (antes, 2026-10-08); con 0 monedas no se espera ningún vuelo.
 * Lo de antes: pages/Minijuegos/RuletaViejo.jsx (interruptor juegosViejo).
 */

const CLAVE_AYUDA = 'wala_ruleta_ayuda_vista';
const JUEGO = { gameId: 'ruleta', gameName: 'Ruleta Semanal' };

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// '2026-09-08T…' → '8 sep'
const fechaCorta = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
};
// '2026-10-08' → '8 de octubre'
const fechaLarga = (texto) => {
  const [a, m, d] = String(texto || '').slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return texto || '';
  return `${d} de ${MESES[m - 1]}`;
};

// La rueda de muestra del modo diseño (?premios=demo), la misma de antes.
const PREMIOS_DEMO = [
  { id: 'd1', nombre: '10 monedas', etiqueta: '10 monedas', tipo: 'monedas', texto: '10 monedas' },
  { id: 'd2', nombre: '15% de descuento', etiqueta: '15% dcto', tipo: 'descuento', texto: '15% de descuento' },
  { id: 'd3', nombre: 'Sigue intentando', etiqueta: 'Casi', tipo: 'nada', texto: 'Sigue intentando' },
  { id: 'd4', nombre: 'Envío gratis', etiqueta: 'Envío gratis', tipo: 'envio_gratis', texto: 'Envío gratis' },
  { id: 'd5', nombre: '50 monedas', etiqueta: '50 monedas', tipo: 'monedas', texto: '50 monedas' },
  { id: 'd6', nombre: 'Taza Kapi gratis', etiqueta: 'Taza gratis', tipo: 'producto_gratis', texto: 'Taza Kapi gratis' },
  { id: 'd7', nombre: '5 monedas', etiqueta: '5 monedas', tipo: 'monedas', texto: '5 monedas' },
];
const HISTORIAL_DEMO = [
  { id: 'h1', texto: '15% de descuento', tipo: 'descuento', cuponCode: 'WALA-K7M2QP', wonAt: '2026-09-08T12:00:00Z' },
  { id: 'h2', texto: 'Envío gratis', tipo: 'envio_gratis', cuponCode: 'WALA-XWF9JE', wonAt: '2026-09-01T12:00:00Z' },
  { id: 'h3', texto: '10 monedas', tipo: 'monedas', cuponCode: null, wonAt: '2026-08-25T12:00:00Z' },
  { id: 'h4', texto: 'Inténtalo de nuevo', tipo: 'nada', cuponCode: null, wonAt: '2026-08-18T12:00:00Z' },
];
const RESULTADOS_DEMO = {
  nada: { premio: { tipo: 'nada', texto: 'Inténtalo de nuevo' } },
  premio: { premio: { tipo: 'monedas', texto: '10 monedas', monedas: 10 } },
  cupon: { premio: { tipo: 'descuento', texto: '15% de descuento (hasta S/ 20.00)' }, cupon: { codigo: 'WALA-EJEMPLO', vence: fechaLarga('2026-10-08') } },
};

/* La rueda tiene que tener el premio ganado para parar en él: si no está, va
   en su sitio (los premios de hoy van por id, como los ordena el servidor). */
const conPremio = (premios, premio) => {
  if (premios.some((p) => p.id === premio.id)) return premios;
  const despues = premios.findIndex((p) => String(p.id).localeCompare(String(premio.id)) > 0);
  const lista = [...premios];
  lista.splice(despues < 0 ? lista.length : despues, 0, premio);
  return lista;
};

const ayudaYaVista = () => {
  try { return localStorage.getItem(CLAVE_AYUDA) === '1'; } catch { return true; }
};

export default function RuletaDeTienda() {
  const { user, userProfile, loading, reloadProfile } = useAuth();
  const sesionForzada = diseno('sesion') === 'activa';
  const premiosDemo = diseno('premios') === 'demo';
  const resultadoDemo = diseno('resultado');
  const sesion = tieneCuenta(user) || sesionForzada;
  const [tablero, setTablero] = useState(null);
  const [intento, setIntento] = useState(0);
  const [ayudaVista] = useState(ayudaYaVista);
  const quien = () => ({ uid: user?.uid, email: user?.email, displayName: user?.displayName });

  // El tablero lo arma el servidor: si el cliente filtrara por su cuenta, la
  // rueda podría parar en un gajo que no es el premio ganado.
  useEffect(() => {
    if (!sesion) return undefined;
    let vivo = true;
    setTablero(null);
    getRuletaBoard().then((t) => {
      if (!vivo) return;
      setTablero(premiosDemo ? { ...t, success: true, premios: PREMIOS_DEMO, historial: HISTORIAL_DEMO } : t);
    });
    return () => { vivo = false; };
  }, [user?.uid, sesion, premiosDemo, intento]);

  useEffect(() => {
    trackMinigame('start', JUEGO, quien()).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Modo diseño, ?resultado=premio: las monedas vuelan como en una entrega de verdad.
  useEffect(() => {
    if (resultadoDemo === 'premio') entregarMonedas(10);
  }, [resultadoDemo]);

  const config = tablero?.config || CONFIG_POR_DEFECTO;
  const premios = useMemo(() => tablero?.premios || [], [tablero]);
  const historial = useMemo(() => (tablero?.historial || []).map((h) => ({
    id: h.id, tipo: h.tipo, texto: h.texto, cupon: h.cuponCode || undefined, fecha: fechaCorta(h.wonAt),
  })), [tablero]);

  const elegibilidad = getRuletaEligibility(userProfile, config.reglas);
  const forzar = diseno('ruleta');
  const eleccion = {
    desbloqueada: forzar ? forzar === 'desbloqueada' || forzar === 'pendiente' : elegibilidad.isUnlocked,
    girada: forzar ? forzar === 'girada' : elegibilidad.hasSpun,
    perdida: forzar ? forzar === 'perdida' : elegibilidad.hasLost,
    pendienteAnterior: forzar ? forzar === 'pendiente' : elegibilidad.esPendienteAnterior,
    dias: elegibilidad.days,
  };

  const girar = useCallback(async () => {
    const res = await spinRuleta();
    if (!res.success) throw new Error(res.error || 'Ocurrió un error al girar la ruleta.');
    const premio = res.prize;
    let lista = premios;
    if (!lista.some((p) => p.id === premio.id)) {
      const frescos = await getRuletaBoard();
      if (frescos.premios?.length) lista = frescos.premios;
      lista = conPremio(lista, premio);
      setTablero((t) => ({ ...t, ...(frescos.success ? { config: frescos.config } : {}), premios: lista }));
    }
    return {
      indice: lista.findIndex((p) => p.id === premio.id),
      total: lista.length,
      premio,
      cupon: res.cupon ? { codigo: res.cupon.code, vence: fechaLarga(res.cupon.expiraEn) } : undefined,
      fecha: fechaCorta(new Date().toISOString()),
    };
  }, [premios]);

  const parar = async (r) => {
    trackMinigame('complete', { ...JUEGO, prizeId: r?.premio?.id, prizeName: r?.premio?.nombre }, quien()).catch(() => {});
    // El servidor ya marcó el giro de esta semana: el perfil, para que la
    // Zona Arcade no siga ofreciéndolo.
    const perfil = reloadProfile?.();
    if (r?.premio?.tipo === 'monedas') await Promise.all([entregarMonedas(r.premio.monedas), perfil]);
  };

  if (!loading && !sesion) return <IrALogin />;

  let estado;
  if (loading || (sesion && !tablero)) estado = 'cargando';
  else if (!tablero.success) estado = 'error';
  else if (!config.activa) estado = 'cerrada';
  else if (!premios.length) estado = 'preparacion';

  return (
    <PaginaRuleta
      key={user?.uid || 'sin-cuenta'}
      estado={estado}
      error={estado === 'error' ? tablero.error : undefined}
      onReintentar={() => setIntento((n) => n + 1)}
      sesion={sesion}
      premios={premios}
      tema={config.tema}
      reglas={config.reglas}
      eleccion={eleccion}
      historial={historial}
      hasta={new Date(Date.now() + msHastaLunesLima()).toISOString()}
      onGirar={girar}
      onParar={parar}
      resultadoInicial={RESULTADOS_DEMO[resultadoDemo] || null}
      ayudaVista={ayudaVista}
      onAyudaVista={() => { try { localStorage.setItem(CLAVE_AYUDA, '1'); } catch { /* modo privado */ } }}
      urlLogin="/login?redirect=%2Fruleta"
      urlCupones="/cuenta/cupones"
    />
  );
}
