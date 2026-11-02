import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Crop, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { HojaInferior, useToast } from '../../Feedback';
import { Campo, Deslizador } from '../../Formulario';
import { Chip } from '../../Etiquetas';
import { Visto } from '../../Marca';
import campo from '../../Formulario.module.css';
import s from './Producto.module.css';

/*
 * Piezas de la ficha de un producto (guía: guia/ADMIN.md, D2b): el encuadre
 * de la foto de la tarjeta, la galería, las tallas, elegir varios de una
 * lista (con crear) y elegir la marca. Datos y subidas por props.
 */

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Elegir qué parte de una foto se ve en la tarjeta (3:4, como la tienda),
 * sin cortar la foto: se guarda el recuadro en porcentajes.
 *  - abierta · src · valor: { percentages: { x, y, width, height } } o null
 *  - onListo(valor | null) (null: "Toda la foto") · onCancelar · proporcion (3 / 4)
 */
export function EncuadreFoto({ abierta, src, valor, onListo, onCancelar, proporcion = 3 / 4 }) {
  const caja = useRef(null);
  const [natural, setNatural] = useState(null); // { w, h }
  const [rect, setRect] = useState(null); // fracciones de la foto { x, y, w }
  const arrastre = useRef(null);

  useEffect(() => { if (abierta) { setNatural(null); setRect(null); } }, [abierta, src]);

  // El ancho máximo (fracción) para que el alto entre en la foto.
  const maxW = natural ? Math.min(1, proporcion * (natural.h / natural.w)) : 1;
  const altoDe = (w) => (natural ? (w * natural.w) / proporcion / natural.h : w);

  const alCargar = (e) => {
    const n = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
    setNatural(n);
    const p = valor?.percentages;
    const mw = Math.min(1, proporcion * (n.h / n.w));
    if (p && p.width > 0) setRect({ x: p.x / 100, y: p.y / 100, w: limitar(p.width / 100, 0.1, mw) });
    else setRect({ x: (1 - mw) / 2, y: (1 - (mw * n.w) / proporcion / n.h) / 2, w: mw });
  };

  const encajar = (r) => {
    const w = limitar(r.w, 0.1 * maxW, maxW);
    const h = altoDe(w);
    return { w, x: limitar(r.x, 0, 1 - w), y: limitar(r.y, 0, 1 - h) };
  };

  const empezar = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastre.current = { x: e.clientX, y: e.clientY, rect };
  };
  const mover = (e) => {
    const a = arrastre.current;
    const c = caja.current?.getBoundingClientRect();
    if (!a || !c) return;
    setRect(encajar({ ...a.rect, x: a.rect.x + (e.clientX - a.x) / c.width, y: a.rect.y + (e.clientY - a.y) / c.height }));
  };
  const soltar = () => { arrastre.current = null; };
  const zoom = (pct) => {
    if (!rect) return;
    const w = (pct / 100) * maxW;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + altoDe(rect.w) / 2;
    setRect(encajar({ w, x: cx - w / 2, y: cy - altoDe(w) / 2 }));
  };
  const teclas = (e) => {
    if (!rect) return;
    const paso = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (!d) return;
    e.preventDefault();
    setRect(encajar({ ...rect, x: rect.x + d[0], y: rect.y + d[1] }));
  };

  const listo = () => {
    if (!rect) return;
    onListo?.({ percentages: { x: rect.x * 100, y: rect.y * 100, width: rect.w * 100, height: altoDe(rect.w) * 100 } });
  };

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCancelar}
      titulo="Encuadrar para la tarjeta"
      tamano="lg"
      pie={(
        <>
          <Boton variante="fantasma" onClick={() => onListo?.(null)}>Toda la foto</Boton>
          <Boton onClick={listo} disabled={!rect}>Usar este encuadre</Boton>
        </>
      )}
    >
      <p className={s.ayudaEncuadre}>Arrastra el recuadro y usa el zoom: es lo que se ve en la tienda (3:4). La foto no se corta.</p>
      <div className={s.encuadre}>
        <div ref={caja} className={s.encuadreCaja}>
          {src && <img src={src} alt="" onLoad={alCargar} draggable={false} />}
          {rect && (
            <div
              className={s.recuadro}
              role="slider"
              tabIndex={0}
              aria-label="Encuadre: muévelo con las flechas"
              aria-valuetext={`${Math.round(rect.x * 100)} %, ${Math.round(rect.y * 100)} %`}
              style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${altoDe(rect.w) * 100}%` }}
              onPointerDown={empezar}
              onPointerMove={mover}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              onKeyDown={teclas}
            />
          )}
        </div>
      </div>
      {rect && (
        <Deslizador etiqueta="Zoom" valor={Math.round((rect.w / maxW) * 100)} min={20} max={100} formato={(v) => `${Math.round(100 / (v / 100))} %`} onChange={zoom} />
      )}
    </HojaInferior>
  );
}

/* La foto con su encuadre, como la ve la tarjeta. */
export function FotoEncuadrada({ src, encuadre, className, alt = '' }) {
  const p = encuadre?.percentages;
  const estilo = p && p.width > 0 ? {
    width: `${10000 / p.width}%`,
    height: `${10000 / p.height}%`,
    left: `${(-p.x * 100) / p.width}%`,
    top: `${(-p.y * 100) / p.height}%`,
    position: 'absolute',
    maxWidth: 'none',
  } : undefined;
  return (
    <span className={[s.fotoEncuadrada, className].filter(Boolean).join(' ')}>
      {src ? <img src={src} alt={alt} style={estilo} className={estilo ? undefined : s.fotoEntera} loading="lazy" /> : <ImagePlus aria-hidden="true" />}
    </span>
  );
}

/**
 * Las fotos de la galería: subir varias, el orden (la primera es la que
 * sale al pasar el mouse), encuadrar y quitar.
 *  - fotos: [url] · onCambiar(fotos) · encuadres: { url: encuadre } · onEncuadres(encuadres)
 *  - subir(archivo, { alAvanzar }) → promesa con la url · primera: el texto de la primera
 */
export function GaleriaFotos({ fotos = [], onCambiar, encuadres = {}, onEncuadres, subir, primera = 'Al pasar el mouse' }) {
  const toast = useToast();
  const entrada = useRef(null);
  const [subiendo, setSubiendo] = useState(null); // { hechas, total }
  const [encuadrando, setEncuadrando] = useState(null);

  const agregar = async (archivos) => {
    const imgs = [...archivos].filter((a) => a.type.startsWith('image/'));
    if (!imgs.length) return;
    let nuevas = [...fotos];
    setSubiendo({ hechas: 0, total: imgs.length });
    for (let i = 0; i < imgs.length; i += 1) {
      try {
        const r = await subir(imgs[i], {});
        const url = typeof r === 'string' ? r : r?.url;
        if (url) { nuevas = [...nuevas, url]; onCambiar?.(nuevas); }
      } catch (err) {
        toast({ tipo: 'error', titulo: `No se subió ${imgs[i].name}`, texto: err?.message || 'Vuelve a intentar.' });
      }
      setSubiendo({ hechas: i + 1, total: imgs.length });
    }
    setSubiendo(null);
  };
  const mover = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= fotos.length) return;
    const n = [...fotos];
    [n[i], n[j]] = [n[j], n[i]];
    onCambiar?.(n);
  };
  const quitar = (url) => {
    onCambiar?.(fotos.filter((u) => u !== url));
    if (encuadres[url]) { const e = { ...encuadres }; delete e[url]; onEncuadres?.(e); }
  };

  return (
    <div className={s.galeria} data-componente="GaleriaFotos">
      <ul className={s.galeriaLista}>
        {fotos.map((url, i) => (
          <li key={url} className={s.galeriaFoto}>
            <FotoEncuadrada src={url} encuadre={encuadres[url]} className={s.galeriaImagen} />
            <span className={s.galeriaNumero}>{i + 1}{i === 0 && primera ? ` · ${primera}` : ''}</span>
            <span className={s.galeriaAcciones}>
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Mover la foto ${i + 1} antes`}><ArrowLeft aria-hidden="true" /></button>
              <button type="button" onClick={() => setEncuadrando(url)} aria-label={`Encuadrar la foto ${i + 1}`} title="Encuadrar"><Crop aria-hidden="true" /></button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === fotos.length - 1} aria-label={`Mover la foto ${i + 1} después`}><ArrowRight aria-hidden="true" /></button>
              <button type="button" className={s.galeriaQuitar} onClick={() => quitar(url)} aria-label={`Quitar la foto ${i + 1}`} title="Quitar"><Trash2 aria-hidden="true" /></button>
            </span>
          </li>
        ))}
        {subir && (
          <li>
            <button type="button" className={s.galeriaAgregar} onClick={() => entrada.current?.click()} disabled={Boolean(subiendo)}>
              {subiendo ? <Loader2 className={s.girar} aria-hidden="true" /> : <Plus aria-hidden="true" />}
              <span>{subiendo ? `Subiendo ${subiendo.hechas + 1} de ${subiendo.total}…` : 'Agregar fotos'}</span>
            </button>
          </li>
        )}
      </ul>
      <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={(e) => { const a = e.target.files; agregar(a ? [...a] : []); e.target.value = ''; }} />
      <EncuadreFoto
        abierta={Boolean(encuadrando)}
        src={encuadrando}
        valor={encuadrando ? encuadres[encuadrando] : null}
        onCancelar={() => setEncuadrando(null)}
        onListo={(v) => {
          const e = { ...encuadres };
          if (v) e[encuadrando] = v; else delete e[encuadrando];
          onEncuadres?.(e);
          setEncuadrando(null);
        }}
      />
    </div>
  );
}

