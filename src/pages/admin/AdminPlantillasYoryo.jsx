import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EQUIPOS_YORYO, PLANTILLAS_CUADRO, plantillaImpresionYoryo, seccionesPlantillaYoryo } from '../../utils/plantillasYoryo.mjs';
import { clavePlantillaYoryo, dimensionesExportacionYoryo, plantillaCapasBaseYoryo, resolucionFondoYoryo } from '../../utils/capasYoryo.mjs';
import { FUENTES_YORYO } from '../../utils/distribucionYoryo.mjs';
import { obtenerPlantillasYoryo, guardarPlantillaYoryo } from '../../services/plantillasYoryo';
import { cargarRecursoPlantillaYoryo } from '../../services/recursosPlantillaYoryo';
import { cargarFuentesYoryo, componerArteYoryo, archivoComoDataUrl, svgComoPng } from '../Crear/arteYoryo.mjs';
import { cargarPlantillaYoryo } from '../Crear/generarYoryo';
import LienzoYoryo from '../../components/crear/LienzoYoryo';
import s from './AdminPlantillasYoryo.module.css';

function baseGeneral(datos, config) {
  const p = plantillaImpresionYoryo(datos);
  return { version: 3, clave: clavePlantillaYoryo(datos, config), producto: config.nombre.toLowerCase(), proporcion: config.proporcion,
    elementos: [...seccionesPlantillaYoryo(datos, config).map((e) => ({ ...e, orden: e.orden ?? 3, ...(e.fuente && { alineacion: 'centro' }) })),
      { id: 'decoracion', nombre: 'Decoración', recurso: 'superposicion', x: .5, y: .5, w: 1, h: 1, margen: 0, orden: 2 }],
    recursos: { superposicion: { url: p.superposicion, size: [1536, 1024] } } };
}

