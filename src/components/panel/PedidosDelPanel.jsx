import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAdminWalaOrders from '../../hooks/useAdminWalaOrders';
import { getMessage, setMessage } from '../../services/messages';
import { createDocument, getCollection, updateDocument } from '../../services/firebase/firestore';
import { getEnlacesPago } from '../../services/enlacesPago';
import { getPedidosForAccountSync } from '../../services/erp/firebase';
import {
  ensureAccountFromOrderData, extraerDatosClienteDesdePedido, migrateLegacyAutoCreatedUsers,
} from '../../services/accountFromOrder';
import { empresa } from '../../config/empresa';
import { PaginaRecepcion } from '../../componentes/kit/paginas/admin/Pedidos';
import { PaginaPagos } from '../../componentes/kit/paginas/admin/Pagos';
import { PaginaCuentasDePedidos } from '../../componentes/kit/paginas/admin/Cuentas';
import { PaginaReclamos } from '../../componentes/kit/paginas/admin/Reclamos';
import { configPagosDesde, configPagosAMensajes, reclamoDesdeFirestore } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useInvalidar } from './comun';

/*
 * Pedidos y pagos (D3): recepción, gestión de pagos, cuentas desde pedidos y
 * el libro de reclamaciones. Los mismos servicios, claves e invalidaciones
 * que DashRecepcion, AdminGestionPagos, AdminCrearCuentasPedidos y
 * AdminLibroReclamaciones.
 */

/** /admin/recepcion-pedidos: los pedidos del ERP (solo lectura). "Ver detalle" abre la ficha del cliente, como antes. */
export function RecepcionDelPanel() {
  const { data, isLoading, isFetching, isError, refetch } = useAdminWalaOrders();
  const sinErp = isError || data?.available === false;
  return (
    <PaginaRecepcion
      pedidos={data?.pedidos || []}
      cargando={isLoading}
      actualizando={isFetching && !isLoading}
      error={sinErp ? (data?.error || 'No se pudieron cargar los pedidos del ERP en este momento.') : undefined}
      onActualizar={() => refetch()}
      detalleDe={(p) => `/cuenta/pedidos/${p.id}`}
    />
  );
}

// Los mensajes de los ajustes de pagos (más el WhatsApp de la cuenta, de respaldo).
const CLAVES_PAGOS = ['yape_number', 'yape_name', 'plin_number', 'plin_name', 'whatsapp_number_pagos', 'whatsapp_text_pagos', 'whatsapp_number_cuenta'];

