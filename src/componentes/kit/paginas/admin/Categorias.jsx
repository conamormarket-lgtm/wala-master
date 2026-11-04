import React from 'react';
import { Aviso } from '../../Feedback';
import Boton from '../../Boton';
import { Campo } from '../../Formulario';
import { GrupoCampos, CampoImagen } from '../../piezas/admin/Formularios';
import { mismoNombre } from '../../adaptadoresAdmin';
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
 */
export function PaginaCategorias({ categorias = [], marcas = [], cargando = false, error, onReintentar, onGuardar, onEliminar, onGuardarOrden, subirImagen, tipos = [], onCrearTipo, tiposSugeridos = new Map() }) {
  const sinMarca = categorias.filter((c) => !c.marcas.length).length;
  const sinTipo = tipos.length ? categorias.filter((c) => !c.tipo).length : 0;
  const nombreTipo = (id) => tipos.find((t) => t.id === id)?.nombre || '';
  const CeldaTipo = ({ c }) => (c.tipo ? <span>{nombreTipo(c.tipo) || 'Sin tipo'}</span> : <span className={s.sinTipo}>Sin tipo</span>);
  return (
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
            accion={<Boton tamano="sm" variante="contorno" onClick={() => filtrar('tipo', SIN_TIPO)}>Verlas</Boton>}
          >
            Sus productos no salen en el filtro «Tipo» de la tienda. Ábrelas y elige el suyo: lo toman todos sus productos.
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
  );
}
