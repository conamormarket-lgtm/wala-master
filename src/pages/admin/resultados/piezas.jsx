import React from 'react';
import { PLACEHOLDER_IMG } from '../../../constants/placeholder';
import styles from './piezas.module.css';

/* Piezas comunes de las pestañas de Resultados: tarjeta, lista con barras,
   cifras sueltas y aviso de "sin datos". Planas y con colores de tema. */

export function Tarjeta({ titulo, ayuda, acciones, id, children, className = '' }) {
  return (
    <section className={`${styles.tarjeta} ${className}`} aria-labelledby={id}>
      {(titulo || acciones) && (
        <div className={styles.cabecera}>
          {titulo && <h2 id={id} className={styles.titulo}>{titulo}</h2>}
          {acciones}
        </div>
      )}
      {ayuda && <p className={styles.ayuda}>{ayuda}</p>}
      {children}
    </section>
  );
}

export function Columnas({ children }) {
  return <div className={styles.columnas}>{children}</div>;
}

export function Vacio({ children }) {
  return <p className={styles.vacio}>{children}</p>;
}

/**
 * Lista ordenada con barra proporcional al mayor valor.
 * filas: [{ id, label, valor, texto?, sub?, imagen? }]
 */
export function Barras({ filas = [], formato = (v) => v, vacio = 'Sin datos en este periodo.', max = 10, color }) {
  const lista = filas.filter((f) => Number(f.valor) > 0).slice(0, max);
  if (!lista.length) return <Vacio>{vacio}</Vacio>;
  const tope = Math.max(...lista.map((f) => Number(f.valor) || 0)) || 1;
  return (
    <ol className={styles.barras}>
      {lista.map((f) => (
        <li key={f.id ?? f.label} className={styles.fila}>
          {f.imagen !== undefined && (
            <img
              src={f.imagen || PLACEHOLDER_IMG}
              alt=""
              className={styles.miniatura}
              loading="lazy"
              onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
            />
          )}
          <div className={styles.filaCuerpo}>
            <div className={styles.filaTexto}>
              <span className={styles.etiqueta} title={f.label}>{f.label}</span>
              <span className={styles.valor}>{f.texto ?? formato(f.valor)}</span>
            </div>
            <span className={styles.pista} aria-hidden="true">
              <span
                className={styles.relleno}
                style={{ width: `${Math.max(3, Math.round(((Number(f.valor) || 0) / tope) * 100))}%`, ...(color ? { background: color } : {}) }}
              />
            </span>
            {f.sub && <span className={styles.sub}>{f.sub}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Cifras sueltas en fila: [{ label, valor, sub? }] */
export function Cifras({ items = [] }) {
  return (
    <dl className={styles.cifras}>
      {items.map((c) => (
        <div key={c.label} className={styles.cifra}>
          <dt>{c.label}</dt>
          <dd>{c.valor}</dd>
          {c.sub && <span className={styles.cifraSub}>{c.sub}</span>}
        </div>
      ))}
    </dl>
  );
}

/** Interruptor de dos o más opciones: [{ id, label }] */
export function Interruptor({ opciones, valor, onChange, etiqueta }) {
  return (
    <div className={styles.interruptor} role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={valor === o.id}
          className={valor === o.id ? styles.opcionActiva : styles.opcion}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
