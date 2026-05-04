import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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
  apiKey: process.env.REACT_APP_ERP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_ERP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_ERP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_ERP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_ERP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_ERP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_ERP_FIREBASE_MEASUREMENT_ID
};

let erpApp = null;
let erpDb = null;

try {
  // Verificar si ya existe una instancia con el nombre 'erp-firebase'
  const existingApps = getApps();
  const existingErpApp = existingApps.find(app => app.name === 'erp-firebase');

  if (existingErpApp) {
    erpApp = existingErpApp;
    erpDb = getFirestore(erpApp);
  } else {
    // Inicializar Firebase del ERP con un nombre único para evitar conflictos
    erpApp = initializeApp(erpFirebaseConfig, 'erp-firebase');
    erpDb = getFirestore(erpApp);
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
 * @param {string} dni - DNI o CE del cliente (se normaliza a string sin espacios)
 * @returns {Promise<{ data: Array | null, error: string | null }>}
 */
export async function searchOrdersByDniInERP(dni) {
  if (!isErpFirestoreAvailable()) {
    return { data: null, error: 'Firestore del ERP no está disponible' };
  }

  const dniNorm = dni != null ? String(dni).trim().replace(/\s/g, '') : '';
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
    const pedidos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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

    const docRef = await addDoc(collection(erpDb, 'pedidos_web'), orderPayload);
    return { id: docRef.id, error: null };
  } catch (error) {
    console.error('Error al crear solicitud web en pedidos_web:', error);
    return { id: null, error: error.message };
  }
}

export { erpDb, erpApp };
