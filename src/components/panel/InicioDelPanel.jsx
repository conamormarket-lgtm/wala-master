import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import useAdminWalaOrders from '../../hooks/useAdminWalaOrders';
import { collection, getCountFromServer, query, where } from '../../services/firebase/observed';
import { db } from '../../services/firebase/config';
import { PaginaInicioAdmin } from '../../componentes/kit/paginas/admin/Inicio';
import { puedeVer } from '../../componentes/kit/adaptadoresAdmin';

const DISENO = ['manage_design'];
const CLIENTES = ['manage_clients'];

/** Cuántos documentos cumplen campo == valor (una lectura por cada 1000). */
const contar = async (coleccion, campo, valor) => {
  const snap = await getCountFromServer(query(collection(db, coleccion), where(campo, '==', valor)));
  return snap.data().count;
};

const ATAJOS = [
  { to: '/admin/productos', texto: 'Productos', detalle: 'Crear, editar y su stock', icono: 'productos', tono: 'degradado', permiso: ['manage_products', 'manage_inventory'] },
  { to: '/admin/resultados', texto: 'Resultados', detalle: 'Cómo va la tienda', icono: 'resultados', tono: 'oro', permiso: [...DISENO, ...CLIENTES] },
  { to: '/admin/categorias', texto: 'Categorías', detalle: 'Las burbujas de cada marca', icono: 'categorias', tono: 'degradado', permiso: ['manage_products'] },
  { to: '/admin/notificaciones', texto: 'Notificaciones', detalle: 'Ofertas y novedades', icono: 'notificaciones', tono: 'rosa', permiso: DISENO },
  { to: '/admin/fechas-importantes', texto: 'Fechas importantes', detalle: 'El calendario de campañas', icono: 'fechas', tono: 'rosa', permiso: CLIENTES },
];

/*
 * El inicio del panel (/admin, D0): lo que espera respuesta y los atajos,
 * solo lo que este admin puede abrir.
 *  - Pedidos por entregar: los mismos de Recepción (useAdminWalaOrders con
 *    los mismos parámetros: comparten la caché).
 *  - Reclamos sin responder (libro_reclamaciones, estado 'pendiente') y
 *    evidencias de retos por revisar (challengeEvidences, status 'pending'):
 *    solo la cuenta, sin bajar los documentos.
 * Los "referidos por aprobar" de la demo no van: con el modelo de hoy las
 * monedas se liberan solas y el admin no aprueba nada.
 */
export default function InicioDelPanel() {
  const { user, userProfile, adminPermissions } = useAuth();
  const permisos = adminPermissions || [];
  const ve = (permiso) => puedeVer({ permiso }, permisos);

  const pedidos = useAdminWalaOrders({}, { enabled: ve(DISENO) });
  const reclamos = useQuery({
    queryKey: ['admin-inicio', 'reclamos-pendientes'],
    queryFn: () => contar('libro_reclamaciones', 'estado', 'pendiente'),
    enabled: ve(CLIENTES),
    staleTime: 60 * 1000,
  });
  const retos = useQuery({
    queryKey: ['admin-inicio', 'evidencias-pendientes'],
    queryFn: () => contar('challengeEvidences', 'status', 'pending'),
    enabled: ve(CLIENTES),
    staleTime: 60 * 1000,
  });

  const pendientes = [
    ve(DISENO) && { id: 'pedidos', texto: 'Pedidos por entregar', detalle: 'Ni entregados ni anulados', cuenta: pedidos.data?.resumen?.porEntregar ?? 0, to: '/admin/recepcion-pedidos', icono: 'pedidos', tono: 'menta' },
    ve(CLIENTES) && { id: 'reclamos', texto: 'Reclamos sin responder', detalle: 'El plazo legal es de 15 días hábiles', cuenta: reclamos.data ?? 0, to: '/admin/libro-reclamaciones', icono: 'reclamos', tono: 'rosa' },
    ve(CLIENTES) && { id: 'retos', texto: 'Evidencias de retos', detalle: 'Fotos que mandaron los clientes', cuenta: retos.data ?? 0, to: '/admin/retos', icono: 'retos', tono: 'oro' },
  ].filter(Boolean);
  const cargando = [pedidos, reclamos, retos].some((q) => q.isLoading && q.fetchStatus !== 'idle');

  return (
    <PaginaInicioAdmin
      usuario={{ nombre: userProfile?.displayName || userProfile?.nombre || user?.displayName || user?.email?.split('@')[0] || '' }}
      cargando={cargando}
      pendientes={pendientes}
      atajos={ATAJOS.filter((a) => puedeVer(a, permisos))}
    />
  );
}