/** /admin/gestion-pagos: historial de enlaces, crear uno nuevo y los ajustes de cobro. */
export function PagosDelPanel() {
  const invalidar = useInvalidar();
  const enlaces = useQuery({
    queryKey: ['enlaces-pago', { max: 300 }],
    queryFn: () => sinError(getEnlacesPago({ max: 300 })),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const config = useQuery({
    queryKey: ['admin-pagos-config'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const valores = await Promise.all(CLAVES_PAGOS.map((k) => getMessage(k)));
      return configPagosDesde(Object.fromEntries(CLAVES_PAGOS.map((k, i) => [k, valores[i]?.data ?? ''])));
    },
  });

  return (
    <PaginaPagos
      enlaces={enlaces.data || []}
      cargando={enlaces.isLoading}
      actualizando={enlaces.isFetching && !enlaces.isLoading}
      error={enlaces.error ? enlaces.error.message || 'No se pudo cargar el historial.' : undefined}
      onActualizar={() => enlaces.refetch()}
      urlDe={(id) => `${window.location.origin}/pago-rapido/${id}`}
      onGenerar={async (datos) => {
        const { id, error } = await createDocument('enlaces_pago', datos);
        if (error) throw new Error(error);
        await invalidar(['enlaces-pago']);
        return id;
      }}
      config={config.data}
      cargandoConfig={config.isLoading}
      onGuardarConfig={async (c) => {
        await Promise.all(Object.entries(configPagosAMensajes(c)).map(([k, v]) => sinError(setMessage(k, v))));
        await invalidar(['admin-pagos-config'], ['user-pagos-config']);
      }}
    />
  );
}

const POR_PAGINA = 100;
const POR_TANDA = 15;
const PAUSA_MS = 400;
const correoDe = (pedido) => {
  const { email } = extraerDatosClienteDesdePedido(pedido);
  return typeof email === 'string' && email.trim().length >= 5 && email.includes('@') ? email : '';
};

/** /admin/crear-cuentas-pedidos: los pedidos del ERP de a 100, una cuenta por correo, de a 15 con pausa. */
export function CuentasDePedidosDelPanel() {
  const [pedidos, setPedidos] = useState([]);
  const [ultimo, setUltimo] = useState(null);

  // Uno por correo (el primero que aparece), solo los de correo válido.
  const unicos = useMemo(() => {
    const vistos = new Set();
    return pedidos.filter((p) => {
      const correo = correoDe(p).toLowerCase();
      if (!correo || vistos.has(correo)) return false;
      vistos.add(correo);
      return true;
    });
  }, [pedidos]);

  return (
    <PaginaCuentasDePedidos
      cargados={pedidos.length}
      unicos={unicos.length}
      hayMas={Boolean(ultimo)}
      porPagina={POR_PAGINA}
      onCargar={async ({ mas } = {}) => {
        const { data, lastDoc, error } = await getPedidosForAccountSync(POR_PAGINA, mas ? ultimo : null);
        if (error) throw new Error(error);
        setPedidos((antes) => (mas ? [...antes, ...(data || [])] : data || []));
        setUltimo(lastDoc || null);
      }}
      onCrearCuentas={async (avisar) => {
        let creadas = 0;
        let existian = 0;
        let errores = 0;
        const detalles = [];
        for (let i = 0; i < unicos.length; i += POR_TANDA) {
          for (const pedido of unicos.slice(i, i + POR_TANDA)) {
            const r = await ensureAccountFromOrderData(pedido, { linkOrderId: true });
            if (r.created) creadas += 1;
            else if (r.existing) existian += 1;
            else {
              errores += 1;
              detalles.push(`${correoDe(pedido) || pedido.id}: ${r.error || 'Error'}`);
            }
          }
          avisar?.(`Creando cuentas… ${Math.min(i + POR_TANDA, unicos.length)} de ${unicos.length}`);
          if (i + POR_TANDA < unicos.length) await new Promise((listo) => { setTimeout(listo, PAUSA_MS); });
        }
        return { creadas, existian, errores, detalles };
      }}
      onMigrar={async ({ simulacion } = {}) => {
        const { data, error } = await migrateLegacyAutoCreatedUsers({ maxPedidos: 5000, ...(simulacion && { dryRun: true }) });
        if (error) throw new Error(typeof error === 'string' ? error : error.message || 'No se pudo migrar.');
        return data;
      }}
    />
  );
}

/** /admin/libro-reclamaciones: los reclamos, del más nuevo al más viejo, y responder. */
export function ReclamosDelPanel() {
  const invalidar = useInvalidar();
  const reclamos = useQuery({
    queryKey: ['admin-libro-reclamaciones'],
    queryFn: () => sinError(getCollection('libro_reclamaciones', [], { field: 'createdAt', direction: 'desc' })),
  });
  return (
    <PaginaReclamos
      reclamos={(reclamos.data || []).map(reclamoDesdeFirestore)}
      plazo={empresa.plazoRespuestaDiasHabiles}
      cargando={reclamos.isLoading}
      actualizando={reclamos.isFetching && !reclamos.isLoading}
      error={reclamos.error ? reclamos.error.message || 'No se pudieron cargar los reclamos.' : undefined}
      onActualizar={() => reclamos.refetch()}
      onResponder={async (id, datos) => {
        await sinError(updateDocument('libro_reclamaciones', id, datos));
        // También la cuenta del inicio del panel.
        await invalidar(['admin-libro-reclamaciones'], ['admin-inicio', 'reclamos-pendientes']);
      }}
    />
  );
}
