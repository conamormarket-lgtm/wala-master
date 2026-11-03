import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { getEstadisticasPopup, getPopups, reiniciarEstadoLocal, savePopups } from '../../services/popups';
import { normalizarPopup } from '../../services/popupsLogic.mjs';
import { getBrands } from '../../services/brands';
import { getLandingPages, saveLandingPage, deleteLandingPage, moverDisenoDeLanding } from '../../pages/Tienda/services/landingPages';
import { getThemes, saveTheme, deleteTheme } from '../../pages/Tienda/services/themes';
import { CLAVE_ENLACES_ROTOS } from '../../pages/admin/dashboard/EnlacesRotos';
import { PaginaPopupsAdmin } from '../../componentes/kit/paginas/admin/Popups';
import { PaginaLandingsAdmin, PaginaTemasAdmin } from '../../componentes/kit/paginas/admin/Paginas';
import { landingDesde, landingAFirestore, temaDesde, temaAFirestore, temaDesdeCss } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar, subirA } from './comun';

/*
 * D6d · Popups, páginas y temas: los mismos servicios, claves e
 * invalidaciones que AdminPopups, AdminLandingPages y AdminThemes. Las dos
 * últimas no usaban React Query (leían con useEffect): aquí las landings
 * tienen su clave propia y los temas comparten ['admin-themes'] con el editor
 * de la tienda (la misma lista cruda de getThemes).
 */

/* ── Popups ─────────────────────────────────────────── */

// La imagen va a la misma carpeta que en AdminPopups.
const subirPopup = subirA('config/popups', 'popup');

/*
 * /admin/popups: la lista entera vive en storeConfig/popups y se guarda
 * entera (savePopups). Si no se pudo leer, no se guarda: pisaría lo que haya
 * (AdminPopups apagaba "Nuevo popup"; el kit deja abrir la hoja, así que el
 * guardar es el que se niega). Las métricas, una consulta por popup con la
 * clave de antes.
 */
export function PopupsDelPanel() {
  const queryClient = useQueryClient();
  const popups = useLectura(['admin-popups'], getPopups, { staleTime: 0 });
  const lista = popups.datos || [];

  const metricas = useQueries({
    queries: lista.map((p) => ({
      queryKey: ['admin-popup-stats', p.id],
      queryFn: () => getEstadisticasPopup(p.id),
      staleTime: 60 * 1000,
    })),
  });
  // { [id]: { vistas, clics, cierres, conversiones } }; las que no cargan quedan en "—".
  const estadisticas = {};
  lista.forEach((p, i) => { if (metricas[i]?.data) estadisticas[p.id] = metricas[i].data; });

  return (
    <PaginaPopupsAdmin
      popups={lista}
      cargando={popups.cargando}
      error={popups.error}
      onReintentar={popups.onReintentar}
      onGuardarPopups={async (nueva) => {
        if (!popups.datos || popups.error) throw new Error('No se pudieron leer los popups: guardar ahora borraría los que hay. Vuelve a cargar la página.');
        await sinError(savePopups(nueva));
        queryClient.setQueryData(['admin-popups'], nueva.map(normalizarPopup));
        await queryClient.invalidateQueries({ queryKey: ['popups-config'] });
      }}
      subirImagen={subirPopup}
      estadisticas={estadisticas}
      onReiniciarLocal={reiniciarEstadoLocal}
    />
  );
}

/* ── Páginas (landing pages) ────────────────────────── */

// getLandingPages devuelve la lista sola (y [] si falla, como antes).
const leerLandings = () => getLandingPages().then((data) => ({ data }));

/*
 * /admin/landing-pages: nombre, dirección y marca. Si cambia la dirección,
 * primero se copia el diseño (pages/<vieja> → pages/<nueva>) y la vieja queda
 * anotada para redirigir (landingAFirestore). ?nueva=<slug> (el atajo "Crear
 * landing" de Enlaces rotos) abre una nueva con esa dirección cuando ya
 * cargó la lista, y se borra de la URL.
 */