const TALLAS_POLERA = ['S', 'M', 'L', 'XL'];

/**
 * Las tallas de un color: se agregan con Enter, coma o al salir del campo,
 * sin repetir; "S a XL" pone las de polera.
 *  - etiqueta · tallas · onCambiar(tallas) · id
 */
export function CampoTallas({ etiqueta = 'Tallas', tallas = [], onCambiar, id }) {
  const [texto, setTexto] = useState('');
  const agregar = (t) => {
    const nuevas = String(t).split(',').map((x) => x.trim()).filter(Boolean);
    const lista = [...tallas];
    nuevas.forEach((n) => { if (!lista.some((x) => x.toLowerCase() === n.toLowerCase())) lista.push(n); });
    if (lista.length !== tallas.length) onCambiar?.(lista);
    setTexto('');
  };
  return (
    <div className={campo.campo}>
      <label htmlFor={id} className={campo.etiqueta}>{etiqueta}</label>
      <div className={s.tallas}>
        {tallas.map((t) => <Chip key={t} tamano="sm" activo onQuitar={() => onCambiar?.(tallas.filter((x) => x !== t))}>{t}</Chip>)}
        <input
          id={id}
          className={s.tallasCampo}
          value={texto}
          placeholder={tallas.length ? 'Otra…' : 'Ej. S, M, L'}
          onChange={(e) => { const v = e.target.value; if (v.includes(',')) agregar(v); else setTexto(v); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); agregar(texto); }
            if (e.key === 'Backspace' && !texto && tallas.length) onCambiar?.(tallas.slice(0, -1));
          }}
          onBlur={() => texto && agregar(texto)}
        />
      </div>
      <p className={campo.ayuda}>
        Enter o coma para sumar una. Sin tallas, se vende sin elegir talla.
        {!tallas.length && <button type="button" className={s.atajo} onClick={() => onCambiar?.(TALLAS_POLERA)}>Poner S a XL</button>}
      </p>
    </div>
  );
}

