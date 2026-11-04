import React, { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useProducts } from '../../hooks/useProducts';
import { getCategories } from '../../services/products';
import { getPerfilesPorUid } from '../../services/adminProductInterest';
import { getEnlacesRotos, redirigirALanding } from '../../services/adminEnlacesRotos';
import {
  useDashboardFilters, useDashboardAnalytics, limaHoyKey, limaAyerKey, prettyRouteName,
} from '../../pages/admin/dashboard/dashShared';
import { CLAVE_ENLACES_ROTOS } from '../../pages/admin/dashboard/EnlacesRotos';
import { cosasPorMejorar } from '../../pages/admin/resultados/cosasPorMejorar.mjs';
import { PESTANAS, DESTINOS, BASE_RESULTADOS } from '../../pages/admin/resultados/rutas';
import { SinPermiso } from '../../componentes/kit/piezas/admin/Marco';
import {
  MarcoResultados, PaginaResumenResultados, PaginaProductosResultados, PaginaVisitantesResultados,
} from '../../componentes/kit/paginas/admin/Resultados';

/*
 * Resultados (D4): el marco (periodo, comparar, actualizar y las pestañas)
 * y sus pestañas. Las pestañas siguen siendo rutas (rutas.js) y reciben
 * por el Outlet lo mismo que con ResultadosLayout: { filtros, analitica,
 * periodo }, así las de antes también funcionan dentro de este marco.
 * Las pantallas técnicas (Páginas, Uso, Navegador, Mapa de calor) siguen en
 * sus rutas propias y usan useMarcoResultados para la misma cabecera.
 */

// Con qué se compara el periodo elegido, dicho como lo diría el dueño.
const CONTRA = { hoy: 'ayer', ayer: 'anteayer' };

/** 'hoy' | 'ayer' si el rango es ese día suelto (los botones Hoy y Ayer); si no, null. */
function diaSuelto(filtros) {
  if (filtros.rangeDays !== 'custom' || filtros.customStart !== filtros.customEnd) return null;
  if (filtros.customStart === limaHoyKey()) return 'hoy';
  if (filtros.customStart === limaAyerKey()) return 'ayer';
  return null;
}

/**
 * Lo que comparten el marco de las pestañas y las pantallas técnicas: el
 * periodo de los filtros de siempre (useDashboardFilters, en la dirección)
 * y las props de MarcoResultados para ese periodo y esa consulta.
 *  - filtros: useDashboardFilters(30) · consulta: la de la pantalla (datosAl, Actualizar)
 */
export function useMarcoResultados(filtros, consulta = {}) {
  const [fechas, setFechas] = useState(filtros.rangeDays === 'custom' && !diaSuelto(filtros));
  const dia = diaSuelto(filtros);
  const id = fechas ? 'fechas' : dia || (filtros.rangeDays === 'custom' ? 'fechas' : String(filtros.rangeDays));
  const periodo = { dia, etiqueta: dia || filtros.rangeLabel, contra: CONTRA[dia] || 'el periodo anterior', anteriorTexto: filtros.prevRangeLabel };
  return {
    periodo,
    marco: {
      periodo: { id, etiqueta: periodo.etiqueta, contra: periodo.contra },
      onPeriodo: (nuevo) => {
        if (nuevo === 'fechas') { setFechas(true); return; }
        setFechas(false);
        if (nuevo === 'hoy') filtros.setCustomRange(limaHoyKey(), limaHoyKey());
        else if (nuevo === 'ayer') filtros.setCustomRange(limaAyerKey(), limaAyerKey());
        else filtros.setRangeDays(Number(nuevo));
      },
      desde: filtros.customStart,
      hasta: filtros.customEnd,
      onFechas: (desde, hasta) => filtros.setCustomRange(desde, hasta),
      hoy: limaHoyKey(),
      comparar: Boolean(filtros.compare),
      onComparar: (si) => filtros.setCompare(si),
      datosAl: consulta.data?.actualizadoEnMs || consulta.dataUpdatedAt,
      actualizando: Boolean(consulta.isFetching),
      onActualizar: consulta.refetch ? () => consulta.refetch() : undefined,
    },
  };
}

