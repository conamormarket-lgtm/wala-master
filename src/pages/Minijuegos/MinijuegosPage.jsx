// =========================================================================
// Zona Arcade — Hub de minijuegos
// -------------------------------------------------------------------------
// Presentación alineada con las tarjetas de producto de la tienda: superficie
// sólida, borde de un pixel, sombra suave y elevación de 2px al hover. Nada de
// vidrio, halos ni degradados: esto es una sección de tienda, no una landing.
// El color de cada juego se reserva al icono, al badge y a la píldora de
// recompensa; la llamada a la acción es SIEMPRE el violeta de marca, para que
// el usuario aprenda que "el botón morado es el que juega".
//
// Qué se arregló de UI/UX, además del aspecto:
//   - Las tarjetas blancas sobre fondo casi blanco se perdían: ahora llevan
//     borde y sombra propios, como las tarjetas de producto de la tienda.
//   - El motivo del bloqueo de la ruleta SOLO aparecía al pasar el cursor, así
//     que en móvil (donde está casi todo el tráfico) era invisible. Ahora es un
//     aviso fijo dentro de la tarjeta.
//   - Los alert() del navegador se reemplazan por estados de la propia UI: sin
//     sesión cada botón lleva a /login, y la moneda ya reclamada avisa con un
//     toast del sistema.
//   - Cada tarjeta declara su recompensa y su estado con un badge legible.
//
// La lógica de elegibilidad NO cambia: el día lo sigue decidiendo el servidor
// en hora de Lima y el modo diseño solo altera lo que se pinta.
// =========================================================================

// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  SpellCheck,
  Bone,
  Dices,
  FlaskConical,
  Lock,
  Check,
  ArrowRight,
  Trophy,
  LogIn,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getRuletaEligibility } from '../../services/firebase/ruleta';
import { limaTodayStr } from '../../utils/fechaLima';
import { getMiPartidaDeHoy } from '../../services/wordle';
import { diseno, disenoNum, hayModoDiseno } from '../../utils/modoDiseno';
import { Badge, Stagger, StaggerItem } from '../../components/ui';
import ArcadeShell from './ArcadeShell';
import styles from './MinijuegosPage.module.css';
import { T } from '../../i18n/useTranslatedText';

/* -------------------------------------------------------------------------
   JuegoCard — tarjeta de vidrio con acento propio.
   El acento entra por una clase (--acento-*), nunca por un color suelto en el
   JSX, para que el modo noche pueda subirlo un punto y siga siendo legible.
   ------------------------------------------------------------------------- */
const JuegoCard = ({
  acento,
  icono,
  titulo,
  descripcion,
  recompensa,
  estado,
  extras,
  accion,
  atenuada = false,
}) => (
  // Dos elementos a propósito: framer-motion escribe el transform de la entrada
  // como estilo INLINE, y un inline gana a cualquier regla CSS. Cuando la propia
  // tarjeta era el StaggerItem, su `:hover { transform }` no llegaba a aplicarse
  // nunca (el icono sí crecía, porque es un span normal). Así el envoltorio se
  // queda con la animación de entrada y la tarjeta con la del cursor.
  <StaggerItem className={styles.cardWrap}>
    <article className={`${styles.card} ${acento} ${atenuada ? styles.cardAtenuada : ''}`}>
      <div className={styles.cardTop}>
        <span className={styles.icono} aria-hidden="true">{icono}</span>
        {estado}
      </div>

      <h2 className={styles.cardTitulo}><T>{titulo}</T></h2>
      <p className={styles.cardDesc}><T>{descripcion}</T></p>

      {recompensa && <span className={styles.recompensa}>{recompensa}</span>}

      {extras && <div className={styles.cardExtras}>{extras}</div>}

      <div className={styles.cardAccion}>{accion}</div>
    </article>
  </StaggerItem>
);

