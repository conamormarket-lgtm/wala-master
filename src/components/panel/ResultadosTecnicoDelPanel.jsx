import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import HeatmapViewer from '../dashboard/HeatmapViewer';
import { deriveAppUsage } from '../../services/analytics/derive';
import {
  fetchHeatmapBatches, aggregateHeatmapBatches, versionesDesdePaginas, ANCHOS_PANTALLA,
} from '../../services/heatmapData';
import { getCollection } from '../../services/firebase/firestore';
import {
  useDashboardFilters, useDashboardAnalytics, useGlobalAnalytics, prettyRouteName, shortPath, segTAW,
} from '../../pages/admin/dashboard/dashShared';
import { CLAVE_ENLACES_ROTOS } from '../../pages/admin/dashboard/EnlacesRotos';
import { BASE_RESULTADOS } from '../../pages/admin/resultados/rutas';
import { useMarcoResultados, useEnlacesRotos } from './ResultadosDelPanel';
import { Pestanas } from '../../componentes/kit/Navegacion';
import { MarcoResultados, PaginaDetalleTecnico } from '../../componentes/kit/paginas/admin/Resultados';
import {
  PaginaPaginasTecnica, PaginaUsoTecnica, PaginaNavegadorTecnica, PaginaMapaDeCalor, ORIGENES_TECNICOS,
} from '../../componentes/kit/paginas/admin/Tecnico';

/*
 * Resultados (D4d): el Detalle técnico (pestaña dentro del marco) y sus
 * cuatro pantallas (Páginas, Uso, Navegador, Mapa de calor). Las cuatro
 * siguen en sus rutas propias (/admin/resultados/tecnico/…), fuera del marco
 * de pestañas: cada una arma su cabecera con useMarcoResultados, sin
 * pestañas y con migas de vuelta a Detalle técnico. Las consultas, claves y
 * cálculos son los de DashPaginas, DashUso, DashOrigen y DashHeatmap.
 */

const BASE_TECNICO = `${BASE_RESULTADOS}/tecnico`;
const mensajeError = (error) => (error ? error.message || 'No se pudieron cargar los resultados.' : undefined);

/** La cabecera de una pantalla técnica: el marco de Resultados sin pestañas, con sus migas. */
function MarcoTecnico({ filtros, consulta, titulo, queHace, controles, children }) {
  const { marco } = useMarcoResultados(filtros, consulta);
  return (
    <MarcoResultados
      {...marco}
      // Las pantallas técnicas no comparan: sin el interruptor.
      comparar={false}
      onComparar={undefined}
      titulo={titulo}
      queHace={queHace}
      migas={[
        { texto: 'Resultados', to: `${BASE_RESULTADOS}${filtros.filtersSearch}` },
        { texto: 'Detalle técnico', to: `${BASE_TECNICO}${filtros.filtersSearch}` },
        { texto: titulo },
      ]}
      controles={controles}
    >
      {children}
    </MarcoResultados>
  );
}

/**
 * Detalle técnico (pestaña): la calidad de los datos, las cuatro pantallas
 * y reconstruir el resumen diario (BackfillAnaliticaButton), en Mantenimiento.
 */
export function DetalleTecnicoDelPanel() {
  const { filtros, analitica } = useOutletContext();
  return (
    <PaginaDetalleTecnico
      datos={analitica.data}
      rutaDe={(id) => `${BASE_TECNICO}/${id}${filtros.filtersSearch}`}
      // El navegador espera hasta 9 min (lo mismo que la función): con el tope
      // por defecto (70 s) avisaba "deadline-exceeded" aunque el servidor terminara bien.
      onReconstruirTramo={async (tramo) => {
        const res = await httpsCallable(getFunctions(), 'aggregateAnalyticsDailyBackfill', { timeout: 540000 })(tramo);
        return res.data;
      }}
    />
  );
}

