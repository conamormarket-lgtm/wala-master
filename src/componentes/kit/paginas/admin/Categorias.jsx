import React from 'react';
import { Aviso } from '../../Feedback';
import Boton from '../../Boton';
import { Campo } from '../../Formulario';
import { GrupoCampos, CampoImagen } from '../../piezas/admin/Formularios';
import { mismoNombre } from '../../adaptadoresAdmin';
import { PaginaListaAdmin } from './Lista';
import { FotoCelda, MarcasCelda, NumeroCelda, ElegirMarcas, porNombre, porOrden } from './celdas';

/*
 * Categorías del catálogo (/admin/categorias, D1), sobre PaginaListaAdmin.
 * Datos en la forma de categoriaDesdeFirestore / marcaAdminDesdeFirestore;
 * guardar, eliminar y subir son promesas que pone el admin
 * (services/categories y storage).
 */

const SIN_MARCA = '__sin_marca';

/**
 * La lista de categorías con su hoja para crear o editar.
 *  - categorias: [{ id, nombre, imagen, orden, marcas: [ids] }]
 *  - marcas: [{ id, nombre, logo }]
 *  - cargando · error · onReintentar
 *  - onGuardar(datos, id?) → promesa (sin id: nueva) · onEliminar(id) → promesa
 *  - subirImagen(blob, { alAvanzar }) → promesa con la url
 */
export function PaginaCategorias({ categorias = [], marcas = [], cargando = false, error, onReintentar, onGuardar, onEliminar, subirImagen }) {
  const sinMarca = categorias.filter((c) => !c.marcas.length).length;
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'categorias', titulo: 'Categorías', subtitulo: 'Las burbujas y los filtros de cada marca. Una categoría puede estar en varias marcas.' }}
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
      }]}
      antes={({ filtrar, valores }) => (!cargando && !error && sinMarca > 0 && valores.marca !== SIN_MARCA ? (
        <Aviso
          tipo="aviso"
          titulo={sinMarca === 1 ? 'Una categoría no tiene marca' : `${sinMarca} categorías no tienen marca`}
          accion={<Boton tamano="sm" variante="contorno" onClick={() => filtrar('marca', SIN_MARCA)}>Verlas</Boton>}
        >
          Sin marca no salen en ninguna tienda.
        </Aviso>
      ) : null)}
      columnas={[
        { id: 'foto', titulo: 'Foto', ancho: 72, tarjeta: 'foto', celda: (c) => <FotoCelda src={c.imagen} forma="circulo" /> },
        { id: 'nombre', titulo: 'Nombre', ordenable: true, tarjeta: 'titulo', celda: (c) => c.nombre },
        { id: 'marcas', titulo: 'Marcas', tarjeta: 'detalle', celda: (c) => <MarcasCelda ids={c.marcas} marcas={marcas} /> },
        { id: 'orden', titulo: 'Orden', ordenable: true, ancho: 96, alinear: 'fin', tarjeta: 'detalle', celda: (c) => <NumeroCelda nombre="Orden" valor={c.orden} /> },
      ]}
      ordenes={{ nombre: porNombre, orden: porOrden }}
      ordenInicial={{ por: 'orden', dir: 'asc' }}
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
        vacio: ({ registros, filtros }) => ({
          nombre: '',
          orden: registros.reduce((m, c) => Math.max(m, c.orden + 1), 0),
          imagen: '',
          marcas: filtros.marca && filtros.marca !== SIN_MARCA ? [filtros.marca] : [],
        }),
        desde: (c) => ({ nombre: c.nombre, orden: c.orden, imagen: c.imagen, marcas: [...c.marcas] }),
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
              <Campo id={idDe('orden')} etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} ayuda="Las de número más bajo salen primero en las burbujas." onChange={(e) => cambiar('orden', e.target.value)} />
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
