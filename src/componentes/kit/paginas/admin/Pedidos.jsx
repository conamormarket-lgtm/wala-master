import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, EstadoVacio } from '../../Feedback';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { BarraFiltros, CargarMas } from '../../piezas/admin/Datos';
import { Cifra, FilaCifras } from '../../piezas/admin/Metricas';
import { TarjetaEnvio, EsqueletoEnvio } from '../../piezas/admin/Pedidos';
import { FILTROS_RECEPCION, pedidoEnFiltro, resumenRecepcion, textoDePedido, normalizarBusqueda } from '../../adaptadoresAdmin';
import s from './Pedidos.module.css';

/*
 * D3 · Pedidos y pagos. D3a: Recepción de pedidos (solo lectura del ERP).
 */

const PASO = 30;
const soles = (n) => `S/ ${(Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Recepción de pedidos (/admin/recepcion-pedidos): los pedidos del portal
 * para organizar los envíos. Las cifras de arriba filtran la lista.
 *  - pedidos: [normalizarPedidoRecepcion] · cargando · actualizando · error (texto)
 *  - onActualizar() · detalleDe(pedido) → a dónde lleva "Ver detalle"
 */
export function PaginaRecepcion({ pedidos = [], cargando = false, actualizando = false, error, onActualizar, detalleDe }) {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [visibles, setVisibles] = useState(PASO);
  const r = useMemo(() => resumenRecepcion(pedidos), [pedidos]);

  const filtrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    return pedidos.filter((p) => pedidoEnFiltro(p, estado) && (!q || normalizarBusqueda(textoDePedido(p)).includes(q)));
  }, [pedidos, estado, busqueda]);

  const filtrar = (v) => { setEstado((e) => (e === v ? '' : v)); setVisibles(PASO); };
  const limpiar = () => { setEstado(''); setBusqueda(''); setVisibles(PASO); };
  const actualizar = onActualizar && (
    <Boton tamano="sm" variante="secundario" icono={<RefreshCw aria-hidden="true" />} cargando={actualizando} onClick={onActualizar}>Actualizar</Boton>
  );

  let cuerpo;
  if (error) {
    cuerpo = (
      <Aviso tipo="error" titulo="No pudimos cargar los pedidos del ERP" accion={onActualizar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onActualizar}>Reintentar</Boton>}>
        {error}
      </Aviso>
    );
  } else if (cargando) {
    cuerpo = <div className={s.rejilla} aria-busy="true">{Array.from({ length: 6 }, (_, i) => <EsqueletoEnvio key={i} />)}</div>;
  } else if (!filtrados.length) {
    cuerpo = pedidos.length ? (
      <EstadoVacio titulo="Ningún pedido coincide" texto="Prueba con otro estado o busca otra cosa.">
        <Boton variante="secundario" onClick={limpiar}>Quitar filtros</Boton>
      </EstadoVacio>
    ) : (
      <EstadoVacio imagen="/assets/kapi/3d/kapi-hambre-256.webp" titulo="Todavía no hay pedidos del portal" texto="Cuando entre uno, aparece aquí con su dirección de entrega." />
    );
  } else {
    cuerpo = (
      <>
        <div className={s.rejilla}>
          {filtrados.slice(0, visibles).map((p) => <TarjetaEnvio key={p.id || p.codigo} pedido={p} detalle={detalleDe?.(p)} />)}
        </div>
        <CargarMas visibles={Math.min(visibles, filtrados.length)} total={filtrados.length} paso={PASO} onMas={() => setVisibles((v) => v + PASO)} unidad={['pedido', 'pedidos']} />
      </>
    );
  }

  return (
    <div className={s.pagina} data-componente="PaginaRecepcion">
      <CabezaAdmin icono="pedidos" tono="menta" titulo="Recepción de pedidos" subtitulo="Los pedidos del portal para organizar los envíos: lo primero de cada uno es a dónde va." acciones={actualizar} />
      {!error && (
        <FilaCifras etiqueta="Resumen de pedidos">
          <Cifra nombre="Por entregar" valor={r.porEntregar} tono="violeta" cargando={cargando} activo={estado === 'por_entregar'} onClick={() => filtrar('por_entregar')} />
          <Cifra nombre="Pagos pendientes" valor={r.pendientesPago} tono="aviso" cargando={cargando} activo={estado === 'por_confirmar_pago'} onClick={() => filtrar('por_confirmar_pago')} />
          <Cifra nombre="En producción" valor={r.enProduccion} tono="cielo" cargando={cargando} activo={estado === 'en_preparacion'} onClick={() => filtrar('en_preparacion')} />
          <Cifra nombre="Entregados" valor={r.entregados} tono="exito" cargando={cargando} activo={estado === 'entregado'} onClick={() => filtrar('entregado')} />
          <Cifra nombre="Monto total" valor={soles(r.montoTotal)} ayuda={`${r.total} pedidos`} tono="neutro" cargando={cargando} />
        </FilaCifras>
      )}
      {!error && (
        <BarraFiltros
          busqueda={busqueda}
          onBusqueda={(t) => { setBusqueda(t); setVisibles(PASO); }}
          placeholder="Buscar por nombre, código o dirección"
          filtros={[{ id: 'estado', etiqueta: 'Estado', todos: 'Todos', opciones: FILTROS_RECEPCION, valor: estado }]}
          onFiltro={(_, v) => { setEstado(v); setVisibles(PASO); }}
          total={cargando ? undefined : filtrados.length}
          unidad={['pedido', 'pedidos']}
        />
      )}
      {cuerpo}
    </div>
  );
}
