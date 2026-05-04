import React, { useState, useCallback } from 'react';
import styles from './Toggle.module.css';

/**
 * Componente Toggle Switch profesional inspirado en Shopify
 * 
 * @param {boolean} checked - Estado inicial del toggle
 * @param {function} onChange - Callback cuando cambia el estado
 * @param {string} size - Tamaño: 'small', 'medium', 'large'
 * @param {boolean} disabled - Si está deshabilitado
 * @param {string} label - Etiqueta opcional
 * @param {string} id - ID único para accesibilidad
 */
const Toggle = ({
  checked = false,
  onChange,
  size = 'medium',
  disabled = false,
  label,
  id,
  className = '',
  ...props
}) => {
  const [isChecked, setIsChecked] = useState(checked);
  const [isAnimating, setIsAnimating] = useState(false);

  // Sincronizar con prop checked cuando cambia externamente
  React.useEffect(() => {
    setIsChecked(checked);
  }, [checked]);

  const handleToggle = useCallback((e) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsAnimating(true);
    const newValue = !isChecked;
    
    // Optimistic update
    setIsChecked(newValue);
    
    // Callback con timeout para permitir animación
    setTimeout(() => {
      if (onChange) {
        onChange(newValue, e);
      }
      setIsAnimating(false);
    }, 150);
  }, [isChecked, disabled, onChange]);

  const handleKeyDown = useCallback((e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e);
    }
  }, [disabled, handleToggle]);

  const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`${styles.toggleWrapper} ${className}`}>
      {label && (
        <label htmlFor={toggleId} className={styles.label}>
          {label}
        </label>
      )}
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-label={label || (isChecked ? 'Activado' : 'Desactivado')}
        className={`
          ${styles.toggle}
          ${styles[size]}
          ${isChecked ? styles.checked : ''}
          ${disabled ? styles.disabled : ''}
          ${isAnimating ? styles.animating : ''}
        `}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        {...props}
      >
        <span className={styles.track}>
          <span className={styles.thumb} />
        </span>
      </button>
    </div>
  );
};

export default React.memo(Toggle);
