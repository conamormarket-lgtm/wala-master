// ─────────────────────────────────────────────────────────────────────────────
// adminUserInsights.js — Servicio de datos SOLO-ADMIN sobre perfiles de clientes
// (colección portal_clientes_users), sus carritos sincronizados y sus wishlists.
//
// FORMAS REALES verificadas en el código fuente (no adivinadas):
//   • Perfil (portal_clientes_users/{uid}):
//       - displayName / nombre, email, dni (+ clienteNumeroDocumento),
//         tipoDocumento, phone, country     → RegisterPage.jsx:123-144
//       - birthDate 'YYYY-MM-DD' (cumpleaños PROPIO; el nombre real del campo
//         es birthDate, no "birthday")      → CompleteProfilePage.jsx:125-127,
//                                             SubscriptionSurveyPage.jsx:361-363
//       - hasCompletedSurvey: boolean       → SubscriptionSurveyPage.jsx:359
//       - monedas: number                   → AuthContext.jsx:128
//       - giftRecipients[]: {id, roleKey, roleDisplay, name, gender, photoUrl,
//         events[{id, type, date 'YYYY-MM-DD', customName?}]}
//                                           → SubscriptionSurveyPage.jsx:96-141,
//                                             CuentaFechasImportantesPage.jsx:120-121
//       - cart: {items[], cartUpdatedAt, abandonedLevel} | null (se sincroniza
//         desde CartContext en CADA cambio del carrito; es una FOTO del momento
//         que la CF de carrito abandonado consume) → CartContext.jsx:56-72
//         cart.items[i]: {productId, productName, productImage, price, quantity,
//         variant, selected (false = "no comprar esta vez"), addedAt,
//         customization?.finalPrice}        → CartContext.jsx:217-266
//       - updatedAt (serverTimestamp via setDocument); createdAt puede NO existir
//   • Wishlist (wishlists/{uid}, doc id = userId):
//       - {userId, userCode, createdAt, items[{productId, productName,
//         productImage, price, addedAt, isGifted, giftedBy}]} → wishlist.js:32-69
//
// REGLAS DE LECTURA BARATA:
//   - Todo se lee PAGINADO con getCollectionPaginated (cursor startAfter).
//   - Los agregados tienen tope maxDocs y devuelven truncated:true si la
//     colección tiene más documentos de los leídos (aviso honesto para la UI:
//     "analizando los primeros N").
//   - Los agregados de perfiles (carritos + datos personales) REUSAN la misma
//     página de perfiles vía un caché en memoria con TTL: si el consumidor pide
//     ambos agregados seguidos, la colección se lee UNA sola vez.
//   - El consumidor (React) debe además envolver estas llamadas en react-query
//     con staleTime >= 5 minutos; este módulo NO debe invocarse en cada render.
//
// LIMITACIÓN DE BÚSQUEDA (documentada a propósito): portal_clientes_users NO
// tiene campos nameLower/emailLower indexados (solo products los tiene, ver
// products.js:1099). Por eso listUsers filtra CLIENT-SIDE sobre la página ya
// cargada: la búsqueda solo encuentra usuarios dentro de la página actual.
// ─────────────────────────────────────────────────────────────────────────────

import { getDocument, getCollectionPaginated } from './firebase/firestore';
import { toMillis } from './analytics/schema';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';

// Nombre de la colección de wishlists. Duplicado a propósito: wishlist.js define
// WISHLIST_COLLECTION como const de módulo NO exportada (wishlist.js:4).
const WISHLIST_COLLECTION = 'wishlists';

// Tamaño de página interno para los bucles de agregado (no confundir con el
// pageSize de listUsers, que controla el consumidor).
const AGGREGATE_PAGE_SIZE = 200;

// Caché en memoria de la página de perfiles usada por los agregados (4) y (5).
// TTL alineado con el staleTime mínimo exigido a react-query (5 minutos).
const PROFILES_CACHE_TTL_MS = 5 * 60 * 1000;
let profilesCache = { expiresAt: 0, maxDocs: 0, profiles: [], truncated: false };

// Promesa EN VUELO de la lectura de perfiles: en el arranque en frío,
// getCartsAggregate y getDatosPersonalesAggregate se montan en paralelo y el
// caché de resultado aún está vacío; sin este dedupe cada uno lanzaría su
// PROPIA pasada de ~800 perfiles (doble lectura). Con él, la segunda llamada
// espera la promesa activa en lugar de releer. Forma: { maxDocs, promise } | null.
let profilesPromise = null;

