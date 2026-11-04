import React, { useMemo, useRef, useState } from 'react';
import { Copy, Download, Eye, EyeOff, FileClock, History, MoreHorizontal, Pencil, Plus, RotateCcw, Sparkles, Trash2, Wand2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, EstadoVacio, useToast } from '../../Feedback';
import { Chip, Etiqueta } from '../../Etiquetas';
import { Pestanas } from '../../Navegacion';
import { MenuContextual } from '../../piezas/MenuContextual';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, AccionesLote, CargarMas, InsigniaEstado, NumeroEnLinea } from '../../piezas/admin/Datos';
import { ElegirUno } from '../../piezas/admin/Formularios';
import { Campo } from '../../Formulario';
import { esDeLaTienda, piezasDeCombos, etiquetasDeProducto, estadoDeStock, normalizarBusqueda, textoSeBorra, DIAS_PAPELERA, borrablesDePapelera, restaurablesDePapelera } from '../../adaptadoresAdmin';
import { FotoCelda } from './celdas';
import l from './Lista.module.css';
import s from './Productos.module.css';

/*
 * Productos (D2a): la lista de /admin/productos (Tienda, Personalizables,
 * Packs de Crear y Todos), con el stock de cada uno (Inventario se unió aquí
 * el 2026-11-04), y los datos para recomendar regalos (/admin/publico-productos). Los productos llegan
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

/* ── El stock ──────────────────────────────────────────── */

const ESTADOS_STOCK = {
  agotado: { texto: 'Agotado', tono: 'peligro' },
  ultimas: { texto: 'Últimas unidades', tono: 'aviso' },
  disponible: { texto: 'Disponible', tono: 'exito' },
  sinLimite: { texto: 'Sin límite', tono: 'neutro' },
};
const FILTRO_STOCK = [
  { valor: 'agotado', texto: 'Agotados' },
  { valor: 'ultimas', texto: 'Últimas unidades' },
  { valor: 'disponible', texto: 'Disponibles' },
  { valor: 'sinLimite', texto: 'Sin límite' },
];
/* Para ordenar: sin límite va después de cualquier número. */
const stockParaOrden = (n) => (n === null || n === undefined ? Number.POSITIVE_INFINITY : n);

/*
 * El stock de una fila. Con onGuardar se cambia ahí mismo (se guarda solo un
 * segundo después de dejar de escribir, y queda en el historial); sin él,
 * solo se lee. Sin límite (sin número) no se cuenta como agotado: "Poner
 * stock" le pone uno.
 */
function StockCelda({ p, onGuardar }) {
  const [poner, setPoner] = useState(false);
  const estado = estadoDeStock(p.stock);
  const insignia = (estado === 'agotado' || estado === 'ultimas') && <InsigniaEstado estado={estado} estados={ESTADOS_STOCK} />;
  if (!onGuardar) {
    return (
      <span className={s.stock}>
        {p.stock === null ? <InsigniaEstado estado="sinLimite" estados={ESTADOS_STOCK} /> : <span className={l.numero}><span className={l.soloTarjeta}>Stock </span>{p.stock}</span>}
        {insignia}
      </span>
    );
  }
  if (p.stock === null && !poner) {
    return (
      <span className={s.stock}>
        <InsigniaEstado estado="sinLimite" estados={ESTADOS_STOCK} />
        <button type="button" className={s.ponerStock} onClick={() => setPoner(true)}>Poner stock</button>
      </span>
    );
  }
  return (
    <span className={s.stock}>
      <NumeroEnLinea
        valor={p.stock ?? 0}
        etiqueta={`Stock de ${p.nombre}`}
        // El primero desde "sin límite" se anota así, no como 0.
        onGuardar={(n, antes) => onGuardar(p, n, p.stock === null ? null : antes)}
      />
      {insignia}
    </span>
  );
}

const VISTAS = [
  { id: 'tienda', texto: 'Tienda' },
  { id: 'crear', texto: 'Personalizables' },
  { id: 'packs', texto: 'Packs de Crear' },
  { id: 'todos', texto: 'Todos' },
  { id: 'papelera', texto: 'Papelera' },
];

/*
 * Los chips de Tienda: Todos, Visibles y Ocultos miran solo si se ve en la
 * tienda (Visibles + Ocultos = Todos). "Piezas de combo" es aparte y se suma
 * al que esté elegido (Ocultos + Piezas = las piezas ocultas). Las cuentas
 * siguen a la búsqueda y a los filtros: dicen cuántos verías.
 */
const ESTADOS_LISTA = [
  { id: 'todos', texto: 'Todos' },
  { id: 'visibles', texto: 'Visibles' },
  { id: 'ocultos', texto: 'Ocultos' },
];

