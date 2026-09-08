import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Copy, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { diseno } from '../../utils/modoDiseno';
import { getRuletaBoard, spinRuleta, getRuletaEligibility } from '../../services/firebase/ruleta';
import { CONFIG_POR_DEFECTO, anguloDeParada } from '../../utils/ruletaModel';
import { trackMinigame } from '../../services/analytics/tracker';
import { volarMonedasGanadas } from '../../utils/animations';
import { useEntregaMonedas } from '../../hooks/useEntregaMonedas';
import RuedaRuleta from '../../components/ruleta/RuedaRuleta';
import ArcadeShell from './ArcadeShell';
import styles from './RuletaPage.module.css';
import { T } from '../../i18n/useTranslatedText';

// Rueda de muestra para el modo diseño (?premios=demo). Sirve para repasar
// colores, contraste del texto y recortes sin tener que cargar premios de
// verdad en la base de datos. Inerte en producción, como todo modoDiseno.
const PREMIOS_DEMO = [
  { id: 'd1', nombre: '10 monedas', etiqueta: '10 monedas', tipo: 'monedas', icono: '🪙', texto: '10 monedas' },
  { id: 'd2', nombre: '15% de descuento', etiqueta: '15% dcto', tipo: 'descuento', icono: '🏷️', texto: '15% de descuento' },
  { id: 'd3', nombre: 'Sigue intentando', etiqueta: 'Casi', tipo: 'nada', icono: '🍀', texto: 'Sigue intentando' },
  { id: 'd4', nombre: 'Envío gratis', etiqueta: 'Envío gratis', tipo: 'envio_gratis', icono: '📦', texto: 'Envío gratis' },
  { id: 'd5', nombre: '50 monedas', etiqueta: '50 monedas', tipo: 'monedas', icono: '💰', texto: '50 monedas' },
  { id: 'd6', nombre: 'Taza Kapi gratis', etiqueta: 'Taza gratis', tipo: 'producto_gratis', icono: '🎁', texto: 'Taza Kapi gratis' },
  { id: 'd7', nombre: '5 monedas', etiqueta: '5 monedas', tipo: 'monedas', icono: '🪙', texto: '5 monedas' },
];

// Icono por tipo de premio, para la lista del panel.
const ICONO_TIPO = {
  monedas: '🪙',
  descuento: '🏷️',
  producto_descuento: '🏷️',
  producto_gratis: '🎁',
  envio_gratis: '📦',
  manual: '🎀',
  nada: '🍀',
};

// '2026-09-08T...' -> '8 sep'. Sin librería: es la única fecha de la pantalla.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MESES[d.getMonth()]}`;
};

// Panel lateral: lo que este usuario ya ha ganado. En escritorio va junto a la
// rueda (que dejaba media pantalla vacía a los lados) y en móvil, debajo.
const PanelPremios = ({ historial }) => (
  <aside className={styles.panel}>
    <div className={styles.panelCabecera}>
      <h2 className={styles.panelTitulo}><T>Tus premios</T></h2>
      {historial.length > 0 && (
        <span className={styles.panelContador}>
          {historial.length} {historial.length === 1 ? 'giro' : 'giros'}
        </span>
      )}
    </div>

    {historial.length === 0 ? (
      <p className={styles.panelVacio}>
        <T>Todavía no has girado. Lo que ganes aparecerá aquí.</T>
      </p>
    ) : (
      <ul className={styles.panelLista}>
        {historial.map((h) => (
          <li key={h.id} className={styles.panelItem}>
            <span className={styles.panelIcono} aria-hidden="true">
              {ICONO_TIPO[h.tipo] || '🎡'}
            </span>
            <span className={styles.panelTexto}>
              <span className={styles.panelPremio}>{h.texto}</span>
              {h.cuponCode && <code className={styles.panelCodigo}>{h.cuponCode}</code>}
            </span>
            <span className={styles.panelFecha}>{fechaCorta(h.wonAt)}</span>
          </li>
        ))}
      </ul>
    )}

    {historial.some((h) => h.cuponCode) && (
      <Link to="/cuenta/cupones" className={styles.panelEnlace}>
        <T>Ver mis cupones</T>
      </Link>
    )}
  </aside>
);

