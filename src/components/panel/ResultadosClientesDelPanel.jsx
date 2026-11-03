import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { listUsers, buscarClientes, getDatosPersonalesAggregate, getUserFicha } from '../../services/adminUserInsights';
import { getPerfilesPorUid } from '../../services/adminProductInterest';
import { getUserAnalytics } from '../../services/adminAnalytics';
import { recomendarSimilares } from '../../services/analytics/productInterest.mjs';
import { useProducts } from '../../hooks/useProducts';
import AdminEncuestaEntregas from '../../pages/admin/AdminEncuestaEntregas';
import AdminRespuestasEncuesta from '../../pages/admin/AdminRespuestasEncuesta';
import { PaginaClientesResultados, PaginaOpinionesResultados } from '../../componentes/kit/paginas/admin/Resultados';

/*
 * Resultados (D4c): Clientes (carritos abandonados, la lista con su ficha
 * al costado y los próximos cumpleaños) y Opiniones (las dos encuestas).
 * Son pestañas del marco de ResultadosDelPanel: reciben por el Outlet
 * { filtros, analitica, periodo }. Las consultas, sus claves y sus límites
 * son los de Clientes.jsx, FichaCliente.jsx y Opiniones.jsx de antes, así
 * comparten la caché con las páginas viejas.
 */

const PAGINA = 25;

/**
 * La ficha del cliente abierto → las props de FichaCliente. El perfil sale
 * de getUserFicha; la actividad (getUserAnalytics), solo con la pestaña
 * Resumen o Interés; el catálogo, solo con una ficha abierta (como antes,
 * que se pedía al abrirla).
 */
function useFichaCliente(cliente, pestana) {
  const uid = cliente?.uid || null;
  const email = cliente?.email || null;

  const fichaQ = useQuery({
    queryKey: ['adminUserInsights', 'ficha', uid],
    queryFn: async () => {
      const { data, error } = await getUserFicha(uid);
      if (error && !data) throw new Error(error);
      return data;
    },
    enabled: Boolean(uid),
    staleTime: 5 * 60 * 1000,
  });
  const actividadQ = useQuery({
    queryKey: ['admin-analytics-user-detail', uid, email],
    queryFn: async () => {
      const { data, error } = await getUserAnalytics(uid, email);
      if (error) throw new Error(error);
      return data;
    },
    enabled: Boolean(uid) && (pestana === 'resumen' || pestana === 'mira'),
    staleTime: 5 * 60 * 1000,
  });
  const { data: catalogo } = useProducts([], { includeHidden: true, enabled: Boolean(uid) });
  const porId = useMemo(() => new Map((catalogo || []).map((p) => [String(p.id), p])), [catalogo]);
  const recomendados = useMemo(
    () => recomendarSimilares(actividadQ.data?.productInterest || [], catalogo || [], 6)
      .map((p) => ({ id: p.id, nombre: p.name, imagen: p.mainImage || p.images?.[0], detalle: `S/ ${p.salePrice || p.price}` })),
    [actividadQ.data, catalogo]
  );

  if (!uid) return {};
  return {
    ficha: fichaQ.data,
    cargando: fichaQ.isLoading,
    error: fichaQ.isError ? fichaQ.error?.message || 'No se encontró el perfil.' : undefined,
    actividad: actividadQ.data,
    cargandoActividad: actividadQ.isLoading,
    errorActividad: actividadQ.isError ? actividadQ.error?.message : undefined,
    productoDe: (id) => {
      const p = porId.get(String(id));
      return p ? { nombre: p.name, imagen: p.mainImage || p.images?.[0] } : null;
    },
    recomendados,
  };
}

