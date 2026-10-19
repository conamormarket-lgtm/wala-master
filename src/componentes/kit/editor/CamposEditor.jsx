import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, ChevronDown, Copy, ImagePlus, Link2, Loader2, Plus, Trash2, Underline, X,
  ExternalLink, Hash, CornerDownRight,
} from 'lucide-react';
import { Interruptor } from '../Formulario';
import { Pestanas } from '../Navegacion';
import { tipoDeEnlace } from '../Enlace';
import { FUENTES_TIPOGRAFIA, esquemaDe } from './esquemas';
import { IconoWala, ICONOS_WALA, iconoDesde } from '../IconosWala';
import { FotoProducto } from '../piezas/FotoProducto';
import { CARAS_KAPI } from '../piezas/Flotantes';
import s from './Editor.module.css';

/*
 * Campos del editor del builder. <FormularioSeccion> lee el esquema del tipo
 * (esquemas.js) y dibuja cada campo con estos controles. Todo es compacto,
 * usable con el dedo (44px) y con los colores del tema (claro y noche).
 *
 * Lo que viene de la tienda entra por <ProveedorEditor fuentes={…}>:
 *  - colecciones, categorias, marcas: [{ id, name, … }] para los selectores
 *  - subirArchivo(file, ruta) → Promise<{ url, error }> (uploadFile de
 *    services/firebase/storage.js tiene esa misma firma)
 *  - extensiones: { nombre: (props) => nodo } para campos que dibuja la
 *    página (p. ej. el editor de burbujas de categories_nav), y
 *    extensiones.formularios: { tipo: ({ ajustes, cambiar }) => nodo } para
 *    los tipos sin esquema que la página edita a su modo (el cacherito)
 *  - crearAjustes(tipo): los ajustes de una sección nueva (para "plantilla")
 */

const EditorCtx = createContext({ fuentes: {}, extensiones: {} });
export function ProveedorEditor({ fuentes = {}, extensiones = {}, crearAjustes, children }) {
  return <EditorCtx.Provider value={{ fuentes, extensiones, crearAjustes }}>{children}</EditorCtx.Provider>;
}
const useEditor = () => useContext(EditorCtx);
/** El tipo de la sección que se edita (para la plantilla de una lista). */
const TipoCtx = createContext(null);

/* ── Marco común: etiqueta + control + ayuda ── */
function Fila({ etiqueta, ayuda, htmlFor, children, linea = false, extra }) {
  return (
    <div className={[s.fila, linea && s.filaLinea].filter(Boolean).join(' ')}>
      {(etiqueta || extra) && (
        <div className={s.filaCabeza}>
          {etiqueta && <label className={s.etiqueta} htmlFor={htmlFor}>{etiqueta}</label>}
          {extra}
        </div>
      )}
      {children}
      {ayuda && <p className={s.ayuda}>{ayuda}</p>}
    </div>
  );
}

/* ── Controles simples ── */

export function ControlTexto({ etiqueta, ayuda, valor, onCambiar, placeholder, multilinea, filas = 3 }) {
  const id = useId();
  const props = { id, className: s.input, value: valor ?? '', placeholder, onChange: (e) => onCambiar(e.target.value) };
  return (
    <Fila etiqueta={etiqueta} ayuda={ayuda} htmlFor={id}>
      {multilinea ? <textarea {...props} rows={filas} className={`${s.input} ${s.area}`} /> : <input type="text" {...props} />}
    </Fila>
  );
}

/** Número con unidad. `escala` guarda valor×escala (p. ej. segundos en el panel, ms en Firestore). */
export function ControlNumero({ etiqueta, ayuda, valor, onCambiar, min, max, paso = 1, sufijo, escala = 1 }) {
  const id = useId();
  const visible = valor === '' || valor == null ? '' : Math.round((Number(valor) / escala) * 100) / 100;
  return (
    <Fila etiqueta={etiqueta} ayuda={ayuda} htmlFor={id}>
      <div className={s.conSufijo}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={s.input}
          value={visible}
          min={min}
          max={max}
          step={paso}
          onChange={(e) => {
            if (e.target.value === '') return onCambiar('');
            let n = Number(e.target.value);
            if (min != null) n = Math.max(min, n);
            if (max != null) n = Math.min(max, n);
            return onCambiar(Math.round(n * escala));
          }}
        />
        {sufijo && <span>{sufijo}</span>}
      </div>
    </Fila>
  );
}

