import React, { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getSorteos, createSorteo, updateSorteo, deleteSorteo, getSorteoById, getParticipantes,
  asignarTicketsManual, grantRaffleChancesSecure, decidirGanadoresSorteo,
} from '../../services/sorteos';
import {
  getCampaigns, createCampaign, updateCampaign, deleteCampaign, getCampaignById, getContadorSuscriptores, getSuscriptores,
  grantChancesSuscripcion, decidirGanadoresSuscripcion,
  getBeneficios, createBeneficio, updateBeneficio, deleteBeneficio,
  getGanadoresGaleria, createGanadorGaleria, updateGanadorGaleria, deleteGanadorGaleria,
} from '../../services/suscripcionSorteos';
import { PaginaSorteosAdmin, PaginaSorteoAdmin } from '../../componentes/kit/paginas/admin/Sorteos';
import { PaginaSuscripcionesAdmin, PaginaSuscripcionAdmin } from '../../componentes/kit/paginas/admin/Suscripciones';
import {
  sorteoDesdeFirestore, sorteoAFormulario, participanteDesde,
  campanaSuscripcionDesde, campanaSuscripcionAFormulario, suscriptorDesde,
  beneficioDesde, beneficioAFirestore, ganadorGaleriaDesde, ganadorGaleriaAFirestore,
} from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar, subirA } from './comun';

/*
 * Sorteos (D6a y D6b): los sorteos y rifas con su detalle, y los sorteos por
 * suscripción con el suyo (donde ahora viven los beneficios y la galería).
 * Los mismos servicios, callables, claves e invalidaciones que AdminSorteos,
 * AdminSorteoDetalle, AdminSuscripcionSorteos (con BeneficiosEditor y
 * GaleriaEditor) y AdminSuscripcionDetalle. Elegir ganadores y mover tickets
 * o chances lo hace el servidor; aquí solo se pide y se refresca.
 *
 * Las fotos van a las carpetas de antes: cada campo de imagen del kit dice
 * la suya (premios, hero, logo).
 */

/* ── Sorteos y rifas (D6a) ─────────────────────────────── */

const subirPremioSorteo = subirA('sorteos/premios', 'premio');
const subirHeroSorteo = subirA('sorteos/hero', 'hero');
const subirImagenSorteo = (blob, opciones = {}) => (opciones.carpeta === 'hero' ? subirHeroSorteo : subirPremioSorteo)(blob, opciones);

/**
 * /admin/sorteos: getSorteos (del más nuevo al más viejo); guardar con
 * createSorteo / updateSorteo de sorteoAFormulario (el servicio arma el
 * documento y asegura el enlace único).
 */
export function SorteosDelPanel() {
  const navigate = useNavigate();
  const invalidar = useInvalidar();
  const sorteos = useLectura(['admin-sorteos'], getSorteos);
  const lista = useMemo(() => (sorteos.datos || []).map(sorteoDesdeFirestore), [sorteos.datos]);
  return (
    <PaginaSorteosAdmin
      sorteos={lista}
      cargando={sorteos.cargando}
      error={sorteos.error}
      onReintentar={sorteos.onReintentar}
      subirImagen={subirImagenSorteo}
      onGuardar={async (datos, id) => {
        const formulario = sorteoAFormulario(datos);
        await sinError(id ? updateSorteo(id, formulario) : createSorteo(formulario));
        await invalidar(['admin-sorteos']);
      }}
      onEliminar={async (id) => {
        await sinError(deleteSorteo(id));
        await invalidar(['admin-sorteos']);
      }}
      onDetalle={(x) => navigate(`/admin/sorteos/${x.id}`)}
    />
  );
}

/**
 * /admin/sorteos/:id: el sorteo y sus participantes (los primeros 200);
 * tickets y chances a mano (asignarTicketsManual, grantRaffleChancesSecure)
 * y los ganadores (decidirGanadoresSorteo, con excluirUids para volver a
 * sortear sin los de ahora).
 */
