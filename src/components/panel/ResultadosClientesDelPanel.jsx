import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { listUsers, buscarClientes, getDatosPersonalesAggregate, getUserFicha } from '../../services/adminUserInsights';
import { getPerfilesPorUid } from '../../services/adminProductInterest';
import { getUserAnalytics } from '../../services/adminAnalytics';
import { recomendarSimilares } from '../../services/analytics/productInterest.mjs';
import { useProducts } from '../../hooks/useProducts';
import { getCollection, deleteDocument } from '../../services/firebase/firestore';
import { getProduct } from '../../services/products';
import { PORTAL_USERS_COLLECTION } from '../../constants/userCollections';
import { getSurveyConfig, saveSurveyConfig, configEntregaPanel, DEFAULT_SURVEY_CONFIG } from '../../services/encuestaConfig';
import { configConHistorial } from '../../services/encuestaHistorial.mjs';
import { embudoEncuesta, EMBUDO_DESDE } from '../../services/surveyResponses.mjs';
import { PaginaClientesResultados, PaginaOpinionesResultados } from '../../componentes/kit/paginas/admin/Resultados';
import { RespuestasEntregas, RespuestasEncuesta, PaginaResenasProductos } from '../../componentes/kit/paginas/admin/Encuestas';
import { configConPregunta } from '../../componentes/kit/adaptadoresAdmin';
import useLoViejo from '../../hooks/useLoViejo';
import { sinError } from './comun';

// Las respuestas de antes (D5e): solo bajan con el interruptor adminClientesViejo.
const EntregasViejo = lazy(() => import('../../pages/admin/AdminEncuestaEntregas'));
const RegalosViejo = lazy(() => import('../../pages/admin/AdminRespuestasEncuesta'));

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

// El día 'AAAA-MM-DD' en la hora del aparato, como lo piden RespuestasEncuesta y AdminRespuestasEncuesta.
const pad = (n) => String(n).padStart(2, '0');
const diaLocal = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const CINCO_MIN = 5 * 60 * 1000;
// La config de la encuesta tal cual (getSurveyConfig): la misma clave que el
// editor de /admin/encuestas (EncuestaDelPanel, en AvisosDelPanel.jsx).
const CLAVE_CONFIG_ENCUESTA = ['admin-encuesta-config'];

/**
 * "Cómo les fue con su pedido" (D5e), como AdminEncuestaEntregas: las
 * respuestas las da el servidor (resultadosEncuestaEntrega: la colección no
 * tiene reglas para el navegador) y la config es entregaPanel de la encuesta,
 * leída al entrar. Sin config leída no se ofrece editarla: se guardarían los
 * valores de siempre encima.
 */
function EntregasDelPanel({ desdeMs, hastaMs, previo }) {
  const queryClient = useQueryClient();
  const respuestas = useQuery({
    queryKey: ['admin-encuesta-entregas'],
    queryFn: async () => (await httpsCallable(getFunctions(), 'resultadosEncuestaEntrega')()).data,
    staleTime: CINCO_MIN,
  });
  const config = useQuery({
    queryKey: CLAVE_CONFIG_ENCUESTA,
    queryFn: () => sinError(getSurveyConfig()),
    staleTime: 0,
    refetchOnMount: true,
  });

  return (
    <RespuestasEntregas
      config={config.data?.entregaPanel}
      onGuardarConfig={config.data ? async (e) => {
        const entregaPanel = configEntregaPanel(e);
        await sinError(saveSurveyConfig({ entregaPanel }));
        queryClient.setQueryData(CLAVE_CONFIG_ENCUESTA, (antes) => (antes ? { ...antes, entregaPanel } : antes));
        queryClient.invalidateQueries({ queryKey: ['encuesta-entrega-config'] });
      } : undefined}
      respuestas={respuestas.data?.respuestas || []}
      cargando={respuestas.isLoading}
      error={respuestas.error ? respuestas.error.message || 'No se pudieron cargar las respuestas.' : undefined}
      onActualizar={() => respuestas.refetch()}
      actualizando={respuestas.isFetching && !respuestas.isLoading}
      desdeMs={desdeMs}
      hastaMs={hastaMs}
      previo={previo}
    />
  );
}

