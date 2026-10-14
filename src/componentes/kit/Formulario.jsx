import React, { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Minus, Plus, Check, Search, ChevronDown } from 'lucide-react';
import Boton from './Boton';
import s from './Formulario.module.css';

/**
 * Campo de texto con etiqueta, ayuda y error accesibles. El error entra con una sacudida.
 *  - opciones: [{ valor, texto }] lo vuelve una lista desplegable (<select>) con
 *    el mismo aspecto (documento, ciudad, país…); en el celular abre la del teléfono
 */
export function Campo({ etiqueta, ayuda, error, icono, sufijo, id, opciones, ...input }) {
  const autoId = useId();
  const campoId = id || autoId;
  const ayudaId = `${campoId}-ayuda`;
  return (
    <div className={s.campo}>
      {etiqueta && <label htmlFor={campoId} className={s.etiqueta}>{etiqueta}</label>}
      <div className={[s.control, error && s.conError, icono && s.conIcono].filter(Boolean).join(' ')}>
        {icono && <span className={s.icono} aria-hidden="true">{icono}</span>}
        {opciones ? (
          <select
            id={campoId}
            className={`${s.input} ${s.inputLista}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || ayuda ? ayudaId : undefined}
            {...input}
          >
            {opciones.map((o) => <option key={o.valor} value={o.valor} disabled={o.deshabilitada}>{o.texto}</option>)}
          </select>
        ) : (
          <input
            id={campoId}
            className={s.input}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || ayuda ? ayudaId : undefined}
            {...input}
          />
        )}
        {opciones && <ChevronDown className={s.flechaLista} aria-hidden="true" />}
        {sufijo && <span className={s.sufijo}>{sufijo}</span>}
        <span className={s.brilloFoco} aria-hidden="true" />
      </div>
      {error ? (
        <p id={ayudaId} className={s.error}><AlertCircle aria-hidden="true" />{error}</p>
      ) : ayuda ? (
        <p id={ayudaId} className={s.ayuda}>{ayuda}</p>
      ) : null}
    </div>
  );
}

/**
 * Selector de opción (talla, medida, número, modelo…). La elegida se pinta
 * de violeta al instante; las agotadas van tachadas. `etiqueta` cambia el
 * título ("Talla" por defecto).
 */
export function SelectorTalla({ tallas, valor, onChange, agotadas = [], guia, etiqueta = 'Talla' }) {
  return (
    <fieldset className={s.grupo}>
      <legend className={s.leyenda}>
        <span>{etiqueta}{valor && <strong>: {valor}</strong>}</span>
        {guia && <button type="button" className={s.enlace} onClick={guia}>Guía de tallas</button>}
      </legend>
      <div className={s.tallas} role="radiogroup">
        {tallas.map((t) => {
          const agotada = agotadas.includes(t);
          const activa = valor === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={activa}
              disabled={agotada}
              className={[s.talla, activa && s.tallaActiva, agotada && s.tallaAgotada].filter(Boolean).join(' ')}
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
export function SelectorColor({ colores, valor, onChange, etiqueta = 'Color' }) {
  const actual = colores.find((c) => c.nombre === valor);
  return (
    <fieldset className={s.grupo}>
      <legend className={s.leyenda}>
        <span>
          {etiqueta}
          <AnimatePresence mode="wait" initial={false}>
            {actual && (
              <motion.strong
                key={actual.nombre}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                style={{ display: 'inline-block' }}
              >
                : {actual.nombre}
              </motion.strong>
            )}
          </AnimatePresence>
        </span>
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

/** Cantidad con − / +. El número rueda hacia arriba o abajo según el cambio. */
export function Cantidad({ valor, onChange, min = 1, max = 99, tamano = 'md' }) {
  const previo = useRef(valor);
  const sube = valor >= previo.current;
  useEffect(() => { previo.current = valor; }, [valor]);
  return (
    <div className={[s.cantidad, tamano === 'sm' && s.cantidadSm].filter(Boolean).join(' ')}>
      <button type="button" aria-label="Quitar uno" disabled={valor <= min} onClick={() => onChange(valor - 1)}>
        <Minus aria-hidden="true" />
      </button>
      <output aria-live="polite" className={s.cantidadValor}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={valor}
            initial={{ y: sube ? 16 : -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: sube ? -16 : 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {valor}
          </motion.span>
        </AnimatePresence>
      </output>
      <button type="button" aria-label="Agregar uno" disabled={valor >= max} onClick={() => onChange(valor + 1)}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

/** Interruptor encendido/apagado; la perilla se estira al presionarla. */
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

/**
 * Buscador (cabecera, tienda, admin). Se ilumina al enfocarlo y, con
 * `atajo`, la tecla "/" lo enfoca desde cualquier parte de la página.
 *  - onBuscar(texto) al presionar Enter.
 *  - boton: texto de un botón "Buscar" al final (página de búsqueda)
 *  - grande: más alto y a todo el ancho (no crece al enfocarlo)
 *  - inputRef: para leer o enfocar el campo desde fuera
 */
export function Buscador({ placeholder = 'Buscar…', atajo = '/', onBuscar, defaultValue = '', className, boton, grande = false, inputRef, ...input }) {
  const propio = useRef(null);
  const ref = inputRef || propio;

  useEffect(() => {
    if (!atajo) return undefined;
    const alTeclear = (e) => {
      if (e.key !== atajo || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [atajo]);

  return (
    <form
      role="search"
      className={[s.buscador, grande && s.buscadorGrande, className].filter(Boolean).join(' ')}
      onSubmit={(e) => { e.preventDefault(); onBuscar?.(ref.current.value.trim()); }}
    >
      <Search aria-hidden="true" />
      <input ref={ref} type="search" placeholder={placeholder} aria-label={placeholder} defaultValue={input.value === undefined ? defaultValue : undefined} {...input} />
      {atajo && <kbd aria-hidden="true">{atajo}</kbd>}
      {boton && <Boton type="submit" className={s.buscadorBoton}>{boton}</Boton>}
    </form>
  );
}

/**
 * Selector de una opción (ordenar, filtrar). Es el <select> del navegador
 * con el estilo de Walá: en el celular abre el selector propio del teléfono.
 *  - etiqueta: texto a la izquierda ("Ordenar por")
 *  - opciones: [{ valor, texto }] · valor · onCambiar(valor)
 */
export function Selector({ etiqueta, opciones = [], valor, onCambiar, className, id }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <span className={[s.selector, className].filter(Boolean).join(' ')}>
      {etiqueta && <label htmlFor={selectId} className={s.selectorEtiqueta}>{etiqueta}</label>}
      <span className={s.selectorCaja}>
        <select id={selectId} value={valor} onChange={(e) => onCambiar?.(e.target.value)}>
          {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
    </span>
  );
}
