import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../services/firebase/config';
import {
  doc, getDoc, setDoc, addDoc, deleteDoc, collection, getDocs, query, orderBy, limit,
} from '../../services/firebase/observed.js';
import { getSurveyConfig, saveSurveyConfig, DEFAULT_SURVEY_CONFIG } from '../../services/encuestaConfig';
import { configConHistorial } from '../../services/encuestaHistorial.mjs';
import { getCategories } from '../../services/categories';
import { useProducts } from '../../hooks/useProducts';
import { PaginaNotificacionesAdmin } from '../../componentes/kit/paginas/admin/Notificaciones';
import { PaginaEncuestaAdmin } from '../../componentes/kit/paginas/admin/Encuestas';
import {
  configNotificacionesDesde, configNotificacionesAFirestore, campanaDesde, ofertaAFirestore, productoAdminDesde,
} from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar, subirA } from './comun';

/*
 * Avisos (D5d y D5e): las notificaciones con sus ofertas y el editor de la
 * encuesta de suscripción. Los mismos documentos, callables y payloads que
 * AdminNotifications y AdminEncuestas. Ninguna de las dos usaba React Query
 * y leían todo al entrar: las claves son nuevas, solo del admin, y se leen
 * de nuevo cada vez que se abre la página (o la pestaña), como antes.
 */

// Se vuelve a leer al entrar: guardar pisa el documento con lo que se leyó.
const FRESCA = { staleTime: 0, refetchOnMount: true };

/* ── D5d · Notificaciones ─────────────────────────────── */

const AJUSTES = ['notification_settings', 'global'];
const CLAVE_AJUSTES = ['admin-notificaciones-ajustes'];
const CLAVE_GUARDADAS = ['admin-notificaciones-guardadas'];
const CLAVE_HISTORIAL = ['admin-notificaciones-historial'];
const subirImagen = subirA('notifications', 'oferta');
const llamar = (nombre, datos) => httpsCallable(getFunctions(), nombre)(datos);
const filas = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/**
 * /admin/notificaciones: los avisos automáticos, las ofertas (guardadas,
 * prueba y envío) y el historial. Los ajustes se leen con getDoc(...).data():
 * getDocument agrega `id` y se escribiría en el documento. Las guardadas y el
 * historial se leen al abrir su pestaña, como antes.
 */
