import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import {
  ArrowLeft, ArrowDown, ArrowUp, Copy, GripVertical, Monitor, PanelLeft, PanelRight, Plus, Redo2, Smartphone, Trash2, Undo2, X,
  Maximize2, Minimize2, ChevronRight, LayoutTemplate,
} from 'lucide-react';
import Boton from '../Boton';
import { Buscador } from '../Formulario';
import { Pestanas } from '../Navegacion';
import { IsoWala } from '../Marca';
import { ESQUEMAS, ESQUEMAS_GLOBALES, GRUPOS_MODULOS, ajustesIniciales, esquemaDe, resumenDe } from './esquemas';
import { FormularioSeccion, ProveedorEditor } from './CamposEditor';
import { CARAS_KAPI } from '../piezas/Flotantes';
import s from './Editor.module.css';

/* Las operaciones sobre la lista viven en operaciones.js (la página las usa
   desde la barra de cada sección sin cargar el panel); se siguen exportando
   desde aquí. */
import { renumerar, ordenadas, nuevoIdSeccion, actualizarAjustes, insertarSeccion, moverSeccion, duplicarSeccion, quitarSeccion } from './operaciones';
export { nuevoIdSeccion, actualizarAjustes, insertarSeccion, moverSeccion, duplicarSeccion, quitarSeccion };

/* El borrador con deshacer/rehacer vive en su propio archivo (la tienda lo usa
   en su contexto sin cargar el panel); se sigue exportando desde aquí. */
export { useBorrador } from './useBorrador';

/* ── Eliminar: un clic, sin preguntar. Nada se pierde hasta "Publicar" y el
   aviso de abajo trae "Deshacer" (antes el primer clic solo lo armaba y en la
   lista no avisaba: parecía que había que darle doble clic). ── */
function BotonQuitar({ onQuitar, etiqueta = 'Eliminar' }) {
  return (
    <button
      type="button"
      className={[s.iconoBoton, s.peligro].join(' ')}
      onClick={(e) => { e.stopPropagation(); onQuitar(); }}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Trash2 aria-hidden="true" />
    </button>
  );
}

/* ── Fila de la lista (arrastrable desde el asa) ── */
/* El esquema de un tipo con el nombre que le da la página si el kit no lo conoce. */
const esquemaConNombre = (tipo, nombres) => {
  const e = esquemaDe(tipo);
  return e.desconocido && nombres?.[tipo] ? { ...e, nombre: nombres[tipo], descripcion: 'Su formulario de siempre.' } : e;
};

function FilaSeccion({ seccion, indice, total, resaltada, onEditar, onResaltar, onMover, onDuplicar, onQuitar, onSoltar, nombres }) {
  const controles = useDragControls();
  const esquema = esquemaConNombre(seccion.type, nombres);
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
        <BotonQuitar etiqueta="Eliminar sección" onQuitar={() => onQuitar(seccion.id)} />
      </span>
    </Reorder.Item>
  );
}

/* ── Catálogo de módulos ── */
/* Los ajustes con los que entra un módulo "por marca". */
const conMarcaDe = (tipo, m) => ({ brandId: m.id, ...(tipo === 'sidebar_catalog' ? { title: `Productos ${m.name}` } : {}) });

/* En la página de una marca (marcaFija) los módulos "por marca" entran ya con
   ella, sin preguntar: ahí no tiene sentido elegir otra. */
