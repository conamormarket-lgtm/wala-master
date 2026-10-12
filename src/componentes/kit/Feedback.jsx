import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, XCircle, X, Sparkles } from 'lucide-react';
import s from './Feedback.module.css';

const ICONOS = { exito: CheckCircle2, info: Info, aviso: AlertTriangle, error: XCircle };

/** Aviso dentro de la página (no flotante). El icono entra con un rebote. */
export function Aviso({ tipo = 'info', titulo, children, accion, onCerrar }) {
  const Icono = ICONOS[tipo];
  return (
    <div className={`${s.caja} ${s[tipo]}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <span className={s.avisoIconoCaja}><Icono className={s.avisoIcono} aria-hidden="true" /></span>
      <div className={s.avisoTexto}>
        {titulo && <p className={s.avisoTitulo}>{titulo}</p>}
        {children && <p>{children}</p>}
        {accion}
      </div>
      {onCerrar && (
        <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar aviso">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ── Toasts ─────────────────────────────────────────────── */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

const DURACION = 3500;

export function ProveedorToasts({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const cerrar = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const mostrar = useCallback((toast) => {
    const id = ++idRef.current;
    const duracion = toast.duracion || DURACION;
    setToasts((t) => [...t.slice(-2), { id, tipo: 'exito', duracion, ...toast }]);
    window.setTimeout(() => cerrar(id), duracion);
  }, [cerrar]);

  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className={s.toasts} aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icono = ICONOS[t.tipo];
            return (
              <motion.div
                key={t.id}
                layout
                className={`${s.toast} ${s[t.tipo]}`}
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                drag="x"
                dragSnapToOrigin
                dragElastic={0.6}
                onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 90) cerrar(t.id); }}
              >
                {t.imagen ? (
                  <span className={s.toastImgCaja}><img src={t.imagen} alt="" className={s.toastImg} /></span>
                ) : (
                  <span className={s.toastIcono}><Icono aria-hidden="true" /></span>
                )}
                <div className={s.toastTexto}>
                  <strong>{t.titulo}</strong>
                  {t.texto && <span>{t.texto}</span>}
                </div>
                {t.accion && (
                  <button type="button" className={s.toastAccion} onClick={() => cerrar(t.id)}>{t.accion}</button>
                )}
                <button type="button" className={s.cerrar} onClick={() => cerrar(t.id)} aria-label="Cerrar">
                  <X aria-hidden="true" />
                </button>
                <span className={s.tiempo} style={{ animationDuration: `${t.duracion}ms` }} aria-hidden="true" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/** Estado vacío con Kapi flotando, chispas y una salida clara. */
export function EstadoVacio({ imagen = '/assets/kapi/kapi-sad.webp', titulo, texto, children }) {
  return (
    <div className={s.vacio}>
      <div className={s.kapi}>
        <Sparkles className={`${s.chispa} ${s.chispa1}`} aria-hidden="true" />
        <Sparkles className={`${s.chispa} ${s.chispa2}`} aria-hidden="true" />
        <img src={imagen} alt="" width="120" height="120" />
        <span className={s.sombra} aria-hidden="true" />
      </div>
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children && <div className={s.vacioAcciones}>{children}</div>}
    </div>
  );
}

const esEscritorio = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches;

/**
 * Hoja inferior en móvil (se arrastra hacia abajo para cerrar) y modal
 * centrado en escritorio. Cierra con Escape o tocando fuera, y devuelve el
 * foco a quien la abrió.
 */
export function HojaInferior({ abierta, onCerrar, titulo, children, pie, contenida = false }) {
  const panelRef = useRef(null);
  const controles = useDragControls();
  const modal = !contenida && esEscritorio();

  useEffect(() => {
    if (!abierta) return undefined;
    const previo = document.activeElement;
    const t = window.setTimeout(() => panelRef.current?.focus(), 30);
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      previo?.focus?.();
    };
  }, [abierta, onCerrar]);

  const variantes = modal
    ? { oculto: { opacity: 0, scale: 0.94, y: 16 }, visible: { opacity: 1, scale: 1, y: 0 } }
    : { oculto: { y: '100%' }, visible: { y: 0 } };

  return (
    <AnimatePresence>
      {abierta && (
        <motion.div
          className={[s.fondo, contenida && s.fondoContenido, modal && s.fondoModal].filter(Boolean).join(' ')}
          onClick={onCerrar}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            ref={panelRef}
            className={[s.hoja, modal && s.hojaModal].filter(Boolean).join(' ')}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            variants={variantes}
            initial="oculto"
            animate="visible"
            exit="oculto"
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag={modal ? false : 'y'}
            dragControls={controles}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.8 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onCerrar(); }}
          >
            {!modal && (
              <div className={s.asaZona} onPointerDown={(e) => controles.start(e)} aria-hidden="true">
                <span className={s.asa} />
              </div>
            )}
            <header className={s.hojaCabeza} onPointerDown={(e) => !modal && controles.start(e)}>
              <h3>{titulo}</h3>
              <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar" onPointerDown={(e) => e.stopPropagation()}>
                <X aria-hidden="true" />
              </button>
            </header>
            <div className={s.hojaCuerpo}>{children}</div>
            {pie && <footer className={s.hojaPie}>{pie}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