export function ControlRango({ etiqueta, valor, onCambiar, min = 0, max = 100, paso = 1, sufijo = '' }) {
  const id = useId();
  const v = valor === '' || valor == null ? min : Number(valor);
  return (
    <Fila etiqueta={etiqueta} htmlFor={id} extra={<output className={s.valorRango} htmlFor={id}>{v}{sufijo}</output>}>
      <input
        id={id}
        type="range"
        className={s.rango}
        min={min}
        max={max}
        step={paso}
        value={v}
        style={{ '--lleno': `${((v - min) / (max - min || 1)) * 100}%` }}
        onChange={(e) => onCambiar(Number(e.target.value))}
      />
    </Fila>
  );
}

/** Botones de opción (hasta 4 cortas) o lista desplegable. */
export function ControlOpciones({ etiqueta, ayuda, valor, onCambiar, opciones, iconos }) {
  const id = useId();
  const segmentado = opciones.length <= 4 && opciones.reduce((n, o) => n + String(o.texto).length, 0) <= 30;
  const actual = valor ?? '';
  if (segmentado) {
    return (
      <Fila etiqueta={etiqueta} ayuda={ayuda}>
        <div className={s.segmentos} role="radiogroup" aria-label={etiqueta}>
          {opciones.map((o) => {
            const Icono = iconos?.[o.valor];
            const sel = String(actual) === String(o.valor);
            return (
              <button key={String(o.valor)} type="button" role="radio" aria-checked={sel} className={[s.segmento, sel && s.segmentoActivo].filter(Boolean).join(' ')} onClick={() => onCambiar(o.valor)} title={o.texto}>
                {sel && <motion.span layoutId={`${id}-seg`} className={s.segmentoFondo} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className={s.segmentoTexto}>{Icono ? <Icono aria-label={o.texto} /> : o.texto}</span>
              </button>
            );
          })}
        </div>
      </Fila>
    );
  }
  return (
    <Fila etiqueta={etiqueta} ayuda={ayuda} htmlFor={id}>
      <div className={s.selector}>
        <select id={id} className={s.input} value={actual} onChange={(e) => onCambiar(e.target.value)}>
          {!opciones.some((o) => String(o.valor) === String(actual)) && <option value={actual}>{actual || '—'}</option>}
          {opciones.map((o) => <option key={String(o.valor)} value={o.valor}>{o.texto}</option>)}
        </select>
        <ChevronDown aria-hidden="true" />
      </div>
    </Fila>
  );
}

export function ControlInterruptor({ etiqueta, descripcion, valor, onCambiar }) {
  return <div className={s.fila}><Interruptor etiqueta={etiqueta} descripcion={descripcion} activo={!!valor} onChange={onCambiar} /></div>;
}

/** Color. `automatico`: botón "Tema" (guarda '' y manda el modo claro/noche). */
export function ControlColor({ etiqueta, valor, onCambiar, automatico, vacio, transparente }) {
  const id = useId();
  const v = String(valor ?? '').trim();
  const sinColor = !v || v === 'transparent';
  const hex = /^#[0-9a-f]{6}$/i.test(v) ? v : /^#[0-9a-f]{3}$/i.test(v) ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : '#7c3aed';
  return (
    <Fila etiqueta={etiqueta} htmlFor={id}>
      <div className={s.color}>
        <label className={s.muestra} style={{ '--muestra': sinColor ? 'transparent' : v }} title="Elegir color">
          <input type="color" value={hex} onChange={(e) => onCambiar(e.target.value)} aria-label={`${etiqueta}: elegir`} />
        </label>
        <input id={id} className={s.input} value={sinColor ? '' : v} placeholder={automatico ? (vacio || 'Del tema') : vacio || '#ffffff'} onChange={(e) => onCambiar(e.target.value)} spellCheck={false} />
        {(automatico || vacio) && (
          <button type="button" className={[s.chipColor, sinColor && s.chipActivo].filter(Boolean).join(' ')} onClick={() => onCambiar('')}>{vacio || 'Tema'}</button>
        )}
        {transparente && (
          <button type="button" className={[s.chipColor, v === 'transparent' && s.chipActivo].filter(Boolean).join(' ')} onClick={() => onCambiar('transparent')}>Ninguno</button>
        )}
      </div>
    </Fila>
  );
}

/** Medida CSS con atajos (0, 1rem, 2rem…). */
export function ControlMedida({ etiqueta, valor, onCambiar, sugerencias = [] }) {
  const id = useId();
  return (
    <Fila etiqueta={etiqueta} htmlFor={id}>
      <input id={id} className={s.input} value={valor ?? ''} onChange={(e) => onCambiar(e.target.value)} spellCheck={false} />
      {sugerencias.length > 0 && (
        <div className={s.atajos}>
          {sugerencias.map((m) => (
            <button key={m} type="button" className={[s.atajo, valor === m && s.atajoActivo].filter(Boolean).join(' ')} onClick={() => onCambiar(m)}>{m}</button>
          ))}
        </div>
      )}
    </Fila>
  );
}

const ICONO_ENLACE = { interno: CornerDownRight, externo: ExternalLink, ancla: Hash, contacto: Link2 };
const TEXTO_ENLACE = { interno: 'Página de la tienda', externo: 'Otra web (pestaña nueva)', ancla: 'Baja a una sección', contacto: 'Abre correo o teléfono' };

/** Enlace con aviso de a dónde lleva (misma regla que <Enlace>). */
export function ControlEnlace({ etiqueta, ayuda, valor, onCambiar, placeholder = '/tienda, https://… o #seccion' }) {
  const id = useId();
  const tipo = tipoDeEnlace(valor);
  const Icono = ICONO_ENLACE[tipo];
  return (
    <Fila etiqueta={etiqueta} ayuda={ayuda} htmlFor={id} extra={tipo && <span className={s.tipoEnlace}><Icono aria-hidden="true" />{TEXTO_ENLACE[tipo]}</span>}>
      <input id={id} className={s.input} value={valor ?? ''} placeholder={placeholder} onChange={(e) => onCambiar(e.target.value)} spellCheck={false} inputMode="url" />
    </Fila>
  );
}

/** Fecha y hora en hora LOCAL (el editor de hoy mostraba UTC: 5 h corrida). */
export function ControlFecha({ etiqueta, valor, onCambiar }) {
  const id = useId();
  const d = valor ? new Date(valor) : null;
  const local = d && !Number.isNaN(d.getTime()) ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return (
    <Fila etiqueta={etiqueta} htmlFor={id}>
      <input id={id} type="datetime-local" className={s.input} value={local} onChange={(e) => onCambiar(e.target.value ? new Date(e.target.value).toISOString() : '')} />
    </Fila>
  );
}

/** Imagen: vista previa, subir archivo (si hay subirArchivo) o pegar enlace. */
export function ControlImagen({ etiqueta, ayuda, valor, onCambiar, acepta = 'image/*', carpeta = 'storefront' }) {
  const { fuentes } = useEditor();
  const entrada = useRef(null);
  const [estado, setEstado] = useState({ subiendo: false, error: '' });
  const [conEnlace, setConEnlace] = useState(false);
  const url = String(valor || '');
  const esVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const subir = fuentes.subirArchivo;

  const alElegir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo || !subir) return;
    setEstado({ subiendo: true, error: '' });
    const nombre = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    try {
      const r = await subir(archivo, `${carpeta}/${Date.now()}_${nombre}`);
      if (r?.url) onCambiar(r.url);
      setEstado({ subiendo: false, error: r?.url ? '' : r?.error || 'No se pudo subir' });
    } catch (err) {
      setEstado({ subiendo: false, error: err?.message || 'No se pudo subir' });
    }
  };

  return (
    <Fila etiqueta={etiqueta} ayuda={estado.error || ayuda}>
      <div className={[s.imagen, url && s.imagenLlena].filter(Boolean).join(' ')}>
        <button type="button" className={s.imagenVista} onClick={() => (subir ? entrada.current?.click() : setConEnlace(true))} aria-label={url ? 'Cambiar imagen' : 'Elegir imagen'}>
          {estado.subiendo ? <Loader2 className={s.girar} aria-hidden="true" />
            : url ? (esVideo ? <video src={url} muted playsInline preload="metadata" /> : <img src={url} alt="" />)
              : <><ImagePlus aria-hidden="true" /><span>{subir ? 'Subir imagen' : 'Pegar enlace'}</span></>}
        </button>
        <div className={s.imagenAcciones}>
          {subir && <button type="button" className={s.accionMini} onClick={() => entrada.current?.click()}>{url ? 'Cambiar' : 'Subir'}</button>}
          <button type="button" className={s.accionMini} onClick={() => setConEnlace((v) => !v)} aria-expanded={conEnlace}><Link2 aria-hidden="true" /> Enlace</button>
          {url && <button type="button" className={`${s.accionMini} ${s.accionPeligro}`} onClick={() => onCambiar('')} aria-label="Quitar imagen"><X aria-hidden="true" /></button>}
        </div>
        <input ref={entrada} type="file" accept={acepta} hidden onChange={alElegir} />
      </div>
      {(conEnlace || (url && !subir)) && (
        <input className={s.input} value={url} placeholder="https://…" onChange={(e) => onCambiar(e.target.value)} spellCheck={false} inputMode="url" aria-label={`${etiqueta}: enlace`} />
      )}
    </Fila>
  );
}

