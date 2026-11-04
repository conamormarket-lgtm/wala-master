import React, { useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Check, GripVertical, Loader2, MoreHorizontal, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, EstadoVacio, HojaInferior } from '../../Feedback';
import { Buscador, Campo } from '../../Formulario';
import { Chip, Etiqueta } from '../../Etiquetas';
import { EsqueletoFila } from '../../Esqueletos';
import { Visto } from '../../Marca';
import { MenuContextual } from '../MenuContextual';
import { FotoProducto } from '../FotoProducto';
import { useEsconderPrincipal } from './Marco';
import { normalizarBusqueda } from '../../adaptadoresAdmin';
import s from './Datos.module.css';

/*
 * Piezas de datos del admin (guía: guia/ADMIN.md, D0): la tabla (que en el
 * celular son tarjetas), el estado de un registro, los filtros y la barra de
 * lo elegido. Datos y acciones por props; nada lee Firestore.
 */

/* ── Estado ───────────────────────────────────────────── */

/** Los estados de siempre, con su texto y su tono (de Etiqueta). Una página puede pasar los suyos. */
export const ESTADOS_ADMIN = {
  activo: { texto: 'Activo', tono: 'exito' },
  publicado: { texto: 'Publicado', tono: 'exito' },
  pagado: { texto: 'Pagado', tono: 'exito' },
  atendido: { texto: 'Atendido', tono: 'exito' },
  borrador: { texto: 'Borrador', tono: 'neutro' },
  oculto: { texto: 'Oculto', tono: 'neutro' },
  cerrado: { texto: 'Cerrado', tono: 'neutro' },
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  revisar: { texto: 'Por revisar', tono: 'aviso' },
  programado: { texto: 'Programado', tono: 'violeta' },
  anulado: { texto: 'Anulado', tono: 'peligro' },
  error: { texto: 'Con error', tono: 'peligro' },
};

/**
 * El estado de un registro: siempre con texto y su punto de color (nunca
 * solo el color).
 *  - estado: la clave ('activo') · estados: el mapa ({ clave: { texto, tono } })
 *  - children: otro texto para el mismo tono ("Agotado")
 */
export function InsigniaEstado({ estado, estados = ESTADOS_ADMIN, children }) {
  const def = estados[estado] || { texto: estado, tono: 'neutro' };
  return <Etiqueta tono={def.tono} punto>{children || def.texto}</Etiqueta>;
}

/* ── Tabla ────────────────────────────────────────────── */

/* La casilla de una fila (o de todas): el Visto de Walá, sin texto visible. */
function CasillaFila({ activo, mixto = false, onChange, etiqueta }) {
  return (
    <label className={s.casilla} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={activo} aria-checked={mixto ? 'mixed' : activo} aria-label={etiqueta} onChange={(e) => onChange(e.target.checked)} />
      <Visto activo={activo || mixto} forma="cuadro" tamano={22} className={mixto ? s.mixto : undefined} />
    </label>
  );
}

const esControl = (el) => Boolean(el.closest('button, a, input, label, [role="menuitem"]'));

/**
 * La lista de un recurso (categorías, productos, sorteos…). Cuando su caja
 * mide 720 px o más es una tabla; más angosta, una lista de tarjetas con la
 * foto, el título, dos o tres datos y el estado (container query: la misma
 * pieza sirve al costado de otra o en el celular).
 *  - columnas: [{ id, titulo, celda(fila) → nodo, ancho, alinear: 'fin' | 'centro',
 *    ordenable, tarjeta: 'foto' | 'titulo' | 'detalle' | 'estado' | 'control' }] (sin
 *    `tarjeta` no sale en la tarjeta; 'control': algo que se toca, como el
 *    stock o unas opciones, va debajo de la tarjeta, a todo el ancho)
 *  - filas · idDe(fila) (fila.id) · nombreDe(fila): para los textos de ayuda
 *  - cargando · error (texto) + onReintentar · vacio: { titulo, texto, icono, accion }
 *  - onFila(fila): tocar la fila o la tarjeta (casi siempre, editar)
 *  - acciones(fila) → items de MenuContextual ([{ id, etiqueta, Icono, peligro, accion }])
 *    en "⋯" (y con el clic derecho en la tabla)
 *  - seleccion: [ids] + onSeleccion(ids): las casillas (sin onSeleccion, no hay)
 *  - orden: { por, dir: 'asc' | 'desc' } + onOrden(orden)
 *  - etiqueta: el nombre de la lista (para los lectores de pantalla)
 */