// ── Helpers de saneado (formas tolerantes: TODO campo puede faltar) ──────────

const asArray = (v) => (Array.isArray(v) ? v : []);
const asNumber = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const asText = (v) => (typeof v === 'string' ? v.trim() : '');

// Nombre visible del perfil: mismo fallback que getUsersBaseList (adminAnalytics.js:544).
const nombreDe = (u) => asText(u?.displayName) || asText(u?.nombre) || 'Sin nombre';

// Documento del perfil: dni con fallback ERP (adminAnalytics.js:545).
const dniDe = (u) => asText(u?.dni) || asText(u?.clienteNumeroDocumento) || null;

// Cumpleaños PROPIO del titular: el campo real es birthDate ('YYYY-MM-DD');
// se tolera un hipotético 'birthday' legacy por si existieran docs antiguos.
const birthdayDe = (u) => asText(u?.birthDate) || asText(u?.birthday) || null;

// Items del carrito sincronizado al perfil (cart puede ser null si está vacío).
const cartItemsDe = (u) => asArray(u?.cart?.items);

// Precio efectivo de un item del carrito: misma regla que CartContext.getTotalPrice
// (CartContext.jsx:399: customization?.finalPrice || price).
const precioEfectivo = (item) => asNumber(item?.customization?.finalPrice) || asNumber(item?.price);

// Un item cuenta para compra salvo que esté explícitamente deseleccionado
// (selected === false = "no comprar esta vez", CartContext.jsx:243).
const estaSeleccionado = (item) => item?.selected !== false;

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// 'YYYY-MM-DD' (o '--MM-DD') → texto legible en español ("15 de marzo" /
// "15 de marzo de 1990"). Devuelve null si no se puede interpretar.
function fechaLegible(dateStr) {
  const m = /^(\d{4})?-?-?(\d{2})-(\d{2})$/.exec(asText(dateStr));
  if (!m) return null;
  const anio = m[1] ? Number(m[1]) : null;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (!(mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)) return null;
  const base = `${dia} de ${MESES_ES[mes - 1]}`;
  return anio ? `${base} de ${anio}` : base;
}

