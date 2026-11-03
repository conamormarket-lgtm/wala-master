import React, { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Aviso, useToast } from '../../Feedback';
import Boton from '../../Boton';
import { Campo } from '../../Formulario';
import { ListaOrdenable } from '../../piezas/admin/Datos';
import { HojaEdicion, GrupoCampos, CampoImagen } from '../../piezas/admin/Formularios';
import { mismoNombre, ordenConParte } from '../../adaptadoresAdmin';
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
const TODAS = '';

// El orden de la tienda: el número y, con el mismo, el nombre.
const enOrden = (lista) => [...lista].sort((a, b) => (a.orden - b.orden) || porNombre(a, b));
const idsDe = (lista) => lista.map((c) => c.id).join(',');

/**
 * Ordenar arrastrando (o con las flechas): todas, o solo las de una marca
 * (las demás no se mueven de su lugar). Al guardar se numeran de nuevo,
 * 1, 2, 3…, con onGuardarOrden(ids en el orden final).
 */
function HojaOrdenar({ abierta, categorias, marcas, onCerrar, onGuardarOrden }) {
  const toast = useToast();
  const [marca, setMarca] = useState(TODAS);
  const todas = useMemo(() => enOrden(categorias), [categorias]);
  const deLaMarca = useMemo(() => (marca ? todas.filter((c) => c.marcas.includes(marca)) : todas), [todas, marca]);
  const [lista, setLista] = useState(deLaMarca);
  const [antes, setAntes] = useState(deLaMarca);
  // Al abrir, al cambiar de marca o si llegan otras categorías: la lista guardada.
  if (antes !== deLaMarca) {
    setAntes(deLaMarca);
    setLista(deLaMarca);
  }
  const sucio = idsDe(lista) !== idsDe(deLaMarca);
  const nombreMarca = marcas.find((m) => m.id === marca)?.nombre;

  return (
    <HojaEdicion
      abierta={abierta}
      titulo="Ordenar categorías"
      subtitulo={nombreMarca ? `Las burbujas de ${nombreMarca}. Las demás no se mueven.` : 'Así salen en las burbujas y los filtros: la primera, primero.'}
      onCerrar={() => { setMarca(TODAS); onCerrar(); }}
      sucio={sucio}
      puedeGuardar={sucio}
      textoGuardar="Guardar orden"
      onGuardar={async () => {
        await onGuardarOrden(ordenConParte(todas.map((c) => c.id), lista.map((c) => c.id)));
        toast({ tipo: 'exito', titulo: 'Orden guardado', texto: nombreMarca ? `Así salen en ${nombreMarca}.` : 'Así salen en la tienda.' });
        setMarca(TODAS);
        onCerrar();
      }}
    >
      <GrupoCampos titulo="Cuáles">
        <Campo
          etiqueta="Marca"
          opciones={[{ valor: TODAS, texto: 'Todas las categorías' }, ...marcas.map((m) => ({ valor: m.id, texto: m.nombre }))]}
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          disabled={sucio}
          ayuda={sucio ? 'Guarda o deshaz este orden para cambiar de marca.' : 'Elige una para ordenar solo sus burbujas.'}
        />
      </GrupoCampos>
      <GrupoCampos titulo="El orden" ayuda="Arrastra desde el asa o usa las flechas.">
        {lista.length ? (
          <ListaOrdenable
            items={lista}
            nombreDe={(c) => c.nombre}
            onCambiar={setLista}
            etiqueta="Orden de las categorías"
            render={(c) => (
              <span className={s.fila}>
                <FotoCelda src={c.imagen} forma="circulo" tamano={36} />
                <span className={s.nombre}>{c.nombre}</span>
              </span>
            )}
          />
        ) : <p className={s.nota}>Esta marca no tiene categorías.</p>}
        {sucio && <Boton variante="fantasma" tamano="sm" onClick={() => setLista(deLaMarca)}>Deshacer</Boton>}
      </GrupoCampos>
    </HojaEdicion>
  );
}

/**
 * La lista de categorías con su hoja para crear o editar.
 *  - categorias: [{ id, nombre, imagen, orden, marcas: [ids] }]
 *  - marcas: [{ id, nombre, logo }]
 *  - cargando · error · onReintentar
 *  - onGuardar(datos, id?) → promesa (sin id: nueva) · onEliminar(id) → promesa
 *  - onGuardarOrden(ids) → promesa: todas, en el orden nuevo (sin él, no hay "Ordenar")
 *  - subirImagen(blob, { alAvanzar }) → promesa con la url
 */
export function PaginaCategorias({ categorias = [], marcas = [], cargando = false, error, onReintentar, onGuardar, onEliminar, onGuardarOrden, subirImagen }) {
  const sinMarca = categorias.filter((c) => !c.marcas.length).length;
  const [ordenando, setOrdenando] = useState(false);
  const puedeOrdenar = onGuardarOrden && !cargando && !error && categorias.length > 1;
  return (
    <>
      <PaginaListaAdmin
        cabeza={{
          icono: 'categorias',
          titulo: 'Categorías',
          subtitulo: 'Las burbujas y los filtros de cada marca. Una categoría puede estar en varias marcas.',
          acciones: puedeOrdenar ? <Boton variante="secundario" icono={<ArrowUpDown aria-hidden="true" />} onClick={() => setOrdenando(true)}>Ordenar</Boton> : undefined,
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
                <Campo id={idDe('orden')} etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} ayuda={onGuardarOrden ? 'Las de número más bajo salen primero. Más fácil: «Ordenar», arriba, y arrastrarlas.' : 'Las de número más bajo salen primero en las burbujas.'} onChange={(e) => cambiar('orden', e.target.value)} />
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
      {puedeOrdenar && <HojaOrdenar abierta={ordenando} categorias={categorias} marcas={marcas} onCerrar={() => setOrdenando(false)} onGuardarOrden={onGuardarOrden} />}
    </>
  );
}
