import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import HeatmapViewer from '../../../components/dashboard/HeatmapViewer';
import {
  fetchHeatmapBatches,
  aggregateHeatmapBatches,
  versionesDesdePaginas,
  ANCHOS_PANTALLA,
} from '../../../services/heatmapData';
import {
  DashBackground,
  DashHeader,
  OrigenPicker,
  useDashboardFilters,
  containerVariants,
  itemVariants,
  fmtInt,
} from './dashShared';
import { getCollection } from '../../../services/firebase/firestore';
import styles from '../AdminDashboard.module.css';
// Clases glass del segmentado compartido (solo se IMPORTAN; el .css es de dashShared).
import glass from './dashShared.extra.module.css';
import extra from './DashHeatmap.extra.module.css';

/**
 * DashHeatmap — sub-página dedicada al MAPA DE CALOR, ahora FILTRABLE.
 *
 * Arquitectura de datos (lecturas BARATAS):
 *   1. fetchHeatmapBatches lee los lotes de `heatmap_events` PAGINADOS por el
 *      RANGO de fechas del contrato global (useDashboardFilters: presets
 *      7/30/90 + personalizado, compartido por querystring con todo el panel).
 *      Jamás la colección entera; tope de lotes con aviso de recorte.
 *   2. aggregateHeatmapBatches re-agrega EN CLIENTE con cada cambio de filtro
 *      visual (origen/dispositivo/ancho): cero lecturas nuevas (useMemo +
 *      caché 30s del servicio + caché de react-query por rango).
 *   3. HeatmapViewer recibe los datos YA filtrados por props y solo pinta
 *      (el filtro de RUTA es su selector de páginas por `path`).
 *
 * HONESTIDAD: los lotes anteriores al despliegue de los campos nuevos NO traen
 * origen/dispositivo → al filtrar por esos campos se avisa cuántos clics quedan
 * fuera y se ofrece "incluir sin datos". El corte por ANCHO DE PANTALLA usa
 * screenWidth (presente en cada clic desde siempre) y SÍ cubre el histórico.
 */

/* ------------------------- controles locales de filtro ------------------------- */

/**
 * Segmentado glass local (mismas clases del design system que usa dashShared).
 * Se define aquí porque dispositivo/ancho son filtros PROPIOS del heatmap y no
 * forman parte del contrato global (no tocamos dashShared).
 */
