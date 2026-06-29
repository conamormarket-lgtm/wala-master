import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Configuración de Firebase para el ERP (sistema de gestión)
 */
const erpFirebaseConfig = {
  apiKey: process.env.REACT_APP_ERP_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_ERP_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_ERP_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_ERP_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_ERP_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_ERP_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_ERP_FIREBASE_MEASUREMENT_ID || process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

let erpApp = null;
let erpDb = null;

const ERP_USE_EMULATORS = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false';

try {
  // Verificar si ya existe una instancia con el nombre 'erp-firebase'
  const existingApps = getApps();
  const existingErpApp = existingApps.find(app => app.name === 'erp-firebase');

  if (ERP_USE_EMULATORS) {
    // En dev, el ERP también apunta al emulador (mismo proyecto demo aislado 'demo-wala').
    erpApp = existingErpApp || initializeApp({ projectId: 'demo-wala', apiKey: 'demo-emulator' }, 'erp-firebase');
    erpDb = getFirestore(erpApp);
    if (!existingErpApp) connectFirestoreEmulator(erpDb, 'localhost', 8080);
  } else if (existingErpApp) {
    erpApp = existingErpApp;
    erpDb = getFirestore(erpApp);
  } else {
    // Inicializar Firebase del ERP con un nombre único para evitar conflictos
    if (erpFirebaseConfig.apiKey) {
      erpApp = initializeApp(erpFirebaseConfig, 'erp-firebase');
      erpDb = getFirestore(erpApp);
      console.log('ERP Firebase inicializado correctamente.', erpFirebaseConfig.projectId);
    } else {
      console.warn('ERP Firebase config no tiene apiKey. Las variables de entorno no cargaron.');
    }
  }
} catch (error) {
  console.error('Error al inicializar Firebase del ERP:', error);
  // Intentar obtener la instancia existente si falla la inicialización
  try {
    const apps = getApps();
    erpApp = apps.find(app => app.name === 'erp-firebase');
    if (erpApp) {
      erpDb = getFirestore(erpApp);
    }
  } catch (e) {
    console.error('No se pudo conectar al Firebase del ERP:', e);
  }
}

/**
 * Verifica si el Firestore del ERP está disponible
 */
export const isErpFirestoreAvailable = () => {
  return erpDb !== null;
};

/**
 * Crear un pedido en el Firestore del ERP
 * @param {Object} orderData - Datos del pedido
 * @returns {Promise<{ id: string | null, error: string | null }>}
 */
export async function createOrderInERP(orderData) {
  if (!isErpFirestoreAvailable()) {
    return { id: null, error: 'Firestore del ERP no está disponible' };
  }

  try {
    const orderPayload = {
      ...orderData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (!orderPayload.clienteNumeroDocumento && orderPayload.dni != null) {
      orderPayload.clienteNumeroDocumento = String(orderPayload.dni).trim().replace(/\s/g, '');
    }

    const docRef = await addDoc(collection(erpDb, 'pedidos'), orderPayload);
    return { id: docRef.id, error: null };
  } catch (error) {
    console.error('Error al crear pedido en ERP:', error);
    return { id: null, error: error.message };
  }
}

/**
 * Ordena pedidos por fecha de creación (más reciente primero).
 */
function sortPedidosByCreatedAt(pedidos) {
  return [...pedidos].sort((a, b) => {
    const tA = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
    const tB = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
    return tB - tA;
  });
}

/**
 * Buscar pedidos por número de documento (DNI/CE) en el Firestore del ERP.
 * Usa el campo clienteNumeroDocumento. No requiere índice compuesto: se hace
 * una sola condición where y el ordenamiento es en memoria.
 *
 * RED DE SEGURIDAD (lectura del espejo): además de los pedidos VIVOS del ERP
 * (pedidos + pedidos_web), se consulta la copia propia de WALA en `wala_pedidos`
 * (getWalaMirrorOrders). Si el ERP externo ya borró/absorbió el pedido al
 * aprobarlo, su espejo lo recupera para que NUNCA desaparezca de "Mis Compras".
 *
 * @param {string} dni - DNI o CE del cliente (se normaliza a string sin espacios)
 * @param {object} [opciones] - Opciones adicionales (no rompe llamadas existentes).
 * @param {string} [opciones.userId] - UID del comprador autenticado (= buyerUid del espejo).
 * @returns {Promise<{ data: Array | null, error: string | null }>}
 */
export async function searchOrdersByDniInERP(dni, { userId } = {}) {
  if (!isErpFirestoreAvailable()) {
    return { data: null, error: 'Firestore del ERP no está disponible' };
  }

  // Valor crudo del perfil (sin normalizar) para usarlo como fallback con
  // pedidos históricos que se guardaron antes de normalizar el documento.
  const dniRaw = dni != null ? String(dni) : '';
  const dniNorm = dniRaw.trim().replace(/\s/g, '');
  if (!dniNorm) {
    return { data: [], error: null };
  }

  try {
    const q = query(
      collection(erpDb, 'pedidos'),
      where('clienteNumeroDocumento', '==', dniNorm)
    );
    const querySnapshot = await getDocs(q);
    let pedidos = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (pedidos.length === 0) {
      const qDni = query(
        collection(erpDb, 'pedidos'),
        where('dni', '==', dniNorm)
      );
      const snapDni = await getDocs(qDni);
      pedidos = snapDni.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Fallback: si nada casó con el documento normalizado, reintenta con el
    // dni CRUDO del perfil (pedidos antiguos guardados sin normalizar).
    if (pedidos.length === 0 && dniRaw && dniRaw !== dniNorm) {
      const qRaw = query(
        collection(erpDb, 'pedidos'),
        where('clienteNumeroDocumento', '==', dniRaw)
      );
      const snapRaw = await getDocs(qRaw);
      pedidos = snapRaw.docs.map(d => ({ id: d.id, ...d.data() }));
      if (pedidos.length === 0) {
        const qRawDni = query(
          collection(erpDb, 'pedidos'),
          where('dni', '==', dniRaw)
        );
        const snapRawDni = await getDocs(qRawDni);
        pedidos = snapRawDni.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    }

    // Buscar también en pedidos_web (pedidos recientes aún no validados por admin)
    const qWeb = query(
      collection(erpDb, 'pedidos_web'),
      where('clienteNumeroDocumento', '==', dniNorm)
    );
    const querySnapshotWeb = await getDocs(qWeb);
    let pedidosWeb = querySnapshotWeb.docs.map(d => ({ id: d.id, ...d.data() }));

    if (pedidosWeb.length === 0) {
      const qWebDni = query(
        collection(erpDb, 'pedidos_web'),
        where('dni', '==', dniNorm)
      );
      const snapWebDni = await getDocs(qWebDni);
      pedidosWeb = snapWebDni.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Fallback en pedidos_web con el dni CRUDO (solicitudes web antiguas).
    if (pedidosWeb.length === 0 && dniRaw && dniRaw !== dniNorm) {
      const qWebRaw = query(
        collection(erpDb, 'pedidos_web'),
        where('clienteNumeroDocumento', '==', dniRaw)
      );
      const snapWebRaw = await getDocs(qWebRaw);
      pedidosWeb = snapWebRaw.docs.map(d => ({ id: d.id, ...d.data() }));
      if (pedidosWeb.length === 0) {
        const qWebRawDni = query(
          collection(erpDb, 'pedidos_web'),
          where('dni', '==', dniRaw)
        );
        const snapWebRawDni = await getDocs(qWebRawDni);
        pedidosWeb = snapWebRawDni.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    }

    pedidos = [...pedidos, ...pedidosWeb];

    // ── WALA = FUENTE DE VERDAD: presencia garantizada desde wala_pedidos ──────
    // Los pedidos VIVOS (pedidos + pedidos_web) ya están en `pedidos`. Ahora
    // traemos SIEMPRE el espejo propio de WALA (wala_pedidos) y lo fusionamos por
    // CLAVE DE NEGOCIO con los vivos. Reglas (decisión del dueño):
    //   1) PRESENCIA: el listado INCLUYE SIEMPRE todos los wala_pedidos del usuario
    //      (no solo cuando faltan en vivo): un pedido NUNCA desaparece de "Mis
    //      Compras" porque su existencia la garantiza wala_pedidos.
    //   2) ESTADO mostrado = el MÁS AVANZADO entre el doc VIVO del ERP (si existe)
    //      y wala_pedidos.estadoWala. Para que la UI pueda decidir, ADJUNTAMOS el
    //      estadoWala del espejo sobre el doc vivo correspondiente (campos aditivos
    //      _walaEstado/_walaPagado); la precedencia "no degradar" la resuelve
    //      derivarEstadoCompra (src/utils/estadoCompra.js). NO se recalcula ningún
    //      monto ni se borra nada.
    // Best-effort: getWalaMirrorOrders nunca lanza (devuelve [] ante error).
    try {
      const { getWalaMirrorOrders } = await import('../walaOrders');
      const espejo = await getWalaMirrorOrders({ userId, dni: dniRaw || dniNorm });

      if (Array.isArray(espejo) && espejo.length > 0) {
        // Clave de negocio idéntica a adminOrders.js (dedup de "Recepción").
        const claveDeNegocio = (p) =>
          (p && (p.numeroPedido || p.portalPseudoOrderId || p.pedidoWebId || p.id)) || null;

        // ¿el pedido vivo SIGUE siendo de WALA? (mismo criterio que esPedidoWala
        // de usePedidos.js). IMPORTA porque usePedidos FILTRA la lista cruda por
        // esPedidoWala ANTES de normalizar: un vivo ya desmarcado por el ERP
        // (p.ej. web:false) NO sobrevive ese filtro, así que su espejo debe
        // permanecer para garantizar la presencia del pedido.
        const esWala = (p) =>
          !!p &&
          (p.canalVenta === 'Portal Web' ||
            p.web === true ||
            p.activador === 'portal_web' ||
            p.vendedor === 'Portal Web');

        // Índice de los docs VIVOS por clave de negocio. Si existe un vivo con la
        // misma clave que un espejo, el vivo es el portador del ESTADO de
        // producción del ERP y le adjuntamos el estadoWala del espejo.
        const vivosPorClave = new Map();
        pedidos.forEach((p) => {
          const c = claveDeNegocio(p);
          if (c && !vivosPorClave.has(c)) vivosPorClave.set(c, p);
        });

        // Para cada pedido del espejo:
        //   - si hay un vivo-WALA con su clave → ADJUNTAMOS estadoWala/pagado al
        //     vivo (no duplicamos; el vivo conserva su etapa de producción del ERP
        //     y la UI elegirá el estado más avanzado entre ambos).
        //   - si el vivo existe pero YA NO es WALA (desmarcado por el ERP) → además
        //     de enriquecerlo, CONSERVAMOS el espejo (sobrevive al filtro esPedidoWala
        //     de usePedidos) para no perder la presencia del pedido.
        //   - si NO hay vivo → AGREGAMOS la copia espejo (presencia garantizada).
        const clavesEspejoVistas = new Set();
        espejo.forEach((m) => {
          const c = claveDeNegocio(m);
          const vivo = c ? vivosPorClave.get(c) : null;
          if (vivo) {
            // Enriquecemos el doc vivo con el estado propio de WALA (aditivo).
            vivo._walaEstado = m.estadoWala ?? vivo._walaEstado ?? null;
            vivo._walaPagado = m.pagado === true || vivo._walaPagado === true;
            // Si el vivo SIGUE siendo WALA, él representa el pedido: no duplicamos.
            if (esWala(vivo)) return;
            // Si el vivo fue desmarcado por el ERP, caerá del filtro esPedidoWala;
            // dejamos pasar el espejo (más abajo) para que el pedido no desaparezca.
          }
          // Evita duplicar dos espejos con la misma clave y agrega la copia.
          if (c && clavesEspejoVistas.has(c)) return;
          if (c) clavesEspejoVistas.add(c);
          pedidos.push(m);
        });
      }
    } catch (mirrorErr) {
      // El espejo es best-effort: si falla la lectura, seguimos con los vivos.
      console.warn('No se pudo leer el espejo wala_pedidos (best-effort):', mirrorErr?.message);
    }

    pedidos = sortPedidosByCreatedAt(pedidos);
    return { data: pedidos, error: null };
  } catch (error) {
    console.error('Error al buscar pedidos en ERP:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Buscar pedidos por teléfono y DNI en el Firestore del ERP (legacy).
 * @param {string} telefono
 * @param {string} dni
 * @returns {Promise<{ data: Array | null, error: string | null }>}
 */
export async function searchOrdersInERP(telefono, dni) {
  if (!isErpFirestoreAvailable()) {
    return { data: null, error: 'Firestore del ERP no está disponible' };
  }

  try {
    const q = query(
      collection(erpDb, 'pedidos'),
      where('phone', '==', telefono),
      where('dni', '==', dni),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    let pedidos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const qWeb = query(
      collection(erpDb, 'pedidos_web'),
      where('phone', '==', telefono),
      where('dni', '==', dni),
      orderBy('createdAt', 'desc')
    );

    const querySnapshotWeb = await getDocs(qWeb);
    const pedidosWeb = querySnapshotWeb.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    pedidos = [...pedidos, ...pedidosWeb];
    pedidos = sortPedidosByCreatedAt(pedidos);

    return { data: pedidos, error: null };
  } catch (error) {
    console.error('Error al buscar pedidos en ERP:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Obtener un pedido por ID desde el Firestore del ERP
 * @param {string} orderId
 * @returns {Promise<{ data: Object | null, error: string | null }>}
 */
export async function getOrderFromERP(orderId) {
  if (!isErpFirestoreAvailable()) {
    return { data: null, error: 'Firestore del ERP no está disponible' };
  }

  try {
    const docRef = doc(erpDb, 'pedidos', orderId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
    }

    return { data: null, error: 'Pedido no encontrado' };
  } catch (error) {
    console.error('Error al obtener pedido del ERP:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Obtener un pedido por ID buscando en AMBAS colecciones del ERP: primero
 * 'pedidos' (oficial/validado) y, si no existe, 'pedidos_web' (cola web pendiente
 * de validación). Devuelve el documento CRUDO completo (productos, dirección,
 * pago, numeroPedido…), que es lo que necesita el detalle de "Mis Compras".
 * @param {string} orderId
 * @returns {Promise<{ data: Object | null, error: string | null }>}
 */
export async function getOrderByIdAnyCollection(orderId) {
  if (!isErpFirestoreAvailable()) {
    return { data: null, error: 'Firestore del ERP no está disponible' };
  }
  try {
    for (const col of ['pedidos', 'pedidos_web']) {
      const snap = await getDoc(doc(erpDb, col, orderId));
      if (snap.exists()) {
        return { data: { id: snap.id, _coleccion: col, ...snap.data() }, error: null };
      }
    }
    return { data: null, error: 'Pedido no encontrado' };
  } catch (error) {
    console.error('Error al obtener pedido (ambas colecciones):', error);
    return { data: null, error: error.message };
  }
}

/**
 * Actualizar un pedido en el Firestore del ERP
 * @param {string} orderId
 * @param {Object} updates
 * @returns {Promise<{ error: string | null }>}
 */
export async function updateOrderInERP(orderId, updates) {
  if (!isErpFirestoreAvailable()) {
    return { error: 'Firestore del ERP no está disponible' };
  }

  try {
    const docRef = doc(erpDb, 'pedidos', orderId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (error) {
    console.error('Error al actualizar pedido en ERP:', error);
    return { error: error.message };
  }
}

/**
 * Lista pedidos del ERP con paginación para sincronización de cuentas.
 * Orden: más recientes primero. Se filtra en memoria por "tiene email válido".
 * @param {number} [limitCount=100] - Máximo de documentos a traer
 * @param {import('firebase/firestore').DocumentSnapshot | null} [startAfterDoc=null] - Cursor para siguiente página
 * @returns {Promise<{ data: Array<{ id: string } & Object>, lastDoc: import('firebase/firestore').DocumentSnapshot | null, error: string | null }>}
 */
export async function getPedidosForAccountSync(limitCount = 100, startAfterDoc = null) {
  if (!isErpFirestoreAvailable()) {
    return { data: [], lastDoc: null, error: 'Firestore del ERP no está disponible' };
  }

  try {
    const coll = collection(erpDb, 'pedidos');
    let q = query(
      coll,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    if (startAfterDoc) {
      q = query(
        coll,
        orderBy('createdAt', 'desc'),
        startAfter(startAfterDoc),
        limit(limitCount)
      );
    }
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    return { data, lastDoc, error: null };
  } catch (error) {
    console.error('Error al listar pedidos para sync de cuentas:', error);
    return { data: [], lastDoc: null, error: error.message };
  }
}

/**
 * Crea una solicitud de pedido web en la colección `pedidos_web` del Firebase ERP.
 * Separada de `pedidos/` (ERP real) para pasar primero por validación manual.
 *
 * @param {Object} orderData - Datos del pedido con la misma estructura de campos del ERP
 * @returns {Promise<{ id: string | null, error: string | null }>}
 */
export async function createWebOrder(orderData) {
  if (!isErpFirestoreAvailable()) {
    return { id: null, error: 'Firestore del ERP no está disponible' };
  }

  try {
    const orderPayload = {
      ...orderData,
      web: true,
      estadoValidacion: 'pendiente', // estado de la cola de validación
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Normaliza el documento igual que createOrderInERP para que el filtro
    // exacto de "Mis Compras" (searchOrdersByDniInERP) case con lo guardado.
    // Se conserva el valor tecleado original en dniRaw (CE/pasaporte tal cual).
    const docRaw = orderData.clienteNumeroDocumento || orderData.dni || '';
    const docNorm = String(docRaw).trim().replace(/\s/g, '');
    if (docNorm) {
      orderPayload.dniRaw = docRaw; // valor original sin normalizar (no se pierde)
      orderPayload.clienteNumeroDocumento = docNorm;
      orderPayload.dni = docNorm;
    }
    // Si el documento viene vacío no se fuerza: se deja como está.

    const docRef = await addDoc(collection(erpDb, 'pedidos_web'), orderPayload);

    // ── WALA = FUENTE DE VERDAD: copia/espejo del pedido del lado WALA ─────────
    // Tras guardar OK en pedidos_web, escribimos el pedido en wala_pedidos, que es
    // la base PROPIA e INDEPENDIENTE de WALA (con su propio estadoWala). El ERP
    // externo, al aprobar, puede borrar el doc de pedidos_web; wala_pedidos es
    // nuestra copia para que el pedido nunca desaparezca de "Mis Compras" y para
    // que WALA muestre su propio estado/pago.
    //
    // Import dinámico para evitar el ciclo de dependencias (walaOrders.js importa
    // erpDb de este archivo). Al ser lazy, el ciclo se resuelve en runtime.
    //
    // CONFIABLE pero NO BLOQUEANTE: ahora hacemos AWAIT del espejo dentro de un
    // try/catch que SOLO loguea y NUNCA aborta el pedido. El pedido YA quedó
    // persistido en pedidos_web (addDoc anterior); si el espejo fallara, se loguea
    // pero la venta CONTINÚA y el valor de retorno de createWebOrder no cambia.
    // Le pasamos el payload YA enriquecido (clienteNumeroDocumento/dni normalizados
    // + dniRaw); buyerUid/userId viene del checkout dentro de él.
    try {
      const { mirrorWebOrder } = await import('../walaOrders');
      const espejoRes = await mirrorWebOrder({ pedidoWebId: docRef.id, payload: orderPayload });
      if (espejoRes?.error) {
        // mirrorWebOrder es best-effort y NO lanza: devuelve {error}. Solo logueamos.
        console.warn('Espejo wala_pedidos no se escribió (best-effort):', espejoRes.error);
      }
    } catch (mirrorErr) {
      // Cinturón extra: cualquier excepción inesperada del import/espejo se loguea
      // y NO rompe la creación del pedido (que ya está persistida).
      console.warn('No se pudo escribir el espejo wala_pedidos (best-effort):', mirrorErr?.message);
    }

    return { id: docRef.id, error: null };
  } catch (error) {
    console.error('Error al crear solicitud web en pedidos_web:', error);
    return { id: null, error: error.message };
  }
}

/**
 * Obtener detalles del regalo de un pedido (por pseudoOrderId o ID)
 * Solo devuelve los datos de giftDetails para mantener la privacidad
 */
export async function getOrderGiftDetails(orderId) {
  if (!isErpFirestoreAvailable()) {
    return { data: null, error: 'Firestore del ERP no está disponible' };
  }

  try {
    // 1. Buscar por numeroPedido en pedidos_web
    const qWeb = query(collection(erpDb, 'pedidos_web'), where('numeroPedido', '==', orderId));
    const snapWeb = await getDocs(qWeb);
    if (!snapWeb.empty) {
      const docData = snapWeb.docs[0].data();
      if (docData.giftDetails && docData.giftDetails.isGift) {
        return { data: docData.giftDetails, error: null };
      }
    }

    // 2. Buscar por numeroPedido en pedidos (aprobados)
    const qPedidos = query(collection(erpDb, 'pedidos'), where('numeroPedido', '==', orderId));
    const snapPedidos = await getDocs(qPedidos);
    if (!snapPedidos.empty) {
      const docData = snapPedidos.docs[0].data();
      if (docData.giftDetails && docData.giftDetails.isGift) {
        return { data: docData.giftDetails, error: null };
      }
    }

    return { data: null, error: 'No se encontraron detalles de regalo para esta orden.' };
  } catch (error) {
    console.error('Error al obtener detalles del regalo:', error);
    return { data: null, error: error.message };
  }
}

export { erpDb, erpApp };
