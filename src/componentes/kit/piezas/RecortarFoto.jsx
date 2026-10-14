import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Boton from '../Boton';
import { HojaInferior } from '../Feedback';
import s from './RecortarFoto.module.css';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Recortar una foto antes de subirla (foto de perfil, foto de una persona en
 * Fechas importantes). Se arrastra para moverla y se hace zoom con la barra,
 * con dos dedos o con la rueda del ratón. Sale un JPG cuadrado (el círculo es
 * solo la guía).
 *  - abierta · src: la imagen elegida (URL.createObjectURL(archivo))
 *  - onListo(blob): promesa (subir y guardar); mientras, "Guardando…"
 *  - onCancelar · forma: 'circulo' | 'cuadrado' · tamano: px de salida (512)
 *  - titulo, texto
 */
export function RecortarFoto({
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
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => cambiarZoom(Number(e.target.value))}
            aria-label="Zoom de la foto"
            style={{ '--avance': `${((zoom - 1) / 2) * 100}%` }}
          />
          <button type="button" className={s.paso} onClick={() => cambiarZoom(zoom + 0.2)} aria-label="Acercar"><Plus aria-hidden="true" /></button>
        </div>
      </div>
    </HojaInferior>
  );
}
