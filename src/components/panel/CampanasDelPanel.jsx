import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getEstadisticasPopup, getPopups, reiniciarEstadoLocal, savePopups } from '../../services/popups';
import { normalizarPopup } from '../../services/popupsLogic.mjs';
import { getBrands } from '../../services/brands';
import { getLandingPages, saveLandingPage, deleteLandingPage, moverDisenoDeLanding } from '../../pages/Tienda/services/landingPages';
import { CLAVE_ENLACES_ROTOS } from '../../pages/admin/dashboard/EnlacesRotos';
import { PaginaPopupsAdmin } from '../../componentes/kit/paginas/admin/Popups';
import { PaginaLandingsAdmin } from '../../componentes/kit/paginas/admin/Paginas';
import { landingDesde, landingAFirestore } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar, subirA } from './comun';

/*
 * D6d · Popups y páginas: los mismos servicios, claves e invalidaciones que
 * AdminPopups y AdminLandingPages. Las landings no usaban React Query (leían
 * con useEffect): aquí tienen su clave propia. Los temas (CSS por landing)
 * se quitaron el 2026-11-05: nadie los usaba.
 */

/* ── Popups ─────────────────────────────────────────── */

// La imagen va a la misma carpeta que en AdminPopups.
const subirPopup = subirA('config/popups', 'popup');

/*
 * /admin/popups: la lista entera vive en storeConfig/popups y se guarda
 * entera (savePopups). Si no se pudo leer, no se guarda: pisaría lo que haya
 * (AdminPopups apagaba "Nuevo popup"; el kit deja abrir la hoja, así que el
 * guardar es el que se niega). Los resultados, en personas, de
 * embudoPopupsSecure (cruza el clic con la cuenta); si no responde, las veces
 * de antes (un conteo por popup).
 */
async function leerEmbudos(ids) {
  try {
    const res = await httpsCallable(getFunctions(), 'embudoPopupsSecure')({ ids });
    return res.data?.embudos || {};
  } catch {
    const cifras = await Promise.all(ids.map((id) => getEstadisticasPopup(id).catch(() => null)));
    return Object.fromEntries(ids.map((id, i) => [id, cifras[i]]).filter(([, c]) => c));
  }
}

export function PopupsDelPanel() {
  const queryClient = useQueryClient();
  const popups = useLectura(['admin-popups'], getPopups, { staleTime: 0 });
  const lista = popups.datos || [];

  const ids = lista.map((p) => p.id);
  const embudos = useQuery({
    queryKey: ['admin-popup-embudos', ids.join(',')],
    queryFn: () => leerEmbudos(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

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
      estadisticas={embudos.data || {}}
      cargandoEstadisticas={embudos.isLoading}
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
