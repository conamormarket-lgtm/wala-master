import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, ImagePlus, Link2, Plus, RefreshCw, Save, Trash2, Upload, X } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar } from '../../Feedback';
import { Campo } from '../../Formulario';
import { Chip } from '../../Etiquetas';
import { conOpcion } from '../../adaptadoresAdmin';
import { useBloquearScroll, useCerrarConAtras } from '../../Efectos';
import { RecortarFoto } from '../RecortarFoto';
import { useEsconderPrincipal } from './Marco';
import campo from '../../Formulario.module.css';
import s from './Formularios.module.css';

/*
 * Formularios del admin (guía: guia/ADMIN.md, D0): la hoja para crear o
 * editar, los bloques de campos y el campo de imagen. Guardar y subir llegan
 * por props como promesas: la pieza pone sola el cargando y el error.
 */

const ENFOCABLES = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const enEscritorio = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches;

/**
 * Crear o editar un registro. En escritorio, un panel al costado derecho
 * (la lista sigue a la vista); en el celular, la pantalla entera, con
 * Guardar fijo abajo.
 *  - abierta · titulo · subtitulo · onCerrar
 *  - onGuardar(): promesa. Mientras dura, la hoja no se cierra y el botón
 *    carga; si falla, el motivo queda arriba. Al terminar bien, quien la
 *    usa la cierra (o la deja abierta para seguir). Sin onGuardar, la hoja
 *    es solo para mirar: el pie tiene "Cerrar".
 *  - sucio: hay cambios sin guardar → cerrar pregunta antes (también con Esc,
 *    tocando afuera y con el atrás de Android)
 *  - textoGuardar ('Guardar') · puedeGuardar (false: el botón apagado)
 *  - extra: un nodo a la izquierda del pie (Eliminar)
 *  - children: los campos (GrupoCampos)
 */
