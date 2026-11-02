import React, { useMemo, useState } from 'react';
import { ImageOff, Pencil, Plus, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Casilla } from '../../Formulario';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, InsigniaEstado } from '../../piezas/admin/Datos';
import { HojaEdicion, GrupoCampos, CampoImagen } from '../../piezas/admin/Formularios';
import { normalizarBusqueda } from '../../adaptadoresAdmin';
import s from './Categorias.module.css';

/*
 * Categorías del catálogo (/admin/categorias, D1; la primera página armada
 * con las piezas de D0). Datos por props, en la forma de
 * categoriaDesdeFirestore / marcaAdminDesdeFirestore; guardar, eliminar y
 * subir son promesas que pone el admin (services/categories y storage).
 */

const SIN_MARCA = '__sin_marca';
const VACIA = { nombre: '', orden: 0, imagen: '', marcas: [] };
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ID_NOMBRE = 'categoria-admin-nombre';

/* La burbuja de la categoría (como en la tienda), o el hueco si no tiene foto. */
function Burbuja({ imagen, tamano = 44 }) {
  return (
    <span className={s.burbuja} style={{ '--tam': `${tamano}px` }}>
      {imagen ? <img src={imagen} alt="" loading="lazy" /> : <ImageOff aria-hidden="true" />}
    </span>
  );
}

/* Las marcas de una categoría: sus logos y el nombre de la primera. */
function MarcasDe({ ids, marcas }) {
  const lista = ids.map((id) => marcas.find((m) => m.id === id)).filter(Boolean);
  if (!lista.length) return <InsigniaEstado estado="pendiente">Sin marca</InsigniaEstado>;
  return (
    <span className={s.marcas} title={lista.map((m) => m.nombre).join(', ')}>
      <span className={s.logos} aria-hidden="true">
        {lista.slice(0, 3).map((m) => (m.logo ? <img key={m.id} src={m.logo} alt="" loading="lazy" /> : <span key={m.id}>{m.nombre.slice(0, 1)}</span>))}
      </span>
      <span className={s.marcasTexto}>{lista[0].nombre}{lista.length > 1 ? ` +${lista.length - 1}` : ''}</span>
    </span>
  );
}

/**
 * La lista de categorías con su hoja para crear o editar.
 *  - categorias: [{ id, nombre, imagen, orden, marcas: [ids] }]
 *  - marcas: [{ id, nombre, logo }]
 *  - cargando · error · onReintentar
 *  - onGuardar(datos, id?) → promesa (sin id: nueva) · onEliminar(id) → promesa
 *  - subirImagen(blob, { alAvanzar }) → promesa con la url
 */
