import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Pencil, Plus, Send, Sparkles, Trash2, Undo2 } from 'lucide-react';
import Boton from '../../Boton';
import { Confirmar, HojaInferior, useToast } from '../../Feedback';
import { Campo, Casilla, Interruptor } from '../../Formulario';
import { Chip, Etiqueta } from '../../Etiquetas';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, InsigniaEstado } from '../../piezas/admin/Datos';
import { HojaEdicion, GrupoCampos, CampoImagen, CampoDinero, ElegirUno } from '../../piezas/admin/Formularios';
import { ElegirMarca } from '../../piezas/admin/Producto';
import { MODOS_TALLA_PACK, MIN_PIEZAS_PACK, MAX_PIEZAS_PACK, erroresDePack, normalizarBusqueda } from '../../adaptadoresAdmin';
import { FotoCelda } from './celdas';
import l from './Lista.module.css';
import s from './Crear.module.css';

/*
 * Crear en el admin (D2c): la lista de personalizables (las prendas que se
 * diseñan en Crear) y los packs (pareja, trío… de prendas de Crear, con
 * piezas que pueden ir tal cual). La ficha de un personalizable es
 * PaginaFichaProducto con `modo="prenda"`. Datos por props
 * (personalizableDesde, packDesdeFirestore); guardar y archivar son promesas.
 */

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const FILTROS_PUBLICADO = [
  { id: 'todos', texto: 'Todos' },
  { id: 'publicados', texto: 'Publicados' },
  { id: 'borradores', texto: 'Borradores' },
];

/* ── Personalizables ───────────────────────────────────── */

/**
 * La lista de personalizables (en Productos, la pestaña "Personalizables").
 *  - prendas: [personalizableDesde] · cargando · error · onReintentar
 *  - onAbrir(prenda) (su ficha) · onVer(prenda) (en Crear) · urlNueva
 *  - onPublicar(id, publicada) → promesa · onArchivar(id) → promesa
 *  - embebido: sin su cabecera (va dentro de Productos)
 */