export function HojaEdicion({ abierta, titulo, subtitulo, onCerrar, onGuardar, sucio = false, textoGuardar = 'Guardar', puedeGuardar = true, extra, children }) {
  const panel = useRef(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [preguntando, setPreguntando] = useState(false);
  const [escritorio, setEscritorio] = useState(enEscritorio);
  const idTitulo = useId();

  const estado = useRef({});
  estado.current = { sucio, guardando, onCerrar };
  const pedirCierre = () => {
    const e = estado.current;
    if (e.guardando) return;
    if (e.sucio) setPreguntando(true);
    else e.onCerrar?.();
  };

  useEffect(() => {
    if (!abierta) return;
    setError('');
    setPreguntando(false);
    setEscritorio(enEscritorio());
  }, [abierta]);

  useBloquearScroll(abierta);
  // Con cambios, "atrás" no cierra: pregunta (la pregunta apila su propio
  // atrás encima, así que el siguiente "atrás" solo la cierra a ella).
  useCerrarConAtras(abierta, pedirCierre, guardando || sucio, () => { if (!estado.current.guardando) setPreguntando(true); });

  useEffect(() => {
    if (!abierta) return undefined;
    const previo = document.activeElement;
    const t = window.setTimeout(() => {
      const primero = panel.current?.querySelector('input:not([type="hidden"]), textarea');
      (primero || panel.current)?.focus({ preventScroll: true });
    }, 60);
    const onKey = (e) => {
      const p = panel.current;
      const foco = document.activeElement;
      // Otra ventana encima (una lista abierta desde un campo, la pregunta): sus teclas.
      if (foco && foco !== document.body && !p?.contains(foco)) return;
      if (e.key === 'Escape') { e.preventDefault(); pedirCierre(); return; }
      if (e.key !== 'Tab' || !p) return;
      const lista = [...p.querySelectorAll(ENFOCABLES)].filter((el) => el.offsetParent !== null);
      if (!lista.length) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && (foco === primero || foco === p)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && foco === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      previo?.focus?.({ preventScroll: true });
    };
  }, [abierta]);

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando || !puedeGuardar) return;
    setGuardando(true);
    setError('');
    try {
      await onGuardar?.();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setGuardando(false);
    }
  };

  const entra = escritorio ? { x: '100%' } : { y: '100%' };
  const hoja = (
    <AnimatePresence>
      {abierta && (
        <motion.div key="hoja" className={s.fondo} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1, transition: { duration: 0.24 } }}>
          <motion.div
            className={s.velo}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            onClick={pedirCierre}
          />
          <motion.form
            ref={panel}
            className={s.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            aria-busy={guardando || undefined}
            tabIndex={-1}
            onSubmit={guardar}
            noValidate
            initial={entra}
            animate={{ x: 0, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ ...entra, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
          >
            <header className={s.cabeza}>
              <div className={s.cabezaTextos}>
                <h2 id={idTitulo}>{titulo}</h2>
                {subtitulo && <p>{subtitulo}</p>}
              </div>
              <button type="button" className={s.cerrar} onClick={pedirCierre} disabled={guardando} aria-label="Cerrar">
                <X aria-hidden="true" />
              </button>
            </header>
            <div className={s.cuerpo}>
              {error && <Aviso tipo="error" titulo="No se guardó">{error}</Aviso>}
              {children}
            </div>
            <footer className={s.pie}>
              {extra && <div className={s.pieExtra}>{extra}</div>}
              <span className={s.pieEstado} aria-live="polite">{sucio && !guardando ? 'Cambios sin guardar' : ''}</span>
              {onGuardar ? (
                <>
                  <Boton variante="fantasma" onClick={pedirCierre} disabled={guardando}>Cancelar</Boton>
                  <Boton type="submit" cargando={guardando} disabled={!puedeGuardar}>{guardando ? 'Guardando…' : textoGuardar}</Boton>
                </>
              ) : (
                <Boton variante="secundario" onClick={pedirCierre}>Cerrar</Boton>
              )}
            </footer>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {typeof document === 'undefined' ? hoja : createPortal(hoja, document.body)}
      <Confirmar
        abierta={preguntando}
        titulo="¿Salir sin guardar?"
        texto="Los cambios que hiciste se pierden."
        confirmar="Salir sin guardar"
        cancelar="Seguir editando"
        peligro
        onConfirmar={() => { setPreguntando(false); onCerrar?.(); }}
        onCancelar={() => setPreguntando(false)}
      />
    </>
  );
}

/**
 * Un bloque de campos con su título y una línea de ayuda.
 *  - titulo · ayuda · columnas (2: dos por fila cuando hay ancho) · children
 */
export function GrupoCampos({ titulo, ayuda, columnas = 1, children }) {
  return (
    <fieldset className={s.grupo}>
      {titulo && <legend className={s.grupoTitulo}>{titulo}</legend>}
      {ayuda && <p className={s.grupoAyuda}>{ayuda}</p>}
      <div className={[s.grupoCampos, columnas > 1 && s.grupoDos].filter(Boolean).join(' ')}>{children}</div>
    </fieldset>
  );
}

/**
 * Subir una imagen: elegirla o soltarla, recortarla (si hace falta) y
 * subirla, con su avance. Después se ve, se cambia o se quita.
 *  - etiqueta · ayuda · error
 *  - valor (url) · onCambiar(url | '')
 *  - subir(blob | archivo, { alAvanzar(0-100) }) → promesa con la url (o
 *    { url }). Sin `subir`, no se puede elegir.
 *  - recorte: 'circulo' | 'cuadrado' (antes de subir, con RecortarFoto) o null
 *    (tal cual) · tamanoRecorte: px del JPG (600)
 *  - forma: cómo se ve: 'circulo' (burbujas) | 'cuadro' | 'ancho' (banners)
 *    · contener: la imagen entera, sin recortarla en la vista (logos)
 *  - conEnlace: también se puede pegar un enlace (Drive, otra web)
 */
export function CampoImagen({
  etiqueta, ayuda, error, valor = '', onCambiar, subir, recorte = null, tamanoRecorte = 600, forma = 'cuadro', acepta = 'image/*', contener = false, conEnlace = false,
}) {
  const id = useId();
  const entrada = useRef(null);
  const [recortando, setRecortando] = useState(null);
  const [subiendo, setSubiendo] = useState(null); // { progreso } mientras sube
  const [fallo, setFallo] = useState(null); // { mensaje, archivo }
  const [encima, setEncima] = useState(false);
  const [pegando, setPegando] = useState(false);

  useEffect(() => () => { if (recortando) URL.revokeObjectURL(recortando); }, [recortando]);

  const enviar = async (archivo) => {
    setFallo(null);
    setSubiendo({ progreso: null });
    try {
      const r = await subir(archivo, { alAvanzar: (p) => setSubiendo({ progreso: Math.max(0, Math.min(100, Math.round(p))) }) });
      const url = typeof r === 'string' ? r : r?.url;
      if (!url) throw new Error(r?.error || 'No se pudo subir la imagen.');
      onCambiar?.(url);
    } catch (err) {
      setFallo({ mensaje: err?.message || 'No se pudo subir la imagen.', archivo });
    } finally {
      setSubiendo(null);
    }
  };

  const recibir = (archivo) => {
    if (!archivo || !subir) return;
    if (!archivo.type.startsWith('image/')) {
      setFallo({ mensaje: 'Ese archivo no es una imagen (JPG, PNG o WEBP).' });
      return;
    }
    if (recorte) setRecortando(URL.createObjectURL(archivo));
    else enviar(archivo);
  };

  const soltar = (e) => {
    e.preventDefault();
    setEncima(false);
    recibir(e.dataTransfer.files?.[0]);
  };

  const elegir = () => entrada.current?.click();
  const mensaje = error || fallo?.mensaje;
  const ayudaId = `${id}-ayuda`;

  return (
    <div className={campo.campo}>
      {etiqueta && <span id={`${id}-etiqueta`} className={campo.etiqueta}>{etiqueta}</span>}
      <div
        className={[s.imagen, s[`imagen_${forma}`], contener && s.imagenContener, valor && s.imagenLlena, encima && s.imagenEncima, mensaje && s.imagenError].filter(Boolean).join(' ')}
        onDragOver={(e) => { if (subir) { e.preventDefault(); setEncima(true); } }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
      >
        <button
          type="button"
          className={s.imagenVista}
          onClick={elegir}
          disabled={!subir || Boolean(subiendo)}
          aria-labelledby={etiqueta ? `${id}-etiqueta` : undefined}
          aria-describedby={mensaje || ayuda ? ayudaId : undefined}
          aria-label={etiqueta ? undefined : (valor ? 'Cambiar imagen' : 'Elegir imagen')}
        >
          {valor ? <img src={valor} alt="" /> : (
            <span className={s.imagenInvita}>
              <ImagePlus aria-hidden="true" />
              <span>{subir ? 'Elegir o soltar una imagen' : 'Sin imagen'}</span>
            </span>
          )}
          {subiendo && (
            <span className={s.subiendo} role="status">
              <span className={s.subiendoBarra}><span style={{ width: `${subiendo.progreso ?? 35}%` }} className={subiendo.progreso == null ? s.subiendoSinFin : undefined} /></span>
              <span>{subiendo.progreso == null ? 'Subiendo…' : `Subiendo ${subiendo.progreso}%`}</span>
            </span>
          )}
        </button>
        <div className={s.imagenAcciones}>
          {subir && (
            <Boton tamano="sm" variante="secundario" icono={<Upload aria-hidden="true" />} onClick={elegir} disabled={Boolean(subiendo)}>
              {valor ? 'Cambiar' : 'Elegir'}
            </Boton>
          )}
          {conEnlace && (
            <Boton tamano="sm" variante="fantasma" icono={<Link2 aria-hidden="true" />} onClick={() => setPegando((v) => !v)} aria-expanded={pegando}>Enlace</Boton>
          )}
          {valor && (
            <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={() => onCambiar?.('')} disabled={Boolean(subiendo)}>Quitar</Boton>
          )}
        </div>
        {conEnlace && pegando && (
          <input
            className={s.enlace}
            value={valor}
            placeholder="https://… (también un enlace de Drive)"
            inputMode="url"
            spellCheck={false}
            aria-label={`${etiqueta || 'Imagen'}: enlace`}
            onChange={(e) => onCambiar?.(e.target.value)}
          />
        )}
        <input
          ref={entrada}
          type="file"
          accept={acepta}
          hidden
          onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; recibir(a); }}
        />
      </div>
      {mensaje ? (
        <p id={ayudaId} className={campo.error}>
          <AlertCircle aria-hidden="true" />{mensaje}
          {fallo?.archivo && (
            <button type="button" className={s.reintentar} onClick={() => enviar(fallo.archivo)}><RefreshCw aria-hidden="true" /> Reintentar</button>
          )}
        </p>
      ) : ayuda ? <p id={ayudaId} className={campo.ayuda}>{ayuda}</p> : null}

      {recorte && (
        <RecortarFoto
          abierta={Boolean(recortando)}
          src={recortando}
          forma={recorte}
          tamano={tamanoRecorte}
          titulo="Recorta la imagen"
          texto={recorte === 'circulo' ? 'Arrastra y usa el zoom: así se verá en la burbuja.' : 'Arrastra y usa el zoom para elegir qué se ve.'}
          onCancelar={() => setRecortando(null)}
          onListo={async (blob) => { setRecortando(null); await enviar(blob); }}
        />
      )}
    </div>
  );
}

/**
 * Un monto en soles: "S/" delante (discreto), teclado de números con
 * decimales en el celular, "−" y "+" de a S/ 1 y céntimos sin trabas
 * (step any: 49.95 no se marca como inválido). Guarda lo escrito (texto);
 * quien guarda lo pasa a número.
 *  - los de Campo (etiqueta, ayuda, error, id, value, onChange…) · moneda ('S/')
 */
export function CampoDinero({ moneda = 'S/', ...campoProps }) {
  return <Campo icono={<span className={s.moneda}>{moneda}</span>} type="number" inputMode="decimal" min={0} step="any" paso={1} placeholder="0.00" {...campoProps} />;
}

const hexValido = (v) => {
  const t = String(v || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return t;
  if (/^#[0-9a-f]{3}$/i.test(t)) return `#${[...t.slice(1)].map((c) => c + c).join('')}`;
  return null;
};

/**
 * Un color: la muestra (abre el selector del sistema) y su código para
 * escribirlo o pegarlo (#ffffff).
 *  - etiqueta · ayuda · error · id · valor · onCambiar(hex)
 */
export function CampoColor({ etiqueta, ayuda, error, id, valor = '', onCambiar }) {
  const hex = hexValido(valor) || '#ffffff';
  return (
    <Campo
      id={id}
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      control={(aria) => (
        <>
          <label className={s.muestra} style={{ '--muestra': hex }} title="Elegir color">
            <input type="color" value={hex} onChange={(e) => onCambiar?.(e.target.value)} aria-label={`${etiqueta || 'Color'}: elegir`} />
          </label>
          <input {...aria} className={campo.input} value={valor} placeholder="#ffffff" spellCheck={false} maxLength={7} onChange={(e) => onCambiar?.(e.target.value.trim())} />
        </>
      )}
    />
  );
}

/**
 * Varios colores en fila (los gajos de la ruleta, una paleta): cada muestra
 * abre el selector del sistema; la × la quita y el + agrega uno.
 *  - etiqueta · ayuda · colores: ['#hex'] · onCambiar(lista)
 *  - min (2: con menos no se puede quitar) · max (8) · nuevo ('#6D28D9', el que se agrega)
 */
export function CampoColores({ etiqueta, ayuda, colores = [], onCambiar, min = 2, max = 8, nuevo = '#6D28D9' }) {
  const id = useId();
  return (
    <div className={campo.campo} data-componente="CampoColores">
      {etiqueta && <span id={id} className={campo.etiqueta}>{etiqueta}</span>}
      <span className={s.colores} role="group" aria-labelledby={etiqueta ? id : undefined}>
        {colores.map((color, i) => {
          const hex = hexValido(color) || '#ffffff';
          return (
            <span key={i} className={s.colorItem}>
              <label className={`${s.muestra} ${s.colorMuestra}`} style={{ '--muestra': hex }} title="Cambiar el color">
                <input type="color" value={hex} aria-label={`Color ${i + 1}`} onChange={(e) => onCambiar?.(colores.map((x, j) => (j === i ? e.target.value : x)))} />
              </label>
              {colores.length > min && (
                <button type="button" className={s.colorQuitar} aria-label={`Quitar el color ${i + 1}`} onClick={() => onCambiar?.(colores.filter((_, j) => j !== i))}>
                  <X aria-hidden="true" />
                </button>
              )}
            </span>
          );
        })}
        {colores.length < max && <Boton soloIcono tamano="sm" variante="secundario" icono={<Plus aria-hidden="true" />} aria-label="Agregar un color" onClick={() => onCambiar?.([...colores, nuevo])} />}
      </span>
      {ayuda && <span className={campo.ayuda}>{ayuda}</span>}
    </div>
  );
}

/**
 * Elegir una opción con un toque (para quién es, la edad): botones en fila.
 * La elegida va llena; la sugerida (lo que se deduce, sin guardar) con
 * borde punteado. Tocar la elegida la quita (vuelve a la sugerencia).
 *  - opciones: [{ valor, texto }] · valor · sugerido · onElegir(valor | null)
 *  - etiqueta (para lectores) · disabled
 */
export function ElegirUno({ opciones = [], valor, sugerido, onElegir, etiqueta, disabled = false }) {
  const hay = valor !== null && valor !== undefined && valor !== '';
  return (
    <span className={s.elegirUno} role="group" aria-label={etiqueta} data-componente="ElegirUno">
      {opciones.map((o) => {
        const elegida = hay && String(valor) === String(o.valor);
        const sugerida = !hay && sugerido !== null && sugerido !== undefined && String(sugerido) === String(o.valor);
        return (
          <button
            key={o.valor}
            type="button"
            className={[s.opcionUno, elegida && s.opcionElegida, sugerida && s.opcionSugerida].filter(Boolean).join(' ')}
            aria-pressed={elegida}
            title={sugerida ? 'Sugerido: tócalo para guardarlo' : elegida ? 'Tócalo otra vez para quitarlo' : undefined}
            disabled={disabled}
            onClick={() => onElegir?.(elegida ? null : o.valor)}
          >
            {o.texto}
          </button>
        );
      })}
    </span>
  );
}

/**
 * Elegir una entre muestras que se ven (temas, degradados, texturas): un
 * cuadro con la muestra y, en las grandes, su nombre debajo. La elegida lleva
 * el borde violeta y el visto.
 *  - opciones: [{ valor, nombre, estilo (el style del cuadro), contenido }]
 *  - valor · onElegir(valor) · etiqueta (para lectores)
 *  - tamano: 'grande' (con nombre, en rejilla) | 'chica' (solo el cuadro)
 */
export function ElegirMuestra({ opciones = [], valor, onElegir, etiqueta, tamano = 'grande' }) {
  return (
    <span className={[s.elegirMuestra, tamano === 'grande' && s.elegirMuestraGrande].filter(Boolean).join(' ')} role="group" aria-label={etiqueta} data-componente="ElegirMuestra">
      {opciones.map((o) => {
        const elegida = valor !== null && valor !== undefined && String(valor) === String(o.valor);
        return (
          <button
            key={o.valor}
            type="button"
            className={[s.muestraOpcion, elegida && s.muestraOpcionElegida].filter(Boolean).join(' ')}
            aria-pressed={elegida}
            aria-label={o.nombre}
            title={o.nombre}
            onClick={() => onElegir?.(o.valor)}
          >
            <span className={s.muestraOpcionCuadro} style={o.estilo}>
              {o.contenido}
              {elegida && <span className={s.muestraOpcionVisto} aria-hidden="true"><Check /></span>}
            </span>
            {tamano === 'grande' && o.nombre && <span className={s.muestraOpcionNombre}>{o.nombre}</span>}
          </button>
        );
      })}
    </span>
  );
}

/* ── Cambios sin guardar ───────────────────────────────── */

/**
 * Para las páginas que se editan enteras (los avisos automáticos, la
 * encuesta): aparece fija abajo solo cuando hay cambios, con Descartar y
 * Guardar. Sin cambios, no hay nada que guardar ni botón.
 *  - visible · texto ('Tienes cambios sin guardar.') · onDescartar ·
 *    onGuardar · guardando · puedeGuardar (false: Guardar apagado; `texto` dice por qué)
 */
export function BarraGuardar({ visible, texto = 'Tienes cambios sin guardar.', onDescartar, onGuardar, guardando = false, puedeGuardar = true, textoGuardar = 'Guardar cambios' }) {
  useEsconderPrincipal(visible);
  if (!visible) return null;
  return (
    <div className={s.barraGuardar} role="region" aria-label="Cambios sin guardar" data-componente="BarraGuardar">
      <span>{texto}</span>
      {onDescartar && <Boton tamano="sm" variante="fantasma" onClick={onDescartar} disabled={guardando}>Descartar</Boton>}
      <Boton tamano="sm" icono={<Save aria-hidden="true" />} cargando={guardando} disabled={!puedeGuardar} onClick={onGuardar}>{textoGuardar}</Boton>
    </div>
  );
}

/* ── Una lista de textos ───────────────────────────────── */

/**
 * Varios textos cortos que escribe el admin (las opciones de una pregunta,
 * los beneficios de un plan): chips que se quitan y un campo para sumar otro
 * (Enter o "Agregar"). Sin vacíos ni repetidos.
 *  - etiqueta · ayuda · valores: [texto] · onCambiar(valores) · placeholder · textoCampo
 */
export function CampoLista({ etiqueta, ayuda, valores = [], onCambiar, placeholder, textoCampo = 'Agregar otro' }) {
  const [nuevo, setNuevo] = useState('');
  const sumar = () => { onCambiar?.(conOpcion(valores, nuevo)); setNuevo(''); };
  return (
    <div className={s.lista} data-componente="CampoLista">
      {etiqueta && <span className={s.listaEtiqueta}>{etiqueta}</span>}
      {ayuda && <span className={s.listaAyuda}>{ayuda}</span>}
      {valores.length > 0 && (
        <span className={s.listaChips}>
          {valores.map((v) => <Chip key={v} tamano="sm" onQuitar={() => onCambiar?.(valores.filter((x) => x !== v))}>{v}</Chip>)}
        </span>
      )}
      <span className={s.listaSumar}>
        <Campo etiqueta={textoCampo} placeholder={placeholder} value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sumar(); } }} />
        <Boton tamano="sm" variante="secundario" icono={<Plus aria-hidden="true" />} disabled={!nuevo.trim()} onClick={sumar}>Agregar</Boton>
      </span>
    </div>
  );
}
