import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

/* =========================================================================
   ThemeToggle — Interruptor luna/sol del Modo Noche
   -------------------------------------------------------------------------
   Botón accesible que alterna entre claro y oscuro (useTheme().toggle()).
   - En tema CLARO muestra la luna (acción: "ir a oscuro").
   - En tema OSCURO muestra el sol (acción: "ir a claro").
   Se coloca en el Header (mismo nodo sirve para desktop y móvil; el CSS del
   header ya es responsive). No afecta layout ni lógica de pedidos/pagos.
   ========================================================================= */
const ThemeToggle = ({ className = '' }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button
      type="button"
      onClick={toggle}
      className={`${styles.toggle} ${className}`}
      aria-label={label}
      title={label}
      // aria-pressed comunica a lectores de pantalla si el modo oscuro está activo.
      aria-pressed={isDark}
    >
      {isDark ? (
        <Sun strokeWidth={1.75} className={styles.icon} aria-hidden="true" />
      ) : (
        <Moon strokeWidth={1.75} className={styles.icon} aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;
