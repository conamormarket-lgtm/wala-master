import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Pestanas } from '../../Navegacion';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoImagen, CampoDinero } from '../../piezas/admin/Formularios';
import { ATRIBUTOS, mismoNombre } from '../../adaptadoresAdmin';
import { PaginaListaAdmin } from './Lista';
import { FotoCelda, MarcasCelda, NumeroCelda, ElegirMarcas, porNombre, porOrden } from './celdas';
import s from './Lista.module.css';

/*
 * Las listas simples del catálogo (D1), sobre PaginaListaAdmin:
 * colecciones, atributos (tipos, etiquetas y personajes) y zonas de envío. Categorías y Marcas tienen su propio archivo. Datos en la forma
 * de adaptadoresAdmin.js; guardar, eliminar y subir llegan como promesas.
 */

const siguienteOrden = (registros) => registros.reduce((m, r) => Math.max(m, (Number(r.orden) || 0) + 1), 0);
const repetido = (registros, nombre, id) => registros.find((r) => r.id !== id && mismoNombre(r.nombre, nombre));
const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/* ── Colecciones ───────────────────────────────────────── */

/**
 * Colecciones del catálogo (/admin/colecciones): nombre, foto y orden.
 * La foto es ancha (un banner): sale en las tarjetas de la sección
 * «Colecciones con foto» del builder (TarjetaColeccion), no en círculo como
 * las categorías.
 *  - colecciones: [{ id, nombre, imagen, orden }] (coleccionDesdeFirestore)
 *  - cargando · error · onReintentar · onGuardar(datos, id?) · onEliminar(id) · subirImagen
 *  - onGuardarOrden(ids) → promesa: todas, en el orden nuevo. Con él, la lista
 *    se arrastra (como Categorías) y una nueva va al final sola
 */
export function PaginaColecciones({ colecciones = [], cargando, error, onReintentar, onGuardar, onEliminar, onGuardarOrden, subirImagen }) {
  return (
    <PaginaListaAdmin
      cabeza={{
        icono: 'colecciones',
        titulo: 'Colecciones',
        subtitulo: onGuardarOrden
          ? 'Grupos de productos (Anime, Navidad, Parejas…), en este orden: arrástralas para cambiarlo. Su foto sale en «Colecciones con foto».'
          : 'Grupos de productos: Anime, Navidad, Parejas… Su foto sale en «Colecciones con foto».',
      }}
      registros={colecciones}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      unidad={['colección', 'colecciones']}
      femenino
      buscarEn={(c) => c.nombre}
      placeholder="Buscar una colección"
      columnas={[
        { id: 'foto', titulo: 'Foto', ancho: 128, tarjeta: 'foto', celda: (c) => <FotoCelda src={c.imagen} forma="ancha" /> },
        { id: 'nombre', titulo: 'Nombre', ordenable: true, tarjeta: 'titulo', celda: (c) => c.nombre },
        ...(onGuardarOrden ? [] : [{ id: 'orden', titulo: 'Orden', ordenable: true, ancho: 96, alinear: 'fin', tarjeta: 'detalle', celda: (c) => <NumeroCelda nombre="Orden" valor={c.orden} /> }]),
      ]}
      ordenes={{ nombre: porNombre, orden: porOrden }}
      ordenInicial={{ por: 'orden', dir: 'asc' }}
      ordenable={onGuardarOrden ? {
        etiqueta: 'Orden de las colecciones',
        onGuardar: onGuardarOrden,
        cabecera: <span className={s.ordenFila}><span>Foto</span><span>Nombre</span></span>,
        fila: (c) => (
          <span className={s.ordenFila}>
            <FotoCelda src={c.imagen} forma="ancha" tamano={36} />
            <span className={s.ordenNombre}>{c.nombre}</span>
          </span>
        ),
      } : undefined}
      vacio={{ texto: 'Crea la primera y después elígela en cada producto.' }}
      textos={{ creado: 'Colección creada', guardado: 'Colección guardada', eliminado: 'Colección eliminada' }}
      eliminar={{ texto: () => 'Deja de salir en la tienda y en sus filtros. Los productos no se borran.' }}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nueva colección',
        titulos: { nuevo: 'Nueva colección', editar: 'Editar colección' },
        textoGuardar: { nuevo: 'Crear colección' },
        // Una nueva va al final: el número siguiente al más alto.
        vacio: ({ registros }) => ({ nombre: '', orden: siguienteOrden(registros), imagen: '' }),
        desde: (c) => ({ nombre: c.nombre, orden: c.orden, imagen: c.imagen }),
        validar: (d, { id, registros }) => {
          const otra = repetido(registros, d.nombre, id);
          return { nombre: !d.nombre.trim() ? 'Escribe el nombre de la colección.' : otra ? `Ya hay una colección «${otra.nombre}».` : undefined };
        },
        limpiar: (d) => ({ ...d, nombre: d.nombre.trim(), orden: Number(d.orden) || 0 }),
        campos: ({ datos, cambiar, errores, idDe }) => (
          <>
            <GrupoCampos titulo="Datos">
              <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. Navidad 2026" value={datos.nombre} error={errores.nombre} maxLength={60} onChange={(e) => cambiar('nombre', e.target.value)} />
              {/* Con la lista para arrastrar, el orden no se escribe: una nueva va al final. */}
              {!onGuardarOrden && <Campo id={idDe('orden')} etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} ayuda="Las de número más bajo salen primero." onChange={(e) => cambiar('orden', e.target.value)} />}
            </GrupoCampos>
            <GrupoCampos titulo="Imagen">
              <CampoImagen etiqueta="Foto de la colección" ayuda="Ancha, como un banner (mejor 16:9): sale como tarjeta en «Colecciones con foto»." valor={datos.imagen} onCambiar={(url) => cambiar('imagen', url)} subir={subirImagen} forma="ancho" />
            </GrupoCampos>
          </>
        ),
      }}
    />
  );
}

