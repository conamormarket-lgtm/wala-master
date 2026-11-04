import React, { useState } from 'react';
import { Aviso } from '../../Feedback';
import Boton from '../../Boton';
import { Campo } from '../../Formulario';
import { GrupoCampos, CampoImagen, HojaEdicion } from '../../piezas/admin/Formularios';
import { mismoNombre, propuestaDeTipos, TIPOS_PROPUESTOS } from '../../adaptadoresAdmin';
import { useToast } from '../../Feedback';
import { PaginaListaAdmin } from './Lista';
import s from './Categorias.module.css';
import { FotoCelda, MarcasCelda, NumeroCelda, ElegirMarcas, porNombre, porOrden } from './celdas';

/*
 * Categorías del catálogo (/admin/categorias, D1), sobre PaginaListaAdmin.
 * Datos en la forma de categoriaDesdeFirestore / marcaAdminDesdeFirestore;
 * guardar, eliminar y subir son promesas que pone el admin
 * (services/categories y storage).
 */

const SIN_MARCA = '__sin_marca';
const SIN_TIPO = '__sin_tipo';

/**
 * La lista de categorías con su hoja para crear o editar.
 *  - categorias: [{ id, nombre, imagen, orden, marcas: [ids] }]
 *  - marcas: [{ id, nombre, logo }]
 *  - cargando · error · onReintentar
 *  - onGuardar(datos, id?) → promesa (sin id: nueva) · onEliminar(id) → promesa
 *  - onGuardarOrden(ids) → promesa: todas, en el orden nuevo. Con él, la lista
 *    se arrastra (como Destacados) y una nueva va al final sola; sin él, la
 *    tabla con la columna y el campo Orden
 *  - subirImagen(blob, { alAvanzar }) → promesa con la url
 *  - tipos: [{ id, nombre }] (productTypes) · onCrearTipo(nombre) → promesa con { id, nombre }
 *  - tiposSugeridos: Map id → tipo (el que ya tienen sus productos), para las que no tienen
 *  El tipo lo heredan sus productos: el admin se lo pone a todos al guardar.
 *  - onPonerTipos([{ id, tipo: nombre del tipo }]) → promesa con { categorias, productos, fallaron }:
 *    "Ponerlos todos" (la propuesta por nombre, para revisar y guardar de una vez;
 *    los tipos que no existen se crean)
 */

/*
 * Revisar y poner el tipo a todas las categorías que no tienen: cada una con
 * el propuesto por su nombre (o el de sus productos), que se cambia antes de
 * guardar. Las que se dejan "Sin tipo" no se tocan.
 */
