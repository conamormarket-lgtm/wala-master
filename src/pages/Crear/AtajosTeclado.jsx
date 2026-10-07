import React from 'react';
import { Keyboard, X } from 'lucide-react';
import styles from './AtajosTeclado.module.css';

const esMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');

/** Tecla modificadora del sistema: ⌘ en Mac, Ctrl en Windows/Linux. */
export const MOD = esMac ? '⌘' : 'Ctrl';

const Tecla = ({ children }) => <kbd className={styles.tecla}>{children}</kbd>;

const combinacion = (teclas) => teclas.map((t, i) => (
  <React.Fragment key={t}>
    {i > 0 && <span className={styles.mas}>+</span>}
    <Tecla>{t}</Tecla>
  </React.Fragment>
));

const grupos = (vistas) => [
  {
    titulo: 'General',
    atajos: [
      { teclas: [[MOD, 'Z']], texto: 'Deshacer' },
      { teclas: [[MOD, 'Y'], [MOD, 'Shift', 'Z']], texto: 'Rehacer' },
      { teclas: [[MOD, 'S']], texto: 'Guardar' },
      { teclas: [['T']], texto: 'Agregar texto' },
      { teclas: [['I']], texto: 'Subir imagen' },
      { teclas: [[MOD, 'V']], texto: 'Pegar una imagen copiada, un texto o lo que copiaste' },
      ...(vistas.length > 1
        ? [{ teclas: [vistas.slice(0, 9).map((_, i) => String(i + 1))], texto: vistas.slice(0, 9).map((v) => v.nombre).join(' / '), juntas: true }]
        : []),
      { teclas: [['?']], texto: 'Ver estos atajos' },
    ],
  },
  {
    titulo: 'Con algo elegido',
    atajos: [
      { teclas: [['←', '↑', '→', '↓']], texto: 'Mover (con Shift, más rápido)', juntas: true },
      { teclas: [['+'], ['-']], texto: 'Agrandar / achicar' },
      { teclas: [['R']], texto: 'Girar (Shift+R al otro lado)' },
      { teclas: [['C']], texto: 'Centrar en la zona' },
      { teclas: [['F']], texto: 'Voltear imagen' },
      { teclas: [[']'], ['[']], texto: 'Adelante / atrás' },
      { teclas: [[MOD, 'D']], texto: 'Duplicar' },
      { teclas: [[MOD, 'C'], [MOD, 'X']], texto: 'Copiar / cortar' },
      { teclas: [['Supr']], texto: 'Quitar' },
      { teclas: [['Esc']], texto: 'Soltar la selección' },
    ],
  },
  {
    titulo: 'Con el mouse',
    atajos: [
      { teclas: [['Doble clic']], texto: 'En un texto: escribir sobre la prenda' },
      { teclas: [['Doble clic']], texto: 'En la zona vacía: texto nuevo ahí' },
      { teclas: [['Doble clic']], texto: 'En una imagen: recortar' },
      { teclas: [['Clic derecho']], texto: 'Más opciones' },
      { teclas: [[MOD, 'Rueda']], texto: 'Agrandar / achicar lo elegido' },
      { teclas: [['Shift']], texto: 'Al girar: de 15° en 15°' },
      { teclas: [['Alt']], texto: 'Al arrastrar: sin imán al centro' },
    ],
  },
];

/** Ventana con los atajos de teclado del estudio (se abre con "?" o el botón Atajos). */
const AtajosTeclado = ({ vistas = [], onCerrar }) => (
  <div className={styles.capa} role="dialog" aria-modal="true" aria-labelledby="atajos-titulo" onClick={onCerrar}>
    <div className={styles.caja} onClick={(e) => e.stopPropagation()}>
      <div className={styles.cabecera}>
        <h2 id="atajos-titulo" className={styles.titulo}>
          <Keyboard size={20} aria-hidden="true" /> Atajos de teclado
        </h2>
        <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.grupos}>
        {grupos(vistas).map((g) => (
          <section key={g.titulo}>
            <h3 className={styles.grupoTitulo}>{g.titulo}</h3>
            <ul className={styles.lista}>
              {g.atajos.map((a) => (
                <li key={a.texto} className={styles.fila}>
                  <span>{a.texto}</span>
                  <span className={styles.teclas}>
                    {a.teclas.map((t, i) => (
                      <React.Fragment key={t.join('+')}>
                        {i > 0 && <span className={styles.o}>o</span>}
                        {a.juntas ? t.map((k) => <Tecla key={k}>{k}</Tecla>) : combinacion(t)}
                      </React.Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className={styles.nota}>
        También puedes arrastrar una imagen desde tu computadora y soltarla sobre la prenda.
      </p>
    </div>
  </div>
);

export default AtajosTeclado;