/* ── Atributos ─────────────────────────────────────────── */

// Cortos: los tres entran en un celular.
const PESTANAS_ATRIBUTOS = [{ id: 'tipos', texto: 'Tipos' }, { id: 'etiquetas', texto: 'Etiquetas' }, { id: 'personajes', texto: 'Personajes' }];

/**
 * Atributos del catálogo (/admin/atributos-catalogo): tipos de producto,
 * etiquetas y personajes, cada uno en su pestaña. No se elimina un valor que
 * usa algún producto (como antes): primero hay que quitarlo de esos productos.
 *  - atributos: { tipos: [...], etiquetas: [...], personajes: [...] } con
 *    [{ id, nombre, marcas, usos }] (atributoDesdeFirestore)
 *  - marcas · cargando (de la lista o de los usos) · error · onReintentar
 *  - onGuardar(tipo, datos, id?) · onEliminar(tipo, id)
 *  - onQuitarSinUsar(tipo, ids) → promesa con { quitados, fallaron }: los que
 *    no están en ningún producto de una vez (pregunta antes, con sus nombres).
 *    Solo con la lista y los usos ya leídos: mientras cargan, todo parece "sin usar"
 *  - tipoInicial ('tipos')
 */
export function PaginaAtributos({ atributos = {}, marcas = [], cargando, error, onReintentar, onGuardar, onEliminar, onQuitarSinUsar, tipoInicial = 'tipos' }) {
  const toast = useToast();
  const [tipo, setTipo] = useState(tipoInicial);
  const [preguntar, setPreguntar] = useState(false);
  const a = ATRIBUTOS[tipo];
  const registros = atributos[tipo] || [];
  const sinUsar = !cargando && !error ? registros.filter((r) => !r.usos) : [];
  const nombres = sinUsar.map((r) => r.nombre).sort((x, y) => x.localeCompare(y, 'es'));
  const quitar = async () => {
    setPreguntar(false);
    try {
      const { quitados = 0, fallaron = [] } = (await onQuitarSinUsar(tipo, sinUsar.map((r) => r.id))) || {};
      // Etiquetas en femenino (como la lista).
      const hecho = (n) => `${tipo === 'etiquetas' ? 'quitada' : 'quitado'}${n === 1 ? '' : 's'}`;
      toast(fallaron.length
        ? { tipo: 'aviso', titulo: `${quitados} ${hecho(quitados)}; ${fallaron.length} no se pudieron`, texto: fallaron.join(', '), duracion: 7000 }
        : { tipo: 'exito', titulo: `${quitados} ${quitados === 1 ? a.singular : a.plural} sin usar ${hecho(quitados)}` });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudieron quitar', texto: err?.message || 'Vuelve a intentar.' });
    }
  };
  const opcionesMarca = useMemo(() => [...marcas.map((m) => ({ valor: m.id, texto: m.nombre })), { valor: '__todas', texto: 'De todas las marcas' }], [marcas]);
  const pestanas = PESTANAS_ATRIBUTOS.map((p) => ({ ...p, texto: `${p.texto}${atributos[p.id] ? ` · ${atributos[p.id].length}` : ''}` }));
  return (
    <PaginaListaAdmin
      key={tipo}
      cabeza={{ icono: 'atributos', titulo: 'Atributos del catálogo', subtitulo: 'Las listas que se eligen en cada producto y salen como filtros en la tienda.' }}
      antes={(
        <>
          <div className={s.desliza}><Pestanas opciones={pestanas} valor={tipo} onChange={setTipo} etiqueta="Qué lista" /></div>
          {onQuitarSinUsar && sinUsar.length > 0 && (
            <Aviso
              tipo="info"
              titulo={sinUsar.length === 1 ? `1 ${a.singular} no está en ningún producto` : `${sinUsar.length} ${a.plural} no están en ningún producto`}
              accion={<Boton tamano="sm" variante="contorno" icono={<Trash2 aria-hidden="true" />} onClick={() => setPreguntar(true)}>Quitar los sin usar</Boton>}
            >
              No salen en ningún filtro de la tienda. {tipo === 'etiquetas' ? 'Quitarlas' : 'Quitarlos'} deja la lista más corta para elegir en cada producto.
            </Aviso>
          )}
          <Confirmar
            abierta={preguntar}
            titulo={`¿Quitar ${sinUsar.length} ${sinUsar.length === 1 ? a.singular : a.plural} sin usar?`}
            texto={`${nombres.slice(0, 15).join(', ')}${nombres.length > 15 ? ` y ${nombres.length - 15} más` : ''}. No están en ningún producto (ni oculto ni borrado). No se puede deshacer.`}
            confirmar="Quitar"
            peligro
            onConfirmar={quitar}
            onCancelar={() => setPreguntar(false)}
          />
        </>
      )}
      registros={registros}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      unidad={[a.singular, a.plural]}
      femenino={tipo === 'etiquetas'}
      buscarEn={(r) => r.nombre}
      placeholder={`Buscar ${tipo === 'etiquetas' ? 'una' : 'un'} ${a.singular}`}
      filtros={a.conMarcas ? [{
        id: 'marca',
        etiqueta: 'Marca',
        todos: 'Todas',
        opciones: opcionesMarca,
        filtrar: (r, v) => (v === '__todas' ? !r.marcas.length : r.marcas.includes(v)),
      }] : []}
      columnas={[
        { id: 'nombre', titulo: 'Nombre', ordenable: true, tarjeta: 'titulo', celda: (r) => r.nombre },
        ...(a.conMarcas ? [{ id: 'marcas', titulo: 'Marcas', tarjeta: 'detalle', celda: (r) => <MarcasCelda ids={r.marcas} marcas={marcas} global /> }] : []),
        {
          id: 'usos',
          titulo: 'Productos',
          ordenable: true,
          ancho: 120,
          alinear: 'fin',
          tarjeta: 'detalle',
          celda: (r) => (r.usos ? <NumeroCelda nombre="Productos:" valor={r.usos} /> : <span className={s.sub}>Sin usar</span>),
        },
      ]}
      ordenes={{ nombre: porNombre, usos: (x, y) => (x.usos - y.usos) || porNombre(x, y) }}
      ordenInicial={{ por: 'nombre', dir: 'asc' }}
      vacio={{ texto: a.ayuda }}
      textos={{ creado: `${a.titulo}: creado`, guardado: 'Cambios guardados', eliminado: 'Eliminado' }}
      eliminar={{
        bloqueado: (r) => (r.usos ? `Está en ${r.usos} producto${r.usos === 1 ? '' : 's'}. Quítalo de esos productos primero.` : null),
        texto: () => 'No está en ningún producto. No se puede deshacer.',
      }}
      onGuardar={(d, id) => onGuardar?.(tipo, d, id)}
      onEliminar={onEliminar ? (id) => onEliminar(tipo, id) : undefined}
      formulario={{
        nuevo: `${tipo === 'etiquetas' ? 'Nueva' : 'Nuevo'} ${a.singular}`,
        titulos: { nuevo: `${tipo === 'etiquetas' ? 'Nueva' : 'Nuevo'} ${a.singular}`, editar: `Editar ${a.singular}` },
        subtitulo: (r) => (r ? `${r.nombre}${r.usos ? ` · en ${r.usos} producto${r.usos === 1 ? '' : 's'}` : ''}` : a.ayuda),
        textoGuardar: { nuevo: 'Crear' },
        vacio: () => ({ nombre: '', marcas: [] }),
        desde: (r) => ({ nombre: r.nombre, marcas: [...r.marcas] }),
        validar: (d, { id, registros: lista }) => {
          const otro = repetido(lista, d.nombre, id);
          return { nombre: !d.nombre.trim() ? 'Escribe el nombre.' : otro ? `Ya hay «${otro.nombre}» en ${a.plural}.` : undefined };
        },
        limpiar: (d) => ({ ...d, nombre: d.nombre.trim() }),
        campos: ({ datos, cambiar, errores, idDe }) => (
          <>
            <GrupoCampos titulo="Datos">
              <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder={`Ej. ${a.ejemplo}`} value={datos.nombre} error={errores.nombre} maxLength={60} onChange={(e) => cambiar('nombre', e.target.value)} />
            </GrupoCampos>
            {a.conMarcas && (
              <GrupoCampos titulo="Marcas" ayuda="Sin ninguna, sale en todas las marcas.">
                <ElegirMarcas marcas={marcas} valor={datos.marcas} onCambiar={(v) => cambiar('marcas', v)} />
              </GrupoCampos>
            )}
          </>
        ),
      }}
    />
  );
}

