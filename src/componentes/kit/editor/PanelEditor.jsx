import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import {
  ArrowLeft, ArrowDown, ArrowUp, Copy, GripVertical, Monitor, PanelLeft, PanelRight, Plus, Redo2, Smartphone, Trash2, Undo2, X,
  Maximize2, Minimize2,
} from 'lucide-react';
import Boton from '../Boton';
import { Buscador } from '../Formulario';
import { Pestanas } from '../Navegacion';
import { IsoWala } from '../Marca';
import { ESQUEMAS, GRUPOS_MODULOS, ajustesIniciales, esquemaDe, resumenDe } from './esquemas';
import { FormularioSeccion, ProveedorEditor } from './CamposEditor';
import s from './Editor.module.css';

/* ── Operaciones sobre la lista de secciones (siempre devuelven otra lista) ── */

const renumerar = (lista) => lista.map((x, order) => (x.order === order ? x : { ...x, order }));
const ordenadas = (lista) => [...lista].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
export const nuevoIdSeccion = () => `section_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function actualizarAjustes(secciones, id, parche) {
  return secciones.map((x) => (x.id === id ? { ...x, settings: { ...(x.settings || {}), ...parche } } : x));
}
export function insertarSeccion(secciones, seccion, indice = secciones.length) {
  const l = ordenadas(secciones);
  l.splice(indice, 0, seccion);
  return renumerar(l);
}
export function moverSeccion(secciones, id, paso) {
  const l = ordenadas(secciones);
  const i = l.findIndex((x) => x.id === id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= l.length) return secciones;
  [l[i], l[j]] = [l[j], l[i]];
  return renumerar(l);
}
export function duplicarSeccion(secciones, id) {
  const l = ordenadas(secciones);
  const i = l.findIndex((x) => x.id === id);
  if (i < 0) return secciones;
  l.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(l[i])), id: nuevoIdSeccion() });
  return renumerar(l);
}
export function quitarSeccion(secciones, id) {
  return renumerar(ordenadas(secciones).filter((x) => x.id !== id));
}

/**
 * Borrador con deshacer/rehacer. Al escribir en un mismo campo los cambios
 * seguidos se juntan en un solo paso (clave + menos de 0,8 s).
 *  cambiar(lista | (lista) => lista, clave?)
 */
export function useBorrador(inicial = []) {
  const [e, setE] = useState(() => {
    const lista = typeof inicial === 'function' ? inicial() : inicial;
    return { pasado: [], actual: lista, futuro: [], guardado: lista, clave: null, t: 0 };
  });
  const cambiar = useCallback((sig, clave = null) => setE((x) => {
    const actual = typeof sig === 'function' ? sig(x.actual) : sig;
    if (actual === x.actual) return x;
    const ahora = Date.now();
    const juntar = clave && clave === x.clave && ahora - x.t < 800;
    return { ...x, pasado: juntar ? x.pasado : [...x.pasado.slice(-49), x.actual], actual, futuro: [], clave, t: ahora };
  }), []);
  const deshacer = useCallback(() => setE((x) => (x.pasado.length
    ? { ...x, pasado: x.pasado.slice(0, -1), actual: x.pasado[x.pasado.length - 1], futuro: [x.actual, ...x.futuro], clave: null }
    : x)), []);
  const rehacer = useCallback(() => setE((x) => (x.futuro.length
    ? { ...x, pasado: [...x.pasado, x.actual], actual: x.futuro[0], futuro: x.futuro.slice(1), clave: null }
    : x)), []);
  const marcarGuardado = useCallback(() => setE((x) => ({ ...x, guardado: x.actual })), []);
  const reiniciar = useCallback((lista) => setE({ pasado: [], actual: lista, futuro: [], guardado: lista, clave: null, t: 0 }), []);
  return {
    secciones: e.actual, cambiar, deshacer, rehacer, marcarGuardado, reiniciar,
    puedeDeshacer: e.pasado.length > 0, puedeRehacer: e.futuro.length > 0, sinGuardar: e.actual !== e.guardado,
  };
}

/* ── Botón con confirmación en el mismo lugar (sin window.confirm) ── */
function BotonQuitar({ onQuitar, etiqueta = 'Eliminar', compacto }) {
  const [seguro, setSeguro] = useState(false);
  useEffect(() => {
    if (!seguro) return undefined;
    const t = window.setTimeout(() => setSeguro(false), 3000);
    return () => window.clearTimeout(t);
  }, [seguro]);
  return (
    <button
      type="button"
      className={[s.iconoBoton, s.peligro, seguro && s.confirmar].filter(Boolean).join(' ')}
      onClick={(e) => { e.stopPropagation(); if (seguro) onQuitar(); else setSeguro(true); }}
      aria-label={seguro ? `Confirmar: ${etiqueta}` : etiqueta}
    >
      <Trash2 aria-hidden="true" />
      {seguro && !compacto && <span>¿Seguro?</span>}
    </button>
  );
}

/* ── Fila de la lista (arrastrable desde el asa) ── */
function FilaSeccion({ seccion, indice, total, resaltada, onEditar, onResaltar, onMover, onDuplicar, onQuitar, onSoltar }) {
  const controles = useDragControls();
  const esquema = esquemaDe(seccion.type);
  const Icono = esquema.icono;
  const resumen = resumenDe(seccion);
  return (
    <Reorder.Item
      value={seccion.id}
      dragListener={false}
      dragControls={controles}
      onDragEnd={onSoltar}
      className={[s.filaSeccion, resaltada && s.filaResaltada].filter(Boolean).join(' ')}
      onPointerEnter={() => onResaltar?.(seccion.id)}
      onPointerLeave={() => onResaltar?.(null)}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 28px -12px rgba(76, 29, 149, 0.35)' }}
    >
      <span className={s.asa} onPointerDown={(e) => controles.start(e)} aria-hidden="true"><GripVertical /></span>
      <button type="button" className={s.filaPrincipal} onClick={() => onEditar(seccion.id)}>
        <span className={s.filaIcono}><Icono aria-hidden="true" /></span>
        <span className={s.filaTextos}>
          <strong>{esquema.nombre}</strong>
          {resumen && <small>{resumen}</small>}
        </span>
      </button>
      <span className={s.filaAcciones}>
        <button type="button" className={s.iconoBoton} onClick={() => onMover(seccion.id, -1)} disabled={indice === 0} aria-label="Subir"><ArrowUp aria-hidden="true" /></button>
        <button type="button" className={s.iconoBoton} onClick={() => onMover(seccion.id, 1)} disabled={indice === total - 1} aria-label="Bajar"><ArrowDown aria-hidden="true" /></button>
        <button type="button" className={s.iconoBoton} onClick={() => onDuplicar(seccion.id)} aria-label="Duplicar"><Copy aria-hidden="true" /></button>
        <BotonQuitar compacto onQuitar={() => onQuitar(seccion.id)} />
      </span>
    </Reorder.Item>
  );
}

/* ── Catálogo de módulos ── */
function CatalogoModulos({ onElegir, marcas = [] }) {
  const [filtro, setFiltro] = useState('');
  const [conMarca, setConMarca] = useState(null);
  const q = filtro.trim().toLowerCase();
  const tipos = Object.entries(ESQUEMAS).filter(([, e]) => !q || `${e.nombre} ${e.descripcion}`.toLowerCase().includes(q));
  return (
    <div className={s.catalogo}>
      <Buscador placeholder="Buscar módulo" atajo={null} onChange={(e) => setFiltro(e.target.value)} onBuscar={setFiltro} />
      {GRUPOS_MODULOS.map((g) => {
        const delGrupo = tipos.filter(([, e]) => e.grupo === g);
        if (!delGrupo.length) return null;
        return (
          <section key={g} className={s.catalogoGrupo}>
            <h4>{g}</h4>
            <div className={s.catalogoRejilla}>
              {delGrupo.map(([tipo, e]) => {
                const Icono = e.icono;
                const abierto = conMarca === tipo;
                return (
                  <div key={tipo} className={[s.modulo, abierto && s.moduloAbierto].filter(Boolean).join(' ')}>
                    <button type="button" className={s.moduloBoton} onClick={() => (e.porMarca && marcas.length ? setConMarca(abierto ? null : tipo) : onElegir(tipo))} aria-expanded={e.porMarca && marcas.length ? abierto : undefined}>
                      <span className={s.moduloIcono}><Icono aria-hidden="true" /></span>
                      <strong>{e.nombre}</strong>
                      <small>{e.descripcion}</small>
                    </button>
                    {abierto && (
                      <div className={s.moduloMarcas}>
                        <button type="button" onClick={() => onElegir(tipo)}>Todas las marcas</button>
                        {marcas.map((m) => (
                          <button key={m.id} type="button" onClick={() => onElegir(tipo, { brandId: m.id, ...(tipo === 'sidebar_catalog' ? { title: `Productos ${m.name}` } : {}) })}>{m.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {!tipos.length && <p className={s.nota}>Ningún módulo se llama así.</p>}
    </div>
  );
}

const transicionVista = { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 }, transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] } };

/**
 * Panel del editor del builder. No guarda nada: la página le pasa las
 * secciones (borrador) y recibe los cambios.
 *
 *  - secciones, onCambiar(lista, clave?)   borrador (useBorrador lo resuelve)
 *  - seleccionada / onSeleccionar(id|null) sección abierta en el formulario
 *  - resaltada / onResaltar(id|null)       se marca en la página al pasar por la lista
 *  - insertarEn / onInsertarEn(i|null)     abre el catálogo para insertar en esa posición
 *  - crearAjustes(tipo)                    la tienda pasa getDefaultSettings
 *  - fuentes { colecciones, categorias, marcas, subirArchivo }, extensiones
 *  - onGuardar, guardando, sinGuardar, onDeshacer/onRehacer + puede…
 *  - vista 'escritorio'|'movil' + onVista, lado 'derecha'|'izquierda' + onLado, onCerrar
 *  - cabecera: nodo sobre la lista (p. ej. accesos al header global)
 *  - ajustesPagina: nodo de la pestaña "Página" (tema, ocultar header…)
 *  - incrustado: se dibuja dentro de su contenedor (demo) en vez de fijo a la ventana
 */
export default function PanelEditor({
  secciones = [], onCambiar, seleccionada, onSeleccionar, resaltada, onResaltar, insertarEn = null, onInsertarEn,
  crearAjustes = ajustesIniciales, fuentes = {}, extensiones = {},
  onGuardar, guardando = false, sinGuardar = false, onDeshacer, onRehacer, puedeDeshacer, puedeRehacer,
  titulo = 'Página', vista, onVista, lado = 'derecha', onLado, onCerrar, cabecera, ajustesPagina, incrustado = false,
}) {
  const lista = useMemo(() => ordenadas(secciones), [secciones]);
  const [ids, setIds] = useState(() => lista.map((x) => x.id));
  const [pestana, setPestana] = useState('secciones');
  const [grande, setGrande] = useState(false);
  const cuerpo = useRef(null);
  useEffect(() => { setIds(lista.map((x) => x.id)); }, [lista]);

  const abierta = lista.find((x) => x.id === seleccionada);
  const vistaActual = insertarEn != null ? 'catalogo' : abierta ? 'formulario' : 'lista';
  useEffect(() => { cuerpo.current?.scrollTo({ top: 0 }); }, [vistaActual, seleccionada]);

  const cambiar = (l, clave) => onCambiar?.(l, clave);
  const elegirModulo = (tipo, extra) => {
    const nueva = { id: nuevoIdSeccion(), type: tipo, order: 0, settings: { ...crearAjustes(tipo), ...extra } };
    cambiar(insertarSeccion(lista, nueva, insertarEn ?? lista.length));
    onInsertarEn?.(null);
    onSeleccionar?.(nueva.id);
  };

  // Atajos: Ctrl+Z / Ctrl+Shift+Z (fuera de los campos de texto) y Ctrl+S.
  useEffect(() => {
    const tecla = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); if (sinGuardar && !guardando) onGuardar?.(); return; }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (k === 'z' && !e.shiftKey && puedeDeshacer) { e.preventDefault(); onDeshacer?.(); }
      if ((k === 'y' || (k === 'z' && e.shiftKey)) && puedeRehacer) { e.preventDefault(); onRehacer?.(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [sinGuardar, guardando, onGuardar, puedeDeshacer, puedeRehacer, onDeshacer, onRehacer]);

  const esquemaAbierta = abierta && esquemaDe(abierta.type);
  const IconoAbierta = esquemaAbierta?.icono;

  return (
    <ProveedorEditor fuentes={fuentes} extensiones={extensiones}>
      <aside
        className={[s.panel, incrustado ? s.incrustado : s[lado], grande && s.grande].filter(Boolean).join(' ')}
        aria-label="Editor de la página"
      >
        <header className={s.panelCabeza}>
          <span className={s.agarre} aria-hidden="true" />
          <IsoWala tamano={26} className={s.panelIso} />
          <div className={s.panelTitulo}>
            <strong>Editor</strong>
            <span>{titulo}</span>
          </div>
          <div className={s.panelHerramientas}>
            {onDeshacer && <button type="button" className={s.iconoBoton} onClick={onDeshacer} disabled={!puedeDeshacer} aria-label="Deshacer" title="Deshacer (Ctrl+Z)"><Undo2 aria-hidden="true" /></button>}
            {onRehacer && <button type="button" className={s.iconoBoton} onClick={onRehacer} disabled={!puedeRehacer} aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)"><Redo2 aria-hidden="true" /></button>}
            {onVista && (
              <button type="button" className={`${s.iconoBoton} ${s.soloEscritorio}`} onClick={() => onVista(vista === 'movil' ? 'escritorio' : 'movil')} aria-label={vista === 'movil' ? 'Ver en escritorio' : 'Ver en celular'} title={vista === 'movil' ? 'Ver en escritorio' : 'Ver en celular'}>
                {vista === 'movil' ? <Monitor aria-hidden="true" /> : <Smartphone aria-hidden="true" />}
              </button>
            )}
            {onLado && !incrustado && (
              <button type="button" className={`${s.iconoBoton} ${s.soloEscritorio}`} onClick={() => onLado(lado === 'derecha' ? 'izquierda' : 'derecha')} aria-label="Cambiar de lado">
                {lado === 'derecha' ? <PanelLeft aria-hidden="true" /> : <PanelRight aria-hidden="true" />}
              </button>
            )}
            {/* Agrandar la hoja: solo en el celular (también en la demo). */}
            <button type="button" className={`${s.iconoBoton} ${s.soloMovil}`} onClick={() => setGrande((v) => !v)} aria-label={grande ? 'Achicar el panel' : 'Agrandar el panel'}>
              {grande ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            </button>
            {onCerrar && <button type="button" className={s.iconoBoton} onClick={onCerrar} aria-label="Cerrar el editor"><X aria-hidden="true" /></button>}
          </div>
        </header>

        <div className={s.panelCuerpo} ref={cuerpo}>
          <AnimatePresence mode="wait" initial={false}>
            {vistaActual === 'catalogo' && (
              <motion.div key="catalogo" {...transicionVista}>
                <div className={s.vistaCabeza}>
                  <button type="button" className={s.volver} onClick={() => onInsertarEn?.(null)}><ArrowLeft aria-hidden="true" /> Volver</button>
                  <h3>Añadir sección{insertarEn != null && insertarEn < lista.length ? ` en el lugar ${insertarEn + 1}` : ''}</h3>
                </div>
                <CatalogoModulos onElegir={elegirModulo} marcas={fuentes.marcas || []} />
              </motion.div>
            )}

            {vistaActual === 'formulario' && (
              <motion.div key={`f-${abierta.id}`} {...transicionVista}>
                <div className={s.vistaCabeza}>
                  <button type="button" className={s.volver} onClick={() => onSeleccionar?.(null)}><ArrowLeft aria-hidden="true" /> Secciones</button>
                  <div className={s.formularioTitulo}>
                    <span className={s.filaIcono}><IconoAbierta aria-hidden="true" /></span>
                    <div>
                      <h3>{esquemaAbierta.nombre}</h3>
                      <p>{esquemaAbierta.descripcion}</p>
                    </div>
                  </div>
                  <div className={s.formularioAcciones}>
                    <button type="button" className={s.iconoBoton} onClick={() => cambiar(moverSeccion(lista, abierta.id, -1))} disabled={lista[0]?.id === abierta.id} aria-label="Subir sección"><ArrowUp aria-hidden="true" /></button>
                    <button type="button" className={s.iconoBoton} onClick={() => cambiar(moverSeccion(lista, abierta.id, 1))} disabled={lista[lista.length - 1]?.id === abierta.id} aria-label="Bajar sección"><ArrowDown aria-hidden="true" /></button>
                    <button type="button" className={s.iconoBoton} onClick={() => cambiar(duplicarSeccion(lista, abierta.id))} aria-label="Duplicar sección"><Copy aria-hidden="true" /></button>
                    <BotonQuitar etiqueta="Eliminar sección" onQuitar={() => { cambiar(quitarSeccion(lista, abierta.id)); onSeleccionar?.(null); }} />
                  </div>
                </div>
                <FormularioSeccion
                  seccion={abierta}
                  onCambiar={(parche) => cambiar(actualizarAjustes(lista, abierta.id, parche), `${abierta.id}:${Object.keys(parche).join(',')}`)}
                />
              </motion.div>
            )}

            {vistaActual === 'lista' && (
              <motion.div key="lista" {...transicionVista}>
                {ajustesPagina && (
                  <div className={s.pestanasPanel}>
                    <Pestanas opciones={[{ id: 'secciones', texto: 'Secciones', cuenta: lista.length }, { id: 'pagina', texto: 'Página' }]} valor={pestana} onChange={setPestana} etiqueta="Panel" />
                  </div>
                )}
                {pestana === 'pagina' && ajustesPagina ? (
                  <div className={s.campos}>{ajustesPagina}</div>
                ) : (
                  <>
                    {cabecera}
                    {lista.length === 0 && (
                      <div className={s.vacio}>
                        <img src="/assets/kapi/kapi-hungry.webp" alt="" width="88" height="88" />
                        <strong>Esta página tiene hambre</strong>
                        <span>Dale de comer un banner o un título y ve sumando secciones.</span>
                      </div>
                    )}
                    <Reorder.Group
                      axis="y"
                      values={ids}
                      onReorder={setIds}
                      className={s.listaSecciones}
                      as="div"
                    >
                      {ids.map((id, i) => {
                        const sec = lista.find((x) => x.id === id);
                        if (!sec) return null;
                        return (
                          <FilaSeccion
                            key={id}
                            seccion={sec}
                            indice={i}
                            total={ids.length}
                            resaltada={resaltada === id}
                            onEditar={(x) => onSeleccionar?.(x)}
                            onResaltar={onResaltar}
                            onMover={(x, d) => cambiar(moverSeccion(lista, x, d))}
                            onDuplicar={(x) => cambiar(duplicarSeccion(lista, x))}
                            onQuitar={(x) => cambiar(quitarSeccion(lista, x))}
                            onSoltar={() => {
                              const nueva = renumerar(ids.map((x) => lista.find((y) => y.id === x)).filter(Boolean));
                              if (nueva.some((x, k) => x.id !== lista[k]?.id)) cambiar(nueva);
                            }}
                          />
                        );
                      })}
                    </Reorder.Group>
                    <button type="button" className={s.anadirSeccion} onClick={() => onInsertarEn?.(lista.length)}>
                      <Plus aria-hidden="true" /> Añadir sección
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {onGuardar && (
          <footer className={s.panelPie}>
            <span className={[s.estado, sinGuardar && s.estadoPendiente].filter(Boolean).join(' ')} role="status">
              <span className={s.punto} aria-hidden="true" />
              {guardando ? 'Guardando…' : sinGuardar ? 'Cambios sin publicar' : 'Todo publicado'}
            </span>
            <Boton onClick={onGuardar} cargando={guardando} disabled={!sinGuardar}>Publicar</Boton>
          </footer>
        )}
      </aside>
    </ProveedorEditor>
  );
}
