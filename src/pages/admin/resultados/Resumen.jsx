import React, { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import KpiRow from '../../../components/dashboard/KpiRow';
import TrendChart from '../../../components/dashboard/charts/TrendChart';
import { useProducts } from '../../../hooks/useProducts';
import { getEnlacesRotos } from '../../../services/adminEnlacesRotos';
import EnlacesRotos, { CLAVE_ENLACES_ROTOS } from '../dashboard/EnlacesRotos';
import { fmtInt, fmtTime, prettyRouteName, calcularDelta, calcularDeltaPuntos } from '../dashboard/dashShared';
import { cosasPorMejorar } from './cosasPorMejorar.mjs';
import { DESTINOS } from './rutas';
import { Tarjeta, Columnas, Vacio } from './piezas';
import styles from './Resumen.module.css';

/*
 * Resumen de Resultados: ¿cómo va mi tienda? Cuatro números con su cambio
 * contra el periodo anterior, lo que conviene mejorar, las visitas por día,
 * de dónde vienen y quién está ahora en la tienda. Todo sale del resumen
 * diario (analytics_daily), salvo "En vivo" y los enlaces rotos.
 */

const soles = (cents) =>
  `S/ ${((Number(cents) || 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const porCien = (pedidos, visitas) => (visitas > 0 ? Math.round((pedidos / visitas) * 1000) / 10 : 0);
const fmtPorCien = (v) => (Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 });
const fechaCorta = (key) => (key ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : '');

const NOMBRES_COBRO = {
  sorteo: ['ticket de sorteo', 'tickets de sorteo'],
  suscripcion: ['suscripción', 'suscripciones'],
  saldo: ['pago de saldo', 'pagos de saldo'],
  pago_rapido: ['pago rápido', 'pagos rápidos'],
  otro: ['otro cobro', 'otros cobros'],
};

function OtrosCobros({ cobros }) {
  const fuentes = Object.entries(cobros || {}).filter(([, c]) => c?.cantidad > 0);
  if (!fuentes.length) return null;
  const porMoneda = {};
  fuentes.forEach(([, c]) => Object.entries(c.porMoneda || {}).forEach(([m, cents]) => {
    porMoneda[m] = (porMoneda[m] || 0) + cents;
  }));
  const montos = Object.entries(porMoneda)
    .map(([m, cents]) => (m === 'PEN' ? soles(cents) : `${m} ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`))
    .join(' + ');
  const detalle = fuentes
    .map(([f, c]) => `${fmtInt(c.cantidad)} ${(NOMBRES_COBRO[f] || NOMBRES_COBRO.otro)[c.cantidad === 1 ? 0 : 1]}`)
    .join(' · ');
  return (
    <p className={styles.otrosCobros}>
      <strong>Otros cobros: {montos}</strong> <span>({detalle}). No son pedidos de la tienda, por eso van aparte.</span>
    </p>
  );
}

function Aviso({ aviso }) {
  const destino = DESTINOS[aviso.destino];
  const contenido = (
    <>
      <span className={styles.avisoTitulo}>{aviso.titulo}</span>
      <span className={styles.avisoTexto}>{aviso.texto}</span>
    </>
  );
  return (
    <li className={`${styles.aviso} ${styles[`nivel_${aviso.nivel}`]}`}>
      {destino?.startsWith('#') ? (
        <a href={destino} className={styles.avisoEnlace}>{contenido}</a>
      ) : destino ? (
        <Link to={destino} className={styles.avisoEnlace}>{contenido}</Link>
      ) : contenido}
    </li>
  );
}

export default function Resumen() {
  const { filtros, analitica } = useOutletContext();
  const { data, anterior, isLoading, error } = analitica;
  const hayAnterior = Boolean(filtros.compare && anterior && anterior.diasConVentas > 0);
  const [canal, setCanal] = useState('');

  // Nombres del catálogo (con ocultos: un producto retirado igual se nombra).
  const { data: catalogo } = useProducts([], { includeHidden: true });
  const nombres = useMemo(() => new Map((catalogo || []).map((p) => [String(p.id), p.name])), [catalogo]);

  // Enlaces rotos del rango (misma consulta que la tarjeta de abajo).
  const { data: rotos } = useQuery({
    queryKey: [CLAVE_ENLACES_ROTOS, filtros.dateRange.startDateMs, filtros.dateRange.endDateMs],
    queryFn: async () => {
      const res = await getEnlacesRotos(filtros.dateRange);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const enlacesRotos = (rotos?.enlaces || []).filter((e) => !e.resueltaA).length;

  const visitas = data?.visitas?.total?.total || 0;
  const pedidos = data?.ventas?.pedidos?.total || 0;
  const ingresos = data?.ventas?.ingresosCents?.total || 0;
  const canalSel = canal ? (data?.canales || []).find((c) => c.canal === canal) : null;

  const kpis = useMemo(() => {
    const delta = (actual, previo) => (hayAnterior ? calcularDelta(actual, previo) : null) || {};
    const conv = porCien(pedidos, visitas);
    const convPrevia = hayAnterior ? porCien(anterior.pedidos?.total || 0, anterior.visitas?.total || 0) : null;
    const deltaConv = hayAnterior ? calcularDeltaPuntos(conv, convPrevia) : null;
    const base = [
      {
        label: 'Visitas',
        value: visitas,
        format: fmtInt,
        accent: '#6D28D9',
        info: 'Personas que entraron a la tienda o a la app. Si alguien vuelve antes de 30 minutos, es la misma visita. No cuenta robots ni al equipo.',
        ...delta(visitas, anterior?.visitas?.total),
      },
      {
        label: 'Pedidos',
        value: pedidos,
        format: fmtInt,
        accent: '#0E7F57',
        info: 'Pedidos enviados desde la tienda o la app, aunque todavía no estén pagados.',
        ...delta(pedidos, anterior?.pedidos?.total),
      },
      {
        label: 'Ventas',
        value: ingresos,
        format: soles,
        accent: '#B45309',
        info: 'Suma de lo que llevan esos pedidos (precio por cantidad). No incluye sorteos, suscripciones ni pagos de saldo.',
        ...delta(ingresos, anterior?.ingresosCents?.total),
      },
      {
        label: 'De cada 100 visitas compran',
        value: conv,
        format: fmtPorCien,
        accent: '#BE185D',
        info: 'Pedidos ÷ visitas × 100.',
        ...(deltaConv ? { ...deltaConv, delta: deltaConv.delta.replace(' pp', '') } : {}),
      },
    ];
    if (!canalSel) return base;
    const nota = ` Solo visitas de ${canalSel.canal}.`;
    const sinDelta = ({ delta: _d, deltaPositive: _p, ...k }) => k;
    return [
      { ...sinDelta(base[0]), value: canalSel.visitas, info: base[0].info + nota },
      { ...sinDelta(base[1]), value: canalSel.pedidos, info: base[1].info + nota },
      { ...sinDelta(base[2]), info: `${base[2].info} Las ventas no se separan por canal: es el total.` },
      { ...sinDelta(base[3]), value: porCien(canalSel.pedidos, canalSel.visitas), info: base[3].info + nota },
    ];
  }, [visitas, pedidos, ingresos, hayAnterior, anterior, canalSel]);

  const avisos = useMemo(() => cosasPorMejorar({
    masVistos: data?.topProducts,
    topVendidos: data?.topVendidos,
    carritos: data?.carritosAbandonados,
    embudo: data?.funnelStats?.events,
    busquedas: data?.topSearches,
    enlacesRotos,
    visitas: data?.visitas,
    nombres,
  }), [data, enlacesRotos, nombres]);

  const serie = useMemo(
    () => (data?.visitasPorDia || []).map((d) => ({ name: fechaCorta(d.day), total: d.total })),
    [data?.visitasPorDia]
  );

  const enVivo = data?.realtimeSessionsDetails || [];
  const sinVentasTodavia = data && !data.diasConResultados;

  if (error) return <div className={styles.error}>No se pudieron cargar los resultados: {error.message}</div>;
  if (isLoading && !data) return <div className={styles.cargando}>Cargando resultados…</div>;

  return (
    <div className={styles.resumen}>
      <KpiRow items={kpis} />

      {canalSel && (
        <p className={styles.filtroCanal}>
          Mostrando solo visitas de <strong>{canalSel.canal}</strong>.{' '}
          <button type="button" onClick={() => setCanal('')}>Ver todas</button>
        </p>
      )}
      <OtrosCobros cobros={data?.otrosCobros} />
      {sinVentasTodavia && (
        <p className={styles.nota}>
          Los pedidos y las ventas de este periodo todavía no están sumados. Se cuentan desde el 24/10/2026;
          para los días anteriores, usa "Reconstruir el resumen diario" en Detalle técnico.
        </p>
      )}
      {filtros.compare && !hayAnterior && (
        <p className={styles.nota}>El periodo anterior todavía no tiene pedidos ni ventas sumados: no se puede comparar.</p>
      )}

      <Columnas>
        <Tarjeta id="mejorar" titulo="Cosas por mejorar">
          {avisos.length ? (
            <ul className={styles.avisos}>
              {avisos.map((a) => <Aviso key={a.id} aviso={a} />)}
            </ul>
          ) : (
            <Vacio>Nada urgente en este periodo. Sigue así.</Vacio>
          )}
        </Tarjeta>

        <Tarjeta id="visitas-dia" titulo="Visitas por día">
          <TrendChart
            data={serie}
            series={[{ key: 'total', name: 'Visitas', color: '#6D28D9' }]}
            xKey="name"
            height={220}
            formatY={(v) => fmtInt(v)}
            emptyText="Sin visitas en este periodo."
          />
        </Tarjeta>
      </Columnas>

      <Columnas>
        <Tarjeta
          id="canales"
          titulo="De dónde vienen"
          ayuda="Los 3 canales con más visitas. Toca uno para ver los números solo de ahí."
          acciones={<Link to={{ pathname: DESTINOS.visitantes, search: filtros.filtersSearch }} className={styles.verMas}>Ver todos</Link>}
        >
          {(data?.canales || []).length === 0 ? (
            <Vacio>Sin datos de origen en este periodo.</Vacio>
          ) : (
            <div className={styles.tablaScroll}>
              <table className={styles.tabla}>
                <thead>
                  <tr><th>Canal</th><th>Visitas</th><th>Pedidos</th><th>De cada 100 compran</th></tr>
                </thead>
                <tbody>
                  {data.canales.slice(0, 3).map((c) => {
                    const activo = canal === c.canal;
                    return (
                      <tr key={c.canal} className={activo ? styles.filaActiva : ''}>
                        <td>
                          <button type="button" className={styles.botonCanal} aria-pressed={activo} onClick={() => setCanal(activo ? '' : c.canal)}>
                            {c.canal}
                          </button>
                        </td>
                        <td>{fmtInt(c.visitas)}</td>
                        <td>{fmtInt(c.pedidos)}</td>
                        <td>{fmtPorCien(porCien(c.pedidos, c.visitas))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta id="en-vivo" titulo={<>Ahora en la tienda <span className={styles.contador}>{fmtInt(enVivo.length)}</span></>}>
          {enVivo.length ? (
            <ul className={styles.vivo}>
              {enVivo.slice(0, 10).map((s) => (
                <li key={s.id}>
                  <span className={s.hasAccount ? styles.conCuenta : styles.visitante}>
                    {s.hasAccount ? (s.displayName || s.email || 'Cliente') : 'Visitante'}
                  </span>
                  <span className={styles.vivoPagina}>{prettyRouteName(s.lastPath)}</span>
                  <span className={styles.vivoHora}>{fmtTime(s.lastSeenAtMs)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Nadie navegando en este momento.</Vacio>
          )}
        </Tarjeta>
      </Columnas>

      {enlacesRotos > 0 && (
        <div id="enlaces">
          <EnlacesRotos dateRange={filtros.dateRange} />
        </div>
      )}
    </div>
  );
}