function CatalogoModulos({ onElegir, marcas = [], marcaFija, permitidos }) {
  const [filtro, setFiltro] = useState('');
  const [conMarca, setConMarca] = useState(null);
  const q = filtro.trim().toLowerCase();
  const tipos = Object.entries(ESQUEMAS)
    .filter(([tipo]) => !permitidos || permitidos.includes(tipo))
    .filter(([, e]) => !q || `${e.nombre} ${e.descripcion}`.toLowerCase().includes(q));
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
                    <button type="button" className={s.moduloBoton} onClick={() => (e.porMarca && marcaFija ? onElegir(tipo, conMarcaDe(tipo, marcaFija)) : e.porMarca && marcas.length ? setConMarca(abierto ? null : tipo) : onElegir(tipo))} aria-expanded={e.porMarca && !marcaFija && marcas.length ? abierto : undefined}>
                      <span className={s.moduloIcono}><Icono aria-hidden="true" /></span>
                      <strong>{e.nombre}</strong>
                      <small>{e.descripcion}</small>
                    </button>
                    {abierto && (
                      <div className={s.moduloMarcas}>
                        <button type="button" onClick={() => onElegir(tipo)}>Todas las marcas</button>
                        {marcas.map((m) => (
                          <button key={m.id} type="button" onClick={() => onElegir(tipo, conMarcaDe(tipo, m))}>{m.name}</button>
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
 *  - cabecera: nodo sobre la lista (p. ej. un aviso)
 *  - globales: lo que se edita para toda la tienda (grupo "Toda la tienda"
 *    sobre las secciones): [{ id, esquema (clave de ESQUEMAS_GLOBALES),
 *    ajustes, onCambiar(parche) }] o [{ id, nombre, descripcion, icono,
 *    onAbrir }] para lo que se abre aparte (el pie). Se abren con
 *    onSeleccionar(id), como una sección.
 *  - base: secciones para empezar una página vacía ([{ type, settings }])
 *  - tipos: los únicos módulos del catálogo (p. ej. el pie: columnas, texto e imagen)
 *  - nombres: { tipo: nombre } para los tipos sin esquema (los que la página
 *    edita con extensiones.formularios)
 *  - tituloSecciones: el título de las secciones bajo "Toda la tienda" ('Esta página')
 *  - ajustesPagina: nodo de la pestaña "Página" (tema, ocultar header…)
 *  - incrustado: se dibuja dentro de su contenedor (demo) en vez de fijo a la ventana
 * Fijo a la ventana, empieza en --editor-arriba (la tienda: bajo su barra de admin).
 */
export default function PanelEditor({
  secciones = [], onCambiar, seleccionada, onSeleccionar, resaltada, onResaltar, insertarEn = null, onInsertarEn,
  crearAjustes = ajustesIniciales, fuentes = {}, extensiones = {}, globales = [], base, tipos, nombres,
  onGuardar, guardando = false, sinGuardar = false, onDeshacer, onRehacer, puedeDeshacer, puedeRehacer,
  titulo = 'Página', tituloSecciones = 'Esta página', vista, onVista, lado = 'derecha', onLado, onCerrar, cabecera, ajustesPagina, incrustado = false,
}) {
  const lista = useMemo(() => ordenadas(secciones), [secciones]);
  const [ids, setIds] = useState(() => lista.map((x) => x.id));
  const [pestana, setPestana] = useState('secciones');
  const [grande, setGrande] = useState(false);
  const cuerpo = useRef(null);
  // "Eliminaste X · Deshacer": unos segundos tras quitar una sección.
  const [quitada, setQuitada] = useState(null);
  useEffect(() => {
    if (!quitada) return undefined;
    const t = window.setTimeout(() => setQuitada(null), 6000);
    return () => window.clearTimeout(t);
  }, [quitada]);
  const quitar = (id) => {
    const sec = lista.find((x) => x.id === id);
    cambiar(quitarSeccion(lista, id));
    if (seleccionada === id) onSeleccionar?.(null);
    setQuitada({ id, nombre: sec ? esquemaConNombre(sec.type, nombres).nombre : 'la sección', t: Date.now() });
  };
  useEffect(() => { setIds(lista.map((x) => x.id)); }, [lista]);

  const abierta = lista.find((x) => x.id === seleccionada);
  const globalAbierto = !abierta ? globales.find((g) => g.id === seleccionada && g.esquema) : null;
  const vistaActual = insertarEn != null ? 'catalogo' : abierta ? 'formulario' : globalAbierto ? 'global' : 'lista';
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

  const esquemaAbierta = abierta && esquemaConNombre(abierta.type, nombres);
  const IconoAbierta = esquemaAbierta?.icono;
  const esquemaGlobal = globalAbierto && ESQUEMAS_GLOBALES[globalAbierto.esquema];
  const IconoGlobal = esquemaGlobal?.icono;
  const empezarConBase = () => {
    const nuevas = (base || []).map((x, order) => ({ id: nuevoIdSeccion(), order, type: x.type, settings: { ...crearAjustes(x.type), ...(x.settings || {}) } }));
    if (nuevas.length) cambiar(nuevas);
  };

  return (
    <ProveedorEditor fuentes={fuentes} extensiones={extensiones} crearAjustes={crearAjustes}>
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
                <CatalogoModulos onElegir={elegirModulo} marcas={fuentes.marcas || []} marcaFija={fuentes.marcaFija} permitidos={tipos} />
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
                    <BotonQuitar etiqueta="Eliminar sección" onQuitar={() => quitar(abierta.id)} />
                  </div>
                </div>
                <FormularioSeccion
                  seccion={abierta}
                  onCambiar={(parche) => cambiar(actualizarAjustes(lista, abierta.id, parche), `${abierta.id}:${Object.keys(parche).join(',')}`)}
                />
              </motion.div>
            )}

            {vistaActual === 'global' && esquemaGlobal && (
              <motion.div key={`g-${globalAbierto.id}`} {...transicionVista}>
                <div className={s.vistaCabeza}>
                  <button type="button" className={s.volver} onClick={() => onSeleccionar?.(null)}><ArrowLeft aria-hidden="true" /> Secciones</button>
                  <div className={s.formularioTitulo}>
                    <span className={s.filaIcono}><IconoGlobal aria-hidden="true" /></span>
                    <div>
                      <h3>{esquemaGlobal.nombre}</h3>
                      <p>{esquemaGlobal.descripcion}</p>
                    </div>
                  </div>
                </div>
                {/* Lo de toda la tienda (el menú…) ve todas las colecciones,
                    categorías y marcas, aunque se edite desde la página de una marca. */}
                <ProveedorEditor fuentes={{ ...fuentes, ...(fuentes.todas || {}), marcaFija: null }} extensiones={extensiones} crearAjustes={crearAjustes}>
                  <FormularioSeccion
                    seccion={{ id: globalAbierto.id, type: globalAbierto.id, settings: globalAbierto.ajustes || {} }}
                    esquema={esquemaGlobal}
                    onCambiar={(parche) => globalAbierto.onCambiar?.(parche)}
                  />
                </ProveedorEditor>
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
                    {globales.length > 0 && (
                      <div className={s.globales}>
                        <h4 className={s.globalesTitulo}>Toda la tienda</h4>
                        {globales.map((g) => {
                          const e = g.esquema ? ESQUEMAS_GLOBALES[g.esquema] : null;
                          const Icono = g.icono || e?.icono || LayoutTemplate;
                          return (
                            <div key={g.id} className={`${s.filaSeccion} ${s.filaGlobal}`}>
                              <button type="button" className={s.filaPrincipal} onClick={() => (g.onAbrir ? g.onAbrir() : onSeleccionar?.(g.id))}>
                                <span className={s.filaIcono}><Icono aria-hidden="true" /></span>
                                <span className={s.filaTextos}>
                                  <strong>{g.nombre || e?.nombre}</strong>
                                  <small>{g.descripcion || e?.descripcion}</small>
                                </span>
                                <ChevronRight className={s.filaFlecha} aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}
                        <h4 className={s.globalesTitulo}>{tituloSecciones}</h4>
                      </div>
                    )}
                    {lista.length === 0 && (
                      <div className={s.vacio}>
                        <img src={CARAS_KAPI.hambre} alt="" width="88" height="88" />
                        <strong>Esta página tiene hambre</strong>
                        <span>Dale de comer un banner o un título y ve sumando secciones.</span>
                        {base?.length > 0 && (
                          <Boton variante="contorno" tamano="sm" onClick={empezarConBase} icono={<LayoutTemplate aria-hidden="true" />}>Empezar con una base</Boton>
                        )}
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
                            nombres={nombres}
                            seccion={sec}
                            indice={i}
                            total={ids.length}
                            resaltada={resaltada === id}
                            onEditar={(x) => onSeleccionar?.(x)}
                            onResaltar={onResaltar}
                            onMover={(x, d) => cambiar(moverSeccion(lista, x, d))}
                            onDuplicar={(x) => cambiar(duplicarSeccion(lista, x))}
                            onQuitar={quitar}
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

        {quitada && (
          <div key={quitada.t} className={s.avisoQuitada} role="status">
            <span>Eliminaste «{quitada.nombre}».</span>
            {onDeshacer && (
              <button type="button" onClick={() => { onDeshacer(); setQuitada(null); }}>
                <Undo2 aria-hidden="true" /> Deshacer
              </button>
            )}
          </div>
        )}

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