/** Selector de íconos de Walá (reemplaza escribir un emoji). */
export function ControlIcono({ etiqueta, valor, onCambiar, ninguno = false }) {
  const actual = valor ? iconoDesde(valor) : ninguno ? '' : 'check';
  return (
    <Fila etiqueta={etiqueta}>
      <div className={s.iconos} role="radiogroup" aria-label={etiqueta}>
        {ninguno && (
          <button type="button" role="radio" aria-checked={actual === ''} className={[s.iconoOpcion, s.iconoNinguno, actual === '' && s.iconoOpcionActiva].filter(Boolean).join(' ')} onClick={() => onCambiar('')}>
            Sin ícono
          </button>
        )}
        {ICONOS_WALA.map((i) => {
          const sel = actual === i.nombre;
          return (
            <button key={i.nombre} type="button" role="radio" aria-checked={sel} title={i.etiqueta} aria-label={i.etiqueta} className={[s.iconoOpcion, sel && s.iconoOpcionActiva].filter(Boolean).join(' ')} onClick={() => onCambiar(i.nombre)}>
              <IconoWala nombre={i.nombre} tamano={34} sticker={false} girar={0} />
            </button>
          );
        })}
      </div>
      {valor && !actual && <p className={s.aviso}>Tenía el emoji {valor}: elige un ícono para que se vea igual en todos los celulares.</p>}
    </Fila>
  );
}

