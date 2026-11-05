import React, { useEffect, useId, useMemo, useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { Confirmar, useToast } from '../../Feedback';
import { CabezaAdmin, useEsconderPrincipal } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, CargarMas, ListaOrdenable } from '../../piezas/admin/Datos';
import { HojaEdicion } from '../../piezas/admin/Formularios';
import { normalizarBusqueda, ordenConParte } from '../../adaptadoresAdmin';
import s from './Lista.module.css';

/*
 * La plantilla de las listas del admin (guía: guia/ADMIN.md, D1): cabecera,
 * un aviso, filtros, la tabla, la hoja para crear o editar y la pregunta
 * antes de eliminar. Cada página pone sus columnas, sus campos y sus reglas;
 * los datos y el guardar llegan por props, como en todo el kit.
 */

const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PASO = 50;

/**
 * Una lista de registros con su hoja de edición.
 *  - cabeza: { icono, tono, titulo, subtitulo, migas, acciones } (los de CabezaAdmin)
 *  - registros · cargando · error · onReintentar · nombreDe(r) (r.nombre)
 *  - columnas: las de TablaAdmin · ordenes: { [columna]: (a, b) => n } +
 *    ordenInicial ({ por, dir })
 *  - buscarEn(r) → texto (sin él, no hay buscador) · placeholder ·
 *    filtros: [{ id, etiqueta, todos, opciones, filtrar(r, valor) → bool }]
 *  - unidad: ['categoría', 'categorías'] (y el género del texto: `femenino`)
 *  - vacio: { titulo, texto } sin ningún registro
 *  - antes: un nodo entre la cabecera y los filtros (pestañas, un aviso);
 *    puede ser una función ({ filtrar(id, valor) }) para poner un filtro
 *  - masAcciones(r) → items extra del menú de cada fila (antes de Eliminar)
 *  - formulario: {
 *      nuevo: texto del botón ("Nueva categoría") · null: sin crear
 *      titulos: { nuevo, editar } · subtitulo(r?) · textoGuardar: { nuevo, editar }
 *      vacio({ registros, filtros }) → los datos de uno nuevo
 *      desde(r) → los datos para editar
 *      validar(datos, { id, registros }) → { campo: 'mensaje' } (vacío: está bien)
 *      limpiar(datos) → lo que llega a onGuardar (recortar textos, pasar a número)
 *      campos({ datos, cambiar(campo, valor), errores, idDe(campo), id, registro }) → nodos
 *      bloqueado(r) → motivo | null (no se abre para editar: avisa por qué)
 *    }
 *  - onGuardar(datos, id?) → promesa · onEliminar(id) → promesa (sin él, no se elimina)
 *  - eliminar: { texto(r), bloqueado(r) → motivo | null } (bloqueado: no pregunta, avisa)
 *  - textos: { creado, guardado, eliminado } (los toasts)
 *  - nuevoCon: datos para abrir la hoja de uno nuevo ya llena (al cambiar,
 *    se abre; p. ej. una dirección que llega por la URL)
 *  - ordenable: { fila(r) → el contenido de la fila, onGuardar(ids) → promesa,
 *    etiqueta, cabecera } — en vez de la tabla, la lista para arrastrar (como
 *    Destacados), en el orden de `ordenInicial`; tocar una fila la edita. Con
 *    un filtro o una búsqueda se ordenan solo esas y las demás no se mueven;
 *    onGuardar recibe todos los ids en el orden final. `cabecera`: los títulos
 *    de las columnas de `fila` (como los de la tabla), alineados con ellas;
 *    en el celular no se ve
 */
