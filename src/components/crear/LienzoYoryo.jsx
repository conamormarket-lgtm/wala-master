import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MoveDiagonal2 } from 'lucide-react';
import { Casilla } from '../../componentes/kit/Formulario';
import { Texto } from '../../componentes/kit/Traduccion';
import { HojaInferior } from '../../componentes/kit/Feedback';
import { AtajosEstudio, BarraLienzo, MOD_ESTUDIO as MOD } from '../../componentes/kit/piezas/Estudio';
import { ajusteSeccion, areaVistaYoryo, esDistribucionEditable, seccionesYoryo } from '../../utils/distribucionYoryo.mjs';
import { limitarCamaraYoryo, transformarSeccionYoryo, zoomCamaraYoryo } from '../../utils/gestosYoryo.mjs';
import { svgComoUrl } from '../../pages/Crear/arteYoryo.mjs';
import s from './PersonalizadorYoryo.module.css';

const gruposAyuda = [
  { titulo: 'General', atajos: [[[[MOD, 'Z']], 'Deshacer'], [[[MOD, 'Shift', 'Z'], [MOD, 'Y']], 'Rehacer'], [[[MOD, 'S']], 'Guardar avance'], [[['?']], 'Ver atajos y gestos']] },
  { titulo: 'Sección elegida', atajos: [[[['←', '↑', '→', '↓']], 'Mover (Shift: pasos más grandes)'], [[['+'], ['−']], 'Agrandar / achicar'], [[['C']], 'Centrar horizontalmente'], [[['1'], ['2'], ['3'], ['4']], 'Elegir sección'], [[['Esc']], 'Cancelar el movimiento actual'], [[['Doble clic'], ['Dos toques']], 'Editar el contenido en el panel']] },
  { titulo: 'Vista y gestos', atajos: [[[[MOD, '+'], [MOD, '−']], 'Acercar / alejar la vista'], [[[MOD, '0']], 'Ver el producto completo'], [[[MOD, 'Rueda']], 'Zoom de la vista'], [[['Espacio', 'Arrastrar']], 'Recorrer la vista ampliada'], [[['Un dedo']], 'Mover la sección'], [[['Dos dedos']], 'Agrandar o achicar la sección elegida'], [[['Esquina']], 'Arrastrar el control para cambiar el tamaño']] },
];