/** Clientes: carritos abandonados con WhatsApp, la lista de clientes con su ficha y los cumpleaños. */
export function ClientesResultadosDelPanel() {
  const { analitica } = useOutletContext();
  const { data } = analitica;
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [pestanaFicha, setPestanaFicha] = useState('resumen');

  // Los perfiles de quienes dejaron su carrito: su nombre y si aceptan WhatsApp.
  const uids = useMemo(() => [...new Set((data?.abandonedCarts || []).map((c) => c.uid).filter(Boolean))].sort(), [data?.abandonedCarts]);
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

  // La lista de a 25 y, con texto (la página ya esperó a que deje de escribir), la búsqueda entre todos.
  const listaQ = useInfiniteQuery({
    queryKey: ['adminUserInsights', 'users', PAGINA],
    queryFn: async ({ pageParam }) => {
      const { data: d, error } = await listUsers({ pageSize: PAGINA, cursor: pageParam || null });
      if (error) throw new Error(error);
      return d;
    },
    initialPageParam: null,
    getNextPageParam: (ultima) => (ultima.hasMore && ultima.cursor ? ultima.cursor : undefined),
    staleTime: 5 * 60 * 1000,
  });
  const buscando = busqueda.length >= 2;
  const buscarQ = useQuery({
    queryKey: ['resultados-buscar-clientes', busqueda],
    queryFn: async () => {
      const { data: d, error } = await buscarClientes(busqueda, PAGINA);
      if (error) throw new Error(error);
      return d;
    },
    enabled: buscando,
    staleTime: 60 * 1000,
  });
  const cargados = useMemo(() => {
    const porUid = new Map();
    (listaQ.data?.pages || []).forEach((p) => (p.users || []).forEach((u) => { if (!porUid.has(u.uid)) porUid.set(u.uid, u); }));
    return [...porUid.values()];
  }, [listaQ.data]);
  const consulta = buscando ? buscarQ : listaQ;

  const ficha = useFichaCliente(abierto, pestanaFicha);

  return (
    <PaginaClientesResultados
      datos={data}
      perfiles={perfilesQ.data}
      cargandoPerfiles={perfilesQ.isLoading}
      cumpleanos={datosQ.data}
      cargandoCumpleanos={datosQ.isLoading}
      clientes={buscando ? (buscarQ.data || []) : cargados}
      cargandoClientes={consulta.isLoading}
      errorClientes={consulta.isError ? consulta.error?.message || 'No se pudo cargar.' : undefined}
      hayMas={Boolean(listaQ.hasNextPage)}
      onMas={() => listaQ.fetchNextPage()}
      cargandoMas={listaQ.isFetchingNextPage}
      onBuscar={setBusqueda}
      onPrepararBusqueda={async () => {
        const res = await httpsCallable(getFunctions(), 'reindexarBusquedaClientes')({});
        // La página vuelve a pedir el mismo texto: como la clave no cambia, se repite aquí (igual que antes).
        buscarQ.refetch();
        return res.data;
      }}
      ficha={ficha}
      onAbrir={(c) => { setAbierto(c); setPestanaFicha('resumen'); }}
      pestanaFicha={pestanaFicha}
      onPestanaFicha={setPestanaFicha}
      fechasImportantes="/admin/fechas-importantes"
    />
  );
}

// El día 'AAAA-MM-DD' en la hora del aparato, como lo pide AdminRespuestasEncuesta.
const pad = (n) => String(n).padStart(2, '0');
const diaLocal = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Opiniones: el selector de encuesta y, debajo, la de hoy embebida con el
 * periodo de Resultados (las dos se rehacen en el kit en D5).
 */
export function OpinionesDelPanel() {
  const { filtros, periodo } = useOutletContext();
  const [encuesta, setEncuesta] = useState('entregas');
  const { startDateMs, endDateMs } = filtros.dateRange;
  // Con "Comparar", cada número lleva su cambio contra el periodo anterior.
  const previo = filtros.compare && filtros.prevDateRange ? filtros.prevDateRange : null;
  const contra = periodo.dia ? periodo.contra : 'antes';

  return (
    <PaginaOpinionesResultados encuesta={encuesta} onEncuesta={setEncuesta}>
      {encuesta === 'entregas' ? (
        <AdminEncuestaEntregas
          embebido
          desdeMs={startDateMs}
          hastaMs={endDateMs}
          previo={previo && { desdeMs: previo.startDateMs, hastaMs: previo.endDateMs, contra }}
        />
      ) : (
        <AdminRespuestasEncuesta
          embebido
          desde={diaLocal(startDateMs)}
          hasta={diaLocal(endDateMs)}
          previo={previo && { desde: diaLocal(previo.startDateMs), hasta: diaLocal(previo.endDateMs), contra }}
        />
      )}
    </PaginaOpinionesResultados>
  );
}
