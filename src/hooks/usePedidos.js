import { useState, useEffect, useCallback } from 'react';
import { cargarMisPedidos } from '../services/misPedidos';
import { normalizarPedidoParaVista, extraerDatosClienteDesdePedidos } from '../utils/pedidos';

const getMillis = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();

  const d = new Date(v);
  return isNaN(d) ? 0 : d.getTime();
};

// Caché en memoria POR CUENTA: los pedidos dependen de quién está logueado (y
// de lo que tenga verificado), no del DNI que se pase. Con otra cuenta en el
// mismo navegador la clave cambia y se vuelve a pedir.
const cachePedidos = { clave: null, data: null };

/** Clave de caché: el uid de la sesión (vacío sin sesión). */
const claveCache = (userId) => (userId != null ? String(userId) : '');

/**
 * Determina si un pedido viene del portal WALA. Solo es un dato informativo
 * (_esPedidoWala): la lista muestra también los pedidos creados desde el ERP.
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
 * Pedidos de la cuenta logueada ("Mis Pedidos", rastreo, detalle).
 *
 * Los carga el servidor (services/misPedidos.js): solo vienen completos los
 * que la cuenta demuestra que son suyos. Los que solo coinciden por DNI llegan
 * en `data.pendientes` para que la persona los verifique o vincule.
 *
 * Antes este hook además creaba cuentas, desde el navegador, para cada correo
 * que encontraba en los pedidos (createUserWithEmailAndPassword). Eso podía
 * cambiar la sesión a una cuenta recién creada y alargaba cada carga; las
 * cuentas desde pedidos ya las crea el servidor (webhook ensureAccountFromOrder).
 *
 * La firma se mantiene por compatibilidad: el DNI ya no decide nada.
 *
 * @param {string} [_initialDni] - Ignorado (compatibilidad).
 * @param {string} [initialUserId] - UID de la sesión.
 * @returns {Object} { loading, error, data: { pedidos, pendientes, emailVerificado, dataSource, clientData }, buscar, recargar }
 */
export const usePedidos = (_initialDni, initialUserId) => {
  const claveInicial = claveCache(initialUserId);
  const enCache = !!claveInicial && cachePedidos.clave === claveInicial && !!cachePedidos.data;

  const [loading, setLoading] = useState(!enCache);
  const [error, setError] = useState(null);
  const [data, setData] = useState(() => (enCache ? cachePedidos.data : null));

  useEffect(() => {
    if (enCache && cachePedidos.data) {
      setData(cachePedidos.data);
      setLoading(false);
      setError(null);
    }
  }, [enCache]);

  const cargar = useCallback(async (userId, { forzar = false } = {}) => {
    const clave = claveCache(userId ?? initialUserId);

    if (!forzar && clave && cachePedidos.clave === clave && cachePedidos.data) {
      setData(cachePedidos.data);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { pedidos: crudos, pendientes, emailVerificado } = await cargarMisPedidos();

      const pedidos = crudos
        .map((raw) => {
          const norm = normalizarPedidoParaVista(raw);
          // _raw: doc CRUDO (productos/dirección/pago/numeroPedido) que la
          // normalización descarta y que usan la lista y el detalle.
          return norm ? { ...norm, _raw: raw, _esPedidoWala: esPedidoWala(raw) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

      const result = {
        pedidos,
        pendientes,
        emailVerificado,
        dataSource: 'erp',
        clientData: extraerDatosClienteDesdePedidos(crudos),
      };

      cachePedidos.clave = clave;
      cachePedidos.data = result;
      setData(result);
    } catch (err) {
      console.warn('[Mis Pedidos] carga:', err);
      setError('No se pudieron cargar tus pedidos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [initialUserId]);

  // buscar(dni, userId): firma antigua; el DNI se ignora.
  const buscar = useCallback((_dni, userId) => cargar(userId), [cargar]);
  // Tras verificar el correo o vincular un pedido: ignora la caché.
  const recargar = useCallback(() => cargar(undefined, { forzar: true }), [cargar]);

  return {
    loading,
    error,
    data,
    buscar,
    recargar,
  };
};
