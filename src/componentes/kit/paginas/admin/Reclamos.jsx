import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, useToast } from '../../Feedback';
import { Campo } from '../../Formulario';
import { Etiqueta } from '../../Etiquetas';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { TablaAdmin, BarraFiltros, CargarMas, InsigniaEstado } from '../../piezas/admin/Datos';
import { HojaEdicion, GrupoCampos } from '../../piezas/admin/Formularios';
import { Cifra, FilaCifras } from '../../piezas/admin/Metricas';
import { plazoDeReclamo, respuestaDeReclamo, textoDeReclamo, normalizarBusqueda } from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Reclamos.module.css';

/*
 * D3c · Libro de reclamaciones (/admin/libro-reclamaciones): lo que dejó
 * cada consumidor, cuánto falta del plazo para responder y la respuesta.
 * Lo que se guarda al responder es lo de antes (respuestaDeReclamo).
 */

const PASO = 50;
const ESTADOS_RECLAMO = {
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  respondido: { texto: 'Respondido', tono: 'exito' },
  por_vencer: { texto: 'Por vencer', tono: 'aviso' },
  vencido: { texto: 'Fuera de plazo', tono: 'peligro' },
};
const fecha = (ms, hora = true) => (ms ? new Date(ms).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', ...(hora && { hour: '2-digit', minute: '2-digit' }) }) : '—');

function textoPlazo(p) {
  if (!p) return '';
  if (p.quedan < 0) return `Pasó el plazo hace ${-p.quedan} ${p.quedan === -1 ? 'día hábil' : 'días hábiles'}`;
  if (p.quedan === 0) return 'Hoy es el último día hábil';
  return `Quedan ${p.quedan} ${p.quedan === 1 ? 'día hábil' : 'días hábiles'}`;
}

/* Un dato con su nombre, en la hoja. */
const Dato = ({ nombre, children }) => (children ? <div className={s.dato}><dt>{nombre}</dt><dd>{children}</dd></div> : null);

/**
 * Libro de reclamaciones.
 *  - reclamos: [reclamoDesdeFirestore] · plazo (días hábiles; config/empresa.js) · cargando · error · onActualizar()
 *  - onResponder(id, datos de respuestaDeReclamo) → promesa
 *  - ahora (para las pruebas)
 */
export function PaginaReclamos({ reclamos = [], plazo = 15, cargando = false, actualizando = false, error, onActualizar, onResponder, ahora: ahoraFuera }) {
  const toast = useToast();
  const [abriendo] = useState(() => Date.now());
  const ahora = ahoraFuera ?? abriendo;
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState({ estado: '', tipo: '' });
  const [visibles, setVisibles] = useState(PASO);
  const [abierto, setAbierto] = useState(null);
  const [respuesta, setRespuesta] = useState('');

  const conPlazo = useMemo(() => reclamos.map((r) => ({ ...r, plazo: plazoDeReclamo(r, plazo, ahora) })), [reclamos, plazo, ahora]);
  const cuentas = useMemo(() => ({
    pendientes: conPlazo.filter((r) => r.estado === 'pendiente').length,
    porVencer: conPlazo.filter((r) => r.plazo?.estado === 'por_vencer').length,
    vencidos: conPlazo.filter((r) => r.plazo?.estado === 'vencido').length,
    respondidos: conPlazo.filter((r) => r.estado === 'respondido').length,
  }), [conPlazo]);

  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return conPlazo
      .filter((r) => {
        if (filtros.tipo && r.tipo !== filtros.tipo) return false;
        if (filtros.estado === 'urgentes') return r.plazo && r.plazo.estado !== 'a_tiempo';
        if (filtros.estado && r.estado !== filtros.estado) return false;
        return !q || normalizarBusqueda(textoDeReclamo(r)).includes(q);
      })
      // Los pendientes primero, el que menos plazo tiene arriba; después los respondidos, el más nuevo primero.
      .sort((a, b) => (a.plazo && b.plazo ? a.plazo.quedan - b.plazo.quedan : a.plazo ? -1 : b.plazo ? 1 : (b.creadoMs || 0) - (a.creadoMs || 0)));
  }, [conPlazo, filtros, busqueda]);

  const filtrar = (id, v) => { setFiltros((f) => ({ ...f, [id]: f[id] === v && id === 'estado' ? '' : v })); setVisibles(PASO); };
  const abrir = (r) => { setAbierto(r); setRespuesta(''); };
  const responder = async () => {
    const r = respuestaDeReclamo(respuesta);
    if (r.error) throw new Error(r.error);
    await onResponder?.(abierto.id, r.datos);
    toast({ tipo: 'exito', titulo: 'Reclamo respondido', texto: abierto.codigo });
    setAbierto(null);
  };

  const r = abierto;
  return (
    <div className={s.pagina} data-componente="PaginaReclamos">
      <CabezaAdmin
        icono="reclamos"
        tono="menta"
        titulo="Libro de reclamaciones"
        subtitulo={`Lo que dejan los consumidores en la tienda. Hay ${plazo} días hábiles para responder cada uno.`}
        acciones={onActualizar && <Boton tamano="sm" variante="secundario" icono={<RefreshCw aria-hidden="true" />} cargando={actualizando} onClick={onActualizar}>Actualizar</Boton>}
      />

      {!error && !cargando && cuentas.vencidos > 0 && (
        <Aviso tipo="error" titulo={`${cuentas.vencidos} ${cuentas.vencidos === 1 ? 'reclamo pasó' : 'reclamos pasaron'} el plazo`} accion={<Boton tamano="sm" variante="contorno" onClick={() => filtrar('estado', 'urgentes')}>Ver los urgentes</Boton>}>
          Respóndelos cuanto antes: el plazo de {plazo} días hábiles ya venció.
        </Aviso>
      )}

      {!error && (
        <FilaCifras etiqueta="Resumen del libro">
          <Cifra nombre="Pendientes" valor={cuentas.pendientes} tono="aviso" cargando={cargando} activo={filtros.estado === 'pendiente'} onClick={() => filtrar('estado', 'pendiente')} />
          <Cifra nombre="Urgentes" valor={cuentas.porVencer + cuentas.vencidos} ayuda={cuentas.vencidos ? `${cuentas.vencidos} fuera de plazo` : '3 días hábiles o menos'} tono="peligro" cargando={cargando} activo={filtros.estado === 'urgentes'} onClick={() => filtrar('estado', 'urgentes')} />
          <Cifra nombre="Respondidos" valor={cuentas.respondidos} tono="exito" cargando={cargando} activo={filtros.estado === 'respondido'} onClick={() => filtrar('estado', 'respondido')} />
          <Cifra nombre="En total" valor={reclamos.length} tono="neutro" cargando={cargando} />
        </FilaCifras>
      )}

      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={(t) => { setBusqueda(t); setVisibles(PASO); }}
        placeholder="Buscar por código, nombre, documento o correo"
        filtros={[
          { id: 'estado', etiqueta: 'Estado', todos: 'Todos', opciones: [{ valor: 'pendiente', texto: 'Pendientes' }, { valor: 'urgentes', texto: 'Urgentes' }, { valor: 'respondido', texto: 'Respondidos' }], valor: filtros.estado },
          { id: 'tipo', etiqueta: 'Tipo', todos: 'Reclamos y quejas', opciones: [{ valor: 'reclamo', texto: 'Reclamos' }, { valor: 'queja', texto: 'Quejas' }], valor: filtros.tipo },
        ]}
        onFiltro={(id, v) => { setFiltros((f) => ({ ...f, [id]: v })); setVisibles(PASO); }}
        total={cargando || error ? undefined : filtrados.length}
        unidad={['reclamo', 'reclamos']}
      />

      <TablaAdmin
        etiqueta="Reclamos"
        filas={filtrados.slice(0, visibles)}
        nombreDe={(x) => x.codigo}
        cargando={cargando}
        error={error}
        onReintentar={onActualizar}
        onFila={abrir}
        vacio={reclamos.length
          ? { titulo: 'Ningún reclamo coincide', texto: 'Prueba con otro estado o busca otra cosa.' }
          : { titulo: 'El libro está vacío', texto: 'Cuando alguien deje un reclamo o una queja, aparece aquí.' }}
        columnas={[
          { id: 'codigo', titulo: 'Código', tarjeta: 'titulo', celda: (x) => <>{x.codigo}<span className={l.sub}>{fecha(x.creadoMs)}</span></> },
          { id: 'consumidor', titulo: 'Consumidor', tarjeta: 'detalle', celda: (x) => <>{x.consumidor.nombre || '—'}<span className={l.sub}>{x.consumidor.documento}</span></> },
          { id: 'tipo', titulo: 'Tipo', ancho: 100, tarjeta: 'detalle', celda: (x) => (x.tipo === 'queja' ? 'Queja' : 'Reclamo') },
          { id: 'bien', titulo: 'Sobre', tarjeta: 'detalle', celda: (x) => <span className={s.corto}>{x.bien.descripcion || '—'}</span> },
          {
            id: 'estado', titulo: 'Estado', ancho: 190, tarjeta: 'estado',
            celda: (x) => (x.estado === 'respondido'
              ? <InsigniaEstado estado="respondido" estados={ESTADOS_RECLAMO} />
              : <span className={s.plazo}><InsigniaEstado estado={x.plazo?.estado === 'a_tiempo' ? 'pendiente' : x.plazo?.estado || 'pendiente'} estados={ESTADOS_RECLAMO} /><span className={l.sub}>{textoPlazo(x.plazo)}</span></span>),
          },
        ]}
      />
      <CargarMas visibles={Math.min(visibles, filtrados.length)} total={filtrados.length} paso={PASO} onMas={() => setVisibles((v) => v + PASO)} unidad={['reclamo', 'reclamos']} />

      <HojaEdicion
        abierta={Boolean(r)}
        titulo={r ? `${r.tipo === 'queja' ? 'Queja' : 'Reclamo'} ${r.codigo}` : ''}
        subtitulo={r ? `Llegó el ${fecha(r.creadoMs)}${r.plazo ? ` · ${textoPlazo(r.plazo)}` : ''}` : ''}
        onCerrar={() => setAbierto(null)}
        onGuardar={r?.estado === 'pendiente' ? responder : undefined}
        sucio={Boolean(respuesta.trim())}
        textoGuardar="Marcar como respondido"
        puedeGuardar={Boolean(respuesta.trim())}
      >
        {r && (
          <>
            <GrupoCampos titulo="El consumidor">
              <dl className={s.datos}>
                <Dato nombre="Nombre">{r.consumidor.nombre}{r.consumidor.esMenor && <> <Etiqueta tono="neutro">Menor de edad</Etiqueta></>}</Dato>
                <Dato nombre="Apoderado">{r.consumidor.apoderado}</Dato>
                <Dato nombre="Documento">{r.consumidor.documento}</Dato>
                <Dato nombre="Correo">{r.consumidor.email && <a href={`mailto:${r.consumidor.email}`}>{r.consumidor.email}</a>}</Dato>
                <Dato nombre="Teléfono">{r.consumidor.telefono}</Dato>
                <Dato nombre="Domicilio">{r.consumidor.domicilio}</Dato>
              </dl>
            </GrupoCampos>
            <GrupoCampos titulo={r.bien.tipo === 'servicio' ? 'El servicio' : 'El producto'}>
              <dl className={s.datos}>
                <Dato nombre="Qué">{r.bien.descripcion}</Dato>
                <Dato nombre="Monto reclamado">{r.bien.monto != null && `S/ ${r.bien.monto.toFixed(2)}`}</Dato>
              </dl>
            </GrupoCampos>
            <GrupoCampos titulo={r.tipo === 'queja' ? 'La queja' : 'El reclamo'}>
              <dl className={s.datos}>
                <Dato nombre="Detalle"><span className={s.largo}>{r.detalle}</span></Dato>
                <Dato nombre="Lo que pide"><span className={s.largo}>{r.pedido}</span></Dato>
              </dl>
            </GrupoCampos>
            {r.estado === 'respondido' ? (
              <GrupoCampos titulo="La respuesta">
                <div className={s.respuesta}>
                  <p>{r.respuesta || 'Sin texto guardado.'}</p>
                  {r.respondidoMs && <span className={l.sub}>Respondido el {fecha(r.respondidoMs)}</span>}
                </div>
              </GrupoCampos>
            ) : (
              <GrupoCampos titulo="Tu respuesta" ayuda="Al marcarlo como respondido ya no se puede cambiar.">
                <Campo etiqueta="Respuesta al consumidor" multilinea={5} placeholder="Escribe la respuesta…" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
              </GrupoCampos>
            )}
          </>
        )}
      </HojaEdicion>
    </div>
  );
}
