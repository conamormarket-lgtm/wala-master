import React, { useMemo, useRef, useState } from 'react';
import { Archive, Copy, Download, Eye, EyeOff, FileClock, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, EstadoVacio, useToast } from '../../Feedback';
import { Chip, Etiqueta } from '../../Etiquetas';
import { Pestanas } from '../../Navegacion';
import { MenuContextual } from '../../piezas/MenuContextual';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, AccionesLote, CargarMas, InsigniaEstado, NumeroEnLinea } from '../../piezas/admin/Datos';
import { ElegirUno } from '../../piezas/admin/Formularios';
import { esDeLaTienda, piezasDeCombos, etiquetasDeProducto, estadoDeStock, normalizarBusqueda } from '../../adaptadoresAdmin';
import { FotoCelda } from './celdas';
import l from './Lista.module.css';
import s from './Productos.module.css';

/*
 * Productos (D2a): la lista de /admin/productos (Tienda, Personalizables,
 * Packs de Crear y Todos), el inventario (/admin/inventario) y los datos
 * para recomendar regalos (/admin/publico-productos). Los productos llegan
 * con productoAdminDesde; guardar, archivar y exportar son promesas del admin.
 */

const PASO = 50;
const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const nombresDe = (ids, porId) => ids.map((id) => porId.get(id)).filter(Boolean);

/* El precio, con el de lista tachado si está en oferta. */
function Precio({ p }) {
  return (
    <span className={s.precio}>
      <strong>{soles(p.precio)}</strong>
      {p.conOferta && <s>{soles(p.precioLista)}</s>}
    </span>
  );
}

/* Lo que distingue a un producto en la lista: destacado, combo, pieza, personalizable. */
function Marcas({ p, pieza }) {
  const hay = [
    p.destacado && <Etiqueta key="d" tono="violeta">Destacado</Etiqueta>,
    p.esCombo && <Etiqueta key="c" tono="neutro">Combo</Etiqueta>,
    pieza && <Etiqueta key="p" tono="neutro">Pieza de combo</Etiqueta>,
    p.personalizable && <Etiqueta key="z" tono="violeta">{p.talCual ? 'Tal cual y personalizable' : 'Personalizable'}</Etiqueta>,
  ].filter(Boolean);
  return hay.length ? <span className={s.marcas}>{hay}</span> : null;
}

const VISTAS = [
  { id: 'tienda', texto: 'Tienda' },
  { id: 'crear', texto: 'Personalizables' },
  { id: 'packs', texto: 'Packs de Crear' },
  { id: 'todos', texto: 'Todos' },
];

const ESTADOS_LISTA = [
  { id: 'visibles', texto: 'Visibles' },
  { id: 'ocultos', texto: 'Ocultos' },
  { id: 'piezas', texto: 'Piezas de combo' },
  { id: 'todos', texto: 'Todos' },
];

/**
 * La lista de productos.
 *  - productos: todos (productoAdminDesde; sin archivados) · categorias: [{ id, nombre }] · marcas: [{ id, nombre }]
 *  - cargando · error · onReintentar
 *  - vista ('tienda' | 'crear' | 'packs' | 'todos') + onVista (en el admin, ?ver=) ·
 *    personalizables / packs: lo que va en esas pestañas (D2c); sin él, un aviso
 *  - onAbrir(producto) (su ficha) · onIr(url) (el menú "Crear otro") · urlNuevo · urlNuevoPersonalizable · urlNuevoPack
 *  - onVisible(id, visible) → promesa · onVarios(ids, visible) → promesa con { ok, fallaron }
 *  - onArchivar(ids) → promesa con { ok, fallaron } · onDuplicar(producto) → promesa
 *  - onExportar(ids | null) (CSV) · onQuitarPersonalizacionVieja(ids) → promesa con { ok, fallaron }
 *  - borradores: [{ id, nombre, fecha }] (los guardados en este aparato) · urlBorrador(id) · onDescartarBorrador(id) → promesa
 */