/** Selector de colección, categoría o marca (datos de la tienda). */
export function ControlFuente({ etiqueta, valor, onCambiar, datos, vacio = 'Ninguna' }) {
  const { fuentes } = useEditor();
  const lista = { colecciones: fuentes.colecciones, categorias: fuentes.categorias, marcas: fuentes.marcas }[datos] || [];
  return (
    <ControlOpciones
      etiqueta={etiqueta}
      valor={valor ?? ''}
      onCambiar={onCambiar}
      opciones={[{ valor: '', texto: vacio }, ...lista.map((x) => ({ valor: x.id, texto: x.name || x.id }))]}
    />
  );
}

/* ── Plegable: agrupa controles avanzados ── */
function Plegable({ titulo, resumen, children, inicial = false }) {
  const [abierto, setAbierto] = useState(inicial);
  const id = useId();
  return (
    <div className={[s.plegable, abierto && s.plegableAbierto].filter(Boolean).join(' ')}>
      <button type="button" className={s.plegableCabeza} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((v) => !v)}>
        <span>{titulo}</span>
        {resumen && !abierto && <small>{resumen}</small>}
        <ChevronDown aria-hidden="true" />
      </button>
      <div id={id} className={s.plegableCuerpo} hidden={!abierto}>
        {children}
      </div>
    </div>
  );
}

/* ── Compuestos (mismos campos que los controles de hoy) ── */

function ControlEstiloTexto({ etiqueta, prefijo, ajustes, cambiar }) {
  const k = (c) => `${prefijo}${c}`;
  const activos = [ajustes[k('Align')] && 'alineado', ajustes[k('Underline')] && 'subrayado', ajustes[k('Bg')] && 'con fondo', ajustes[k('Link')] && 'con enlace'].filter(Boolean);
  return (
    <Plegable titulo={etiqueta} resumen={activos.join(' · ')}>
      <ControlOpciones
        etiqueta="Alineación"
        valor={ajustes[k('Align')] || ''}
        onCambiar={(v) => cambiar({ [k('Align')]: v })}
        opciones={[{ valor: '', texto: 'Auto' }, { valor: 'left', texto: 'Izquierda' }, { valor: 'center', texto: 'Centro' }, { valor: 'right', texto: 'Derecha' }]}
        iconos={{ left: AlignLeft, center: AlignCenter, right: AlignRight }}
      />
      <div className={s.fila}>
        <button type="button" className={[s.alternar, ajustes[k('Underline')] && s.alternarActivo].filter(Boolean).join(' ')} aria-pressed={!!ajustes[k('Underline')]} onClick={() => cambiar({ [k('Underline')]: !ajustes[k('Underline')] })}>
          <Underline aria-hidden="true" /> Subrayado
        </button>
      </div>
      <ControlColor etiqueta="Fondo del texto" valor={ajustes[k('Bg')]} onCambiar={(v) => cambiar({ [k('Bg')]: v })} vacio="Sin fondo" />
      <ControlEnlace etiqueta="Enlace del texto" valor={ajustes[k('Link')]} onCambiar={(v) => cambiar({ [k('Link')]: v })} />
    </Plegable>
  );
}

