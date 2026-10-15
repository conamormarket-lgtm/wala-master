import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Scissors, RotateCcw } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, HojaInferior } from '../Feedback';
import { Deslizador } from '../Formulario';
import { cargarImagen, cajaVisible, recortarImagen } from '../imagenes';
import s from './RecortarFoto.module.css';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Recortar una foto.
 *  - forma 'circulo' | 'cuadrado': antes de subirla (foto de perfil, foto de
 *    una persona en Fechas importantes). Se arrastra para moverla y se hace
 *    zoom con la barra, con dos dedos o con la rueda. Sale un JPG cuadrado de
 *    `tamano` px (el círculo es solo la guía). onListo(blob).
 *  - forma 'libre': una imagen del diseño (el estudio). Un recuadro sobre la
 *    imagen entera que se mueve y se ajusta desde sus esquinas, "Quitar bordes
 *    transparentes" y "Restablecer"; Enter aplica y Esc cancela. Sale un PNG
 *    (conserva la transparencia): onListo(blob, { corte, natural }) con
 *    `corte` en px de la imagen ({ x, y, w, h }); blob null si no cambió.
 *  - abierta · src · onListo: promesa (mientras, "Guardando…") · onCancelar ·
 *    titulo, texto
 */
export function RecortarFoto(props) {
  return props.forma === 'libre' ? <RecortarLibre {...props} /> : <RecortarFija {...props} />;
}

function RecortarFija({
  abierta, src, onListo, onCancelar, forma = 'circulo', tamano = 512,
  titulo = 'Recorta tu foto', texto = 'Arrastra la imagen y usa el zoom para elegir cómo se va a ver.',
}) {
  const escenario = useRef(null);
  const imagen = useRef(null);
  const [natural, setNatural] = useState(null);
  const [lado, setLado] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [guardando, setGuardando] = useState(false);
  const punteros = useRef(new Map());
  const inicio = useRef(null);

  useEffect(() => { setZoom(1); setPos({ x: 0, y: 0 }); setNatural(null); }, [src]);
  useEffect(() => {
    if (!abierta) return undefined;
    const medir = () => setLado(escenario.current?.clientWidth || 280);
    const t = window.setTimeout(medir, 50);
    window.addEventListener('resize', medir);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', medir); };
  }, [abierta]);

  // La imagen siempre cubre el recuadro: escala base "cover" × zoom.
  const base = natural ? Math.max(lado / natural.w, lado / natural.h) : 1;
  const ancho = natural ? natural.w * base * zoom : lado;
  const alto = natural ? natural.h * base * zoom : lado;
  const encajar = (p, z = zoom) => {
    if (!natural) return p;
    const mx = (natural.w * base * z - lado) / 2;
    const my = (natural.h * base * z - lado) / 2;
    return { x: limitar(p.x, -mx, mx), y: limitar(p.y, -my, my) };
  };
  const cambiarZoom = (z) => {
    const nz = limitar(z, 1, 3);
    setZoom(nz);
    setPos((p) => encajar(p, nz));
  };

  const bajar = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    inicio.current = { pos, zoom, punteros: new Map(punteros.current) };
  };
  const mover = (e) => {
    if (!punteros.current.has(e.pointerId) || !inicio.current) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ahora = [...punteros.current.values()];
    const antes = [...inicio.current.punteros.values()];
    if (ahora.length >= 2 && antes.length >= 2) {
      // Dos dedos: zoom con la distancia.
      const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      cambiarZoom(inicio.current.zoom * (d(ahora[0], ahora[1]) / Math.max(1, d(antes[0], antes[1]))));
    } else if (ahora.length === 1 && antes.length >= 1) {
      const dx = ahora[0].x - antes[0].x;
      const dy = ahora[0].y - antes[0].y;
      setPos(encajar({ x: inicio.current.pos.x + dx, y: inicio.current.pos.y + dy }));
    }
  };
  const subir = (e) => {
    punteros.current.delete(e.pointerId);
    inicio.current = punteros.current.size ? { pos, zoom, punteros: new Map(punteros.current) } : null;
  };
  const rueda = (e) => { e.preventDefault(); cambiarZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93)); };
  useEffect(() => {
    const el = escenario.current;
    if (!abierta || !el) return undefined;
    el.addEventListener('wheel', rueda, { passive: false });
    return () => el.removeEventListener('wheel', rueda);
  });

  const usar = async () => {
    if (!natural || !imagen.current) return;
    const escala = base * zoom;
    const izq = lado / 2 + pos.x - ancho / 2;
    const arr = lado / 2 + pos.y - alto / 2;
    const lienzo = document.createElement('canvas');
    lienzo.width = tamano;
    lienzo.height = tamano;
    const ctx = lienzo.getContext('2d');
    ctx.drawImage(imagen.current, -izq / escala, -arr / escala, lado / escala, lado / escala, 0, 0, tamano, tamano);
    const blob = await new Promise((r) => { lienzo.toBlob(r, 'image/jpeg', 0.92); });
    setGuardando(true);
    try { await onListo?.(blob); } finally { setGuardando(false); }
  };

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={() => !guardando && onCancelar?.()}
      titulo={titulo}
      pie={(
        <div className={s.botones}>
          <Boton variante="fantasma" onClick={onCancelar} disabled={guardando}>Cancelar</Boton>
          <Boton onClick={usar} cargando={guardando} disabled={!natural}>Usar esta foto</Boton>
        </div>
      )}
    >
      <div className={s.recortar}>
        <p className={s.texto}>{texto}</p>
        <div
          ref={escenario}
          className={[s.escenario, forma === 'circulo' && s.circulo].filter(Boolean).join(' ')}
          onPointerDown={bajar}
          onPointerMove={mover}
          onPointerUp={subir}
          onPointerCancel={subir}
          role="img"
          aria-label="Vista previa del recorte"
        >
          {src && (
            <img
              ref={imagen}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={{ width: ancho, height: alto, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
            />
          )}
          <span className={s.guia} aria-hidden="true" />
        </div>
        <div className={s.zoom}>
          <button type="button" className={s.paso} onClick={() => cambiarZoom(zoom - 0.2)} aria-label="Alejar"><Minus aria-hidden="true" /></button>
          <Deslizador soloBarra etiqueta="Zoom de la foto" min={1} max={3} paso={0.01} valor={zoom} onChange={cambiarZoom} />
          <button type="button" className={s.paso} onClick={() => cambiarZoom(zoom + 0.2)} aria-label="Acercar"><Plus aria-hidden="true" /></button>
        </div>
      </div>
    </HojaInferior>
  );
}

