/*
 * El adaptador de la Zona Arcade, aparte de adaptadores.js (que va en el
 * archivo principal de la tienda): solo lo usa /minijuegos.
 */

/* Cada ilustración con sus copias de 640 y 800 px: en el celular y en dos
   columnas se ve a menos de 540 px de ancho, y la de 1000 px pesa el doble.
   El navegador elige según el ancho y la densidad de la pantalla. */
const foto = (nombre) => ({
  src: `/assets/kapi/banners/${nombre}.webp`,
  srcSet: `/assets/kapi/banners/${nombre}-640.webp 640w, /assets/kapi/banners/${nombre}-800.webp 800w, /assets/kapi/banners/${nombre}.webp 1000w`,
});
export const BANNERS_ARCADE = {
  palabra: foto('palabra'),
  kapi: foto('alimenta'),
  ruleta: foto('ruleta'),
  bolitas: foto('bolitas'),
};
/* Un banner: { src, srcSet } o solo su URL. */
const banner = (b) => (typeof b === 'string' ? { imagen: b } : { imagen: b?.src, srcSet: b?.srcSet });

/**
 * Las cuatro tarjetas de la Zona Arcade (props de TarjetaJuego) y cuántos
 * juegos quedan hoy, con la misma lógica de MinijuegosPage. No decide nada:
 * el día lo dice el servidor (hora de Lima) y la página pasa lo que ya sabe.
 *  - sesion, cargando: sin sesión cada botón lleva a iniciar sesión; mientras
 *    se resuelve, botones "cargando" (que no se anuncie un juego ya hecho).
 *  - palabraHecha (wordle de hoy), kapiReclamado (lastKapiClaimDate === hoy),
 *    kapiDoble (multiplicador kapi_double_3d vigente), bolitasHechas
 *    (lastBallSortReward === hoy)
 *  - ruleta: { desbloqueada, girada, perdida, empezada, pendienteAnterior,
 *    dias } (getRuletaEligibility)
 *  - hasta: { manana, lunes } fechas ISO de la próxima medianoche de Lima y del
 *    lunes (para "Disponible de nuevo en…")
 *  - onAlimentar: abre la ventana de Kapi (la tienda dispara 'open-kapi-pet')
 */