function ControlTipografia({ etiqueta, prefijo, ajustes, cambiar }) {
  const k = (c) => `${prefijo}${c}`;
  const fuente = FUENTES_TIPOGRAFIA.find((f) => f.valor === ajustes[k('FontFamily')])?.texto;
  return (
    <Plegable titulo={etiqueta} resumen={[fuente !== 'Por defecto' && fuente, ajustes[k('FontSize')]].filter(Boolean).join(' · ')}>
      <ControlOpciones etiqueta="Fuente" valor={ajustes[k('FontFamily')] || ''} onCambiar={(v) => cambiar({ [k('FontFamily')]: v })} opciones={FUENTES_TIPOGRAFIA} />
      <ControlMedida etiqueta="Tamaño" valor={ajustes[k('FontSize')]} onCambiar={(v) => cambiar({ [k('FontSize')]: v })} sugerencias={['1rem', '1.5rem', '2rem', '3rem']} />
      <ControlOpciones
        etiqueta="Grosor"
        valor={ajustes[k('FontWeight')] || ''}
        onCambiar={(v) => cambiar({ [k('FontWeight')]: v })}
        opciones={[['', 'Por defecto'], ['300', 'Fina'], ['400', 'Normal'], ['500', 'Media'], ['600', 'Seminegrita'], ['700', 'Negrita'], ['800', 'Extra'], ['900', 'Black']].map(([valor, texto]) => ({ valor, texto }))}
      />
      <ControlOpciones
        etiqueta="Mayúsculas"
        valor={ajustes[k('TextTransform')] || ''}
        onCambiar={(v) => cambiar({ [k('TextTransform')]: v })}
        opciones={[{ valor: '', texto: 'Aa' }, { valor: 'uppercase', texto: 'AA' }, { valor: 'lowercase', texto: 'aa' }, { valor: 'capitalize', texto: 'Aa Aa' }]}
      />
    </Plegable>
  );
}

function ControlBoton({ ajustes, cambiar, conColores }) {
  return (
    <Plegable titulo="Botón (opcional)" resumen={ajustes.buttonText || 'Sin botón'} inicial={!!ajustes.buttonText}>
      <ControlTexto etiqueta="Texto del botón" valor={ajustes.buttonText} onCambiar={(v) => cambiar({ buttonText: v })} placeholder="Ej: Ver más" />
      <ControlEnlace etiqueta="Enlace del botón" valor={ajustes.buttonLink} onCambiar={(v) => cambiar({ buttonLink: v })} />
      {(conColores || ajustes.buttonBgColor) && (
        <>
          <ControlColor etiqueta="Fondo del botón" valor={ajustes.buttonBgColor} onCambiar={(v) => cambiar({ buttonBgColor: v })} automatico vacio="Violeta" />
          <ControlColor etiqueta="Texto del botón" valor={ajustes.buttonTextColor} onCambiar={(v) => cambiar({ buttonTextColor: v })} automatico vacio="Blanco" />
        </>
      )}
      {!ajustes.buttonText !== !ajustes.buttonLink && <p className={s.aviso}>Faltan el texto o el enlace: el botón no se mostrará.</p>}
    </Plegable>
  );
}

