import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { listUsers, buscarClientes, getDatosPersonalesAggregate } from '../../../services/adminUserInsights';
import { getPerfilesPorUid } from '../../../services/adminProductInterest';
import { fmtInt } from '../dashboard/dashShared';
import { Tarjeta, Columnas, Cifras, Vacio } from './piezas';
import ContactoCarrito from './ContactoCarrito';
import FichaCliente from './FichaCliente';
import styles from './Clientes.module.css';

/*
 * Clientes: ¿quiénes son y qué hacen? Carritos abandonados (del resumen
 * diario) con WhatsApp a quien lo aceptó, una sola lista de clientes con su
 * ficha y búsqueda entre todos, y los próximos cumpleaños.
 */

const soles = (cents) =>
  `S/ ${((Number(cents) || 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (ms) =>
  (ms ? new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const enDias = (n) => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`);
const PAGINA = 25;

function ListaClientes() {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [preparando, setPreparando] = useState(null);

  // Espera a que deje de escribir antes de buscar (una consulta, no una por letra).
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 400);
    return () => clearTimeout(t);
  }, [texto]);

  const listaQ = useInfiniteQuery({
    queryKey: ['adminUserInsights', 'users', PAGINA],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await listUsers({ pageSize: PAGINA, cursor: pageParam || null });
      if (error) throw new Error(error);
      return data;
    },
    initialPageParam: null,
    getNextPageParam: (ultima) => (ultima.hasMore && ultima.cursor ? ultima.cursor : undefined),
    staleTime: 5 * 60 * 1000,
  });
  const buscarQ = useQuery({
    queryKey: ['resultados-buscar-clientes', busqueda],
    queryFn: async () => {
      const { data, error } = await buscarClientes(busqueda, PAGINA);
      if (error) throw new Error(error);
      return data;
    },
    enabled: busqueda.length >= 2,
    staleTime: 60 * 1000,
  });

  const cargados = useMemo(() => {
    const porUid = new Map();
    (listaQ.data?.pages || []).forEach((p) => (p.users || []).forEach((u) => { if (!porUid.has(u.uid)) porUid.set(u.uid, u); }));
    return [...porUid.values()];
  }, [listaQ.data]);
  const buscando = busqueda.length >= 2;
  const filas = buscando ? (buscarQ.data || []) : cargados;

  const preparar = async () => {
    if (!window.confirm('Esto revisa todos los perfiles de clientes y les agrega lo necesario para buscarlos. ¿Seguir?')) return;
    setPreparando('Preparando…');
    try {
      const res = await httpsCallable(getFunctions(), 'reindexarBusquedaClientes')({});
      setPreparando(`Listo: ${fmtInt(res.data?.revisados)} perfiles revisados, ${fmtInt(res.data?.actualizados)} actualizados.`);
      buscarQ.refetch();
    } catch (e) {
      setPreparando(`No se pudo: ${e?.message || e}`);
    }
  };

  return (
    <Tarjeta id="lista-clientes" titulo="Clientes" ayuda="Toca un cliente para ver su ficha: lo que mira, su carrito, su lista de deseos y sus fechas.">
      <input
        id="buscar-clientes"
        type="search"
        className={styles.buscador}
        placeholder="Buscar por nombre, correo, DNI o teléfono"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label="Buscar clientes"
      />
      {buscando && !buscarQ.isLoading && filas.length === 0 && (
        <p className={styles.nota}>
          Nadie coincide con "{busqueda}".{' '}
          <button type="button" className={styles.enlace} onClick={preparar} disabled={Boolean(preparando && preparando.endsWith('…'))}>
            ¿Falta alguien? Preparar la búsqueda
          </button>
        </p>
      )}
      {preparando && <p className={styles.nota}>{preparando}</p>}

      {(buscando ? buscarQ.isLoading : listaQ.isLoading) ? (
        <Vacio>Cargando clientes…</Vacio>
      ) : (buscando ? buscarQ.isError : listaQ.isError) ? (
        <Vacio>No se pudieron cargar: {(buscarQ.error || listaQ.error)?.message}</Vacio>
      ) : (
        <ul className={styles.lista}>
          {filas.map((u) => {
            const activo = abierto === u.uid;
            return (
              <li key={u.uid}>
                <button type="button" className={activo ? styles.filaActiva : styles.fila} aria-expanded={activo} onClick={() => setAbierto(activo ? null : u.uid)}>
                  <span className={styles.nombre}>{u.nombre || 'Sin nombre'}</span>
                  <span className={styles.detalle}>
                    {[u.email, u.dni].filter(Boolean).join(' · ')}
                    {u.cartCount > 0 && ` · ${fmtInt(u.cartUnits)} en el carrito`}
                  </span>
                </button>
                {activo && <FichaCliente uid={u.uid} email={u.email} />}
              </li>
            );
          })}
        </ul>
      )}
      {!buscando && listaQ.hasNextPage && (
        <button type="button" className={styles.mas} onClick={() => listaQ.fetchNextPage()} disabled={listaQ.isFetchingNextPage}>
          {listaQ.isFetchingNextPage ? 'Cargando…' : 'Ver más clientes'}
        </button>
      )}
    </Tarjeta>
  );
}

