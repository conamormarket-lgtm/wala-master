import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './MenuContextual.module.css';

/**
 * Menú del clic derecho del estudio. `items` es una lista de
 * { id, etiqueta, icono, atajo, peligro, deshabilitado, accion } o el texto
 * 'separador'. Se cierra al elegir, con Esc, al hacer clic afuera o al
 * desplazar la página. Las flechas recorren las opciones.
 */
const MenuContextual = ({ x, y, items, onCerrar }) => {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Que no se salga de la pantalla: si no entra, se abre hacia el otro lado.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margen = 8;
    setPos({
      left: x + width + margen > window.innerWidth ? Math.max(margen, x - width) : x,
      top: y + height + margen > window.innerHeight ? Math.max(margen, y - height) : y,
    });
    // Después del clic que lo abrió (que se queda con el foco), la primera opción.
    const cuadro = requestAnimationFrame(() => el.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(cuadro);
  }, [x, y]);

  useEffect(() => {
    const fuera = (e) => { if (!menuRef.current?.contains(e.target)) onCerrar(); };
    const cerrar = () => onCerrar();
    const conEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); onCerrar(); } };
    window.addEventListener('keydown', conEsc);
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    window.addEventListener('blur', cerrar);
    return () => {
      window.removeEventListener('keydown', conEsc);
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('blur', cerrar);
    };
  }, [onCerrar]);

  const alTeclear = (e) => {
    const botones = [...menuRef.current.querySelectorAll('button:not(:disabled)')];
    const i = botones.indexOf(document.activeElement);
    if (e.key === 'Tab') {
      e.preventDefault();
      onCerrar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      botones[(i + 1) % botones.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      botones[(i - 1 + botones.length) % botones.length]?.focus();
    }
  };

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      onKeyDown={alTeclear}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (item === 'separador' ? (
        // eslint-disable-next-line react/no-array-index-key
        <div key={`sep-${i}`} className={styles.separador} role="separator" />
      ) : (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`${styles.opcion} ${item.peligro ? styles.peligro : ''}`}
          disabled={item.deshabilitado}
          onClick={() => {
            onCerrar();
            item.accion();
          }}
        >
          {item.icono && <item.icono size={16} aria-hidden="true" />}
          <span className={styles.etiqueta}>{item.etiqueta}</span>
          {item.atajo && <kbd className={styles.atajo}>{item.atajo}</kbd>}
        </button>
      )))}
    </div>
  );
};

export default MenuContextual;