// Próxima ocurrencia (este año o el siguiente) del mes-día de una fecha
// 'YYYY-MM-DD'. Devuelve { fecha: 'YYYY-MM-DD', enDias } o null si no parsea.
// Se calcula con fechas locales (sin UTC) para no correr el día por zona horaria.
function proximaOcurrencia(dateStr, hoy = new Date()) {
  const m = /(\d{2})-(\d{2})$/.exec(asText(dateStr));
  if (!m) return null;
  const mes = Number(m[1]);
  const dia = Number(m[2]);
  if (!(mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)) return null;
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let next = new Date(hoy.getFullYear(), mes - 1, dia);
  if (next.getTime() < hoy0.getTime()) {
    next = new Date(hoy.getFullYear() + 1, mes - 1, dia);
  }
  const enDias = Math.round((next.getTime() - hoy0.getTime()) / 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return { fecha: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`, enDias };
}

// Sanea un destinatario de regalos del perfil (giftRecipients[i]).
function sanearRecipient(r) {
  return {
    id: r?.id || null,
    roleKey: r?.roleKey || 'otros',
    roleDisplay: asText(r?.roleDisplay) || 'Otra persona',
    name: asText(r?.name) || 'Sin nombre',
    gender: asText(r?.gender) || null,
    photoUrl: asText(r?.photoUrl) || null,
    events: asArray(r?.events).map((ev) => ({
      id: ev?.id || null,
      type: asText(ev?.type) || 'Fecha',
      customName: asText(ev?.customName) || null,
      // Etiqueta lista para UI: 'Fecha Especial' usa su nombre personalizado
      // (mismo criterio que CuentaFechasImportantesPage.jsx:319).
      label: (ev?.type === 'Fecha Especial' && asText(ev?.customName))
        ? asText(ev.customName)
        : (asText(ev?.type) || 'Fecha'),
      date: asText(ev?.date) || null,          // 'YYYY-MM-DD' crudo
      dateLegible: fechaLegible(ev?.date),      // "15 de marzo" | null
    })),
  };
}

// Resumen de carrito de un perfil (para filas de listado y agregados).
function resumenCartDe(u) {
  const items = cartItemsDe(u);
  let cartCount = 0;      // líneas con selected !== false
  let cartUnits = 0;      // unidades (sum quantity) de esas líneas
  let cartTotal = 0;      // suma price*quantity — SOLO display, NO dinero contable
  items.forEach((item) => {
    if (!estaSeleccionado(item)) return;
    const qty = asNumber(item?.quantity) || 1;
    cartCount += 1;
    cartUnits += qty;
    cartTotal += precioEfectivo(item) * qty;
  });
  return { cartCount, cartUnits, cartTotal: Math.round(cartTotal * 100) / 100 };
}

// Proyección ligera de un doc de perfil → fila de listado.
function perfilARow(u) {
  const { cartCount, cartUnits, cartTotal } = resumenCartDe(u);
  return {
    uid: u.id,
    nombre: nombreDe(u),
    email: asText(u?.email).toLowerCase() || null,
    dni: dniDe(u),
    birthday: birthdayDe(u),
    hasCompletedSurvey: u?.hasCompletedSurvey === true,
    giftRecipientsCount: asArray(u?.giftRecipients).length,
    cartCount,
    cartUnits,
    cartTotal,
    // createdAt no existe en muchos perfiles (setDocument solo escribe updatedAt);
    // se devuelve en ms o null.
    createdAtMs: u?.createdAt ? toMillis(u.createdAt) : null,
    updatedAtMs: u?.updatedAt ? toMillis(u.updatedAt) : null,
  };
}

// ── Lectura paginada genérica hasta maxDocs (con flag truncated) ─────────────
// Sin orderBy: Firestore ordena por __name__ (id de documento) por defecto y
// startAfter(lastDoc) funciona igual; así NO se excluyen documentos a los que
// les falte algún campo (orderBy por campo omite docs sin ese campo) y no se
// requiere ningún índice.
async function leerColeccionHasta(collectionName, maxDocs) {
  const docs = [];
  let cursor = null;
  let truncated = false;
  let lastError = null;

  while (docs.length < maxDocs) {
    const pageSize = Math.min(AGGREGATE_PAGE_SIZE, maxDocs - docs.length);
    // eslint-disable-next-line no-await-in-loop
    const { data, lastDoc, hasMore, error } = await getCollectionPaginated(
      collectionName,
      [],
      null,
      pageSize,
      cursor
    );
    if (error) { lastError = error; break; }
    docs.push(...(data || []));
    if (!hasMore || !lastDoc) break; // no hay más páginas
    cursor = lastDoc;
    if (docs.length >= maxDocs) {
      // hasMore era true al llenar el tope → hay más docs que no leímos.
      truncated = true;
    }
  }
  return { docs, truncated, error: lastError };
}

// Página de perfiles compartida por getCartsAggregate y getDatosPersonalesAggregate:
// una sola lectura de portal_clientes_users sirve a ambos agregados (caché TTL).
async function cargarPerfilesParaAgregados(maxDocs) {
  const ahora = Date.now();
  if (profilesCache.expiresAt > ahora && profilesCache.maxDocs >= maxDocs) {
    return {
      docs: profilesCache.profiles.slice(0, maxDocs),
      // Si servimos un subconjunto del caché, para este maxDocs sí está truncado.
      truncated: profilesCache.truncated || profilesCache.profiles.length > maxDocs,
      error: null,
    };
  }

  // Dedupe de promesa en vuelo: si ya hay una lectura activa que cubre este
  // maxDocs, la esperamos y servimos el subconjunto (misma regla que el caché).
  if (profilesPromise && profilesPromise.maxDocs >= maxDocs) {
    const res = await profilesPromise.promise;
    return {
      docs: res.docs.slice(0, maxDocs),
      truncated: res.truncated || res.docs.length > maxDocs,
      error: res.error,
    };
  }

  const promesa = (async () => {
    const { docs, truncated, error } = await leerColeccionHasta(PORTAL_USERS_COLLECTION, maxDocs);
    if (!error) {
      profilesCache = { expiresAt: ahora + PROFILES_CACHE_TTL_MS, maxDocs, profiles: docs, truncated };
    }
    return { docs, truncated, error };
  })();
  profilesPromise = { maxDocs, promise: promesa };
  try {
    return await promesa;
  } finally {
    // Limpiar SOLO si nadie la reemplazó mientras tanto (otra llamada con un
    // maxDocs mayor pudo haber registrado su propia promesa).
    if (profilesPromise && profilesPromise.promise === promesa) {
      profilesPromise = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// (1) listUsers — página de perfiles para el listado admin
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Lista paginada de perfiles de portal_clientes_users, ordenada por updatedAt
 * desc (misma consulta de un solo campo que ya usa getUsersBaseList en
 * adminAnalytics.js:533-539; NO requiere índice compuesto).
 *
 * BÚSQUEDA: `search` filtra CLIENT-SIDE (nombre/email/dni, contiene, sin
 * mayúsculas) SOLO sobre la página cargada. La colección no tiene
 * nameLower/emailLower, así que no hay búsqueda por prefijo server-side; la UI
 * debe avisar "buscando dentro de la página actual".
 *
 * NOTA: perfiles sin campo updatedAt quedan fuera del orderBy (comportamiento
 * de Firestore); en la práctica todos los perfiles lo tienen (setDocument lo
 * escribe siempre, firestore.js:169-183).
 *
 * @param {{search?: string, pageSize?: number, cursor?: object|null}} opts
 *        cursor = valor OPACO devuelto por la llamada anterior (lastDoc de Firestore).
 * @returns {Promise<{data: {users: Array, cursor: object|null, hasMore: boolean,
 *          searchLimitedToPage: boolean}, error: string|null}>}
 */
export async function listUsers({ search = '', pageSize = 25, cursor = null } = {}) {
  try {
    const { data, lastDoc, hasMore, error } = await getCollectionPaginated(
      PORTAL_USERS_COLLECTION,
      [],
      { field: 'updatedAt', direction: 'desc' },
      pageSize,
      cursor
    );
    if (error) {
      return { data: { users: [], cursor: null, hasMore: false, searchLimitedToPage: false }, error };
    }

    let users = (data || []).map(perfilARow);

    const q = asText(search).toLowerCase();
    if (q) {
      users = users.filter((u) =>
        (u.nombre || '').toLowerCase().includes(q) ||
        (u.email || '').includes(q) ||
        (u.dni || '').includes(q)
      );
    }

    return {
      data: {
        users,
        cursor: lastDoc || null, // pasar tal cual en la siguiente llamada
        hasMore: !!hasMore,
        // Aviso honesto para la UI: la búsqueda solo cubre esta página.
        searchLimitedToPage: !!q,
      },
      error: null,
    };
  } catch (e) {
    return {
      data: { users: [], cursor: null, hasMore: false, searchLimitedToPage: false },
      error: e?.message || 'Error listando usuarios',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// (2) getUserFicha — ficha completa de UN usuario (perfil + carrito + wishlist)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Ficha completa saneada de un usuario: 2 lecturas puntuales
 * (portal_clientes_users/{uid} y wishlists/{uid}; el doc de wishlist usa el
 * uid como id, ver wishlist.js:19-30). Si la wishlist no existe NO es error.
 *
 * @param {string} uid
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getUserFicha(uid) {
  try {
    if (!uid) return { data: null, error: 'uid requerido' };

    const [perfilRes, wishlistRes] = await Promise.all([
      getDocument(PORTAL_USERS_COLLECTION, uid),
      getDocument(WISHLIST_COLLECTION, uid),
    ]);

    if (!perfilRes.data) {
      return { data: null, error: perfilRes.error || 'Perfil no encontrado' };
    }
    const u = perfilRes.data;

    // Carrito sincronizado (FOTO del momento: CartContext lo reescribe cada vez
    // que el usuario toca su carrito; null cuando está vacío, CartContext.jsx:62-66).
    const cartItems = cartItemsDe(u).map((item) => {
      const qty = asNumber(item?.quantity) || 1;
      return {
        productId: item?.productId || null,
        productName: asText(item?.productName) || 'Producto sin nombre',
        productImage: asText(item?.productImage) || null,
        price: precioEfectivo(item),
        quantity: qty,
        selected: estaSeleccionado(item),
        variant: item?.variant || null,
        addedAt: item?.addedAt || null,
        subtotal: Math.round(precioEfectivo(item) * qty * 100) / 100,
      };
    });
    const { cartCount, cartUnits, cartTotal } = resumenCartDe(u);

    // Wishlist (wishlists/{uid}); "no encontrada" = lista vacía, no error.
    const wl = wishlistRes.data;
    const wishlistItems = asArray(wl?.items).map((item) => ({
      productId: item?.productId || null,
      productName: asText(item?.productName) || 'Producto sin nombre',
      productImage: asText(item?.productImage) || null,
      // Items antiguos pueden no tener price (wishlist.js:64-65).
      price: asNumber(item?.price),
      addedAt: item?.addedAt || null,
      isGifted: item?.isGifted === true,
      giftedBy: asText(item?.giftedBy) || null,
    }));

    const birthday = birthdayDe(u);

    return {
      data: {
        uid,
        nombre: nombreDe(u),
        email: asText(u?.email).toLowerCase() || null,
        dni: dniDe(u),
        tipoDocumento: asText(u?.tipoDocumento) || null,
        phone: asText(u?.phone) || null,
        country: asText(u?.country) || null,
        birthday,                                  // 'YYYY-MM-DD' | null
        birthdayLegible: fechaLegible(birthday),   // "15 de marzo de 1990" | null
        hasCompletedSurvey: u?.hasCompletedSurvey === true,
        monedas: asNumber(u?.monedas),
        createdAtMs: u?.createdAt ? toMillis(u.createdAt) : null,
        updatedAtMs: u?.updatedAt ? toMillis(u.updatedAt) : null,
        giftRecipients: asArray(u?.giftRecipients).map(sanearRecipient),
        cart: {
          items: cartItems,
          count: cartCount,          // líneas seleccionadas (selected !== false)
          unidades: cartUnits,
          totalEstimado: cartTotal,  // SOLO display, no es dinero contable
          cartUpdatedAt: u?.cart?.cartUpdatedAt || null,
        },
        wishlist: {
          items: wishlistItems,
          count: wishlistItems.length,
          giftedCount: wishlistItems.filter((i) => i.isGifted).length,
          userCode: asText(wl?.userCode) || null,
        },
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e?.message || 'Error cargando la ficha del usuario' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// (3) getWishlistAggregate — productos más deseados (colección wishlists)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Agrega la colección wishlists (paginada hasta maxDocs). Por producto:
 *   - count: en CUÁNTAS listas distintas aparece (dedupe por lista).
 *   - giftedCount: nº de items marcados isGifted (sin dedupe: cada regalo cuenta).
 * productName/productImage salen del snapshot guardado en el item (no se leen
 * productos; el consumidor puede refrescar miniaturas con getProducts tolerando
 * tombstones deleted:true).
 *
 * @param {{maxDocs?: number}} opts
 * @returns {Promise<{data: {top: Array, totales: {usuariosConLista: number,
 *          itemsTotales: number}, truncated: boolean, docsLeidos: number}, error: string|null}>}
 */
export async function getWishlistAggregate({ maxDocs = 500 } = {}) {
  try {
    const { docs, truncated, error } = await leerColeccionHasta(WISHLIST_COLLECTION, maxDocs);

    const porProducto = new Map(); // productId -> acumulador
    let usuariosConLista = 0;
    let itemsTotales = 0;

    docs.forEach((wl) => {
      const items = asArray(wl?.items);
      if (items.length === 0) return;
      usuariosConLista += 1;
      itemsTotales += items.length;

      const vistosEnEstaLista = new Set(); // dedupe de productId dentro de la lista
      items.forEach((item) => {
        const pid = item?.productId;
        if (!pid) return;
        if (!porProducto.has(pid)) {
          porProducto.set(pid, {
            productId: pid,
            productName: asText(item?.productName) || 'Producto sin nombre',
            productImage: asText(item?.productImage) || null,
            count: 0,
            giftedCount: 0,
          });
        }
        const acc = porProducto.get(pid);
        if (!vistosEnEstaLista.has(pid)) {
          vistosEnEstaLista.add(pid);
          acc.count += 1;
        }
        if (item?.isGifted === true) acc.giftedCount += 1;
        // Completar snapshot si el primer item venía sin imagen/nombre.
        if (!acc.productImage && asText(item?.productImage)) acc.productImage = asText(item.productImage);
      });
    });

    const top = [...porProducto.values()]
      .sort((a, b) => b.count - a.count || b.giftedCount - a.giftedCount)
      .slice(0, 50);

    return {
      data: {
        top,
        totales: { usuariosConLista, itemsTotales },
        truncated,      // true → la UI debe avisar "analizando las primeras N listas"
        docsLeidos: docs.length,
      },
      error: error || null,
    };
  } catch (e) {
    return {
      data: { top: [], totales: { usuariosConLista: 0, itemsTotales: 0 }, truncated: false, docsLeidos: 0 },
      error: e?.message || 'Error agregando wishlists',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// (4) getCartsAggregate — qué hay en los carritos AHORA (foto del momento)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Agrega los cart.items de los perfiles (hasta maxDocs perfiles, paginado).
 * IMPORTANTE: es una FOTO del momento — el cart del perfil se reescribe cada
 * vez que el usuario navega/edita su carrito (CartContext.jsx:56-72) y se pone
 * en null al vaciarlo o pagar. Incluye TODOS los items (también los
 * deseleccionados "no comprar esta vez"), porque siguen en el carrito real.
 *
 * Comparte lectura (caché 5 min) con getDatosPersonalesAggregate: pedir ambos
 * seguidos cuesta UNA sola pasada por portal_clientes_users.
 *
 * @param {{maxDocs?: number}} opts
 * @returns {Promise<{data: {top: Array<{productId, productName, productImage,
 *          enCarritos, unidades, valorEstimado}>, totales: {usuariosConCarrito: number,
 *          itemsTotales: number, valorTotalEstimado: number}, truncated: boolean,
 *          docsLeidos: number}, error: string|null}>}
 */
export async function getCartsAggregate({ maxDocs = 800 } = {}) {
  try {
    const { docs, truncated, error } = await cargarPerfilesParaAgregados(maxDocs);

    const porProducto = new Map(); // productId -> acumulador
    let usuariosConCarrito = 0;
    let itemsTotales = 0;
    let valorTotalEstimado = 0;

    docs.forEach((u) => {
      const items = cartItemsDe(u);
      if (items.length === 0) return;
      usuariosConCarrito += 1;

      const vistosEnEsteCarrito = new Set(); // dedupe por usuario para enCarritos
      items.forEach((item) => {
        const pid = item?.productId;
        if (!pid) return;
        const qty = asNumber(item?.quantity) || 1;
        const valor = precioEfectivo(item) * qty;
        itemsTotales += 1;
        valorTotalEstimado += valor;

        if (!porProducto.has(pid)) {
          porProducto.set(pid, {
            productId: pid,
            productName: asText(item?.productName) || 'Producto sin nombre',
            productImage: asText(item?.productImage) || null,
            enCarritos: 0,   // nº de usuarios distintos con el producto en su carrito
            unidades: 0,
            valorEstimado: 0, // SOLO display, no es dinero contable
          });
        }
        const acc = porProducto.get(pid);
        if (!vistosEnEsteCarrito.has(pid)) {
          vistosEnEsteCarrito.add(pid);
          acc.enCarritos += 1;
        }
        acc.unidades += qty;
        acc.valorEstimado = Math.round((acc.valorEstimado + valor) * 100) / 100;
        if (!acc.productImage && asText(item?.productImage)) acc.productImage = asText(item.productImage);
      });
    });

    const top = [...porProducto.values()]
      .sort((a, b) => b.enCarritos - a.enCarritos || b.unidades - a.unidades)
      .slice(0, 50);

    return {
      data: {
        top,
        totales: {
          usuariosConCarrito,
          itemsTotales,
          valorTotalEstimado: Math.round(valorTotalEstimado * 100) / 100,
        },
        truncated,      // true → avisar "analizando los primeros N perfiles"
        docsLeidos: docs.length,
      },
      error: error || null,
    };
  } catch (e) {
    return {
      data: {
        top: [],
        totales: { usuariosConCarrito: 0, itemsTotales: 0, valorTotalEstimado: 0 },
        truncated: false,
        docsLeidos: 0,
      },
      error: e?.message || 'Error agregando carritos',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// (5) getDatosPersonalesAggregate — el oro para campañas (cumpleaños/encuesta)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Sobre los MISMOS perfiles del agregado de carritos (misma lectura cacheada):
 *   - conCumpleanos: perfiles con birthDate propio.
 *   - conEncuesta: perfiles con hasCompletedSurvey === true.
 *   - conPersonasAgendadas / totalPersonasAgendadas: giftRecipients.
 *   - proximosCumpleanos: próximos 30 días — incluye el cumpleaños PROPIO del
 *     titular (birthDate) y los events tipo 'Cumpleaños' de sus giftRecipients
 *     (tipo verificado en CuentaFechasImportantesPage.jsx:121). Ordenado por
 *     días restantes.
 *
 * @param {{maxDocs?: number}} opts
 * @returns {Promise<{data: {conCumpleanos: number, conEncuesta: number,
 *          conPersonasAgendadas: number, totalPersonasAgendadas: number,
 *          proximosCumpleanos: Array<{uid, nombre, email, fecha, fechaLegible,
 *          enDias, esTitular, dePersona}>, totalPerfiles: number,
 *          truncated: boolean, docsLeidos: number}, error: string|null}>}
 */
export async function getDatosPersonalesAggregate({ maxDocs = 800 } = {}) {
  try {
    const { docs, truncated, error } = await cargarPerfilesParaAgregados(maxDocs);

    let conCumpleanos = 0;
    let conEncuesta = 0;
    let conPersonasAgendadas = 0;
    let totalPersonasAgendadas = 0;
    const proximosCumpleanos = [];
    const hoy = new Date();
    const VENTANA_DIAS = 30;

    docs.forEach((u) => {
      const nombre = nombreDe(u);
      const email = asText(u?.email).toLowerCase() || null;

      // Cumpleaños propio del titular.
      const birthday = birthdayDe(u);
      if (birthday) {
        conCumpleanos += 1;
        const prox = proximaOcurrencia(birthday, hoy);
        if (prox && prox.enDias <= VENTANA_DIAS) {
          proximosCumpleanos.push({
            uid: u.id,
            nombre,
            email,
            fecha: prox.fecha,
            fechaLegible: fechaLegible(prox.fecha),
            enDias: prox.enDias,
            esTitular: true,
            dePersona: 'Titular de la cuenta',
          });
        }
      }

      if (u?.hasCompletedSurvey === true) conEncuesta += 1;

      // Personas agendadas (destinatarios de regalos) y sus cumpleaños.
      const recipients = asArray(u?.giftRecipients);
      if (recipients.length > 0) {
        conPersonasAgendadas += 1;
        totalPersonasAgendadas += recipients.length;
        recipients.forEach((r) => {
          asArray(r?.events).forEach((ev) => {
            // Solo eventos de cumpleaños (tolerante a mayúsculas/tildes parciales).
            const tipo = asText(ev?.type).toLowerCase();
            if (!tipo.includes('cumple')) return;
            const prox = proximaOcurrencia(ev?.date, hoy);
            if (!prox || prox.enDias > VENTANA_DIAS) return;
            proximosCumpleanos.push({
              uid: u.id,
              nombre, // titular de la cuenta (a quién dirigir la campaña)
              email,
              fecha: prox.fecha,
              fechaLegible: fechaLegible(prox.fecha),
              enDias: prox.enDias,
              esTitular: false,
              dePersona: `${asText(r?.name) || 'Sin nombre'} (${asText(r?.roleDisplay) || 'Otra persona'})`,
            });
          });
        });
      }
    });

    proximosCumpleanos.sort((a, b) => a.enDias - b.enDias);

    return {
      data: {
        conCumpleanos,
        conEncuesta,
        conPersonasAgendadas,
        totalPersonasAgendadas,
        proximosCumpleanos,
        totalPerfiles: docs.length,
        truncated,      // true → avisar "analizando los primeros N perfiles"
        docsLeidos: docs.length,
      },
      error: error || null,
    };
  } catch (e) {
    return {
      data: {
        conCumpleanos: 0,
        conEncuesta: 0,
        conPersonasAgendadas: 0,
        totalPersonasAgendadas: 0,
        proximosCumpleanos: [],
        totalPerfiles: 0,
        truncated: false,
        docsLeidos: 0,
      },
      error: e?.message || 'Error agregando datos personales',
    };
  }
}
