import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllDailyWords, setDailyWord, deleteDailyWord, palabraAutomatica, contarPartidas } from '../../services/wordle';
import { VALID_GUESSES } from '../../data/wordleDictionary';
import { getBrands } from '../../services/brands';
import { adminBolitas, listarPatrociniosBolitas, leerMundosBolitas, leerPremiosBolitas } from '../../services/firebase/ballSort';
import { adminPichanga } from '../../services/firebase/pichanga';
import { limaTodayStr } from '../../utils/fechaLima';
import { PaginaPalabraAdmin, PaginaBolitasAdmin, PaginaPichangaAdmin } from '../../componentes/kit/paginas/admin/Juegos';
import { palabraDiaDesde, palabrasConAutomaticas, patrocinioDesde, premiosBolitasDesde, premiosBolitasAFirestore } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useInvalidar } from './comun';

/*
 * Los juegos (D7a): La Palabra del día y Las Bolitas de Walito. Los mismos
 * servicios, rutas de Storage, claves e invalidaciones que AdminWordlePage
 * y AdminBolitasPage; lo que
 * se escribe en Firestore o se manda al servidor (adminBolitasSecure) es lo
 * mismo que mandaban ellas.
 *
 * Las claves guardan lo mismo que guardaban las páginas de antes (la url ya
 * recortada, la lista de marcas tal cual): con el interruptor, la vieja y la
 * nueva comparten la caché.
 */

const errorDe = (q, texto) => (q.error ? q.error.message || texto : undefined);

/* ── La Palabra del día ────────────────────────────────── */

const PALABRAS = ['admin-wordle-words'];

/**
 * /admin/wordle: getAllDailyWords (un documento por día, el id es la fecha)
 * → palabraDiaDesde con el día de Lima. Guardar con setDailyWord; si al
 * editar cambió el día, se borra la del día anterior.
 */
export function PalabraDelPanel() {
  const invalidar = useInvalidar();
  const hoy = limaTodayStr();
  // getAllDailyWords no devuelve { data, error }: la lista (o [] si falla), como antes.
  const q = useQuery({ queryKey: PALABRAS, queryFn: getAllDailyWords });
  const palabras = useMemo(() => palabrasConAutomaticas((q.data || []).map((x) => palabraDiaDesde(x, hoy)), hoy, 14, palabraAutomatica), [q.data, hoy]);
  // Partidas guardadas hoy y en los últimos 30 días (una por persona y día).
  const partidas = useQuery({
    queryKey: ['admin-wordle-partidas', hoy],
    queryFn: async () => {
      const [y, m, d] = hoy.split('-').map(Number);
      const desde = new Date(Date.UTC(y, m - 1, d - 29)).toISOString().slice(0, 10);
      const r = await contarPartidas(hoy, desde);
      return { hoy: r.hoy, mes: r.desde };
    },
    staleTime: 5 * 60 * 1000,
  });
  return (
    <PaginaPalabraAdmin
      palabras={palabras}
      hoy={hoy}
      partidas={partidas.data}
      // Solo las del diccionario del juego: otra no la podría escribir nadie.
      existe={(w) => VALID_GUESSES.size <= 10 || VALID_GUESSES.has(w)}
      cargandoPartidas={partidas.isLoading}
      cargando={q.isLoading}
      error={errorDe(q, 'No se pudieron cargar las palabras.')}
      onReintentar={() => q.refetch()}
      onGuardar={async ({ fecha, palabra }, id) => {
        // La palabra ya llega limpia (sin tildes, en mayúsculas), como la dejaba la página de antes.
        await sinError(setDailyWord(fecha, palabra));
        if (id && id !== fecha) await sinError(deleteDailyWord(id));
        await invalidar(PALABRAS);
      }}
      onEliminar={async (id) => {
        await sinError(deleteDailyWord(id));
        await invalidar(PALABRAS);
      }}
    />
  );
}

/* ── Las Bolitas de Walito ───────────────────────────────── */

const PATROCINIOS = ['admin-bolitas-patrocinios'];
const MUNDOS = ['admin-bolitas-mundos'];
const PREMIOS = ['admin-bolitas-premios'];

/**
 * /admin/bolitas: las marcas activas y visibles (getBrands); los retos
 * patrocinados desde hoy, los mundos, los premios del ranking y las cifras,
 * todo con adminBolitas (adminBolitasSecure, que falla con un Error con su
 * texto) como AdminBolitasPage. Se lee todo al abrir, como antes (la página
 * de antes mostraba las cuatro partes juntas).
 */