const MinijuegosPage = () => {
  const { user, userProfile } = useAuth();
  const { addToast } = useGlobalToast();

  // Modo diseño: ?sesion=activa pinta el hub como si hubiera sesión iniciada,
  // para poder revisar la tira de monedas y los botones de juego sin loguearse.
  // No autentica nada: los enlaces siguen llevando a las pantallas reales y el
  // servidor sigue exigiendo sesión.
  const forzarSesion = diseno('sesion');
  const haySesion = forzarSesion ? forzarSesion === 'activa' : Boolean(user);

  // El día lo decide el servidor en hora de Lima. Antes aquí se usaba UTC, así
  // que de 19:00 a 23:59 el hub ofrecía premios ya reclamados y el servidor los
  // rechazaba.
  const todayStr = limaTodayStr();
  // La moneda diaria la acredita feedKapiSecure, que marca lastKapiClaimDate.
  const hasClaimedToday = diseno('moneda')
    ? diseno('moneda') === 'reclamada'
    : userProfile?.lastKapiClaimDate === todayStr;
  const hasClaimedBallSort = diseno('bolitas')
    ? diseno('bolitas') === 'completado'
    : userProfile?.lastBallSortReward === todayStr;

  const elegibilidad = getRuletaEligibility(userProfile);

  // Modo diseño (solo fuera de producción): permite ver cualquier estado de las
  // tarjetas sin esperar a mañana. No concede nada; solo cambia lo que se pinta.
  // La tarjeta del Wordle estaba fija en "Nuevo reto cada día": no sabía si ya
  // habías jugado, así que seguía invitando a jugar una palabra ya resuelta y
  // contaba como juego pendiente. Lo dice el servidor (wordle/{uid}_{fecha}),
  // que es lo mismo que mira la propia pantalla del juego.
  const [wordleHecho, setWordleHecho] = useState(false);
  const forzarPalabra = diseno('palabra');
  useEffect(() => {
    if (forzarPalabra) { setWordleHecho(forzarPalabra === 'jugada'); return; }
    if (!user) { setWordleHecho(false); return; }
    let vivo = true;
    getMiPartidaDeHoy().then((partida) => { if (vivo) setWordleHecho(!!partida); });
    return () => { vivo = false; };
  }, [user, forzarPalabra]);

  const forzarRuleta = diseno('ruleta');
  const isRuletaUnlocked = forzarRuleta
    ? forzarRuleta === 'desbloqueada' || forzarRuleta === 'pendiente'
    : elegibilidad.isUnlocked;
  const hasLost = forzarRuleta ? forzarRuleta === 'perdida' : elegibilidad.hasLost;
  const hasSpun = forzarRuleta ? forzarRuleta === 'girada' : elegibilidad.hasSpun;
  const esPendienteAnterior = forzarRuleta
    ? forzarRuleta === 'pendiente'
    : elegibilidad.esPendienteAnterior;
  const ruletaDays = disenoNum('dias', 0, 7) ?? elegibilidad.days;

  // Cuántas cosas puede hacer HOY: da un motivo concreto para entrar al hub sin
  // obligar a leer las cuatro tarjetas para descubrirlo.
  const listosHoy = haySesion
    ? (wordleHecho ? 0 : 1) + (hasClaimedToday ? 0 : 1) + (isRuletaUnlocked ? 1 : 0)
      + (hasClaimedBallSort ? 0 : 1)
    : 0;

  const handleOpenDailyReward = () => {
    if (hasClaimedToday) {
      addToast('¡Ya alimentaste a Kapi hoy! Vuelve mañana por tu moneda.', 'info');
      return;
    }
    window.dispatchEvent(new CustomEvent('open-kapi-pet'));
  };

  // Sin sesión no bloqueamos con un alert: el propio botón lleva al login.
  const botonLogin = (
    <Link to="/login" className={`${styles.accion} ${styles.accionGhost}`}>
      <LogIn size={17} aria-hidden="true" />
      <T>Inicia sesión</T>
    </Link>
  );

  return (
    <ArcadeShell aurora="vivid" auroraIntensity={0.7}>
      {/* ================================================================
          HERO
          ================================================================ */}
      <header className={styles.hero}>
        <h1 className={styles.title}><T>Zona Arcade</T></h1>
        <p className={styles.subtitle}>
          <T>Cuatro juegos, una rutina diaria y premios que sí se canjean en tus compras.</T>
        </p>

        {haySesion ? (
          /* El saldo de monedas NO se repite aquí: el Header ya lo muestra en
             todas las páginas. Lo que este hub sabe y el Header no es cuántos
             juegos quedan por hacer hoy. */
          <p className={styles.listos}>
            <Sparkles size={16} aria-hidden="true" />
            {listosHoy === 0 ? (
              <T>Ya hiciste todo por hoy. Vuelve mañana.</T>
            ) : (
              <>
                <strong>{listosHoy}</strong>
                <T>{listosHoy === 1 ? 'juego listo para hoy' : 'juegos listos para hoy'}</T>
              </>
            )}
          </p>
        ) : (
          <div className={styles.loginCta}>
            <p className={styles.loginTexto}>
              <T>Entra con tu cuenta para reclamar monedas, guardar tu racha y girar la ruleta.</T>
            </p>
            <Link to="/login" className={styles.loginBtn}>
              <LogIn size={17} aria-hidden="true" />
              <T>Iniciar sesión</T>
            </Link>
          </div>
        )}
      </header>

      {hayModoDiseno() && (
        <p className={styles.avisoDiseno}>
          Modo diseño activo (solo en local): lo que ves está forzado por la URL,
          el servidor sigue aplicando sus reglas.
        </p>
      )}

      {/* ================================================================
          TARJETAS
          ================================================================ */}
      <Stagger className={styles.grid}>
        {/* --- Palabra del Día ------------------------------------------ */}
        <JuegoCard
          acento={styles.wordle}
          icono={<SpellCheck size={26} />}
          titulo="Palabra del Día"
          descripcion="Adivina la palabra oculta en 6 intentos y compite en el ranking global."
          estado={wordleHecho
            ? <Badge tone="success" variant="soft"><T>Hecho hoy</T></Badge>
            : <Badge tone="success" variant="soft"><T>Nuevo reto cada día</T></Badge>}
          atenuada={wordleHecho}
          recompensa={
            <>
              <Trophy size={14} aria-hidden="true" />
              <T>Puesto en el ranking</T>
            </>
          }
          accion={
            !haySesion ? (
              botonLogin
            ) : wordleHecho ? (
              // Una vez jugada, la palabra del día no se repite. El enlace sigue
              // sirviendo para ver el resultado y el ranking.
              <Link to="/palabra-del-dia" className={`${styles.accion} ${styles.accionHecha}`}>
                <Check size={17} aria-hidden="true" />
                <T>Ver mi resultado</T>
              </Link>
            ) : (
              <Link to="/palabra-del-dia" className={styles.accion}>
                <T>Jugar ahora</T>
                <ArrowRight size={16} className={styles.flecha} aria-hidden="true" />
              </Link>
            )
          }
        />

        {/* --- Alimenta a Kapi ------------------------------------------ */}
        <JuegoCard
          acento={styles.kapi}
          icono={<Bone size={26} />}
          titulo="Alimenta a Kapi"
          descripcion="Reclama tu moneda gratis cada día para ahorrar en tus compras."
          estado={
            hasClaimedToday ? (
              <Badge tone="success" variant="soft"><T>Hecho hoy</T></Badge>
            ) : (
              <Badge tone="warning" variant="soft" dot><T>Disponible hoy</T></Badge>
            )
          }
          recompensa={<><span aria-hidden="true">🍖</span><T>+1 moneda al día</T></>}
          atenuada={hasClaimedToday}
          accion={
            !haySesion ? (
              botonLogin
            ) : hasClaimedToday ? (
              <button
                type="button"
                onClick={handleOpenDailyReward}
                className={`${styles.accion} ${styles.accionHecha}`}
              >
                <Check size={17} aria-hidden="true" />
                <T>Reclamado hoy</T>
              </button>
            ) : (
              <button type="button" onClick={handleOpenDailyReward} className={styles.accion}>
                <T>Reclamar moneda</T>
                <ArrowRight size={16} className={styles.flecha} aria-hidden="true" />
              </button>
            )
          }
        />

        {/* --- Ruleta Semanal ------------------------------------------- */}
        <JuegoCard
          acento={styles.ruleta}
          icono={<Dices size={26} />}
          titulo="Ruleta Semanal"
          descripcion="Reclama tu moneda los 7 días para girar la ruleta y ganar premios increíbles."
          estado={
            isRuletaUnlocked ? (
              <Badge tone="violet" variant="solid" dot><T>Giro disponible</T></Badge>
            ) : hasSpun ? (
              <Badge tone="success" variant="soft"><T>Girada</T></Badge>
            ) : hasLost ? (
              <Badge tone="danger" variant="soft"><T>Semana perdida</T></Badge>
            ) : (
              <Badge tone="neutral" variant="outline"><T>Bloqueada</T></Badge>
            )
          }
          recompensa={<><span aria-hidden="true">🎁</span><T>Premio semanal</T></>}
          atenuada={!isRuletaUnlocked}
          extras={
            <>
              <div className={styles.progreso}>
                <div className={styles.progresoTexto}>
                  <span><T>Días reclamados</T></span>
                  <span className={styles.progresoValor}>{ruletaDays}/7</span>
                </div>
                {/* Siete pasos en vez de una barra continua: se lee de un
                    vistazo cuántos días faltan, incluso sin mirar el número. */}
                <div
                  className={styles.pips}
                  role="img"
                  aria-label={`${ruletaDays} de 7 días reclamados`}
                >
                  {Array.from({ length: 7 }, (_, i) => (
                    <span
                      key={i}
                      className={`${styles.pip} ${i < ruletaDays ? styles.pipOn : ''}`}
                    />
                  ))}
                </div>
              </div>

              {/* El giro ganado la semana pasada sigue disponible durante esta.
                  Sin este aviso, el progreso (que va de la semana en curso)
                  haría pensar que la ruleta está bloqueada. */}
              {esPendienteAnterior && (
                <p className={styles.notaBuena}>
                  <Sparkles size={15} aria-hidden="true" />
                  <T>¡Tienes un giro pendiente de la semana pasada!</T>
                </p>
              )}

              {/* Antes esto vivía en un overlay que solo salía al pasar el
                  cursor: en móvil nadie sabía por qué estaba bloqueada. */}
              {!isRuletaUnlocked && (
                <p className={styles.notaBloqueo}>
                  {hasSpun ? <Check size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
                  <T>
                    {hasSpun
                      ? 'Ya giraste esta semana. Vuelve el próximo lunes.'
                      : hasLost
                        ? 'Perdiste un día esta semana. ¡La próxima no falles!'
                        : 'Reclama 7 días seguidos para desbloquearla.'}
                  </T>
                </p>
              )}
            </>
          }
          accion={
            !haySesion ? (
              botonLogin
            ) : isRuletaUnlocked ? (
              <Link to="/ruleta" className={styles.accion}>
                <T>Girar ruleta</T>
                <ArrowRight size={16} className={styles.flecha} aria-hidden="true" />
              </Link>
            ) : (
              <button type="button" className={`${styles.accion} ${styles.accionBloqueada}`} disabled>
                <Lock size={16} aria-hidden="true" />
                <T>{hasSpun ? 'Ya giraste esta semana' : 'Bloqueada'}</T>
              </button>
            )
          }
        />

        {/* --- Las Bolitas de Kapi -------------------------------------- */}
        <JuegoCard
          acento={styles.bolitas}
          icono={<FlaskConical size={26} />}
          titulo="Las Bolitas de Kapi"
          descripcion="Ordena los colores en los tubos para ganar 2 monedas al día."
          estado={
            hasClaimedBallSort ? (
              <Badge tone="success" variant="soft"><T>Hecho hoy</T></Badge>
            ) : (
              <Badge tone="violet" variant="soft" dot><T>Disponible hoy</T></Badge>
            )
          }
          recompensa={<><span aria-hidden="true">🪙</span><T>+2 monedas al día</T></>}
          atenuada={hasClaimedBallSort}
          accion={
            !haySesion ? (
              botonLogin
            ) : hasClaimedBallSort ? (
              // Sigue siendo jugable por diversión, pero sin prometer premio.
              <Link to="/ball-sort" className={`${styles.accion} ${styles.accionHecha}`}>
                <Check size={17} aria-hidden="true" />
                <T>Completado — jugar igual</T>
              </Link>
            ) : (
              <Link to="/ball-sort" className={styles.accion}>
                <T>Jugar ahora</T>
                <ArrowRight size={16} className={styles.flecha} aria-hidden="true" />
              </Link>
            )
          }
        />
      </Stagger>
    </ArcadeShell>
  );
};

export default MinijuegosPage;