function ControlFondo({ ajustes, cambiar }) {
  const hayImagen = ajustes.backgroundImageUrl || ajustes.backgroundGradient;
  return (
    <Plegable titulo="Fondo de la sección" resumen={ajustes.backgroundColor && ajustes.backgroundColor !== 'transparent' ? ajustes.backgroundColor : hayImagen ? 'Con imagen' : 'Ninguno'}>
      <ControlColor etiqueta="Color" valor={ajustes.backgroundColor} onCambiar={(v) => cambiar({ backgroundColor: v })} transparente />
      <ControlImagen etiqueta="Imagen de fondo" valor={ajustes.backgroundImageUrl} onCambiar={(v) => cambiar({ backgroundImageUrl: v })} carpeta="storefront/fondos" />
      <ControlTexto etiqueta="Degradado CSS" valor={ajustes.backgroundGradient} onCambiar={(v) => cambiar({ backgroundGradient: v })} placeholder="linear-gradient(90deg, #ede9fe, #fff)" />
      {hayImagen && <ControlRango etiqueta="Desenfocar" valor={Number(ajustes.backgroundBlur) || 0} onCambiar={(v) => cambiar({ backgroundBlur: String(v) })} min={0} max={20} sufijo="px" />}
      <ControlColor etiqueta="Velo encima" valor={ajustes.backgroundOverlay} onCambiar={(v) => cambiar({ backgroundOverlay: v })} vacio="Sin velo" />
    </Plegable>
  );
}

const PASOS_RELLENO = ['0rem', '0.5rem', '1rem', '2rem', '3rem'];
function ControlEspaciado({ ajustes, cambiar }) {
  return (
    <Plegable titulo="Espacio arriba y abajo" resumen={`${ajustes.paddingTop || 'auto'} · ${ajustes.paddingBottom || 'auto'}`}>
      <ControlMedida etiqueta="Arriba" valor={ajustes.paddingTop} onCambiar={(v) => cambiar({ paddingTop: v })} sugerencias={PASOS_RELLENO} />
      <ControlMedida etiqueta="Abajo" valor={ajustes.paddingBottom} onCambiar={(v) => cambiar({ paddingBottom: v })} sugerencias={PASOS_RELLENO} />
    </Plegable>
  );
}