/**
 * Elegir varios de una lista (colecciones, personajes, etiquetas): los
 * elegidos como chips que se quitan y un campo para sumar otro o crearlo.
 *  - etiqueta · ayuda · opciones: [{ valor, texto }] · valor: [valores] · onCambiar(valores)
 *  - onCrear(nombre) → promesa con { valor, texto } (sin él, no se crea) · placeholder · id
 */
export function ElegirVarios({ etiqueta, ayuda, opciones = [], valor = [], onCambiar, onCrear, placeholder = 'Agregar…', id }) {
  const toast = useToast();
  const [creando, setCreando] = useState(false);
  const elegidos = valor.map((v) => opciones.find((o) => o.valor === v) || { valor: v, texto: v });
  const libres = opciones.filter((o) => !valor.includes(o.valor));
  const sumar = async (v) => {
    if (!v) return;
    if (opciones.some((o) => o.valor === v)) { onCambiar?.([...new Set([...valor, v])]); return; }
    const existe = opciones.find((o) => o.texto.trim().toLowerCase() === String(v).trim().toLowerCase());
    if (existe) { onCambiar?.([...new Set([...valor, existe.valor])]); return; }
    if (!onCrear) return;
    setCreando(true);
    try {
      const nuevo = await onCrear(String(v).trim());
      if (nuevo?.valor) onCambiar?.([...new Set([...valor, nuevo.valor])]);
      toast({ tipo: 'exito', titulo: `Creado: ${nuevo?.texto || v}` });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo crear', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setCreando(false);
    }
  };
  return (
    <div className={s.varios} data-componente="ElegirVarios">
      <Campo
        id={id}
        etiqueta={etiqueta}
        ayuda={creando ? 'Creando…' : ayuda}
        opciones={libres}
        creable={Boolean(onCrear)}
        buscable
        placeholder={placeholder}
        value=""
        disabled={creando}
        onChange={(e) => sumar(e.target.value)}
      />
      {elegidos.length > 0 && (
        <div className={s.variosChips}>
          {elegidos.map((o) => <Chip key={o.valor} tamano="sm" activo onQuitar={() => onCambiar?.(valor.filter((x) => x !== o.valor))}>{o.texto}</Chip>)}
        </div>
      )}
    </div>
  );
}

/**
 * Elegir la marca de un producto: su logo y su nombre; tocar la elegida la quita.
 *  - marcas: [{ id, nombre, logo }] · valor · onCambiar(id | '') · etiqueta · ayuda
 */
export function ElegirMarca({ marcas = [], valor, onCambiar, etiqueta = 'Marca', ayuda }) {
  return (
    <div className={campo.campo}>
      <span className={campo.etiqueta}>{etiqueta}</span>
      <div className={s.marcas} role="radiogroup" aria-label={etiqueta}>
        {marcas.map((m) => {
          const elegida = m.id === valor;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={elegida} className={[s.marca, elegida && s.marcaElegida].filter(Boolean).join(' ')} onClick={() => onCambiar?.(elegida ? '' : m.id)}>
              <span className={s.marcaLogo}>{m.logo ? <img src={m.logo} alt="" loading="lazy" /> : m.nombre.slice(0, 1)}</span>
              <span className={s.marcaNombre}>{m.nombre}</span>
              {elegida && <Visto activo tamano={18} className={s.marcaVisto} />}
            </button>
          );
        })}
      </div>
      {ayuda && <p className={campo.ayuda}>{ayuda}</p>}
    </div>
  );
}

