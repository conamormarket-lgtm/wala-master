import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, XCircle, X, Sparkles, BellOff, CheckCheck } from 'lucide-react';
import { useBloquearScroll, useCerrarConAtras } from './Efectos';
import { FotoProducto } from './piezas/FotoProducto';
import Boton from './Boton';
import { Texto, useTexto } from './Traduccion';
import s from './Feedback.module.css';

const ICONOS = { exito: CheckCircle2, info: Info, aviso: AlertTriangle, error: XCircle };

/** Curvas de hoja nativa (iOS/Android): sale rápido y asienta sin rebote. */
const ENTRA = { type: 'tween', duration: 0.42, ease: [0.32, 0.72, 0, 1] };
const SALE = { type: 'tween', duration: 0.26, ease: [0.4, 0, 1, 1] };

/**
 * Aviso dentro de la página (no flotante).
 *  - tipo: info | exito | aviso | error
 *  - icono: otro ícono en vez del del tipo (p. ej. un candado)
 *  - compacto: una línea chica, sin sello (notas dentro de una tarjeta)
 */
export function Aviso({ tipo = 'info', titulo, children, accion, onCerrar, icono, compacto = false }) {
  const Icono = ICONOS[tipo];
  const cerrar = useTexto('Cerrar aviso');
  return (
    <div className={[s.caja, s[tipo], compacto && s.compacto].filter(Boolean).join(' ')} role={tipo === 'error' ? 'alert' : 'status'}>
      <span className={s.avisoIcono}>{icono || <Icono aria-hidden="true" />}</span>
      <div className={s.avisoTexto}>
        {titulo && <p className={s.avisoTitulo}><Texto>{titulo}</Texto></p>}
        {children && <p><Texto>{children}</Texto></p>}
        {accion && <div className={s.avisoAccion}>{accion}</div>}
      </div>
      {onCerrar && (
        <button type="button" className={s.cerrar} onClick={onCerrar} aria-label={cerrar}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ── Notificaciones ─────────────────────────────────────── */

const NotifCtx = createContext(null);

/** Muestra un toast (y lo guarda en el centro de notificaciones). */
export const useToast = () => useContext(NotifCtx).mostrar;
/** Todo el sistema: historial, no leídas, abrir el centro… */
export const useNotificaciones = () => useContext(NotifCtx);

const DURACION = 4000;
const VISIBLES = 3;
const ALTO_TOAST = 64;

const haceCuanto = (fecha) => {
  const min = Math.round((Date.now() - fecha) / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Ayer' : `Hace ${d} días`;
};

/** Lista de notificaciones agrupadas (Hoy / Antes), con punto de no leída. */
export function ListaNotificaciones({ items, onAbrir, limite }) {
  const lista = limite ? items.slice(0, limite) : items;
  if (!lista.length) {
    return (
      <div className={s.listaVacia}>
        <BellOff aria-hidden="true" />
        <p>No tienes notificaciones</p>
      </div>
    );
  }
  const hoy = new Date().toDateString();
  const grupos = [
    ['Hoy', lista.filter((n) => new Date(n.fecha).toDateString() === hoy)],
    ['Antes', lista.filter((n) => new Date(n.fecha).toDateString() !== hoy)],
  ].filter(([, g]) => g.length);

  return (
    <div className={s.lista}>
      {grupos.map(([nombre, grupo]) => (
        <section key={nombre}>
          <h4 className={s.grupo}>{nombre}</h4>
          <ul>
            {grupo.map((n) => {
              const Icono = ICONOS[n.tipo] || Info;
              return (
                <li key={n.id}>
                  <button type="button" className={[s.notif, !n.leida && s.noLeida].filter(Boolean).join(' ')} onClick={() => onAbrir?.(n)}>
                    {n.imagen ? (
                      <FotoProducto className={s.notifImg} src={n.imagen} relleno="3px" />
                    ) : (
                      <span className={`${s.notifIcono} ${s[n.tipo]}`}><Icono aria-hidden="true" /></span>
                    )}
                    <span className={s.notifTexto}>
                      <strong>{n.titulo}</strong>
                      {n.texto && <span>{n.texto}</span>}
                      <small>{haceCuanto(n.fecha)}</small>
                    </span>
                    {!n.leida && <span className={s.punto} aria-label="Sin leer" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Proveedor de notificaciones: toasts apilados abajo + centro con el
 * historial. Si llegan varias, se apilan (como en Android/iOS); al pasar el
 * ratón o tocarlas se despliegan, y "Ver todas" abre el centro.
 */
export function ProveedorToasts({ children, iniciales = [] }) {
  const [toasts, setToasts] = useState([]);
  const [historial, setHistorial] = useState(iniciales);
  const [abierto, setAbierto] = useState(false);
  const [desplegado, setDesplegado] = useState(false);
  const idRef = useRef(0);
  const desplegadoRef = useRef(false);
  desplegadoRef.current = desplegado;

  // Cerrar (X o deslizar) solo la quita de la pantalla: en el centro sigue
  // sin leer hasta que el usuario la abra o use "Marcar leídas".
  const cerrar = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const mostrar = useCallback((toast) => {
    const id = `t${++idRef.current}`;
    const nueva = { id, tipo: 'exito', fecha: Date.now(), leida: false, ...toast };
    setToasts((t) => [...t, { ...nueva, vence: Date.now() + (toast.duracion || DURACION) }]);
    setHistorial((h) => [nueva, ...h]);
  }, []);

  // Un solo reloj para todos: vencen solos, salvo mientras están desplegados.
  useEffect(() => {
    if (!toasts.length) return undefined;
    const reloj = window.setInterval(() => {
      if (desplegadoRef.current) {
        setToasts((t) => t.map((x) => ({ ...x, vence: x.vence + 400 })));
      } else {
        setToasts((t) => t.filter((x) => x.vence > Date.now()));
      }
    }, 400);
    return () => window.clearInterval(reloj);
  }, [toasts.length]);

  useEffect(() => { if (toasts.length < 2) setDesplegado(false); }, [toasts.length]);

  const noLeidas = historial.filter((n) => !n.leida).length;
  const marcarLeidas = useCallback(() => setHistorial((h) => h.map((n) => ({ ...n, leida: true }))), []);
  const leer = useCallback((id) => setHistorial((h) => h.map((n) => (n.id === id ? { ...n, leida: true } : n))), []);
  const abrirCentro = useCallback(() => { setToasts([]); setAbierto(true); }, []);
  const cerrarCentro = useCallback(() => setAbierto(false), []);

  const valor = useMemo(
    () => ({ mostrar, historial, noLeidas, marcarLeidas, leer, abrirCentro }),
    [mostrar, historial, noLeidas, marcarLeidas, leer, abrirCentro],
  );

  const visibles = toasts.slice(-VISIBLES).reverse(); // el más nuevo primero
  const ocultos = toasts.length - visibles.length;

  return (
    <NotifCtx.Provider value={valor}>
      {children}

      <div
        className={s.toasts}
        aria-live="polite"
        onMouseEnter={() => toasts.length > 1 && setDesplegado(true)}
        onMouseLeave={() => setDesplegado(false)}
      >
        <div className={s.pila} style={{ height: ALTO_TOAST }}>
          <AnimatePresence>
            {visibles.length > 1 && (
              <motion.button
                type="button"
                key="ver-todas"
                className={s.verTodas}
                onClick={abrirCentro}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: desplegado ? -(visibles.length * (ALTO_TOAST + 8)) : -(ALTO_TOAST + 8 + (visibles.length - 1) * 6) }}
                exit={{ opacity: 0, y: 10 }}
                transition={ENTRA}
              >
                Ver todas ({toasts.length})
              </motion.button>
            )}
            {visibles.map((t, i) => {
              const Icono = ICONOS[t.tipo] || Info;
              const atras = desplegado ? 0 : i;
              return (
                <motion.div
                  key={t.id}
                  className={`${s.toast} ${s[t.tipo]}`}
                  style={{ zIndex: VISIBLES - i, height: ALTO_TOAST }}
                  initial={{ opacity: 0, y: 30, scale: 0.96 }}
                  animate={{
                    opacity: 1,
                    y: desplegado ? -i * (ALTO_TOAST + 8) : -i * 6,
                    scale: 1 - atras * 0.05,
                  }}
                  exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                  transition={ENTRA}
                  drag={i === 0 || desplegado ? 'x' : false}
                  dragSnapToOrigin
                  dragElastic={0.5}
                  onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 80) cerrar(t.id); }}
                  onClick={() => { if (!desplegado && toasts.length > 1) setDesplegado(true); }}
                >
                  <div className={s.toastFila} aria-hidden={!desplegado && i > 0}>
                    {t.imagen ? (
                      <FotoProducto className={s.toastImg} src={t.imagen} relleno="3px" loading="eager" />
                    ) : (
                      <span className={s.toastIcono}><Icono aria-hidden="true" /></span>
                    )}
                    <div className={s.toastTexto}>
                      <strong>{t.titulo}</strong>
                      {t.texto && <span>{t.texto}</span>}
                    </div>
                    {t.accion && (
                      <button type="button" className={s.toastAccion} onClick={(e) => { e.stopPropagation(); cerrar(t.id); }}>{t.accion}</button>
                    )}
                    <button type="button" className={s.cerrar} onClick={(e) => { e.stopPropagation(); cerrar(t.id); }} aria-label="Cerrar">
                      <X aria-hidden="true" />
                    </button>
                  </div>
                  {i === 0 && (
                    <span
                      className={s.tiempo}
                      style={{ animationDuration: `${t.duracion || DURACION}ms`, animationPlayState: desplegado ? 'paused' : 'running' }}
                      aria-hidden="true"
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        {ocultos > 0 && desplegado && <span className={s.ocultos}>+{ocultos} más</span>}
      </div>

      <HojaInferior
        abierta={abierto}
        onCerrar={cerrarCentro}
        titulo="Notificaciones"
        acciones={noLeidas > 0 && (
          <button type="button" className={s.marcar} onClick={marcarLeidas}>
            <CheckCheck aria-hidden="true" /> Marcar leídas
          </button>
        )}
      >
        <ListaNotificaciones items={historial} onAbrir={(n) => leer(n.id)} />
      </HojaInferior>
    </NotifCtx.Provider>
  );
}

/** Estado vacío con Kapi y una salida clara. */
export function EstadoVacio({ imagen = '/assets/kapi/kapi-sad.webp', titulo, texto, children }) {
  return (
    <div className={s.vacio}>
      <div className={s.kapi}>
        <img src={imagen} alt="" width="112" height="112" />
        <Sparkles className={`${s.chispa} ${s.chispa1}`} aria-hidden="true" />
        <Sparkles className={`${s.chispa} ${s.chispa2}`} aria-hidden="true" />
      </div>
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children && <div className={s.vacioAcciones}>{children}</div>}
    </div>
  );
}

const enEscritorio = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches;

/* Lo que recibe el foco con Tab (para que no se escape de la hoja). */
const ENFOCABLES = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hoja inferior (móvil / app) y modal centrado (escritorio).
 * Móvil: sube desde abajo con la curva de las hojas nativas, sin rebote;
 * se cierra arrastrando hacia abajo (el fondo se aclara mientras arrastras),
 * tocando fuera, con Esc o con el botón atrás de Android. El fondo de la
 * página no se mueve mientras está abierta.
 * `contenida`: se dibuja dentro de su marco (la maqueta de teléfono).
 *  - bloqueada: mientras sea true no se cierra de ninguna forma (X, fuera,
 *    Esc, arrastre ni "atrás"): un pago o un guardado en curso
 *  - tamano: ancho de la ventana en escritorio: 'sm' (400) · 'md' (480) · 'lg' (640)
 * El foco queda dentro mientras está abierta (Tab da la vuelta) y vuelve a
 * donde estaba al cerrarla.
 */
export function HojaInferior({ abierta, onCerrar, titulo, acciones, children, pie, contenida = false, bloqueada = false, tamano = 'md' }) {
  const panelRef = useRef(null);
  const tituloTraducido = useTexto(titulo);
  const textoCerrar = useTexto('Cerrar');
  const bloqueadaRef = useRef(bloqueada);
  bloqueadaRef.current = bloqueada;
  // Todo cierre pasa por aquí: bloqueada, no se cierra.
  const pedirCierre = () => { if (!bloqueadaRef.current) onCerrar?.(); };
  const controles = useDragControls();
  const modal = !contenida && enEscritorio();
  const arrastre = useMotionValue(0);
  const opacidadFondo = useTransform(arrastre, (v) => (typeof v === 'number' ? Math.max(0.15, 1 - v / 420) : 1));

  useBloquearScroll(abierta && !contenida);
  useCerrarConAtras(abierta && !contenida, onCerrar, bloqueada);

  // onCerrar por referencia: casi siempre llega como función nueva en cada
  // render, y si el efecto dependiera de ella, cada tecla escrita en un campo
  // de la hoja volvía a mandar el foco al panel (solo entraba la primera letra).
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  useEffect(() => {
    if (!abierta) return undefined;
    const previo = document.activeElement;
    const t = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 40);
    const onKey = (e) => {
      const panel = panelRef.current;
      const foco = document.activeElement;
      // Con otra ventana encima (una lista abierta desde esta hoja), las
      // teclas son de ella: esta solo responde si el foco está adentro o en
      // ningún lado.
      if (foco && foco !== document.body && !panel?.contains(foco)) return;
      if (e.key === 'Escape') {
        if (!bloqueadaRef.current) cerrarRef.current?.();
        return;
      }
      // Tab da la vuelta dentro de la hoja.
      if (e.key !== 'Tab' || !panel) return;
      const enfocables = [...panel.querySelectorAll(ENFOCABLES)].filter((el) => el.offsetParent !== null);
      if (!enfocables.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && (foco === primero || foco === panel)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && foco === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      previo?.focus?.({ preventScroll: true });
    };
  }, [abierta]);

  const empezarArrastre = (e) => { if (!modal) controles.start(e); };

  const hoja = (
    <AnimatePresence>
      {abierta && (
        <motion.div
          className={[s.fondo, contenida && s.fondoContenido, modal && s.fondoModal].filter(Boolean).join(' ')}
          // El contenedor no se funde (eso hacía que la hoja apareciera
          // "desvaneciéndose"); solo espera a que la hoja termine de bajar.
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1, transition: { duration: modal ? 0.16 : 0.26 } }}
        >
          <motion.div
            className={s.veloCapa}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.24 } }}
          >
            <motion.div className={s.velo} style={{ opacity: opacidadFondo }} onClick={pedirCierre} />
          </motion.div>
          <motion.div
            ref={panelRef}
            className={[s.hoja, modal && s.hojaModal, modal && s[`hoja_${tamano}`]].filter(Boolean).join(' ')}
            role="dialog"
            aria-modal="true"
            aria-label={typeof tituloTraducido === 'string' ? tituloTraducido : undefined}
            aria-busy={bloqueada || undefined}
            tabIndex={-1}
            style={modal ? undefined : { y: arrastre }}
            initial={modal ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
            animate={modal ? { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } } : { y: 0, transition: ENTRA }}
            exit={modal ? { opacity: 0, scale: 0.98, transition: { duration: 0.16 } } : { y: '100%', transition: SALE }}
            drag={modal || bloqueada ? false : 'y'}
            dragControls={controles}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            dragMomentum={false}
            dragTransition={{ bounceStiffness: 500, bounceDamping: 45 }}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 500) pedirCierre(); }}
          >
            {!modal && (
              <div className={s.asaZona} onPointerDown={empezarArrastre} aria-hidden="true">
                <span className={s.asa} />
              </div>
            )}
            <header className={s.hojaCabeza} onPointerDown={empezarArrastre}>
              <h3>{tituloTraducido}</h3>
              <div className={s.hojaAcciones} onPointerDown={(e) => e.stopPropagation()}>
                {acciones}
                <button type="button" className={s.cerrar} onClick={pedirCierre} disabled={bloqueada} aria-label={textoCerrar}>
                  <X aria-hidden="true" />
                </button>
              </div>
            </header>
            {/* Sin contenido (un Confirmar sin texto) no queda un hueco vacío. */}
            {children ? <div className={s.hojaCuerpo}>{children}</div> : null}
            {pie && <footer className={s.hojaPie}>{pie}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Se dibuja en <body>: si la hoja vive dentro de algo con transform,
  // filter o backdrop-filter (la cabecera de vidrio, por ejemplo), position:
  // fixed quedaría atrapado en ese contenedor en vez de cubrir la pantalla.
  if (contenida || typeof document === 'undefined') return hoja;
  return createPortal(hoja, document.body);
}

/* ── Confirmar ─────────────────────────────────────────── */

/**
 * Pregunta antes de algo que no se deshace (quitar del carrito, eliminar una
 * dirección…). Es una HojaInferior chica: hoja en el celular, ventana en
 * escritorio. Reemplaza al confirm() del navegador.
 *  - titulo, texto  · confirmar: el botón ('Sí') · cancelar ('Cancelar')
 *  - peligro: el botón de confirmar en rojo (borrar, vaciar)
 *  - onConfirmar → puede ser una promesa: mientras dura, la hoja queda
 *    bloqueada y el botón cargando  · onCancelar
 */
export function Confirmar({ abierta, titulo, texto, confirmar = 'Sí', cancelar = 'Cancelar', peligro = false, onConfirmar, onCancelar, contenida = false }) {
  const [cargando, setCargando] = useState(false);
  const aceptar = async () => {
    setCargando(true);
    try {
      await onConfirmar?.();
    } finally {
      setCargando(false);
    }
  };
  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCancelar}
      titulo={titulo}
      tamano="sm"
      bloqueada={cargando}
      contenida={contenida}
      pie={(
        <div className={s.confirmarAcciones}>
          <Boton variante="fantasma" onClick={onCancelar} disabled={cargando}><Texto>{cancelar}</Texto></Boton>
          <Boton variante={peligro ? 'peligro' : 'primario'} onClick={aceptar} cargando={cargando}><Texto>{confirmar}</Texto></Boton>
        </div>
      )}
    >
      {texto && <p className={s.confirmarTexto}><Texto>{texto}</Texto></p>}
    </HojaInferior>
  );
}

const ConfirmarCtx = createContext(null);

/**
 * Para pasar de window.confirm() sin rehacer la lógica: el proveedor dibuja
 * una sola <Confirmar> y useConfirmar() devuelve una función que la abre y
 * resuelve true / false, como confirm() pero sin congelar la página.
 *   const confirmar = useConfirmar();
 *   if (!(await confirmar({ titulo: '¿Eliminar la dirección?', peligro: true, confirmar: 'Eliminar' }))) return;
 */
export function ProveedorConfirmar({ children, contenida = false }) {
  const [pedido, setPedido] = useState(null);
  const confirmar = useCallback((opciones = {}) => new Promise((resolver) => {
    setPedido({ ...opciones, abierta: true, resolver });
  }), []);
  const responder = (si) => {
    pedido?.resolver(si);
    // Se cierra con su animación; los textos quedan hasta que termina.
    setPedido((p) => (p ? { ...p, abierta: false } : p));
  };
  return (
    <ConfirmarCtx.Provider value={confirmar}>
      {children}
      <Confirmar
        abierta={Boolean(pedido?.abierta)}
        titulo={pedido?.titulo}
        texto={pedido?.texto}
        confirmar={pedido?.confirmar}
        cancelar={pedido?.cancelar}
        peligro={pedido?.peligro}
        contenida={contenida}
        onConfirmar={() => responder(true)}
        onCancelar={() => responder(false)}
      />
    </ConfirmarCtx.Provider>
  );
}

/** confirmar(opciones) → Promise<boolean>. Sin proveedor, el confirm() del navegador. */
export function useConfirmar() {
  const confirmar = useContext(ConfirmarCtx);
  return confirmar || ((o = {}) => Promise.resolve(window.confirm([o.titulo, o.texto].filter(Boolean).join('\n\n'))));
}