/* ── Lista de elementos (diapositivas, tarjetas, preguntas…) ── */
function ControlLista({ campo: def, valor, onCambiar }) {
  const { fuentes } = useEditor();
  const items = Array.isArray(valor) ? valor : [];
  const [abierto, setAbierto] = useState(null);
  const lleno = def.max && items.length >= def.max;
  const poner = (lista) => onCambiar(lista);
  const mover = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const l = [...items];
    [l[i], l[j]] = [l[j], l[i]];
    poner(l);
    if (abierto === i) setAbierto(j);
  };
  const desde = def.desde && (fuentes[def.desde.datos] || []).filter((x) => !items.some((it) => it[def.desde.clave] === x.id));
  const todas = def.desde?.todas && desde ? desde.filter((x) => !def.desde.todas.filtro || def.desde.todas.filtro(x)) : [];
  const conLugar = (lista) => (def.max ? lista.slice(0, Math.max(0, def.max - items.length)) : lista);

  return (
    <div className={s.lista}>
      <div className={s.filaCabeza}>
        <span className={s.etiqueta}>{def.etiqueta}</span>
        <span className={s.cuenta}>{items.length}{def.max ? ` / ${def.max}` : ''}</span>
      </div>
      <AnimatePresence initial={false}>
        {items.map((it, i) => {
          const abiertoEste = abierto === i;
          const mini = def.miniatura?.(it);
          return (
            <motion.div
              key={it.id || `${i}`}
              layout="position"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.18 }}
              className={[s.elemento, abiertoEste && s.elementoAbierto].filter(Boolean).join(' ')}
            >
              <div className={s.elementoCabeza}>
                <button type="button" className={s.elementoTitulo} aria-expanded={abiertoEste} onClick={() => setAbierto(abiertoEste ? null : i)}>
                  {def.miniatura && <FotoProducto className={s.miniatura} src={mini} />}
                  <span>{def.titulo ? def.titulo(it, i) : `${def.etiqueta} ${i + 1}`}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
                <span className={s.elementoAcciones}>
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === items.length - 1} aria-label="Bajar"><ArrowDown /></button>
                  {!lleno && <button type="button" onClick={() => poner([...items.slice(0, i + 1), { ...JSON.parse(JSON.stringify(it)), id: it.id ? `${it.id}_copia${Date.now()}` : undefined }, ...items.slice(i + 1)])} aria-label="Duplicar"><Copy /></button>}
                  <button type="button" className={s.peligro} onClick={() => { poner(items.filter((_, j) => j !== i)); setAbierto(null); }} aria-label="Quitar"><Trash2 /></button>
                </span>
              </div>
              {abiertoEste && (
                <div className={s.elementoCuerpo}>
                  <CamposDe campos={def.campos} ajustes={it} cambiar={(parche) => poner(items.map((x, j) => (j === i ? { ...x, ...parche } : x)))} />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {items.length === 0 && (
        <p className={s.vacioLista}>
          <img src={CARAS_KAPI.triste} alt="" width="40" height="40" />
          Aún no hay {def.etiqueta.toLowerCase()}. Añade la primera.
        </p>
      )}
      <div className={s.listaPie}>
        {!lleno && (
          <button type="button" className={s.agregar} onClick={() => { poner([...items, def.nuevo ? def.nuevo() : {}]); setAbierto(items.length); }}>
            <Plus aria-hidden="true" /> Añadir
          </button>
        )}
        {desde && desde.length > 0 && !lleno && (
          <div className={s.selector}>
            <select className={s.input} value="" onChange={(e) => { const x = desde.find((d) => d.id === e.target.value); if (x) poner([...items, def.desde.crear(x)]); }} aria-label={def.desde.etiqueta}>
              <option value="">{def.desde.etiqueta}…</option>
              {desde.map((x) => {
                const nota = def.desde.nota?.(x);
                return <option key={x.id} value={x.id}>{x.name || x.id}{nota ? ` (${nota})` : ''}</option>;
              })}
            </select>
            <ChevronDown aria-hidden="true" />
          </div>
        )}
        {todas.length > 1 && !lleno && (
          <button type="button" className={`${s.agregar} ${s.agregarAncho}`} onClick={() => poner([...items, ...conLugar(todas).map(def.desde.crear)])}>
            <Plus aria-hidden="true" /> {def.desde.todas.etiqueta} ({conLugar(todas).length})
          </button>
        )}
        {def.plantilla && <BotonPlantilla etiqueta={def.plantilla.etiqueta} campo={def.campo} hay={items.length} onUsar={poner} />}
      </div>
    </div>
  );
}

/* Reemplazar una lista por la de una sección nueva; si ya tiene elementos, pide
   confirmar en el mismo botón (sin window.confirm). */
function BotonPlantilla({ etiqueta, campo, hay, onUsar }) {
  const { crearAjustes } = useEditor();
  const tipo = useContext(TipoCtx);
  const [seguro, setSeguro] = useState(false);
  useEffect(() => {
    if (!seguro) return undefined;
    const t = window.setTimeout(() => setSeguro(false), 3000);
    return () => window.clearTimeout(t);
  }, [seguro]);
  const lista = tipo && crearAjustes ? crearAjustes(tipo)?.[campo] : null;
  if (!Array.isArray(lista) || !lista.length) return null;
  return (
    <button
      type="button"
      className={[s.agregar, s.agregarAncho, seguro && s.agregarConfirmar].filter(Boolean).join(' ')}
      onClick={() => {
        if (hay && !seguro) { setSeguro(true); return; }
        setSeguro(false);
        onUsar(JSON.parse(JSON.stringify(lista)));
      }}
    >
      {seguro ? `¿Reemplazar las ${hay}?` : etiqueta}
    </button>
  );
}

/* ── Despachador: un campo del esquema → su control ── */
function CampoEsquema({ def, ajustes, cambiar }) {
  const { extensiones, fuentes } = useEditor();
  const v = ajustes[def.campo];
  const poner = (x) => cambiar({ [def.campo]: x });
  switch (def.tipo) {
    case 'texto': return <ControlTexto etiqueta={def.etiqueta} ayuda={def.ayuda} placeholder={def.placeholder} valor={v} onCambiar={poner} />;
    case 'parrafo': return <ControlTexto multilinea filas={def.filas} etiqueta={def.etiqueta} ayuda={def.ayuda} placeholder={def.placeholder} valor={v} onCambiar={poner} />;
    case 'numero': return <ControlNumero {...def} valor={v} onCambiar={poner} />;
    case 'rango': return <ControlRango {...def} valor={v} onCambiar={poner} />;
    case 'color': return <ControlColor {...def} valor={v} onCambiar={poner} />;
    case 'imagen': return <ControlImagen {...def} valor={v} onCambiar={poner} />;
    case 'enlace': return <ControlEnlace etiqueta={def.etiqueta} ayuda={def.ayuda} placeholder={def.placeholder} valor={v} onCambiar={poner} />;
    case 'opciones': return <ControlOpciones etiqueta={def.etiqueta} ayuda={def.ayuda} opciones={def.opciones.filter((o) => !o.si || o.si(fuentes))} valor={v ?? def.porDefecto ?? def.opciones[0]?.valor} onCambiar={poner} />;
    case 'interruptor': return <ControlInterruptor etiqueta={def.etiqueta} descripcion={def.descripcion} valor={v ?? def.porDefecto ?? false} onCambiar={poner} />;
    case 'fecha': return <ControlFecha etiqueta={def.etiqueta} valor={v} onCambiar={poner} />;
    case 'icono': return <ControlIcono etiqueta={def.etiqueta} valor={v} onCambiar={poner} ninguno={def.ninguno} />;
    case 'medida': return <ControlMedida {...def} valor={v} onCambiar={poner} />;
    case 'fuente': return <ControlFuente {...def} valor={v} onCambiar={poner} />;
    case 'lista': return <ControlLista campo={def} valor={v} onCambiar={poner} />;
    case 'nota': return <p className={s.nota}>{def.texto}</p>;
    case 'estiloTexto': return <ControlEstiloTexto {...def} ajustes={ajustes} cambiar={cambiar} />;
    case 'tipografia': return <ControlTipografia {...def} ajustes={ajustes} cambiar={cambiar} />;
    case 'boton': return <ControlBoton {...def} ajustes={ajustes} cambiar={cambiar} />;
    case 'fondo': return <ControlFondo ajustes={ajustes} cambiar={cambiar} />;
    case 'espaciado': return <ControlEspaciado ajustes={ajustes} cambiar={cambiar} />;
    case 'extension': {
      const Ext = extensiones[def.nombre];
      return Ext ? <Ext ajustes={ajustes} cambiar={cambiar} /> : <p className={s.nota}>Esta parte se edita desde la tienda.</p>;
    }
    default: return null;
  }
}

function CamposDe({ campos, ajustes, cambiar }) {
  return campos.filter((c) => !c.si || c.si(ajustes)).map((c, i) => (
    <CampoEsquema key={`${c.tipo}-${c.campo || c.prefijo || c.nombre || i}`} def={c} ajustes={ajustes} cambiar={cambiar} />
  ));
}

const PESTANAS = [
  { id: 'contenido', texto: 'Contenido' },
  { id: 'diseno', texto: 'Diseño' },
  { id: 'avanzado', texto: 'Fondo y espacio' },
];

/**
 * Formulario de una sección, armado desde su esquema.
 *  - seccion: { id, type, settings }
 *  - onCambiar(parche): fusiona el parche en settings (la página guarda el borrador)
 *  - esquema: otro esquema (lo global: ESQUEMAS_GLOBALES)
 * Un tipo sin esquema usa extensiones.formularios[tipo] si la página lo da.
 */
export function FormularioSeccion({ seccion, onCambiar, esquema: propio }) {
  const { extensiones } = useEditor();
  const esquema = propio || esquemaDe(seccion.type);
  const ajustes = seccion.settings || {};
  const visibles = esquema.campos.filter((c) => !c.si || c.si(ajustes));
  const disponibles = PESTANAS.filter((p) => visibles.some((c) => (c.pestana || 'contenido') === p.id));
  const [pestana, setPestana] = useState('contenido');
  const actual = disponibles.some((p) => p.id === pestana) ? pestana : disponibles[0]?.id;

  if (esquema.desconocido) {
    const Propio = extensiones.formularios?.[seccion.type];
    if (Propio) return <div className={`${s.formulario} ${s.formularioPropio}`}><Propio ajustes={ajustes} cambiar={onCambiar} /></div>;
    return <p className={s.nota}>Este módulo tiene su propio editor y no se cambia desde aquí.</p>;
  }
  return (
    <TipoCtx.Provider value={seccion.type}>
    <div className={s.formulario}>
      {disponibles.length > 1 && (
        <div className={s.pestanasPanel}>
          <Pestanas opciones={disponibles} valor={actual} onChange={setPestana} etiqueta="Partes del formulario" />
        </div>
      )}
      <div key={actual} className={s.campos}>
        <CamposDe campos={esquema.campos.filter((c) => (c.pestana || 'contenido') === actual)} ajustes={ajustes} cambiar={onCambiar} />
      </div>
    </div>
    </TipoCtx.Provider>
  );
}