function SegmentadoHeatmap({ opciones, valor, onChange, ariaLabel }) {
  return (
    <div className={`${styles.rangePicker} ${glass.rangePicker}`} role="group" aria-label={ariaLabel}>
      {opciones.map((o) => {
        const activo = valor === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            className={`${styles.rangeBtn} ${glass.rangeBtn} ${
              activo ? `${styles.rangeActive} ${glass.rangeActive}` : ''
            }`}
            onClick={() => onChange(o.value)}
            title={o.title}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Grupo etiqueta + control, con tokens de tema (cubre modo noche). */
function GrupoFiltro({ etiqueta, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted, #64748b)',
        }}
      >
        {etiqueta}
      </span>
      {children}
    </div>
  );
}

// Estilo del botón "incluir/excluir sin datos" dentro del aviso honesto.
const ESTILO_BTN_SIN_DATOS = {
  marginLeft: 'auto',
  flexShrink: 0,
  padding: '0.35rem 0.7rem',
  borderRadius: '999px',
  border: '1px solid var(--color-border, #e2e8f0)',
  background: 'var(--color-surface, #ffffff)',
  color: 'var(--color-text, #0f172a)',
  fontFamily: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function DashHeatmap() {
  // CONTRATO GLOBAL (agente A): rango 7/30/90 + personalizado y ORIGEN app/web
  // viven en el querystring y se comparten con el hub y las demás sub-páginas.
  const filtros = useDashboardFilters();
  const { rangeDays, setRangeDays, dateRange, rangeLabel, origen, setOrigen } = filtros;

  // Filtros PROPIOS del heatmap (estado local; no contaminan el querystring
  // compartido): dispositivo y "incluir sin datos". El dispositivo se decide
  // por el ANCHO de pantalla de cada clic (existe desde el primer día, cubre
  // todo el historial); antes había además un filtro por el user-agent del
  // lote que hacía lo mismo solo para lotes nuevos y confundía.
  const [ancho, setAncho] = useState('todos');
  // 'actual' = solo clics hechos después del último cambio de cada página en
  // el builder (sobre el diseño que se ve hoy); 'todos' = cualquier diseño.
  const [diseno, setDiseno] = useState('todos');

  // Fecha del último cambio de cada página del builder (colección `pages`):
  // una lectura por página, con la misma caché que el resto del panel.
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
  const [incluirSinMeta, setIncluirSinMeta] = useState(false);

  // LECTURA PAGINADA POR RANGO — cacheada por react-query (clave = rango) y por
  // la caché 30s del servicio: cambiar filtros visuales NO relee Firestore.
  const batchesQuery = useQuery({
    queryKey: ['admin-heatmap-batches', dateRange.startDateMs, dateRange.endDateMs],
    queryFn: async () => {
      const res = await fetchHeatmapBatches({
        startDateMs: dateRange.startDateMs,
        endDateMs: dateRange.endDateMs,
      });
      // Sin lotes Y con error → error real de lectura (lo muestra el visor).
      if (res.error && (!res.docs || res.docs.length === 0)) {
        throw new Error(res.error);
      }
      return res;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const docs = batchesQuery.data?.docs;
  const truncated = Boolean(batchesQuery.data?.truncated);
  const maxDocs = batchesQuery.data?.maxDocs || 0;

  // RE-AGREGACIÓN EN CLIENTE con los filtros vigentes (función pura, sin red).
  const heatmap = useMemo(
    () => aggregateHeatmapBatches(docs || [], {
      origen,
      ancho,
      incluirSinMeta,
      versionesPorRuta,
      soloDisenoActual: diseno === 'actual',
    }),
    [docs, origen, ancho, incluirSinMeta, versionesPorRuta, diseno]
  );

  // ¿Hay un filtro activo que dependa de los campos NUEVOS del lote?
  const filtroMetaActivo = origen !== 'todos';
  // Aviso honesto: hay lotes viejos (sin origen/dispositivo) afectados por ese filtro.
  const avisoSinMeta = filtroMetaActivo && heatmap.batchesSinMeta > 0;
  const hayFiltrosActivos = filtroMetaActivo || ancho !== 'todos' || diseno !== 'todos';

  // Mensaje honesto para el estado vacío del visor: distingue "no hay datos"
  // de "tus filtros dejaron fuera todos los clics".
  const mensajeVacio = hayFiltrosActivos
    ? 'Sin clics que cumplan los filtros seleccionados en este rango. Prueba a ampliar el rango, quitar filtros o incluir los clics antiguos sin origen.'
    : `Sin clics registrados ${rangeLabel}. Prueba con un rango más amplio.`;

  return (
    <div className={styles.page}>
      <DashBackground />
      <motion.div
        className={styles.content}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <DashHeader
            title="Mapa de calor"
            subtitle={`Dónde hacen clic tus visitantes — ${rangeLabel}`}
            rangeDays={rangeDays}
            setRangeDays={setRangeDays}
            onRefresh={batchesQuery.refetch}
            isFetching={batchesQuery.isFetching}
          />
        </motion.div>

        {/* BARRA DE FILTROS: origen (contrato global) + dispositivo. */}
        <motion.div
          variants={itemVariants}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: '0.9rem',
            marginBottom: '1rem',
          }}
        >
          <GrupoFiltro etiqueta="Origen">
            <OrigenPicker origen={origen} setOrigen={setOrigen} />
          </GrupoFiltro>
          <GrupoFiltro etiqueta="Diseño de la página">
            <SegmentadoHeatmap
              opciones={[
                { value: 'todos', label: 'Todos', title: 'Clics de cualquier diseño de la página' },
                {
                  value: 'actual',
                  label: 'Solo el actual',
                  title: 'Solo clics hechos después del último cambio de cada página en el builder',
                },
              ]}
              valor={diseno}
              onChange={setDiseno}
              ariaLabel="Filtrar por diseño de la página"
            />
          </GrupoFiltro>
          <GrupoFiltro etiqueta="Dispositivo">
            <SegmentadoHeatmap
              opciones={ANCHOS_PANTALLA}
              valor={ancho}
              onChange={setAncho}
              ariaLabel="Filtrar por dispositivo (según el ancho de pantalla del clic)"
            />
          </GrupoFiltro>
        </motion.div>

        {/* Tira informativa: qué se está mostrando (rango + volumen). */}
        <motion.div className={extra.infoStrip} variants={itemVariants}>
          <span className={extra.infoIcon} aria-hidden="true">💡</span>
          <span className={extra.infoText}>
            Mostrando <strong>{fmtInt(heatmap.totalClicks)}</strong> clics
            de {fmtInt(heatmap.batchesUsados)} lotes ({rangeLabel}). Elige una
            página en las tarjetas para ver dónde concentran la atención tus
            visitantes; los filtros se aplican al instante, sin lecturas nuevas.
          </span>
        </motion.div>

        {/* AVISO DE RECORTE: el rango tenía más lotes que el tope barato. */}
        {truncated && (
          <motion.div className={extra.infoStrip} variants={itemVariants}>
            <span className={extra.infoIcon} aria-hidden="true">⚠️</span>
            <span className={extra.infoText}>
              Este rango tiene demasiados lotes de clics:
              mostrando <strong>los {fmtInt(maxDocs)} más recientes</strong> para
              mantener las lecturas baratas. Acorta el rango para ver el detalle completo.
            </span>
          </motion.div>
        )}

        {/* AVISO HONESTO: lotes viejos sin origen/dispositivo bajo un filtro
            que los necesita, con la opción de incluirlos igualmente. */}
        {avisoSinMeta && (
          <motion.div className={extra.infoStrip} variants={itemVariants}>
            <span className={extra.infoIcon} aria-hidden="true">⚠️</span>
            <span className={extra.infoText}>
              <strong>{fmtInt(heatmap.clicksSinMeta)} clics</strong> antiguos no guardaron si
              venían de la web o de la app{' '}
              {incluirSinMeta
                ? 'y se están incluyendo igual.'
                : 'y quedaron fuera de este filtro.'}
            </span>
            <button
              type="button"
              style={ESTILO_BTN_SIN_DATOS}
              onClick={() => setIncluirSinMeta((v) => !v)}
              aria-pressed={incluirSinMeta}
              title="Incluir o excluir los clics antiguos sin origen"
            >
              {incluirSinMeta ? 'Excluir sin datos' : 'Incluir sin datos'}
            </button>
          </motion.div>
        )}

        <motion.div className={styles.heatmapFull} variants={itemVariants}>
          {/* Modo CONTROLADO: el visor recibe los eventos YA filtrados y solo pinta. */}
          <HeatmapViewer
            data={heatmap}
            loading={batchesQuery.isLoading}
            error={batchesQuery.error?.message || null}
            emptyMessage={mensajeVacio}
            ancho={ancho}
            versionesPorRuta={versionesPorRuta}
            soloDisenoActual={diseno === 'actual'}
            onCambiarDiseno={(actual) => setDiseno(actual ? 'actual' : 'todos')}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
