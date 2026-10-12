import React, { useId } from 'react';
import { AlertCircle, Minus, Plus, Check } from 'lucide-react';
import s from './Formulario.module.css';

/** Campo de texto con etiqueta, ayuda y error accesibles. */
export function Campo({ etiqueta, ayuda, error, icono, sufijo, id, ...input }) {
  const autoId = useId();
  const campoId = id || autoId;
  const ayudaId = `${campoId}-ayuda`;
  return (
    <div className={s.campo}>
      {etiqueta && <label htmlFor={campoId} className={s.etiqueta}>{etiqueta}</label>}
      <div className={[s.control, error && s.conError, icono && s.conIcono].filter(Boolean).join(' ')}>
        {icono && <span className={s.icono} aria-hidden="true">{icono}</span>}
        <input
          id={campoId}
          className={s.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || ayuda ? ayudaId : undefined}
          {...input}
        />
        {sufijo && <span className={s.sufijo}>{sufijo}</span>}
      </div>
      {error ? (
        <p id={ayudaId} className={s.error}><AlertCircle aria-hidden="true" />{error}</p>
      ) : ayuda ? (
        <p id={ayudaId} className={s.ayuda}>{ayuda}</p>
      ) : null}
    </div>
  );
}

/** Selector de talla. Las agotadas se ven tachadas y no se pueden elegir. */
export function SelectorTalla({ tallas, valor, onChange, agotadas = [], guia }) {
  return (
    <fieldset className={s.grupo}>
      <legend className={s.leyenda}>
        <span>Talla{valor && <strong>: {valor}</strong>}</span>
        {guia && <button type="button" className={s.enlace} onClick={guia}>Guía de tallas</button>}
      </legend>
      <div className={s.tallas} role="radiogroup">
        {tallas.map((t) => {
          const agotada = agotadas.includes(t);
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={valor === t}
              disabled={agotada}
              className={[s.talla, valor === t && s.tallaActiva, agotada && s.tallaAgotada].filter(Boolean).join(' ')}
              onClick={() => onChange(t)}
              title={agotada ? `${t} agotada` : undefined}
            >
              {t}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Selector de color con el nombre visible del color elegido. */
export function SelectorColor({ colores, valor, onChange }) {
  const actual = colores.find((c) => c.nombre === valor);
  return (
    <fieldset className={s.grupo}>
      <legend className={s.leyenda}>
        <span>Color{actual && <strong>: {actual.nombre}</strong>}</span>
      </legend>
      <div className={s.colores} role="radiogroup">
        {colores.map((c) => (
          <button
            key={c.nombre}
            type="button"
            role="radio"
            aria-checked={valor === c.nombre}
            aria-label={c.nombre}
            className={[s.color, valor === c.nombre && s.colorActivo].filter(Boolean).join(' ')}
            style={{ '--muestra': c.hex }}
            onClick={() => onChange(c.nombre)}
          >
            {valor === c.nombre && <Check aria-hidden="true" className={c.claro ? s.checkOscuro : undefined} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Cantidad con − / +. */
export function Cantidad({ valor, onChange, min = 1, max = 99, tamano = 'md' }) {
  return (
    <div className={[s.cantidad, tamano === 'sm' && s.cantidadSm].filter(Boolean).join(' ')}>
      <button type="button" aria-label="Quitar uno" disabled={valor <= min} onClick={() => onChange(valor - 1)}>
        <Minus aria-hidden="true" />
      </button>
      <output aria-live="polite">{valor}</output>
      <button type="button" aria-label="Agregar uno" disabled={valor >= max} onClick={() => onChange(valor + 1)}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

/** Interruptor encendido/apagado. */
export function Interruptor({ activo, onChange, etiqueta, descripcion }) {
  const id = useId();
  return (
    <label className={s.interruptor} htmlFor={id}>
      <span className={s.interruptorTexto}>
        <span>{etiqueta}</span>
        {descripcion && <small>{descripcion}</small>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={activo} onChange={(e) => onChange(e.target.checked)} />
      <span className={s.pista} aria-hidden="true"><span className={s.perilla} /></span>
    </label>
  );
}