const ImagenSeccion = memo(function ImagenSeccion({ fragmento, anchoSvg, altoSvg, laser }) {
  const src = useMemo(() => svgComoUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${anchoSvg} ${altoSvg}">${fragmento}</svg>`), [fragmento, anchoSvg, altoSvg]);
  return <img className={`${s.dibujo} ${laser ? s.grabado : ''}`} src={src} alt="" draggable={false} />;
});

export default function LienzoYoryo(props) {
  const { producto, datos, svg, elementos, fondo, modo, activa, onActiva, onMover, onInteractuando, disabled, puedeDeshacer, puedeRehacer } = props;
  const config = producto.personalizacionYoryo, laser = config.tecnica === 'laser', editable = esDistribucionEditable(datos);
  const [guias, setGuias] = useState(true), [ayuda, setAyuda] = useState(false), [zoom, setZoom] = useState(100);
  const visorRef = useRef(null), mundoRef = useRef(null), zonaRef = useRef(null), imanRef = useRef(null);
  const nodos = useRef(new Map()), cajas = useRef(new Map()), punteros = useRef(new Map());
  const gesto = useRef(null), frame = useRef(0), camara = useRef({ z: 1, x: 0, y: 0 }), espacio = useRef(false), ultimoToque = useRef(null), acciones = useRef(null);
  const area = modo === 'producto' ? areaVistaYoryo(config, datos) : { x: 0, y: 0, w: 1, h: 1 };
  const restaurarNodos = () => { nodos.current.forEach((n) => { if (n) n.style.transform = ''; }); if (imanRef.current) imanRef.current.hidden = true; };
  useLayoutEffect(() => { cajas.current = new Map(elementos.map((e) => [e.id, e])); if (!gesto.current) restaurarNodos(); }, [elementos]);

  const pintar = () => {
    frame.current = 0;
    const g = gesto.current; if (!g?.caja || !g.elemento) return;
    const n = nodos.current.get(g.elemento.id), c = g.caja, el = g.elemento;
    if (n) n.style.transform = `translate3d(${(c.x - el.x) / el.w * 100}%, ${(c.y - el.y) / el.h * 100}%, 0) scale(${c.w / el.w}, ${c.h / el.h})`;
    if (imanRef.current) imanRef.current.hidden = !c.iman;
  };
  const programar = () => { if (!frame.current) frame.current = requestAnimationFrame(pintar); };
  const pintarCamara = (valor) => {
    const r = visorRef.current.getBoundingClientRect(); camara.current = limitarCamaraYoryo(valor, r.width, r.height);
    const c = camara.current; mundoRef.current.style.transform = `translate3d(${c.x}px,${c.y}px,0) scale(${c.z})`; setZoom(Math.round(c.z * 100));
  };
  const acercar = (factor, punto) => { const r = visorRef.current.getBoundingClientRect(); pintarCamara(zoomCamaraYoryo(camara.current, factor, r.width, r.height, punto)); };
  const editarContenido = (id) => { onActiva(id); requestAnimationFrame(() => visorRef.current.closest('[data-componente="PaginaEstudio"]')?.querySelector('input:not([type=file]):not([type=range]):not([type=checkbox]), textarea')?.focus()); };
  const cancelar = () => { if (frame.current) cancelAnimationFrame(frame.current); frame.current = 0; gesto.current = null; punteros.current.clear(); restaurarNodos(); onInteractuando?.(false); };
  const terminar = (id) => {
    punteros.current.delete(id); const g = gesto.current; if (!g || punteros.current.size) return;
    if (frame.current) { cancelAnimationFrame(frame.current); pintar(); }
    gesto.current = null; if (imanRef.current) imanRef.current.hidden = true; onInteractuando?.(false);
    if (g.elemento && g.caja && g.movido) { cajas.current.set(g.elemento.id, { ...g.elemento, ...g.caja }); onMover(g.elemento.id, { x: g.caja.centroX, y: g.caja.centroY, ...(g.tipo !== 'mover' && { escala: g.caja.escala }) }); }
    else restaurarNodos();
  };
  const empezar = (e, elemento, tipo = 'mover') => {
    if (disabled || e.button > 0 && e.button !== 1) return;
    if (e.pointerType === 'touch' || elemento || espacio.current || e.button === 1) e.preventDefault(); e.stopPropagation();
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* el contacto ya terminó */ }
    if (gesto.current && punteros.current.size === 2 && gesto.current.elemento) {
      const p = [...punteros.current.values()], g = gesto.current; g.tipo = 'pellizco';
      g.distancia = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y); g.medio = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      g.base = { ...g.elemento, ...(g.caja || {}) }; g.escalaBase = g.caja?.escala || g.escala; return;
    }
    if (gesto.current) return;
    if (!elemento && !espacio.current && e.button !== 1) { punteros.current.delete(e.pointerId); return; }
    const el = elemento && (cajas.current.get(elemento.id) || elemento), seccion = el && seccionesYoryo(datos, config).find((s) => s.id === el.id);
    gesto.current = { tipo: espacio.current || e.button === 1 || !el ? 'camara' : tipo, elemento: el, rect: zonaRef.current.getBoundingClientRect(), x: e.clientX, y: e.clientY, escala: seccion ? ajusteSeccion(datos, seccion).escala : 100, camara: { ...camara.current }, movido: false };
    if (el) { onActiva(el.id); e.currentTarget.focus({ preventScroll: true }); } onInteractuando?.(true);
  };
  const mover = (e) => {
    if (punteros.current.has(e.pointerId)) punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current; if (!g || disabled) return;
    if (!e.buttons && e.pointerType !== 'touch') { terminar(e.pointerId); return; }
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.tipo === 'camara') { pintarCamara({ ...g.camara, x: g.camara.x + dx, y: g.camara.y + dy }); return; }
    if (g.tipo === 'pellizco') {
      if (punteros.current.size < 2) return;
      const p = [...punteros.current.values()], distancia = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      g.caja = transformarSeccionYoryo(g.base, { dx: ((p[0].x + p[1].x) / 2 - g.medio.x) / g.rect.width, dy: ((p[0].y + p[1].y) / 2 - g.medio.y) / g.rect.height, factor: distancia / Math.max(1, g.distancia), escala: g.escalaBase });
    } else if (g.tipo === 'tamano') {
      const w = g.elemento.w * g.rect.width, h = g.elemento.h * g.rect.height;
      g.caja = transformarSeccionYoryo(g.elemento, { factor: 1 + (dx * w + dy * h) / (w * w + h * h), escala: g.escala });
    } else g.caja = transformarSeccionYoryo(g.elemento, { dx: dx / g.rect.width, dy: dy / g.rect.height, escala: g.escala, eje: e.shiftKey, iman: e.altKey ? 0 : 6 / g.rect.width });
    g.movido ||= Math.hypot(dx, dy) > 2 || g.tipo === 'pellizco'; programar();
  };
  const soltar = (e) => {
    const g = gesto.current;
    if (g?.elemento && !g.movido && e.pointerType === 'touch') { const ahora = Date.now(), previo = ultimoToque.current; if (previo?.id === g.elemento.id && ahora - previo.momento < 350) editarContenido(g.elemento.id); ultimoToque.current = { id: g.elemento.id, momento: ahora }; }
    terminar(e.pointerId); try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* sin captura */ }
  };
  acciones.current = { props, cancelar, terminar, acercar, pintarCamara, ayuda, setAyuda, datos, elementos, activa, onMover, onActiva };
  useEffect(() => {
    const alSoltar = (e) => acciones.current.terminar(e.pointerId), alCancelar = () => { acciones.current.cancelar(); espacio.current = false; };
    const teclear = (e) => {
      const a = acciones.current, p = a.props, el = document.activeElement;
      if (a.ayuda) { if (e.key === '?' || e.key === 'Escape') { e.preventDefault(); a.setAyuda(false); } return; }
      if (e.defaultPrevented || e.isComposing || p.disabled || e.altKey || el?.closest('[role="dialog"], [role="listbox"]')) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName) || el?.isContentEditable) { if (e.key === 'Escape') el.blur(); return; }
      const marco = visorRef.current?.closest('[data-componente="PaginaEstudio"]'); if (el !== document.body && !marco?.contains(el)) return;
      const mod = e.ctrlKey || e.metaKey, tecla = e.key.toLowerCase();
      if (e.key === 'Escape') { e.preventDefault(); a.cancelar(); return; }
      if (gesto.current) { if (mod || e.code === 'Space' || e.key.startsWith('Arrow')) e.preventDefault(); if (mod && tecla === 'z' && !e.shiftKey) a.cancelar(); return; }
      if (mod && (tecla === 'z' || tecla === 'y')) { e.preventDefault(); if (tecla === 'y' || e.shiftKey) p.onRehacer(); else p.onDeshacer(); return; }
      if (mod && tecla === 's') { e.preventDefault(); p.onGuardar(); return; }
      if (mod && ['+', '=', '-', '0'].includes(tecla)) { e.preventDefault(); if (tecla === '0') a.pintarCamara({ z: 1, x: 0, y: 0 }); else a.acercar(tecla === '-' ? 1 / 1.2 : 1.2); return; } if (mod) return;
      if (tecla === '?') { e.preventDefault(); a.setAyuda(true); return; } if (e.code === 'Space') { e.preventDefault(); espacio.current = true; return; }
      const secciones = seccionesYoryo(a.datos, p.producto.personalizacionYoryo);
      if (/^[1-9]$/.test(tecla) && secciones[Number(tecla) - 1]) { e.preventDefault(); a.onActiva(secciones[Number(tecla) - 1].id); return; }
      const elegido = a.elementos.find((x) => x.id === a.activa), seccion = secciones.find((x) => x.id === a.activa); if (!elegido || !seccion) return;
      const ajuste = ajusteSeccion(a.datos, seccion), flechas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (flechas[e.key]) { e.preventDefault(); const [x, y] = flechas[e.key], paso = e.shiftKey ? .05 : .01; const c = transformarSeccionYoryo(elegido, { dx: x * paso, dy: y * paso, escala: ajuste.escala, iman: 0 }); a.onMover(elegido.id, { x: c.centroX, y: c.centroY }, `flechas:${elegido.id}`); }
      else if (['+', '=', '-', '_'].includes(tecla)) { e.preventDefault(); a.onMover(elegido.id, { escala: Math.min(160, Math.max(40, ajuste.escala + (['-', '_'].includes(tecla) ? -5 : 5))) }); }
      else if (tecla === 'c') { e.preventDefault(); a.onMover(elegido.id, { x: .5 }); }
    };
    const subirTecla = (e) => { if (e.code === 'Space') espacio.current = false; };
    const rueda = (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); if (!gesto.current) { const r = visorRef.current.getBoundingClientRect(); acciones.current.acercar(Math.exp(-e.deltaY * .004), { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }); } };
    const visor = visorRef.current;
    window.addEventListener('pointerup', alSoltar); window.addEventListener('pointercancel', alCancelar); window.addEventListener('blur', alCancelar);
    document.addEventListener('keydown', teclear); document.addEventListener('keyup', subirTecla); visor.addEventListener('wheel', rueda, { passive: false });
    return () => { if (frame.current) cancelAnimationFrame(frame.current); onInteractuando?.(false); window.removeEventListener('pointerup', alSoltar); window.removeEventListener('pointercancel', alCancelar); window.removeEventListener('blur', alCancelar); document.removeEventListener('keydown', teclear); document.removeEventListener('keyup', subirTecla); visor.removeEventListener('wheel', rueda); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>
    <div ref={visorRef} className={`${modo === 'producto' ? s.modelo : `${s.arte} ${s.plano} ${laser ? s.laser : s.impresion}`} ${s.visorInteractivo}`} style={modo === 'plano' ? { aspectRatio: 1 / config.proporcion } : undefined} onPointerDown={(e) => empezar(e, null)} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={cancelar}>
      <div ref={mundoRef} className={s.mundoYoryo}>
        {modo === 'producto' && <img className={s.base} src={producto.variants?.[0]?.imageUrl || producto.mainImage || producto.images?.[0]} alt={producto.name} draggable={false} />}
        <div ref={zonaRef} data-yoryo-arte={svg} aria-label={`Diseño de ${config.nombre} para ${datos.nombre || 'personalizar'}`} className={`${s.zonaPersonalizable} ${editable && guias ? s.conGuias : ''}`} style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%`, background: editable && fondo || undefined }}>
          {!editable && svg && <img className={`${s.dibujo} ${laser ? s.grabado : ''}`} src={svgComoUrl(svg)} alt={`Diseño de ${config.nombre}`} draggable={false} />}
          {editable && props.baseSvg && <div className={s.capaFija} style={{ zIndex: 0 }}><ImagenSeccion fragmento={props.baseSvg} anchoSvg={props.anchoSvg} altoSvg={props.altoSvg} /></div>}
          {editable && props.superposicionSvg && <div className={s.capaFija} style={{ zIndex: 20 }}><ImagenSeccion fragmento={props.superposicionSvg} anchoSvg={props.anchoSvg} altoSvg={props.altoSvg} /></div>}
          {editable && guias && <span className={s.rotuloArea}><Texto>{laser ? 'Área de grabado' : 'Área de impresión'}</Texto></span>}<span ref={imanRef} className={s.guiaIman} hidden />
          {editable && elementos.map((el) => <div key={el.id} ref={(n) => { if (n) nodos.current.set(el.id, n); else nodos.current.delete(el.id); }} className={s.capaEnVivo} style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, zIndex: (el.orden || 3) * 10 + (activa === el.id ? 1 : 0) }}>
            <ImagenSeccion fragmento={el.fragmento} anchoSvg={el.anchoSvg} altoSvg={el.altoSvg} laser={laser} />
            <button type="button" aria-label={`Mover ${el.nombre.toLowerCase()}`} aria-pressed={activa === el.id} disabled={disabled} className={`${s.elementoMovible} ${activa === el.id && guias ? s.elementoActivo : ''}`} onClick={(e) => { if (e.detail === 0) onActiva(el.id); }} onDoubleClick={() => editarContenido(el.id)} onPointerDown={(e) => empezar(e, el)}><span className={s.nombreElemento}>{el.nombre}</span></button>
            {activa === el.id && guias && <button type="button" className={s.controlTamano} aria-label={`Cambiar tamaño de ${el.nombre.toLowerCase()}`} disabled={disabled} onPointerDown={(e) => empezar(e, el, 'tamano')}><MoveDiagonal2 aria-hidden="true" /></button>}
          </div>)}
        </div>
      </div>
    </div>
    <BarraLienzo puedeDeshacer={puedeDeshacer} puedeRehacer={puedeRehacer} onDeshacer={props.onDeshacer} onRehacer={props.onRehacer}
      disabled={disabled || Boolean(gesto.current)} elegido={editable && elementos.some((e) => e.id === activa)}
      onAchicar={() => onMover(activa, { escala: Math.max(40, ajusteSeccion(datos, seccionesYoryo(datos, config).find((e) => e.id === activa)).escala - 5) })}
      onAgrandar={() => onMover(activa, { escala: Math.min(160, ajusteSeccion(datos, seccionesYoryo(datos, config).find((e) => e.id === activa)).escala + 5) })}
      onCentrar={() => onMover(activa, { x: .5 })} onImagen={props.onImagen} onTexto={() => editarContenido('nombre')} onEditar={() => editarContenido(activa)}
      zoom={zoom / 100} zoomMaximo={3} ayudaEnMovil onZoom={(z) => pintarCamara(zoomCamaraYoryo(camara.current, z / camara.current.z, visorRef.current.clientWidth, visorRef.current.clientHeight))} onAtajos={() => setAyuda(true)} />
    {editable && <Casilla etiqueta="Mostrar área y selección" activo={guias} onChange={setGuias} />}
    <HojaInferior abierta={ayuda} onCerrar={() => setAyuda(false)} titulo="Atajos y gestos"><p className={s.nota}><Texto>Arrastra para mover. Usa la esquina o dos dedos para cambiar el tamaño. Los cambios siempre quedan dentro del área marcada. La vista ampliada no cambia el tamaño del grabado.</Texto></p><AtajosEstudio grupos={gruposAyuda} /></HojaInferior>
  </>;
}