export function TablaAdmin({
  columnas = [], filas = [], idDe = (f) => f.id, nombreDe = (f) => String(idDe(f)),
  cargando = false, error, onReintentar, vacio, onFila, acciones, seleccion = [], onSeleccion, orden, onOrden, etiqueta = 'Lista',
}) {
  const [menu, setMenu] = useState(null);
  const elegibles = Boolean(onSeleccion);
  const elegidos = new Set(seleccion);
  const todos = filas.length > 0 && filas.every((f) => elegidos.has(idDe(f)));
  const algunos = !todos && filas.some((f) => elegidos.has(idDe(f)));
  const alternar = (id, si) => onSeleccion?.(si ? [...new Set([...seleccion, id])] : seleccion.filter((x) => x !== id));
  const alternarTodos = (si) => onSeleccion?.(si ? [...new Set([...seleccion, ...filas.map(idDe)])] : seleccion.filter((x) => !filas.some((f) => idDe(f) === x)));

  const abrirMenu = (fila, e, enPunto = false) => {
    if (!acciones) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ fila, x: enPunto ? e.clientX : r.right - 8, y: enPunto ? e.clientY : r.bottom + 4 });
  };

  const porTarjeta = (tipo) => columnas.filter((c) => c.tarjeta === tipo);

  if (cargando) {
    return (
      <div className={s.tabla} aria-busy="true" aria-label={`${etiqueta}: cargando`}>
        <div className={s.esqueleto}>{[0, 1, 2, 3, 4].map((i) => <EsqueletoFila key={i} />)}</div>
      </div>
    );
  }
  if (error) {
    return (
      <Aviso tipo="error" titulo="No pudimos cargar la lista" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>
        {error}
      </Aviso>
    );
  }
  if (!filas.length) {
    return (
      <div className={s.vacio}>
        <EstadoVacio imagen={vacio?.icono ? null : undefined} icono={vacio?.icono} titulo={vacio?.titulo || 'Todavía no hay nada aquí'} texto={vacio?.texto}>
          {vacio?.accion}
        </EstadoVacio>
      </div>
    );
  }

  return (
    <div className={s.tabla} data-componente="TablaAdmin">
      {/* Ancha: la tabla */}
      <table className={s.ancha} aria-label={etiqueta}>
        <thead>
          <tr>
            {elegibles && (
              <th className={s.colCasilla} scope="col">
                <CasillaFila activo={todos} mixto={algunos} onChange={alternarTodos} etiqueta="Elegir todas" />
              </th>
            )}
            {columnas.map((c) => {
              const actual = orden?.por === c.id;
              const sort = actual ? (orden.dir === 'desc' ? 'descending' : 'ascending') : undefined;
              const Flecha = !actual ? ArrowUpDown : orden.dir === 'desc' ? ArrowDown : ArrowUp;
              return (
                <th key={c.id} scope="col" aria-sort={sort} style={{ width: c.ancho }} className={c.alinear ? s[`alinear_${c.alinear}`] : undefined}>
                  {c.ordenable && onOrden ? (
                    <button
                      type="button"
                      className={[s.ordenar, actual && s.ordenarActual].filter(Boolean).join(' ')}
                      onClick={() => onOrden({ por: c.id, dir: actual && orden.dir === 'asc' ? 'desc' : 'asc' })}
                    >
                      {c.titulo}
                      <Flecha aria-hidden="true" />
                    </button>
                  ) : c.titulo}
                </th>
              );
            })}
            {acciones && <th className={s.colAcciones} scope="col"><span className={s.oculto}>Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const id = idDe(f);
            const elegida = elegidos.has(id);
            return (
              <tr
                key={id}
                className={[onFila && s.filaTocable, elegida && s.filaElegida].filter(Boolean).join(' ')}
                onClick={onFila ? (e) => { if (!esControl(e.target)) onFila(f); } : undefined}
                onContextMenu={acciones ? (e) => abrirMenu(f, e, true) : undefined}
              >
                {elegibles && (
                  <td className={s.colCasilla}>
                    <CasillaFila activo={elegida} onChange={(si) => alternar(id, si)} etiqueta={`Elegir ${nombreDe(f)}`} />
                  </td>
                )}
                {columnas.map((c) => (
                  <td key={c.id} className={c.alinear ? s[`alinear_${c.alinear}`] : undefined}>
                    {c.tarjeta === 'titulo' && onFila ? (
                      <button type="button" className={s.tituloBoton} onClick={() => onFila(f)}>{c.celda(f)}</button>
                    ) : c.celda(f)}
                  </td>
                ))}
                {acciones && (
                  <td className={s.colAcciones}>
                    <button type="button" className={s.masBoton} onClick={(e) => abrirMenu(f, e)} aria-label={`Opciones de ${nombreDe(f)}`} aria-haspopup="menu">
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Angosta: tarjetas */}
      <ul className={s.tarjetas} aria-label={etiqueta}>
        {filas.map((f) => {
          const id = idDe(f);
          const elegida = elegidos.has(id);
          const foto = porTarjeta('foto')[0];
          const titulo = porTarjeta('titulo')[0];
          const estado = porTarjeta('estado')[0];
          const controles = porTarjeta('control');
          // Sin onFila no es un botón: dentro puede haber algo que se toca.
          const Cuerpo = onFila ? 'button' : 'div';
          return (
            <li key={id} className={[s.tarjeta, elegida && s.filaElegida, controles.length && s.tarjetaConControles].filter(Boolean).join(' ')}>
              {elegibles && <CasillaFila activo={elegida} onChange={(si) => alternar(id, si)} etiqueta={`Elegir ${nombreDe(f)}`} />}
              <Cuerpo {...(onFila ? { type: 'button', onClick: () => onFila(f), 'aria-label': `Editar ${nombreDe(f)}` } : {})} className={[s.tarjetaCuerpo, !onFila && s.tarjetaQuieta].filter(Boolean).join(' ')}>
                {foto && <span className={s.tarjetaFoto}>{foto.celda(f)}</span>}
                <span className={s.tarjetaTextos}>
                  {titulo && <strong className={s.tarjetaTitulo}>{titulo.celda(f)}</strong>}
                  <span className={s.tarjetaDetalles}>
                    {porTarjeta('detalle').map((c) => <span key={c.id} className={s.tarjetaDetalle}>{c.celda(f)}</span>)}
                  </span>
                </span>
                {estado && <span className={s.tarjetaEstado}>{estado.celda(f)}</span>}
              </Cuerpo>
              {acciones && (
                <button type="button" className={s.masBoton} onClick={(e) => abrirMenu(f, e)} aria-label={`Opciones de ${nombreDe(f)}`} aria-haspopup="menu">
                  <MoreHorizontal aria-hidden="true" />
                </button>
              )}
              {controles.length > 0 && (
                <div className={s.tarjetaControles}>
                  {controles.map((c) => (
                    <div key={c.id} className={s.tarjetaControl}>
                      <span className={s.tarjetaControlNombre}>{c.titulo}</span>
                      {c.celda(f)}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <MenuContextual
        abierto={Boolean(menu)}
        x={menu?.x}
        y={menu?.y}
        titulo={menu ? nombreDe(menu.fila) : 'Opciones'}
        items={menu ? acciones(menu.fila) : []}
        onCerrar={() => setMenu(null)}
      />
    </div>
  );
}

/* ── Filtros ──────────────────────────────────────────── */

/**
 * Buscar y filtrar una lista. En una caja ancha, todo en una fila; angosta,
 * el buscador y "Filtros" (abre una hoja), con los filtros puestos como chips
 * que se quitan.
 *  - busqueda · onBusqueda(texto) · placeholder
 *  - filtros: [{ id, etiqueta, opciones: [{ valor, texto }], valor, todos }]
 *    (`todos`: el texto de la opción sin filtro, de valor '')
 *  - onFiltro(id, valor) · total (cuántos quedan) · unidad: ['categoría', 'categorías']
 *  - children: otro control a la derecha (orden, vista)
 */
export function BarraFiltros({ busqueda = '', onBusqueda, placeholder = 'Buscar…', filtros = [], onFiltro, total, unidad = ['resultado', 'resultados'], children }) {
  const [hoja, setHoja] = useState(false);
  const puestos = filtros.filter((f) => f.valor);
  const textoDe = (f) => f.opciones.find((o) => o.valor === f.valor)?.texto || f.valor;
  const cuantos = typeof total === 'number' ? `${total} ${total === 1 ? unidad[0] : unidad[1]}` : null;
  const opcionesDe = (f) => [{ valor: '', texto: f.todos || 'Todos' }, ...f.opciones];
  const quitarTodos = () => puestos.forEach((f) => onFiltro?.(f.id, ''));

  return (
    <div className={s.filtros} data-componente="BarraFiltros">
      <div className={s.filtrosFila}>
        {onBusqueda && (
          <Buscador
            className={s.filtrosBuscar}
            placeholder={placeholder}
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            onBuscar={onBusqueda}
          />
        )}
        <div className={s.filtrosAncho}>
          {filtros.map((f) => (
            <div key={f.id} className={s.filtroCampo}>
              <Campo
                etiqueta={f.etiqueta}
                opciones={opcionesDe(f)}
                value={f.valor || ''}
                onChange={(e) => onFiltro?.(f.id, e.target.value)}
              />
            </div>
          ))}
        </div>
        {filtros.length > 0 && (
          <Boton
            className={s.filtrosBoton}
            variante="contorno"
            icono={<SlidersHorizontal aria-hidden="true" />}
            onClick={() => setHoja(true)}
            insignia={puestos.length ? <span className={s.filtrosCuenta}>{puestos.length}</span> : undefined}
          >
            Filtros
          </Boton>
        )}
        {children}
      </div>
      {(cuantos || puestos.length > 0) && (
        <div className={s.filtrosResumen}>
          {cuantos && <span className={s.total} aria-live="polite">{cuantos}</span>}
          <span className={s.chipsPuestos}>
            {puestos.map((f) => (
              <Chip key={f.id} tamano="sm" activo onQuitar={() => onFiltro?.(f.id, '')}>{textoDe(f)}</Chip>
            ))}
          </span>
        </div>
      )}
      <HojaInferior
        abierta={hoja}
        onCerrar={() => setHoja(false)}
        titulo="Filtros"
        pie={(
          <>
            <Boton variante="contorno" icono={<X aria-hidden="true" />} disabled={!puestos.length} onClick={quitarTodos}>Quitar</Boton>
            <Boton bloque onClick={() => setHoja(false)}>{cuantos ? `Ver ${cuantos}` : 'Listo'}</Boton>
          </>
        )}
      >
        <div className={s.filtrosHoja}>
          {filtros.map((f) => (
            <Campo
              key={f.id}
              etiqueta={f.etiqueta}
              opciones={opcionesDe(f)}
              value={f.valor || ''}
              onChange={(e) => onFiltro?.(f.id, e.target.value)}
            />
          ))}
        </div>
      </HojaInferior>
    </div>
  );
}

/* ── Lo elegido ───────────────────────────────────────── */

/**
 * La barra de lo elegido en una tabla: cuántos, qué se puede hacer con
 * todos a la vez y "quitar la selección". Se pega abajo (sobre la barra
 * del celular) mientras hay algo elegido.
 *  - cantidad · acciones: [{ id, texto, Icono, peligro, onClick, cargando }] · onLimpiar
 *  - unidad: ['elegida', 'elegidas'] ("3 elegidos" para productos)
 */
export function AccionesLote({ cantidad = 0, acciones = [], onLimpiar, unidad = ['elegida', 'elegidas'] }) {
  // Mientras hay algo elegido, el botón de la página se esconde (irían uno encima del otro).
  useEsconderPrincipal(cantidad > 0);
  if (!cantidad) return null;
  return (
    <div className={s.lote} role="region" aria-label="Lo elegido" data-componente="AccionesLote">
      <button type="button" className={s.loteLimpiar} onClick={onLimpiar} aria-label="Quitar la selección"><X aria-hidden="true" /></button>
      <strong className={s.loteCuantos}>{cantidad} {cantidad === 1 ? unidad[0] : unidad[1]}</strong>
      <div className={s.loteAcciones}>
        {acciones.map((a) => (
          <Boton
            key={a.id}
            tamano="sm"
            variante={a.peligro ? 'peligro' : 'secundario'}
            icono={a.Icono ? <a.Icono aria-hidden="true" /> : undefined}
            cargando={a.cargando}
            onClick={a.onClick}
          >
            {a.texto}
          </Boton>
        ))}
      </div>
    </div>
  );
}

/* ── Ver más ──────────────────────────────────────────── */

/**
 * Una lista larga se muestra de a tramos: cuántos se ven y "Ver N más".
 *  - visibles · total · onMas · paso (cuántos suma) · unidad: ['producto', 'productos']
 */
export function CargarMas({ visibles, total, onMas, paso = 50, unidad = ['resultado', 'resultados'] }) {
  if (!total || visibles >= total) return null;
  const faltan = Math.min(paso, total - visibles);
  return (
    <div className={s.mas} data-componente="CargarMas">
      <span>Ves {visibles} de {total} {total === 1 ? unidad[0] : unidad[1]}</span>
      <Boton variante="secundario" onClick={onMas}>Ver {faltan} más</Boton>
    </div>
  );
}

/* ── Ordenar a mano ───────────────────────────────────── */

function FilaOrdenable({ item, indice, total, nombre, render, onMover }) {
  const controles = useDragControls();
  return (
    <Reorder.Item as="li" value={item} dragListener={false} dragControls={controles} className={s.ordenFila}>
      <button
        type="button"
        className={s.asa}
        onPointerDown={(e) => { e.preventDefault(); controles.start(e); }}
        aria-label={`Arrastrar ${nombre}`}
        title="Arrastrar"
      >
        <GripVertical aria-hidden="true" />
      </button>
      <span className={s.ordenNumero} aria-hidden="true">{indice + 1}</span>
      <div className={s.ordenCuerpo}>{render(item, indice)}</div>
      <span className={s.ordenFlechas}>
        <button type="button" disabled={indice === 0} onClick={() => onMover(indice, -1)} aria-label={`Subir ${nombre}`}><ArrowUp aria-hidden="true" /></button>
        <button type="button" disabled={indice === total - 1} onClick={() => onMover(indice, 1)} aria-label={`Bajar ${nombre}`}><ArrowDown aria-hidden="true" /></button>
      </span>
    </Reorder.Item>
  );
}

/**
 * Ordenar una lista a mano: arrastrando desde el asa o con las flechas
 * (en el celular y con teclado). El orden nuevo sale por onCambiar; guardar
 * lo decide la página.
 *  - items · idDe(item) (item.id) · nombreDe(item) · render(item, indice) → el contenido de la fila
 *  - onCambiar(items) · etiqueta (para los lectores)
 */
export function ListaOrdenable({ items = [], idDe = (x) => x.id, nombreDe = (x) => String(x.id), render, onCambiar, etiqueta = 'Orden' }) {
  const mover = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onCambiar(n);
  };
  return (
    <Reorder.Group as="ol" axis="y" values={items} onReorder={onCambiar} className={s.ordenable} aria-label={etiqueta} data-componente="ListaOrdenable">
      {items.map((it, i) => (
        <FilaOrdenable key={idDe(it)} item={it} indice={i} total={items.length} nombre={nombreDe(it)} render={render} onMover={mover} />
      ))}
    </Reorder.Group>
  );
}

/* ── Elegir productos ─────────────────────────────────── */

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/**
 * Buscar un producto del catálogo y hacer algo con él (destacarlo,
 * agregarlo a un combo…). Los resultados salen al escribir.
 *  - productos: [{ id, nombre, imagen, precio, oculto }] (productoAdminDesde)
 *  - yaEstan: [ids] (salen con `accionHecha`, sin botón)
 *  - onElegir(producto) → promesa (mientras, el botón carga)
 *  - accion ('Agregar') · accionHecha ('Ya está') · placeholder · limite (8)
 */
export function SelectorProductos({ productos = [], yaEstan = [], onElegir, accion = 'Agregar', accionHecha = 'Ya está', placeholder = 'Buscar un producto por nombre', limite = 8 }) {
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(null);
  const q = normalizarBusqueda(buscar);
  const hay = new Set(yaEstan);
  const resultados = q ? productos.filter((p) => normalizarBusqueda(p.nombre).includes(q)) : [];
  const elegir = async (p) => {
    setCargando(p.id);
    try { await onElegir?.(p); } finally { setCargando(null); }
  };
  return (
    <div className={s.selector} data-componente="SelectorProductos">
      <Buscador placeholder={placeholder} value={buscar} onChange={(e) => setBuscar(e.target.value)} onBuscar={setBuscar} atajo={null} className={s.selectorBuscar} />
      {q && (resultados.length ? (
        <ul className={s.selectorLista}>
          {resultados.slice(0, limite).map((p) => (
            <li key={p.id} className={s.selectorFila}>
              <FotoProducto src={p.imagen} className={s.selectorFoto} />
              <span className={s.selectorTextos}>
                <strong>{p.nombre}</strong>
                <span>{soles(p.precio)}{p.oculto ? ' · Oculto en la tienda' : ''}</span>
              </span>
              {hay.has(p.id) ? (
                <span className={s.selectorHecho}><Check aria-hidden="true" /> {accionHecha}</span>
              ) : (
                <Boton tamano="sm" variante="secundario" cargando={cargando === p.id} disabled={Boolean(cargando)} onClick={() => elegir(p)}>{accion}</Boton>
              )}
            </li>
          ))}
          {resultados.length > limite && <li className={s.selectorMas}>Y {resultados.length - limite} más: escribe un poco más del nombre.</li>}
        </ul>
      ) : (
        <p className={s.selectorNada}>Ningún producto se llama así.</p>
      ))}
    </div>
  );
}

/* ── Un número que se edita en la fila ─────────────────── */

/**
 * Un número que se cambia ahí mismo (el stock de Productos). No se guarda
 * solo: al cambiarlo (escribiendo o con − y +) aparece encima un globo con
 * flecha ("¿Guardar 12? Antes: 10" · Cancelar · Guardar) que entra y sale con
 * una transición corta; Enter guarda y Esc cancela. Muestra guardando,
 * guardado o el error con Reintentar. Lo negativo o vacío no se guarda.
 *  - valor · onGuardar(nuevo, anterior) → promesa · etiqueta (para lectores)
 *  - min (0) · sufijo ("uds")
 */
export function NumeroEnLinea({ valor = 0, onGuardar, etiqueta, min = 0, sufijo }) {
  const [texto, setTextoEstado] = useState(String(valor ?? 0));
  // Lo escrito también en una referencia: dos toques seguidos en "+" suman dos.
  const textoRef = useRef(String(valor ?? 0));
  const setTexto = (v) => { textoRef.current = v; setTextoEstado(v); };
  const [estado, setEstado] = useState(null); // 'guardando' | 'guardado' | { error }
  const [guardado, setGuardado] = useState(Number(valor) || 0);
  const listo = useRef(null);
  const entrada = useRef(null);
  // El globo se queda un momento al irse, para su salida.
  const [globo, setGlobo] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const salida = useRef(null);

  const n = Number.parseInt(texto, 10);
  const valido = Number.isFinite(n) && n >= min;
  const pendiente = valido && n !== guardado;
  const error = estado && typeof estado === 'object' ? estado.error : null;

  // Llega otro valor de afuera (al recargar) y aquí no hay nada a medias.
  useEffect(() => {
    if (!pendiente && estado !== 'guardando') {
      setTexto(String(valor ?? 0));
      setGuardado(Number(valor) || 0);
    }
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { window.clearTimeout(listo.current); window.clearTimeout(salida.current); }, []);
  const abierto = pendiente || estado === 'guardando';
  useEffect(() => {
    window.clearTimeout(salida.current);
    if (abierto) { setGlobo(true); setSaliendo(false); return; }
    if (!globo) return;
    setSaliendo(true);
    salida.current = window.setTimeout(() => { setGlobo(false); setSaliendo(false); }, 140);
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!valido || estado === 'guardando') return;
    const nuevo = Number.parseInt(textoRef.current, 10);
    const anterior = guardado;
    if (nuevo === anterior) return;
    setEstado('guardando');
    try {
      await onGuardar?.(nuevo, anterior);
      setGuardado(nuevo);
      setEstado('guardado');
      window.clearTimeout(listo.current);
      listo.current = window.setTimeout(() => setEstado(null), 2000);
    } catch (err) {
      setEstado({ error: err?.message || 'No se guardó' });
    }
  };
  const cambiar = (t) => {
    setTexto(t);
    if (error || estado === 'guardado') setEstado(null);
  };
  const deshacer = () => { setTexto(String(guardado)); setEstado(null); entrada.current?.focus(); };
  const actual = () => Number.parseInt(textoRef.current, 10) || 0;
  return (
    <span className={s.enLinea} data-componente="NumeroEnLinea">
      <span className={s.enLineaAncla}>
      <span className={[s.enLineaCaja, pendiente && s.enLineaCambiado, error && s.enLineaError].filter(Boolean).join(' ')}>
        <button type="button" onClick={() => cambiar(String(Math.max(min, actual() - 1)))} aria-label={`Restar uno: ${etiqueta}`}>−</button>
        <input
          ref={entrada}
          type="number"
          inputMode="numeric"
          min={min}
          value={texto}
          aria-label={etiqueta}
          aria-invalid={error ? true : undefined}
          onChange={(e) => cambiar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); guardar(); }
            if (e.key === 'Escape' && (pendiente || !valido)) { e.preventDefault(); e.stopPropagation(); deshacer(); }
          }}
          onBlur={() => { if (!valido) setTexto(String(guardado)); }}
        />
        <button type="button" onClick={() => cambiar(String(actual() + 1))} aria-label={`Sumar uno: ${etiqueta}`}>+</button>
      </span>
      {globo && (
        <span className={[s.enLineaGlobo, saliendo && s.enLineaGloboSale].filter(Boolean).join(' ')} role="group" aria-label={`Cambio sin guardar: ${etiqueta}`}>
          <span className={s.enLineaGloboTexto}>
            <AlertCircle aria-hidden="true" />
            <span>
              <strong>{error ? 'No se guardó' : `¿Guardar ${valido ? n : guardado}?`}</strong>
              <span>{error || `Antes: ${guardado}`}</span>
            </span>
          </span>
          <span className={s.enLineaGloboBotones}>
            <button type="button" className={s.enLineaCancelar} onClick={deshacer} disabled={estado === 'guardando'} title="Cancelar (Esc)">Cancelar</button>
            <button type="button" className={s.enLineaGuardar} onClick={guardar} disabled={estado === 'guardando'} title="Guardar (Enter)">
              {estado === 'guardando' && <Loader2 className={s.girar} aria-hidden="true" />}
              {estado === 'guardando' ? 'Guardando' : error ? 'Reintentar' : 'Guardar'}
            </button>
          </span>
        </span>
      )}
      </span>
      {sufijo && <span className={s.enLineaSufijo}>{sufijo}</span>}
      <span className={s.enLineaEstado} aria-live="polite">
        {estado === 'guardado' && <Check className={s.enLineaListo} aria-label="Guardado" />}
        {error && !pendiente && (
          <button type="button" className={s.enLineaReintentar} onClick={guardar} title={error}>
            <RefreshCw aria-hidden="true" /> Reintentar
          </button>
        )}
      </span>
    </span>
  );
}
