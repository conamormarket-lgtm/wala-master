import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, Sparkles } from 'lucide-react';
import { textoSobre } from '../../utils/prendaBase';
import styles from './EfectosTexto.module.css';

const COLORES = ['#FFFFFF', '#111111', '#7C3AED', '#E11D48', '#F59E0B', '#10B981', '#2563EB', '#F472B6'];

/** Blanco o negro, el que más resalta junto al color de la letra. */
const contrasteDe = (hex) => (textoSobre(hex || '#111111') === '#FFFFFF' ? '#FFFFFF' : '#111111');

// Estilos de un toque. Todos se imprimen bien (sin degradados ni desenfoques).
const ESTILOS = [
  { id: 'normal', nombre: 'Normal', cambios: () => ({ contorno: 0, sombra: 0, curva: 0, espaciado: 0 }) },
  { id: 'contorno', nombre: 'Contorno', cambios: (c) => ({ contorno: 8, contornoColor: contrasteDe(c.color), sombra: 0 }) },
  { id: 'sombra', nombre: 'Sombra', cambios: (c) => ({ sombra: 6, sombraColor: contrasteDe(c.color), contorno: 0 }) },
  { id: 'arco', nombre: 'Arco', cambios: () => ({ curva: 45 }) },
  { id: 'sticker', nombre: 'Sticker', cambios: () => ({ contorno: 14, contornoColor: '#FFFFFF', sombra: 5, sombraColor: '#111111' }) },
];

const Deslizador = ({ etiqueta, valor, min, max, paso = 1, formato, onChange }) => (
  <label className={styles.deslizador}>
    <span className={styles.deslizadorFila}>
      <span>{etiqueta}</span>
      <output>{formato ? formato(valor) : valor}</output>
    </span>
    <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

const Colores = ({ etiqueta, valor, onChange }) => (
  <div className={styles.colores} role="radiogroup" aria-label={etiqueta}>
    {COLORES.map((c) => (
      <button
        key={c}
        type="button"
        role="radio"
        aria-checked={valor?.toUpperCase() === c}
        aria-label={`${etiqueta}: ${c}`}
        className={`${styles.color} ${valor?.toUpperCase() === c ? styles.colorActivo : ''}`}
        style={{ background: c }}
        onClick={() => onChange(c)}
      />
    ))}
    <label className={styles.colorLibre} aria-label={`${etiqueta}: otro color`}>
      <input type="color" value={valor || '#FFFFFF'} onChange={(e) => onChange(e.target.value)} />
    </label>
  </div>
);

const Efecto = ({ titulo, activo, onActivar, children }) => (
  <div className={`${styles.efecto} ${activo ? styles.efectoActivo : ''}`}>
    <label className={styles.efectoCabecera}>
      <span>{titulo}</span>
      <input
        type="checkbox"
        role="switch"
        className={styles.interruptor}
        checked={activo}
        onChange={(e) => onActivar(e.target.checked)}
      />
    </label>
    {activo && <div className={styles.efectoCuerpo}>{children}</div>}
  </div>
);

/**
 * Efectos del texto en el panel del estudio: estilos de un toque, contorno,
 * sombra, curva, espacio entre letras y, con varias líneas, alineación e
 * interlineado. `onCambiar(cambios)` los aplica a la capa.
 */
const EfectosTexto = ({ capa, onCambiar }) => {
  const contorno = Number(capa.contorno) || 0;
  const sombra = Number(capa.sombra) || 0;
  const curva = Number(capa.curva) || 0;
  const espaciado = Number(capa.espaciado) || 0;
  const variasLineas = /\n/.test(capa.text || '') && !curva;
  const alineacion = capa.alineacion || 'center';

  return (
    <details className={styles.efectos} open>
      <summary className={styles.resumen}>
        <Sparkles size={16} aria-hidden="true" /> Efectos del texto
      </summary>

      <div className={styles.estilos} aria-label="Estilos rápidos">
        {ESTILOS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`${styles.estilo} ${styles[`estilo_${e.id}`]}`}
            onClick={() => onCambiar(e.cambios(capa))}
          >
            {e.nombre}
          </button>
        ))}
      </div>

      <Efecto
        titulo="Contorno"
        activo={contorno > 0}
        onActivar={(on) => onCambiar(on
          ? { contorno: 8, contornoColor: capa.contornoColor || contrasteDe(capa.color) }
          : { contorno: 0 })}
      >
        <Colores etiqueta="Color del contorno" valor={capa.contornoColor || '#FFFFFF'} onChange={(v) => onCambiar({ contornoColor: v })} />
        <Deslizador etiqueta="Grosor" valor={contorno} min={1} max={25} onChange={(v) => onCambiar({ contorno: v })} />
      </Efecto>

      <Efecto
        titulo="Sombra"
        activo={sombra > 0}
        onActivar={(on) => onCambiar(on
          ? { sombra: 6, sombraColor: capa.sombraColor || contrasteDe(capa.color) }
          : { sombra: 0 })}
      >
        <Colores etiqueta="Color de la sombra" valor={capa.sombraColor || '#111111'} onChange={(v) => onCambiar({ sombraColor: v })} />
        <Deslizador etiqueta="Distancia" valor={sombra} min={1} max={20} onChange={(v) => onCambiar({ sombra: v })} />
      </Efecto>

      <div className={styles.efecto}>
        <Deslizador
          etiqueta="Curva"
          valor={curva}
          min={-100}
          max={100}
          formato={(v) => (v === 0 ? 'Recta' : v > 0 ? `Arco ${v}` : `Hacia abajo ${-v}`)}
          // Cerca del medio se queda recta: fácil de volver a 0.
          onChange={(v) => onCambiar({ curva: Math.abs(v) < 5 ? 0 : v })}
        />
        {curva !== 0 && (
          <button type="button" className={styles.enderezar} onClick={() => onCambiar({ curva: 0 })}>Enderezar</button>
        )}
      </div>

      <div className={styles.efecto}>
        <Deslizador
          etiqueta="Espacio entre letras"
          valor={espaciado}
          min={-100}
          max={800}
          paso={10}
          formato={(v) => (v === 0 ? 'Normal' : v > 0 ? `+${v}` : v)}
          onChange={(v) => onCambiar({ espaciado: v })}
        />
      </div>

      {variasLineas && (
        <div className={styles.efecto}>
          <div className={styles.alineacion} role="radiogroup" aria-label="Alineación">
            {[['left', AlignLeft, 'Izquierda'], ['center', AlignCenter, 'Centro'], ['right', AlignRight, 'Derecha']].map(([valor, Icono, nombre]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={alineacion === valor}
                aria-label={nombre}
                title={nombre}
                className={`${styles.alinear} ${alineacion === valor ? styles.alinearActivo : ''}`}
                onClick={() => onCambiar({ alineacion: valor })}
              >
                <Icono size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
          <Deslizador
            etiqueta="Interlineado"
            valor={Number(capa.interlineado) || 1.05}
            min={0.7}
            max={2}
            paso={0.05}
            formato={(v) => v.toFixed(2)}
            onChange={(v) => onCambiar({ interlineado: v })}
          />
        </div>
      )}
    </details>
  );
};

export default EfectosTexto;