export function BolitasDelPanel() {
  const invalidar = useInvalidar();
  const hoy = limaTodayStr();
  const [pestana, setPestana] = useState('patrocinios');
  const [dias, setDias] = useState(14);

  // Como antes: la lista de marcas tal cual; si getBrands falla, ahora se dice.
  const marcasQ = useQuery({ queryKey: ['admin-bolitas-marcas'], queryFn: async () => (await sinError(getBrands())) || [] });
  const patrociniosQ = useQuery({ queryKey: [...PATROCINIOS, hoy], queryFn: () => listarPatrociniosBolitas(hoy) });
  const mundosQ = useQuery({ queryKey: MUNDOS, queryFn: leerMundosBolitas });
  const premiosQ = useQuery({ queryKey: PREMIOS, queryFn: leerPremiosBolitas });
  const metricasQ = useQuery({ queryKey: ['admin-bolitas-metricas', dias], queryFn: () => adminBolitas('metricas', { dias }) });

  const marcas = useMemo(() => (marcasQ.data || []).filter((m) => m.active !== false && m.visible !== false), [marcasQ.data]);
  const opcionesMarca = useMemo(() => marcas.map((m) => ({ valor: m.id, texto: m.name })), [marcas]);
  const patrocinios = useMemo(() => (patrociniosQ.data || []).map((p) => patrocinioDesde(p, hoy)), [patrociniosQ.data, hoy]);
  // Mundos y Premios copian lo guardado al cambiar: tienen que ser los mismos objetos entre render y render.
  const mundos = useMemo(() => mundosQ.data?.marcas || [], [mundosQ.data]);
  const premios = useMemo(() => premiosBolitasDesde(premiosQ.data), [premiosQ.data]);

  // Cada pestaña con su lectura (las marcas las usan todas).
  const deLaPestana = { patrocinios: patrociniosQ, mundos: mundosQ, premios: premiosQ, resultados: metricasQ }[pestana] || patrociniosQ;
  const error = errorDe(marcasQ, 'No se pudieron cargar las marcas.') || errorDe(deLaPestana, 'No se pudo cargar.');

  return (
    <PaginaBolitasAdmin
      pestana={pestana}
      onPestana={setPestana}
      marcas={opcionesMarca}
      hoy={hoy}
      cargando={marcasQ.isLoading || deLaPestana.isLoading}
      error={error}
      onReintentar={() => { if (marcasQ.error) marcasQ.refetch(); deLaPestana.refetch(); }}
      patrocinios={patrocinios}
      onGuardarPatrocinio={async (d, id) => {
        // Como antes: el nombre sale de la marca elegida, no de lo que trae el formulario.
        const marca = marcas.find((m) => m.id === d.marcaId);
        if (!marca) throw new Error('Elige la marca.');
        await adminBolitas('guardarPatrocinio', {
          fecha: d.fecha,
          patrocinio: { marcaId: marca.id, marcaNombre: marca.name, cupo: d.cupo, activo: d.activo, cupon: d.cupon },
        });
        // Si al editar cambió el día, el patrocinio del día anterior se quita (el id es la fecha).
        if (id && id !== d.fecha) await adminBolitas('borrarPatrocinio', { fecha: id });
        await invalidar(PATROCINIOS);
      }}
      onQuitarPatrocinio={async (id) => {
        await adminBolitas('borrarPatrocinio', { fecha: id });
        await invalidar(PATROCINIOS);
      }}
      mundos={mundos}
      onGuardarMundos={async (lista) => {
        await adminBolitas('guardarMundos', { marcas: lista });
        await invalidar(MUNDOS);
      }}
      premios={premios}
      onGuardarPremios={async (p) => {
        // marcaNombre con las marcas activas y visibles, como antes.
        await adminBolitas('guardarPremios', premiosBolitasAFirestore(p, marcas));
        await invalidar(PREMIOS);
      }}
      // → { ya, sinPremios, entregados } para el aviso; antes no refrescaba nada.
      onPremiarSemana={(semana) => adminBolitas('premiarSemana', { semana })}
      metricas={metricasQ.data}
      dias={dias}
      onDias={setDias}
      cargandoMetricas={metricasQ.isLoading}
    />
  );
}

