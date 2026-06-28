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

const cachePedidos = { dni: null, data: null };

const MAX_ACCOUNT_SYNC_PER_LOAD = 25;

/**
 * El ERP es un NEGOCIO APARTE: sus colecciones ('pedidos'/'pedidos_web') guardan data MIXTA
 * (pedidos nativos del ERP + pedidos hechos desde WALA). El visor "Mis Compras" de WALA debe
 * mostrar SOLO los pedidos hechos desde el portal WALA.
 * Un pedido es de WALA porque el checkout del portal escribe canalVenta:'Portal Web'
 * (y además web:true, activador:'portal_web', vendedor:'Portal Web').
 * @param {Object} p - Pedido CRUDO tal como viene del ERP.
 * @returns {boolean} true si el pedido fue hecho desde WALA.
 */
const esPedidoWala = (p) =>
  !!p &&
  (p.canalVenta === 'Portal Web' ||
    p.web === true ||
    p.activador === 'portal_web' ||
    p.vendedor === 'Portal Web');

/**
 * Hook para búsqueda de pedidos por DNI. Usa caché por DNI: si ya se cargó ese DNI, muestra datos al instante.
 * @param {string} [initialDni] - Si se pasa y hay caché para ese DNI, data se inicializa con la caché (evita parpadeo al volver).
 * @returns {Object} { loading, error, data: { pedidos, dataSource, clientData? }, buscar }
 */
export const usePedidos = (initialDni) => {
  const dniCache = initialDni != null && String(initialDni).trim() && cachePedidos.dni === String(initialDni).trim();
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

  const buscar = async (dni) => {
    const dniStr = dni != null ? String(dni).trim() : '';

    if (dniStr && cachePedidos.dni === dniStr && cachePedidos.data) {
      if (data !== cachePedidos.data) setData(cachePedidos.data);
      if (error !== null) setError(null);
      if (loading) setLoading(false);
      return;
    }

    setLoading(true);
    // Don't nullify data immediately if we already had standard data to prevent "flash" of empty state
    if (!cachePedidos.data) setData(null);
    setError(null);

    try {
      if (isErpFirestoreAvailable() && dniStr) {
        const { data: erpPedidos, error: erpError } = await searchOrdersByDniInERP(dniStr);
        if (erpError && erpPedidos === null) {
          setError(erpError);
          setLoading(false);
          return;
        }
        // Filtramos sobre la lista CRUDA a solo pedidos del portal WALA ANTES de normalizar,
        // así tanto la lista como el _raw adjunto, clientData y la sincronización de cuentas
        // quedan exclusivamente con pedidos de WALA (el ERP es un negocio aparte, ver esPedidoWala).
        const list = (Array.isArray(erpPedidos) ? erpPedidos : []).filter(esPedidoWala);
        const pedidos = list
                            .map((raw) => {
                              const norm = normalizarPedidoParaVista(raw);
                              // Adjuntamos el doc CRUDO (_raw) con productos/dirección/pago/numeroPedido,
                              // que la normalización descarta, para que "Mis Compras" y el detalle los usen.
                              return norm ? { ...norm, _raw: raw } : null;
                            })
                            .filter(Boolean)
                            .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        const clientData = extraerDatosClienteDesdePedidos(list);
        const result = { pedidos, dataSource: 'erp', clientData };
        cachePedidos.dni = dniStr;
        cachePedidos.data = result;
        setData(result);
        setLoading(false);
        // Opcional: crear cuentas faltantes para pedidos con email (máx. N por carga, en segundo plano)
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
        // Igual que en la rama ERP: filtramos la lista CRUDA a solo pedidos del portal WALA
        // antes de normalizar, para que la lista y el _raw queden solo de WALA.
        const pedidosList = (resultado.pedidos || [])
                              .filter(esPedidoWala)
                              .map((raw) => {
                                const norm = normalizarPedidoParaVista(raw);
                                return norm ? { ...norm, _raw: raw } : null;
                              })
                              .filter(Boolean)
                              .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        const result = { pedidos: pedidosList, dataSource: 'api' };
        cachePedidos.dni = dniStr;
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