export function LandingsDelPanel() {
  const navigate = useNavigate();
  const paginas = useLectura(['admin-landing-pages'], leerLandings);
  const marcas = useLectura(['admin-brands'], getBrands);
  const invalidar = useInvalidar();
  // La landing renombrada o creada también cambia lo que lee el editor y lo
  // que Enlaces rotos marca como resuelto.
  const refrescar = () => invalidar(['admin-landing-pages'], ['editor-landing'], [CLAVE_ENLACES_ROTOS]);

  const crudas = paginas.datos || [];
  const listaMarcas = marcas.datos || [];

  // nuevoCon del kit se arma en cada dibujo: la dirección se pasa una sola
  // vez (al dibujo siguiente ya no está) para que no vuelva a abrir la hoja.
  const [searchParams, setSearchParams] = useSearchParams();
  const pedida = searchParams.get('nueva');
  const listo = !paginas.cargando && !marcas.cargando;
  const [nuevaDireccion, setNuevaDireccion] = useState();
  useEffect(() => {
    if (!listo || !pedida) return;
    setNuevaDireccion(pedida);
    const sin = new URLSearchParams(searchParams);
    sin.delete('nueva');
    setSearchParams(sin, { replace: true });
  }, [listo, pedida]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (nuevaDireccion) setNuevaDireccion(undefined); }, [nuevaDireccion]);

  return (
    <PaginaLandingsAdmin
      paginas={crudas.map((p) => landingDesde(p, listaMarcas))}
      marcas={listaMarcas.map((b) => ({ valor: b.id, texto: b.name || b.slug || b.id }))}
      cargando={paginas.cargando || marcas.cargando}
      error={paginas.error || marcas.error}
      onReintentar={() => { paginas.onReintentar(); marcas.onReintentar(); }}
      onGuardar={async (datos, id) => {
        const previa = id ? crudas.find((p) => p.id === id) : null;
        const doc = landingAFirestore(datos, previa);
        if (previa?.slug && previa.slug !== doc.slug) {
          const { error } = await moverDisenoDeLanding(previa.slug, doc.slug);
          if (error) throw new Error(`No se pudo mover el diseño a la nueva dirección: ${error}`);
        }
        // Solo nombre, dirección, marca y las direcciones viejas: lo demás
        // (tema, cabecera, pie) se conserva (saveLandingPage mezcla).
        await sinError(saveLandingPage(id || null, doc));
        await refrescar();
      }}
      onEliminar={async (id) => {
        const slug = crudas.find((p) => p.id === id)?.slug || '';
        try {
          await sinError(deleteLandingPage(id, slug));
        } finally {
          await refrescar();
        }
      }}
      onDisenar={(ruta) => navigate(`${ruta}?editar`)}
      nuevaDireccion={nuevaDireccion}
    />
  );
}

/* ── Temas ──────────────────────────────────────────── */

// getThemes devuelve la lista sola (y [] si falla, como antes).
const leerTemas = () => getThemes().then((data) => ({ data }));

/** El .zip de un tema de WordPress → el tema (como AdminThemes: todos los .css, sin __MACOSX, vendor ni node_modules). */
async function temaDelZip(archivo) {
  const JSZip = (await import('jszip')).default;
  const zip = await new JSZip().loadAsync(archivo);
  const lecturas = [];
  let principal = null;
  zip.forEach((ruta, entrada) => {
    if (!ruta.endsWith('.css') || ruta.includes('__MACOSX') || ruta.includes('/vendor/') || ruta.includes('/node_modules/')) return;
    // El style.css de arriba (o de la primera carpeta) trae el nombre, autor y versión.
    if (ruta.endsWith('style.css') && ruta.split('/').length <= 2) principal = entrada;
    lecturas.push(entrada.async('string'));
  });
  if (!lecturas.length) throw new Error('No se encontró ningún archivo .css válido en el tema.');
  const todos = await Promise.all(lecturas);
  return temaDesdeCss({ principal: principal ? await principal.async('string') : '', todos, archivo: archivo.name });
}

/*
 * /admin/temas: el CSS de las páginas del editor, en tienda_themes. Importar
 * un .zip crea un tema nuevo (theme_<ms>), como antes.
 */
export function TemasDelPanel() {
  const temas = useLectura(['admin-themes'], leerTemas);
  const invalidar = useInvalidar();
  const refrescar = () => invalidar(['admin-themes']);

  return (
    <PaginaTemasAdmin
      temas={(temas.datos || []).map(temaDesde)}
      cargando={temas.cargando}
      error={temas.error}
      onReintentar={temas.onReintentar}
      onGuardar={async (datos, id) => {
        await sinError(saveTheme(id || null, temaAFirestore(datos)));
        await refrescar();
      }}
      onEliminar={async (id) => { await sinError(deleteTheme(id)); await refrescar(); }}
      onImportarZip={async (archivo) => {
        const tema = await temaDelZip(archivo);
        await sinError(saveTheme(null, temaAFirestore(tema)));
        await refrescar();
        return tema;
      }}
    />
  );
}
