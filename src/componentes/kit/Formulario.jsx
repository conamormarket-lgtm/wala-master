import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Minus, Plus, Check, Search, ChevronDown, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import Boton from './Boton';
import ListaOpciones from './ListaOpciones';
import { RESORTE } from './Efectos';
import { Visto } from './Marca';
import { Texto } from './Traduccion';
import s from './Formulario.module.css';

/**
 * Campo de texto con etiqueta, ayuda y error accesibles. El error entra con una sacudida.
 *  - opciones: [{ valor, texto, detalle, icono }] lo vuelve una lista
 *    desplegable de Walá (ListaOpciones: panel en escritorio, hoja en el
 *    celular), con `buscable` (más de 10 opciones: sí) y `creable` (acepta lo
 *    escrito). `nativo`: el <select> del navegador.
 *  - control: ({ id, aria-invalid, aria-describedby }) => nodo, otro control
 *    dentro de la misma caja (CampoFecha, CampoTelefono)
 *  - multilinea: un texto largo (<textarea>); true = 3 líneas o el número de
 *    líneas (lo mínimo: crece solo con lo escrito, sin agarradera). Con
 *    maxLength, cuenta lo escrito ("120/800") junto a la ayuda.
 */
export function Campo({ etiqueta, ayuda, error, icono, sufijo, id, opciones, nativo = false, buscable, creable, control, multilinea, ...input }) {
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
  } else if (multilinea) {
    cuerpo = <AreaTexto id={campoId} filas={multilinea === true ? 3 : multilinea} {...aria} {...input} />;
  } else {
    cuerpo = <input id={campoId} className={s.input} {...aria} {...input} />;
  }
  const contador = multilinea && input.maxLength ? <span className={s.contador}>{String(input.value || '').length}/{input.maxLength}</span> : null;
  return (
    <div className={s.campo}>
      {etiqueta && <label htmlFor={campoId} className={s.etiqueta}>{etiqueta}</label>}
      <div className={[s.control, multilinea && s.controlArea, error && s.conError, icono && s.conIcono, input.disabled && s.apagado].filter(Boolean).join(' ')}>
        {icono && <span className={s.icono} aria-hidden="true">{icono}</span>}
        {cuerpo}
        {sufijo && <span className={s.sufijo}>{sufijo}</span>}
        <span className={s.brilloFoco} aria-hidden="true" />
      </div>
      {error ? (
        <p id={ayudaId} className={s.error}><AlertCircle aria-hidden="true" />{error}{contador}</p>
      ) : ayuda || contador ? (
        <p id={ayudaId} className={s.ayuda}>{ayuda}{contador}</p>
      ) : null}
    </div>
  );
}

/**
 * El texto largo de un Campo: empieza con sus filas y crece con lo escrito
 * hasta un tope (luego se desplaza por dentro). Sin agarradera para estirarlo:
 * no hace falta y se veía poco cuidado.
 */
function AreaTexto({ filas, value, ...resto }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} className={`${s.input} ${s.area}`} rows={filas} value={value} {...resto} />;
}

/**
 * Selector de opción (talla, medida, número, modelo…). El fondo violeta de la
 * elegida se desliza de una a otra; las agotadas van tachadas. `etiqueta`
 * cambia el título ("Talla" por defecto).
 */
