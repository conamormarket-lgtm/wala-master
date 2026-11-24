import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Grid3x3, LayoutTemplate, Loader2, Palette, Pencil, Plus, Repeat, Ruler, Sparkles, Trash2, Upload, X } from 'lucide-react';
import Boton from '../../Boton';
import { Confirmar, EstadoVacio, HojaInferior, useToast } from '../../Feedback';
import { Campo, Casilla, Interruptor } from '../../Formulario';
import { Chip } from '../../Etiquetas';
import { CampoColor, ElegirUno, GrupoCampos } from './Formularios';
import {
  altoZonaFraccion, cargarImagen, tintarImagen, voltearImagen, normalizarZona, normalizarVista, normalizarReferencia,
  medidaZona, zonaConMedida, nuevoIdZona, leerPrendaBase, colorDisponible, fondoMuestra, leerTipo, leerTecnica, leerPlantillas,
  PATRONES_BICOLOR, COLORES_POLERA, TALLAS_POLERA, vistasDeEjemplo,
} from '../../../../utils/prendaBase';
import s from './Crear.module.css';

/*
 * Lo de un personalizable de Crear en la ficha (guía: guia/ADMIN.md, D2c):
 * el editor de zonas sobre la foto, las vistas, los colores (bicolor,
 * invertido, fotos propias, foto de tienda) y las plantillas. Las reglas
 * (normalizar zonas, medir en cm, teñir) son las de utils/prendaBase: las
 * mismas que usa el estudio. Se edita `prendaBase` tal cual; se limpia al
 * guardar (prendaBaseParaGuardar).
 */

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const ZONAS_SUGERIDAS = ['Pecho', 'Pecho izquierdo (logo)', 'Espalda', 'Espalda alta', 'Manga derecha', 'Manga izquierda', 'Bolsillo', 'Capucha'];

/**
 * Las zonas de impresión de una vista sobre su foto, teñida del color
 * elegido (la de ZonaEditor). Tocar elige una zona; arrastrar la mueve;
 * los bordes derecho e inferior y la esquina la estiran (sobre sus ejes, si
 * está girada). La línea naranja de referencia (dos extremos; Shift la deja
 * recta) da la escala: cada zona muestra su medida y hay cuadrícula de 5 cm.
 *  - imagen · colorHex (teñir) · zonas · seleccionada · onSeleccionar(i) · onCambiar(i, zona)
 *  - referencia · onReferencia(ref) · cuadricula · onMedidas({ ancho, alto }) (la foto natural)
 *  - soloMover: sin asas (ubicar sin cambiar el tamaño)
 */
