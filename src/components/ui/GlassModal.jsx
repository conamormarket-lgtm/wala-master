// =========================================================================
// Walá Design System — GlassModal
// -------------------------------------------------------------------------
// Diálogo glass de nivel "intense" (vidrio profundo) con AnimatePresence.
// Se renderiza mediante portal a document.body, atrapa el foco dentro del
// panel, bloquea el scroll del fondo y se cierra por overlay, botón X o ESC.
// Respeta prefers-reduced-motion (animación sólo de opacidad).
// =========================================================================

import { useEffect, useId, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { scaleIn, fadeUp, fadeIn } from '../../theme/motion';
import styles from './GlassModal.module.css';

// Selector de elementos enfocables para el focus-trap básico.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * GlassModal — diálogo glass accesible.
 *
 * Props:
 *  - open: boolean — controla la visibilidad.
 *  - onClose: () => void — se invoca al pedir cierre (overlay, X, ESC).
 *  - title: string | nodo — encabezado del diálogo (se asocia vía aria-labelledby).
 *  - children: nodo — cuerpo del diálogo.
 *  - footer: nodo (opcional) — fila de acciones al pie.
 *  - size: 'sm' | 'md' | 'lg' — ancho máximo (~420 / 560 / 720px). Default 'md'.
 *  - className, ...rest — se reenvían al panel.
 */
function GlassModal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
  ...rest
}) {
  const panelRef = useRef(null);
  // Guarda el elemento enfocado previo para restaurarlo al cerrar.
  const previousFocusRef = useRef(null);
  const titleId = useId();

  // Cierre seguro (no revienta si no se pasó onClose).
  const requestClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  // Bloquea el scroll del body mientras el modal está abierto, con cleanup.
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Guarda y restaura el foco alrededor del ciclo de vida del modal.
  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Enfoca el primer elemento enfocable del panel (o el panel mismo).
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector(FOCUSABLE);
      if (first instanceof HTMLElement) first.focus();
      else panel.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [open]);

  // Teclado: ESC cierra; Tab queda atrapado dentro del panel.
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null,
      );
      if (focusables.length === 0) {
        // Sin elementos enfocables: mantén el foco en el panel.
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      // Ciclo del foco: del primero al último (Shift+Tab) y viceversa (Tab).
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, requestClose]);

  // Click en el overlay (no en el panel) => cierra.
  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget) requestClose();
  };

  // No renderizamos nada en SSR / sin body.
  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          onMouseDown={handleOverlayMouseDown}
          variants={fadeIn}
          initial="hidden"
          animate="show"
          exit="hidden"
        >
          <motion.div
            ref={panelRef}
            className={[styles.panel, styles[size], className].filter(Boolean).join(' ')}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : 'Diálogo'}
            tabIndex={-1}
            variants={scaleIn}
            initial="hidden"
            animate="show"
            exit="hidden"
            {...rest}
          >
            {/* Brillo superior de vidrio (no interactivo). */}
            <span className={styles.highlight} aria-hidden="true" />

            {(title || onClose) && (
              <div className={styles.header}>
                {title ? (
                  <motion.h2 id={titleId} className={styles.title} variants={fadeUp}>
                    {title}
                  </motion.h2>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={requestClose}
                  aria-label="Cerrar"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            <div className={styles.body}>{children}</div>

            {footer && <div className={styles.footer}>{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default GlassModal;
