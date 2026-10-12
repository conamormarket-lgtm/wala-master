import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import s from './Feedback.module.css';

const ICONOS = { exito: CheckCircle2, info: Info, aviso: AlertTriangle, error: XCircle };

/** Aviso dentro de la página (no flotante). */
export function Aviso({ tipo = 'info', titulo, children, accion, onCerrar }) {
  const Icono = ICONOS[tipo];
  return (
    <div className={`${s.caja} ${s[tipo]}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono className={s.avisoIcono} aria-hidden="true" />
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

export function ProveedorToasts({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const cerrar = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const mostrar = useCallback((toast) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-2), { id, tipo: 'exito', ...toast }]);
    window.setTimeout(() => cerrar(id), toast.duracion || 3500);
  }, [cerrar]);

  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className={s.toasts} aria-live="polite">
        {toasts.map((t) => {
          const Icono = ICONOS[t.tipo];
          return (
            <div key={t.id} className={`${s.toast} ${s[t.tipo]}`}>
              {t.imagen ? <img src={t.imagen} alt="" className={s.toastImg} /> : <Icono className={s.avisoIcono} aria-hidden="true" />}
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
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/** Estado vacío con Kapi y una salida clara. */
export function EstadoVacio({ imagen = '/assets/kapi/kapi-sad.webp', titulo, texto, children }) {
  return (
    <div className={s.vacio}>
      <img src={imagen} alt="" width="120" height="120" />
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children && <div className={s.vacioAcciones}>{children}</div>}
    </div>
  );
}

/**
 * Hoja inferior en móvil / modal centrado en escritorio. Cierra con Escape,
 * clic fuera o el botón, y devuelve el foco a quien la abrió.
 */
export function HojaInferior({ abierta, onCerrar, titulo, children, pie, contenida = false }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!abierta) return undefined;
    const previo = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previo?.focus?.();
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;
  return (
    <div className={[s.fondo, contenida && s.fondoContenido].filter(Boolean).join(' ')} onClick={onCerrar}>
      <div
        ref={panelRef}
        className={s.hoja}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={s.asa} aria-hidden="true" />
        <header className={s.hojaCabeza}>
          <h3>{titulo}</h3>
          <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={s.hojaCuerpo}>{children}</div>
        {pie && <footer className={s.hojaPie}>{pie}</footer>}
      </div>
    </div>
  );
}