// Pasos de la encuesta (analytics_events, survey_step) entre dos días 'YYYY-MM-DD',
// como cargarEmbudo de AdminRespuestasEncuesta: antes de EMBUDO_DESDE no se registraban.
async function cargarEmbudo(desde, hasta) {
  const inicio = desde && desde > EMBUDO_DESDE ? desde : EMBUDO_DESDE;
  const filtros = [
    { field: 'type', operator: '==', value: 'survey_step' },
    { field: 'clientTsMs', operator: '>=', value: new Date(`${inicio}T00:00`).getTime() },
  ];
  if (hasta) filtros.push({ field: 'clientTsMs', operator: '<=', value: new Date(`${hasta}T23:59:59.999`).getTime() });
  const res = await getCollection('analytics_events', filtros);
  if (res.error) throw new Error(res.error);
  return embudoEncuesta(res.data || []);
}

/**
 * La encuesta de regalos (D5e), como AdminRespuestasEncuesta: los perfiles
 * con la encuesta completa y la config en una sola consulta, el embudo del
 * periodo y, si se compara y ese periodo tiene días medidos, el del anterior.
 */
function EncuestaRegalosDelPanel({ desde, hasta, previo }) {
  const datos = useQuery({
    queryKey: ['admin-respuestas-encuesta'],
    queryFn: async () => {
      const [usuariosRes, configRes] = await Promise.all([
        getCollection(PORTAL_USERS_COLLECTION, [{ field: 'hasCompletedSurvey', operator: '==', value: true }]),
        getSurveyConfig(),
      ]);
      if (usuariosRes.error) throw new Error(usuariosRes.error);
      return {
        usuarios: usuariosRes.data || [],
        config: { ...DEFAULT_SURVEY_CONFIG, ...(configRes.data || {}) },
      };
    },
    staleTime: CINCO_MIN,
  });

  const desdeEmbudo = desde && desde > EMBUDO_DESDE ? desde : EMBUDO_DESDE;
  const embudo = useQuery({
    queryKey: ['admin-embudo-encuesta', desdeEmbudo, hasta],
    queryFn: () => cargarEmbudo(desdeEmbudo, hasta),
    staleTime: CINCO_MIN,
  });
  const prevDesde = previo?.desde;
  const prevHasta = previo?.hasta;
  const embudoPrevioMedido = Boolean(prevHasta && prevHasta >= EMBUDO_DESDE);
  const embudoPrevio = useQuery({
    queryKey: ['admin-embudo-encuesta', prevDesde > EMBUDO_DESDE ? prevDesde : EMBUDO_DESDE, prevHasta],
    queryFn: () => cargarEmbudo(prevDesde, prevHasta),
    enabled: embudoPrevioMedido,
    staleTime: CINCO_MIN,
  });

  return (
    <RespuestasEncuesta
      usuarios={datos.data?.usuarios || []}
      config={datos.data?.config}
      cargando={datos.isLoading}
      error={datos.error ? datos.error.message || 'No se pudieron cargar las respuestas.' : undefined}
      onActualizar={() => datos.refetch()}
      actualizando={datos.isFetching && !datos.isLoading}
      desde={desde}
      hasta={hasta}
      previo={previo}
      embudo={embudo.data}
      embudoPrevio={embudoPrevioMedido ? embudoPrevio.data : undefined}
      cargandoEmbudo={embudo.isLoading}
      errorEmbudo={embudo.error ? embudo.error.message || 'No se pudo cargar.' : undefined}
      onVolverAPreguntar={async (que) => {
        // Sobre la config guardada de ahora (no la de la pantalla), con el historial: se borra la fecha de retiro.
        const { data: actual, error } = await getSurveyConfig();
        if (error || !actual) throw new Error(error || 'No se encontró la encuesta.');
        await sinError(saveSurveyConfig(configConHistorial(configConPregunta(actual, que), actual)));
        await datos.refetch();
      }}
    />
  );
}

