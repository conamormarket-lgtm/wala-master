import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Minus, Plus, Check, Search, ChevronDown, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import Boton from './Boton';
import ListaOpciones from './ListaOpciones';
import s from './Formulario.module.css';

/**
 * Campo de texto con etiqueta, ayuda y error accesibles. El error entra con una sacudida.
 *  - opciones: [{ valor, texto, detalle, icono }] lo vuelve una lista
 *    desplegable de Walá (ListaOpciones: panel en escritorio, hoja en el
 *    celular), con `buscable` (más de 10 opciones: sí) y `creable` (acepta lo
 *    escrito). `nativo`: el <select> del navegador.
 *  - control: ({ id, aria-invalid, aria-describedby }) => nodo, otro control
 *    dentro de la misma caja (CampoFecha, CampoTelefono)
 */
export function Campo({ etiqueta, ayuda, error, icono, sufijo, id, opciones, nativo = false, buscable, creable, control, ...input }) {
  const autoId = useId();
  const campoId = id || autoId;
  const ayudaId = `${campoId}-ayuda`;
  const aria = { 'aria-invalid': error ? true : undefined, 'aria-describedby': error || ayuda ? ayudaId : undefined };
  let cuerpo;
  if (control) {
    cuerpo = control({ id: campoId, ...aria });
  } else if (opciones && !nativo) {
    cuerpo = (
      <ListaOpciones
        id={campoId}
        opciones={opciones}
        value={input.value}
        onChange={input.onChange}
        disabled={input.disabled}
        placeholder={input.placeholder}
        buscable={buscable}
        creable={creable}
        etiqueta={etiqueta}
        {...aria}
      />
    );
  } else if (opciones) {
    cuerpo = (
      <>
        <select id={campoId} className={`${s.input} ${s.inputLista}`} {...aria} {...input}>
          {opciones.map((o) => <option key={o.valor} value={o.valor} disabled={o.deshabilitada}>{o.texto}</option>)}
        </select>
        <ChevronDown className={s.flechaLista} aria-hidden="true" />
      </>
    );
  } else {
    cuerpo = <input id={campoId} className={s.input} {...aria} {...input} />;
  }
  return (
    <div className={s.campo}>
      {etiqueta && <label htmlFor={campoId} className={s.etiqueta}>{etiqueta}</label>}
      <div className={[s.control, error && s.conError, icono && s.conIcono, input.disabled && s.apagado].filter(Boolean).join(' ')}>
        {icono && <span className={s.icono} aria-hidden="true">{icono}</span>}
        {cuerpo}
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

/**
 * Casilla para marcar (aceptar, "No sé el año"). El visto se dibuja al
 * marcarla; la caja con el degradado del logo.
 *  - activo · onChange(marcada) · etiqueta · descripcion · disabled
 */
export function Casilla({ activo = false, onChange, etiqueta, descripcion, disabled = false }) {
  const id = useId();
  return (
    <label className={[s.casilla, disabled && s.apagado].filter(Boolean).join(' ')} htmlFor={id}>
      <input id={id} type="checkbox" checked={activo} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span className={s.caja} aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
      </span>
      <span className={s.interruptorTexto}>
        <span>{etiqueta}</span>
        {descripcion && <small>{descripcion}</small>}
      </span>
    </label>
  );
}

/**
 * Contraseña con el candado y el ojo para mostrarla u ocultarla (el ojo
 * parpadea al cambiar). Es un Campo: mismas etiqueta, ayuda y error.
 *  - valor · onCambiar(texto) · nueva: autocompletar como contraseña nueva
 *  - etiqueta, ayuda, error, placeholder, disabled, id, aria-describedby
 */
export function CampoContrasena({ etiqueta = 'Contraseña', valor = '', onCambiar, nueva = false, ayuda, error, placeholder, disabled, id, ...resto }) {
  const [ver, setVer] = useState(false);
  return (
    <Campo
      id={id}
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      icono={<LockKeyhole />}
      type={ver ? 'text' : 'password'}
      autoComplete={nueva ? 'new-password' : 'current-password'}
      value={valor}
      onChange={(e) => onCambiar?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      {...resto}
      sufijo={(
        <button
          type="button"
          className={s.ojo}
          onClick={() => setVer((v) => !v)}
          disabled={disabled}
          aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={ver}
        >
          <span key={ver ? 'si' : 'no'} className={s.ojoIcono}>{ver ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</span>
        </button>
      )}
    />
  );
}

/** Celular de 9 números → "987 654 321"; lo demás, en grupos de 3. */
const agrupar = (n) => String(n || '').replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ');

/**
 * Teléfono con el país: el prefijo es una ListaOpciones con buscador (código
 * del país, sin banderas emoji) y el número se agrupa de a 3 mientras se
 * escribe (se guarda sin espacios).
 *  - etiqueta, ayuda, error
 *  - pais · onPais(codigo) · paises: [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }]
 *  - valor (solo números) · onCambiar(numeros) · maximo (9 en el Perú)
 */
export function CampoTelefono({ etiqueta = 'Celular', ayuda, error, pais = 'PE', onPais, paises = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }], valor = '', onCambiar, maximo }) {
  const tope = maximo ?? (pais === 'PE' ? 9 : 15);
  const opciones = paises.map((p) => ({ ...p, detalle: p.prefijo, corto: p.prefijo, icono: <span className={s.codigoPais}>{p.valor}</span> }));
  return (
    <Campo
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      control={(aria) => (
        <span className={s.telefono}>
          {paises.length > 1 ? (
            <ListaOpciones compacto opciones={opciones} value={pais} onChange={(e) => onPais?.(e.target.value)} etiqueta="País del número" buscable aria-label="País del número" />
          ) : (
            <span className={s.prefijoFijo}>{paises[0]?.prefijo}</span>
          )}
          <span className={s.separadorTel} aria-hidden="true" />
          <input
            {...aria}
            className={s.input}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={agrupar(valor)}
            onChange={(e) => onCambiar?.(e.target.value.replace(/\D/g, '').slice(0, tope))}
            placeholder={pais === 'PE' ? '987 654 321' : 'Tu número'}
          />
        </span>
      )}
    />
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
