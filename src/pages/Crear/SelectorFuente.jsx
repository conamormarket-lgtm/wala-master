import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { FUENTES } from './renderDiseno';
import styles from './SelectorFuente.module.css';

// Agrupadas por cómo se ven: el cliente busca "una letra gruesa" o "una
// escrita a mano", no un nombre de fuente. Las que no estén aquí van a "Otras".
const GRUPOS = [
  { nombre: 'Simples', fuentes: ['Montserrat', 'Rubik', 'Kanit'] },
  { nombre: 'Gruesas', fuentes: ['Bebas Neue', 'Anton', 'Oswald', 'Righteous'] },
  { nombre: 'Elegantes', fuentes: ['Playfair Display', 'Libre Baskerville'] },
  { nombre: 'Escritas a mano', fuentes: ['Pacifico', 'Lobster', 'Dancing Script', 'Great Vibes', 'Permanent Marker', 'Caveat'] },
];

const gruposDisponibles = () => {
  const agrupadas = new Set(GRUPOS.flatMap((g) => g.fuentes));
  const grupos = GRUPOS
    .map((g) => ({ ...g, fuentes: g.fuentes.filter((f) => FUENTES.includes(f)) }))
    .filter((g) => g.fuentes.length);
  const otras = FUENTES.filter((f) => !agrupadas.has(f));
  return otras.length ? [...grupos, { nombre: 'Otras', fuentes: otras }] : grupos;
};

const conFuente = (f) => ({ fontFamily: `"${f}", sans-serif` });

/** El primer contenedor que se desplaza por dentro (el panel del estudio). */
const contenedorConScroll = (el) => {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
};

/**
 * Selector de la letra de un texto: un botón con la letra elegida que abre
 * la lista completa, cada una escrita en su propia letra y agrupadas por
 * estilo. Antes era una fila que se deslizaba de lado y no se veía todo.
 */
const SelectorFuente = ({ valor, onCambiar }) => {
  const [abierto, setAbierto] = useState(false);
  const cajaRef = useRef(null);
  const listaRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const alTocarAfuera = (e) => {
      if (!cajaRef.current?.contains(e.target)) setAbierto(false);
    };
    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setAbierto(false);
      }
    };
    document.addEventListener('pointerdown', alTocarAfuera);
    document.addEventListener('keydown', alTeclear, true);
    // Que la lista se vea entera: el selector sube al borde de arriba del
    // panel (si no, el pie con la compra la tapaba) y se ve la letra elegida.
    // Solo se desplaza el panel (scrollIntoView movía también la página).
    const caja = cajaRef.current;
    const panel = contenedorConScroll(caja);
    if (caja && panel) {
      const subir = caja.getBoundingClientRect().top - panel.getBoundingClientRect().top - 8;
      panel.scrollBy({ top: subir, behavior: 'smooth' });
    }
    const elegida = listaRef.current?.querySelector('[aria-selected="true"]');
    if (elegida && listaRef.current) listaRef.current.scrollTop = elegida.offsetTop - 40;
    return () => {
      document.removeEventListener('pointerdown', alTocarAfuera);
      document.removeEventListener('keydown', alTeclear, true);
    };
  }, [abierto]);

  const elegir = (f) => {
    onCambiar(f);
    setAbierto(false);
  };

  return (
    <div ref={cajaRef} className={styles.caja}>
      <button
        type="button"
        className={`${styles.boton} ${abierto ? styles.botonAbierto : ''}`}
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Letra: ${valor}. Cambiar`}
      >
        <span className={styles.muestra} style={conFuente(valor)}>{valor}</span>
        <span className={styles.cambiar}>Cambiar</span>
        <ChevronDown size={18} className={styles.flecha} aria-hidden="true" />
      </button>

      {abierto && (
        <div ref={listaRef} className={styles.lista} role="listbox" aria-label="Elige la letra">
          {gruposDisponibles().map((g) => (
            <div key={g.nombre} role="group" aria-label={g.nombre}>
              <span className={styles.grupo}>{g.nombre}</span>
              {g.fuentes.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="option"
                  aria-selected={f === valor}
                  className={`${styles.opcion} ${f === valor ? styles.opcionActiva : ''}`}
                  onClick={() => elegir(f)}
                >
                  <span style={conFuente(f)}>{f}</span>
                  {f === valor && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SelectorFuente;
