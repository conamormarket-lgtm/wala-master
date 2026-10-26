import React, { useEffect, useRef, useState } from 'react';
import { Casilla } from '../../componentes/kit/Formulario';
import { Texto } from '../../componentes/kit/Traduccion';
import { areaVistaYoryo, cajaSeccion, esDistribucionEditable } from '../../utils/distribucionYoryo.mjs';
import { svgComoUrl } from '../../pages/Crear/arteYoryo.mjs';
import s from './PersonalizadorYoryo.module.css';

export default function LienzoYoryo({ producto, datos, svg, elementos, modo, activa, onActiva, onMover, disabled }) {
  const config = producto.personalizacionYoryo;
  const laser = config.tecnica === 'laser';
  const editable = esDistribucionEditable(datos);
  const [guias, setGuias] = useState(true);
  const zonaRef = useRef(null);
  const arrastre = useRef(null);
  useEffect(() => {
    const terminar = () => { arrastre.current = null; };
    window.addEventListener('pointerup', terminar, true);
    window.addEventListener('pointercancel', terminar, true);
    window.addEventListener('blur', terminar);
    return () => { window.removeEventListener('pointerup', terminar, true); window.removeEventListener('pointercancel', terminar, true); window.removeEventListener('blur', terminar); };
  }, []);
  const area = modo === 'producto' ? areaVistaYoryo(config, datos) : { x: 0, y: 0, w: 1, h: 1 };
  const empezar = (e, elemento) => {
    if (disabled) return;
    e.preventDefault(); onActiva(elemento.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { id: elemento.id, inicioX: e.clientX, inicioY: e.clientY, elemento, rect: zonaRef.current.getBoundingClientRect() };
  };
  const mover = (e) => {
    const a = arrastre.current;
    if (!a || disabled) return;
    if (!e.buttons) { arrastre.current = null; return; }
    const caja = cajaSeccion({ x: a.elemento.centroX + (e.clientX - a.inicioX) / a.rect.width, y: a.elemento.centroY + (e.clientY - a.inicioY) / a.rect.height }, a.elemento.w, a.elemento.h);
    onMover(a.id, { x: caja.centroX, y: caja.centroY });
  };
  const terminar = (e) => {
    arrastre.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const teclado = (e, elemento) => {
    const movimientos = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!movimientos[e.key] || disabled) return;
    e.preventDefault();
    const [dx, dy] = movimientos[e.key], paso = e.shiftKey ? .05 : .01;
    const caja = cajaSeccion({ x: elemento.centroX + dx * paso, y: elemento.centroY + dy * paso }, elemento.w, elemento.h);
    onMover(elemento.id, { x: caja.centroX, y: caja.centroY });
  };
  return <>
    <div className={modo === 'producto' ? s.modelo : `${s.arte} ${s.plano} ${laser ? s.laser : s.impresion}`} style={modo === 'plano' ? { aspectRatio: 1 / config.proporcion } : undefined}>
      {modo === 'producto' && <img className={s.base} src={producto.variants?.[0]?.imageUrl || producto.mainImage || producto.images?.[0]} alt={producto.name} />}
      <div ref={zonaRef} className={`${s.zonaPersonalizable} ${editable && guias ? s.conGuias : ''}`} style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%` }}>
        {svg && <img className={`${s.dibujo} ${laser ? s.grabado : ''}`} src={svgComoUrl(svg)} alt={`Diseño de ${config.nombre} para ${datos.nombre || 'personalizar'}`} draggable={false} />}
        {editable && guias && <span className={s.rotuloArea}><Texto>{laser ? 'Área de grabado' : 'Área de impresión'}</Texto></span>}
        {editable && elementos.map((el) => <button key={el.id} type="button" aria-label={`Mover ${el.nombre.toLowerCase()}`} aria-pressed={activa === el.id} disabled={disabled} className={`${s.elementoMovible} ${activa === el.id && guias ? s.elementoActivo : ''}`} style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, zIndex: activa === el.id ? 2 : 1 }} onClick={(e) => { if (e.detail === 0) onActiva(el.id); }} onPointerDown={(e) => empezar(e, el)} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar} onLostPointerCapture={terminar} onKeyDown={(e) => teclado(e, el)}><span className={s.nombreElemento}>{el.nombre}</span></button>)}
      </div>
    </div>
    {editable && <Casilla etiqueta="Mostrar área y selección" activo={guias} onChange={setGuias} />}
  </>;
}
