import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getLinkPages, getLinkPage, createLinkPage, updateLinkPage, deleteLinkPage, getClicsDeLinkPage, getAnaliticaEnlace,
} from '../../services/enlaces';
import { uploadFile } from '../../services/firebase/storage';
import { PaginaEnlacesAdmin, PaginaEnlaceAdmin } from '../../componentes/kit/paginas/admin/Enlaces';
import { paginaEnlacesDesde, paginaEnlacesAFirestore } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar } from './comun';

/*
 * Enlaces (D6c): las páginas «link in bio» de /l/{slug}. Los mismos
 * servicios (services/enlaces), claves e invalidaciones que AdminEnlaces y
 * AdminEnlaceEditor; el diseño se guarda con los nombres de siempre
 * (paginaEnlacesAFirestore) y updateLinkPage lo normaliza como antes.
 *
 * Una dirección /l/… no se repite: la página del kit ya lo avisa en el campo
 * con la lista que tiene, y aquí se vuelve a mirar antes de escribir (al
 * crear, con la lista de ['admin-link-pages'] como AdminEnlaces; al guardar,
 * con getLinkPages recién leído como AdminEnlaceEditor), porque
 * getLinkPageBySlug toma una sola y la otra quedaría inalcanzable.
 */

const LISTA = ['admin-link-pages'];
const mismoSlug = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/* ── La lista ──────────────────────────────────────────── */

/**
 * /admin/enlaces: getLinkPages (más nuevas primero) → paginaEnlacesDesde.
 * Crear entra al constructor de la página nueva; eliminar la borra entera.
 */
export function EnlacesDelPanel() {
  const navigate = useNavigate();
  const lectura = useLectura(LISTA, getLinkPages);
  const invalidar = useInvalidar();
  const paginas = useMemo(() => (lectura.datos || []).map(paginaEnlacesDesde), [lectura.datos]);

  return (
    <PaginaEnlacesAdmin
      paginas={paginas}
      cargando={lectura.cargando}
      error={lectura.error}
      onReintentar={lectura.onReintentar}
      onCrear={async ({ titulo, slug }) => {
        // Como AdminEnlaces: no deja crear con un enlace que ya tiene otra página.
        if ((lectura.datos || []).some((p) => mismoSlug(p.slug, slug))) {
          throw new Error(`Ya hay otra página en /l/${slug}: elige otro.`);
        }
        // createDocument devuelve { id, error } (sin data): el id es lo que abre el constructor.
        const res = await createLinkPage({ titulo, slug });
        if (res?.error || !res?.id) throw new Error(typeof res?.error === 'string' ? res.error : 'No se pudo crear la página.');
        await invalidar(LISTA);
        return res.id;
      }}
      onAbrir={(p) => navigate(`/admin/enlaces/${p.id}`)}
      onEliminar={async (id) => {
        await sinError(deleteLinkPage(id));
        await invalidar(LISTA);
      }}
    />
  );
}

/* ── El constructor ────────────────────────────────────── */

// Las carpetas de antes: link_pages/{carpeta}/{id}/{ms}_{nombre}.
const CARPETAS = ['avatars', 'thumbnails', 'redes', 'backgrounds'];

/**
 * subirImagen(blob, { alAvanzar, carpeta }) para los CampoImagen del
 * constructor, con el mismo uploadFile de AdminEnlaceEditor. Cada campo dice
 * su carpeta (avatars, thumbnails, redes, backgrounds), como antes.
 */
const subirDe = (id) => async (blob, { alAvanzar, carpeta } = {}) => {
  if (!blob || !String(blob.type || '').startsWith('image/')) throw new Error('Ese archivo no es una imagen.');
  alAvanzar?.(10);
  const esArchivo = blob instanceof File && Boolean(blob.name);
  const donde = CARPETAS.includes(carpeta) ? carpeta : 'avatars';
  const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const archivo = esArchivo ? blob : new File([blob], `recorte.${extension}`, { type: blob.type });
  const { url, error } = await uploadFile(archivo, `link_pages/${donde}/${id}/${Date.now()}_${archivo.name}`);
  if (error || !url) throw new Error(typeof error === 'string' ? error : 'No se pudo subir la imagen.');
  alAvanzar?.(100);
  return url;
};

/**
 * /admin/enlaces/:id: getLinkPage(id) → paginaEnlacesDesde; las demás
 * páginas (getLinkPages) para no repetir el enlace; los clics por botón y red
 * (getClicsDeLinkPage) y de dónde vienen (getAnaliticaEnlace, un minuto en
 * caché como antes). Guardar = updateLinkPage(id, paginaEnlacesAFirestore) e
 * invalidar la página y la lista.
 */
export function EnlaceDelPanel() {
  const { id } = useParams();
  const invalidar = useInvalidar();
  const lectura = useLectura(['admin-link-page', id], () => getLinkPage(id), { enabled: Boolean(id) });
  const todas = useLectura(LISTA, getLinkPages);
  // Sin datos o con error, como antes: {} y nada que mostrar (no tapan la página).
  const clics = useLectura(['admin-link-clics', id], () => getClicsDeLinkPage(id), { enabled: Boolean(id) });
  const analitica = useLectura(['admin-link-analitica', id], () => getAnaliticaEnlace(id), { enabled: Boolean(id), staleTime: 60_000 });

  // La misma referencia mientras no cambie el documento: la página del kit
  // vuelve a lo guardado cada vez que `pagina` cambia (perdería lo editado).
  const pagina = useMemo(() => (lectura.datos ? paginaEnlacesDesde(lectura.datos) : undefined), [lectura.datos]);
  const paginas = useMemo(() => (todas.datos || []).map(paginaEnlacesDesde), [todas.datos]);
  const subirImagen = useMemo(() => subirDe(id), [id]);

  return (
    <PaginaEnlaceAdmin
      pagina={pagina}
      paginas={paginas}
      cargando={lectura.cargando}
      error={lectura.error}
      onReintentar={lectura.onReintentar}
      clics={clics.datos || {}}
      analitica={analitica.datos}
      subirImagen={subirImagen}
      onGuardar={async (datos) => {
        const doc = paginaEnlacesAFirestore(datos);
        // Como AdminEnlaceEditor: se relee la lista justo antes de guardar y
        // ninguna OTRA página puede tener el mismo enlace (si la lectura
        // falla, se guarda igual, como antes).
        if (doc.slug) {
          const { data: otras } = await getLinkPages();
          if (Array.isArray(otras) && otras.some((p) => p.id !== id && mismoSlug(p.slug, doc.slug))) {
            throw new Error(`Ya hay otra página en /l/${doc.slug}: elige otro.`);
          }
        }
        await sinError(updateLinkPage(id, doc));
        await invalidar(['admin-link-page', id], LISTA);
      }}
    />
  );
}