function HojaPonerTipos({ abierta, onCerrar, propuesta, tipos, onPonerTipos }) {
  const toast = useToast();
  const [elegidos, setElegidos] = useState({});
  const valor = (c) => (c.id in elegidos ? elegidos[c.id] : c.tipo);
  const nombres = [...new Set([...TIPOS_PROPUESTOS, ...tipos.map((t) => t.nombre), ...Object.values(elegidos).filter(Boolean)])];
  const opciones = [{ valor: '', texto: 'Sin tipo' }, ...nombres.map((n) => ({ valor: n, texto: tipos.some((t) => mismoNombre(t.nombre, n)) ? n : `${n} (nuevo)` }))];
  const van = propuesta.filter((c) => valor(c));
  const guardar = async () => {
    const r = await onPonerTipos(van.map((c) => ({ id: c.id, tipo: valor(c) })));
    toast(r?.fallaron
      ? { tipo: 'aviso', titulo: `${r.categorias} categorías con tipo; ${r.fallaron} cambios no se pudieron`, texto: 'Vuelve a intentar con las que quedaron sin tipo.' }
      : { tipo: 'exito', titulo: `${r?.categorias ?? van.length} categorías con tipo`, texto: r?.productos ? `${r.productos} productos lo tomaron.` : undefined });
    setElegidos({});
    onCerrar();
  };
  return (
    <HojaEdicion
      abierta={abierta}
      titulo="Poner el tipo a las categorías"
      subtitulo="Propuesto por su nombre: cámbialo donde no sea. Sus productos lo toman al guardar."
      onCerrar={() => { setElegidos({}); onCerrar(); }}
      onGuardar={guardar}
      sucio={Object.keys(elegidos).length > 0}
      textoGuardar={van.length === 1 ? 'Guardar 1 tipo' : `Guardar ${van.length} tipos`}
      puedeGuardar={van.length > 0}
    >
      <GrupoCampos titulo={`${propuesta.length} sin tipo`} ayuda="Las que dejes en «Sin tipo» quedan como están. Un tipo marcado (nuevo) se crea al guardar.">
        <div className={s.ponerTipos}>
          {propuesta.map((c) => (
            <div key={c.id} className={s.ponerTipo}>
              <span className={s.nombre}>{c.nombre}</span>
              <Campo
                opciones={opciones}
                creable
                value={valor(c)}
                aria-label={`Tipo de ${c.nombre}`}
                onChange={(e) => setElegidos((m) => ({ ...m, [c.id]: String(e.target.value || '').trim() }))}
              />
            </div>
          ))}
        </div>
      </GrupoCampos>
    </HojaEdicion>
  );
}
export function PaginaCategorias({ categorias = [], marcas = [], cargando = false, error, onReintentar, onGuardar, onEliminar, onGuardarOrden, subirImagen, tipos = [], onCrearTipo, tiposSugeridos = new Map(), onPonerTipos }) {
  const [poniendo, setPoniendo] = useState(false);
  const sinMarca = categorias.filter((c) => !c.marcas.length).length;
  const sinTipo = tipos.length || onPonerTipos ? categorias.filter((c) => !c.tipo).length : 0;
  const nombreTipo = (id) => tipos.find((t) => t.id === id)?.nombre || '';
  const CeldaTipo = ({ c }) => (c.tipo ? <span>{nombreTipo(c.tipo) || 'Sin tipo'}</span> : <span className={s.sinTipo}>Sin tipo</span>);
  return (
    <>
    {onPonerTipos && (
      <HojaPonerTipos
        abierta={poniendo}
        onCerrar={() => setPoniendo(false)}
        propuesta={poniendo ? propuestaDeTipos(categorias, tipos, tiposSugeridos) : []}
        tipos={tipos}
        onPonerTipos={onPonerTipos}
      />
    )}
    <PaginaListaAdmin
      cabeza={{
        icono: 'categorias',
        titulo: 'Categorías',
        subtitulo: onGuardarOrden
          ? 'Las burbujas y los filtros de cada marca, en este orden: arrástralas para cambiarlo. Una categoría puede estar en varias marcas.'
          : 'Las burbujas y los filtros de cada marca. Una categoría puede estar en varias marcas.',
      }}
      registros={categorias}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      unidad={['categoría', 'categorías']}
      femenino
      buscarEn={(c) => c.nombre}
      placeholder="Buscar una categoría"
      filtros={[{
        id: 'marca',
        etiqueta: 'Marca',
        todos: 'Todas las marcas',
        opciones: [...marcas.map((m) => ({ valor: m.id, texto: m.nombre })), { valor: SIN_MARCA, texto: 'Sin marca' }],
        filtrar: (c, v) => (v === SIN_MARCA ? !c.marcas.length : c.marcas.includes(v)),
      }, ...(tipos.length ? [{
        id: 'tipo',
        etiqueta: 'Tipo',
        todos: 'Todos los tipos',
        opciones: [...tipos.map((t) => ({ valor: t.id, texto: t.nombre })), { valor: SIN_TIPO, texto: 'Sin tipo' }],
        filtrar: (c, v) => (v === SIN_TIPO ? !c.tipo : c.tipo === v),
      }] : [])]}
      antes={({ filtrar, valores }) => (!cargando && !error && ((sinMarca > 0 && valores.marca !== SIN_MARCA) || (sinTipo > 0 && valores.tipo !== SIN_TIPO)) ? (
        <>
        {sinTipo > 0 && valores.tipo !== SIN_TIPO && (
          <Aviso
            tipo="aviso"
            titulo={sinTipo === 1 ? 'Una categoría no tiene tipo' : `${sinTipo} categorías no tienen tipo`}
            accion={(
              <span className={s.acciones}>
                {onPonerTipos && <Boton tamano="sm" onClick={() => setPoniendo(true)}>Ponerlos todos</Boton>}
                <Boton tamano="sm" variante="contorno" onClick={() => filtrar('tipo', SIN_TIPO)}>Verlas</Boton>
              </span>
            )}
          >
            Sus productos no salen en el filtro «Tipo» de la tienda. «Ponerlos todos» te propone el de cada una para revisar y guardar de una vez; sus productos lo toman.
          </Aviso>
        )}
        {sinMarca > 0 && valores.marca !== SIN_MARCA && (
        <Aviso
          tipo="aviso"
          titulo={sinMarca === 1 ? 'Una categoría no tiene marca' : `${sinMarca} categorías no tienen marca`}
          accion={<Boton tamano="sm" variante="contorno" onClick={() => filtrar('marca', SIN_MARCA)}>Verlas</Boton>}
        >
          Sin marca no salen en ninguna tienda.
        </Aviso>
        )}
        </>
      ) : null)}
      columnas={[
        { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (c) => <FotoCelda src={c.imagen} forma="circulo" /> },
        { id: 'nombre', titulo: 'Nombre', ordenable: true, tarjeta: 'titulo', celda: (c) => c.nombre },
        { id: 'marcas', titulo: 'Marcas', tarjeta: 'detalle', celda: (c) => <MarcasCelda ids={c.marcas} marcas={marcas} /> },
        ...(tipos.length ? [{ id: 'tipo', titulo: 'Tipo', ancho: 140, tarjeta: 'detalle', celda: (c) => <CeldaTipo c={c} /> }] : []),
        ...(onGuardarOrden ? [] : [{ id: 'orden', titulo: 'Orden', ordenable: true, ancho: 96, alinear: 'fin', tarjeta: 'detalle', celda: (c) => <NumeroCelda nombre="Orden" valor={c.orden} /> }]),
      ]}
      ordenes={{ nombre: porNombre, orden: porOrden }}
      ordenInicial={{ por: 'orden', dir: 'asc' }}
      ordenable={onGuardarOrden ? {
        etiqueta: 'Orden de las categorías',
        onGuardar: onGuardarOrden,
        cabecera: <span className={s.fila}><span>Foto</span><span>Nombre</span><span>Marcas</span><span>Tipo</span></span>,
        fila: (c) => (
          <span className={s.fila}>
            <FotoCelda src={c.imagen} forma="circulo" tamano={40} />
            <span className={s.nombre}>{c.nombre}</span>
            <span className={s.marcas}><MarcasCelda ids={c.marcas} marcas={marcas} /></span>
            <span className={s.tipo}>{tipos.length ? <CeldaTipo c={c} /> : null}</span>
          </span>
        ),
      } : undefined}
      vacio={{ titulo: 'Todavía no hay categorías', texto: 'Crea la primera: después la eliges en cada producto y sale en las burbujas de su marca.' }}
      textos={{ creado: 'Categoría creada', guardado: 'Categoría guardada', eliminado: 'Categoría eliminada' }}
      eliminar={{ texto: () => 'Deja de salir en las burbujas y en los filtros de sus marcas. Los productos no se borran.' }}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nueva categoría',
        titulos: { nuevo: 'Nueva categoría', editar: 'Editar categoría' },
        subtitulo: (c) => (c ? c.nombre : 'Se puede usar en varias marcas.'),
        textoGuardar: { nuevo: 'Crear categoría', editar: 'Guardar cambios' },
        // Una nueva va al final: el número siguiente al más alto.
        vacio: ({ registros, filtros }) => ({
          nombre: '',
          orden: registros.reduce((m, c) => Math.max(m, c.orden + 1), 0),
          imagen: '',
          marcas: filtros.marca && filtros.marca !== SIN_MARCA ? [filtros.marca] : [],
          tipo: filtros.tipo && filtros.tipo !== SIN_TIPO ? filtros.tipo : '',
        }),
        // Sin tipo: el que ya tienen sus productos, para no empezar de cero.
        desde: (c) => ({ nombre: c.nombre, orden: c.orden, imagen: c.imagen, marcas: [...c.marcas], tipo: c.tipo || tiposSugeridos.get(c.id) || '' }),
        validar: (d, { id, registros }) => {
          const nombre = d.nombre.trim();
          const repetida = registros.find((c) => c.id !== id && mismoNombre(c.nombre, nombre));
          return {
            nombre: !nombre ? 'Escribe el nombre de la categoría.'
              : repetida ? `Ya hay una categoría «${repetida.nombre}»: puedes sumarle marcas en vez de crear otra.` : undefined,
          };
        },
        limpiar: (d) => ({ ...d, nombre: d.nombre.trim(), orden: Number(d.orden) || 0 }),
        campos: ({ datos, cambiar, errores, idDe }) => (
          <>
            <GrupoCampos titulo="Datos">
              <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. Polos" value={datos.nombre} error={errores.nombre} maxLength={60} onChange={(e) => cambiar('nombre', e.target.value)} />
              {/* Con la lista para arrastrar, el orden no se escribe: una nueva va al final. */}
              {!onGuardarOrden && <Campo id={idDe('orden')} etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} ayuda="Las de número más bajo salen primero en las burbujas." onChange={(e) => cambiar('orden', e.target.value)} />}
              {(tipos.length > 0 || onCrearTipo) && (
                <Campo
                  id={idDe('tipo')}
                  etiqueta="Tipo de producto"
                  opciones={[{ valor: '', texto: 'Sin tipo' }, ...tipos.map((t) => ({ valor: t.id, texto: t.nombre }))]}
                  buscable
                  creable={Boolean(onCrearTipo)}
                  value={datos.tipo || ''}
                  ayuda="Lo toman todos sus productos: es el filtro «Tipo» de la tienda (Ropa, Belleza, Hogar…), por encima de las marcas."
                  onChange={async (e) => {
                    const v = e.target.value;
                    if (!v || tipos.some((t) => t.id === v)) { cambiar('tipo', v); return; }
                    const r = await onCrearTipo?.(v);
                    if (r?.id) cambiar('tipo', r.id);
                  }}
                />
              )}
            </GrupoCampos>
            <GrupoCampos titulo="Marcas" ayuda="En qué tiendas sale. Sin ninguna, no se ve.">
              <ElegirMarcas marcas={marcas} valor={datos.marcas} onCambiar={(v) => cambiar('marcas', v)} />
            </GrupoCampos>
            <GrupoCampos titulo="Imagen">
              <CampoImagen etiqueta="Foto de la burbuja" ayuda="Se recorta en círculo, como se ve en la tienda." valor={datos.imagen} onCambiar={(url) => cambiar('imagen', url)} subir={subirImagen} recorte="circulo" forma="circulo" />
            </GrupoCampos>
          </>
        ),
      }}
    />
    </>
  );
}