export function PaginaProductos({
  productos = [], categorias = [], marcas = [], cargando, error, onReintentar,
  vista = 'tienda', onVista, personalizables, packs,
  onAbrir, onIr, urlNuevo = '/admin/productos/nuevo', urlNuevoPersonalizable = '/admin/prendas-crear/nueva', urlNuevoPack = '/admin/productos?ver=packs&nuevo=1',
  onVisible, onVarios, onArchivar, onDuplicar, onExportar, onQuitarPersonalizacionVieja,
  borradores = [], urlBorrador, onDescartarBorrador,
}) {
  const toast = useToast();
  const [estado, setEstado] = useState('visibles');
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState({ categoria: '', marca: '' });
  const [orden, setOrden] = useState({ por: 'nombre', dir: 'asc' });
  const [elegidos, setElegidos] = useState([]);
  const [visibles, setVisibles] = useState(PASO);
  const [cambios, setCambios] = useState({}); // visibilidad mientras se guarda (o hasta que llegue la lista)
  const [pregunta, setPregunta] = useState(null); // { tipo, ids }
  const [menuNuevo, setMenuNuevo] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const porCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);
  const conCambios = useMemo(() => productos.map((p) => (p.id in cambios ? { ...p, oculto: !cambios[p.id] } : p)), [productos, cambios]);
  const tienda = useMemo(() => conCambios.filter(esDeLaTienda), [conCambios]);
  const piezas = useMemo(() => piezasDeCombos(tienda), [tienda]);
  const cuentas = {
    visibles: tienda.filter((p) => !p.oculto).length,
    ocultos: tienda.filter((p) => p.oculto && !piezas.has(p.id)).length,
    piezas: tienda.filter((p) => piezas.has(p.id)).length,
    todos: tienda.length,
  };
  const deCrear = { crear: productos.filter((p) => p.personalizable).length, packs: productos.filter((p) => p.pack).length };
  const viejos = tienda.filter((p) => p.personalizacionVieja);

  const q = normalizarBusqueda(buscar);
  const coincide = (p) => !q || normalizarBusqueda(`${p.nombre} ${nombresDe(p.categorias, porCategoria).join(' ')} ${p.precio}`).includes(q);
  const filas = useMemo(() => {
    const base = vista === 'todos' ? conCambios : tienda.filter((p) => (
      estado === 'visibles' ? !p.oculto
        : estado === 'ocultos' ? p.oculto && !piezas.has(p.id)
          : estado === 'piezas' ? piezas.has(p.id) : true
    ));
    const lista = base.filter((p) => coincide(p)
      && (!filtro.categoria || p.categorias.includes(filtro.categoria))
      && (!filtro.marca || (filtro.marca === '__sin' ? !p.marcaId : p.marcaId === filtro.marca)));
    const signo = orden.dir === 'desc' ? -1 : 1;
    const cmp = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      precio: (a, b) => a.precio - b.precio,
      stock: (a, b) => a.stock - b.stock,
    }[orden.por] || (() => 0);
    return [...lista].sort((a, b) => signo * cmp(a, b) || a.nombre.localeCompare(b.nombre, 'es'));
  }, [vista, conCambios, tienda, estado, piezas, q, filtro, orden]); // eslint-disable-line react-hooks/exhaustive-deps

  const reiniciar = () => { setElegidos([]); setVisibles(PASO); };

  const alternarVisible = async (p) => {
    const visible = p.oculto;
    setCambios((c) => ({ ...c, [p.id]: visible }));
    try {
      await onVisible?.(p.id, visible);
      toast({ tipo: 'exito', titulo: visible ? 'Se ve en la tienda' : 'Oculto en la tienda', texto: p.nombre });
    } catch (err) {
      setCambios((c) => { const n = { ...c }; delete n[p.id]; return n; });
      toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' });
    }
  };

  const resultado = (r, verbo, total) => {
    const ok = r?.ok ?? total;
    const fallaron = r?.fallaron ?? 0;
    toast({ tipo: fallaron ? 'aviso' : 'exito', titulo: `${ok} producto${ok === 1 ? '' : 's'} ${verbo}`, texto: fallaron ? `${fallaron} no se pudieron: vuelve a intentar con esos.` : undefined });
  };
  const confirmar = async () => {
    const { tipo, ids } = pregunta;
    setTrabajando(true);
    try {
      if (tipo === 'archivar') { resultado(await onArchivar(ids), 'archivados', ids.length); setElegidos([]); }
      if (tipo === 'mostrar' || tipo === 'ocultar') {
        const visible = tipo === 'mostrar';
        setCambios((c) => ({ ...c, ...Object.fromEntries(ids.map((id) => [id, visible])) }));
        resultado(await onVarios(ids, visible), visible ? 'visibles' : 'ocultos', ids.length);
        setElegidos([]);
      }
      if (tipo === 'viejo') resultado(await onQuitarPersonalizacionVieja(ids), 'sin la personalización de antes', ids.length);
      if (tipo === 'borrador') { await onDescartarBorrador(ids[0]); toast({ tipo: 'exito', titulo: 'Borrador descartado' }); }
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setTrabajando(false);
      setPregunta(null);
    }
  };
  const duplicar = async (p) => {
    try {
      await onDuplicar?.(p);
      toast({ tipo: 'exito', titulo: 'Copia creada (oculta)', texto: `${p.nombre} (Copia)` });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo duplicar', texto: err?.message || 'Vuelve a intentar.' });
    }
  };
  const exportar = (ids) => {
    onExportar?.(ids);
    toast({ tipo: 'exito', titulo: 'CSV descargado', texto: ids ? `${ids.length} productos` : 'Todos los productos' });
  };

  const columnas = vista === 'todos' ? [
    { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagen} /> },
    { id: 'nombre', titulo: 'Producto', ordenable: true, tarjeta: 'titulo', celda: (p) => p.nombre },
    { id: 'etiquetas', titulo: 'Qué es', tarjeta: 'detalle', celda: (p) => <span className={s.marcas}>{etiquetasDeProducto(p).map((e) => <Etiqueta key={e} tono={/Oculto|Borrador|Reemplazado/.test(e) ? 'neutro' : 'violeta'}>{e}</Etiqueta>)}</span> },
  ] : [
    { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagen} /> },
    { id: 'nombre', titulo: 'Producto', ordenable: true, tarjeta: 'titulo', celda: (p) => <>{p.nombre}<Marcas p={p} pieza={piezas.has(p.id)} /></> },
    { id: 'categoria', titulo: 'Categoría', tarjeta: 'detalle', celda: (p) => nombresDe(p.categorias, porCategoria).join(', ') || <span className={l.sub}>Sin categoría</span> },
    { id: 'precio', titulo: 'Precio', ordenable: true, ancho: 120, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <Precio p={p} /> },
    { id: 'stock', titulo: 'Stock', ordenable: true, ancho: 90, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <span className={l.numero}><span className={l.soloTarjeta}>Stock </span>{p.stock}</span> },
    {
      id: 'estado',
      titulo: 'En la tienda',
      ancho: 150,
      // Es un botón: en la tarjeta va abajo, no dentro del botón de la tarjeta.
      tarjeta: 'control',
      celda: (p) => (
        <button type="button" className={s.visible} onClick={() => alternarVisible(p)} aria-pressed={!p.oculto} title={p.oculto ? 'Mostrar en la tienda' : 'Ocultar de la tienda'}>
          {p.oculto ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          <InsigniaEstado estado={p.oculto ? 'oculto' : 'activo'}>{p.oculto ? 'Oculto' : 'Visible'}</InsigniaEstado>
        </button>
      ),
    },
  ];

  const enTienda = vista === 'tienda';
  const enLista = vista === 'tienda' || vista === 'todos';

  return (
    <div data-componente="PaginaProductos">
      <CabezaAdmin
        icono="productos"
        titulo="Productos"
        subtitulo="Lo que se vende en la tienda. Los personalizables y los packs de Crear tienen su pestaña."
        acciones={(
          <>
            {enTienda && onExportar && <Boton variante="secundario" icono={<Download aria-hidden="true" />} onClick={() => exportar(null)}>Exportar CSV</Boton>}
            <Boton
              variante="secundario"
              icono={<MoreHorizontal aria-hidden="true" />}
              aria-haspopup="menu"
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuNuevo({ x: r.left, y: r.bottom + 6 }); }}
            >
              Crear otro
            </Boton>
          </>
        )}
        principal={{ texto: 'Nuevo producto', Icono: Plus, to: urlNuevo }}
      />

      <div className={`${s.vistas} ${l.desliza}`}>
        <Pestanas
          opciones={VISTAS.map((v) => ({ ...v, texto: v.id === 'tienda' ? `${v.texto} · ${cuentas.todos}` : deCrear[v.id] !== undefined ? `${v.texto} · ${deCrear[v.id]}` : v.texto }))}
          valor={vista}
          onChange={(v) => { reiniciar(); onVista?.(v); }}
          etiqueta="Qué productos"
        />
      </div>

      {vista === 'crear' && (personalizables || <Pronto texto="Los personalizables de Crear se arman en el tramo D2c." />)}
      {vista === 'packs' && (packs || <Pronto texto="Los packs de Crear se arman en el tramo D2c." />)}

      {enLista && (
        <>
          {enTienda && borradores.length > 0 && (
            <section className={s.borradores} aria-labelledby="productos-borradores">
              <h2 id="productos-borradores"><FileClock aria-hidden="true" /> Sin terminar en este aparato</h2>
              <ul>
                {borradores.map((b) => (
                  <li key={b.id}>
                    <span className={s.borradorTextos}><strong>{b.nombre || 'Sin nombre'}</strong><span>{b.fecha}</span></span>
                    <Boton tamano="sm" variante="secundario" to={urlBorrador?.(b.id)}>Continuar</Boton>
                    <Boton tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} onClick={() => setPregunta({ tipo: 'borrador', ids: [b.id], nombre: b.nombre })}>Descartar</Boton>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {enTienda && viejos.length > 0 && onQuitarPersonalizacionVieja && (
            <div className={s.aviso}>
              <Aviso
                tipo="aviso"
                icono={<Wand2 aria-hidden="true" />}
                titulo={viejos.length === 1 ? 'Un producto tiene la personalización de antes' : `${viejos.length} productos tienen la personalización de antes`}
                accion={<Boton tamano="sm" variante="contorno" onClick={() => setPregunta({ tipo: 'viejo', ids: viejos.map((p) => p.id) })}>Quitarla</Boton>}
              >
                El editor viejo y Yoryo ya no se usan en la tienda: ahora se personaliza en Crear.
              </Aviso>
            </div>
          )}

          {enTienda && (
            <div className={`${s.estados} ${l.desliza}`} role="group" aria-label="Cuáles">
              {ESTADOS_LISTA.map((e) => (
                <Chip key={e.id} tamano="sm" activo={estado === e.id} cuenta={cargando ? undefined : cuentas[e.id]} onClick={() => { setEstado(e.id); reiniciar(); }}>{e.texto}</Chip>
              ))}
            </div>
          )}

          <BarraFiltros
            busqueda={buscar}
            onBusqueda={(t) => { setBuscar(t); reiniciar(); }}
            placeholder="Buscar por nombre, categoría o precio"
            filtros={[
              { id: 'categoria', etiqueta: 'Categoría', todos: 'Todas las categorías', valor: filtro.categoria, opciones: categorias.map((c) => ({ valor: c.id, texto: c.nombre })) },
              { id: 'marca', etiqueta: 'Marca', todos: 'Todas las marcas', valor: filtro.marca, opciones: [...marcas.map((m) => ({ valor: m.id, texto: m.nombre })), { valor: '__sin', texto: 'Sin marca' }] },
            ]}
            onFiltro={(id, v) => { setFiltro((f) => ({ ...f, [id]: v })); reiniciar(); }}
            total={cargando || error ? undefined : filas.length}
            unidad={['producto', 'productos']}
          />

          <TablaAdmin
            etiqueta="Productos"
            columnas={columnas}
            filas={filas.slice(0, visibles)}
            nombreDe={(p) => p.nombre}
            cargando={cargando}
            error={error}
            onReintentar={onReintentar}
            orden={orden}
            onOrden={setOrden}
            onFila={onAbrir}
            seleccion={enTienda ? elegidos : undefined}
            onSeleccion={enTienda ? setElegidos : undefined}
            vacio={q || filtro.categoria || filtro.marca
              ? { titulo: 'Ningún producto coincide', texto: 'Prueba con otra palabra o quita los filtros.' }
              : estado === 'ocultos' ? { titulo: 'No hay productos ocultos', icono: <Eye aria-hidden="true" /> }
                : { titulo: 'Todavía no hay productos', accion: <Boton to={urlNuevo} icono={<Plus aria-hidden="true" />}>Nuevo producto</Boton> }}
            acciones={(p) => (vista === 'todos' ? [
              { id: 'abrir', etiqueta: 'Abrir su ficha', Icono: Pencil, accion: () => onAbrir?.(p) },
            ] : [
              { id: 'editar', etiqueta: 'Editar', Icono: Pencil, accion: () => onAbrir?.(p) },
              { id: 'visible', etiqueta: p.oculto ? 'Mostrar en la tienda' : 'Ocultar de la tienda', Icono: p.oculto ? Eye : EyeOff, accion: () => alternarVisible(p) },
              ...(onDuplicar ? [{ id: 'duplicar', etiqueta: 'Duplicar', Icono: Copy, accion: () => duplicar(p) }] : []),
              ...(onArchivar ? ['separador', { id: 'archivar', etiqueta: 'Archivar', Icono: Archive, peligro: true, accion: () => setPregunta({ tipo: 'archivar', ids: [p.id], nombre: p.nombre }) }] : []),
            ])}
          />
          <CargarMas visibles={Math.min(visibles, filas.length)} total={filas.length} onMas={() => setVisibles((v) => v + PASO)} paso={PASO} unidad={['producto', 'productos']} />

          {enTienda && (
            <AccionesLote
              cantidad={elegidos.length}
              unidad={['elegido', 'elegidos']}
              onLimpiar={() => setElegidos([])}
              acciones={[
                ...(onVarios ? [
                  { id: 'mostrar', texto: 'Mostrar', Icono: Eye, onClick: () => setPregunta({ tipo: 'mostrar', ids: elegidos }) },
                  { id: 'ocultar', texto: 'Ocultar', Icono: EyeOff, onClick: () => setPregunta({ tipo: 'ocultar', ids: elegidos }) },
                ] : []),
                ...(onExportar ? [{ id: 'exportar', texto: 'CSV', Icono: Download, onClick: () => exportar(elegidos) }] : []),
                ...(onArchivar ? [{ id: 'archivar', texto: 'Archivar', Icono: Archive, peligro: true, onClick: () => setPregunta({ tipo: 'archivar', ids: elegidos }) }] : []),
              ]}
            />
          )}
        </>
      )}

      <MenuContextual
        abierto={Boolean(menuNuevo)}
        x={menuNuevo?.x}
        y={menuNuevo?.y}
        titulo="Crear otro"
        onCerrar={() => setMenuNuevo(null)}
        items={[
          { id: 'personalizable', etiqueta: 'Un personalizable (Crear)', Icono: Sparkles, accion: () => onIr?.(urlNuevoPersonalizable) },
          { id: 'pack', etiqueta: 'Un pack de Crear', Icono: Sparkles, accion: () => onIr?.(urlNuevoPack) },
        ]}
      />

      <Confirmar
        abierta={Boolean(pregunta)}
        titulo={textoPregunta(pregunta).titulo}
        texto={textoPregunta(pregunta).texto}
        confirmar={textoPregunta(pregunta).confirmar}
        peligro={pregunta?.tipo === 'archivar' || pregunta?.tipo === 'borrador'}
        onConfirmar={confirmar}
        onCancelar={() => !trabajando && setPregunta(null)}
      >
        {pregunta?.tipo === 'viejo' && (
          <ul className={s.listaPregunta}>
            {viejos.slice(0, 15).map((p) => <li key={p.id}>{p.nombre}</li>)}
            {viejos.length > 15 && <li>y {viejos.length - 15} más</li>}
          </ul>
        )}
      </Confirmar>
    </div>
  );
}

function textoPregunta(p) {
  if (!p) return {};
  const n = p.ids.length;
  const cuales = p.nombre ? `«${p.nombre}»` : `${n} producto${n === 1 ? '' : 's'}`;
  if (p.tipo === 'archivar') return { titulo: `¿Archivar ${cuales}?`, texto: 'Dejan de verse en la tienda. No se borran sus datos ni sus fotos: los pedidos y las listas que los tienen siguen igual.', confirmar: 'Archivar' };
  if (p.tipo === 'mostrar') return { titulo: `¿Mostrar ${cuales} en la tienda?`, confirmar: 'Mostrar' };
  if (p.tipo === 'ocultar') return { titulo: `¿Ocultar ${cuales}?`, texto: 'Dejan de verse en la tienda; se vuelven a mostrar cuando quieras.', confirmar: 'Ocultar' };
  if (p.tipo === 'viejo') return { titulo: `¿Quitar la personalización de antes a ${cuales}?`, texto: 'Se apaga "Producto personalizable" y se borra su configuración de Yoryo. A las esclavas se les suma la nota de cómo pedirla personalizada.', confirmar: 'Quitarla' };
  if (p.tipo === 'borrador') return { titulo: `¿Descartar el borrador ${p.nombre ? `«${p.nombre}»` : ''}?`, texto: 'Se borra lo que llevabas escrito en este aparato. Si nunca se publicó, también sus fotos.', confirmar: 'Descartar' };
  return {};
}

function Pronto({ texto }) {
  return (
    <div className={s.pronto}>
      <EstadoVacio imagen="/assets/kapi/3d/kapi-hambre-256.webp" titulo="Todavía no está en el kit" texto={texto} />
    </div>
  );
}

/* ── Inventario ────────────────────────────────────────── */

const ESTADOS_STOCK = {
  agotado: { texto: 'Agotado', tono: 'peligro' },
  ultimas: { texto: 'Últimas unidades', tono: 'aviso' },
  disponible: { texto: 'Disponible', tono: 'exito' },
};

/**
 * El inventario: el stock de cada producto, que se cambia ahí mismo (se
 * guarda solo un segundo después de dejar de escribir).
 *  - productos (productoAdminDesde) · categorias · colecciones · marcas · tipos ([{ id, nombre }])
 *  - cargando · error · onReintentar
 *  - onGuardarStock(id, nuevo, anterior) → promesa (en el admin, además, el registro del cambio)
 */
export function PaginaInventario({ productos = [], categorias = [], colecciones = [], marcas = [], tipos = [], cargando, error, onReintentar, onGuardarStock }) {
  // El orden y el filtro de stock usan el stock con que llegó cada producto:
  // si no, al guardar la fila se movería (o se iría) bajo el dedo.
  const stockInicial = useRef(new Map());
  productos.forEach((p) => { if (!stockInicial.current.has(p.id)) stockInicial.current.set(p.id, p.stock); });
  const inicial = (p) => stockInicial.current.get(p.id) ?? p.stock;
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState({});
  const [orden, setOrden] = useState({ por: 'stock', dir: 'asc' });
  const [visibles, setVisibles] = useState(PASO);
  const [stock, setStock] = useState({}); // lo guardado aquí, para el estado y el orden

  const conStock = useMemo(() => productos.map((p) => (p.id in stock ? { ...p, stock: stock[p.id] } : p)), [productos, stock]);
  const q = normalizarBusqueda(buscar);
  const filas = useMemo(() => {
    const lista = conStock.filter((p) => (!q || normalizarBusqueda(`${p.nombre} ${p.sku}`).includes(q))
      && (!filtro.categoria || p.categorias.includes(filtro.categoria))
      && (!filtro.coleccion || p.colecciones.includes(filtro.coleccion))
      && (!filtro.marca || p.marcaId === filtro.marca)
      && (!filtro.tipo || p.tipo === filtro.tipo)
      && (!filtro.estado || estadoDeStock(inicial(p)) === filtro.estado));
    const signo = orden.dir === 'desc' ? -1 : 1;
    const cmp = orden.por === 'nombre' ? (a, b) => a.nombre.localeCompare(b.nombre, 'es') : (a, b) => inicial(a) - inicial(b);
    return [...lista].sort((a, b) => signo * cmp(a, b) || a.nombre.localeCompare(b.nombre, 'es'));
  }, [conStock, q, filtro, orden]);
  const agotados = conStock.filter((p) => p.stock <= 0).length;
  const opciones = (lista) => lista.map((x) => ({ valor: x.id, texto: x.nombre }));

  return (
    <div data-componente="PaginaInventario">
      <CabezaAdmin icono="inventario" titulo="Inventario" subtitulo="El stock de cada producto. Cambia el número y se guarda solo; cada cambio queda en el historial." />
      {!cargando && !error && agotados > 0 && filtro.estado !== 'agotado' && (
        <div className={s.aviso}>
          <Aviso tipo="aviso" titulo={agotados === 1 ? 'Un producto está agotado' : `${agotados} productos están agotados`} accion={<Boton tamano="sm" variante="contorno" onClick={() => setFiltro((f) => ({ ...f, estado: 'agotado' }))}>Verlos</Boton>}>
            Con stock 0 no se pueden comprar.
          </Aviso>
        </div>
      )}
      <BarraFiltros
        busqueda={buscar}
        onBusqueda={(t) => { setBuscar(t); setVisibles(PASO); }}
        placeholder="Buscar por nombre o SKU"
        filtros={[
          { id: 'estado', etiqueta: 'Stock', todos: 'Todo el stock', valor: filtro.estado || '', opciones: [{ valor: 'agotado', texto: 'Agotados' }, { valor: 'ultimas', texto: 'Últimas unidades' }, { valor: 'disponible', texto: 'Disponibles' }] },
          { id: 'categoria', etiqueta: 'Categoría', todos: 'Todas las categorías', valor: filtro.categoria || '', opciones: opciones(categorias) },
          { id: 'coleccion', etiqueta: 'Colección', todos: 'Todas las colecciones', valor: filtro.coleccion || '', opciones: opciones(colecciones) },
          { id: 'marca', etiqueta: 'Marca', todos: 'Todas las marcas', valor: filtro.marca || '', opciones: opciones(marcas) },
          { id: 'tipo', etiqueta: 'Tipo', todos: 'Todos los tipos', valor: filtro.tipo || '', opciones: opciones(tipos) },
        ]}
        onFiltro={(id, v) => { setFiltro((f) => ({ ...f, [id]: v })); setVisibles(PASO); }}
        total={cargando || error ? undefined : filas.length}
        unidad={['producto', 'productos']}
      />
      <TablaAdmin
        etiqueta="Inventario"
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagen} /> },
          { id: 'nombre', titulo: 'Producto', ordenable: true, tarjeta: 'titulo', celda: (p) => <>{p.nombre}<span className={l.sub}>{p.sku ? `SKU ${p.sku}` : 'Sin SKU'}</span></> },
          { id: 'precio', titulo: 'Precio', ancho: 120, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <Precio p={p} /> },
          { id: 'estado', titulo: 'Estado', ancho: 160, tarjeta: 'estado', celda: (p) => <InsigniaEstado estado={estadoDeStock(p.stock)} estados={ESTADOS_STOCK} /> },
          {
            id: 'stock',
            titulo: 'Stock',
            ordenable: true,
            ancho: 210,
            tarjeta: 'control',
            celda: (p) => (
              <NumeroEnLinea
                valor={p.stock}
                etiqueta={`Stock de ${p.nombre}`}
                sufijo="uds"
                onGuardar={async (n, antes) => { await onGuardarStock?.(p.id, n, antes); setStock((m) => ({ ...m, [p.id]: n })); }}
              />
            ),
          },
        ]}
        filas={filas.slice(0, visibles)}
        nombreDe={(p) => p.nombre}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        orden={orden}
        onOrden={setOrden}
        vacio={{ titulo: 'Ningún producto coincide', texto: 'Prueba con otra palabra o quita los filtros.' }}
      />
      <CargarMas visibles={Math.min(visibles, filas.length)} total={filas.length} onMas={() => setVisibles((v) => v + PASO)} paso={PASO} unidad={['producto', 'productos']} />
    </div>
  );
}