export function SelectorTalla({ tallas, valor, onChange, agotadas = [], guia, etiqueta = 'Talla' }) {
  const marca = useId();
  const reducir = useReducedMotion();
  return (
    <fieldset className={s.grupo}>
      <legend className={s.leyenda}>
        <span><Texto>{etiqueta}</Texto>{valor && <strong>: {valor}</strong>}</span>
        {guia && <button type="button" className={s.enlace} onClick={guia}><Texto>Guía de tallas</Texto></button>}
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
              {activa && <motion.span layoutId={`talla-${marca}`} className={s.tallaMarca} transition={reducir ? { duration: 0 } : RESORTE} aria-hidden="true" />}
              <span className={s.tallaTexto}>{t}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** "#abc" o "abc123" → "#AABBCC"; null si no es un color hexadecimal. */
export const normalizarHex = (texto) => {
  const limpio = String(texto || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(limpio)) return `#${limpio.split('').map((c) => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(limpio)) return `#${limpio}`.toUpperCase();
  return null;
};

/**
 * Un color escrito en hexadecimal (#FF6B6B): el selector del sistema muestra
 * RGB y no deja pegar un código. Se aplica al tener las 6 cifras; si queda a
 * medias, al salir vuelve al color de antes.
 *  - valor (hex) · onChange(hex) · etiqueta (para lectores de pantalla)
 */
export function CampoHex({ valor, onChange, etiqueta = 'Color en hexadecimal' }) {
  const [texto, setTexto] = useState(String(valor || '').toUpperCase());
  const [editando, setEditando] = useState(false);
  useEffect(() => { if (!editando) setTexto(String(valor || '').toUpperCase()); }, [valor, editando]);
  return (
    <input
      type="text"
      className={s.hex}
      value={texto}
      maxLength={7}
      spellCheck={false}
      autoComplete="off"
      aria-label={etiqueta}
      title={etiqueta}
      placeholder="#000000"
      onFocus={(e) => { setEditando(true); e.target.select(); }}
      onChange={(e) => {
        setTexto(e.target.value);
        const hex = normalizarHex(e.target.value);
        if (hex && e.target.value.replace('#', '').length === 6) onChange?.(hex);
      }}
      onBlur={() => {
        setEditando(false);
        const hex = normalizarHex(texto);
        if (hex && hex !== String(valor || '').toUpperCase()) onChange?.(hex);
        else setTexto(String(valor || '').toUpperCase());
      }}
      onKeyDown={(e) => {
        e.stopPropagation(); // que no dispare los atajos de la página (el estudio)
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/**
 * Selector de color con el nombre visible del color elegido.
 *  - colores: [{ nombre, hex, claro }] · valor: nombre del elegido · onChange(nombre)
 *  - libre: { hex, onCambiar(hex) } suma "otro color" (el del sistema) y el
 *    código hexadecimal. Con `libre` y sin onChange, las muestras también
 *    llaman a onCambiar con su hex; si `hex` no está en la lista, la leyenda
 *    lo muestra.
 */
export function SelectorColor({ colores, valor, onChange, etiqueta = 'Color', libre }) {
  const marca = useId();
  const reducir = useReducedMotion();
  const hexLibre = libre?.hex ? String(libre.hex).toUpperCase() : null;
  const actual = colores.find((c) => c.nombre === valor)
    || (hexLibre && colores.find((c) => c.hex.toUpperCase() === hexLibre))
    || (hexLibre ? { nombre: hexLibre, hex: hexLibre, libre: true } : null);
  const elegido = (c) => Boolean(actual && !actual.libre && actual.nombre === c.nombre);
  const elegir = (c) => (libre && !onChange ? libre.onCambiar?.(c.hex.toUpperCase()) : onChange?.(c.nombre));
  return (
    <fieldset className={s.grupo}>
      <legend className={s.leyenda}>
        <span>
          <Texto>{etiqueta}</Texto>
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
            aria-checked={elegido(c)}
            aria-label={c.nombre}
            className={s.color}
            style={{ '--muestra': c.hex }}
            onClick={() => elegir(c)}
          >
            {/* El aro de la elegida se desliza hasta la nueva. */}
            {elegido(c) && <motion.span layoutId={`color-${marca}`} className={s.colorAro} transition={reducir ? { duration: 0 } : RESORTE} aria-hidden="true" />}
            {elegido(c) && <Check aria-hidden="true" className={c.claro ? s.checkOscuro : undefined} />}
          </button>
        ))}
        {libre && (
          <span className={s.colorLibreFila}>
            {/* "Otro color": el selector del sistema dentro de una muestra arcoíris. */}
            <label
              className={[s.color, s.colorLibre, actual?.libre && s.colorActivo].filter(Boolean).join(' ')}
              style={actual?.libre ? { '--muestra': hexLibre } : undefined}
              title="Otro color"
            >
              <input type="color" value={(hexLibre || '#7C3AED').toLowerCase()} onChange={(e) => libre.onCambiar?.(e.target.value.toUpperCase())} aria-label={`${etiqueta}: otro color`} />
            </label>
            <CampoHex valor={hexLibre || ''} onChange={libre.onCambiar} etiqueta={`${etiqueta} en hexadecimal`} />
          </span>
        )}
      </div>
    </fieldset>
  );
}

/**
 * Cantidad con − / +. El número rueda hacia arriba o abajo según el cambio.
 *  - paso (1) · decimales (0) · sufijo ("cm") · editable: el número se puede
 *    escribir (Enter o al salir lo aplica; fuera de min–max se ajusta)
 *  - etiqueta: nombre para lectores de pantalla (con editable)
 * Con otro paso, − / + van al múltiplo siguiente (4,3 → 4,5 → 5).
 */
export function Cantidad({ valor, onChange, min = 1, max = 99, tamano = 'md', paso = 1, decimales = 0, sufijo, editable = false, etiqueta }) {
  const previo = useRef(valor);
  const sube = valor >= previo.current;
  useEffect(() => { previo.current = valor; }, [valor]);
  const mostrar = (v) => (decimales ? Number(v).toFixed(decimales).replace(/\.?0+$/, '') : String(v));
  const fijar = (v) => onChange(Number(Math.min(max, Math.max(min, v)).toFixed(decimales)));
  const simple = paso === 1 && !decimales;
  const bajar = () => (simple ? onChange(valor - 1) : fijar((Math.ceil(valor / paso - 1e-6) - 1) * paso));
  const subir = () => (simple ? onChange(valor + 1) : fijar((Math.floor(valor / paso + 1e-6) + 1) * paso));
  const [texto, setTexto] = useState(mostrar(valor));
  useEffect(() => { setTexto(mostrar(valor)); }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  const confirmar = () => {
    const n = Number(String(texto).replace(',', '.'));
    if (Number.isFinite(n) && String(texto).trim() !== '') fijar(n);
    else setTexto(mostrar(valor));
  };
  return (
    <div className={[s.cantidad, tamano === 'sm' && s.cantidadSm].filter(Boolean).join(' ')} role={editable ? 'group' : undefined} aria-label={editable ? etiqueta : undefined}>
      <button type="button" aria-label="Quitar uno" disabled={valor <= min} onClick={bajar}>
        <Minus aria-hidden="true" />
      </button>
      {editable ? (
        <label className={s.cantidadCampo}>
          <input
            type="text"
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              e.stopPropagation(); // que no dispare los atajos de la página
              if (e.key === 'Enter') { e.preventDefault(); confirmar(); e.currentTarget.blur(); }
            }}
            aria-label={etiqueta}
          />
          {sufijo && <span>{sufijo}</span>}
        </label>
      ) : (
      <output aria-live="polite" className={s.cantidadValor}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={valor}
            initial={{ y: sube ? 16 : -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: sube ? -16 : 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {mostrar(valor)}{sufijo && <small className={s.cantidadSufijo}> {sufijo}</small>}
          </motion.span>
        </AnimatePresence>
      </output>
      )}
      <button type="button" aria-label="Agregar uno" disabled={valor >= max} onClick={subir}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Un valor en una barra (grosor, curva, zoom…), con los colores de Walá.
 *  - etiqueta · valor · min · max · paso (1) · formato(v) para el número
 *    visible · onChange(v) · disabled
 *  - soloBarra: sin la fila de etiqueta y valor (la etiqueta queda para
 *    lectores de pantalla), p. ej. entre dos botones − / +
 */
export function Deslizador({ etiqueta, valor, min = 0, max = 100, paso = 1, formato, onChange, disabled = false, soloBarra = false }) {
  const avance = max > min ? ((valor - min) / (max - min)) * 100 : 0;
  const barra = (
    <input
      type="range"
      className={s.deslizadorBarra}
      min={min}
      max={max}
      step={paso}
      value={valor}
      disabled={disabled}
      onChange={(e) => onChange?.(Number(e.target.value))}
      aria-label={soloBarra ? etiqueta : undefined}
      style={{ '--avance': `${Math.min(100, Math.max(0, avance))}%` }}
    />
  );
  if (soloBarra) return barra;
  return (
    <label className={[s.deslizador, disabled && s.apagado].filter(Boolean).join(' ')}>
      <span className={s.deslizadorFila}>
        <span>{etiqueta}</span>
        <output>{formato ? formato(valor) : valor}</output>
      </span>
      {barra}
    </label>
  );
}

/**
 * Casilla para marcar (aceptar, "No sé el año"): el Visto en cuadro (el
 * mismo check de Walá que marca la opción elegida de una lista).
 *  - activo · onChange(marcada) · etiqueta · descripcion · disabled
 */
export function Casilla({ activo = false, onChange, etiqueta, descripcion, disabled = false }) {
  const id = useId();
  return (
    <label className={[s.casilla, disabled && s.apagado].filter(Boolean).join(' ')} htmlFor={id}>
      <input id={id} type="checkbox" checked={activo} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <Visto activo={activo} forma="cuadro" className={s.caja} />
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
export function CampoTelefono({ etiqueta = 'Celular', ayuda, error, pais = 'PE', onPais, paises = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }], valor = '', onCambiar, maximo, id }) {
  const tope = maximo ?? (pais === 'PE' ? 9 : 15);
  const opciones = paises.map((p) => ({ ...p, detalle: p.prefijo, corto: p.prefijo, icono: <span className={s.codigoPais}>{p.valor}</span> }));
  return (
    <Campo
      id={id}
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