/**
 * La lista de productos.
 *  - productos: todos (productoAdminDesde; sin archivados) · categorias: [{ id, nombre }] · marcas: [{ id, nombre }]
 *  - cargando · error · onReintentar
 *  - vista ('tienda' | 'crear' | 'packs' | 'todos') + onVista (en el admin, ?ver=) ·
 *    personalizables / packs: lo que va en esas pestañas (D2c); sin él, un aviso
 *  - onAbrir(producto) (su ficha) · onIr(url) (el menú "Crear otro") · urlNuevo · urlNuevoPersonalizable · urlNuevoPack
 *  - onVisible(id, visible) → promesa · onVarios(ids, visible) → promesa con { ok, fallaron }
 *  - onArchivar(ids) → promesa con { ok, fallaron }: los manda a la papelera · onDuplicar(producto) → promesa
 *  - papelera: papeleraDesde (adaptadoresAdmin) · onRestaurar(ids) / onBorrarParaSiempre(ids) → promesa con { ok, fallaron }
 *    (sin papelera, no sale la pestaña)
 *  - usos: Map id → [{ nombre, enPapelera, premio }] (usosDeProductos): al mandar a la
 *    papelera, avisa qué combos, packs o premios lo usan
 *  - onExportar(ids | null) (CSV) · onQuitarPersonalizacionVieja(ids) → promesa con { ok, fallaron }
 *  - cuentas: { crear, packs } (sin ellas, se cuentan de `productos`)
 *  - borradores: [{ id, nombre, fecha }] (los guardados en este aparato) · urlBorrador(id) · onDescartarBorrador(id) → promesa
 *  - colecciones · tipos ([{ id, nombre }]): filtros, como el de stock
 *  - onGuardarStock(producto, nuevo, anterior) → promesa: el stock se cambia
 *    en la fila (en Tienda y en Todos); anterior es null si no tenía límite
 *  - urlHistorial: "Historial de stock" (los cambios anotados)
 *  - soloStock: quien solo tiene permiso de inventario: la lista y el stock,
 *    sin crear, editar, ocultar ni archivar
 */
