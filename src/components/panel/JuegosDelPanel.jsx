import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMessage, setMessage } from '../../services/messages';
import { uploadFile } from '../../services/firebase/storage';
import { getAllDailyWords, setDailyWord, deleteDailyWord } from '../../services/wordle';
import { getBrands } from '../../services/brands';
import { adminBolitas, listarPatrociniosBolitas, leerMundosBolitas, leerPremiosBolitas } from '../../services/firebase/ballSort';
import { limaTodayStr } from '../../utils/fechaLima';
import { PaginaKapiAdmin, PaginaPalabraAdmin, PaginaBolitasAdmin } from '../../componentes/kit/paginas/admin/Juegos';
import { palabraDiaDesde, patrocinioDesde, premiosBolitasDesde, premiosBolitasAFirestore } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar } from './comun';

/*
 * Los juegos y Kapi (D7a): la imagen de Kapi, La Palabra del día y Las
 * Bolitas de Kapi. Los mismos servicios, rutas de Storage, claves e
 * invalidaciones que AdminMascota, AdminWordlePage y AdminBolitasPage; lo que
 * se escribe en Firestore o se manda al servidor (adminBolitasSecure) es lo
 * mismo que mandaban ellas.
 *
 * Las claves guardan lo mismo que guardaban las páginas de antes (la url ya
 * recortada, la lista de marcas tal cual): con el interruptor, la vieja y la
 * nueva comparten la caché.
 */

const errorDe = (q, texto) => (q.error ? q.error.message || texto : undefined);

/* ── Kapi ──────────────────────────────────────────────── */

const MASCOTA_KEY = 'mascota_kap_image_url';
const MASCOTA_RUTA = 'config/mascota_kap.png';

/** La imagen de Kapi siempre en el mismo archivo, como AdminMascota (pisa la anterior). */
async function subirKapi(blob, { alAvanzar } = {}) {
  if (!blob || !String(blob.type || '').startsWith('image/')) throw new Error('Ese archivo no es una imagen.');
  alAvanzar?.(10);
  const archivo = blob instanceof File ? blob : new File([blob], 'mascota_kap.png', { type: blob.type });
  const { url, error } = await uploadFile(archivo, MASCOTA_RUTA);
  if (error || !url) throw new Error(typeof error === 'string' ? error : 'No se pudo subir la imagen.');
  alAvanzar?.(100);
  return url;
}

/**
 * /admin/mascota: getMessage('mascota_kap_image_url') en ['admin-mascota-url'];
 * guardar (al subir, pegar un enlace o quitar) con setMessage e invalida
 * también ['mascota-image-url'], la que lee Mi cuenta.
 */
export function KapiDelPanel() {
  const invalidar = useInvalidar();
  const lectura = useLectura(['admin-mascota-url'], async () => {
    const r = await getMessage(MASCOTA_KEY);
    // Como antes: la url recortada, o '' si no hay.
    return r?.error ? r : { data: r?.data?.trim() ?? '' };
  });
  return (
    <PaginaKapiAdmin
      imagen={lectura.datos || ''}
      cargando={lectura.cargando}
      error={lectura.error}
      onReintentar={lectura.onReintentar}
      subirImagen={subirKapi}
      onGuardar={async (url) => {
        await sinError(setMessage(MASCOTA_KEY, url?.trim() ?? ''));
        await invalidar(['admin-mascota-url'], ['mascota-image-url']);
      }}
    />
  );
}

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
  const palabras = useMemo(() => (q.data || []).map((x) => palabraDiaDesde(x, hoy)), [q.data, hoy]);
  return (
    <PaginaPalabraAdmin
      palabras={palabras}
      hoy={hoy}
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

/* ── Las Bolitas de Kapi ───────────────────────────────── */

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