/* ── Zonas de envío ────────────────────────────────────── */

const textoDias = (d) => (!d ? 'Sin plazo' : d === 1 ? '1 día' : `${d} días`);

/**
 * Zonas de envío (/admin/envios): el costo y los días de entrega por
 * departamento; una zona inactiva no se ofrece.
 *  - zonas: [{ id, nombre, departamento, costo, dias, orden, activa }] (zonaDesdeFirestore)
 *  - cargando · error · onReintentar · onGuardar(datos, id?) · onEliminar(id)
 */
export function PaginaEnvios({ zonas = [], cargando, error, onReintentar, onGuardar, onEliminar }) {
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'envios', titulo: 'Zonas de envío', subtitulo: 'El costo y el tiempo de entrega por departamento.' }}
      registros={zonas}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      unidad={['zona', 'zonas']}
      femenino
      buscarEn={(z) => `${z.nombre} ${z.departamento}`}
      placeholder="Buscar una zona o departamento"
      filtros={[{
        id: 'estado',
        etiqueta: 'Estado',
        todos: 'Activas e inactivas',
        opciones: [{ valor: 'activa', texto: 'Solo activas' }, { valor: 'inactiva', texto: 'Solo inactivas' }],
        filtrar: (z, v) => (v === 'activa' ? z.activa : !z.activa),
      }]}
      columnas={[
        {
          id: 'nombre',
          titulo: 'Zona',
          ordenable: true,
          tarjeta: 'titulo',
          celda: (z) => <>{z.nombre}{z.departamento && <span className={s.sub}>{z.departamento}</span>}</>,
        },
        { id: 'costo', titulo: 'Costo', ordenable: true, ancho: 120, alinear: 'fin', tarjeta: 'detalle', celda: (z) => <span className={s.numero}>{z.costo ? soles(z.costo) : 'Gratis'}</span> },
        { id: 'dias', titulo: 'Entrega', ordenable: true, ancho: 120, alinear: 'fin', tarjeta: 'detalle', celda: (z) => textoDias(z.dias) },
        { id: 'orden', titulo: 'Orden', ordenable: true, ancho: 90, alinear: 'fin', celda: (z) => <span className={s.numero}>{z.orden}</span> },
        { id: 'estado', titulo: 'Estado', ancho: 120, tarjeta: 'estado', celda: (z) => <InsigniaEstado estado={z.activa ? 'activo' : 'oculto'}>{z.activa ? 'Activa' : 'Inactiva'}</InsigniaEstado> },
      ]}
      ordenes={{
        nombre: porNombre,
        costo: (a, b) => (a.costo - b.costo) || porNombre(a, b),
        dias: (a, b) => (a.dias - b.dias) || porNombre(a, b),
        orden: porOrden,
      }}
      ordenInicial={{ por: 'orden', dir: 'asc' }}
      vacio={{ texto: 'Crea la primera zona con su costo y sus días de entrega.' }}
      textos={{ creado: 'Zona creada', guardado: 'Zona guardada', eliminado: 'Zona eliminada' }}
      eliminar={{ texto: () => 'Deja de ofrecerse en el checkout. Si solo quieres pausarla, apágala en vez de eliminarla.' }}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nueva zona',
        titulos: { nuevo: 'Nueva zona de envío', editar: 'Editar zona' },
        textoGuardar: { nuevo: 'Crear zona' },
        vacio: ({ registros }) => ({ nombre: '', departamento: '', costo: 0, dias: 0, orden: siguienteOrden(registros), activa: true }),
        desde: (z) => ({ nombre: z.nombre, departamento: z.departamento, costo: z.costo, dias: z.dias, orden: z.orden, activa: z.activa }),
        validar: (d, { id, registros }) => {
          const otra = repetido(registros, d.nombre, id);
          return {
            nombre: !d.nombre.trim() ? 'Escribe el nombre de la zona.' : otra ? `Ya hay una zona «${otra.nombre}».` : undefined,
            costo: Number(d.costo) < 0 ? 'El costo no puede ser negativo.' : undefined,
            dias: Number(d.dias) < 0 ? 'Los días no pueden ser negativos.' : undefined,
          };
        },
        limpiar: (d) => ({ ...d, nombre: d.nombre.trim(), departamento: d.departamento.trim(), costo: Number(d.costo) || 0, dias: Math.round(Number(d.dias) || 0), orden: Number(d.orden) || 0 }),
        campos: ({ datos, cambiar, errores, idDe }) => (
          <>
            <GrupoCampos titulo="Zona">
              <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. Lima Metropolitana" value={datos.nombre} error={errores.nombre} maxLength={60} onChange={(e) => cambiar('nombre', e.target.value)} />
              <Campo id={idDe('departamento')} etiqueta="Departamento" placeholder="Ej. Lima" value={datos.departamento} onChange={(e) => cambiar('departamento', e.target.value)} />
            </GrupoCampos>
            <GrupoCampos titulo="Costo y entrega" columnas={2}>
              <CampoDinero id={idDe('costo')} etiqueta="Costo" value={datos.costo} error={errores.costo} ayuda={Number(datos.costo) ? undefined : 'En 0, el envío sale gratis.'} onChange={(e) => cambiar('costo', e.target.value)} />
              <Campo id={idDe('dias')} etiqueta="Días de entrega" type="number" inputMode="numeric" min={0} step="1" value={datos.dias} error={errores.dias} onChange={(e) => cambiar('dias', e.target.value)} />
              <Campo id={idDe('orden')} etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} onChange={(e) => cambiar('orden', e.target.value)} />
            </GrupoCampos>
            <GrupoCampos titulo="Estado">
              <Interruptor etiqueta="Zona activa" descripcion="Apagada, no se ofrece en el checkout (no se borra)." activo={datos.activa} onChange={(v) => cambiar('activa', v)} />
            </GrupoCampos>
          </>
        ),
      }}
    />
  );
}