export function juegosDelArcade({
  sesion = false, cargando = false, palabraHecha: palabra = false, kapiReclamado: kapi = false, kapiDoble = false,
  bolitasHechas: bolitas = false, ruleta: ruletaPerfil = {}, hasta = {}, onAlimentar, urlLogin = '/login', banners = BANNERS_ARCADE,
} = {}) {
  // Sin sesión no hay perfil: nada está hecho y la ruleta está en cero (como
  // la tienda con userProfile null).
  const palabraHecha = sesion && palabra;
  const kapiReclamado = sesion && kapi;
  const bolitasHechas = sesion && bolitas;
  const ruleta = sesion ? ruletaPerfil : {};
  const { desbloqueada = false, girada = false, perdida = false, empezada = false, pendienteAnterior = false } = ruleta;
  const dias = Math.max(0, Math.min(7, Number(ruleta.dias) || 0));
  const esperaDiaria = hasta.manana ? { hasta: hasta.manana, texto: 'Disponible de nuevo en' } : undefined;
  // Botón según la sesión: sin sesión todos llevan a entrar.
  const boton = (hecho) => {
    if (cargando) return { tipo: 'cargando', texto: 'Cargando…' };
    if (!sesion) return { tipo: 'login', texto: 'Inicia sesión', url: urlLogin };
    return hecho;
  };
  const faltan = 7 - dias;

  const juegos = [
    {
      id: 'palabra',
      ...banner(banners.palabra),
      prioridad: true,
      titulo: 'Palabra del Día',
      descripcion: 'Adivina la palabra oculta en 6 intentos y compite en el ranking global.',
      estado: palabraHecha ? { texto: 'Hecho hoy', tono: 'exito' } : { texto: 'Nuevo reto cada día', tono: 'exito' },
      recompensa: { texto: 'Hasta +4 monedas al acertar' },
      atenuada: palabraHecha,
      espera: palabraHecha && sesion ? esperaDiaria : undefined,
      accion: boton(palabraHecha
        ? { tipo: 'hecho', texto: 'Ver mi resultado', url: '/palabra-del-dia' }
        : { tipo: 'jugar', texto: 'Jugar ahora', url: '/palabra-del-dia' }),
    },
    {
      id: 'kapi',
      ...banner(banners.kapi),
      titulo: 'Alimenta a Kapi',
      descripcion: 'Reclama tu moneda gratis cada día para ahorrar en tus compras.',
      estado: kapiReclamado ? { texto: 'Hecho hoy', tono: 'exito' } : { texto: 'Disponible hoy', tono: 'aviso', punto: true },
      recompensa: { texto: kapiDoble ? '+2 monedas hoy' : '+1 moneda al día' },
      atenuada: kapiReclamado,
      espera: kapiReclamado && sesion ? esperaDiaria : undefined,
      accion: boton(kapiReclamado
        ? { tipo: 'hecho', texto: 'Reclamado hoy', onClick: onAlimentar }
        : { tipo: 'jugar', texto: 'Reclamar moneda', onClick: onAlimentar }),
    },
    {
      id: 'ruleta',
      ...banner(banners.ruleta),
      titulo: 'Ruleta Semanal',
      descripcion: 'Reclama tu moneda los 7 días para girar la ruleta y ganar premios increíbles.',
      estado: desbloqueada ? { texto: 'Giro disponible', tono: 'violeta', punto: true }
        : girada ? { texto: 'Girada', tono: 'exito' }
          : perdida ? { texto: 'Semana perdida', tono: 'peligro' }
            : { texto: 'Bloqueada', tono: 'neutro' },
      recompensa: { texto: 'Premio semanal', icono: 'regalo' },
      racha: { dias, de: 7 },
      nota: pendienteAnterior ? { tipo: 'buena', texto: '¡Tienes un giro pendiente de la semana pasada!' }
        : !desbloqueada ? {
          tipo: girada ? 'hecho' : 'bloqueo',
          texto: girada ? 'Ya giraste esta semana. Vuelve el próximo lunes.'
            : perdida ? 'Perdiste un día esta semana. ¡La próxima no falles!'
              : 'Reclama 7 días seguidos para desbloquearla.',
        } : undefined,
      // Bloqueada por la racha, lo que falta no es tiempo sino días.
      espera: girada ? (hasta.lunes ? { hasta: hasta.lunes, texto: 'Vuelve el lunes, en' } : undefined)
        : !desbloqueada && !perdida && dias < 7
          ? (empezada ? `Te falta${faltan === 1 ? '' : 'n'} ${faltan} ${faltan === 1 ? 'día' : 'días'} de racha` : 'Alimenta a Kapi cada día para desbloquearla')
          : undefined,
      atenuada: !desbloqueada,
      bloqueada: !desbloqueada,
      accion: boton(desbloqueada
        ? { tipo: 'jugar', texto: 'Girar ruleta', url: '/ruleta' }
        : { tipo: 'bloqueado', texto: girada ? 'Ya giraste esta semana' : 'Bloqueada' }),
    },
    {
      id: 'bolitas',
      ...banner(banners.bolitas),
      titulo: 'Las Bolitas de Kapi',
      descripcion: 'Ordena los colores en los tubos para ganar 2 monedas al día.',
      estado: bolitasHechas ? { texto: 'Hecho hoy', tono: 'exito' } : { texto: 'Disponible hoy', tono: 'violeta', punto: true },
      recompensa: { texto: '+2 monedas al día' },
      atenuada: bolitasHechas,
      espera: bolitasHechas && sesion ? esperaDiaria : undefined,
      // Ya hecha, se puede jugar por diversión, sin prometer premio. Se juega
      // también sin cuenta (la página invita a entrar para cobrar).
      accion: cargando ? boton()
        : bolitasHechas ? { tipo: 'hecho', texto: 'Completado — jugar igual', url: '/ball-sort' }
          : { tipo: 'jugar', texto: 'Jugar ahora', url: '/ball-sort' },
    },
  ];

  const listos = sesion && !cargando
    ? (palabraHecha ? 0 : 1) + (kapiReclamado ? 0 : 1) + (desbloqueada ? 1 : 0) + (bolitasHechas ? 0 : 1)
    : 0;
  // Mientras se resuelve la sesión no se anuncia nada (ni "Hecho hoy" ni
  // "Disponible"): solo el botón cargando.
  if (cargando) {
    return { listos, juegos: juegos.map((j) => ({ ...j, estado: undefined, espera: undefined, nota: undefined, atenuada: false, bloqueada: false })) };
  }
  return { juegos, listos };
}