/* ── Datos para recomendar ─────────────────────────────── */

/* Los de utils/giftRecommender (PUBLICOS y EDADES): la tienda guarda estos valores. */
export const PUBLICOS = [
  { valor: 'mujer', texto: 'Mujer' },
  { valor: 'hombre', texto: 'Hombre' },
  { valor: 'unisex', texto: 'Unisex' },
  { valor: 'ninos', texto: 'Niños' },
];
export const EDADES = [
  { valor: 0, texto: 'Todas las edades' },
  { valor: 13, texto: 'Desde 13' },
  { valor: 18, texto: 'Solo adultos' },
];

const FILTROS_RECOMENDAR = [
  { id: 'faltan', texto: 'Faltan datos' },
  { id: 'todos', texto: 'Todos' },
  { id: 'equipo', texto: 'De un equipo' },
  { id: 'adultos', texto: 'No para niños' },
];

/* El equipo: se guarda al salir del campo o con Enter; "Usar" toma la sugerencia. */
function CampoEquipo({ p, sugerido, onGuardar }) {
  const [texto, setTexto] = useState(p.equipo || '');
  const guardar = (v) => { const t = String(v || '').trim(); if (t !== (p.equipo || '')) onGuardar({ equipo: t || null }); };
  return (
    <span className={s.equipo}>
      <input
        className={s.equipoCampo}
        value={texto}
        placeholder={sugerido || 'Ninguno'}
        list="admin-equipos"
        aria-label={`Equipo de ${p.nombre}`}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => guardar(texto)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(texto); } }}
      />
      {!p.equipo && sugerido && <button type="button" className={s.usar} onClick={() => { setTexto(sugerido); guardar(sugerido); }}>Usar</button>}
    </span>
  );
}