const COMPLETA = { x: 0, y: 0, w: 1, h: 1 };
const MINIMO = 0.04;
const ESQUINAS = [['no', 'arriba a la izquierda'], ['ne', 'arriba a la derecha'], ['so', 'abajo a la izquierda'], ['se', 'abajo a la derecha']];

/** Recorte libre de una imagen del diseño (ver RecortarFoto, forma 'libre'). */
function RecortarLibre({
  abierta, src, onListo, onCancelar,
  titulo = 'Recortar la imagen', texto = 'Arrastra el recuadro y ajústalo desde sus esquinas. Solo se usará lo que quede adentro.',
}) {
  const caja = useRef(null);
  const arrastre = useRef(null);
  const [img, setImg] = useState(null);
  const [rect, setRect] = useState(COMPLETA);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierta || !src) return undefined;
    let vigente = true;
    setImg(null);
    setRect(COMPLETA);
    setAviso('');
    cargarImagen(src).then((i) => vigente && setImg(i)).catch(() => vigente && setAviso('No pudimos abrir la imagen.'));
    return () => { vigente = false; };
  }, [abierta, src]);

  const empezar = (modo) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastre.current = { modo, x0: e.clientX, y0: e.clientY, rect: { ...rect } };
  };
  const mover = (e) => {
    const a = arrastre.current;
    const c = caja.current?.getBoundingClientRect();
    if (!a || !c) return;
    const dx = (e.clientX - a.x0) / c.width;
    const dy = (e.clientY - a.y0) / c.height;
    const r = a.rect;
    if (a.modo === 'mover') {
      setRect({ ...r, x: limitar(r.x + dx, 0, 1 - r.w), y: limitar(r.y + dy, 0, 1 - r.h) });
      return;
    }
    let { x, y, w, h } = r;
    if (a.modo.includes('o')) { const nx = limitar(r.x + dx, 0, r.x + r.w - MINIMO); w = r.w + (r.x - nx); x = nx; }
    if (a.modo.includes('e')) w = limitar(r.w + dx, MINIMO, 1 - r.x);
    if (a.modo.includes('n')) { const ny = limitar(r.y + dy, 0, r.y + r.h - MINIMO); h = r.h + (r.y - ny); y = ny; }
    if (a.modo.includes('s')) h = limitar(r.h + dy, MINIMO, 1 - r.y);
    setRect({ x, y, w, h });
  };
  const soltar = () => { arrastre.current = null; };

  // Con el teclado: las flechas mueven el recuadro (Shift, más rápido).
  const teclaRecuadro = (e) => {
    const paso = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    setRect((r) => ({ ...r, x: limitar(r.x + d[0], 0, 1 - r.w), y: limitar(r.y + d[1], 0, 1 - r.h) }));
  };

  const quitarBordes = () => {
    if (!img) return;
    const visible = cajaVisible(img);
    if (!visible) { setAviso('Esta imagen no tiene bordes transparentes que quitar.'); return; }
    setAviso('');
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    setRect({ x: visible.x / W, y: visible.y / H, w: visible.w / W, h: visible.h / H });
  };

  const aplicar = async () => {
    if (!img || guardando) return;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const natural = { w: W, h: H };
    const sinCambios = rect.x < 0.002 && rect.y < 0.002 && rect.w > 0.996 && rect.h > 0.996;
    setGuardando(true);
    try {
      if (sinCambios) { await onListo?.(null, { corte: null, natural }); return; }
      const corte = { x: rect.x * W, y: rect.y * H, w: rect.w * W, h: rect.h * H };
      const { blob } = await recortarImagen(img, corte);
      await onListo?.(blob, { corte, natural });
    } catch {
      setAviso('No pudimos recortar la imagen. Prueba con una más liviana.');
    } finally {
      setGuardando(false);
    }
  };

  // Enter aplica, Esc cancela (con la hoja abierta).
  const teclas = useRef(null);
  teclas.current = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancelar?.(); } else if (e.key === 'Enter') { e.preventDefault(); aplicar(); }
  };
  useEffect(() => {
    if (!abierta) return undefined;
    const f = (e) => teclas.current?.(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [abierta]);

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={() => !guardando && onCancelar?.()}
      titulo={titulo}
      pie={(
        <div className={s.botones}>
          <Boton variante="fantasma" onClick={onCancelar} disabled={guardando} title="Cancelar (Esc)">Cancelar</Boton>
          <Boton onClick={aplicar} cargando={guardando} disabled={!img} title="Aplicar (Enter)">Aplicar recorte</Boton>
        </div>
      )}
    >
      <div className={s.recortar}>
        <p className={s.texto}>{texto}</p>
        <div className={s.areaLibre}>
          {img ? (
            <div ref={caja} className={s.cajaLibre} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
              <img src={src} alt="Imagen a recortar" className={s.imagenLibre} draggable={false} />
              <div
                className={s.recuadro}
                style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                onPointerDown={empezar('mover')}
                onKeyDown={teclaRecuadro}
                role="slider"
                tabIndex={0}
                aria-label="Recuadro del recorte (muévelo con las flechas)"
                aria-valuetext={`${Math.round(rect.w * 100)} % de ancho, ${Math.round(rect.h * 100)} % de alto`}
              >
                {ESQUINAS.map(([esquina, nombre]) => (
                  <span key={esquina} className={[s.esquina, s[`esquina_${esquina}`]].join(' ')} onPointerDown={empezar(esquina)} title={`Esquina ${nombre}`} aria-hidden="true" />
                ))}
              </div>
            </div>
          ) : (
            <p className={s.texto}>{aviso || 'Cargando imagen…'}</p>
          )}
        </div>
        {img && aviso && <Aviso compacto tipo="info">{aviso}</Aviso>}
        <div className={s.accionesLibre}>
          <Boton variante="contorno" tamano="sm" icono={<Scissors aria-hidden="true" />} onClick={quitarBordes} disabled={!img || guardando}>Quitar bordes transparentes</Boton>
          <Boton variante="fantasma" tamano="sm" icono={<RotateCcw aria-hidden="true" />} onClick={() => { setRect(COMPLETA); setAviso(''); }} disabled={!img || guardando}>Restablecer</Boton>
        </div>
      </div>
    </HojaInferior>
  );
}
