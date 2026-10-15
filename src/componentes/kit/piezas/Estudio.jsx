import React, { useRef } from 'react';
import {
  Undo2, Redo2, Minus, Plus, Crosshair, Trash2, ImagePlus, Type, ZoomIn, ZoomOut, Keyboard, Check,
  Copy, ArrowUpToLine, ArrowDownToLine, RotateCw, FlipHorizontal, Crop, Eraser, Maximize2,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
} from 'lucide-react';
import Boton from '../Boton';
import Acordeon from '../Acordeon';
import { Chip } from '../Etiquetas';
import { Campo, Cantidad, Interruptor, SelectorColor } from '../Formulario';
import { Sello } from '../Marca';
import s from './Estudio.module.css';

/*
 * Piezas del estudio de Crear (/crear/:id): el lienzo de vista previa, la
 * barra rápida, los tres pasos y el panel de lo elegido (texto o imagen).
 * En la tienda el lienzo que se arrastra es fabric.js (CrearStudioPage);
 * aquí LienzoPrenda dibuja lo mismo para verlo y elegir, y todo lo demás
 * (paneles, botones, avisos) es el diseño que la tienda tomaría.
 */

/** Alto de una zona como fracción del alto de la foto (altoZonaFraccion). */
const altoZona = (z, anchoImg, altoImg) => (anchoImg && altoImg ? (z.w * anchoImg * z.proporcion) / altoImg : z.w);

/**
 * La prenda de un lado con sus zonas punteadas y los diseños encima. Las
 * capas se arrastran con el dedo o el ratón dentro de su zona.
 *  - imagen: foto del lado (en blanco) · foto: la del color, si existe
 *  - tinte: color para teñir la foto blanca (cuando no hay foto del color)
 *  - voltear: bicolor al revés (la foto en espejo)
 *  - anchoImg, altoImg · zonas: [{ id, nombre, x, y, w, proporcion, angulo }]
 *  - capas: { [zonaId]: [{ id, tipo: 'imagen' | 'texto', src, texto, fuente,
 *    color, x, y (centro, 0–1 de la zona), ancho (0–1 de la zona), angulo,
 *    tamano (alto de letra, 0–1 del ancho de la zona), negrita, cursiva,
 *    contorno, sombra, voltear }] }
 *  - zonaActiva · seleccion: id de la capa elegida · oscura: prenda oscura
 *    (las guías van en blanco) · guias: false para la foto final (sin zonas)
 *  - onElegirZona(id) · onElegirCapa(id, zonaId) · onMoverCapa(id, { x, y })
 *    mientras se arrastra · onSoltarCapa() al terminar (para deshacer)
 *  - zoom · encima: lo que va sobre el lienzo (empezar, cargando…)
 */