export function PaginaProductos({
  productos = [], categorias = [], marcas = [], cargando, error, onReintentar,
  vista = 'tienda', onVista, personalizables, packs,
  onAbrir, onIr, urlNuevo = '/admin/productos/nuevo', urlNuevoPersonalizable = '/admin/prendas-crear/nueva', urlNuevoPack = '/admin/productos?ver=packs&nuevo=1',
  onVisible, onVarios, onArchivar, onDuplicar, onExportar, onQuitarPersonalizacionVieja,
  borradores = [], urlBorrador, onDescartarBorrador, cuentas: cuentasCrear,
  colecciones = [], tipos = [], onGuardarStock, urlHistorial, soloStock = false,
  papelera, onRestaurar, onBorrarParaSiempre, usos,
}) {
  const toast = useToast();
  const [estado, setEstado] = useState('todos');
  const [soloPiezas, setSoloPiezas] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState({ categoria: '', marca: '', coleccion: '', tipo: '', stock: '' });
  const [orden, setOrden] = useState({ por: 'nombre', dir: 'asc' });
  const [elegidos, setElegidos] = useState([]);
  const [visibles, setVisibles] = useState(PASO);
  const [cambios, setCambios] = useState({}); // visibilidad mientras se guarda (o hasta que llegue la lista)
  const [pregunta, setPregunta] = useState(null); // { tipo, ids }
  const [menuNuevo, setMenuNuevo] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [stockLocal, setStockLocal] = useState({}); // lo guardado aquí, hasta que llegue la lista
  // El orden y el filtro de stock usan el stock con que llegó cada producto:
  // si no, al guardar la fila se movería (o se iría) bajo el dedo.
  const stockInicial = useRef(new Map());
  productos.forEach((p) => { if (!stockInicial.current.has(p.id)) stockInicial.current.set(p.id, p.stock); });
  const inicial = (p) => (stockInicial.current.has(p.id) ? stockInicial.current.get(p.id) : p.stock);

  const porCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);
  const conCambios = useMemo(() => productos.map((p) => {
    let x = p;
    if (p.id in cambios) x = { ...x, oculto: !cambios[p.id] };
    if (p.id in stockLocal) x = { ...x, stock: stockLocal[p.id] };
    return x;
  }), [productos, cambios, stockLocal]);
  const tienda = useMemo(() => conCambios.filter(esDeLaTienda), [conCambios]);
  const piezas = useMemo(() => piezasDeCombos(tienda), [tienda]);
  const enEstado = (p, e) => (e === 'visibles' ? !p.oculto : e === 'ocultos' ? p.oculto : true);
  const enElegidos = (p) => enEstado(p, estado) && (!soloPiezas || piezas.has(p.id));
  const deCrear = cuentasCrear || { crear: productos.filter((p) => p.personalizable).length, packs: productos.filter((p) => p.pack).length };
  const viejos = tienda.filter((p) => p.personalizacionVieja);

  const q = normalizarBusqueda(buscar);
  const coincide = (p) => !q || normalizarBusqueda(`${p.nombre} ${nombresDe(p.categorias, porCategoria).join(' ')} ${p.precio}`).includes(q);
  const base = useMemo(() => (vista === 'todos' ? conCambios : tienda.filter(enElegidos)), [vista, conCambios, tienda, estado, soloPiezas, piezas]); // eslint-disable-line react-hooks/exhaustive-deps
  const pasaFiltros = (p) => coincide(p)
    && (!filtro.categoria || p.categorias.includes(filtro.categoria))
    && (!filtro.marca || (filtro.marca === '__sin' ? !p.marcaId : p.marcaId === filtro.marca))
    && (!filtro.coleccion || (p.colecciones || []).includes(filtro.coleccion))
    && (!filtro.tipo || p.tipo === filtro.tipo)
    && (!filtro.stock || estadoDeStock(inicial(p)) === filtro.stock);
  // Los de la tienda que pasan la búsqueda y los filtros: de ahí salen las cuentas de los chips.
  const tiendaFiltrada = useMemo(() => tienda.filter(pasaFiltros), [tienda, q, filtro]); // eslint-disable-line react-hooks/exhaustive-deps
  // Cada chip cuenta lo que verías al tocarlo (con Piezas de combo, solo las piezas).
  const cuentas = Object.fromEntries(ESTADOS_LISTA.map((e) => [e.id, tiendaFiltrada.filter((p) => enEstado(p, e.id) && (!soloPiezas || piezas.has(p.id))).length]));
  cuentas.piezas = tiendaFiltrada.filter((p) => enEstado(p, estado) && piezas.has(p.id)).length;
  const filas = useMemo(() => {
    const lista = vista === 'todos' ? conCambios.filter(pasaFiltros) : tiendaFiltrada.filter(enElegidos);
    const signo = orden.dir === 'desc' ? -1 : 1;
    const cmp = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      precio: (a, b) => a.precio - b.precio,
      stock: (a, b) => stockParaOrden(inicial(a)) - stockParaOrden(inicial(b)),
    }[orden.por] || (() => 0);
    return [...lista].sort((a, b) => signo * (cmp(a, b) || 0) || a.nombre.localeCompare(b.nombre, 'es'));
  }, [vista, conCambios, tiendaFiltrada, estado, soloPiezas, q, filtro, orden]); // eslint-disable-line react-hooks/exhaustive-deps
  // Los agotados de lo que se ve (sin contar los sin límite): el aviso los lleva al filtro.
  const agotados = base.filter((p) => p.stock !== null && p.stock <= 0).length;
  const guardarStock = onGuardarStock && (async (p, n, antes) => {
    await onGuardarStock(p, n, antes);
    setStockLocal((m) => ({ ...m, [p.id]: n }));
  });

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
      if (tipo === 'archivar') { resultado(await onArchivar(ids), 'en la papelera', ids.length); setElegidos([]); }
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
    { id: 'stock', titulo: 'Stock', ordenable: true, ancho: 170, alinear: 'fin', tarjeta: guardarStock ? 'control' : 'detalle', celda: (p) => <StockCelda p={p} onGuardar={guardarStock} /> },
  ] : [
    { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagen} /> },
    { id: 'nombre', titulo: 'Producto', ordenable: true, tarjeta: 'titulo', celda: (p) => <>{p.nombre}<Marcas p={p} pieza={piezas.has(p.id)} /></> },
    { id: 'categoria', titulo: 'Categoría', tarjeta: 'detalle', celda: (p) => nombresDe(p.categorias, porCategoria).join(', ') || <span className={l.sub}>Sin categoría</span> },
    { id: 'precio', titulo: 'Precio', ordenable: true, ancho: 120, alinear: 'fin', tarjeta: 'detalle', celda: (p) => <Precio p={p} /> },
    { id: 'stock', titulo: 'Stock', ordenable: true, ancho: guardarStock ? 170 : 90, alinear: 'fin', tarjeta: guardarStock ? 'control' : 'detalle', celda: (p) => <StockCelda p={p} onGuardar={guardarStock} /> },
    {
      id: 'estado',
      titulo: 'En la tienda',
      ancho: 150,
      // Es un botón: en la tarjeta va abajo, no dentro del botón de la tarjeta.
      tarjeta: 'control',
      celda: (p) => (soloStock ? <InsigniaEstado estado={p.oculto ? 'oculto' : 'activo'}>{p.oculto ? 'Oculto' : 'Visible'}</InsigniaEstado> : (
        <button type="button" className={s.visible} onClick={() => alternarVisible(p)} aria-pressed={!p.oculto} title={p.oculto ? 'Mostrar en la tienda' : 'Ocultar de la tienda'}>
          {p.oculto ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          <InsigniaEstado estado={p.oculto ? 'oculto' : 'activo'}>{p.oculto ? 'Oculto' : 'Visible'}</InsigniaEstado>
        </button>
      )),
    },
  ];

  const enTienda = vista === 'tienda';
  const enLista = vista === 'tienda' || vista === 'todos';

  return (
    <div data-componente="PaginaProductos">
      <CabezaAdmin
        icono="productos"
        titulo="Productos"
        subtitulo={soloStock
          ? 'El stock de cada producto. Cambia el número y se guarda solo; cada cambio queda en el historial.'
          : 'Lo que se vende en la tienda y su stock. Los personalizables y los packs de Crear tienen su pestaña.'}
        acciones={(
          <>
            {urlHistorial && <Boton variante="secundario" icono={<History aria-hidden="true" />} to={urlHistorial}>Historial de stock</Boton>}
            {enTienda && !soloStock && onExportar && <Boton variante="secundario" icono={<Download aria-hidden="true" />} onClick={() => exportar(null)}>Exportar CSV</Boton>}
            {!soloStock && (
            <Boton
              variante="secundario"
              icono={<MoreHorizontal aria-hidden="true" />}
              aria-haspopup="menu"
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuNuevo({ x: r.left, y: r.bottom + 6 }); }}
            >
              Crear otro
            </Boton>
            )}
          </>
        )}
        principal={soloStock ? undefined : { texto: 'Nuevo producto', Icono: Plus, to: urlNuevo }}
      />

      <div className={`${s.vistas} ${l.desliza}`}>
        <Pestanas
          opciones={VISTAS.filter((v) => (soloStock ? v.id === 'tienda' || v.id === 'todos' : v.id !== 'papelera' || papelera)).map((v) => ({ ...v, texto: v.id === 'tienda' ? `${v.texto} · ${tienda.length}` : v.id === 'papelera' ? `${v.texto} · ${papelera.length}` : deCrear[v.id] !== undefined ? `${v.texto} · ${deCrear[v.id]}` : v.texto }))}
          valor={vista}
          onChange={(v) => { reiniciar(); onVista?.(v); }}
          etiqueta="Qué productos"
        />
      </div>

      {vista === 'crear' && (personalizables || <Pronto texto="Los personalizables de Crear se arman en el tramo D2c." />)}
      {vista === 'packs' && (packs || <Pronto texto="Los packs de Crear se arman en el tramo D2c." />)}
      {vista === 'papelera' && papelera && !soloStock && (
        <PapeleraProductos papelera={papelera} cargando={cargando} error={error} onReintentar={onReintentar} onRestaurar={onRestaurar} onBorrar={onBorrarParaSiempre} />
      )}

      {enLista && (
        <>
          {enTienda && !soloStock && borradores.length > 0 && (
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

          {enTienda && !soloStock && viejos.length > 0 && onQuitarPersonalizacionVieja && (
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

          {!cargando && !error && agotados > 0 && filtro.stock !== 'agotado' && (
            <div className={s.aviso}>
              <Aviso
                tipo="aviso"
                titulo={agotados === 1 ? 'Un producto está agotado' : `${agotados} productos están agotados`}
                accion={<Boton tamano="sm" variante="contorno" onClick={() => { setFiltro((f) => ({ ...f, stock: 'agotado' })); reiniciar(); }}>Verlos</Boton>}
              >
                Con stock 0 no se pueden comprar. Los que no tienen límite no cuentan.
              </Aviso>
            </div>
          )}

          {enTienda && (
            <div className={`${s.estados} ${l.desliza}`} role="group" aria-label="Cuáles">
              {ESTADOS_LISTA.map((e) => (
                <Chip key={e.id} tamano="sm" activo={estado === e.id} cuenta={cargando ? undefined : cuentas[e.id]} onClick={() => { setEstado(e.id); reiniciar(); }}>{e.texto}</Chip>
              ))}
              {/* Aparte: se suma al de antes (las piezas visibles, ocultas o todas). */}
              <span className={s.separadorChips} aria-hidden="true" />
              <Chip tamano="sm" activo={soloPiezas} cuenta={cargando ? undefined : cuentas.piezas} onClick={() => { setSoloPiezas((v) => !v); reiniciar(); }}>Piezas de combo</Chip>
            </div>
          )}

          <BarraFiltros
            busqueda={buscar}
            onBusqueda={(t) => { setBuscar(t); reiniciar(); }}
            placeholder="Buscar por nombre, categoría o precio"
            filtros={[
              { id: 'categoria', etiqueta: 'Categoría', todos: 'Todas las categorías', valor: filtro.categoria, opciones: categorias.map((c) => ({ valor: c.id, texto: c.nombre })) },
              { id: 'marca', etiqueta: 'Marca', todos: 'Todas las marcas', valor: filtro.marca, opciones: [...marcas.map((m) => ({ valor: m.id, texto: m.nombre })), { valor: '__sin', texto: 'Sin marca' }] },
              { id: 'stock', etiqueta: 'Stock', todos: 'Todo el stock', valor: filtro.stock, opciones: FILTRO_STOCK },
              ...(colecciones.length ? [{ id: 'coleccion', etiqueta: 'Colección', todos: 'Todas las colecciones', valor: filtro.coleccion, opciones: colecciones.map((c) => ({ valor: c.id, texto: c.nombre })) }] : []),
              ...(tipos.length ? [{ id: 'tipo', etiqueta: 'Tipo', todos: 'Todos los tipos', valor: filtro.tipo, opciones: tipos.map((t) => ({ valor: t.id, texto: t.nombre })) }] : []),
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
            onFila={soloStock ? undefined : onAbrir}
            seleccion={enTienda && !soloStock ? elegidos : undefined}
            onSeleccion={enTienda && !soloStock ? setElegidos : undefined}
            vacio={q || filtro.categoria || filtro.marca || filtro.coleccion || filtro.tipo || filtro.stock
              ? { titulo: 'Ningún producto coincide', texto: 'Prueba con otra palabra o quita los filtros.' }
              : estado === 'ocultos' ? { titulo: soloPiezas ? 'No hay piezas de combo ocultas' : 'No hay productos ocultos', icono: <Eye aria-hidden="true" /> }
                : { titulo: 'Todavía no hay productos', accion: <Boton to={urlNuevo} icono={<Plus aria-hidden="true" />}>Nuevo producto</Boton> }}
            acciones={soloStock ? undefined : (p) => (vista === 'todos' ? [
              { id: 'abrir', etiqueta: 'Abrir su ficha', Icono: Pencil, accion: () => onAbrir?.(p) },
            ] : [
              { id: 'editar', etiqueta: 'Editar', Icono: Pencil, accion: () => onAbrir?.(p) },
              { id: 'visible', etiqueta: p.oculto ? 'Mostrar en la tienda' : 'Ocultar de la tienda', Icono: p.oculto ? Eye : EyeOff, accion: () => alternarVisible(p) },
              ...(onDuplicar ? [{ id: 'duplicar', etiqueta: 'Duplicar', Icono: Copy, accion: () => duplicar(p) }] : []),
              ...(onArchivar ? ['separador', { id: 'archivar', etiqueta: 'Mover a la papelera', Icono: Trash2, peligro: true, accion: () => setPregunta({ tipo: 'archivar', ids: [p.id], nombre: p.nombre }) }] : []),
            ])}
          />
          <CargarMas visibles={Math.min(visibles, filas.length)} total={filas.length} onMas={() => setVisibles((v) => v + PASO)} paso={PASO} unidad={['producto', 'productos']} />

          {enTienda && !soloStock && (
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
                ...(onArchivar ? [{ id: 'archivar', texto: 'Papelera', Icono: Trash2, peligro: true, onClick: () => setPregunta({ tipo: 'archivar', ids: elegidos }) }] : []),
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
        {pregunta?.tipo === 'archivar' && (() => {
          const lista = pregunta.ids.flatMap((id) => (usos?.get(id) || []).filter((u) => !u.enPapelera).map((u) => ({ de: productos.find((x) => x.id === id)?.nombre || id, ...u })));
          return lista.length > 0 && (
            <Aviso tipo="aviso" compacto titulo={lista.length === 1 ? 'Algo lo usa' : `${lista.length} cosas lo usan`}>
              {lista.slice(0, 6).map((u) => `${u.premio ? u.nombre : `«${u.nombre}»`}${pregunta.ids.length > 1 ? ` (usa «${u.de}»)` : ''}`).join(' · ')}{lista.length > 6 ? ` y ${lista.length - 6} más` : ''}. Mientras esté en la papelera, eso no se puede comprar ni canjear; cámbialo o restáuralo.
            </Aviso>
          );
        })()}
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

/* ── La papelera ───────────────────────────────────────── */

const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const QUE_ERA = ['Tienda', 'Combo', 'Personalizable', 'Pack de Crear'];

/*
 * Lo que se mandó a la papelera: no se ve en la tienda, se restaura como
 * estaba o se borra para siempre (solo el producto: las fotos quedan, porque
 * los pedidos las muestran). Se borra solo a los DIAS_PAPELERA días. Lo que
 * otro producto usa (la pieza de un combo) no se deja borrar.
 */
function PapeleraProductos({ papelera = [], cargando, error, onReintentar, onRestaurar, onBorrar }) {
  const toast = useToast();
  const [buscar, setBuscar] = useState('');
  const [que, setQue] = useState('');
  const [orden, setOrden] = useState({ por: 'seBorra', dir: 'asc' });
  const [elegidos, setElegidos] = useState([]);
  const [visibles, setVisibles] = useState(PASO);
  const [pregunta, setPregunta] = useState(null); // { tipo: 'restaurar' | 'borrar' | 'vaciar', ids, nombre }
  const [trabajando, setTrabajando] = useState(false);
  const [idos, setIdos] = useState([]); // restaurados o borrados aquí, hasta que llegue la lista

  const lista = papelera.filter((p) => !idos.includes(p.id));
  // Se borra lo que nadie usa, o lo que solo usan otros que también se borran.
  const borrables = borrablesDePapelera(lista, lista.map((p) => p.id)).map((id) => lista.find((p) => p.id === id));
  const sePuedeBorrar = (p) => borrablesDePapelera(lista, [p.id]).length > 0;
  const deLaPapelera = (p) => (p.usos || []).filter((u) => u.enPapelera).map((u) => u.nombre);
  const q = normalizarBusqueda(buscar);
  const filas = lista
    .filter((p) => (!q || normalizarBusqueda(p.nombre).includes(q)) && (!que || p.que === que))
    .sort((a, b) => {
      const signo = orden.dir === 'desc' ? -1 : 1;
      const cmp = orden.por === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es') : orden.por === 'seFue' ? (a.seFue || 0) - (b.seFue || 0) : a.seBorra - b.seBorra;
      return signo * cmp || a.nombre.localeCompare(b.nombre, 'es');
    });
  const porId = new Map(lista.map((p) => [p.id, p]));

  const confirmar = async () => {
    const { tipo } = pregunta;
    // Restaurar trae sus piezas de la papelera; borrar deja lo que usa algo que se queda.
    const ids = tipo === 'restaurar' ? restaurablesDePapelera(lista, pregunta.ids) : borrablesDePapelera(lista, pregunta.ids);
    setTrabajando(true);
    try {
      const r = (await (tipo === 'restaurar' ? onRestaurar : onBorrar)?.(ids)) || {};
      const ok = r.ok ?? ids.length;
      const fallaron = r.fallaron ?? 0;
      if (!fallaron) setIdos((x) => [...x, ...ids]);
      setElegidos([]);
      const saltados = tipo === 'restaurar' ? 0 : pregunta.ids.length - ids.length;
      const extra = tipo === 'restaurar' ? ids.length - pregunta.ids.length : 0;
      toast({
        tipo: fallaron ? 'aviso' : 'exito',
        titulo: tipo === 'restaurar' ? `${ok} ${ok === 1 ? 'producto restaurado' : 'productos restaurados'}` : `${ok} ${ok === 1 ? 'producto borrado' : 'productos borrados'} para siempre`,
        texto: fallaron ? `${fallaron} no se pudieron: vuelve a intentar con esos.`
          : saltados ? `${saltados} no se borr${saltados === 1 ? 'ó' : 'aron'}: ${saltados === 1 ? 'lo usa' : 'los usa'} algo que se queda.`
            : extra ? `Con ${extra === 1 ? 'su pieza' : `sus ${extra} piezas`} de la papelera.` : undefined,
      });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setTrabajando(false);
      setPregunta(null);
    }
  };

  const n = pregunta?.ids.length || 0;
  const cuales = pregunta?.nombre ? `«${pregunta.nombre}»` : `${n} producto${n === 1 ? '' : 's'}`;
  const conPiezas = pregunta?.tipo === 'restaurar' ? restaurablesDePapelera(lista, pregunta.ids).filter((id) => !pregunta.ids.includes(id)).map((id) => porId.get(id)?.nombre) : [];
  const textos = !pregunta ? {} : pregunta.tipo === 'restaurar'
    ? { titulo: `¿Restaurar ${cuales}?`, texto: `Vuelven a Productos como estaban: los que se veían en la tienda, visibles; los demás, ocultos.${conPiezas.length ? ` También vuelve${conPiezas.length === 1 ? '' : 'n'} ${conPiezas.length === 1 ? 'su pieza' : 'sus piezas'}: ${conPiezas.slice(0, 4).join(', ')}${conPiezas.length > 4 ? '…' : ''}.` : ''}`, confirmar: 'Restaurar' }
    : pregunta.tipo === 'vaciar'
      ? { titulo: '¿Vaciar la papelera?', texto: `${borrables.length === 1 ? 'Se borra para siempre el producto que hay' : `Se borran para siempre los ${borrables.length} productos`}${lista.length > borrables.length ? ' (menos los que usa otro producto, que se quedan)' : ''}. No se puede deshacer. Los pedidos que ${borrables.length === 1 ? 'lo tienen siguen con su nombre' : 'los tienen siguen con sus nombres'} y su foto.`, confirmar: 'Vaciar la papelera' }
      : { titulo: `¿Borrar ${cuales} para siempre?`, texto: 'No se puede deshacer. Los pedidos que los tienen siguen con su nombre y su foto.', confirmar: 'Borrar para siempre' };

  return (
    <>
      <div className={s.aviso}>
        <Aviso
          tipo="info"
          icono={<Trash2 aria-hidden="true" />}
          titulo={`Lo que está aquí no se ve en la tienda y se borra solo a los ${DIAS_PAPELERA} días`}
          accion={onBorrar && borrables.length > 0 ? <Boton tamano="sm" variante="contorno" icono={<Trash2 aria-hidden="true" />} onClick={() => setPregunta({ tipo: 'vaciar', ids: borrables.map((p) => p.id) })}>Vaciar la papelera</Boton> : undefined}
        >
          Antes de eso lo puedes restaurar (un combo vuelve con sus piezas), o borrarlo ya. Lo que usa un producto o un premio que se queda no se borra; si solo lo usa algo de aquí, se va con eso.
        </Aviso>
      </div>
      <BarraFiltros
        busqueda={buscar}
        onBusqueda={(t) => { setBuscar(t); setVisibles(PASO); }}
        placeholder="Buscar en la papelera"
        filtros={[{ id: 'que', etiqueta: 'Qué era', todos: 'Todo', valor: que, opciones: QUE_ERA.filter((x) => lista.some((p) => p.que === x)).map((x) => ({ valor: x, texto: x })) }]}
        onFiltro={(_id, v) => { setQue(v); setVisibles(PASO); }}
        total={cargando || error ? undefined : filas.length}
        unidad={['producto', 'productos']}
      />
      <TablaAdmin
        etiqueta="Papelera"
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagen} /> },
          {
            id: 'nombre', titulo: 'Producto', ordenable: true, tarjeta: 'titulo',
            celda: (p) => {
              const enPapelera = deLaPapelera(p);
              return <>{p.nombre}<span className={l.sub}>{p.que}{p.usadoPor.length ? ` · lo usa ${p.usadoPor.slice(0, 2).join(', ')}${p.usadoPor.length > 2 ? '…' : ''}` : enPapelera.length ? ` · va con ${enPapelera.slice(0, 2).join(', ')}` : ''}</span></>;
            },
          },
          { id: 'seFue', titulo: 'Se fue', ordenable: true, ancho: 140, tarjeta: 'detalle', celda: (p) => fechaCorta(p.seFue) },
          { id: 'seBorra', titulo: 'Se borra', ordenable: true, ancho: 130, tarjeta: 'estado', celda: (p) => (p.usadoPor.length ? <Etiqueta tono="neutro">En uso</Etiqueta> : <Etiqueta tono={p.dias <= 3 ? 'peligro' : 'neutro'}>{textoSeBorra(p.dias)}</Etiqueta>) },
        ]}
        filas={filas.slice(0, visibles)}
        nombreDe={(p) => p.nombre}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        orden={orden}
        onOrden={setOrden}
        seleccion={elegidos}
        onSeleccion={setElegidos}
        vacio={q || que
          ? { titulo: 'Nada coincide', texto: 'Prueba con otra palabra o quita el filtro.' }
          : { titulo: 'La papelera está vacía', texto: 'Lo que mandes a la papelera desde Productos aparece aquí.', icono: <Trash2 aria-hidden="true" /> }}
        acciones={(p) => [
          ...(onRestaurar ? [{ id: 'restaurar', etiqueta: 'Restaurar', Icono: RotateCcw, accion: () => setPregunta({ tipo: 'restaurar', ids: [p.id], nombre: p.nombre }) }] : []),
          ...(onBorrar && sePuedeBorrar(p) ? ['separador', { id: 'borrar', etiqueta: 'Borrar para siempre', Icono: Trash2, peligro: true, accion: () => setPregunta({ tipo: 'borrar', ids: [p.id], nombre: p.nombre }) }] : []),
        ]}
      />
      <CargarMas visibles={Math.min(visibles, filas.length)} total={filas.length} onMas={() => setVisibles((v) => v + PASO)} paso={PASO} unidad={['producto', 'productos']} />
      <AccionesLote
        cantidad={elegidos.length}
        unidad={['elegido', 'elegidos']}
        onLimpiar={() => setElegidos([])}
        acciones={[
          ...(onRestaurar ? [{ id: 'restaurar', texto: 'Restaurar', Icono: RotateCcw, onClick: () => setPregunta({ tipo: 'restaurar', ids: elegidos }) }] : []),
          ...(onBorrar ? [{ id: 'borrar', texto: 'Borrar', Icono: Trash2, peligro: true, onClick: () => setPregunta({ tipo: 'borrar', ids: elegidos }) }] : []),
        ]}
      />
      <Confirmar
        abierta={Boolean(pregunta)}
        titulo={textos.titulo}
        texto={textos.texto}
        confirmar={textos.confirmar}
        peligro={pregunta?.tipo !== 'restaurar'}
        onConfirmar={confirmar}
        onCancelar={() => !trabajando && setPregunta(null)}
      />
    </>
  );
}

function textoPregunta(p) {
  if (!p) return {};
  const n = p.ids.length;
  const cuales = p.nombre ? `«${p.nombre}»` : `${n} producto${n === 1 ? '' : 's'}`;
  if (p.tipo === 'archivar') return { titulo: `¿Mover ${cuales} a la papelera?`, texto: n === 1 ? `Deja de verse en la tienda. Desde Papelera se restaura durante ${DIAS_PAPELERA} días; después se borra solo. Los pedidos que lo tienen no cambian.` : `Dejan de verse en la tienda. Desde Papelera se restauran durante ${DIAS_PAPELERA} días; después se borran solos. Los pedidos que los tienen no cambian.`, confirmar: 'Mover a la papelera' };
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

/*
 * El equipo: la lista del kit (ListaOpciones, no la del navegador, que en
 * cada uno se veía distinta): buscar entre los conocidos o, si no está,
 * "Usar «…»" con lo escrito. Se guarda al elegir; "Ninguno" lo quita y
 * "Usar" toma la sugerencia.
 */
function CampoEquipo({ p, sugerido, equipos, onGuardar }) {
  const opciones = useMemo(() => {
    const nombres = [...new Set([...equipos, ...(p.equipo ? [p.equipo] : [])])].sort((a, b) => a.localeCompare(b, 'es'));
    return [{ valor: '', texto: 'Ninguno' }, ...nombres.map((e) => ({ valor: e, texto: e }))];
  }, [equipos, p.equipo]);
  const guardar = (v) => { const t = String(v || '').trim(); if (t !== (p.equipo || '')) onGuardar({ equipo: t || null }); };
  return (
    <span className={s.equipo}>
      <span className={s.equipoCampo}>
        <Campo
          opciones={opciones}
          buscable
          creable
          value={p.equipo || ''}
          placeholder={sugerido || 'Ninguno'}
          aria-label={`Equipo de ${p.nombre}`}
          onChange={(e) => guardar(e.target.value)}
        />
      </span>
      {!p.equipo && sugerido && <button type="button" className={s.usar} onClick={() => guardar(sugerido)}>Usar</button>}
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
 *    (las dos pueden devolver { ok, fallaron }: el aviso dice lo que se guardó)
 *  - "Aceptar sugerencias" solo con algo que sugerir (lo punteado que falta);
 *    sin nada, un aviso dice por qué (el nombre no dice para quién es)
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
  // Lo punteado que falta en cada uno: lo que guardaría "Aceptar sugerencias".
  const sugeridoDe = (p) => {
    const sug = sugerenciaDe(p) || {};
    return {
      ...(!p.publico && sug.publico ? { publico: sug.publico } : {}),
      ...(p.edadMinima == null && sug.edadMinima != null ? { edadMinima: sug.edadMinima } : {}),
      ...(!p.equipo && sug.equipo ? { equipo: sug.equipo } : {}),
    };
  };
  const conSugerencia = filas.filter((p) => Object.keys(sugeridoDe(p)).length);
  const avisoGuardado = (res, total, titulo, texto) => {
    const ok = res && Number.isFinite(res.ok) ? res.ok : total;
    const fallaron = res && Number.isFinite(res.fallaron) ? res.fallaron : 0;
    toast(fallaron
      ? { tipo: 'aviso', titulo: `${ok} guardados; ${fallaron} no se pudieron`, texto: 'Vuelve a intentar con los que faltan.' }
      : { tipo: 'exito', titulo: titulo(ok), texto });
  };
  const confirmar = async () => {
    try {
      if (pregunta.tipo === 'sugerencias') {
        const ids = conSugerencia.map((p) => p.id);
        const res = await onAceptarSugerencias?.(ids);
        setLocales((m) => ({ ...m, ...Object.fromEntries(conSugerencia.map((p) => [p.id, { ...(m[p.id] || {}), ...sugeridoDe(p) }])) }));
        avisoGuardado(res, ids.length, (n) => `${n} ${n === 1 ? 'sugerencia guardada' : 'sugerencias guardadas'}`, 'Lo que ya estaba puesto no cambió.');
      } else {
        const ids = filas.map((p) => p.id);
        const res = await onMarcarTodos?.(ids, pregunta.publico);
        setLocales((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, { ...(m[id] || {}), publico: pregunta.publico }])) }));
        avisoGuardado(res, ids.length, (n) => `${n} ${n === 1 ? 'producto marcado' : 'productos marcados'}`, PUBLICOS.find((x) => x.valor === pregunta.publico)?.texto);
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
          {onAceptarSugerencias && filtro === 'faltan' && (conSugerencia.length
            ? <Boton tamano="sm" variante="secundario" icono={<Sparkles aria-hidden="true" />} onClick={() => setPregunta({ tipo: 'sugerencias' })}>Aceptar {conSugerencia.length === 1 ? 'la sugerencia' : `${conSugerencia.length} sugerencias`}</Boton>
            : <p className={s.sinSugerencias}>Para estos no hay sugerencias: su nombre no dice para quién es. Elígelo en cada uno o márcalos todos juntos.</p>)}
          {onMarcarTodos && (
            <p className={s.marcarTodos}>
              Marcar los {filas.length} como:
              {PUBLICOS.map((x) => <button key={x.valor} type="button" onClick={() => setPregunta({ tipo: 'todos', publico: x.valor })}>{x.texto}</button>)}
            </p>
          )}
        </div>
      )}
      <TablaAdmin
        etiqueta="Datos para recomendar"
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 64, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.imagen} /> },
          { id: 'nombre', titulo: 'Producto', tarjeta: 'titulo', celda: (p) => <>{p.nombre}<span className={l.sub}>{nombresDe(p.categorias, porCategoria).join(', ')}{p.oculto ? ' · oculto' : ''}</span></> },
          { id: 'publico', titulo: 'Para quién', tarjeta: 'control', celda: (p) => <ElegirUno etiqueta={`Para quién es ${p.nombre}`} opciones={PUBLICOS} valor={p.publico} sugerido={(sugerenciaDe(p) || {}).publico} onElegir={(v) => guardar(p, { publico: v })} /> },
          { id: 'edad', titulo: 'Edad', tarjeta: 'control', celda: (p) => <ElegirUno etiqueta={`Edad para ${p.nombre}`} opciones={EDADES} valor={p.edadMinima} sugerido={(sugerenciaDe(p) || {}).edadMinima} onElegir={(v) => guardar(p, { edadMinima: v })} /> },
          { id: 'equipo', titulo: 'Equipo', ancho: 210, tarjeta: 'control', celda: (p) => <CampoEquipo key={`${p.id}-${p.equipo}`} p={p} sugerido={(sugerenciaDe(p) || {}).equipo} equipos={equipos} onGuardar={(c) => guardar(p, c)} /> },
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
        titulo={pregunta?.tipo === 'sugerencias' ? `¿Guardar las sugerencias de ${conSugerencia.length} ${conSugerencia.length === 1 ? 'producto' : 'productos'}?` : `¿Marcar los ${filas.length} como «${PUBLICOS.find((x) => x.valor === pregunta?.publico)?.texto}»?`}
        texto={pregunta?.tipo === 'sugerencias' ? 'Se guarda lo punteado que falta en cada uno. Lo que ya está puesto no cambia.' : 'Se cambia «Para quién» en todos los de la lista, también los que ya lo tenían.'}
        confirmar="Guardar"
        onConfirmar={confirmar}
        onCancelar={() => setPregunta(null)}
      />
    </div>
  );
}