export function SorteoDelPanel() {
  const { id } = useParams();
  const invalidar = useInvalidar();
  const conId = { enabled: Boolean(id) };
  const sorteo = useLectura(['admin-sorteo', id], () => getSorteoById(id), conId);
  const participantes = useLectura(['admin-sorteo-participantes', id], () => getParticipantes(id), conId);
  const lista = useMemo(() => (participantes.datos || []).map(participanteDesde), [participantes.datos]);

  return (
    <PaginaSorteoAdmin
      sorteo={sorteo.datos ? sorteoDesdeFirestore(sorteo.datos) : undefined}
      participantes={lista}
      cargando={sorteo.cargando || participantes.cargando}
      error={sorteo.error || participantes.error}
      onReintentar={() => { sorteo.onReintentar(); participantes.onReintentar(); }}
      urlPublica={(x) => `/sorteos/${x.slug}`}
      onSumarTickets={async (d) => {
        const r = await sinError(asignarTicketsManual({ sorteoId: id, ...d }));
        // Como antes: solo la tabla de participantes.
        await invalidar(['admin-sorteo-participantes', id]);
        return r;
      }}
      onDarChances={async (d) => {
        // Devuelve { chancesTotal } para el aviso.
        const r = await sinError(grantRaffleChancesSecure({ sorteoId: id, ...d }));
        await invalidar(['admin-sorteo-participantes', id]);
        return r;
      }}
      onDecidirGanadores={async ({ numGanadores, excluirUids } = {}) => {
        // Sin excluirUids cierra el sorteo; con ellos vuelve a sortear sin esos.
        const r = await sinError(decidirGanadoresSorteo({ sorteoId: id, numGanadores, excluirUids }));
        // Puede cambiar el estado y los ganadores: la cabecera y los participantes.
        await invalidar(['admin-sorteo', id], ['admin-sorteo-participantes', id]);
        return r;
      }}
    />
  );
}

/* ── Sorteos por suscripción (D6b) ─────────────────────── */

const subirPremioCampana = subirA('sorteos_suscripcion/premios', 'premio');
const subirHeroCampana = subirA('sorteos_suscripcion/hero', 'hero');
const subirLogoCampana = subirA('sorteos_suscripcion/logo', 'logo');

const CARPETAS_CAMPANA = { premios: subirPremioCampana, hero: subirHeroCampana, logo: subirLogoCampana };
const subirImagenCampana = (blob, opciones = {}) => (CARPETAS_CAMPANA[opciones.carpeta] || subirPremioCampana)(blob, opciones);

const PESTANAS = ['suscriptores', 'beneficios', 'galeria'];
const rutaCampana = (id, pestana) => `/admin/sorteos-suscripcion/${id}${pestana && pestana !== 'suscriptores' ? `?ver=${pestana}` : ''}`;

/**
 * /admin/sorteos-suscripcion: getCampaigns (de la más nueva a la más vieja);
 * guardar con createCampaign / updateCampaign de campanaSuscripcionAFormulario
 * (los soles pasan a céntimos). Los beneficios y la galería se editan en el
 * detalle (`?ver=beneficios`).
 */
export function SuscripcionesDelPanel() {
  const navigate = useNavigate();
  const invalidar = useInvalidar();
  const campanas = useLectura(['admin-suscripcion-campaigns'], getCampaigns);
  const lista = useMemo(() => (campanas.datos || []).map(campanaSuscripcionDesde), [campanas.datos]);
  return (
    <PaginaSuscripcionesAdmin
      campanas={lista}
      cargando={campanas.cargando}
      error={campanas.error}
      onReintentar={campanas.onReintentar}
      subirImagen={subirImagenCampana}
      onGuardar={async (datos, id) => {
        const formulario = campanaSuscripcionAFormulario(datos);
        if (id) await sinError(updateCampaign(id, formulario));
        else {
          // Como antes: sin id de vuelta, no se creó.
          const r = await createCampaign(formulario);
          if (r?.error || !r?.id) throw new Error(r?.error || 'No se pudo crear la campaña.');
        }
        await invalidar(['admin-suscripcion-campaigns']);
      }}
      onEliminar={async (id) => {
        await sinError(deleteCampaign(id));
        await invalidar(['admin-suscripcion-campaigns']);
      }}
      onDetalle={(c, pestana) => navigate(rutaCampana(c.id, pestana))}
    />
  );
}

const subirBeneficio = subirA('sorteos_suscripcion/beneficios', 'beneficio');
const subirGanadorGaleria = subirA('sorteos_suscripcion/galeria', 'ganador');