export function PaginaCategorias({ categorias = [], marcas = [], cargando = false, error, onReintentar, onGuardar, onEliminar, subirImagen }) {
  const toast = useToast();
  const [buscar, setBuscar] = useState('');
  const [marca, setMarca] = useState('');
  const [orden, setOrden] = useState({ por: 'orden', dir: 'asc' });
  const [editando, setEditando] = useState(null); // { id, inicial }
  const [form, setForm] = useState(VACIA);
  const [errores, setErrores] = useState({});
  const [borrar, setBorrar] = useState(null);

  const sinMarca = categorias.filter((c) => !c.marcas.length).length;
  const filas = useMemo(() => {
    const q = normalizarBusqueda(buscar);
    const lista = categorias.filter((c) => (
      (!q || normalizarBusqueda(c.nombre).includes(q))
      && (!marca || (marca === SIN_MARCA ? !c.marcas.length : c.marcas.includes(marca)))
    ));
    const signo = orden.dir === 'desc' ? -1 : 1;
    return [...lista].sort((a, b) => signo * (orden.por === 'nombre'
      ? a.nombre.localeCompare(b.nombre, 'es')
      : (a.orden - b.orden) || a.nombre.localeCompare(b.nombre, 'es')));
  }, [categorias, buscar, marca, orden]);

  const abrir = (cat) => {
    const inicial = cat
      ? { nombre: cat.nombre, orden: cat.orden, imagen: cat.imagen, marcas: [...cat.marcas] }
      : { ...VACIA, orden: categorias.reduce((m, c) => Math.max(m, c.orden + 1), 0), marcas: marca && marca !== SIN_MARCA ? [marca] : [] };
    setForm(inicial);
    setErrores({});
    setEditando({ id: cat?.id || null, inicial });
  };
  const cerrar = () => setEditando(null);
  const cambiar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  };
  const alternarMarca = (id, si) => cambiar('marcas', si ? [...new Set([...form.marcas, id])] : form.marcas.filter((x) => x !== id));

  const guardar = async () => {
    const nombre = form.nombre.trim();
    const repetida = categorias.find((c) => c.id !== editando.id && normalizarBusqueda(c.nombre) === normalizarBusqueda(nombre));
    const nuevos = {
      nombre: !nombre ? 'Escribe el nombre de la categoría.' : repetida ? `Ya hay una categoría «${repetida.nombre}»: puedes sumarle marcas en vez de crear otra.` : undefined,
    };
    if (nuevos.nombre) {
      setErrores(nuevos);
      document.getElementById(ID_NOMBRE)?.focus();
      return;
    }
    await onGuardar?.({ ...form, nombre, orden: Number(form.orden) || 0 }, editando.id || undefined);
    toast({ tipo: 'exito', titulo: editando.id ? 'Categoría guardada' : 'Categoría creada', texto: nombre });
    cerrar();
  };

  const eliminar = async () => {
    const cat = borrar;
    try {
      await onEliminar?.(cat.id);
      toast({ tipo: 'exito', titulo: 'Categoría eliminada', texto: cat.nombre });
      if (editando?.id === cat.id) cerrar();
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo eliminar', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setBorrar(null);
    }
  };

  const columnas = [
    { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (c) => <Burbuja imagen={c.imagen} /> },
    { id: 'nombre', titulo: 'Nombre', ordenable: true, tarjeta: 'titulo', celda: (c) => c.nombre },
    { id: 'marcas', titulo: 'Marcas', tarjeta: 'detalle', celda: (c) => <MarcasDe ids={c.marcas} marcas={marcas} /> },
    { id: 'orden', titulo: 'Orden', ordenable: true, ancho: 96, alinear: 'fin', tarjeta: 'detalle', celda: (c) => <span className={s.orden}><span className={s.ordenEtiqueta}>Orden </span>{c.orden}</span> },
  ];

  const buscando = Boolean(buscar || marca);
  const vacio = buscando
    ? { titulo: 'Ninguna categoría coincide', texto: 'Prueba con otro nombre o quita el filtro de marca.', accion: <Boton variante="secundario" onClick={() => { setBuscar(''); setMarca(''); }}>Quitar filtros</Boton> }
    : { titulo: 'Todavía no hay categorías', texto: 'Crea la primera: después la eliges en cada producto y sale en las burbujas de su marca.', accion: <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir(null)}>Nueva categoría</Boton> };

  return (
    <div className={s.pagina} data-componente="PaginaCategorias">
      <CabezaAdmin
        icono="categorias"
        titulo="Categorías"
        subtitulo="Las burbujas y los filtros de cada marca. Una categoría puede estar en varias marcas."
        principal={{ texto: 'Nueva categoría', Icono: Plus, onClick: () => abrir(null) }}
      />

      {!cargando && !error && sinMarca > 0 && marca !== SIN_MARCA && (
        <div className={s.aviso}>
          <Aviso
            tipo="aviso"
            titulo={sinMarca === 1 ? 'Una categoría no tiene marca' : `${sinMarca} categorías no tienen marca`}
            accion={<Boton tamano="sm" variante="contorno" onClick={() => setMarca(SIN_MARCA)}>Verlas</Boton>}
          >
            Sin marca no salen en ninguna tienda.
          </Aviso>
        </div>
      )}

      <BarraFiltros
        busqueda={buscar}
        onBusqueda={setBuscar}
        placeholder="Buscar una categoría"
        filtros={[{
          id: 'marca',
          etiqueta: 'Marca',
          todos: 'Todas las marcas',
          valor: marca,
          opciones: [...marcas.map((m) => ({ valor: m.id, texto: m.nombre })), { valor: SIN_MARCA, texto: 'Sin marca' }],
        }]}
        onFiltro={(_, v) => setMarca(v)}
        total={cargando || error ? undefined : filas.length}
        unidad={['categoría', 'categorías']}
      />

      <TablaAdmin
        etiqueta="Categorías"
        columnas={columnas}
        filas={filas}
        nombreDe={(c) => c.nombre}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        vacio={vacio}
        orden={orden}
        onOrden={setOrden}
        onFila={abrir}
        acciones={(c) => [
          { id: 'editar', etiqueta: 'Editar', Icono: Pencil, accion: () => abrir(c) },
          'separador',
          { id: 'eliminar', etiqueta: 'Eliminar', Icono: Trash2, peligro: true, accion: () => setBorrar(c) },
        ]}
      />

      <HojaEdicion
        abierta={Boolean(editando)}
        titulo={editando?.id ? 'Editar categoría' : 'Nueva categoría'}
        subtitulo={editando?.id ? editando.inicial.nombre : 'Se puede usar en varias marcas.'}
        onCerrar={cerrar}
        onGuardar={guardar}
        sucio={Boolean(editando) && !mismo(form, editando.inicial)}
        textoGuardar={editando?.id ? 'Guardar cambios' : 'Crear categoría'}
        extra={editando?.id ? (
          <Boton variante="fantasma" className={s.eliminar} icono={<Trash2 aria-hidden="true" />} onClick={() => setBorrar(categorias.find((c) => c.id === editando.id))}>
            Eliminar
          </Boton>
        ) : null}
      >
        <GrupoCampos titulo="Datos">
          <Campo
            id={ID_NOMBRE}
            etiqueta="Nombre"
            placeholder="Ej. Polos"
            value={form.nombre}
            error={errores.nombre}
            maxLength={60}
            onChange={(e) => cambiar('nombre', e.target.value)}
          />
          <Campo
            etiqueta="Orden"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.orden}
            ayuda="Las de número más bajo salen primero en las burbujas."
            onChange={(e) => cambiar('orden', e.target.value)}
          />
        </GrupoCampos>

        <GrupoCampos titulo="Marcas" ayuda="En qué tiendas sale. Sin ninguna, no se ve.">
          <div className={s.atajosMarcas}>
            <button type="button" onClick={() => cambiar('marcas', marcas.map((m) => m.id))}>Todas</button>
            <button type="button" onClick={() => cambiar('marcas', [])}>Ninguna</button>
          </div>
          <div className={s.casillasMarcas}>
            {marcas.map((m) => (
              <Casilla key={m.id} etiqueta={m.nombre} activo={form.marcas.includes(m.id)} onChange={(si) => alternarMarca(m.id, si)} />
            ))}
          </div>
        </GrupoCampos>

        <GrupoCampos titulo="Imagen">
          <CampoImagen
            etiqueta="Foto de la burbuja"
            ayuda="Se recorta en círculo, como se ve en la tienda."
            valor={form.imagen}
            onCambiar={(url) => cambiar('imagen', url)}
            subir={subirImagen}
            recorte="circulo"
            forma="circulo"
          />
        </GrupoCampos>
      </HojaEdicion>

      <Confirmar
        abierta={Boolean(borrar)}
        titulo={borrar ? `¿Eliminar «${borrar.nombre}»?` : ''}
        texto="Deja de salir en las burbujas y en los filtros de sus marcas. Los productos no se borran."
        confirmar="Eliminar"
        peligro
        onConfirmar={eliminar}
        onCancelar={() => setBorrar(null)}
      />
    </div>
  );
}