export default function AdminPlantillasYoryo({ obtenerPlantillas = obtenerPlantillasYoryo, guardarPlantilla = guardarPlantillaYoryo, cargarRecurso = cargarRecursoPlantillaYoryo }) {
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ['plantillas-yoryo'], queryFn: obtenerPlantillas, refetchOnWindowFocus: false });
  const [producto, setProducto] = useState('cuadro'), [visual, setVisual] = useState('deportivo'), [equipo, setEquipo] = useState('Alianza Lima');
  const [borradores, setBorradores] = useState({}), [activa, setActiva] = useState('escudo');
  const [muestra, setMuestra] = useState({ nombre: 'Daniel', frase: 'Siempre en mi corazón', dedicatoria: 'Con todo mi amor', titulo: 'Mi lugar favorito es', acento: 'Contigo.', fecha: '24.10.2026' });
  const [foto, setFoto] = useState(''), [composicion, setComposicion] = useState({ elementos: [] });
  const [ocupado, setOcupado] = useState(''), [mensaje, setMensaje] = useState(''), [error, setError] = useState('');
  const refFoto = useRef(null), refCapa = useRef(null), tipoCapa = useRef('');
  const config = useMemo(() => ({ nombre: producto === 'mousepad' ? 'Mousepad' : 'Cuadro', tecnica: 'impresion', proporcion: producto === 'mousepad' ? 195 / 235 : 250 / 310,
    produccion: { anchoMm: producto === 'mousepad' ? 235 : 310, altoMm: producto === 'mousepad' ? 195 : 250, medidasConfirmadas: true } }), [producto]);
  const inicial = useMemo(() => ({ plantillaVisual: visual, plantilla: PLANTILLAS_CUADRO.find((p) => p.id === visual).tipo, equipo, formatoPlantilla: visual === 'deportivo' ? 4 : 3 }), [visual, equipo]);
  const clave = clavePlantillaYoryo(inicial, config);
  const base = useMemo(() => visual === 'deportivo' ? plantillaCapasBaseYoryo(equipo, producto) : baseGeneral(inicial, config), [visual, equipo, producto, inicial, config]);
  const preset = borradores[clave] || consulta.data?.[clave] || base;
  const datos = useMemo(() => ({ ...inicial, ...muestra, plantillaConfig: preset, distribucion: { version: 3, elementos: {} }, fotos: foto ? [{ url: foto, encaje: 'completa' }] : [] }), [inicial, muestra, preset, foto]);
  const seccion = preset.elementos.find((e) => e.id === activa) || preset.elementos[0];
  const cambiarPreset = (nuevo) => { setBorradores((v) => ({ ...v, [clave]: nuevo })); setMensaje(''); setError(''); };
  const cambiarElemento = (id, cambio) => cambiarPreset({ ...preset, elementos: preset.elementos.map((e) => e.id === id ? { ...e, ...cambio } : e) });
  const guardar = async () => {
    setOcupado('guardando'); setError(''); setMensaje('');
    try {
      await guardarPlantilla(preset);
      queryClient.setQueryData(['plantillas-yoryo'], (v) => ({ ...v, [clave]: preset }));
      setMensaje('Plantilla guardada. Se usará en las nuevas personalizaciones de este modelo y equipo.');
    } catch (e) { setError(e.message); } finally { setOcupado(''); }
  };
  useEffect(() => {
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const [fuentes, plantilla] = await Promise.all([cargarFuentesYoryo(datos, config), cargarPlantillaYoryo(datos)]);
        const resultado = componerArteYoryo({ datos, config, fuentes, fotos: foto ? [foto, foto, foto] : [], plantilla });
        if (vigente) { setComposicion(resultado); setError(''); }
      } catch (e) { if (vigente) { setComposicion({ elementos: [] }); setError(e.message); } }
    }, 30);
    return () => { vigente = false; clearTimeout(timer); };
  }, [datos, config, foto]);
  const subirCapa = async (file) => {
    if (!file) return;
    setOcupado('subiendo'); setError('');
    const tipo = tipoCapa.current;
    try { const recurso = await cargarRecurso(file, tipo); cambiarPreset({ ...preset, recursos: { ...preset.recursos, [tipo]: recurso } }); }
    catch (e) { setError(e.message); } finally { setOcupado(''); }
  };
  const descargar = async () => {
    setOcupado('exportando'); setError('');
    try {
      const [fuentes, plantilla] = await Promise.all([cargarFuentesYoryo(datos, config), cargarPlantillaYoryo(datos)]);
      const { svg } = componerArteYoryo({ datos, config, fuentes, plantilla, fotos: foto ? [foto, foto, foto] : [] });
      const { ancho, alto } = dimensionesExportacionYoryo(datos, config);
      const blob = await svgComoPng(svg, ancho, alto), url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${clave}-${ancho}x${alto}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); } finally { setOcupado(''); }
  };
  if (consulta.isLoading) return <p className={s.pagina}>Cargando plantillas…</p>;
  if (consulta.isError) return <div className={s.pagina}><p role="alert">{consulta.error.message}</p><button onClick={() => consulta.refetch()}>Reintentar</button></div>;
  const ppp = resolucionFondoYoryo(datos, config);
  const seleccionar = (fn, valor) => { fn(valor); setMensaje(''); setError(''); };
  return <main className={s.pagina}>
    <h1>Plantillas de cuadros y mousepads</h1>
    <p>Selecciona un modelo y equipo. Arrastra los elementos en el lienzo o ajusta sus valores. Los cambios se publican al guardar.</p>
    <div className={s.selectores}>
      <label>Producto<select value={producto} disabled={Boolean(ocupado)} onChange={(e) => seleccionar(setProducto, e.target.value)}><option value="cuadro">Cuadro · 31 × 25 cm</option><option value="mousepad">Mousepad · 23.5 × 19.5 cm</option></select></label>
      <label>Plantilla<select value={visual} disabled={Boolean(ocupado)} onChange={(e) => seleccionar(setVisual, e.target.value)}>{PLANTILLAS_CUADRO.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      {visual === 'deportivo' && <label>Equipo<select value={equipo} disabled={Boolean(ocupado)} onChange={(e) => seleccionar(setEquipo, e.target.value)}>{EQUIPOS_YORYO.map(([nombre]) => <option key={nombre}>{nombre}</option>)}</select></label>}
    </div>
    <div className={s.acciones}>
      <button className={s.primario} disabled={Boolean(ocupado)} onClick={guardar}>{ocupado === 'guardando' ? 'Guardando…' : 'Guardar plantilla'}</button>
      <button disabled={Boolean(ocupado)} onClick={descargar}>Exportar PNG de prueba</button>
      <button disabled={Boolean(ocupado)} onClick={() => cambiarPreset(base)}>Restablecer valores iniciales</button>
    </div>
    {mensaje && <p className={s.correcto} role="status">{mensaje}</p>}
    {error && <p className={s.error} role="alert">{error}</p>}
    {ppp && ppp < 300 && <p className={s.aviso}>Fondo: {preset.recursos.fondo.size.join(' × ')} px · aproximadamente {ppp} ppp efectivos. El PNG final tiene 300 ppp nominales; ampliar la imagen no recupera detalle.</p>}
    <div className={s.editor}>
      <section className={s.vista} data-componente="PaginaEstudio">
        <LienzoYoryo key={clave} {...composicion} producto={{ personalizacionYoryo: config }} datos={datos} svg={composicion.svg || ''} modo="plano" activa={seccion.id} onActiva={setActiva}
          onMover={(id, cambio) => cambiarElemento(id, cambio)} disabled={Boolean(ocupado)} onGuardar={guardar} onDeshacer={() => {}} onRehacer={() => {}} onImagen={() => refFoto.current.click()} />
        <p>La foto y los textos de muestra no se guardan en la plantilla. Cada equipo y producto tiene su propia composición.</p>
        <input ref={refFoto} type="file" hidden accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { if (f.size > 25 * 1024 * 1024) { setError('La foto debe pesar menos de 25 MB.'); return; } setFoto(await archivoComoDataUrl(f)); } }} />
        <button disabled={Boolean(ocupado)} onClick={() => refFoto.current.click()}>Subir foto de prueba con transparencia</button>
      </section>
      <aside className={s.panel}>
        <fieldset disabled={Boolean(ocupado)}>
          <legend>Elementos del diseño</legend>
          <div className={s.capas}>{[...preset.elementos].sort((a, b) => b.orden - a.orden).map((e) => <button key={e.id} className={e.id === seccion.id ? s.activa : ''} onClick={() => setActiva(e.id)}>{e.nombre}<span>{e.orden}</span></button>)}</div>
          <h2>{seccion.nombre}</h2>
          <div className={s.valores}>{[['x', 'Centro X'], ['y', 'Centro Y'], ['w', 'Ancho máximo'], ['h', 'Alto máximo']].map(([k, nombre]) => <label key={k}>{nombre} (%)<input type="number" min={k === 'w' || k === 'h' ? 1 : 0} max="100" step="0.1" value={Math.round(seccion[k] * 1000) / 10} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) cambiarElemento(seccion.id, { [k]: Math.max(k === 'w' || k === 'h' ? .01 : 0, Math.min(1, v / 100)) }); }} /></label>)}</div>
          <label>Escala (%)<input type="range" min="40" max="160" value={seccion.escala || 100} onChange={(e) => cambiarElemento(seccion.id, { escala: Number(e.target.value) })} /></label>
          <label>Orden (0 detrás · 20 delante)<input type="number" min="0" max="20" value={seccion.orden} onChange={(e) => cambiarElemento(seccion.id, { orden: Math.max(0, Math.min(20, Number(e.target.value))) })} /></label>
          {seccion.fuente && <>
            <label>Texto de prueba<textarea value={muestra[seccion.id] || ''} maxLength={160} onChange={(e) => setMuestra((v) => ({ ...v, [seccion.id]: e.target.value }))} /></label>
            <label>Tipografía<select value={seccion.fuente} onChange={(e) => cambiarElemento(seccion.id, { fuente: e.target.value })}>{FUENTES_YORYO.map((f) => <option key={f.id}>{f.id}</option>)}</select></label>
            <label>Color<input type="color" value={seccion.color || '#26342B'} onChange={(e) => cambiarElemento(seccion.id, { color: e.target.value })} /></label>
            <label>Alineación<select value={seccion.alineacion || 'centro'} onChange={(e) => cambiarElemento(seccion.id, { alineacion: e.target.value })}><option value="izquierda">Izquierda</option><option value="centro">Centro</option><option value="derecha">Derecha</option></select></label>
            <label className={s.casilla}><input type="checkbox" checked={seccion.mayusculas || false} onChange={(e) => cambiarElemento(seccion.id, { mayusculas: e.target.checked })} />Usar mayúsculas</label>
          </>}
          <h2>Recursos PNG</h2>
          {Object.entries(preset.recursos).map(([tipo, r]) => <div className={s.recurso} key={tipo}><img src={r.url} alt={tipo} /><div><strong>{tipo === 'superposicion' ? 'Decoración' : tipo}</strong><small>{r.size.join(' × ')} px</small><button onClick={() => { tipoCapa.current = tipo; refCapa.current.click(); }}>Sustituir PNG</button></div></div>)}
          <input ref={refCapa} type="file" hidden accept="image/png" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; subirCapa(f); }} />
        </fieldset>
      </aside>
    </div>
  </main>;
}