// Historial de muestra para el modo diseño, para poder repasar el panel de
// premios sin haber girado nunca (que es justo cuando esta vacio).
const HISTORIAL_DEMO = [
  { id: 'h1', texto: '15% de descuento', tipo: 'descuento', cuponCode: 'WALA-K7M2QP', wonAt: '2026-09-08T12:00:00Z' },
  { id: 'h2', texto: 'Envío gratis', tipo: 'envio_gratis', cuponCode: 'WALA-XWF9JE', wonAt: '2026-09-01T12:00:00Z' },
  { id: 'h3', texto: '10 monedas', tipo: 'monedas', cuponCode: null, wonAt: '2026-08-25T12:00:00Z' },
  { id: 'h4', texto: 'Inténtalo de nuevo', tipo: 'nada', cuponCode: null, wonAt: '2026-08-18T12:00:00Z' },
];

// Quien pide menos movimiento no debería tragarse cuatro segundos de disco
// girando: se le da el resultado casi al instante, sin quitarle el premio.
const prefiereMenosMovimiento = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const RuletaPage = () => {
  const { user, userProfile, reloadProfile } = useAuth();
  const { addToast } = useGlobalToast();
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const [premios, setPremios] = useState([]);
  const [config, setConfig] = useState(CONFIG_POR_DEFECTO);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [cupon, setCupon] = useState(null);
  // Premios que ya ganó este usuario. Vienen del tablero: ruletaWins es de
  // lectura solo para admin, así que el cliente no puede consultarlos por su
  // cuenta ni siquiera los suyos.
  const [historial, setHistorial] = useState([]);
  const [copiado, setCopiado] = useState(false);
  // Igual que en Las Bolitas: el modal del premio no se cierra hasta que las
  // monedas terminan de llegar al contador de la cabecera.
  const { entregando, empezarEntrega } = useEntregaMonedas();
  const [error, setError] = useState('');

  // Aquí NO se pinta a Kapi: el componente KapiPet se monta en App.jsx y sale
  // en todas las páginas. Cuando esta pantalla ponía la suya, se veían dos.

  const [rotacion, setRotacion] = useState(0);
  const [duracionGiro, setDuracionGiro] = useState(0);
  // El temporizador del giro se guarda para poder cancelarlo si el usuario se va
  // de la pantalla a mitad de la animación (antes dejaba un setState huérfano).
  const temporizador = useRef(null);

  // La ayuda se abre sola la primera visita y luego se recuerda cerrada.
  const [ayudaAbierta, setAyudaAbierta] = useState(() => {
    try { return localStorage.getItem('wala_ruleta_ayuda_vista') !== '1'; }
    catch { return true; }
  });

  // ?sesion=activa pinta la pantalla sin haber iniciado sesión, para poder
  // repasar el diseño de la rueda sin una cuenta delante. No concede nada: el
  // giro lo sigue decidiendo el servidor, que ignora estos parámetros.
  const sesionForzada = diseno('sesion') === 'activa';
  const premiosDemo = diseno('premios') === 'demo';
  // ?resultado=premio|cupon|nada abre el modal del resultado sin girar. Sin esto
  // la única forma de revisarlo era gastar el giro semanal de una cuenta y
  // esperar a que tocara justo ese tipo de premio.
  const resultadoDemo = diseno('resultado');

  const cerrarAyuda = () => {
    setAyudaAbierta(false);
    try { localStorage.setItem('wala_ruleta_ayuda_vista', '1'); } catch { /* modo privado */ }
  };

  // El tablero lo arma el servidor: config + premios que pueden salir HOY. El
  // cliente NO filtra por su cuenta; si lo hiciera y el servidor filtrara
  // distinto, la rueda pararía en un gajo que no es el premio ganado.
  useEffect(() => {
    if (!user && !sesionForzada) { setLoading(false); return; }
    let vivo = true;
    (async () => {
      const board = await getRuletaBoard();
      if (!vivo) return;
      // Sin premios NO es un error: es que el admin aún no los ha cargado (o hoy
      // no toca ninguno). Se trata como estado vacío, no como fallo rojo.
      if (!board.success) setError(board.error);
      setConfig(board.config);
      setPremios(premiosDemo ? PREMIOS_DEMO : board.premios);
      setHistorial(premiosDemo ? HISTORIAL_DEMO : (board.historial || []));
      setLoading(false);
    })();
    return () => { vivo = false; };
  }, [user, sesionForzada, premiosDemo]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  // Analytics aditivo (fire-and-forget): inicio del minijuego de ruleta al montar.
  useEffect(() => {
    try {
      trackMinigame('start', { gameId: 'ruleta', gameName: 'Ruleta Semanal' },
        { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modo diseño: abre el modal del resultado al montar.
  useEffect(() => {
    if (!resultadoDemo) return;
    const demos = {
      nada: { nombre: 'Inténtalo de nuevo', texto: 'Inténtalo de nuevo', tipo: 'nada' },
      premio: { nombre: '10 monedas', texto: '10 monedas', tipo: 'monedas', monedas: 10 },
      cupon: { nombre: '15% de descuento', texto: '15% de descuento (hasta S/ 20.00)', tipo: 'descuento' },
    };
    setResult({ id: 'demo', ...(demos[resultadoDemo] || demos.cupon) });
    if (resultadoDemo === 'cupon') {
      setCupon({ code: 'WALA-EJEMPLO', expiraEn: '2026-10-08' });
    }
    // 'premio' reproduce la entrega completa: monedas volando y modal bloqueado
    // hasta que llegan. Es el estado que no se puede revisar de otro modo sin
    // gastar el giro semanal de una cuenta.
    if (resultadoDemo === 'premio') {
      empezarEntrega();
      volarMonedasGanadas(null, 10);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultadoDemo]);

  useEffect(() => {
    if (!ayudaAbierta) return;
    const alPulsar = (e) => { if (e.key === 'Escape') cerrarAyuda(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [ayudaAbierta]);

  const elegibilidad = getRuletaEligibility(userProfile, config.reglas);
  // Modo diseño (solo en local): ?ruleta=desbloqueada|girada|pendiente|perdida
  const forzar = diseno('ruleta');
  const isUnlocked = forzar ? (forzar === 'desbloqueada' || forzar === 'pendiente') : elegibilidad.isUnlocked;
  const hasLost = forzar ? forzar === 'perdida' : elegibilidad.hasLost;
  const hasSpun = forzar ? forzar === 'girada' : elegibilidad.hasSpun;
  const esPendienteAnterior = forzar ? forzar === 'pendiente' : elegibilidad.esPendienteAnterior;

  const handleSpin = async () => {
    if (!isUnlocked || spinning || result) return;

    setSpinning(true);
    setError('');

    // El resultado lo decide el servidor: aquí solo se anima hasta el gajo.
    const res = await spinRuleta();

    if (!res.success) {
      setError(res.error || 'Ocurrió un error al girar la ruleta.');
      setSpinning(false);
      return;
    }

    const premioGanado = res.prize;
    // Si el premio no está en la lista que cargó el cliente (un admin editó los
    // premios entre la carga y el giro), findIndex devuelve -1 y la rueda pararía
    // en una casilla que no corresponde. Recargamos el tablero antes de animar y
    // calculamos el ángulo sobre esa misma lista (el estado aún no se ha aplicado).
    let lista = premios;
    let indice = lista.findIndex((p) => p.id === premioGanado.id);
    if (indice === -1) {
      const frescos = await getRuletaBoard();
      if (frescos.premios.length > 0) {
        lista = frescos.premios;
        setPremios(frescos.premios);
        setConfig(frescos.config);
        indice = frescos.premios.findIndex((p) => p.id === premioGanado.id);
      }
      if (indice === -1) indice = 0; // último recurso: no dejar la rueda en un ángulo absurdo
    }

    // El servidor ya marcó el giro de esta semana: refrescar el perfil para que
    // el hub y el botón no sigan ofreciendo un giro que ya no existe.
    reloadProfile();

    // El ángulo lo calcula anguloDeParada (lógica compartida y con tests): un
    // error de medio gajo aquí haría parar la rueda en un premio distinto del
    // que anuncia el servidor, y a ojo no se nota.
    const reducido = prefiereMenosMovimiento();
    const vueltas = reducido ? 1 : config.reglas.vueltas;
    const duracion = reducido ? 600 : config.reglas.duracionGiroMs;
    const destino = anguloDeParada(indice, lista.length, vueltas);

    setDuracionGiro(duracion);
    setRotacion((actual) => actual + destino);

    temporizador.current = setTimeout(() => {
      setSpinning(false);
      setResult(premioGanado);
      setCupon(res.cupon || null);
      setHistorial((previos) => [{
        id: 'nuevo-' + Date.now(),
        texto: premioGanado.texto || premioGanado.nombre,
        tipo: premioGanado.tipo,
        cuponCode: res.cupon?.code || null,
        wonAt: new Date().toISOString(),
      }, ...previos]);
      // Analytics aditivo (fire-and-forget): fin del minijuego con el premio obtenido.
      try {
        trackMinigame('complete',
          { gameId: 'ruleta', gameName: 'Ruleta Semanal', prizeId: premioGanado?.id, prizeName: premioGanado?.nombre },
          { uid: user?.uid, email: user?.email, displayName: user?.displayName }).catch(() => {});
      } catch {}
      if (premioGanado.tipo === 'monedas') {
        empezarEntrega();
        volarMonedasGanadas(null, Number(premioGanado.monedas));
      }
    }, duracion + 100);
  };

  const copiarCodigo = async () => {
    if (!cupon?.code) return;
    try {
      await navigator.clipboard.writeText(cupon.code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      addToast('No pudimos copiar el código', 'error');
    }
  };

  // Compartir el premio: en móvil abre el diálogo nativo del sistema; en escritorio
  // (donde navigator.share no existe) copia el texto al portapapeles.
  const handleShare = async () => {
    if (!result) return;
    const texto = `¡Gané ${result.texto || result.nombre} en la Ruleta Semanal de Walá! 🎰`;
    const url = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ruleta Semanal de Walá', text: texto, url });
        return;
      } catch (e) {
        // El usuario canceló el diálogo: no es un error que haya que avisar.
        if (e?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      addToast('Resultado copiado al portapapeles', 'success');
    } catch {
      addToast('No pudimos compartir el resultado', 'error');
    }
  };

  // Los estados de espera también viven dentro del shell: antes eran texto
  // suelto sobre el fondo gris y parecían un error de carga de la página.
  const botonAyuda = (
    <button
      type="button"
      className={styles.iconBtn}
      onClick={() => (ayudaAbierta ? cerrarAyuda() : setAyudaAbierta(true))}
      aria-expanded={ayudaAbierta}
    >
      <HelpCircle size={16} aria-hidden="true" />
      <span className={styles.iconBtnTexto}><T>Cómo jugar</T></span>
    </button>
  );

  const pasosAyuda = config.reglas.modoDesbloqueo === 'siempre'
    ? [
      'Tienes un giro cada semana, sin condiciones.',
      'Al girar, se acaba hasta la semana siguiente.',
    ]
    : [
      'Alimenta a Kapi todos los días, de lunes a domingo.',
      'Si te saltas un día, la semana se pierde y el contador vuelve a empezar el lunes.',
      'Al completar los 7 días ganas un giro.',
      'Un giro por semana: al girar, se acaba hasta la siguiente.',
    ];

  const modalAyuda = createPortal(
    <AnimatePresence>
      {ayudaAbierta && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={cerrarAyuda}
          role="presentation"
        >
          <motion.div
            className={styles.ayudaCard}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Cómo se juega"
          >
            <button className={styles.cerrarModal} onClick={cerrarAyuda} aria-label="Cerrar">×</button>

            <h2 className={styles.ayudaTitulo}><T>Cómo se juega</T></h2>

            <p className={styles.ayudaObjetivo}>
              {config.reglas.modoDesbloqueo === 'siempre'
                ? <T>Un giro por semana, cortesía de la casa. Los premios cambian según el día.</T>
                : <T>La ruleta no se juega: se gana. Es el premio de mantener tu racha con Kapi toda la semana.</T>}
            </p>

            <ol className={styles.ayudaPasos}>
              {pasosAyuda.map((paso) => <li key={paso}><T>{paso}</T></li>)}
            </ol>

            <p className={styles.ayudaPie}>
              <T>Si ganas el giro y no lo usas, no lo pierdes: sigue disponible durante la semana siguiente. El premio lo decide el servidor y se acredita solo en tu cuenta.</T>
            </p>

            <button type="button" className={styles.ayudaBtn} onClick={cerrarAyuda}>
              <T>Entendido</T>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );

  // El resultado sale en modal y no como una tarjeta debajo de la rueda: ahí
  // quedaba fuera de la pantalla y había que bajar a buscarlo justo después de
  // la animación, que es el momento en el que uno quiere ver qué le tocó.
  const modalResultado = createPortal(
    <AnimatePresence>
      {result && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => { if (!entregando) setResult(null); }}
          role="presentation"
        >
          <motion.div
            className={styles.resultadoCard}
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Resultado de la ruleta"
          >
            {!entregando && (
              <button
                className={styles.cerrarModal}
                onClick={() => setResult(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            )}

            <span className={styles.resultadoIcono} aria-hidden="true">
              {result.tipo === 'nada' ? '🍀' : '🎉'}
            </span>
            <h2 className={styles.resultadoTitulo}>
              {result.tipo === 'nada' ? <T>¡Casi!</T> : <T>¡Felicidades!</T>}
            </h2>
            <p className={styles.resultadoPremio}>{result.texto || result.nombre}</p>

            {cupon && (
              <div className={styles.cuponCaja}>
                <span className={styles.cuponEtiqueta}><T>Tu código</T></span>
                <div className={styles.cuponCodigoFila}>
                  <code className={styles.cuponCodigo}>{cupon.code}</code>
                  <button
                    type="button"
                    className={styles.cuponCopiar}
                    onClick={copiarCodigo}
                    aria-label="Copiar código"
                  >
                    {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                  </button>
                </div>
                <span className={styles.cuponCaduca}>
                  <T>Válido hasta</T> {cupon.expiraEn}
                </span>
                <Link to="/cuenta/cupones" className={styles.cuponEnlace}>
                  <T>Ver mis cupones</T>
                </Link>
              </div>
            )}

            {result.tipo === 'manual' && (
              <p className={styles.resultNota}>
                <T>Nos pondremos en contacto contigo para entregártelo.</T>
              </p>
            )}

            {/* Compartir "Sigue intentando" no tiene ninguna gracia. */}
            {result.tipo !== 'nada' && (
              <button className={styles.shareBtn} onClick={handleShare}>
                <T>Compartir Resultado 🎉</T>
              </button>
            )}
            <button
              type="button"
              className={styles.ayudaBtn}
              onClick={() => setResult(null)}
              disabled={entregando}
            >
              {entregando ? <T>Acreditando tus monedas...</T> : <T>Entendido</T>}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );

  if (!user && !sesionForzada) {
    return (
      <ArcadeShell back="/minijuegos" title="Ruleta Semanal" acciones={botonAyuda}>
        <p className={styles.estado}><T>Inicia sesión para jugar.</T></p>
        {modalAyuda}
      </ArcadeShell>
    );
  }

  if (loading) {
    return (
      <ArcadeShell back="/minijuegos" title="Ruleta Semanal" className={styles.pageContainer} acciones={botonAyuda}>
        {/* Mismo armazón que la pantalla cargada: si el hueco no ocupa lo mismo
            que la rueda, al llegar los premios la página pega un salto. */}
        <div className={styles.layout}>
          <div className={styles.zonaRueda}>
            <div className={styles.esqueletoRueda} aria-hidden="true" />
            <p className={styles.cargando}><T>Cargando ruleta...</T></p>
          </div>
        </div>
        {modalAyuda}
      </ArcadeShell>
    );
  }

  // Sin premios no hay ruleta que girar. Antes se pintaba igual: un disco negro
  // y un botón "¡GIRAR RULETA!" activo que, al pulsarlo, se iba al servidor a
  // fallar. Mejor decirlo y no ofrecer una acción que no existe.
  if (premios.length === 0 || !config.activa) {
    return (
      <ArcadeShell back="/minijuegos" title="Ruleta Semanal" className={styles.pageContainer} acciones={botonAyuda}>
        <div className={styles.vacio}>
          <span className={styles.vacioIcono} aria-hidden="true">🎡</span>
          <h2 className={styles.vacioTitulo}>
            {config.activa ? <T>La ruleta está en preparación</T> : <T>La ruleta está cerrada por ahora</T>}
          </h2>
          <p className={styles.vacioTexto}>
            <T>Tu progreso no se pierde: cuando la abramos, tu giro seguirá aquí esperándote.</T>
          </p>
          <Link to="/minijuegos" className={styles.vacioBtn}><T>Ver otros juegos</T></Link>
        </div>
        {modalAyuda}
      </ArcadeShell>
    );
  }

  return (
    <ArcadeShell back="/minijuegos" title="Ruleta Semanal" className={styles.pageContainer} acciones={botonAyuda}>
      {error && <div className={styles.errorBanner}><T>{error}</T></div>}

      <div className={styles.layout}>
        <div className={styles.zonaRueda}>
          <RuedaRuleta
            premios={premios}
            colores={config.tema.colores}
            colorAro={config.tema.colorAro}
            colorPuntero={config.tema.colorPuntero}
            imagenCentro={config.tema.imagenCentro}
            rotacion={rotacion}
            duracionMs={duracionGiro}
          />

          <div className={styles.controls}>
            {/* Giro heredado de la semana pasada: se avisa para que no parezca
                un error que la ruleta esté abierta con el contador a cero. */}
            {esPendienteAnterior && !result && (
              <p className={styles.pendingNote}>
                <T>Este giro es el que ganaste la semana pasada. ¡Aprovéchalo!</T>
              </p>
            )}
            <button
              className={`${styles.spinBtn} ${(!isUnlocked || spinning || result) ? styles.disabled : ''}`}
              onClick={handleSpin}
              disabled={!isUnlocked || spinning || !!result}
            >
              <T>
                {spinning
                  ? 'Girando...'
                  : (result || hasSpun
                    ? 'Ya giraste esta semana ✅'
                    : (isUnlocked
                      ? '¡GIRAR RULETA!'
                      : (hasLost ? 'Semana Perdida ❌' : 'Ruleta Bloqueada 🔒')))}
              </T>
            </button>
          </div>
        </div>

        <PanelPremios historial={historial} />
      </div>

      {modalResultado}
      {modalAyuda}
    </ArcadeShell>
  );
};

export default RuletaPage;
