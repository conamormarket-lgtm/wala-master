import React, { useMemo, useState } from 'react';
import { PaginaPalabra, PaginaRuleta, PaginaBolitas, normalizarPalabra } from './kit';
import { limaTodayStr, limaDayOfWeek, msHastaMananaLima, msHastaLunesLima } from '../utils/fechaLima';
import { premiosDeHoy, textoPremio, sortearPremio, esCupon, normalizarConfig } from '../utils/ruletaModel';
import { volarMonedasGanadas } from '../utils/animations';
import { DAILY_WORDS, PALABRAS_FIJAS, VALID_GUESSES } from '../data/wordleDictionary';
import JUEGOS from './demo/juegos.json';

/*
 * Los minijuegos por dentro en la Tienda de prueba: la Palabra del día
 * (/palabra-del-dia), la Ruleta Semanal (/ruleta) y Las Bolitas de Kapi
 * (/ball-sort).
 *
 * Qué es real y qué es de ejemplo:
 *  - La palabra de hoy es la real: la misma cuenta que getDailyWord (la lista
 *    de data/wordleDictionary, sin palabra puesta por el admin para hoy), y el
 *    diccionario es el mismo.
 *  - La rueda es la real: ruletaConfig/settings y ruletaPrizes
 *    (demo/juegos.json), con los premios que salen hoy. El sorteo se hace
 *    aquí con la misma regla (sortearPremio); en la tienda lo hace el servidor.
 *  - El ranking, las estadísticas, el historial de la ruleta y los códigos de
 *    cupón son DE EJEMPLO. No se guarda nada ni se cobran monedas de verdad.
 */

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** La palabra de hoy, como getDailyWord sin palabra del admin. */
function palabraDeHoy(hoy) {
  if (PALABRAS_FIJAS[hoy]) return PALABRAS_FIJAS[hoy];
  const [y, m, d] = hoy.split('-').map(Number);
  const dia = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return DAILY_WORDS[((dia % DAILY_WORDS.length) + DAILY_WORDS.length) % DAILY_WORDS.length];
}

export const VISTAS_JUEGOS = [
  ['Palabra del día', '/palabra-del-dia'],
  ['Ruleta Semanal', '/ruleta'],
  ['Las Bolitas de Kapi', '/ball-sort'],
];

export const ESTADOS_JUEGOS = {
  '/palabra-del-dia': [['ganada', 'Ya jugó hoy (ganó)'], ['perdida', 'Ya jugó hoy (perdió)'], ['primera', 'Primera vez (ayuda)'], ['cargando', 'Cargando']],
  '/ruleta': [['racha', 'Racha 4/7'], ['girada', 'Ya giró esta semana'], ['perdida', 'Semana perdida'], ['pendiente', 'Giro pendiente'], ['cerrada', 'Cerrada'], ['cargando', 'Cargando']],
  '/ball-sort': [['casi', 'Casi resuelto (2 jugadas)'], ['yaHoy', 'Ya ganó hoy'], ['primera', 'Primera vez (ayuda)'], ['cargando', 'Cargando']],
};

/* Ranking y estadísticas de ejemplo (el real tiene nombres de clientes). */
const RANKING = {
  hoy: [
    { id: 'r1', nombre: 'Lucía Ramos', intentos: 3, segundos: 74, racha: 12 },
    { id: 'r2', nombre: 'Diego Paredes', intentos: 4, segundos: 51, racha: 5 },
    { id: 'r3', nombre: 'Camila Torres', intentos: 4, segundos: 132, racha: 3 },
    { id: 'r4', nombre: 'Andrés Salas', intentos: 5, segundos: 210, racha: 1 },
  ],
  global: [
    { id: 'g1', nombre: 'Lucía Ramos', victorias: 41, jugadas: 44, mejorRacha: 19 },
    { id: 'g2', nombre: 'Mariana Vega', victorias: 38, jugadas: 45, mejorRacha: 14 },
    { id: 'g3', nombre: 'Diego Paredes', victorias: 22, jugadas: 30, mejorRacha: 9 },
  ],
};

const PALABRA_PERDIDA = ['CARTA', 'MONTE', 'PISTA', 'LUNAR', 'BRISA', 'FRESA'];

