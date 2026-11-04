import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, getDocs, orderBy, where, deleteField } from '../../services/firebase/observed';
import { db } from '../../services/firebase/config';
import { getCollection, getDocument, createDocument, updateDocument, deleteDocument, setDocument } from '../../services/firebase/firestore';
import { estimateReferralReward } from '../../services/referrals';
import { getMissions, createMission, updateMission, deleteMission } from '../../services/missions';
import { getRewards, createReward, updateReward, deleteReward } from '../../services/rewardsCatalog';
import { getProducts } from '../../services/products';
import { MISSION_ACTIONS } from '../../constants/missionActions';
import {
  PaginaReferidosAdmin, PaginaMisionesAdmin, PaginaRetosAdmin, PaginaRecompensasAdmin,
} from '../../componentes/kit/paginas/admin/Fidelidad';
import {
  referidoDesdeFirestore, referentesDesde, misionDesdeFirestore, misionAFirestore, retoDesdeFirestore, retoAFirestore,
  retoActivoDesde, evidenciaDesde, recompensaAdminDesdeFirestore, recompensaAdminAFirestore, productoAdminDesde,
} from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useLectura, useInvalidar, subirA } from './comun';

/*
 * Clientes y fidelidad (D5a y D5b): referidos, misiones diarias, retos
 * semanales y recompensas. Los mismos servicios, claves e invalidaciones
 * que AdminReferidos, AdminMisiones, AdminRetos y AdminRecompensas.
 *
 * Vaciar un campo (la verificación de una misión, la foto o el producto de
 * una recompensa) viaja como deleteField(): updateDocument lo deja pasar tal
 * cual y Firestore borra la llave, en vez de quedarse con el valor de antes.
 */

/* ── Referidos ─────────────────────────────────────────── */

/** El nombre completo de un perfil, sin correos. */
const nombreDePerfil = (p = {}) => [p.displayName, p.clienteNombre, p.name, p.nombre]
  .map((v) => String(v ?? '').trim())
  .find((v) => v && !v.includes('@')) || '';

/**
 * Quién es el dueño de cada código: portal_clientes_users por referralCode,
 * de 30 en 30 (el máximo de un "in"). Si falla, la lista sale con los códigos.
 */
async function perfilesDeCodigos(codigos) {
  const perfiles = {};
  for (let i = 0; i < codigos.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'portal_clientes_users'), where('referralCode', 'in', codigos.slice(i, i + 30))));
    snap.docs.forEach((d) => {
      const p = d.data() || {};
      perfiles[p.referralCode] = { uid: d.id, nombre: nombreDePerfil(p) };
    });
  }
  return perfiles;
}

/**
 * /admin/referidos: una fila por persona que comparte, con sus visitas
 * dentro (el estimado de monedas es estimateReferralReward).
 */