/**
 * Opiniones: el selector de encuesta y, debajo, la elegida con el periodo
 * de Resultados (D5e). Cada encuesta lee sus datos solo mientras se ve,
 * como las pantallas de antes.
 */
const msDeFecha = (f) => (typeof f?.toMillis === 'function' ? f.toMillis() : typeof f?.seconds === 'number' ? f.seconds * 1000 : Number(new Date(f)) || 0);

/** Las reseñas de product_reviews con el nombre de su producto, de la más nueva a la más vieja. */
async function leerResenas() {
  const crudas = await sinError(getCollection('product_reviews', [], { field: 'createdAt', direction: 'desc' }));
  const ids = [...new Set((crudas || []).map((r) => r.productId).filter(Boolean))];
  const productos = new Map(await Promise.all(ids.map(async (id) => [id, (await getProduct(id)).data || null])));
  return (crudas || []).map((r) => ({
    id: r.id,
    producto: productos.get(r.productId)?.name || '',
    productoUrl: r.productId ? `/producto/${r.productId}` : '',
    estrellas: Number(r.rating) || 0,
    comentario: String(r.comment || ''),
    nombre: r.userName || '',
    fecha: msDeFecha(r.createdAt),
    fotos: Array.isArray(r.imageUrls) ? r.imageUrls.filter(Boolean) : [],
  }));
}

/** Resultados › Opiniones › Reseñas de productos: verlas y borrar las que no sirven. */
function ResenasDelPanel() {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['admin-resenas-productos'], queryFn: leerResenas, staleTime: 60 * 1000 });
  return (
    <PaginaResenasProductos
      resenas={q.data || []}
      cargando={q.isLoading}
      error={q.error ? q.error.message || 'No se pudieron leer.' : undefined}
      onReintentar={() => q.refetch()}
      onBorrar={async (id) => {
        await sinError(deleteDocument('product_reviews', id));
        await queryClient.invalidateQueries({ queryKey: ['admin-resenas-productos'] });
        // La ficha del producto las lee con su propia clave.
        await queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      }}
    />
  );
}

export function OpinionesDelPanel() {
  const { filtros, periodo } = useOutletContext();
  const [encuesta, setEncuesta] = useState('entregas');
  const { startDateMs, endDateMs } = filtros.dateRange;
  // Con "Comparar", cada número lleva su cambio contra el periodo anterior.
  const previo = filtros.compare && filtros.prevDateRange ? filtros.prevDateRange : null;
  const contra = periodo.dia ? periodo.contra : 'antes';
  const viejas = useLoViejo('adminClientes');

  if (viejas) {
    return (
      <PaginaOpinionesResultados encuesta={encuesta} onEncuesta={setEncuesta}>
        <Suspense fallback={null}>
          {encuesta === 'entregas' ? (
            <EntregasViejo embebido desdeMs={startDateMs} hastaMs={endDateMs} previo={previo && { desdeMs: previo.startDateMs, hastaMs: previo.endDateMs, contra }} />
          ) : (
            <RegalosViejo embebido desde={diaLocal(startDateMs)} hasta={diaLocal(endDateMs)} previo={previo && { desde: diaLocal(previo.startDateMs), hasta: diaLocal(previo.endDateMs), contra }} />
          )}
        </Suspense>
      </PaginaOpinionesResultados>
    );
  }

  return (
    <PaginaOpinionesResultados encuesta={encuesta} onEncuesta={setEncuesta}>
      {encuesta === 'resenas' ? <ResenasDelPanel /> : encuesta === 'entregas' ? (
        <EntregasDelPanel
          desdeMs={startDateMs}
          hastaMs={endDateMs}
          previo={previo && { desdeMs: previo.startDateMs, hastaMs: previo.endDateMs, contra }}
        />
      ) : (
        <EncuestaRegalosDelPanel
          desde={diaLocal(startDateMs)}
          hasta={diaLocal(endDateMs)}
          previo={previo && { desde: diaLocal(previo.startDateMs), hasta: diaLocal(previo.endDateMs), contra }}
        />
      )}
    </PaginaOpinionesResultados>
  );
}