export function JuegosDemo({ ruta = VISTAS_JUEGOS[0][1], sesion = true, usuario, estados = [], onMonedas, toast }) {
  const hoy = limaTodayStr();
  const cargando = estados.includes('cargando') ? 'cargando' : undefined;
  const manana = new Date(Date.now() + msHastaMananaLima()).toISOString();
  const lunes = new Date(Date.now() + msHastaLunesLima()).toISOString();
  const cobrar = (monto) => { volarMonedasGanadas(null, monto); onMonedas?.(monto); };

  if (ruta === '/ruleta') return <RuletaDemo key={estados.join()} sesion={sesion} estados={estados} cargando={cargando} lunes={lunes} hoy={hoy} cobrar={cobrar} />;
  if (ruta === '/ball-sort') {
    return (
      <PaginaBolitas
        key={`${sesion}-${estados.join()}`}
        estado={cargando}
        sesion={sesion}
        yaHoy={estados.includes('yaHoy')}
        ayudaVista={!estados.includes('primera')}
        nivelInicial={estados.includes('casi') ? NIVEL_CASI : undefined}
        onGanar={async () => {
          await espera(900); // lo que tarda claimBallSortRewardSecure
          cobrar(2);
          return { monto: 2 };
        }}
      />
    );
  }

  const objetivo = palabraDeHoy(hoy);
  const yo = sesion && usuario ? [{ id: 'yo', nombre: usuario.nombre, intentos: 3, segundos: 96, racha: 8, yo: true }] : [];
  let inicial = {};
  if (estados.includes('ganada')) inicial = { filas: ['PERRO', 'CANTO', objetivo] };
  if (estados.includes('perdida')) inicial = { filas: PALABRA_PERDIDA.filter((p) => p !== normalizarPalabra(objetivo)).slice(0, 6) };
  return (
    <PaginaPalabra
      key={`${sesion}-${estados.join()}`}
      estado={cargando}
      objetivo={objetivo}
      esValida={(p) => VALID_GUESSES.has(normalizarPalabra(p))}
      inicial={inicial}
      sesion={sesion}
      estadisticas={{ jugadas: 31, victorias: 27, racha: 8, mejorRacha: 15 }}
      ranking={{ hoy: estados.includes('ganada') ? [...RANKING.hoy.slice(0, 1), ...yo, ...RANKING.hoy.slice(1)] : RANKING.hoy, global: RANKING.global }}
      hasta={manana}
      ayudaVista={!estados.includes('primera')}
      onTerminar={async ({ gano, intentos }) => {
        await espera(1000); // guardar la partida y claimWordleRewardSecure
        if (!gano || !sesion) return null;
        const monto = intentos <= 3 ? 4 : 3;
        cobrar(monto);
        return { monto, rapido: intentos <= 3 };
      }}
      onAyudaVista={() => toast?.({ tipo: 'info', titulo: 'En la tienda se recuerda', texto: 'La ayuda no vuelve a abrirse sola (wala_wordle_ayuda_vista).', duracion: 2200 })}
    />
  );
}

/* Un nivel a dos jugadas de terminar, para probar la victoria rápido. */
const b = (id, color) => ({ id, color });
const [R, A, V, M] = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
const NIVEL_CASI = [
  [b('r1', R), b('r2', R), b('r3', R), b('r4', R)],
  [b('a1', A), b('a2', A), b('a3', A), b('a4', A)],
  [b('v1', V), b('v2', V), b('v3', V), b('m4', M)],
  [b('m1', M), b('m2', M), b('m3', M)],
  [b('v4', V)],
  [],
];

const ELECCION = {
  lista: { desbloqueada: true, dias: 7 },
  racha: { dias: 4 },
  girada: { girada: true, dias: 7 },
  perdida: { perdida: true, dias: 2 },
  pendiente: { desbloqueada: true, pendienteAnterior: true, dias: 3 },
};

const HISTORIAL = [
  { id: 'h1', tipo: 'monedas', texto: '10 monedas', fecha: '6 oct' },
  { id: 'h2', tipo: 'envio_gratis', texto: 'Envío gratis', cupon: 'RULETA-7KQ2', fecha: '29 sep' },
];

function RuletaDemo({ sesion, estados, cargando, lunes, hoy, cobrar }) {
  const config = useMemo(() => normalizarConfig(JUEGOS.ruleta.config), []);
  const premios = useMemo(() => premiosDeHoy(JUEGOS.ruleta.premios, { diaSemana: limaDayOfWeek(), hoy, ganados: {} })
    .map((p) => ({ ...p, texto: textoPremio(p) })), [hoy]);
  const [clave] = useState(() => Math.random().toString(36).slice(2, 6).toUpperCase());
  const eleccion = ELECCION[['racha', 'girada', 'perdida', 'pendiente'].find((e) => estados.includes(e))] || ELECCION.lista;
  let estado = cargando;
  if (!estado && estados.includes('cerrada')) estado = 'cerrada';
  return (
    <PaginaRuleta
      estado={estado}
      sesion={sesion}
      premios={premios}
      tema={config.tema}
      reglas={config.reglas}
      eleccion={eleccion}
      historial={HISTORIAL}
      hasta={lunes}
      onGirar={async () => {
        await espera(500); // spinRuletaSecure
        const premio = sortearPremio(premios, Math.random());
        const indice = premios.findIndex((p) => p.id === premio.id);
        let cupon;
        if (esCupon(premio.tipo)) {
          const vence = new Date(`${hoy}T12:00:00`);
          vence.setDate(vence.getDate() + 30);
          cupon = { codigo: `RULETA-${clave}`, vence: `${vence.getDate()} de ${MESES[vence.getMonth()]}` };
        }
        if (premio.tipo === 'monedas') setTimeout(() => cobrar(premio.monedas), (config.reglas.duracionGiroMs || 3500) + 200);
        return { indice, premio, cupon };
      }}
    />
  );
}