export function ReferidosDelPanel() {
  const referidos = useQuery({
    queryKey: ['adminReferrals'],
    queryFn: async () => {
      const snapshot = await getDocs(query(collection(db, 'referrals'), orderBy('createdAt', 'desc')));
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  });
  const codigos = useMemo(
    () => [...new Set((referidos.data || []).map((r) => r.referrerCode).filter(Boolean))].sort(),
    [referidos.data],
  );
  const perfiles = useQuery({
    queryKey: ['adminReferrals-perfiles', codigos],
    queryFn: () => perfilesDeCodigos(codigos),
    enabled: codigos.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const productos = useLectura(['admin-referidos-productos'], () => getProducts([], null, null, { includeHidden: true }), { staleTime: 5 * 60 * 1000 });
  const lista = useMemo(() => {
    const nombres = new Map((productos.datos || []).map((p) => [p.id, p.name]));
    return (referidos.data || []).map((r) => referidoDesdeFirestore(r, estimateReferralReward, (id) => nombres.get(id)));
  }, [referidos.data, productos.datos]);
  const personas = useMemo(() => referentesDesde(lista, perfiles.data || {}), [lista, perfiles.data]);
  return (
    <PaginaReferidosAdmin
      referidos={lista}
      personas={personas}
      cargando={referidos.isLoading}
      error={referidos.error ? referidos.error.message || 'No se pudieron cargar los referidos.' : undefined}
      onReintentar={() => referidos.refetch()}
    />
  );
}

/* ── Misiones diarias ──────────────────────────────────── */

// Las opciones de "Verificación": las mismas claves que valida completeMissionSecure.
const VERIFICACIONES = Object.entries(MISSION_ACTIONS).map(([clave, accion]) => ({ valor: clave, texto: accion.adminLabel }));

/** /admin/misiones: getMissions por orden; guardar con misionAFirestore. */
export function MisionesDelPanel() {
  const misiones = useLectura(['admin-missions'], getMissions);
  const invalidar = useInvalidar();
  return (
    <PaginaMisionesAdmin
      misiones={(misiones.datos || []).map(misionDesdeFirestore)}
      verificaciones={VERIFICACIONES}
      cargando={misiones.cargando}
      error={misiones.error}
      onReintentar={misiones.onReintentar}
      onGuardar={async (datos, id) => {
        const doc = misionAFirestore(datos);
        // Sin verificación al editar: se borra la que tenía (pasa a la marca el cliente).
        await sinError(id ? updateMission(id, { ...doc, actionKey: doc.actionKey || deleteField() }) : createMission(doc));
        await invalidar(['admin-missions']);
      }}
      onEliminar={async (id) => {
        await sinError(deleteMission(id));
        await invalidar(['admin-missions']);
      }}
    />
  );
}

/* ── Retos semanales ───────────────────────────────────── */

const SOLO_PENDIENTES = [{ field: 'status', operator: '==', value: 'pending' }];

// Sin reto activo, getDocument devuelve el error "Documento no encontrado": como antes, es null.
const leerRetoActivo = async () => (await getDocument('globals', 'activeChallenge')).data || null;

/**
 * /admin/retos: el catálogo (weeklyChallenges), el reto de esta semana
 * (globals/activeChallenge, siete días) y las evidencias pendientes, que se
 * aprueban o rechazan con approveChallengeEvidence (el servidor paga).
 */
export function RetosDelPanel() {
  const invalidar = useInvalidar();
  const catalogo = useLectura(['admin-retos'], () => getCollection('weeklyChallenges'));
  const activo = useQuery({ queryKey: ['admin-reto-activo'], queryFn: leerRetoActivo });
  const evidencias = useLectura(['admin-retos-evidencias'], () => getCollection('challengeEvidences', SOLO_PENDIENTES));

  const retos = useMemo(() => (catalogo.datos || []).map(retoDesdeFirestore), [catalogo.datos]);
  const pendientes = useMemo(
    () => (evidencias.datos || []).map((e) => evidenciaDesde(e, retos, activo.data || null)),
    [evidencias.datos, retos, activo.data],
  );

  // Lo que da sale del reto de la evidencia (o del activo, como antes); rechazar no da nada.
  const procesar = async (ev, action, rewardCoins, rewardType) => {
    await httpsCallable(getFunctions(), 'approveChallengeEvidence')({ evidenceId: ev.id, action, rewardCoins, rewardType });
    // También la cuenta del inicio del panel.
    await invalidar(['admin-retos-evidencias'], ['admin-inicio', 'evidencias-pendientes']);
  };

  return (
    <PaginaRetosAdmin
      retos={retos}
      activo={activo.data || null}
      evidencias={pendientes}
      cargando={catalogo.cargando || evidencias.cargando || activo.isLoading}
      error={catalogo.error || evidencias.error}
      onReintentar={() => { catalogo.onReintentar(); evidencias.onReintentar(); activo.refetch(); }}
      onGuardar={async (datos, id) => {
        const doc = retoAFirestore(datos);
        await sinError(id ? updateDocument('weeklyChallenges', id, doc) : createDocument('weeklyChallenges', doc));
        await invalidar(['admin-retos']);
      }}
      onEliminar={async (id) => {
        await sinError(deleteDocument('weeklyChallenges', id));
        await invalidar(['admin-retos']);
      }}
      onActivar={async (reto) => {
        await sinError(setDocument('globals', 'activeChallenge', retoActivoDesde(reto)));
        await invalidar(['admin-reto-activo']);
      }}
      onAprobar={(ev) => procesar(ev, 'approve', ev.monedas, ev.tipoRecompensa)}
      onRechazar={(ev) => procesar(ev, 'reject', 0, 'main')}
    />
  );
}

/* ── Recompensas ───────────────────────────────────────── */

// La foto recortada va donde iba: rewards/{ms}_cropped.jpg (RecortarFoto da jpeg).
const subirImagen = subirA('rewards', 'cropped');

/**
 * /admin/recompensas: getRewards por orden; guardar con
 * recompensaAdminAFirestore e invalidar también ['rewards'] (el catálogo de
 * «Mi cuenta»). Los productos para elegir: el catálogo de la tienda
 * (getProducts sin ocultos, como el BuscadorProducto de antes).
 */
export function RecompensasDelPanel() {
  const recompensas = useLectura(['admin-rewards'], getRewards);
  const productos = useLectura(['admin-recompensas-productos'], () => getProducts(), { staleTime: 5 * 60 * 1000 });
  const invalidar = useInvalidar();
  const refrescar = () => invalidar(['admin-rewards'], ['rewards']);
  const lista = useMemo(() => (productos.datos || []).map(productoAdminDesde).filter(Boolean), [productos.datos]);

  return (
    <PaginaRecompensasAdmin
      recompensas={(recompensas.datos || []).map(recompensaAdminDesdeFirestore)}
      productos={lista}
      subirImagen={subirImagen}
      cargando={recompensas.cargando}
      error={recompensas.error}
      onReintentar={recompensas.onReintentar}
      onGuardar={async (datos, id) => {
        const doc = recompensaAdminAFirestore(datos);
        // Al editar, quitar la foto o el producto (o cambiar a un tipo sin producto) los borra de verdad.
        await sinError(id
          ? updateReward(id, {
            ...doc,
            imageUrl: doc.imageUrl || deleteField(),
            productId: doc.productId || deleteField(),
            productName: doc.productName || deleteField(),
          })
          : createReward(doc));
        await refrescar();
      }}
      onEliminar={async (id) => {
        await sinError(deleteReward(id));
        await refrescar();
      }}
    />
  );
}