/* ── La Pichanga de Walito ───────────────────────────────── */

const PREMIOS_PICHANGA = ['admin-pichanga-premios'];
const PATROCINIOS_PICHANGA = ['admin-pichanga-patrocinios'];

/**
 * /admin/pichanga: todo con adminPichanga (adminPichangaSecure): los retos
 * patrocinados desde hoy, los premios de los goleadores del mes y las cifras
 * del periodo (como en las Bolitas, con las marcas activas y visibles).
 */
export function PichangaDelPanel() {
  const invalidar = useInvalidar();
  const hoy = limaTodayStr();
  const [pestana, setPestana] = useState('patrocinios');
  const [dias, setDias] = useState(14);
  const marcasQ = useQuery({ queryKey: ['admin-bolitas-marcas'], queryFn: async () => (await sinError(getBrands())) || [] });
  const metricasQ = useQuery({ queryKey: ['admin-pichanga-metricas', dias], queryFn: () => adminPichanga('metricas', { dias }) });
  const premiosQ = useQuery({ queryKey: PREMIOS_PICHANGA, queryFn: () => adminPichanga('leerPremios'), enabled: pestana === 'premios' });
  const patrociniosQ = useQuery({
    queryKey: [...PATROCINIOS_PICHANGA, hoy],
    queryFn: async () => (await adminPichanga('listarPatrocinios', { desde: hoy })).patrocinios || [],
    enabled: pestana === 'patrocinios',
  });

  const marcas = useMemo(() => (marcasQ.data || []).filter((m) => m.active !== false && m.visible !== false), [marcasQ.data]);
  const opcionesMarca = useMemo(() => marcas.map((m) => ({ valor: m.id, texto: m.name })), [marcas]);
  // Premios copia lo guardado al cambiar: tiene que ser el mismo objeto entre render y render.
  const premios = useMemo(() => premiosBolitasDesde(premiosQ.data?.premios), [premiosQ.data]);
  const patrocinios = useMemo(() => (patrociniosQ.data || []).map((p) => patrocinioDesde(p, hoy)), [patrociniosQ.data, hoy]);
  const deLaPestana = { patrocinios: patrociniosQ, premios: premiosQ }[pestana] || metricasQ;
  const conMarcas = pestana !== 'resultados';

  return (
    <PaginaPichangaAdmin
      pestana={pestana}
      onPestana={setPestana}
      marcas={opcionesMarca}
      hoy={hoy}
      cargando={(conMarcas && marcasQ.isLoading) || deLaPestana.isLoading}
      error={(conMarcas && errorDe(marcasQ, 'No se pudieron cargar las marcas.')) || errorDe(deLaPestana, 'No se pudo cargar.')}
      onReintentar={() => { if (marcasQ.error) marcasQ.refetch(); deLaPestana.refetch(); }}
      patrocinios={patrocinios}
      onGuardarPatrocinio={async (d, id) => {
        const marca = marcas.find((m) => m.id === d.marcaId);
        if (!marca) throw new Error('Elige la marca.');
        await adminPichanga('guardarPatrocinio', {
          fecha: d.fecha,
          patrocinio: { marcaId: marca.id, marcaNombre: marca.name, cupo: d.cupo, activo: d.activo, cupon: d.cupon },
        });
        // Si al editar cambió el día, el patrocinio del día anterior se quita (el id es la fecha).
        if (id && id !== d.fecha) await adminPichanga('borrarPatrocinio', { fecha: id });
        await invalidar(PATROCINIOS_PICHANGA);
      }}
      onQuitarPatrocinio={async (id) => {
        await adminPichanga('borrarPatrocinio', { fecha: id });
        await invalidar(PATROCINIOS_PICHANGA);
      }}
      metricas={metricasQ.data}
      dias={dias}
      onDias={setDias}
      cargandoMetricas={metricasQ.isLoading || metricasQ.isFetching}
      premios={premios}
      premiados={premiosQ.data?.premiados || []}
      onGuardarPremios={async (p) => {
        await adminPichanga('guardarPremios', premiosBolitasAFirestore(p, marcas));
        await invalidar(PREMIOS_PICHANGA);
      }}
      onPremiarMes={async (mes) => {
        const r = await adminPichanga('premiarMes', { mes });
        await invalidar(PREMIOS_PICHANGA);
        return r;
      }}
    />
  );
}
