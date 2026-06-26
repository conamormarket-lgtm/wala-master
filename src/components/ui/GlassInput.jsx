// =========================================================================
// GlassInput — Campo de formulario glass del sistema "Aurora Violeta Serena"
// -------------------------------------------------------------------------
// Campo translúcido que soporta input / textarea / select vía la prop `as`.
// Trae label superior asociado por htmlFor, estado de error/ayuda con aria,
// e iconos opcionales a izquierda (icon) y derecha (endIcon).
//
// API común de la librería ui/:
//   - forwardRef → reenvía la ref al control real (input/textarea/select).
//   - default export del componente.
//   - className SIEMPRE al final del join (el usuario puede sobrescribir).
//   - ...rest passthrough al control.
//
// Robustez (en el .module.css):
//   - -webkit-backdrop-filter junto a backdrop-filter.
//   - fallback @supports a fondo sólido (Capacitor/Android).
//   - @media (prefers-reduced-motion: reduce) sin transiciones.
//   - font-size 16px en móvil para evitar el zoom de iOS.
// =========================================================================

import React, { forwardRef, useId } from 'react';
import styles from './GlassInput.module.css';

/**
 * Campo de formulario glass.
 *
 * @param {'input'|'textarea'|'select'} [as='input'] Tipo de control a renderizar.
 * @param {string} [label] Etiqueta superior asociada por htmlFor.
 * @param {string|boolean} [error] Mensaje de error (string) o solo el estado (true).
 * @param {string} [hint] Texto de ayuda discreto bajo el control.
 * @param {React.ReactNode} [icon] Nodo decorativo a la izquierda (prefijo).
 * @param {React.ReactNode} [endIcon] Nodo decorativo a la derecha (sufijo).
 * @param {string} [id] Id del control; se autogenera 'gi-…' si falta.
 * @param {string} [className] Clases extra para el wrapper (al final del join).
 */
const GlassInput = forwardRef(function GlassInput(
  {
    as = 'input',
    label,
    error,
    hint,
    icon,
    endIcon,
    id,
    className,
    children,
    ...rest
  },
  ref,
) {
  // Id estable autogenerado si el consumidor no provee uno (para label/aria).
  const reactId = useId();
  const controlId = id || `gi-${reactId}`;

  // El control real depende de `as`. Para select reenviamos children (las opciones).
  const Control = as;
  const isTextarea = as === 'textarea';
  const isSelect = as === 'select';

  // Hay error si llega un string no vacío o un booleano true.
  const hasError = error === true || (typeof error === 'string' && error.length > 0);
  // El mensaje visible bajo el control: prioriza el error textual sobre el hint.
  const errorText = typeof error === 'string' ? error : '';
  const messageText = errorText || hint || '';

  // Ids para describir el control (aria-describedby) según lo que haya.
  const messageId = messageText ? `${controlId}-msg` : undefined;

  // Clases del campo (la "caja" glass que envuelve icono + control + sufijo).
  const fieldClass = [
    styles.field,
    isTextarea && styles.fieldTextarea,
    hasError && styles.error,
    icon && styles.hasIcon,
    endIcon && styles.hasEndIcon,
  ]
    .filter(Boolean)
    .join(' ');

  // Clase del mensaje: tono de error o tono de ayuda.
  const messageClass = [styles.message, hasError && styles.messageError]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={controlId}>
          {label}
        </label>
      )}

      <div className={fieldClass}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}

        {/* input es un elemento void: nunca recibe children (evita warnings de
            React). textarea/select sí reenvían children (opciones, contenido). */}
        {as === 'input' ? (
          <Control
            ref={ref}
            id={controlId}
            className={styles.control}
            aria-invalid={hasError || undefined}
            aria-describedby={messageId}
            {...rest}
          />
        ) : (
          <Control
            ref={ref}
            id={controlId}
            className={[styles.control, isSelect && styles.controlSelect]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={hasError || undefined}
            aria-describedby={messageId}
            {...rest}
          >
            {children}
          </Control>
        )}

        {endIcon && (
          <span className={styles.endIcon} aria-hidden="true">
            {endIcon}
          </span>
        )}
      </div>

      {messageText && (
        <p id={messageId} className={messageClass}>
          {messageText}
        </p>
      )}
    </div>
  );
});

export default GlassInput;