export function EditorZonas({ imagen, colorHex, zonas = [], seleccionada, onSeleccionar, onCambiar, referencia, onReferencia, cuadricula = false, onMedidas, soloMover = false }) {
  const caja = useRef(null);
  const lienzo = useRef(null);
  const arrastre = useRef(null);
  const [dims, setDims] = useState(null);

  useEffect(() => {
    let vigente = true;
    setDims(null);
    if (!imagen) return undefined;
    cargarImagen(imagen)
      .then((img) => {
        if (!vigente) return;
        const fuente = tintarImagen(img, colorHex || '#FFFFFF');
        const c = lienzo.current;
        if (c) {
          c.width = fuente.width;
          c.height = fuente.height;
          c.getContext('2d').drawImage(fuente, 0, 0);
        }
        setDims({ ancho: img.naturalWidth, alto: img.naturalHeight });
      })
      .catch(() => vigente && setDims({ error: true }));
    return () => { vigente = false; };
  }, [imagen, colorHex]);

  const medidas = useRef(onMedidas);
  medidas.current = onMedidas;
  useEffect(() => { if (dims?.ancho) medidas.current?.(dims); }, [dims?.ancho, dims?.alto]); // eslint-disable-line react-hooks/exhaustive-deps

  const pxCm = (() => {
    if (!dims?.ancho || !referencia || !(Number(referencia.cm) > 0)) return 0;
    const largo = Math.hypot((referencia.x2 - referencia.x1) * dims.ancho, (referencia.y2 - referencia.y1) * dims.alto);
    return largo > 0 ? largo / Number(referencia.cm) : 0;
  })();
  const textoCm = (z) => {
    if (!pxCm) return null;
    const ancho = (z.w * dims.ancho) / pxCm;
    return `${ancho.toFixed(1)} × ${(ancho * z.proporcion).toFixed(1)} cm`;
  };

  const empezar = (i, modo) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (i !== null) onSeleccionar?.(i);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastre.current = { i, modo, x0: e.clientX, y0: e.clientY, zona: i !== null ? { ...zonas[i], ...normalizarZona(zonas[i], i), nombre: zonas[i].nombre } : null, referencia: referencia ? { ...referencia } : null };
  };
  const mover = (e) => {
    const a = arrastre.current;
    const r = caja.current?.getBoundingClientRect();
    if (!a || !r || !dims?.ancho) return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    if (a.modo === 'ref1' || a.modo === 'ref2') {
      const ref = a.referencia;
      const n = a.modo === 'ref1' ? '1' : '2';
      let x = limitar(ref[`x${n}`] + dx / r.width, 0, 1);
      let y = limitar(ref[`y${n}`] + dy / r.height, 0, 1);
      if (e.shiftKey) {
        const otro = n === '1' ? '2' : '1';
        if (Math.abs(x - ref[`x${otro}`]) * r.width > Math.abs(y - ref[`y${otro}`]) * r.height) y = ref[`y${otro}`];
        else x = ref[`x${otro}`];
      }
      onReferencia?.({ ...ref, [`x${n}`]: x, [`y${n}`]: y });
      return;
    }
    const z = a.zona;
    if (a.modo === 'mover') {
      onCambiar?.(a.i, { ...z, x: limitar(z.x + dx / r.width, -0.2, 1), y: limitar(z.y + dy / r.height, -0.2, 1) });
      return;
    }
    const giro = (z.angulo * Math.PI) / 180;
    const alAncho = dx * Math.cos(giro) + dy * Math.sin(giro);
    const alAlto = -dx * Math.sin(giro) + dy * Math.cos(giro);
    const anchoPx = z.w * r.width;
    const altoPx = anchoPx * z.proporcion;
    const nuevoAncho = a.modo === 'alto' ? anchoPx : Math.max(12, anchoPx + alAncho);
    const nuevoAlto = a.modo === 'ancho' ? altoPx : Math.max(12, altoPx + alAlto);
    onCambiar?.(a.i, { ...z, w: Math.min(1, nuevoAncho / r.width), proporcion: nuevoAlto / nuevoAncho });
  };
  const soltar = () => { arrastre.current = null; };
  // Con el teclado: flechas mueven la zona elegida (Shift, más).
  const teclas = (i) => (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const z = normalizarZona(zonas[i], i);
    const paso = e.shiftKey ? 0.02 : 0.005;
    onCambiar?.(i, { ...zonas[i], x: limitar(z.x + d[0] * paso, -0.2, 1), y: limitar(z.y + d[1] * paso, -0.2, 1) });
  };

  if (!imagen) return <div className={s.zonaVacia}>Sube la foto de esta vista para marcar sus zonas.</div>;

  const celda = pxCm && cuadricula ? { ancho: ((5 * pxCm) / dims.ancho) * 100, alto: ((5 * pxCm) / dims.alto) * 100 } : null;
  return (
    <div className={s.editor} data-componente="EditorZonas">
      <div ref={caja} className={s.caja} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <canvas ref={lienzo} className={s.foto} aria-label="Foto de la vista" />
        {dims?.error && <p className={s.zonaError}>No se pudo cargar la foto.</p>}
        {celda && <div className={s.cuadricula} style={{ backgroundSize: `${celda.ancho}% ${celda.alto}%` }} aria-hidden="true" />}
        {dims?.ancho && zonas.map((cruda, i) => {
          const z = normalizarZona(cruda, i);
          const activa = i === seleccionada;
          const cm = textoCm(z);
          return (
            <div
              key={z.id}
              className={[s.zona, activa && s.zonaActiva].filter(Boolean).join(' ')}
              style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${altoZonaFraccion(z, dims.ancho, dims.alto) * 100}%`, transform: `rotate(${z.angulo || 0}deg)`, borderRadius: z.radio ? `${z.radio * 100}% / ${(z.radio * 100) / z.proporcion}%` : undefined }}
              onPointerDown={empezar(i, 'mover')}
              onKeyDown={teclas(i)}
              role="button"
              aria-pressed={activa}
              aria-label={`Zona ${z.nombre}${cm ? `, ${cm}` : ''}. Flechas para moverla.`}
              tabIndex={0}
            >
              <span className={s.zonaNombre}>{z.nombre}</span>
              {cm && activa && <span className={s.zonaMedida}>{cm}</span>}
              {activa && !soloMover && (
                <>
                  <span className={`${s.borde} ${s.bordeDerecho}`} onPointerDown={empezar(i, 'ancho')} aria-hidden="true" />
                  <span className={`${s.borde} ${s.bordeAbajo}`} onPointerDown={empezar(i, 'alto')} aria-hidden="true" />
                  <span className={s.asaEsquina} onPointerDown={empezar(i, 'ambos')} aria-hidden="true" />
                </>
              )}
            </div>
          );
        })}
        {dims?.ancho && referencia && (
          <>
            <svg className={s.regla} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line x1={referencia.x1 * 100} y1={referencia.y1 * 100} x2={referencia.x2 * 100} y2={referencia.y2 * 100} vectorEffect="non-scaling-stroke" />
            </svg>
            <span className={s.reglaTexto} style={{ left: `${((referencia.x1 + referencia.x2) / 2) * 100}%`, top: `${((referencia.y1 + referencia.y2) / 2) * 100}%` }}>
              {Number(referencia.cm) > 0 ? `${referencia.cm} cm` : '¿cuánto mide?'}
            </span>
            {[1, 2].map((n) => (
              <span
                key={n}
                className={s.reglaPunto}
                style={{ left: `${referencia[`x${n}`] * 100}%`, top: `${referencia[`y${n}`] * 100}%` }}
                onPointerDown={empezar(null, `ref${n}`)}
                role="slider"
                aria-label={`Extremo ${n} de la medida de referencia`}
                aria-valuetext={`${Math.round(referencia[`x${n}`] * 100)} %, ${Math.round(referencia[`y${n}`] * 100)} %`}
                tabIndex={0}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* Un número en cm que se confirma al salir o con Enter (así se escriben decimales). */
function CampoCm({ valor, onFijar, etiqueta }) {
  const [texto, setTexto] = useState(String(valor));
  const [editando, setEditando] = useState(false);
  useEffect(() => { if (!editando) setTexto(String(valor)); }, [valor, editando]);
  const confirmar = (actual) => {
    setEditando(false);
    const n = parseFloat(String(actual).replace(',', '.'));
    if (n > 0 && Math.abs(n - valor) >= 0.05) onFijar(n);
    else setTexto(String(valor));
  };
  return (
    <input
      className={s.numero}
      type="text"
      inputMode="decimal"
      value={texto}
      aria-label={etiqueta}
      onFocus={() => setEditando(true)}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={(e) => confirmar(e.currentTarget.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
    />
  );
}

/**
 * Las zonas de una vista en filas: nombre (con sugerencias), cm (con escala),
 * giro, esquinas, quitar; y "Agregar zona".
 *  - zonas · escala ({ referencia, anchoImg, altoImg }) · elegida · onElegir(i) · onCambiar(i, zona) · onZonas(zonas) · id
 */
export function ListaZonas({ zonas = [], escala, elegida, onElegir, onCambiar, onZonas, id }) {
  return (
    <div className={s.listaZonas}>
      <datalist id={`${id}-sugeridas`}>{ZONAS_SUGERIDAS.map((n) => <option key={n} value={n} />)}</datalist>
      {zonas.map((z, zi) => {
        const zn = normalizarZona(z, zi);
        const cm = medidaZona(zn, escala);
        const fijarCm = (ancho, alto) => { const nueva = zonaConMedida(zn, escala, ancho, alto); onCambiar(zi, { ...z, w: nueva.w, proporcion: nueva.proporcion }); };
        return (
          <div key={z.id || zi} className={[s.filaZona, elegida === zi && s.filaZonaActiva].filter(Boolean).join(' ')} onFocus={() => onElegir(zi)}>
            <label className={s.campoChico}>
              <span>Zona</span>
              <input className={s.texto} list={`${id}-sugeridas`} value={z.nombre} onChange={(e) => onCambiar(zi, { ...z, nombre: e.target.value })} />
            </label>
            {cm && (
              <>
                <label className={s.campoChico}><span>Ancho cm</span><CampoCm valor={cm.anchoCm} onFijar={(n) => fijarCm(n, cm.altoCm)} etiqueta={`Ancho de ${z.nombre} en cm`} /></label>
                <label className={s.campoChico}><span>Alto cm</span><CampoCm valor={cm.altoCm} onFijar={(n) => fijarCm(cm.anchoCm, n)} etiqueta={`Alto de ${z.nombre} en cm`} /></label>
              </>
            )}
            <label className={s.campoChico}>
              <span>Giro °</span>
              <input className={s.numero} type="number" min="-180" max="180" step="1" value={z.angulo ?? 0} onChange={(e) => onCambiar(zi, { ...z, angulo: e.target.value })} />
            </label>
            <label className={s.campoChico} title="Redondea las esquinas (un mousepad): lo que sale de la esquina no se ve.">
              <span>Esquinas %</span>
              <input className={s.numero} type="number" min="0" max="50" step="0.5" value={Math.round((Number(z.radio) || 0) * 1000) / 10} onChange={(e) => onCambiar(zi, { ...z, radio: (parseFloat(e.target.value) || 0) / 100 })} />
            </label>
            <button type="button" className={s.quitar} onClick={() => { onZonas(zonas.filter((_, k) => k !== zi)); onElegir(0); }} aria-label={`Quitar zona ${z.nombre}`}><X aria-hidden="true" /></button>
          </div>
        );
      })}
      {!zonas.length && <p className={s.ayuda}>Esta vista aún no tiene zonas.</p>}
      <Boton
        tamano="sm"
        variante="secundario"
        icono={<Plus aria-hidden="true" />}
        onClick={() => { onZonas([...zonas, normalizarZona({ id: nuevoIdZona(), nombre: `Zona ${zonas.length + 1}`, x: 0.4, y: 0.4, w: 0.2, proporcion: 1 })]); onElegir(zonas.length); }}
      >
        Agregar zona
      </Boton>
    </div>
  );
}

/* Un color teñido (o volteado, si es el invertido) sobre la foto de una vista. */
function Miniatura({ imagen, hex, nombre, espejo = false }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let vigente = true;
    if (!imagen) return undefined;
    cargarImagen(imagen).then((img) => {
      if (!vigente) return;
      const t = espejo ? voltearImagen(img) : tintarImagen(img, hex);
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = Math.round(t.height * (160 / t.width));
      c.getContext('2d').drawImage(t, 0, 0, c.width, c.height);
      try { setSrc(c.toDataURL('image/png')); } catch { setSrc(imagen); }
    }).catch(() => {});
    return () => { vigente = false; };
  }, [imagen, hex, espejo]);
  return <span className={s.miniatura}>{src && <img src={src} alt={`${nombre}`} />}</span>;
}

/* La forma cruda de las variantes que esperan leerPrendaBase y compañía. */
export const variantesCrudas = (variantes = []) => variantes.map((v) => ({ id: v.id, name: v.nombre, colorHex: v.color, sizes: v.tallas, imageUrl: v.foto }));

/* Subir con el aviso de error de siempre. */
function useSubir(subirImagen, carpeta) {
  const toast = useToast();
  const [subiendo, setSubiendo] = useState(null);
  const subir = async (archivo, clave) => {
    if (!archivo || !subirImagen) return null;
    setSubiendo(clave);
    try {
      const r = await subirImagen(archivo, { carpeta });
      const url = typeof r === 'string' ? r : r?.url;
      if (!url) throw new Error('Sin dirección');
      return url;
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se subió la foto', texto: err?.message || 'Vuelve a intentar.' });
      return null;
    } finally {
      setSubiendo(null);
    }
  };
  return [subir, subiendo];
}

function BotonSubir({ texto, subiendo, onArchivo, acepta = 'image/png,image/webp' }) {
  const entrada = useRef(null);
  return (
    <>
      <Boton tamano="sm" variante="secundario" icono={subiendo ? <Loader2 className={s.girar} aria-hidden="true" /> : <Upload aria-hidden="true" />} disabled={subiendo} onClick={() => entrada.current?.click()}>
        {subiendo ? 'Subiendo…' : texto}
      </Boton>
      <input ref={entrada} type="file" accept={acepta} hidden onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; onArchivo(a); }} />
    </>
  );
}

/**
 * La pestaña Diseño de un personalizable: qué es (prenda o producto, técnica,
 * solo plantillas, portada), sus vistas con sus zonas y las zonas de los
 * bicolores.
 *  - prenda (prendaBase como se edita) · onPrenda(cambios | (prev) => cambios)
 *  - variantes (las de la ficha) · principal · subirImagen · origen (para las fotos de ejemplo)
 */
export function DisenoPrenda({ prenda, onPrenda, variantes = [], principal, subirImagen, origen = typeof window !== 'undefined' ? window.location.origin : '' }) {
  const [subir, subiendo] = useSubir(subirImagen, 'crear');
  const [colorVer, setColorVer] = useState(null);
  const [elegida, setElegida] = useState({});
  const [cuadricula, setCuadricula] = useState({});
  const [quitarVista, setQuitarVista] = useState(null);
  const vistas = (prenda?.vistas || []).map((v, i) => (Array.isArray(v?.zonas) ? { ...v, nombre: v.nombre ?? '', imagen: v.imagen || '' } : normalizarVista(v, i)));
  const { colores } = leerPrendaBase({ variants: variantesCrudas(variantes), prendaBase: { vistas, colores: prenda?.colores || {} } });
  const inicial = colores.some((c) => c.id === principal) ? principal : colores[0]?.id;
  const colorVista = colores.find((c) => c.id === (colorVer || inicial));
  const propiaDe = (v) => (colorVista && !colorVista.espejo ? colorVista.fotos?.[v.id] : '') || '';

  const cambiar = onPrenda;
  const setVista = (i, cambios) => cambiar((prev) => ({ vistas: (prev.vistas || []).map((v, j) => (j === i ? { ...v, ...cambios } : v)) }));
  const setZona = (i, zi, zona) => cambiar((prev) => ({
    vistas: (prev.vistas || []).map((v, j) => {
      if (j !== i) return v;
      const zonas = Array.isArray(v.zonas) ? v.zonas : normalizarVista(v, j).zonas;
      return { ...v, zonas: zonas.map((z, k) => (k === zi ? zona : z)) };
    }),
  }));
  const agregarVista = () => cambiar((prev) => {
    const lista = prev.vistas || [];
    const nombre = lista.length === 0 ? 'Frente' : lista.length === 1 ? 'Espalda' : `Vista ${lista.length + 1}`;
    return {
      vistas: [...lista, normalizarVista({
        id: lista.some((v) => v.id === 'frente') ? `vista-${lista.length + 1}` : 'frente',
        nombre,
        zonas: [{ id: nuevoIdZona(), nombre: lista.length === 1 ? 'Espalda' : 'Pecho', x: 0.35, y: 0.3, w: 0.3, proporcion: 1 }],
      })],
    };
  });

  return (
    <div className={s.diseno} data-componente="DisenoPrenda">
      <section className={s.bloque}>
        <GrupoCampos titulo="Qué se personaliza" ayuda="Se vende solo personalizado: en Crear y, si se activa en «Dónde se ve», también en la tienda. Su precio incluye todos los diseños que el cliente quiera poner.">
          <div className={s.dos}>
            <div className={s.fila}><span className={s.etiqueta}>Qué es</span><ElegirUno etiqueta="Qué es" opciones={[{ valor: 'prenda', texto: 'Prenda' }, { valor: 'producto', texto: 'Producto' }]} valor={leerTipo(prenda?.tipo)} onElegir={(v) => v && cambiar({ tipo: v })} /><span className={s.ayuda}>Polera, casaca… o cuadro, mousepad, tomatodo. En Crear se le llama así.</span></div>
            <div className={s.fila}><span className={s.etiqueta}>Técnica</span><ElegirUno etiqueta="Técnica" opciones={[{ valor: 'impresion', texto: 'Impresión a color' }, { valor: 'laser', texto: 'Grabado láser' }]} valor={leerTecnica(prenda?.tecnica)} onElegir={(v) => v && cambiar({ tecnica: v })} /><span className={s.ayuda}>El grabado se ve en un tono y el taller recibe el PNG en grises.</span></div>
          </div>
          <Casilla activo={prenda?.soloPlantillas === true} onChange={(v) => cambiar({ soloPlantillas: v })} etiqueta="Solo con sus plantillas" descripcion="El cliente elige una plantilla y cambia sus textos; no sube imágenes ni diseña aparte (el tomatodo)." />
          <Casilla activo={prenda?.portadaTienda === true} onChange={(v) => cambiar({ portadaTienda: v })} etiqueta="Portada en Crear: la foto de tienda" descripcion="La tarjeta de Crear muestra la foto de tienda del color principal (la billetera de frente); la foto para diseñar sale al pasar el mouse." />
        </GrupoCampos>
      </section>

      <section className={s.bloque}>
        <div className={s.cabeza}>
          <h3 className={s.titulo}>Vistas y zonas de impresión</h3>
          {!vistas.length && <Boton tamano="sm" variante="secundario" icono={<Sparkles aria-hidden="true" />} onClick={() => cambiar({ vistas: vistasDeEjemplo(origen) })}>Usar el hoodie de ejemplo</Boton>}
        </div>
        <p className={s.ayuda}>Cada foto en PNG con fondo transparente y la prenda en blanco: los colores se tiñen solos. Toca una zona para elegirla, arrástrala para moverla y estírala desde sus bordes. Son de referencia: el cliente elige en cuál va cada imagen o texto.</p>
        {leerTipo(prenda?.tipo) === 'producto' && <p className={s.ayuda}>Un producto no se tiñe bien: sube su foto real en cada color (en «Colores y fotos»). Marca la línea de referencia con el ancho útil en cm para que el archivo salga a tamaño real a 300 ppp.</p>}
        {colores.length > 1 && vistas.length > 0 && (
          <div className={s.verEn}>
            <span>Ver en</span>
            {colores.map((c) => (
              <button key={c.id} type="button" className={[s.punto, (colorVer || inicial) === c.id && s.puntoActivo].filter(Boolean).join(' ')} style={{ background: fondoMuestra(c) }} title={c.nombre} aria-label={`Ver en ${c.nombre}`} aria-pressed={(colorVer || inicial) === c.id} onClick={() => setColorVer(c.id)} />
            ))}
          </div>
        )}
        {vistas.map((v, i) => {
          const propia = propiaDe(v);
          return (
            <div key={i} className={s.vista}>
              <div className={s.cabeza}>
                <input className={s.nombreVista} value={v.nombre} onChange={(e) => setVista(i, { nombre: e.target.value })} aria-label="Nombre de la vista" />
                <Boton soloIcono tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} aria-label={`Quitar la vista ${v.nombre}`} onClick={() => setQuitarVista(i)} />
              </div>
              <div className={s.vistaCuerpo}>
                <div className={s.vistaFoto}>
                  {propia && propia !== v.imagen && <p className={s.ayuda}>Se ve la foto propia de <strong>{colorVista.nombre}</strong> (la que usa el estudio): sus fotos deben tener el mismo encuadre.</p>}
                  <EditorZonas
                    imagen={propia || v.imagen}
                    colorHex={propia ? '#FFFFFF' : colorVista?.hex || '#FFFFFF'}
                    zonas={v.zonas}
                    seleccionada={elegida[v.id] ?? 0}
                    onSeleccionar={(zi) => setElegida((m) => ({ ...m, [v.id]: zi }))}
                    onCambiar={(zi, z) => setZona(i, zi, z)}
                    referencia={v.referencia}
                    onReferencia={(referencia) => setVista(i, { referencia })}
                    cuadricula={Boolean(cuadricula[v.id])}
                    onMedidas={(d) => {
                      // Solo la foto base da las medidas (con la propia de un color se ve otra).
                      if (propia && propia !== v.imagen) return;
                      if (v.anchoImg !== d.ancho || v.altoImg !== d.alto) setVista(i, { anchoImg: d.ancho, altoImg: d.alto });
                    }}
                  />
                  <div className={s.botones}>
                    <BotonSubir texto={v.imagen ? 'Cambiar foto' : 'Subir foto'} subiendo={subiendo === `vista-${i}`} onArchivo={async (a) => { const url = await subir(a, `vista-${i}`); if (url) setVista(i, { imagen: url }); }} />
                    <BotonSubir texto={v.encima ? 'Cambiar borde encima' : 'Borde encima (opcional)'} subiendo={subiendo === `encima-${i}`} onArchivo={async (a) => { const url = await subir(a, `encima-${i}`); if (url) setVista(i, { encima: url }); }} />
                    {v.encima && <Boton tamano="sm" variante="fantasma" onClick={() => setVista(i, { encima: '' })}>Quitar borde</Boton>}
                  </div>
                  {v.encima && <p className={s.ayuda}>El borde (un PNG del mismo tamaño, transparente donde va el diseño) se dibuja encima del diseño.</p>}
                </div>
                <div className={s.vistaZonas}>
                  <div className={s.escala}>
                    {v.referencia ? (
                      <>
                        <div className={s.escalaFila}>
                          <Ruler aria-hidden="true" />
                          <span>La línea naranja mide</span>
                          <input className={s.numero} type="number" min="0" step="0.5" value={v.referencia.cm ?? ''} aria-label="Medida real de la línea en cm" onChange={(e) => setVista(i, { referencia: { ...v.referencia, cm: e.target.value } })} />
                          <span>cm</span>
                        </div>
                        <div className={s.escalaFila}>
                          <Chip tamano="sm" activo={Boolean(cuadricula[v.id])} icono={<Grid3x3 aria-hidden="true" />} onClick={() => setCuadricula((m) => ({ ...m, [v.id]: !m[v.id] }))}>Cuadrícula de 5 cm</Chip>
                          <Boton tamano="sm" variante="fantasma" onClick={() => setVista(i, { referencia: null })}>Quitar la medida</Boton>
                        </div>
                        <p className={s.ayuda}>Arrastra sus extremos sobre algo que puedas medir en la prenda real (de axila a axila) y escribe cuánto mide. Shift la deja recta. Solo tú ves estas medidas.</p>
                      </>
                    ) : (
                      <>
                        <Boton tamano="sm" variante="secundario" icono={<Ruler aria-hidden="true" />} onClick={() => setVista(i, { referencia: { x1: 0.25, y1: 0.4, x2: 0.75, y2: 0.4, cm: '' } })}>Agregar medida de referencia</Boton>
                        <p className={s.ayuda}>Para ver y ajustar las zonas en centímetros.</p>
                      </>
                    )}
                  </div>
                  <ListaZonas
                    id={`zonas-${i}`}
                    zonas={v.zonas}
                    escala={{ referencia: normalizarReferencia(v.referencia), anchoImg: v.anchoImg, altoImg: v.altoImg }}
                    elegida={elegida[v.id] ?? 0}
                    onElegir={(zi) => setElegida((m) => ({ ...m, [v.id]: zi }))}
                    onCambiar={(zi, z) => setZona(i, zi, z)}
                    onZonas={(zonas) => setVista(i, { zonas })}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <Boton variante="secundario" icono={<Plus aria-hidden="true" />} onClick={agregarVista}>Agregar vista</Boton>
      </section>

      {vistas.length > 0 && colores.some((c) => c.hex2) && <ZonasBicolor prenda={prenda} vistas={vistas} colores={colores} onPrenda={cambiar} setVista={setVista} />}

      <Confirmar
        abierta={quitarVista !== null}
        titulo={quitarVista !== null ? `¿Quitar la vista «${vistas[quitarVista]?.nombre}»?` : ''}
        texto="Se van su foto y sus zonas. Los diseños que ya usan esas zonas pierden ese lado. Se aplica al guardar."
        confirmar="Quitar"
        peligro
        onConfirmar={() => { cambiar((prev) => ({ vistas: (prev.vistas || []).filter((_, j) => j !== quitarVista) })); setQuitarVista(null); }}
        onCancelar={() => setQuitarVista(null)}
      />
    </div>
  );
}

/* Las zonas de los bicolores: un juego para todos y, si hace falta, uno propio por color. */
function ZonasBicolor({ prenda, vistas, colores, onPrenda, setVista }) {
  const bicolores = colores.filter((c) => c.hex2 && !c.espejo);
  const [objetivoId, setObjetivoId] = useState(null);
  const [previo, setPrevio] = useState(null);
  const [elegida, setElegida] = useState({});
  const [quitar, setQuitar] = useState(null);
  const objetivo = bicolores.find((c) => c.id === objetivoId) || null;
  const extras = prenda?.colores || {};
  const conFoto = (vistaId) => bicolores.find((c) => c.id === previo && c.fotos[vistaId]) || bicolores.find((c) => c.fotos[vistaId]);
  const copiar = (zonas) => zonas.map((z) => ({ ...z }));
  return (
    <section className={s.bloque}>
      <h3 className={s.titulo}>Zonas de los bicolores</h3>
      <p className={s.ayuda}>Los bicolores tienen una costura al medio: pueden llevar otras zonas (un pecho a cada lado). Arma unas para todos y, si alguno es distinto, dale las suyas. Sin propias usa las de todos los bicolores, y si tampoco hay, las de la prenda. Las zonas copiadas conservan su nombre: un diseño que ya estaba no se mueve.</p>
      <div className={s.pestanas} role="tablist" aria-label="De qué bicolor">
        <Chip tamano="sm" activo={!objetivo} onClick={() => setObjetivoId(null)}>Todos los bicolores</Chip>
        {bicolores.map((c) => <Chip key={c.id} tamano="sm" activo={objetivo?.id === c.id} onClick={() => setObjetivoId(c.id)}>{c.nombre}{c.zonas ? ' · propias' : ''}</Chip>)}
      </div>
      {!objetivo && bicolores.length > 1 && (
        <div className={s.verEn}>
          <span>Sobre la foto de</span>
          {bicolores.map((c) => <button key={c.id} type="button" className={[s.punto, previo === c.id && s.puntoActivo].filter(Boolean).join(' ')} style={{ background: fondoMuestra(c) }} title={c.nombre} aria-label={c.nombre} onClick={() => setPrevio(c.id)} />)}
        </div>
      )}
      {vistas.map((v, i) => {
        const normal = normalizarVista(v, i);
        const escala = { referencia: normalizarReferencia(v.referencia), anchoImg: v.anchoImg, altoImg: v.altoImg };
        const deTodos = Array.isArray(v.zonasBicolor) ? v.zonasBicolor : normal.zonasBicolor;
        const propias = objetivo ? extras[objetivo.id]?.zonas?.[normal.id] : null;
        const editando = objetivo ? propias : deTodos;
        const guardar = (zonas) => {
          const lista = zonas && zonas.length ? zonas : null;
          if (!objetivo) { setVista(i, { zonasBicolor: lista }); return; }
          onPrenda((prev) => {
            const actual = (prev.colores || {})[objetivo.id] || { fotos: {} };
            const zonasColor = { ...(actual.zonas || {}) };
            if (lista) zonasColor[normal.id] = lista; else delete zonasColor[normal.id];
            return { colores: { ...(prev.colores || {}), [objetivo.id]: { ...actual, zonas: zonasColor } } };
          });
        };
        const heredadas = objetivo ? (deTodos?.length ? deTodos : normal.zonas) : normal.zonas;
        const foto = objetivo ? objetivo.fotos[normal.id] : conFoto(normal.id)?.fotos[normal.id];
        const clave = `${objetivo?.id || 'todos'}:${normal.id}`;
        return (
          <div key={normal.id} className={s.vista}>
            <div className={s.cabeza}>
              <strong>{normal.nombre}</strong>
              {editando?.length > 0 && <Boton tamano="sm" variante="fantasma" onClick={() => setQuitar({ guardar, texto: objetivo ? `Usará las de todos los bicolores en ${normal.nombre}.` : `Usarán las de la prenda en ${normal.nombre}.` })}>{objetivo ? 'Usar las de todos' : 'Usar las de la prenda'}</Boton>}
            </div>
            {foto ? (
              editando?.length ? (
                <div className={s.vistaCuerpo}>
                  <EditorZonas imagen={foto} colorHex="#FFFFFF" zonas={editando} seleccionada={elegida[clave] ?? 0} onSeleccionar={(zi) => setElegida((m) => ({ ...m, [clave]: zi }))} onCambiar={(zi, z) => guardar(editando.map((x, k) => (k === zi ? z : x)))} referencia={v.referencia} />
                  <ListaZonas id={`bicolor-${clave}`} zonas={editando} escala={escala} elegida={elegida[clave] ?? 0} onElegir={(zi) => setElegida((m) => ({ ...m, [clave]: zi }))} onCambiar={(zi, z) => guardar(editando.map((x, k) => (k === zi ? z : x)))} onZonas={guardar} />
                </div>
              ) : (
                <div className={s.heredadas}>
                  <span className={s.ayuda}>Usa {objetivo && deTodos?.length ? 'las de todos los bicolores' : 'las de la prenda'} ({heredadas.length}).</span>
                  <Boton tamano="sm" variante="secundario" icono={<Repeat aria-hidden="true" />} onClick={() => guardar(copiar(heredadas))}>Crear zonas propias</Boton>
                </div>
              )
            ) : (
              <p className={s.ayuda}>{objetivo ? `${objetivo.nombre} no tiene su foto de ${normal.nombre}: súbela en «Colores y fotos».` : 'Ningún bicolor tiene su foto de esta vista todavía.'}</p>
            )}
          </div>
        );
      })}
      <Confirmar abierta={Boolean(quitar)} titulo="¿Quitar estas zonas?" texto={quitar?.texto} confirmar="Quitar" peligro onConfirmar={() => { quitar.guardar(null); setQuitar(null); }} onCancelar={() => setQuitar(null)} />
    </section>
  );
}

/* La foto de tienda de un color: subirla o hacerla con una plantilla. */
function FotoDeTienda({ color, foto, vistas, laser = false, plantillas, onFoto, subir, subiendo, fotoConPlantilla }) {
  const toast = useToast();
  const [eligiendo, setEligiendo] = useState(false);
  const [haciendo, setHaciendo] = useState(false);
  const propia = foto && !vistas.some((v) => v.imagen === foto);
  const conPlantilla = async (p) => {
    setEligiendo(false);
    setHaciendo(true);
    try { onFoto(await fotoConPlantilla(color, p, { vistas, laser })); } catch (err) { toast({ tipo: 'error', titulo: 'No se pudo hacer la foto', texto: err?.message }); } finally { setHaciendo(false); }
  };
  return (
    <div className={s.tienda}>
      <span className={s.tiendaFoto}>{haciendo ? <Loader2 className={s.girar} aria-hidden="true" /> : propia ? <img src={foto} alt="" /> : <span>Sin foto</span>}</span>
      <div className={s.tiendaTextos}>
        <strong>Foto de tienda</strong>
        <span className={s.ayuda}>{propia ? 'La que se ve en la tienda y en su página.' : 'Sin ella, la tienda muestra el producto en blanco.'}</span>
        <div className={s.botones}>
          <BotonSubir texto={propia ? 'Cambiar' : 'Subir'} subiendo={subiendo} acepta="image/*" onArchivo={async (a) => { const url = await subir(a); if (url) onFoto(url); }} />
          {fotoConPlantilla && plantillas.length > 0 && <Boton tamano="sm" variante="fantasma" icono={<LayoutTemplate aria-hidden="true" />} onClick={() => setEligiendo((x) => !x)} disabled={haciendo}>Con una plantilla</Boton>}
        </div>
        {eligiendo && (
          <div className={s.tiendaPlantillas}>
            {plantillas.map((p) => (
              <button key={p.id} type="button" onClick={() => conPlantilla(p)} title={p.nombre}>
                {p.imagen && <img src={p.imagen} alt="" />}
                <span>{p.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Los colores de un personalizable (en «Colores y fotos», debajo de los
 * colores de la ficha): bicolor (segundo tono y patrón), su versión
 * invertida, la foto de tienda y la foto propia de cada vista.
 *  - prenda · onPrenda · variantes · onAgregarVariantes([{ id, nombre, color, tallas }]) · onFotoTienda(id, url)
 *  - subirImagen · fotoConPlantilla(color, plantilla, { vistas, laser }) → promesa con la url (fotoDeTiendaConPlantilla)
 */
export function ColoresPrenda({ prenda, onPrenda, variantes = [], onAgregarVariantes, onFotoTienda, subirImagen, fotoConPlantilla }) {
  const toast = useToast();
  const [subirCrear, subiendoCrear] = useSubir(subirImagen, 'crear');
  const [subirTienda, subiendoTienda] = useSubir(subirImagen, 'tienda');
  const vistas = (prenda?.vistas || []).map((v, i) => normalizarVista(v, i));
  const extras = prenda?.colores || {};
  const { colores } = leerPrendaBase({ variants: variantesCrudas(variantes), prendaBase: { vistas, colores: extras } });
  const plantillas = leerPlantillas(prenda?.plantillas);
  const setExtra = (id, cambios) => onPrenda((prev) => ({ colores: { ...(prev.colores || {}), [id]: { fotos: {}, ...(prev.colores || {})[id], ...cambios } } }));

  const agregarPolera = () => {
    const existen = new Set(variantes.map((v) => String(v.nombre || '').trim().toLowerCase()));
    const nuevos = COLORES_POLERA.filter((c) => !existen.has(c.nombre.toLowerCase()));
    if (!nuevos.length) { toast({ tipo: 'info', titulo: 'Ya tiene todos los colores de la polera' }); return; }
    const creados = nuevos.map((c, i) => ({ ...c, id: `var_${Date.now()}_${i}` }));
    onAgregarVariantes?.(creados.map((c) => ({ id: c.id, nombre: c.nombre, color: c.hex, tallas: TALLAS_POLERA })));
    const bicolores = Object.fromEntries(creados.filter((c) => c.hex2).map((c) => [c.id, { hex2: c.hex2, ...(c.patron && { patron: c.patron }), fotos: {} }]));
    if (Object.keys(bicolores).length) onPrenda((prev) => ({ colores: { ...(prev.colores || {}), ...bicolores } }));
    toast({ tipo: 'exito', titulo: `${creados.length} colores agregados`, texto: 'Con tallas S a XL.' });
  };
  const nombreInvertido = (n) => { const p = String(n || '').split('/').map((x) => x.trim()).filter(Boolean); return p.length === 2 ? `${p[1]} / ${p[0]}` : `${n} (al revés)`; };
  const invertidoDe = (c) => colores.find((o) => o.espejoDe === c.id);
  const agregarInvertido = (c) => {
    if (invertidoDe(c)) return;
    const id = `var_${Date.now()}_inv`;
    onAgregarVariantes?.([{ id, nombre: nombreInvertido(c.nombre), color: c.hex2, tallas: c.tallas.length ? c.tallas : TALLAS_POLERA }]);
    onPrenda((prev) => ({ colores: { ...(prev.colores || {}), [id]: { espejoDe: c.id, hex2: c.hex, fotos: {} } } }));
  };

  return (
    <section className={s.bloque} data-componente="ColoresPrenda">
      <div className={s.cabeza}>
        <h3 className={s.titulo}>Fotos para diseñar y de tienda</h3>
        <Boton tamano="sm" variante="secundario" icono={<Palette aria-hidden="true" />} onClick={agregarPolera}>Colores de polera (S–XL)</Boton>
      </div>
      <p className={s.ayuda}>Cada color tiene la foto <strong>de tienda</strong> (la que se ve al comprarlo) y las <strong>fotos para diseñar</strong>, que se tiñen solas sobre la foto blanca de cada vista; si alguna no queda bien, súbele la suya. Los <strong>bicolores</strong> necesitan su foto en cada vista: sin ella no se ofrecen.</p>
      {!colores.length ? <p className={s.ayuda}>Aún no hay colores.</p> : (
        <ul className={s.colores}>
          {colores.map((c) => {
            const listo = colorDisponible(c, vistas);
            const v = variantes.find((x) => x.id === c.id);
            return (
              <li key={c.id} className={s.color}>
                <div className={s.colorCabeza}>
                  <span className={s.muestra} style={{ background: fondoMuestra(c) }} aria-hidden="true" />
                  <strong>{c.nombre}</strong>
                  {c.espejo
                    ? <span className={s.ayuda}>Al revés de {colores.find((o) => o.id === c.espejoDe)?.nombre || 'su original'}</span>
                    : c.hex2 && (invertidoDe(c) ? <span className={s.ayuda}>Tiene su invertido</span> : <Boton tamano="sm" variante="fantasma" icono={<Repeat aria-hidden="true" />} onClick={() => agregarInvertido(c)}>Agregar versión invertida</Boton>)}
                </div>
                {!c.espejo && (
                  <div className={s.bicolor}>
                    <Interruptor etiqueta="Bicolor" activo={Boolean(c.hex2)} onChange={(si) => setExtra(c.id, { hex2: si ? '#101010' : '' })} />
                    {c.hex2 && <CampoColor etiqueta="Segundo tono" valor={c.hex2} onCambiar={(hex) => setExtra(c.id, { hex2: String(hex).toUpperCase() })} />}
                    {c.hex2 && <Campo etiqueta="Cómo se reparten" opciones={PATRONES_BICOLOR.map((p) => ({ valor: p.id, texto: p.nombre }))} value={c.patron} onChange={(e) => setExtra(c.id, { patron: e.target.value })} />}
                  </div>
                )}
                {!listo && <p className={s.falta}><AlertTriangle aria-hidden="true" /> Le falta su foto en alguna vista: no sale en Crear hasta tenerla.</p>}
                {onFotoTienda && !c.espejo && (
                  <FotoDeTienda color={c} foto={v?.foto} vistas={vistas} laser={leerTecnica(prenda?.tecnica) === 'laser'} plantillas={plantillas} onFoto={(url) => onFotoTienda(c.id, url)} subir={(a) => subirTienda(a, c.id)} subiendo={subiendoTienda === c.id} fotoConPlantilla={fotoConPlantilla} />
                )}
                {vistas.length > 0 && (
                  <div className={s.porVista}>
                    {vistas.map((vista) => (
                      <div key={vista.id} className={s.porVistaFoto}>
                        <Miniatura imagen={c.fotos[vista.id] || vista.imagen} hex={c.fotos[vista.id] ? '#FFFFFF' : c.hex} nombre={vista.nombre} espejo={Boolean(c.espejo && c.fotos[vista.id])} />
                        <span className={s.ayuda}>{vista.nombre}</span>
                        {c.espejo ? null : c.fotos[vista.id]
                          ? <Boton tamano="sm" variante="fantasma" onClick={() => setExtra(c.id, { fotos: Object.fromEntries(Object.entries(c.fotos).filter(([k]) => k !== vista.id)) })}>Quitar foto</Boton>
                          : <BotonSubir texto="Foto propia" subiendo={subiendoCrear === `${c.id}-${vista.id}`} onArchivo={async (a) => { const url = await subirCrear(a, `${c.id}-${vista.id}`); if (url) setExtra(c.id, { fotos: { ...c.fotos, [vista.id]: url } }); }} />}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const GRUPOS_BASE = ['Parejas', 'Equipos'];

/**
 * Las plantillas de un personalizable: se guardan al momento (no esperan a
 * "Guardar"), igual que en el estudio, para que no se pisen.
 *  - plantillas (leerPlantillas) · guardado (sin él, no se puede: primero guarda el producto)
 *  - onRenombrar(id, nombre) · onGrupo(id, grupo) · onQuitar(id) → promesas
 *  - urlNueva · urlEditar(id) (el estudio) · estadoEnlace (el `state` de esos enlaces: en el admin,
 *    { desde } para que el estudio vuelva a esta pestaña) · otras: [{ id, nombre, plantillas }] (para traer)
 *  - onTraer(origenId, ids) → promesa
 */
export function PlantillasPrenda({ plantillas = [], guardado = true, onRenombrar, onGrupo, onQuitar, urlNueva, urlEditar, estadoEnlace, otras = [], onTraer }) {
  const toast = useToast();
  const [grupo, setGrupo] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [quitar, setQuitar] = useState(null);
  const [trayendo, setTrayendo] = useState(null); // { origenId, elegidas }
  const grupos = [...new Set([...GRUPOS_BASE, ...plantillas.map((p) => p.grupo).filter(Boolean)])];
  const visibles = grupo ? plantillas.filter((p) => p.grupo === grupo) : plantillas;
  const hacer = async (clave, fn, exito) => {
    setOcupado(clave);
    try { await fn(); if (exito) toast({ tipo: 'exito', titulo: exito }); } catch (err) { toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' }); } finally { setOcupado(null); }
  };
  if (!guardado) return <EstadoVacio imagen={null} icono={<LayoutTemplate aria-hidden="true" />} titulo="Primero guarda el producto" texto="Las plantillas se arman en el estudio con el producto ya creado." />;
  const origen = otras.find((o) => o.id === trayendo?.origenId);
  return (
    <section className={s.bloque} data-componente="PlantillasPrenda">
      <div className={s.cabeza}>
        <h3 className={s.titulo}>Plantillas · {plantillas.length}</h3>
        <span className={s.botones}>
          {onTraer && otras.length > 0 && <Boton tamano="sm" variante="secundario" onClick={() => setTrayendo({ origenId: '', elegidas: [] })}>Traer de otro</Boton>}
          {urlNueva && <Boton tamano="sm" icono={<Plus aria-hidden="true" />} to={urlNueva} state={estadoEnlace}>Nueva plantilla</Boton>}
        </span>
      </div>
      <p className={s.ayuda}>Los diseños para empezar que el cliente ve en el estudio («Empieza con un diseño»), por grupo. Lo que cambias aquí se guarda al momento.</p>
      {plantillas.length > 0 && (
        <div className={s.pestanas}>
          <Chip tamano="sm" activo={!grupo} cuenta={plantillas.length} onClick={() => setGrupo('')}>Todas</Chip>
          {grupos.filter((g) => plantillas.some((p) => p.grupo === g)).map((g) => <Chip key={g} tamano="sm" activo={grupo === g} cuenta={plantillas.filter((p) => p.grupo === g).length} onClick={() => setGrupo(g)}>{g}</Chip>)}
        </div>
      )}
      {visibles.length ? (
        <ul className={s.plantillas}>
          {visibles.map((p) => (
            <li key={p.id} className={s.plantilla}>
              <span className={s.plantillaFoto}>{p.imagen ? <img src={p.imagen} alt="" loading="lazy" /> : <LayoutTemplate aria-hidden="true" />}</span>
              <input className={s.texto} defaultValue={p.nombre} aria-label="Nombre de la plantilla" onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== p.nombre) hacer(p.id, () => onRenombrar(p.id, n), 'Nombre guardado'); }} disabled={ocupado === p.id} />
              <Campo etiqueta="Grupo" opciones={[{ valor: '', texto: 'Sin grupo' }, ...grupos.map((g) => ({ valor: g, texto: g }))]} creable value={p.grupo} onChange={(e) => hacer(p.id, () => onGrupo(p.id, e.target.value), 'Grupo guardado')} />
              <span className={s.botones}>
                {urlEditar && <Boton tamano="sm" variante="secundario" icono={<Pencil aria-hidden="true" />} to={urlEditar(p.id)} state={estadoEnlace}>Editar</Boton>}
                <Boton soloIcono tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} aria-label={`Quitar ${p.nombre}`} onClick={() => setQuitar(p)} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio imagen={null} icono={<LayoutTemplate aria-hidden="true" />} titulo="Sin plantillas todavía" texto="Crea una en el estudio o tráelas de otro producto." />
      )}
      <Confirmar abierta={Boolean(quitar)} titulo={quitar ? `¿Quitar «${quitar.nombre}»?` : ''} texto="Deja de salir en el estudio. Los diseños que ya la usaron no cambian." confirmar="Quitar" peligro onConfirmar={async () => { const p = quitar; setQuitar(null); await hacer(p.id, () => onQuitar(p.id), 'Plantilla quitada'); }} onCancelar={() => setQuitar(null)} />
      <HojaInferior
        abierta={Boolean(trayendo)}
        onCerrar={() => ocupado !== 'traer' && setTrayendo(null)}
        titulo="Traer plantillas de otro producto"
        bloqueada={ocupado === 'traer'}
        pie={<Boton cargando={ocupado === 'traer'} disabled={!trayendo?.elegidas.length} onClick={() => hacer('traer', async () => { await onTraer(trayendo.origenId, trayendo.elegidas); setTrayendo(null); }, 'Plantillas traídas')}>Traer {trayendo?.elegidas.length || 0}</Boton>}
      >
        <div className={s.traer}>
          <Campo etiqueta="De qué producto" opciones={otras.map((o) => ({ valor: o.id, texto: `${o.nombre} · ${o.plantillas.length}` }))} value={trayendo?.origenId || ''} onChange={(e) => setTrayendo({ origenId: e.target.value, elegidas: [] })} />
          {origen && (
            <>
              <div className={s.botones}>
                <Boton tamano="sm" variante="fantasma" onClick={() => setTrayendo((t) => ({ ...t, elegidas: origen.plantillas.map((p) => p.id) }))}>Elegir todas</Boton>
                <Boton tamano="sm" variante="fantasma" onClick={() => setTrayendo((t) => ({ ...t, elegidas: [] }))}>Ninguna</Boton>
              </div>
              {origen.plantillas.map((p) => (
                <Casilla key={p.id} etiqueta={p.nombre} descripcion={p.grupo || undefined} activo={trayendo.elegidas.includes(p.id)} onChange={(si) => setTrayendo((t) => ({ ...t, elegidas: si ? [...t.elegidas, p.id] : t.elegidas.filter((x) => x !== p.id) }))} />
              ))}
              <p className={s.ayuda}>Cada plantilla se acomoda en la zona más parecida de este producto; sus imágenes se copian.</p>
            </>
          )}
        </div>
      </HojaInferior>
    </section>
  );
}
