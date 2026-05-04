import { setDocument } from './firebase/firestore';
import { getPedidosForAccountSync } from './erp/firebase';
import { getUsersBaseList } from './adminAnalytics';
import { ANALYTICS_COLLECTIONS, toMillis } from './analytics/schema';

const DEFAULT_MAX_PEDIDOS = 3000;
const PAGE_SIZE = 200;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeDni(value) {
  if (value == null) return '';
  return String(value).trim().replace(/\s/g, '');
}

function getOrderEmail(order) {
  return normalizeEmail(
    order.email ||
    order.clienteCorreo ||
    order.correo ||
    order.correoElectronico
  );
}

function getOrderDni(order) {
  return normalizeDni(
    order.clienteNumeroDocumento ||
    order.dni ||
    order.documento
  );
}

function getOrderTotal(order) {
  const raw = order.montoTotal ?? order.total ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function getOrderTimestamp(order) {
  return toMillis(order.createdAt || order.updatedAt || order.fechaCompra);
}

async function loadPedidosForBackfill(maxPedidos = DEFAULT_MAX_PEDIDOS) {
  const all = [];
  let lastDoc = null;
  while (all.length < maxPedidos) {
    const { data, lastDoc: nextDoc, error } = await getPedidosForAccountSync(PAGE_SIZE, lastDoc);
    if (error) return { data: all, error };
    if (!data || data.length === 0) break;
    all.push(...data);
    lastDoc = nextDoc;
    if (!nextDoc) break;
    if (data.length < PAGE_SIZE) break;
  }
  return { data: all.slice(0, maxPedidos), error: null };
}

function aggregateOrdersByUserMatch(users, pedidos) {
  const pedidosByEmail = new Map();
  const pedidosByDni = new Map();
  pedidos.forEach((order) => {
    const email = getOrderEmail(order);
    const dni = getOrderDni(order);
    if (email) {
      const arr = pedidosByEmail.get(email) || [];
      arr.push(order);
      pedidosByEmail.set(email, arr);
    }
    if (dni) {
      const arr = pedidosByDni.get(dni) || [];
      arr.push(order);
      pedidosByDni.set(dni, arr);
    }
  });

  return users.map((u) => {
    const userEmail = normalizeEmail(u.email);
    const userDni = normalizeDni(u.dni);
    const fromEmail = userEmail ? (pedidosByEmail.get(userEmail) || []) : [];
    const fromDni = userDni ? (pedidosByDni.get(userDni) || []) : [];
    const mergedMap = new Map();
    [...fromEmail, ...fromDni].forEach((o) => {
      if (!o?.id) return;
      mergedMap.set(o.id, o);
    });
    const merged = [...mergedMap.values()];
    const orderCount = merged.length;
    const totalSpent = merged.reduce((acc, o) => acc + getOrderTotal(o), 0);
    const sortedTs = merged.map(getOrderTimestamp).filter(Boolean).sort((a, b) => a - b);
    const firstOrderAtMs = sortedTs[0] || null;
    const lastOrderAtMs = sortedTs[sortedTs.length - 1] || null;
    return {
      uid: u.uid,
      email: userEmail || null,
      dni: userDni || null,
      orderCount,
      totalSpent,
      firstOrderAtMs,
      lastOrderAtMs,
      estimatedVisits: orderCount,
      estimatedFrom: 'users+erp_pedidos',
      isEstimated: true,
      sourceOrderIds: merged.slice(0, 50).map((o) => o.id),
    };
  });
}

export async function rebuildHistoricalAnalyticsSummary(options = {}) {
  const maxPedidos = Number(options.maxPedidos) > 0 ? Number(options.maxPedidos) : DEFAULT_MAX_PEDIDOS;
  const { data: users, error: usersError } = await getUsersBaseList();
  if (usersError) return { error: usersError };
  const { data: pedidos, error: pedidosError } = await loadPedidosForBackfill(maxPedidos);
  if (pedidosError) return { error: pedidosError };

  const perUserSummary = aggregateOrdersByUserMatch(users, pedidos);
  let updatedUsers = 0;
  for (const summary of perUserSummary) {
    if (!summary.uid) continue;
    const { error } = await setDocument(ANALYTICS_COLLECTIONS.USER_SUMMARY, summary.uid, summary);
    if (!error) updatedUsers += 1;
  }

  const usersWithOrders = perUserSummary.filter((u) => u.orderCount > 0).length;
  const totalOrderCount = perUserSummary.reduce((acc, u) => acc + u.orderCount, 0);
  const totalEstimatedRevenue = perUserSummary.reduce((acc, u) => acc + u.totalSpent, 0);

  const globalSummary = {
    usersTotal: users.length,
    usersWithOrders,
    usersWithoutOrders: Math.max(users.length - usersWithOrders, 0),
    totalOrderCount,
    totalEstimatedRevenue,
    computedFromPedidosCount: pedidos.length,
    maxPedidosConsidered: maxPedidos,
    isEstimated: true,
    source: 'historical_backfill',
    rebuiltAtMs: Date.now(),
  };
  const { error: globalError } = await setDocument(
    ANALYTICS_COLLECTIONS.GLOBAL_SUMMARY,
    'latest',
    globalSummary
  );

  return {
    error: globalError || null,
    data: {
      usersProcessed: users.length,
      usersUpdated: updatedUsers,
      pedidosProcessed: pedidos.length,
      summary: globalSummary,
    },
  };
}