/**
 * Datos para recomendar regalos: para quién es cada producto, desde qué
 * edad y de qué equipo. Lo que no está puesto se deduce (sale punteado):
 * tocarlo lo guarda; tocar lo guardado lo quita.
 *  - productos (productoAdminDesde: publico, edadMinima, equipo) · categorias
 *  - sugerenciaDe(producto) → { publico, edadMinima, equipo } (en el admin, giftRecommender)
 *  - equipos: los conocidos (para sugerir al escribir)
 *  - cargando · error · onReintentar · onGuardar(id, campos) → promesa (null quita el campo)
 *  - onAceptarSugerencias(ids) → promesa · onMarcarTodos(ids, publico) → promesa
 */
export function PaginaRecomendar({ productos = [], categorias = [], sugerenciaDe = () => ({}), equipos = [], cargando, error, onReintentar, onGuardar, onAceptarSugerencias, onMarcarTodos }) {
  const toast = useToast();
  const [filtro, setFiltro] = useState('faltan');
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('');
  const [visibles, setVisibles] = useState(PASO);
  const [locales, setLocales] = useState({});
  const [pregunta, setPregunta] = useState(null);

  const porCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);
  const lista = useMemo(() => productos.map((p) => ({ ...p, ...(locales[p.id] || {}) })), [productos, locales]);
  const falta = (p) => { const sug = sugerenciaDe(p) || {}; return !p.publico || p.edadMinima == null || (sug.equipo && !p.equipo); };
  const cuentas = {
    faltan: lista.filter(falta).length,
    todos: lista.length,
    equipo: lista.filter((p) => p.equipo || (sugerenciaDe(p) || {}).equipo).length,
    adultos: lista.filter((p) => (p.edadMinima ?? (sugerenciaDe(p) || {}).edadMinima ?? 0) >= 13).length,
  };
  const q = normalizarBusqueda(buscar);
  const filas = lista.filter((p) => {
    const sug = sugerenciaDe(p) || {};
    const pasa = filtro === 'faltan' ? falta(p) : filtro === 'equipo' ? (p.equipo || sug.equipo) : filtro === 'adultos' ? (p.edadMinima ?? sug.edadMinima ?? 0) >= 13 : true;
    return pasa && (!q || normalizarBusqueda(p.nombre).includes(q)) && (!categoria || p.categorias.includes(categoria));
  });

  const guardar = async (p, campos) => {
    setLocales((m) => ({ ...m, [p.id]: { ...(m[p.id] || {}), ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v ?? (k === 'edadMinima' ? null : '')])) } }));
    try {
      await onGuardar?.(p.id, campos);
    } catch (err) {
      setLocales((m) => { const n = { ...m }; delete n[p.id]; return n; });
      toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' });
    }
  };
  const confirmar = async () => {
    const ids = filas.map((p) => p.id);
    try {
      if (pregunta.tipo === 'sugerencias') {
        await onAceptarSugerencias?.(ids);
        const nuevos = {};
        filas.forEach((p) => {
          const sug = sugerenciaDe(p) || {};
          nuevos[p.id] = { ...(locales[p.id] || {}), ...(p.publico ? {} : sug.publico ? { publico: sug.publico } : {}), ...(p.edadMinima == null && sug.edadMinima != null ? { edadMinima: sug.edadMinima } : {}), ...(!p.equipo && sug.equipo ? { equipo: sug.equipo } : {}) };
        });
        setLocales((m) => ({ ...m, ...nuevos }));
        toast({ tipo: 'exito', titulo: 'Sugerencias guardadas', texto: `${ids.length} productos` });
      } else {
        await onMarcarTodos?.(ids, pregunta.publico);
        setLocales((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, { ...(m[id] || {}), publico: pregunta.publico }])) }));
        toast({ tipo: 'exito', titulo: `${ids.length} productos marcados`, texto: PUBLICOS.find((x) => x.valor === pregunta.publico)?.texto });
      }
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setPregunta(null);
    }
  };

  return (
    <div data-componente="PaginaRecomendar">
      <CabezaAdmin
        icono="recomendar"
        titulo="Datos para recomendar"
        subtitulo="Para quién es cada producto, desde qué edad y de qué equipo: con esto se arman las ideas de regalo. Lo punteado es lo que se deduce; tócalo para guardarlo."
      />
      <div className={`${s.estados} ${l.desliza}`} role="group" aria-label="Cuáles">
        {FILTROS_RECOMENDAR.map((f) => (
          <Chip key={f.id} tamano="sm" activo={filtro === f.id} cuenta={cargando ? undefined : cuentas[f.id]} onClick={() => { setFiltro(f.id); setVisibles(PASO); }}>{f.texto}</Chip>
        ))}
      </div>
      <BarraFiltros
        busqueda={buscar}
        onBusqueda={(t) => { setBuscar(t); setVisibles(PASO); }}
        placeholder="Buscar un producto"
        filtros={[{ id: 'categoria', etiqueta: 'Categoría', todos: 'Todas las categorías', valor: categoria, opciones: categorias.map((c) => ({ valor: c.id, texto: c.nombre })) }]}
        onFiltro={(_, v) => { setCategoria(v); setVisibles(PASO); }}
        total={cargando || error ? undefined : filas.length}
        unidad={['producto', 'productos']}
      />
      {filas.length > 1 && (onMarcarTodos || onAceptarSugerencias) && (
        <div className={s.loteRecomendar}>
          {onAceptarSugerencias && filtro === 'faltan' && <Boton tamano="sm" variante="secundario" icono={<Sparkles aria-hidden="true" />} onClick={() => setPregunta({ tipo: 'sugerencias' })}>Aceptar sugerencias</Boton>}
          {onMarcarTodos && (
            <p className={s.marcarTodos}>
              Marcar los {filas.length} como:
              {PUBLICOS.map((x) => <button key={x.valor} type="button" onClick={() => setPregunta({ tipo: 'todos', publico: x.valor })}>{x.texto}</button>)}
            </p>
          )}
        </div>
      )}
      <datalist id="admin-equipos">{equipos.map((e) => <option key={e} value={e} />)}</datalist>
      <TablaAdmin
        etiqueta="Datos para recomendar"
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 64, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagen} /> },
          { id: 'nombre', titulo: 'Producto', tarjeta: 'titulo', celda: (p) => <>{p.nombre}<span className={l.sub}>{nombresDe(p.categorias, porCategoria).join(', ')}{p.oculto ? ' · oculto' : ''}</span></> },
          { id: 'publico', titulo: 'Para quién', tarjeta: 'control', celda: (p) => <ElegirUno etiqueta={`Para quién es ${p.nombre}`} opciones={PUBLICOS} valor={p.publico} sugerido={(sugerenciaDe(p) || {}).publico} onElegir={(v) => guardar(p, { publico: v })} /> },
          { id: 'edad', titulo: 'Edad', tarjeta: 'control', celda: (p) => <ElegirUno etiqueta={`Edad para ${p.nombre}`} opciones={EDADES} valor={p.edadMinima} sugerido={(sugerenciaDe(p) || {}).edadMinima} onElegir={(v) => guardar(p, { edadMinima: v })} /> },
          { id: 'equipo', titulo: 'Equipo', ancho: 210, tarjeta: 'control', celda: (p) => <CampoEquipo key={`${p.id}-${p.equipo}`} p={p} sugerido={(sugerenciaDe(p) || {}).equipo} onGuardar={(c) => guardar(p, c)} /> },
        ]}
        filas={filas.slice(0, visibles)}
        nombreDe={(p) => p.nombre}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        vacio={filtro === 'faltan' ? { titulo: 'No falta nada', texto: 'Todos los productos tienen sus datos para recomendar.', icono: <Sparkles aria-hidden="true" /> } : { titulo: 'Ningún producto coincide' }}
      />
      <CargarMas visibles={Math.min(visibles, filas.length)} total={filas.length} onMas={() => setVisibles((v) => v + PASO)} paso={PASO} unidad={['producto', 'productos']} />
      <Confirmar
        abierta={Boolean(pregunta)}
        titulo={pregunta?.tipo === 'sugerencias' ? `¿Guardar las sugerencias de ${filas.length} productos?` : `¿Marcar los ${filas.length} como «${PUBLICOS.find((x) => x.valor === pregunta?.publico)?.texto}»?`}
        texto={pregunta?.tipo === 'sugerencias' ? 'Se guarda lo punteado que falta en cada uno. Lo que ya está puesto no cambia.' : 'Se cambia «Para quién» en todos los de la lista, también los que ya lo tenían.'}
        confirmar="Guardar"
        onConfirmar={confirmar}
        onCancelar={() => setPregunta(null)}
      />
    </div>
  );
}