export function NotificacionesDelPanel() {
  const queryClient = useQueryClient();
  const invalidar = useInvalidar();
  const [pestana, setPestana] = useState('automaticos');

  // El documento tal cual (sin documento: {}; los valores de siempre los pone el adaptador).
  const ajustes = useQuery({
    queryKey: CLAVE_AJUSTES,
    queryFn: async () => {
      const snap = await getDoc(doc(db, ...AJUSTES));
      return snap.exists() ? snap.data() : {};
    },
    ...FRESCA,
  });
  // Memo: la página reinicia lo que se está editando cuando cambia `config`.
  const config = useMemo(() => (ajustes.data ? configNotificacionesDesde(ajustes.data) : undefined), [ajustes.data]);

  const guardadas = useQuery({
    queryKey: CLAVE_GUARDADAS,
    queryFn: async () => filas(await getDocs(query(collection(db, 'notification_drafts'), orderBy('updatedAt', 'desc'), limit(50)))),
    enabled: pestana === 'ofertas',
    ...FRESCA,
  });
  const historial = useQuery({
    queryKey: CLAVE_HISTORIAL,
    queryFn: async () => {
      const [campanas, estadisticas] = await Promise.all([
        getDocs(query(collection(db, 'notification_campaigns'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(collection(db, 'notification_stats')),
      ]);
      return { campanas: filas(campanas), estadisticas: filas(estadisticas) };
    },
    enabled: pestana === 'historial',
    ...FRESCA,
  });
  // "Anunciar un producto": el catálogo de la tienda (getProducts(), como BuscadorProducto), con la pestaña abierta.
  const productos = useProducts([], null, { enabled: pestana === 'ofertas' });

  const listaGuardadas = useMemo(() => (guardadas.data || []).map(campanaDesde), [guardadas.data]);
  const listaCampanas = useMemo(() => (historial.data?.campanas || []).map(campanaDesde), [historial.data]);
  const listaProductos = useMemo(() => (productos.data || []).map(productoAdminDesde).filter(Boolean), [productos.data]);

  return (
    <PaginaNotificacionesAdmin
      pestana={pestana}
      onPestana={setPestana}
      config={config}
      cargandoConfig={ajustes.isLoading}
      errorConfig={ajustes.error ? ajustes.error.message || 'No se pudo cargar.' : undefined}
      onReintentarConfig={() => ajustes.refetch()}
      onGuardarConfig={async (c) => {
        // Sobre lo leído, por sección: no se pierde ningún otro campo del documento (como antes).
        const leido = ajustes.data || {};
        const nuevo = configNotificacionesAFirestore(c);
        const documento = {
          ...leido,
          ...nuevo,
          categories: { ...(leido.categories || {}), ...nuevo.categories },
          schedules: { ...(leido.schedules || {}), ...nuevo.schedules },
          copys: { ...(leido.copys || {}), ...nuevo.copys },
        };
        await setDoc(doc(db, ...AJUSTES), documento);
        queryClient.setQueryData(CLAVE_AJUSTES, documento);
      }}
      // Solo a quien la pide, con el texto escrito ahora (aunque no esté guardado); `copy` con las claves del motor.
      onProbarAutomatico={async (clave, v) => (await llamar('probarAvisoAutomatico', {
        type: clave,
        copy: { text: v?.texto || '', emoji: v?.emoji || '', cta: v?.frase || '' },
      })).data}
      guardadas={listaGuardadas}
      onGuardarBorrador={async (d, id) => {
        // updatedAt como texto ISO: con un Timestamp, orderBy('updatedAt') la deja fuera de las 50.
        const datos = { ...ofertaAFirestore(d), updatedAt: new Date().toISOString() };
        let nuevoId = id;
        if (id) await setDoc(doc(db, 'notification_drafts', id), datos, { merge: true });
        else nuevoId = (await addDoc(collection(db, 'notification_drafts'), { ...datos, createdAt: datos.updatedAt })).id;
        await invalidar(CLAVE_GUARDADAS);
        return nuevoId;
      }}
      onEliminarBorrador={async (id) => {
        await deleteDoc(doc(db, 'notification_drafts', id));
        await invalidar(CLAVE_GUARDADAS);
      }}
      productos={listaProductos}
      subirImagen={subirImagen}
      onProbarOferta={async (d) => (await llamar('sendManualPromoNotification', { ...ofertaAFirestore(d), prueba: true })).data}
      onEnviarOferta={async (d, { programadaIso, forzar }) => {
        // Lo mismo que mandaba "Enviar a todos ahora". Si el horario de ofertas
        // no la deja salir, el error trae details.motivo y la página pregunta.
        const { title, body, segment, link, image } = ofertaAFirestore(d);
        const { data } = await llamar('sendManualPromoNotification', {
          title, body, segment, link, image, scheduledAt: programadaIso || null, forzar: Boolean(forzar),
        });
        if (!data?.success) throw new Error(data?.error || 'Error desconocido');
        return data.scheduled
          ? { programada: true, cuandoMs: Date.parse(data.scheduledAt) }
          : { programada: false, push: data.count, campanita: data.inApp };
      }}
      campanas={listaCampanas}
      estadisticas={historial.data?.estadisticas || []}
      cargandoHistorial={historial.isFetching}
      errorHistorial={historial.error ? historial.error.message || 'No se pudo cargar el historial.' : undefined}
      onActualizarHistorial={() => historial.refetch()}
      onCancelarCampana={async (id) => {
        await llamar('cancelPromoCampaign', { campaignId: id });
        await historial.refetch();
      }}
    />
  );
}

/* ── D5e · Encuesta de suscripción ────────────────────── */

/*
 * La config tal cual la da getSurveyConfig (lo guardado). La comparte con
 * "Cómo les fue con su pedido" de Opiniones (ResultadosClientesDelPanel),
 * que la lee y la guarda con la misma clave (repetida allá para no cargar
 * este archivo en Resultados).
 */
const CLAVE_CONFIG_ENCUESTA = ['admin-encuesta-config'];

/**
 * /admin/encuestas: el editor de la encuesta. Se muestra mezclada con
 * DEFAULT_SURVEY_CONFIG (por si hay campos nuevos) y se guarda con el
 * historial de lo que cambió contra lo guardado (configConHistorial).
 */
export function EncuestaDelPanel() {
  const queryClient = useQueryClient();
  const guardada = useLectura(CLAVE_CONFIG_ENCUESTA, getSurveyConfig, FRESCA);
  // Para ligar cada interés con categorías de la tienda; si falla, sin chips (como antes).
  const categorias = useLectura(['admin-categories'], getCategories);
  const config = useMemo(() => (guardada.datos ? { ...DEFAULT_SURVEY_CONFIG, ...guardada.datos } : undefined), [guardada.datos]);
  const categoriasTienda = useMemo(
    () => (categorias.datos || []).map((c) => ({ valor: c.id, texto: c.name })),
    [categorias.datos]
  );

  return (
    <PaginaEncuestaAdmin
      config={config}
      guardada={guardada.datos}
      categoriasTienda={categoriasTienda}
      cargando={guardada.cargando}
      error={guardada.error}
      onReintentar={guardada.onReintentar}
      onGuardar={async (c) => {
        const nuevo = configConHistorial(c, guardada.datos);
        await sinError(saveSurveyConfig(nuevo));
        queryClient.setQueryData(CLAVE_CONFIG_ENCUESTA, nuevo);
        // La tienda la lee aparte: que el cambio se vea sin recargar.
        queryClient.invalidateQueries({ queryKey: ['encuesta-config'] });
        queryClient.invalidateQueries({ queryKey: ['encuesta-entrega-config'] });
      }}
    />
  );
}