/**
 * /admin/sorteos-suscripcion/:id (`?ver=beneficios` | `?ver=galeria`): la
 * campaña, el contador de los shards y sus suscriptores (los primeros 200,
 * con el plan de la campaña); chances a mano (grantChancesSuscripcion) y los
 * ganadores (decidirGanadoresSuscripcion). Los beneficios y la galería se
 * leen solo al abrir su pestaña, como antes al abrir su editor.
 */
export function SuscripcionDelPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [buscar] = useSearchParams();
  const invalidar = useInvalidar();
  const pestana = PESTANAS.includes(buscar.get('ver')) ? buscar.get('ver') : 'suscriptores';
  const conId = { enabled: Boolean(id) };

  const campana = useLectura(['admin-suscripcion-campaign', id], () => getCampaignById(id), conId);
  // El contador de antes: si falla, el servicio da 0 y no es un error.
  const contador = useQuery({
    queryKey: ['admin-suscripcion-contador', id],
    queryFn: async () => (await getContadorSuscriptores(id)).data,
    enabled: Boolean(id),
  });
  const suscriptores = useLectura(['admin-suscripcion-suscriptores', id], () => getSuscriptores(id), conId);
  const beneficios = useLectura(['admin-suscripcion-beneficios', id], () => getBeneficios(id), { enabled: Boolean(id) && pestana === 'beneficios' });
  const galeria = useLectura(['admin-suscripcion-galeria', id], () => getGanadoresGaleria(id), { enabled: Boolean(id) && pestana === 'galeria' });

  const datos = useMemo(() => (campana.datos ? campanaSuscripcionDesde(campana.datos) : undefined), [campana.datos]);
  // El precio no está en el suscriptor: sale de su plan en la campaña.
  const lista = useMemo(() => (suscriptores.datos || []).map((s) => suscriptorDesde(s, datos?.planes || [])), [suscriptores.datos, datos]);
  const parte = { suscriptores, beneficios, galeria }[pestana];

  return (
    <PaginaSuscripcionAdmin
      campana={datos}
      contador={contador.data}
      cargando={campana.cargando || parte.cargando}
      error={campana.error || parte.error}
      onReintentar={() => { campana.onReintentar(); parte.onReintentar(); }}
      pestana={pestana}
      onPestana={(p) => navigate(rutaCampana(id, p), { replace: true })}
      urlPublica={(c) => `/suscrito-sorteo/${c.slug}`}
      suscriptores={lista}
      onDarChances={async (d) => {
        // Devuelve { chancesTotal } para el aviso.
        const r = await sinError(grantChancesSuscripcion({ campaignId: id, ...d }));
        await invalidar(['admin-suscripcion-suscriptores', id]);
        return r;
      }}
      onDecidirGanadores={async ({ numGanadores, excluirUids } = {}) => {
        // Solo entre los suscriptores al día; con excluirUids vuelve a sortear sin esos.
        const r = await sinError(decidirGanadoresSuscripcion({ campaignId: id, numGanadores, excluirUids }));
        await invalidar(['admin-suscripcion-campaign', id], ['admin-suscripcion-suscriptores', id]);
        return r;
      }}
      beneficios={(beneficios.datos || []).map(beneficioDesde)}
      onGuardarBeneficio={async (d, beneficioId) => {
        const doc = beneficioAFirestore(d);
        await sinError(beneficioId ? updateBeneficio(id, beneficioId, doc) : createBeneficio(id, doc));
        await invalidar(['admin-suscripcion-beneficios', id]);
      }}
      onEliminarBeneficio={async (beneficioId) => {
        await sinError(deleteBeneficio(id, beneficioId));
        await invalidar(['admin-suscripcion-beneficios', id]);
      }}
      galeria={(galeria.datos || []).map(ganadorGaleriaDesde)}
      onGuardarGanador={async (d, ganadorId) => {
        const doc = ganadorGaleriaAFirestore(d);
        await sinError(ganadorId ? updateGanadorGaleria(id, ganadorId, doc) : createGanadorGaleria(id, doc));
        await invalidar(['admin-suscripcion-galeria', id]);
      }}
      onEliminarGanador={async (ganadorId) => {
        await sinError(deleteGanadorGaleria(id, ganadorId));
        await invalidar(['admin-suscripcion-galeria', id]);
      }}
      // Cada pestaña sube a su carpeta de antes (los logos de las marcas o las fotos de la galería).
      subirImagen={pestana === 'galeria' ? subirGanadorGaleria : subirBeneficio}
    />
  );
}