export function PaginaPersonalizables({ prendas = [], cargando, error, onReintentar, onAbrir, onVer, urlNueva = '/admin/prendas-crear/nueva', onPublicar, onArchivar, embebido = false }) {
  const toast = useToast();
  const [filtro, setFiltro] = useState('todos');
  const [buscar, setBuscar] = useState('');
  const [cambios, setCambios] = useState({});
  const [archivar, setArchivar] = useState(null);

  const lista = prendas.map((p) => (p.id in cambios ? { ...p, publicada: cambios[p.id] } : p));
  const cuentas = { todos: lista.length, publicados: lista.filter((p) => p.publicada).length, borradores: lista.filter((p) => !p.publicada).length };
  const q = normalizarBusqueda(buscar);
  const filas = lista.filter((p) => (filtro === 'todos' || (filtro === 'publicados') === p.publicada) && (!q || normalizarBusqueda(p.nombre).includes(q)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const publicar = async (p) => {
    const nueva = !p.publicada;
    setCambios((c) => ({ ...c, [p.id]: nueva }));
    try {
      await onPublicar?.(p.id, nueva);
      toast({ tipo: 'exito', titulo: nueva ? 'Publicado en Crear' : 'Pasó a borrador', texto: p.nombre });
    } catch (err) {
      setCambios((c) => { const n = { ...c }; delete n[p.id]; return n; });
      toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' });
    }
  };
  const confirmarArchivar = async () => {
    const p = archivar;
    try {
      await onArchivar?.(p.id);
      toast({ tipo: 'exito', titulo: 'En la papelera', texto: p.nombre });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo archivar', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setArchivar(null);
    }
  };
  const publicadosQueLaUsan = archivar ? archivar.packs.filter((k) => k.publicado) : [];

  return (
    <div data-componente="PaginaPersonalizables">
      {!embebido && (
        <CabezaAdmin icono="productos" titulo="Personalizables" subtitulo="Las prendas y productos que el cliente diseña en Crear." principal={{ texto: 'Nuevo personalizable', Icono: Plus, to: urlNueva }} />
      )}
      <div className={s.fila}>
        <div className={`${s.chips} ${l.desliza}`} role="group" aria-label="Cuáles">
          {FILTROS_PUBLICADO.map((f) => <Chip key={f.id} tamano="sm" activo={filtro === f.id} cuenta={cargando ? undefined : cuentas[f.id]} onClick={() => setFiltro(f.id)}>{f.texto}</Chip>)}
        </div>
        {embebido && <Boton tamano="sm" icono={<Plus aria-hidden="true" />} to={urlNueva}>Nuevo personalizable</Boton>}
      </div>
      <BarraFiltros busqueda={buscar} onBusqueda={setBuscar} placeholder="Buscar un personalizable" total={cargando || error ? undefined : filas.length} unidad={['personalizable', 'personalizables']} />
      <TablaAdmin
        etiqueta="Personalizables"
        columnas={[
          { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (p) => <FotoCelda src={p.foto} forma="producto" /> },
          {
            id: 'nombre',
            titulo: 'Personalizable',
            tarjeta: 'titulo',
            celda: (p) => (
              <>
                {p.nombre}
                <span className={l.sub}>{p.colores} colores · {p.vistas} vistas · {p.zonas} zonas · {p.plantillas} plantillas</span>
              </>
            ),
          },
          {
            id: 'detalle',
            titulo: 'Packs',
            tarjeta: 'detalle',
            celda: (p) => (
              <span className={s.detalle}>
                {p.faltanZonas && <Etiqueta tono="aviso" icono={<AlertTriangle aria-hidden="true" />}>Le faltan vistas con zonas</Etiqueta>}
                {p.packs.length ? <span className={l.sub}>En {p.packs.map((k) => k.nombre).join(', ')}</span> : <span className={l.sub}>En ningún pack</span>}
              </span>
            ),
          },
          {
            id: 'estado',
            titulo: 'Estado',
            ancho: 190,
            tarjeta: 'estado',
            celda: (p) => (
              <span className={s.estados}>
                <InsigniaEstado estado={p.publicada ? 'publicado' : 'borrador'}>{p.publicada ? 'En Crear' : 'Borrador'}</InsigniaEstado>
                {p.enTienda && <InsigniaEstado estado="activo">{p.talCual ? 'Tienda y tal cual' : 'En la tienda'}</InsigniaEstado>}
              </span>
            ),
          },
        ]}
        filas={filas}
        nombreDe={(p) => p.nombre}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onFila={onAbrir}
        vacio={q ? { titulo: 'Ningún personalizable se llama así' } : { titulo: 'Todavía no hay personalizables', texto: 'Crea el primero: sus colores, sus vistas con las zonas de impresión y sus plantillas.', accion: <Boton to={urlNueva} icono={<Plus aria-hidden="true" />}>Nuevo personalizable</Boton> }}
        acciones={(p) => [
          { id: 'editar', etiqueta: 'Editar', Icono: Pencil, accion: () => onAbrir?.(p) },
          ...(onVer ? [{ id: 'ver', etiqueta: 'Verlo en Crear', Icono: Eye, accion: () => onVer(p) }] : []),
          ...(onPublicar ? [{ id: 'publicar', etiqueta: p.publicada ? 'Volver a borrador' : 'Publicar en Crear', Icono: p.publicada ? Undo2 : Send, accion: () => publicar(p) }] : []),
          ...(onArchivar ? ['separador', { id: 'archivar', etiqueta: 'Mover a la papelera', Icono: Trash2, peligro: true, accion: () => setArchivar(p) }] : []),
        ]}
      />
      <Confirmar
        abierta={Boolean(archivar)}
        titulo={archivar ? `¿Mover «${archivar.nombre}» a la papelera?` : ''}
        texto="Deja de verse en Crear y en la tienda. Desde Productos › Papelera se restaura durante 30 días; después se borra sola. Los pedidos y las creaciones que la usan siguen igual."
        confirmar="Mover a la papelera"
        peligro
        onConfirmar={confirmarArchivar}
        onCancelar={() => setArchivar(null)}
      >
        {publicadosQueLaUsan.length > 0 && (
          <p className={s.alerta}>Está en {publicadosQueLaUsan.length === 1 ? 'un pack publicado' : `${publicadosQueLaUsan.length} packs publicados`}: {publicadosQueLaUsan.map((k) => k.nombre).join(', ')}. Ese pack no se podrá comprar.</p>
        )}
      </Confirmar>
    </div>
  );
}

/* ── Packs de Crear ────────────────────────────────────── */

const PACK_VACIO = { nombre: '', descripcion: '', marcaId: '', categoria: '', portada: '', precio: '', oferta: '', publicado: false, enTienda: false, tallas: 'auto', piezas: [{ prendaId: '', fija: false, color: null }, { prendaId: '', fija: false, color: null }] };
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Una pieza del pack: se diseña (una prenda de Crear, el color en que abre el estudio) o va tal cual (un producto de la tienda y su color). */
function FilaPieza({ pz, i, prendas, talCual, puedeQuitar, onCambiar, onQuitar }) {
  const fuente = pz.fija ? talCual : prendas;
  const producto = fuente.find((x) => x.id === pz.prendaId);
  const colores = producto?.colores || [];
  return (
    <li className={s.pieza}>
      <div className={s.piezaCabeza}>
        <strong>Pieza {i + 1}</strong>
        <ElegirUno
          etiqueta={`Pieza ${i + 1}: cómo va`}
          opciones={[{ valor: 'disena', texto: 'Se diseña' }, { valor: 'fija', texto: 'Va tal cual' }]}
          valor={pz.fija ? 'fija' : 'disena'}
          onElegir={(v) => v && onCambiar({ prendaId: '', fija: v === 'fija', color: null })}
        />
        {puedeQuitar && <Boton soloIcono tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} aria-label={`Quitar la pieza ${i + 1}`} onClick={onQuitar} />}
      </div>
      <div className={s.piezaCampos}>
        <Campo
          etiqueta={pz.fija ? 'Producto de la tienda' : 'Prenda de Crear'}
          opciones={fuente.map((x) => ({ valor: x.id, texto: x.nombre, detalle: soles(x.precio) }))}
          buscable
          placeholder="Elegir…"
          value={pz.prendaId}
          onChange={(e) => onCambiar({ ...pz, prendaId: e.target.value, color: null })}
        />
        {producto && colores.length > 0 && (
          <Campo
            etiqueta={pz.fija ? 'Color' : 'Color en que abre (opcional)'}
            opciones={[...(pz.fija ? [] : [{ valor: '', texto: 'El principal' }]), ...colores.map((c) => ({ valor: c.id, texto: c.nombre }))]}
            value={pz.color?.id || ''}
            onChange={(e) => onCambiar({ ...pz, color: colores.find((c) => c.id === e.target.value) || null })}
          />
        )}
      </div>
    </li>
  );
}

/**
 * Los packs de Crear (en Productos, la pestaña "Packs de Crear").
 *  - packs: [packDesdeFirestore] · cargando · error · onReintentar
 *  - prendas: las de Crear [{ id, nombre, foto, precio, colores: [{ id, nombre, hex }] }]
 *  - talCual: los productos de la tienda que pueden ir tal cual (con colores; sin combos ni Crear), con la misma forma
 *  - marcas: [{ id, nombre, logo }] · categorias: [{ id, nombre, marcas }]
 *  - onGuardar(datos, id?) → promesa (el admin: packAGuardar + guardarComboCrear) · onArchivar(id) → promesa
 *  - subirImagen · onVer(pack) (/combo/:id) · nuevoInicial (?nuevo=1)
 *  - onSugerir() → [{ clave, nombre, descripcion, precio, piezas, tallas }] (sugerirCombos) ·
 *    onCrearSugeridos(lista, publicar) → promesa con cuántos
 *  - embebido: sin su cabecera
 */
export function PaginaPacks({
  packs = [], cargando, error, onReintentar, prendas = [], talCual = [], marcas = [], categorias = [],
  onGuardar, onArchivar, subirImagen, onVer, nuevoInicial = false, onSugerir, onCrearSugeridos, embebido = false,
}) {
  const toast = useToast();
  const [filtro, setFiltro] = useState('todos');
  const [editando, setEditando] = useState(null); // { id, inicial }
  const [datos, setDatos] = useState(PACK_VACIO);
  const [errores, setErrores] = useState({});
  const [archivar, setArchivar] = useState(null);
  const [sugeridos, setSugeridos] = useState(null);
  const [publicarSugeridos, setPublicarSugeridos] = useState(true);
  const [creando, setCreando] = useState(false);

  const abrir = (k) => {
    const inicial = k ? { ...PACK_VACIO, ...k, id: undefined } : { ...PACK_VACIO };
    setDatos(inicial);
    setErrores({});
    setEditando({ id: k?.id || null, inicial });
  };
  useEffect(() => { if (nuevoInicial) abrir(null); }, [nuevoInicial]);

  const porPrenda = useMemo(() => new Map([...prendas, ...talCual].map((p) => [p.id, p])), [prendas, talCual]);
  const productoDe = (pz) => (pz.fija ? talCual : prendas).find((x) => x.id === pz.prendaId) || porPrenda.get(pz.prendaId);
  const textoPiezas = (k) => k.piezas.map((pz) => `${pz.nombre || productoDe(pz)?.nombre || '¿?'}${pz.fija ? ' (tal cual)' : ''}`).join(' · ');
  const cuentas = { todos: packs.length, publicados: packs.filter((k) => k.publicado).length, borradores: packs.filter((k) => !k.publicado).length };
  const filas = packs.filter((k) => filtro === 'todos' || (filtro === 'publicados') === k.publicado).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const cambiar = (campo, valor) => { setDatos((d) => ({ ...d, [campo]: valor })); setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e)); };
  const cambiarPieza = (i, pz) => cambiar('piezas', datos.piezas.map((x, j) => (j === i ? pz : x)));
  const sueltas = datos.piezas.reduce((t, pz) => t + (Number(productoDe(pz)?.precio) || 0), 0);
  const precioPack = Number(datos.oferta) > 0 ? Number(datos.oferta) : Number(datos.precio) || 0;

  const guardar = async () => {
    const e = erroresDePack(datos);
    if (Object.keys(e).length) { setErrores(e); return; }
    await onGuardar?.(datos, editando.id || undefined);
    toast({ tipo: 'exito', titulo: editando.id ? 'Pack guardado' : 'Pack creado', texto: datos.nombre.trim() });
    setEditando(null);
  };
  const confirmarArchivar = async () => {
    const k = archivar;
    try {
      await onArchivar?.(k.id);
      toast({ tipo: 'exito', titulo: 'Pack en la papelera', texto: k.nombre });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo archivar', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setArchivar(null);
    }
  };
  const abrirSugeridos = async () => {
    const lista = await onSugerir?.();
    setSugeridos((lista || []).map((c) => ({ ...c, elegido: true })));
  };
  const crearSugeridos = async () => {
    const elegidos = sugeridos.filter((c) => c.elegido);
    setCreando(true);
    try {
      const n = await onCrearSugeridos?.(elegidos, publicarSugeridos);
      toast({ tipo: 'exito', titulo: (n ?? elegidos.length) === 1 ? 'Se creó 1 pack' : `Se crearon ${n ?? elegidos.length} packs` });
      setSugeridos(null);
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudieron crear todos', texto: err?.message || 'Los que se crearon antes del error quedaron.' });
    } finally {
      setCreando(false);
    }
  };

  const marcaDelPack = datos.marcaId;
  return (
    <div data-componente="PaginaPacks">
      {!embebido && (
        <CabezaAdmin icono="productos" titulo="Packs de Crear" subtitulo="Pareja, trío o conjunto: varias prendas que el cliente diseña juntas, a un precio de pack." principal={{ texto: 'Nuevo pack', Icono: Plus, onClick: () => abrir(null) }} />
      )}
      <div className={s.fila}>
        <div className={`${s.chips} ${l.desliza}`} role="group" aria-label="Cuáles">
          {FILTROS_PUBLICADO.map((f) => <Chip key={f.id} tamano="sm" activo={filtro === f.id} cuenta={cargando ? undefined : cuentas[f.id]} onClick={() => setFiltro(f.id)}>{f.texto}</Chip>)}
        </div>
        <span className={s.botones}>
          {onSugerir && <Boton tamano="sm" variante="secundario" icono={<Sparkles aria-hidden="true" />} onClick={abrirSugeridos}>Sugerir packs</Boton>}
          {embebido && <Boton tamano="sm" icono={<Plus aria-hidden="true" />} onClick={() => abrir(null)}>Nuevo pack</Boton>}
        </span>
      </div>
      <TablaAdmin
        etiqueta="Packs de Crear"
        columnas={[
          { id: 'foto', titulo: 'Portada', ancho: 72, tarjeta: 'foto', celda: (k) => <FotoCelda src={k.portada || k.piezas[0]?.imagen || productoDe(k.piezas[0] || {})?.foto} forma="producto" /> },
          { id: 'nombre', titulo: 'Pack', tarjeta: 'titulo', celda: (k) => <>{k.nombre}<span className={l.sub}>{textoPiezas(k)}</span></> },
          { id: 'precio', titulo: 'Precio', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (k) => <span className={l.numero}>{soles(Number(k.oferta) > 0 ? k.oferta : k.precio)}</span> },
          { id: 'tallas', titulo: 'Tallas', ancho: 140, tarjeta: 'detalle', celda: (k) => MODOS_TALLA_PACK.find((m) => m.valor === k.tallas)?.texto },
          {
            id: 'estado',
            titulo: 'Estado',
            ancho: 190,
            tarjeta: 'estado',
            celda: (k) => (
              <span className={s.estados}>
                <InsigniaEstado estado={k.publicado ? 'publicado' : 'borrador'}>{k.publicado ? 'En Crear' : 'Borrador'}</InsigniaEstado>
                {k.publicado && k.enTienda && <InsigniaEstado estado="activo">En la tienda</InsigniaEstado>}
              </span>
            ),
          },
        ]}
        filas={filas}
        nombreDe={(k) => k.nombre}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onFila={abrir}
        vacio={{ titulo: 'Todavía no hay packs', texto: 'Arma el primero o deja que se sugieran parejas y tríos de cada prenda.', accion: <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir(null)}>Nuevo pack</Boton> }}
        acciones={(k) => [
          { id: 'editar', etiqueta: 'Editar', Icono: Pencil, accion: () => abrir(k) },
          ...(onVer ? [{ id: 'ver', etiqueta: 'Verlo', Icono: Eye, accion: () => onVer(k) }] : []),
          ...(onArchivar ? ['separador', { id: 'archivar', etiqueta: 'Mover a la papelera', Icono: Trash2, peligro: true, accion: () => setArchivar(k) }] : []),
        ]}
      />

      <HojaEdicion
        abierta={Boolean(editando)}
        titulo={editando?.id ? 'Editar pack' : 'Nuevo pack'}
        subtitulo={editando?.id ? editando.inicial.nombre : 'Entre 2 y 4 piezas; al menos una se diseña.'}
        onCerrar={() => setEditando(null)}
        onGuardar={guardar}
        sucio={Boolean(editando) && !mismo(datos, editando.inicial)}
        textoGuardar={editando?.id ? 'Guardar cambios' : 'Crear pack'}
      >
        <GrupoCampos titulo="El pack">
          <Campo etiqueta="Nombre" placeholder="Ej. Pareja Walito" value={datos.nombre} error={errores.nombre} maxLength={80} onChange={(e) => cambiar('nombre', e.target.value)} />
          <Campo etiqueta="Descripción" multilinea={2} value={datos.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
          {/* Como en la ficha de un producto: los logos (tocar la elegida la quita). */}
          <ElegirMarca marcas={marcas} valor={datos.marcaId} onCambiar={(v) => cambiar('marcaId', v)} ayuda="Sin marca, el pack no sale en ninguna página de marca." />
          <Campo
            etiqueta="Categoría"
            opciones={[{ valor: '', texto: 'Sin categoría' }, ...categorias.filter((c) => !marcaDelPack || (c.marcas || []).includes(marcaDelPack)).map((c) => ({ valor: c.id, texto: c.nombre }))]}
            value={datos.categoria}
            onChange={(e) => cambiar('categoria', e.target.value)}
          />
          <CampoImagen etiqueta="Portada (opcional)" ayuda="Sin ella, la tarjeta muestra sus piezas." valor={datos.portada} onCambiar={(url) => cambiar('portada', url)} subir={subirImagen && ((b, o) => subirImagen(b, { ...o, carpeta: 'combos_crear' }))} contener />
        </GrupoCampos>

        <GrupoCampos titulo={`Piezas · ${datos.piezas.length}`}>
          {errores.piezas && <p className={s.alerta}>{errores.piezas}</p>}
          <ol className={s.piezas}>
            {datos.piezas.map((pz, i) => (
              <FilaPieza
                key={i}
                pz={pz}
                i={i}
                prendas={prendas}
                talCual={talCual}
                puedeQuitar={datos.piezas.length > MIN_PIEZAS_PACK}
                onCambiar={(x) => cambiarPieza(i, x)}
                onQuitar={() => cambiar('piezas', datos.piezas.filter((_, j) => j !== i))}
              />
            ))}
          </ol>
          {datos.piezas.length < MAX_PIEZAS_PACK && (
            <Boton
              tamano="sm"
              variante="secundario"
              icono={<Plus aria-hidden="true" />}
              onClick={() => {
                // Copia la última prenda que se diseña: una pareja pasa a trío con un toque.
                const ultima = [...datos.piezas].reverse().find((x) => !x.fija && x.prendaId);
                cambiar('piezas', [...datos.piezas, { prendaId: ultima?.prendaId || '', fija: false, color: null }]);
              }}
            >
              Agregar prenda
            </Boton>
          )}
          <div className={s.tallasPack}>
            <span className={l.sub}>Cómo elige la talla</span>
            <ElegirUno etiqueta="Tallas del pack" opciones={MODOS_TALLA_PACK} valor={datos.tallas} onElegir={(v) => v && cambiar('tallas', v)} />
            <span className={l.sub}>{MODOS_TALLA_PACK.find((m) => m.valor === datos.tallas)?.ayuda}</span>
          </div>
        </GrupoCampos>

        <GrupoCampos titulo="Precio" columnas={2}>
          <CampoDinero etiqueta="Precio del pack" value={datos.precio} error={errores.precio} onChange={(e) => cambiar('precio', e.target.value)} />
          <CampoDinero etiqueta="Oferta (opcional)" value={datos.oferta} error={errores.oferta} onChange={(e) => cambiar('oferta', e.target.value)} />
        </GrupoCampos>
        {sueltas > 0 && (
          <p className={s.ahorro}>
            Por separado: <strong>{soles(sueltas)}</strong>
            {precioPack > 0 && precioPack < sueltas && <> · el cliente ahorra <strong>{soles(sueltas - precioPack)}</strong> ({Math.round(100 - (precioPack * 100) / sueltas)} %)</>}
            {precioPack >= sueltas && precioPack > 0 && <> · el pack no es más barato que sus piezas</>}
          </p>
        )}

        <GrupoCampos titulo="Dónde se ve">
          <Interruptor etiqueta="Publicado en Crear" descripcion="Apagado: es un borrador (no se ve)." activo={datos.publicado} onChange={(v) => cambiar('publicado', v)} />
          <Interruptor etiqueta="También en la tienda" descripcion="Sale entre los productos (solo si está publicado)." activo={datos.enTienda} onChange={(v) => cambiar('enTienda', v)} />
        </GrupoCampos>
      </HojaEdicion>

      <HojaInferior
        abierta={Boolean(sugeridos)}
        onCerrar={() => !creando && setSugeridos(null)}
        titulo="Packs sugeridos"
        tamano="lg"
        bloqueada={creando}
        pie={(
          <>
            <Interruptor etiqueta="Publicarlos de una vez" activo={publicarSugeridos} onChange={setPublicarSugeridos} />
            <Boton cargando={creando} disabled={!sugeridos?.some((c) => c.elegido)} onClick={crearSugeridos}>
              Crear {sugeridos?.filter((c) => c.elegido).length || 0}
            </Boton>
          </>
        )}
      >
        {sugeridos?.length ? (
          <ul className={s.sugeridos}>
            {sugeridos.map((c) => (
              <li key={c.clave} className={s.sugerido}>
                <Casilla activo={c.elegido} etiqueta={c.nombre} onChange={(v) => setSugeridos((lista) => lista.map((x) => (x.clave === c.clave ? { ...x, elegido: v } : x)))} />
                <div className={s.sugeridoCampos}>
                  <Campo etiqueta="Nombre" value={c.nombre} onChange={(e) => setSugeridos((lista) => lista.map((x) => (x.clave === c.clave ? { ...x, nombre: e.target.value } : x)))} />
                  <CampoDinero etiqueta="Precio" value={c.precio} onChange={(e) => setSugeridos((lista) => lista.map((x) => (x.clave === c.clave ? { ...x, precio: e.target.value } : x)))} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={l.sub}>No hay packs por sugerir: cada prenda publicada ya tiene su pareja y su trío.</p>
        )}
      </HojaInferior>

      <Confirmar
        abierta={Boolean(archivar)}
        titulo={archivar ? `¿Mover «${archivar.nombre}» a la papelera?` : ''}
        texto="Deja de verse en Crear y en la tienda. Desde Productos › Papelera se restaura durante 30 días; después se borra solo. Los pedidos que lo tienen siguen igual."
        confirmar="Mover a la papelera"
        peligro
        onConfirmar={confirmarArchivar}
        onCancelar={() => setArchivar(null)}
      />
    </div>
  );
}