export function PaginaListaAdmin({
  cabeza = {}, registros = [], cargando = false, error, onReintentar, nombreDe = (r) => r.nombre,
  columnas = [], ordenes = {}, ordenInicial, buscarEn, placeholder = 'Buscar…', filtros = [], unidad = ['registro', 'registros'], femenino = false,
  vacio, antes, masAcciones, formulario, onGuardar, onEliminar, eliminar = {}, textos = {}, nuevoCon, ordenable,
}) {
  const toast = useToast();
  const uid = useId();
  const idDe = (campo) => `${uid}-${campo}`;
  const [buscar, setBuscar] = useState('');
  const [valores, setValores] = useState({});
  const [orden, setOrden] = useState(ordenInicial || null);
  const [editando, setEditando] = useState(null); // { id, inicial }
  const [datos, setDatos] = useState({});
  const [errores, setErrores] = useState({});
  const [borrar, setBorrar] = useState(null);
  const [visibles, setVisibles] = useState(PASO);

  const [manual, setManual] = useState(null); // ids en el orden que se está armando
  const [guardandoOrden, setGuardandoOrden] = useState(false);

  const filtrar = (id, valor) => { setValores((v) => ({ ...v, [id]: valor })); setVisibles(PASO); setManual(null); };
  const filas = useMemo(() => {
    const q = normalizarBusqueda(buscar);
    const lista = registros.filter((r) => (
      (!q || !buscarEn || normalizarBusqueda(buscarEn(r)).includes(q))
      && filtros.every((f) => !valores[f.id] || f.filtrar(r, valores[f.id]))
    ));
    const comparar = orden && ordenes[orden.por];
    if (!comparar) return lista;
    const signo = orden.dir === 'desc' ? -1 : 1;
    return [...lista].sort((a, b) => signo * comparar(a, b));
  }, [registros, buscar, valores, filtros, orden, ordenes, buscarEn]);

  // Ordenar a mano: la lista que se arma (o la de siempre) con los registros de ahora.
  const porId = useMemo(() => new Map(registros.map((r) => [r.id, r])), [registros]);
  const enLista = manual ? manual.map((id) => porId.get(id)).filter(Boolean) : filas;
  const ordenCambiado = Boolean(manual) && manual.join() !== filas.map((r) => r.id).join();
  // Con el orden sin guardar, su barra va donde estaba el botón de la página.
  useEsconderPrincipal(ordenCambiado);
  const guardarOrden = async () => {
    const comparar = ordenInicial && ordenes[ordenInicial.por];
    const todos = (comparar ? [...registros].sort(comparar) : registros).map((r) => r.id);
    setGuardandoOrden(true);
    try {
      await ordenable.onGuardar(ordenConParte(todos, manual));
      setManual(null);
      toast({ tipo: 'exito', titulo: 'Orden guardado', texto: 'Así salen en la tienda.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se guardó el orden', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setGuardandoOrden(false);
    }
  };

  const abrir = (r, extra) => {
    if (!formulario) return;
    const motivo = r && formulario.bloqueado?.(r);
    if (motivo) {
      toast({ tipo: 'aviso', titulo: `No se puede cambiar «${nombreDe(r)}»`, texto: motivo, duracion: 6000 });
      return;
    }
    const inicial = r ? formulario.desde(r) : { ...formulario.vacio({ registros, filtros: valores }), ...extra };
    setDatos(inicial);
    setErrores({});
    setEditando({ id: r?.id || null, inicial, registro: r || null });
  };
  useEffect(() => { if (nuevoCon && formulario) abrir(null, nuevoCon); }, [nuevoCon]); // eslint-disable-line react-hooks/exhaustive-deps
  const cerrar = () => setEditando(null);
  const cambiar = (campo, valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };

  const guardar = async () => {
    const nuevos = formulario.validar?.(datos, { id: editando.id, registros }) || {};
    const primero = Object.keys(nuevos).find((k) => nuevos[k]);
    if (primero) {
      setErrores(nuevos);
      document.getElementById(idDe(primero))?.focus();
      return;
    }
    await onGuardar?.(formulario.limpiar ? formulario.limpiar(datos) : datos, editando.id || undefined);
    const nombre = nombreDe({ ...editando.registro, ...datos });
    toast({ tipo: 'exito', titulo: editando.id ? (textos.guardado || 'Cambios guardados') : (textos.creado || 'Creado'), texto: nombre });
    cerrar();
  };

  const pedirBorrar = (r) => {
    const motivo = eliminar.bloqueado?.(r);
    if (motivo) {
      toast({ tipo: 'aviso', titulo: `No se puede eliminar «${nombreDe(r)}»`, texto: motivo, duracion: 6000 });
      return;
    }
    setBorrar(r);
  };
  const confirmarBorrar = async () => {
    const r = borrar;
    try {
      await onEliminar?.(r.id);
      toast({ tipo: 'exito', titulo: textos.eliminado || 'Eliminado', texto: nombreDe(r) });
      if (editando?.id === r.id) cerrar();
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo eliminar', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setBorrar(null);
    }
  };

  const buscando = Boolean(buscar) || Object.values(valores).some(Boolean);
  const nuevo = formulario?.nuevo;
  const textoVacio = buscando
    ? {
      titulo: `${femenino ? 'Ninguna' : 'Ningún'} ${unidad[0]} coincide`,
      texto: 'Prueba con otra palabra o quita los filtros.',
      accion: <Boton variante="secundario" onClick={() => { setBuscar(''); setValores({}); }}>Quitar filtros</Boton>,
    }
    : {
      titulo: vacio?.titulo || `Todavía no hay ${unidad[1]}`,
      texto: vacio?.texto,
      accion: nuevo ? <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir(null)}>{nuevo}</Boton> : undefined,
    };

  const acciones = (r) => [
    ...(formulario ? [{ id: 'editar', etiqueta: 'Editar', Icono: Pencil, accion: () => abrir(r) }] : []),
    ...(masAcciones ? masAcciones(r) : []),
    ...(onEliminar ? ['separador', { id: 'eliminar', etiqueta: 'Eliminar', Icono: Trash2, peligro: true, accion: () => pedirBorrar(r) }] : []),
  ];

  return (
    <div className={s.pagina} data-componente="PaginaListaAdmin">
      <CabezaAdmin
        {...cabeza}
        principal={nuevo ? { texto: nuevo, Icono: Plus, onClick: () => abrir(null) } : undefined}
      />

      {antes && <div className={s.antes}>{typeof antes === 'function' ? antes({ filtrar, valores }) : antes}</div>}

      {(buscarEn || filtros.length > 0) && (
        <BarraFiltros
          busqueda={buscar}
          onBusqueda={buscarEn ? (q) => { setBuscar(q); setVisibles(PASO); setManual(null); } : undefined}
          placeholder={placeholder}
          filtros={filtros.map((f) => ({ ...f, valor: valores[f.id] || '' }))}
          onFiltro={filtrar}
          total={cargando || error ? undefined : filas.length}
          unidad={unidad}
        />
      )}

      {ordenable && !cargando && !error && filas.length > 0 ? (
        <>
          {ordenable.cabecera && <div className={s.ordenCabecera} aria-hidden="true">{ordenable.cabecera}</div>}
          <ListaOrdenable
            items={enLista}
            nombreDe={nombreDe}
            onCambiar={(l) => setManual(l.map((r) => r.id))}
            etiqueta={ordenable.etiqueta || `Orden de ${cabeza.titulo || 'la lista'}`}
            render={(r) => (
              <button type="button" className={s.filaOrdenable} onClick={formulario ? () => abrir(r) : undefined} title={formulario ? `Editar ${nombreDe(r)}` : undefined}>
                {ordenable.fila(r)}
              </button>
            )}
          />
          {ordenCambiado && (
            <div className={s.guardarOrden} role="region" aria-label="Orden sin guardar">
              <span>Cambiaste el orden.</span>
              <Boton variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={() => setManual(null)} disabled={guardandoOrden}>Deshacer</Boton>
              <Boton icono={<Check aria-hidden="true" />} cargando={guardandoOrden} onClick={guardarOrden}>Guardar orden</Boton>
            </div>
          )}
        </>
      ) : (
        <>
          <TablaAdmin
            etiqueta={cabeza.titulo}
            columnas={columnas}
            filas={filas.slice(0, visibles)}
            nombreDe={nombreDe}
            cargando={cargando}
            error={error}
            onReintentar={onReintentar}
            vacio={textoVacio}
            orden={orden}
            onOrden={setOrden}
            onFila={formulario ? abrir : undefined}
            acciones={acciones}
          />
          <CargarMas visibles={Math.min(visibles, filas.length)} total={filas.length} onMas={() => setVisibles((v) => v + PASO)} paso={PASO} unidad={unidad} />
        </>
      )}

      {formulario && (
        <HojaEdicion
          abierta={Boolean(editando)}
          titulo={editando?.id ? formulario.titulos.editar : formulario.titulos.nuevo}
          subtitulo={formulario.subtitulo ? formulario.subtitulo(editando?.registro) : (editando?.registro ? nombreDe(editando.registro) : undefined)}
          onCerrar={cerrar}
          onGuardar={guardar}
          sucio={Boolean(editando) && !mismo(datos, editando.inicial)}
          textoGuardar={editando?.id ? (formulario.textoGuardar?.editar || 'Guardar cambios') : (formulario.textoGuardar?.nuevo || 'Crear')}
          extra={editando?.id && onEliminar ? (
            <Boton variante="fantasma" className={s.eliminar} icono={<Trash2 aria-hidden="true" />} onClick={() => pedirBorrar(editando.registro)}>
              Eliminar
            </Boton>
          ) : null}
        >
          {editando && formulario.campos({ datos, cambiar, errores, idDe, id: editando.id, registro: editando.registro })}
        </HojaEdicion>
      )}

      <Confirmar
        abierta={Boolean(borrar)}
        titulo={borrar ? `¿Eliminar «${nombreDe(borrar)}»?` : ''}
        texto={borrar ? (eliminar.texto ? eliminar.texto(borrar) : 'No se puede deshacer.') : ''}
        confirmar="Eliminar"
        peligro
        onConfirmar={confirmarBorrar}
        onCancelar={() => setBorrar(null)}
      />
    </div>
  );
}