/** Páginas y tiempo: la lectura global del rango (useGlobalAnalytics) y los enlaces rotos. */
export function PaginasTecnicaDelPanel() {
  const filtros = useDashboardFilters(30);
  const queryClient = useQueryClient();
  const q = useGlobalAnalytics(filtros.dateRange);
  const enlacesRotos = useEnlacesRotos(filtros);
  // Actualizar relee el rango y, como antes, también los enlaces rotos.
  const consulta = {
    data: q.data,
    dataUpdatedAt: q.dataUpdatedAt,
    isFetching: q.isFetching,
    refetch: () => {
      q.refetch();
      queryClient.invalidateQueries({ queryKey: [CLAVE_ENLACES_ROTOS] });
    },
  };
  return (
    <MarcoTecnico filtros={filtros} consulta={consulta} titulo="Páginas y tiempo" queHace="Tráfico por página y búsquedas">
      <PaginaPaginasTecnica
        datos={q.data}
        cargando={q.isLoading}
        error={mensajeError(q.error)}
        nombrePagina={prettyRouteName}
        rutaCorta={shortPath}
        enlacesRotos={enlacesRotos}
      />
    </MarcoTecnico>
  );
}

/* Lee el "total" de un contador que puede ser número plano u objeto {total,app,web} (DashUso). */
function leerTotal(valor) {
  if (valor == null) return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === 'object') {
    if (valor.total != null) return Number(valor.total) || 0;
    return (Number(valor.app) || 0) + (Number(valor.web) || 0);
  }
  return Number(valor) || 0;
}

/* El corte de origen sin ceros engañosos (DashUso): si el dato no trae desglose, va el total. */
const corteDeOrigen = (taw, origen) => segTAW(taw, origen) ?? leerTotal(taw);

/** Uso y permanencia: useDashboardAnalytics, con el origen (del querystring) en los controles. */
export function UsoTecnicaDelPanel() {
  const filtros = useDashboardFilters(30);
  const analitica = useDashboardAnalytics(filtros);
  const { data, isLoading, error } = analitica;
  const { origen } = filtros;
  // Las áreas más usadas: cada ruta entra con las vistas de su origen, para que el reparto lo respete.
  const areas = useMemo(() => deriveAppUsage((data?.topRoutesByViews || []).map((r) => ({
    ...r,
    views: corteDeOrigen(r?.views, origen),
  }))), [data?.topRoutesByViews, origen]);
  return (
    <MarcoTecnico
      filtros={filtros}
      consulta={analitica}
      titulo="Uso y permanencia"
      queHace="Actividad, áreas y permanencia"
      controles={<Pestanas etiqueta="Origen" opciones={ORIGENES_TECNICOS} valor={origen} onChange={filtros.setOrigen} />}
    >
      <PaginaUsoTecnica
        datos={data}
        origen={origen}
        comparar={Boolean(filtros.compare)}
        cargando={isLoading}
        error={mensajeError(error)}
        areas={areas}
        nombrePagina={prettyRouteName}
        rutaCorta={shortPath}
      />
    </MarcoTecnico>
  );
}

/** Navegador y sistema: useDashboardAnalytics, con el periodo anterior para app o web. */
export function NavegadorTecnicaDelPanel() {
  const filtros = useDashboardFilters(30);
  const analitica = useDashboardAnalytics(filtros);
  const { data, anterior, isLoading, error } = analitica;
  return (
    <MarcoTecnico filtros={filtros} consulta={analitica} titulo="Navegador y sistema" queHace="Aparatos, países, fuentes y regiones">
      <PaginaNavegadorTecnica
        datos={data}
        anterior={anterior}
        comparar={Boolean(filtros.compare)}
        cargando={isLoading}
        error={mensajeError(error)}
        nombrePagina={prettyRouteName}
        periodoAnterior={filtros.prevRangeLabel}
      />
    </MarcoTecnico>
  );
}

/**
 * Mapa de calor: las dos consultas de DashHeatmap (las páginas del builder y
 * los lotes de clics del rango), la re-agregación en el navegador con los
 * filtros (sin lecturas nuevas) y el visor (HeatmapViewer) tal cual de children.
 */