export default function Clientes() {
  const { analitica } = useOutletContext();
  const { data } = analitica;

  const carritos = useMemo(() => data?.abandonedCarts || [], [data?.abandonedCarts]);
  const uids = useMemo(() => [...new Set(carritos.map((c) => c.uid).filter(Boolean))].sort(), [carritos]);
  const perfilesQ = useQuery({
    queryKey: ['admin-carritos-perfiles', uids],
    queryFn: () => getPerfilesPorUid(uids),
    enabled: uids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const datosQ = useQuery({
    queryKey: ['adminUserInsights', 'datos', 800],
    queryFn: async () => {
      const { data: d, error } = await getDatosPersonalesAggregate({ maxDocs: 800 });
      if (error && !d) throw new Error(error);
      return d;
    },
    staleTime: 10 * 60 * 1000,
  });
  const cumples = datosQ.data?.proximosCumpleanos || [];

  return (
    <div className={styles.pagina}>
      <Cifras items={[
        { label: 'Carritos abandonados', valor: fmtInt(data?.carritosAbandonados?.cantidad?.total || 0), sub: soles(data?.carritosAbandonados?.valorCents?.total || 0) },
        { label: 'Cumpleaños en 30 días', valor: datosQ.data ? fmtInt(cumples.length) : '—' },
        { label: 'Usaron la app', valor: data?.personas ? fmtInt(data.personas.app) : '—', sub: 'Personas en el periodo' },
      ]}
      />

      <Tarjeta
        id="carritos"
        titulo="Carritos abandonados"
        ayuda="Agregaron productos y no terminaron el pedido. El botón abre WhatsApp con el mensaje listo; lo envías tú."
      >
        {carritos.length === 0 ? (
          <Vacio>Nadie dejó su carrito en este periodo.</Vacio>
        ) : (
          <div className={styles.tablaScroll}>
            <table className={styles.tabla}>
              <thead>
                <tr><th>Cliente</th><th>Valor</th><th>Cuándo</th><th>Escribirle</th></tr>
              </thead>
              <tbody>
                {carritos.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.displayName || perfilesQ.data?.get(c.uid)?.displayName || c.email
                        || perfilesQ.data?.get(c.uid)?.email || (c.uid ? 'Cliente' : 'Visitante sin cuenta')}
                    </td>
                    <td>{soles(c.lastCartValue)}</td>
                    <td>{fecha(c.abandonedAtMs)}</td>
                    <td><ContactoCarrito cart={c} perfil={perfilesQ.data?.get(c.uid)} cargando={perfilesQ.isLoading} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Columnas>
        <ListaClientes />
        <Tarjeta
          id="cumpleanos"
          titulo="Próximos cumpleaños"
          ayuda="De tus clientes y de las personas que agendaron, en los próximos 30 días."
          acciones={<Link to="/admin/fechas-importantes" className={styles.enlace}>Fechas importantes</Link>}
        >
          {datosQ.isLoading ? <Vacio>Cargando…</Vacio> : cumples.length === 0 ? (
            <Vacio>No hay cumpleaños en los próximos 30 días.</Vacio>
          ) : (
            <ul className={styles.cumples}>
              {cumples.slice(0, 15).map((c, i) => (
                <li key={`${c.uid}-${c.fecha}-${c.dePersona}-${i}`}>
                  <span className={c.enDias <= 7 ? styles.pronto : styles.dias}>{enDias(c.enDias)}</span>
                  <span className={styles.cumpleTexto}>
                    <strong>{c.esTitular ? c.nombre : c.dePersona}</strong>
                    <span>{c.fechaLegible || c.fecha}{!c.esTitular && ` · lo agendó ${c.nombre}`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {datosQ.data?.truncated && (
            <p className={styles.nota}>Se revisaron los primeros {fmtInt(datosQ.data.docsLeidos)} perfiles.</p>
          )}
        </Tarjeta>
      </Columnas>
    </div>
  );
}
