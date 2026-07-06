import { useState, useEffect } from 'react';
import { buscarPedidoCliente } from '../services/api';
import { searchOrdersByDniInERP } from '../services/erp/firebase';
import { isErpFirestoreAvailable } from '../services/erp/firebase';
import { normalizarPedidoParaVista, extraerDatosClienteDesdePedidos } from '../utils/pedidos';
import {
  ensureAccountFromOrderData,
  extraerDatosClienteDesdePedido,
} from '../services/accountFromOrder';

const getMillis = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();

  const d = new Date(v);
  return isNaN(d) ? 0 : d.getTime();
};

// Caché en memoria por (dni + userId): la clave debe considerar AMBOS, porque
// añadir el userId puede traer pedidos del espejo (wala_pedidos) que no aparecen
// buscando solo por DNI. Si la clave ignorara el userId, un usuario logueado
// vería la caché vieja.
const cachePedidos = { clave: null, data: null };

/** Clave de caché estable que combina DNI y userId ambos pueden faltar. */
const claveCache = (dni, userId) =>
  `${dni != null ? String(dni).trim() : ''}::${userId != null ? String(userId) : ''}`;

const MAX_ACCOUNT_SYNC_PER_LOAD = 25;

/**
 * Determina si un pedido viene del portal WALA.
 *
 * IMPORTANTE:
 * Antes "Mis Pedidos" filtraba SOLO pedidos WALA usando esta función.
 * Eso ocultaba pedidos creados directamente desde el ERP, por ejemplo:
 * canalVenta: "Otro", activador: "Otro", vendedor: "YORYO".
 *
 * Ahora esta función se mantiene como referencia/proveniencia, pero ya NO se usa
 * para filtrar la lista principal de "Mis Pedidos". La búsqueda por DNI ya limita
 * los pedidos al cliente correspondiente.
 *
 * @param {Object} p - Pedido CRUDO tal como viene del ERP.
 * @returns {boolean} true si el pedido fue hecho desde WALA.
 */
const esPedidoWala = (p) =>
  !!p &&
  (p.canalVenta === 'Portal Web' ||
    p.web === true ||
    p.activador === 'portal_web' ||
    p.vendedor === 'Portal Web' ||
    p._esWalaMirror === true ||
    !!p.portalPseudoOrderId ||
    !!p.pedidoWebId ||
    !!p.buyerUid);

/**
 * Hook para búsqueda de pedidos por DNI.
 *
 * Muestra pedidos asociados al DNI del cliente desde:
 * - pedidos
 * - pedidos_web
 * - wala_pedidos cuando exista espejo WALA
 *
 * Antes se filtraba solo a pedidos WALA con esPedidoWala().
 * Eso hacía que los pedidos creados desde el ERP no aparezcan en "Mis Pedidos".
 *
 * @param {string} [initialDni] - DNI/CE del perfil.
 * @param {string} [initialUserId] - UID del comprador autenticado.
 * @returns {Object} { loading, error, data: { pedidos, dataSource, clientData? }, buscar }
 */
export const usePedidos = (initialDni, initialUserId) => {
  const claveInicial = claveCache(initialDni, initialUserId);

  const dniCache =
    initialDni != null &&
    String(initialDni).trim() &&
    cachePedidos.clave === claveInicial &&
    !!cachePedidos.data;

  const [loading, setLoading] = useState(!dniCache);
  const [error, setError] = useState(null);
  const [data, setData] = useState(() => (dniCache ? cachePedidos.data : null));

  useEffect(() => {
    if (dniCache && cachePedidos.data) {
      setData(cachePedidos.data);
      setLoading(false);
      setError(null);
    }
  }, [dniCache]);

  const buscar = async (dni, userId) => {
    const dniStr = dni != null ? String(dni).trim() : '';
    const clave = claveCache(dniStr, userId);

    if (dniStr && cachePedidos.clave === clave && cachePedidos.data) {
      if (data !== cachePedidos.data) setData(cachePedidos.data);
      if (error !== null) setError(null);
      if (loading) setLoading(false);
      return;
    }

    setLoading(true);

    // No limpiamos data inmediatamente si ya había datos, para evitar flash visual.
    if (!cachePedidos.data) setData(null);

    setError(null);

    try {
      if (isErpFirestoreAvailable() && dniStr) {
        // searchOrdersByDniInERP ya busca en:
        // - pedidos
        // - pedidos_web
        // - wala_pedidos si corresponde
        //
        // Además busca por clienteNumeroDocumento y por dni.
        const { data: erpPedidos, error: erpError } = await searchOrdersByDniInERP(dniStr, { userId });

        if (erpError && erpPedidos === null) {
          setError(erpError);
          setLoading(false);
          return;
        }

        // IMPORTANTE:
        // Ya NO filtramos con .filter(esPedidoWala).
        //
        // Motivo:
        // Los pedidos creados directamente en el ERP pueden venir con:
        // canalVenta: "Otro"
        // activador: "Otro"
        // vendedor: "YORYO"
        //
        // Esos pedidos sí pertenecen al cliente porque coinciden por DNI,
        // pero antes se ocultaban por no ser "Portal Web".
        const list = Array.isArray(erpPedidos) ? erpPedidos : [];

        const pedidos = list
          .map((raw) => {
            const norm = normalizarPedidoParaVista(raw);

            // Adjuntamos el doc CRUDO (_raw) con productos/dirección/pago/numeroPedido,
            // que la normalización descarta, para que "Mis Pedidos" y el detalle los usen.
            //
            // También marcamos si proviene de WALA como dato aditivo,
            // pero NO lo usamos para ocultar pedidos ERP.
            return norm
              ? {
                ...norm,
                _raw: raw,
                _esPedidoWala: esPedidoWala(raw),
              }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

        const clientData = extraerDatosClienteDesdePedidos(list);
        const result = { pedidos, dataSource: 'erp', clientData };

        cachePedidos.clave = clave;
        cachePedidos.data = result;

        setData(result);
        setLoading(false);

        // Opcional: crear cuentas faltantes para pedidos con email.
        // Máximo N por carga, en segundo plano.
        const seen = new Set();
        let count = 0;

        for (const raw of list) {
          if (count >= MAX_ACCOUNT_SYNC_PER_LOAD) break;

          const { email } = extraerDatosClienteDesdePedido(raw);

          if (email && !seen.has(email.toLowerCase())) {
            seen.add(email.toLowerCase());
            count += 1;

            ensureAccountFromOrderData(raw, { linkOrderId: true }).catch(() => { });
          }
        }

        return;
      }

      if (dniStr) {
        const resultado = await buscarPedidoCliente('', dniStr);

        // Igual que en la rama ERP:
        // no filtramos solo WALA, porque esta vista debe mostrar pedidos del cliente
        // asociados a su documento.
        const pedidosList = (resultado.pedidos || [])
          .map((raw) => {
            const norm = normalizarPedidoParaVista(raw);

            return norm
              ? {
                ...norm,
                _raw: raw,
                _esPedidoWala: esPedidoWala(raw),
              }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

        const result = { pedidos: pedidosList, dataSource: 'api' };

        cachePedidos.clave = clave;
        cachePedidos.data = result;

        setData(result);
      } else {
        setData({ pedidos: [], dataSource: 'api' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    data,
    buscar,
  };
};