export function MapaDeCalorDelPanel() {
  const filtros = useDashboardFilters(30);
  const { dateRange, rangeLabel, origen, setOrigen } = filtros;
  // Filtros propios del mapa (no van al querystring): aparato, diseño y los clics sin origen.
  const [ancho, setAncho] = useState('todos');
  const [diseno, setDiseno] = useState('todos');
  const [incluirSinMeta, setIncluirSinMeta] = useState(false);

  // Fecha del último cambio de cada página del builder (colección `pages`).
  const paginasQuery = useQuery({
    queryKey: ['admin-heatmap-paginas-builder'],
    queryFn: async () => {
      const { data } = await getCollection('pages');
      return versionesDesdePaginas(data || []);
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
  const versionesPorRuta = paginasQuery.data || null;

  // La app solo corre en celulares y tablets: con "App" no hay "Computadora".
  const soloApp = origen === 'app';
  const opcionesAncho = soloApp ? ANCHOS_PANTALLA.filter((o) => o.value !== 'desktop') : ANCHOS_PANTALLA;
  useEffect(() => {
    if (soloApp && ancho === 'desktop') setAncho('todos');
  }, [soloApp, ancho]);

  // Los lotes del rango, paginados y con tope (la misma clave y caché de antes).
  const batchesQuery = useQuery({
    queryKey: ['admin-heatmap-batches', dateRange.startDateMs, dateRange.endDateMs],
    queryFn: async () => {
      const res = await fetchHeatmapBatches({ startDateMs: dateRange.startDateMs, endDateMs: dateRange.endDateMs });
      // Sin lotes y con error: es un error de lectura de verdad (lo muestra el visor).
      if (res.error && (!res.docs || res.docs.length === 0)) throw new Error(res.error);
      return res;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const docs = batchesQuery.data?.docs;

  const heatmap = useMemo(() => aggregateHeatmapBatches(docs || [], {
    origen,
    ancho,
    incluirSinMeta,
    versionesPorRuta,
    soloDisenoActual: diseno === 'actual',
  }), [docs, origen, ancho, incluirSinMeta, versionesPorRuta, diseno]);

  // El estado vacío del visor distingue "no hay clics" de "los filtros los dejaron fuera".
  const hayFiltros = origen !== 'todos' || ancho !== 'todos' || diseno !== 'todos';
  const mensajeVacio = hayFiltros
    ? 'Sin clics que cumplan los filtros seleccionados en este rango. Prueba a ampliar el rango, quitar filtros o incluir los clics antiguos sin origen.'
    : `Sin clics registrados ${rangeLabel}. Prueba con un rango más amplio.`;

  return (
    <MarcoTecnico filtros={filtros} consulta={batchesQuery} titulo="Mapa de calor" queHace="Dónde hacen clic tus visitantes">
      <PaginaMapaDeCalor
        origen={origen}
        onOrigen={setOrigen}
        diseno={diseno}
        onDiseno={setDiseno}
        ancho={ancho}
        onAncho={setAncho}
        anchos={opcionesAncho.map((o) => ({ id: o.value, texto: o.label }))}
        clics={heatmap.totalClicks}
        lotes={heatmap.batchesUsados}
        rango={rangeLabel}
        truncado={Boolean(batchesQuery.data?.truncated)}
        maxDocs={batchesQuery.data?.maxDocs || 0}
        sinOrigen={heatmap.batchesSinMeta > 0 ? heatmap.clicksSinMeta : 0}
        incluirSinOrigen={incluirSinMeta}
        onIncluirSinOrigen={setIncluirSinMeta}
      >
        <HeatmapViewer
          data={heatmap}
          loading={batchesQuery.isLoading}
          error={batchesQuery.error?.message || null}
          emptyMessage={mensajeVacio}
          ancho={ancho}
          origen={origen}
          versionesPorRuta={versionesPorRuta}
          soloDisenoActual={diseno === 'actual'}
          onCambiarDiseno={(actual) => setDiseno(actual ? 'actual' : 'todos')}
        />
      </PaginaMapaDeCalor>
    </MarcoTecnico>
  );
}