export function LienzoPrenda({
  imagen, foto, tinte, voltear = false, anchoImg = 1000, altoImg = 1200, zonas = [], capas = {},
  zonaActiva, seleccion, oscura = false, guias = true, onElegirZona, onElegirCapa, onMoverCapa, onSoltarCapa,
  encima, zoom = 1, className,
}) {
  const arrastre = useRef(null);

  const empezar = (e, c, zonaId) => {
    e.stopPropagation();
    onElegirCapa?.(c.id, zonaId);
    if (!onMoverCapa) return;
    const caja = e.currentTarget.closest('[data-zona]').getBoundingClientRect();
    arrastre.current = { id: c.id, caja, dx: e.clientX - (caja.left + (c.x ?? 0.5) * caja.width), dy: e.clientY - (caja.top + (c.y ?? 0.5) * caja.height), movio: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const mover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const x = Math.min(1, Math.max(0, (e.clientX - a.dx - a.caja.left) / a.caja.width));
    const y = Math.min(1, Math.max(0, (e.clientY - a.dy - a.caja.top) / a.caja.height));
    a.movio = true;
    onMoverCapa(a.id, { x, y });
  };
  const soltar = () => {
    if (arrastre.current?.movio) onSoltarCapa?.();
    arrastre.current = null;
  };

  const espejo = voltear ? { transform: 'scaleX(-1)' } : undefined;
  return (
    <div className={[s.lienzo, oscura && s.oscura, className].filter(Boolean).join(' ')} data-componente="LienzoPrenda">
      <div className={s.lienzoEscala} style={{ aspectRatio: `${anchoImg} / ${altoImg}`, '--proporcion': anchoImg / altoImg, transform: zoom !== 1 ? `scale(${zoom})` : undefined }}>
        {/* Sin foto del color: la foto blanca teñida (el color recortado con su silueta + multiply). */}
        {!foto && tinte && <span className={s.tinte} style={{ ...espejo, background: tinte, WebkitMaskImage: `url("${imagen}")`, maskImage: `url("${imagen}")` }} aria-hidden="true" />}
        <img className={[s.prenda, !foto && tinte && s.prendaTenida].filter(Boolean).join(' ')} style={espejo} src={foto || imagen} alt="" draggable={false} />
        {/* En una prenda oscura el multiply apaga los pliegues: la foto vuelve, tenue, como luz. */}
        {!foto && tinte && oscura && <img className={s.luz} style={espejo} src={imagen} alt="" draggable={false} aria-hidden="true" />}
        {zonas.map((z) => {
          const activa = guias && z.id === zonaActiva;
          return (
            <div
              key={z.id}
              data-zona={z.id}
              className={[s.zona, !guias && s.sinGuia, activa && s.zonaActiva].filter(Boolean).join(' ')}
              style={{
                left: `${z.x * 100}%`,
                top: `${z.y * 100}%`,
                width: `${z.w * 100}%`,
                height: `${altoZona(z, anchoImg, altoImg) * 100}%`,
                transform: z.angulo ? `rotate(${z.angulo}deg)` : undefined,
              }}
              onClick={guias ? () => onElegirZona?.(z.id) : undefined}
              role={guias ? 'button' : undefined}
              tabIndex={guias ? 0 : undefined}
              aria-label={guias ? `Zona ${z.nombre}` : undefined}
              onKeyDown={guias ? (e) => { if (e.key === 'Enter') onElegirZona?.(z.id); } : undefined}
            >
              <div className={s.recorte}>
                {(capas[z.id] || []).map((c) => (
                  <span
                    key={c.id}
                    className={[s.capa, guias && c.id === seleccion && s.capaElegida].filter(Boolean).join(' ')}
                    style={{
                      left: `${(c.x ?? 0.5) * 100}%`,
                      top: `${(c.y ?? 0.5) * 100}%`,
                      width: c.tipo === 'imagen' ? `${(c.ancho ?? 0.8) * 100}%` : undefined,
                      transform: `translate(-50%, -50%) rotate(${c.angulo || 0}deg)${c.voltear ? ' scaleX(-1)' : ''}`,
                    }}
                    onPointerDown={guias ? (e) => empezar(e, c, z.id) : undefined}
                    onPointerMove={guias ? mover : undefined}
                    onPointerUp={guias ? soltar : undefined}
                    onPointerCancel={guias ? soltar : undefined}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.tipo === 'imagen' ? (
                      <img src={c.src} alt="" draggable={false} />
                    ) : (
                      <span
                        className={s.texto}
                        style={{
                          fontFamily: c.fuente ? `'${c.fuente}', var(--fuente-marca)` : undefined,
                          fontSize: `${(c.tamano ?? 0.18) * 100}cqw`,
                          color: c.color,
                          fontWeight: c.negrita ? 900 : 400,
                          fontStyle: c.cursiva ? 'italic' : undefined,
                          WebkitTextStroke: c.contorno ? `${c.grosor || 0.06}em ${c.contornoColor || '#111'}` : undefined,
                          textShadow: c.sombra ? `0.06em 0.06em 0 ${c.sombraColor || 'rgba(0,0,0,.45)'}` : undefined,
                        }}
                      >
                        {c.texto}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              {activa && <span className={s.zonaNombre} style={z.angulo ? { transform: `translateX(-50%) rotate(${-z.angulo}deg)` } : undefined}>{z.nombre}</span>}
            </div>
          );
        })}
      </div>
      {encima}
    </div>
  );
}

/**
 * La barra rápida bajo el lienzo: deshacer y rehacer; con algo elegido,
 * achicar, agrandar, centrar y quitar; siempre, + Imagen y + Texto; el zoom
 * y los atajos.
 *  - puedeDeshacer, puedeRehacer, onDeshacer, onRehacer · elegido (bool)
 *  - onAchicar, onAgrandar, onCentrar, onQuitar · onImagen, onTexto
 *  - zoom, onZoom(z) · onAtajos
 */
export function BarraLienzo({
  puedeDeshacer, puedeRehacer, onDeshacer, onRehacer, elegido = false,
  onAchicar, onAgrandar, onCentrar, onQuitar, onImagen, onTexto, zoom = 1, onZoom, onAtajos,
}) {
  const NIVELES = [1, 1.5, 2, 3, 4];
  const i = NIVELES.indexOf(zoom);
  const B = (props) => <Boton variante="fantasma" tamano="sm" soloIcono {...props} />;
  return (
    <div className={s.barra} role="toolbar" aria-label="Herramientas del lienzo" data-componente="BarraLienzo">
      <span className={s.grupoBarra}>
        <B aria-label="Deshacer" icono={<Undo2 aria-hidden="true" />} disabled={!puedeDeshacer} onClick={onDeshacer} />
        <B aria-label="Rehacer" icono={<Redo2 aria-hidden="true" />} disabled={!puedeRehacer} onClick={onRehacer} />
      </span>
      {elegido && (
        <span className={s.grupoBarra}>
          <B aria-label="Achicar" icono={<Minus aria-hidden="true" />} onClick={onAchicar} />
          <B aria-label="Agrandar" icono={<Plus aria-hidden="true" />} onClick={onAgrandar} />
          <B aria-label="Centrar" icono={<Crosshair aria-hidden="true" />} onClick={onCentrar} />
          <Boton variante="fantasma" tamano="sm" soloIcono aria-label="Quitar" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar} className={s.peligro} />
        </span>
      )}
      <span className={s.grupoBarra}>
        <Boton variante="contorno" tamano="sm" icono={<ImagePlus aria-hidden="true" />} onClick={onImagen}>Imagen</Boton>
        <Boton variante="contorno" tamano="sm" icono={<Type aria-hidden="true" />} onClick={onTexto}>Texto</Boton>
      </span>
      {/* En el celular se acerca con los dedos: el zoom queda para el ratón. */}
      <span className={[s.grupoBarra, s.grupoZoom].join(' ')}>
        <B aria-label="Alejar" icono={<ZoomOut aria-hidden="true" />} disabled={i <= 0} onClick={() => onZoom?.(NIVELES[Math.max(0, i - 1)])} />
        <button type="button" className={s.zoomValor} onClick={() => onZoom?.(1)} title="Ver la prenda completa">{Math.round(zoom * 100)}%</button>
        <B aria-label="Acercar" icono={<ZoomIn aria-hidden="true" />} disabled={i >= NIVELES.length - 1} onClick={() => onZoom?.(NIVELES[Math.min(NIVELES.length - 1, i + 1)])} />
        {onAtajos && <B aria-label="Atajos de teclado" icono={<Keyboard aria-hidden="true" />} onClick={onAtajos} className={s.soloRaton} />}
      </span>
    </div>
  );
}

/** Un paso del panel, con su número en un sello. */
export function PasoEstudio({ numero, titulo, detalle, children }) {
  return (
    <section className={s.paso} data-componente="PasoEstudio">
      <h2 className={s.pasoTitulo}>
        <Sello tamano={30} girar={numero % 2 ? -8 : 6}><b className={s.pasoNumero}>{numero}</b></Sello>
        <span>{titulo}{detalle && <em>: {detalle}</em>}</span>
      </h2>
      {children}
    </section>
  );
}

/**
 * Los tres pasos sin nada elegido: el color de la prenda, la zona donde va el
 * diseño (por lado) y agregar una imagen o un texto.
 *  - colores: [{ id, nombre, hex, claro }] · color (id) · onColor(id)
 *  - invertir: { activo, texto, onCambiar } (colores con versión al revés)
 *  - lados: [{ nombre, zonas: [{ id, nombre, conDiseno }] }] · zona · onZona(id)
 *  - onImagen, onTexto · subiendo · donde: "Frente · Pecho"
 */
export function PasosEstudio({ colores = [], color, onColor, invertir, lados = [], zona, onZona, onImagen, onTexto, subiendo = false, donde }) {
  const actual = colores.find((c) => c.id === color);
  return (
    <div className={s.pasos} data-componente="PasosEstudio">
      <PasoEstudio numero={1} titulo="Elige el color" detalle={actual?.nombre}>
        <SelectorColor etiqueta="Color de la prenda" colores={colores} valor={actual?.nombre} onChange={(nombre) => onColor?.(colores.find((c) => c.nombre === nombre)?.id)} />
        {invertir && <Interruptor activo={invertir.activo} onChange={invertir.onCambiar} etiqueta="Invertir colores" descripcion={invertir.texto} />}
      </PasoEstudio>
      <PasoEstudio numero={2} titulo="¿Dónde va tu diseño?">
        {lados.map((l) => (
          <div key={l.nombre} className={s.lado}>
            <span className={s.ladoNombre}>{l.nombre}</span>
            <div className={s.chips}>
              {l.zonas.map((z) => (
                <Chip key={z.id} tamano="sm" activo={z.id === zona} onClick={() => onZona?.(z.id)}>
                  {z.nombre}{z.conDiseno && <span className={s.conDiseno} title="Con diseño"><span className={s.oculto}>, con diseño</span></span>}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </PasoEstudio>
      <PasoEstudio numero={3} titulo="Agrega tu imagen o tu texto">
        <div className={s.agregar}>
          <button type="button" className={s.agregarOpcion} onClick={onImagen} disabled={subiendo}>
            <Sello tamano={42} girar={-8}><ImagePlus aria-hidden="true" /></Sello>
            <strong>Subir imagen</strong>
            <small>Una foto o un logo</small>
          </button>
          <button type="button" className={s.agregarOpcion} onClick={onTexto}>
            <Sello tamano={42} girar={6} tono="rosa"><Type aria-hidden="true" /></Sello>
            <strong>Escribir texto</strong>
            <small>Un nombre o una frase</small>
          </button>
        </div>
        {donde && <p className={s.donde}>{subiendo ? 'Subiendo tu imagen…' : <>Se agrega en: <strong>{donde}</strong></>}</p>}
      </PasoEstudio>
    </div>
  );
}

const COLORES_TEXTO = [
  ['Negro', '#111111'], ['Blanco', '#ffffff', true], ['Violeta', '#7c3aed'], ['Rojo', '#dc2626'],
  ['Rosa', '#ec4899'], ['Dorado', '#d4a017'], ['Azul', '#2563eb'], ['Verde', '#16a34a'],
].map(([nombre, hex, claro]) => ({ nombre, hex, claro }));

const ESTILOS = [
  ['normal', 'Normal', {}],
  ['contorno', 'Contorno', { contorno: true, contornoColor: '#111111', grosor: 0.06, sombra: false }],
  ['sombra', 'Sombra', { sombra: true, contorno: false }],
  ['sticker', 'Sticker', { contorno: true, contornoColor: '#ffffff', grosor: 0.14, sombra: true }],
];

const ALINEAR = [
  ['izquierda', AlignStartVertical, 'Izquierda'], ['centroH', AlignCenterVertical, 'Al centro'], ['derecha', AlignEndVertical, 'Derecha'],
  ['arriba', AlignStartHorizontal, 'Arriba'], ['centroV', AlignCenterHorizontal, 'Al medio'], ['abajo', AlignEndHorizontal, 'Abajo'],
];

/**
 * El panel de lo elegido (una imagen o un texto): sus ajustes, que se ven en
 * la prenda al instante, y "Listo" para volver a los pasos.
 *  - capa (ver LienzoPrenda) · zona: nombre · onCambiar(cambios) · onListo
 *  - fuentes: [{ valor, texto, detalle (su grupo) }] · calidad: 'buena' | 'aceptable' | 'baja'
 *  - onAchicar, onAgrandar, onCentrar, onAlinear(donde), onQuitar, onDuplicar,
 *    onAdelante, onAtras, onRecortar, onQuitarFondo, onLlenar
 *  - zonas: [{ id, nombre }] · onPasarAZona(id) · sinSesion: recortar y quitar fondo apagados
 */
export function PanelCapa({
  capa, zona, onCambiar, onListo, fuentes = [], calidad,
  onAchicar, onAgrandar, onCentrar, onAlinear, onQuitar, onDuplicar, onAdelante, onAtras,
  onRecortar, onQuitarFondo, onLlenar, zonas = [], onPasarAZona, sinSesion = false,
}) {
  if (!capa) return null;
  const imagen = capa.tipo === 'imagen';
  const estilo = !capa.contorno && !capa.sombra ? 'normal'
    : capa.contorno && capa.sombra ? 'sticker'
    : capa.contorno ? 'contorno' : 'sombra';
  const CALIDAD = {
    buena: ['ok', 'Se imprimirá con buena calidad.'],
    aceptable: ['aviso', 'Calidad aceptable. Si la achicas un poco se verá más nítida.'],
    baja: ['mal', 'Se verá borrosa a este tamaño. Achícala o usa una imagen más grande.'],
  }[calidad];
  return (
    <div className={s.panelCapa} data-componente="PanelCapa">
      <header className={s.panelCabeza}>
        <div>
          <h2 className={s.panelTitulo}>{imagen ? 'Tu imagen' : 'Tu texto'} <em>en {zona}</em></h2>
          <p className={s.panelAyuda}>Los cambios se ven en la prenda al instante.</p>
        </div>
        <Boton tamano="sm" icono={<Check aria-hidden="true" />} onClick={onListo}>Listo</Boton>
      </header>

      {imagen && CALIDAD && <p className={[s.calidad, s[`calidad_${CALIDAD[0]}`]].join(' ')}>{CALIDAD[1]}</p>}

      {!imagen && (
        <>
          <Campo
            etiqueta="Escribe tu texto"
            control={(aria) => (
              <textarea {...aria} className={s.areaTexto} rows={2} maxLength={120} value={capa.texto || ''} onChange={(e) => onCambiar?.({ texto: e.target.value })} />
            )}
          />
          {fuentes.length > 0 && (
            <Campo etiqueta="Letra" opciones={fuentes.map((f) => ({ ...f, icono: <span className={s.muestraLetra} style={{ fontFamily: `'${f.valor}'` }}>Aa</span> }))} buscable value={capa.fuente} onChange={(e) => onCambiar?.({ fuente: e.target.value })} />
          )}
          <div className={s.fila}>
            <div className={s.grupoCampo}>
              <span className={s.rotulo}>Tamaño de letra</span>
              <Cantidad valor={Math.round((capa.tamano ?? 0.18) * 100)} min={4} max={60} onChange={(v) => onCambiar?.({ tamano: v / 100 })} />
            </div>
            <div className={s.grupoCampo}>
              <span className={s.rotulo}>Estilo</span>
              <span className={s.chips}>
                <Chip tamano="sm" activo={Boolean(capa.negrita)} onClick={() => onCambiar?.({ negrita: !capa.negrita })}><b>N</b></Chip>
                <Chip tamano="sm" activo={Boolean(capa.cursiva)} onClick={() => onCambiar?.({ cursiva: !capa.cursiva })}><i>C</i></Chip>
              </span>
            </div>
          </div>
          <SelectorColor etiqueta="Color de la letra" colores={COLORES_TEXTO} valor={COLORES_TEXTO.find((c) => c.hex === capa.color)?.nombre} onChange={(n) => onCambiar?.({ color: COLORES_TEXTO.find((c) => c.nombre === n)?.hex })} />
          <div className={s.grupoCampo}>
            <span className={s.rotulo}>Estilo de la letra</span>
            <span className={s.estilos}>
              {ESTILOS.map(([id, texto, valores]) => (
                <button
                  key={id}
                  type="button"
                  className={[s.estilo, estilo === id && s.estiloActivo].filter(Boolean).join(' ')}
                  onClick={() => onCambiar?.({ contorno: false, sombra: false, ...valores })}
                  aria-pressed={estilo === id}
                >
                  <span
                    className={s.estiloMuestra}
                    style={{
                      WebkitTextStroke: valores.contorno ? `1.5px ${valores.contornoColor || '#111'}` : undefined,
                      color: valores.contornoColor === '#ffffff' ? '#7c3aed' : valores.contorno ? '#fff' : 'var(--color-text)',
                      textShadow: valores.sombra ? '2px 2px 0 rgba(0,0,0,.35)' : undefined,
                    }}
                  >Aa</span>
                  {texto}
                </button>
              ))}
            </span>
          </div>
        </>
      )}

      <div className={s.grupoCampo}>
        <span className={s.rotulo}>Ajustar</span>
        <span className={s.chips}>
          <Boton variante="contorno" tamano="sm" icono={<Minus aria-hidden="true" />} onClick={onAchicar}>Achicar</Boton>
          <Boton variante="contorno" tamano="sm" icono={<Plus aria-hidden="true" />} onClick={onAgrandar}>Agrandar</Boton>
          <Boton variante="contorno" tamano="sm" icono={<Crosshair aria-hidden="true" />} onClick={onCentrar}>Centrar</Boton>
          {imagen && <Boton variante="contorno" tamano="sm" icono={<Eraser aria-hidden="true" />} onClick={onQuitarFondo} disabled={sinSesion}>Quitar fondo</Boton>}
          {imagen && <Boton variante="contorno" tamano="sm" icono={<Crop aria-hidden="true" />} onClick={onRecortar} disabled={sinSesion}>Recortar</Boton>}
          {imagen && <Boton variante="contorno" tamano="sm" icono={<Maximize2 aria-hidden="true" />} onClick={onLlenar}>Llenar zona</Boton>}
          <Boton variante="contorno" tamano="sm" icono={<RotateCw aria-hidden="true" />} onClick={() => onCambiar?.({ angulo: ((capa.angulo || 0) + 15) % 360 })}>Girar</Boton>
          <Boton variante="contorno" tamano="sm" icono={<Trash2 aria-hidden="true" />} onClick={onQuitar} className={s.peligro}>Quitar</Boton>
        </span>
        {sinSesion && imagen && <span className={s.nota}>Inicia sesión para recortar o quitar el fondo.</span>}
      </div>

      <div className={s.grupoCampo}>
        <span className={s.rotulo}>Alinear en la zona</span>
        <span className={s.alinear}>
          {ALINEAR.map(([id, Icono, texto]) => (
            <Boton key={id} variante="contorno" tamano="sm" soloIcono aria-label={texto} title={texto} icono={<Icono aria-hidden="true" />} onClick={() => onAlinear?.(id)} />
          ))}
        </span>
      </div>

      <Acordeon
        variante="lista"
        items={[{
          id: 'mas',
          question: 'Más opciones',
          answer: (
            <div className={s.mas}>
              <span className={s.chips}>
                {imagen && <Boton variante="fantasma" tamano="sm" icono={<FlipHorizontal aria-hidden="true" />} onClick={() => onCambiar?.({ voltear: !capa.voltear })}>Voltear</Boton>}
                <Boton variante="fantasma" tamano="sm" icono={<ArrowUpToLine aria-hidden="true" />} onClick={onAdelante}>Traer adelante</Boton>
                <Boton variante="fantasma" tamano="sm" icono={<ArrowDownToLine aria-hidden="true" />} onClick={onAtras}>Enviar atrás</Boton>
                <Boton variante="fantasma" tamano="sm" icono={<Copy aria-hidden="true" />} onClick={onDuplicar}>Duplicar</Boton>
              </span>
              {zonas.length > 1 && (
                <div className={s.grupoCampo}>
                  <span className={s.rotulo}>Pasar a otra zona</span>
                  <span className={s.chips}>{zonas.map((z) => <Chip key={z.id} tamano="sm" onClick={() => onPasarAZona?.(z.id)}>{z.nombre}</Chip>)}</span>
                </div>
              )}
            </div>
          ),
        }]}
      />
    </div>
  );
}