/** Los enlaces rotos del rango (la consulta de EnlacesRotos) → las props de TarjetaEnlacesRotos. */
export function useEnlacesRotos(filtros) {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: [CLAVE_ENLACES_ROTOS, filtros.dateRange.startDateMs, filtros.dateRange.endDateMs],
    queryFn: async () => {
      const res = await getEnlacesRotos(filtros.dateRange);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return {
    enlaces: q.data?.enlaces || [],
    landings: q.data?.landings || [],
    visitas: q.data?.visitas || 0,
    truncado: Boolean(q.data?.truncado),
    cargando: q.isLoading,
    error: q.error ? q.error.message : undefined,
    crearLandingDe: (slug) => `/admin/landing-pages?nueva=${encodeURIComponent(slug)}`,
    onRedirigir: async (landingId, slug) => {
      const { error } = await redirigirALanding(landingId, slug);
      if (error) throw new Error(error);
      await queryClient.invalidateQueries({ queryKey: [CLAVE_ENLACES_ROTOS] });
    },
  };
}

/** /admin/resultados y sus pestañas: el marco con las pestañas que este admin puede ver. */
export default function ResultadosDelPanel() {
  const { adminPermissions } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const conClientes = adminPermissions?.includes('superadmin') || adminPermissions?.includes('manage_clients');
  const pestanas = PESTANAS.filter((p) => !p.soloClientes || conClientes);
  const filtros = useDashboardFilters(30);
  const analitica = useDashboardAnalytics(filtros);
  const { periodo, marco } = useMarcoResultados(filtros, analitica);
  const ruta = pathname.replace(/\/+$/, '');
  const actual = pestanas.find((p) => (p.end ? ruta === p.to : ruta === p.to || ruta.startsWith(`${p.to}/`))) || pestanas[0];
  const sinPermiso = !conClientes && PESTANAS.some((p) => p.soloClientes && (ruta === p.to || ruta.startsWith(`${p.to}/`)));

  return (
    <MarcoResultados
      {...marco}
      // Comparar solo cambia el Resumen (sus cifras y la tabla): en las demás pestañas no sale.
      comparar={actual?.end ? marco.comparar : false}
      onComparar={actual?.end ? marco.onComparar : undefined}
      pestanas={pestanas.map((p) => ({ id: p.to, texto: p.label }))}
      pestana={actual?.to}
      onPestana={(to) => navigate({ pathname: to, search: filtros.filtersSearch })}
    >
      {/* Clientes y Opiniones piden el permiso de clientes (el menú ya no las separa). */}
      {sinPermiso ? <SinPermiso permiso="Clientes" /> : <Outlet context={{ filtros, analitica, periodo }} />}
    </MarcoResultados>
  );
}

/** El Resumen: las cifras, la tendencia, cosas por mejorar, los canales y los enlaces rotos. */
export function ResumenDelPanel() {
  const { filtros, analitica, periodo } = useOutletContext();
  const { data, anterior, isLoading, error } = analitica;
  const { data: catalogo } = useProducts([], { includeHidden: true });
  const nombres = useMemo(() => new Map((catalogo || []).map((p) => [String(p.id), p.name])), [catalogo]);
  const enlacesRotos = useEnlacesRotos(filtros);
  const sinResolver = enlacesRotos.enlaces.filter((e) => !e.resueltaA).length;
  // Los enlaces del kit son texto: la ruta con el periodo de ahora (filtersSearch es '?…' o '').
  const conFiltros = (to) => (to && to.startsWith('/') ? `${to}${filtros.filtersSearch}` : to);

  const avisos = useMemo(() => cosasPorMejorar({
    masVistos: data?.topProducts,
    topVendidos: data?.topVendidos,
    carritos: data?.carritosAbandonados,
    embudo: data?.funnelStats?.events,
    busquedas: data?.topSearches,
    enlacesRotos: sinResolver,
    visitas: data?.visitas,
    nombres,
  }).map((a) => ({ ...a, to: conFiltros(DESTINOS[a.destino]) })), [data, sinResolver, nombres]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PaginaResumenResultados
      datos={data}
      anterior={anterior}
      comparar={Boolean(filtros.compare)}
      periodo={periodo}
      cargando={isLoading}
      error={error ? error.message || 'No se pudieron cargar los resultados.' : undefined}
      avisos={avisos}
      nombrePagina={prettyRouteName}
      verCanales={conFiltros(DESTINOS.visitantes)}
      enlacesRotos={enlacesRotos}
    />
  );
}

/** Productos: lo más visto y lo más vendido, con el catálogo y quién se interesó. */
export function ProductosResultadosDelPanel() {
  const { analitica } = useOutletContext();
  const { data, isLoading, error } = analitica;
  const { data: catalogo } = useProducts([], { includeHidden: true });
  const { data: categorias } = useQuery({ queryKey: ['resultados-categorias'], queryFn: async () => (await getCategories()).data || [] });
  const porId = useMemo(() => new Map((catalogo || []).map((p) => [String(p.id), p])), [catalogo]);
  const nombreCategoria = useMemo(() => {
    const m = new Map((categorias || []).map((c) => [c.id, c.name]));
    return (id) => m.get(id) || id;
  }, [categorias]);
  const uids = useMemo(() => [...new Set((data?.interes?.pares || []).slice(0, 60).map((p) => p.uid))].sort(), [data?.interes?.pares]);
  const perfiles = useQuery({
    queryKey: ['resultados-perfiles-interes', uids],
    queryFn: () => getPerfilesPorUid(uids),
    enabled: uids.length > 0,
  });

  return (
    <PaginaProductosResultados
      datos={data}
      cargando={isLoading}
      error={error ? error.message || 'No se pudieron cargar los resultados.' : undefined}
      productoDe={(id, nombre) => {
        const p = porId.get(String(id));
        return { nombre: p?.name || nombre, imagen: p?.mainImage || p?.images?.[0], producto: p };
      }}
      nombreCategoria={nombreCategoria}
      perfiles={perfiles.data}
      cargandoPerfiles={perfiles.isLoading && perfiles.fetchStatus !== 'idle'}
    />
  );
}

/** Visitantes: de dónde llegan, por qué canal y quiénes vuelven. */
export function VisitantesDelPanel() {
  const { analitica } = useOutletContext();
  const { data, isLoading, error } = analitica;
  return (
    <PaginaVisitantesResultados
      datos={data}
      cargando={isLoading}
      error={error ? error.message || 'No se pudieron cargar los resultados.' : undefined}
    />
  );
}

export { BASE_RESULTADOS };
