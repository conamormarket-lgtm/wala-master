import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp
} from 'firebase/firestore';
import { db, getFirebaseConfigMessage } from './config';

// Verificar si Firestore está disponible
const isFirestoreAvailable = () => {
  return db !== null;
};

/**
 * Elimina propiedades undefined de un objeto (y anidados). Firestore no acepta undefined.
 */
function removeUndefined(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter((v) => v !== undefined);
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const cleaned = removeUndefined(v);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out;
}

/**
 * Convierte cadenas vacías a null de forma recursiva. Firestore no acepta strings vacíos.
 */
function emptyStringsToNull(obj) {
  if (obj === undefined) return undefined;
  if (typeof obj === 'string') return obj === '' ? null : obj;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(emptyStringsToNull);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const cleaned = emptyStringsToNull(v);
    out[k] = cleaned;
  }
  return out;
}

/**
 * Elimina valores que Firestore rechaza: undefined, null, '', [], y objetos vacíos.
 * Se usa antes de addDoc para evitar "Document fields must not be empty".
 */
function removeEmptyForFirestore(obj) {
  if (obj === undefined) return undefined;
  if (obj === null) return undefined;
  if (typeof obj === 'string') return obj === '' ? undefined : obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    const cleaned = obj.map(removeEmptyForFirestore).filter((v) => v !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = removeEmptyForFirestore(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return obj;
}

/**
 * Obtener un documento por ID
 */
export const getDocument = async (collectionName, docId) => {
  if (!isFirestoreAvailable()) {
    return { data: null, error: getFirebaseConfigMessage() };
  }
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
    }
    return { data: null, error: 'Documento no encontrado' };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * Obtener todos los documentos de una colección
 */
export const getCollection = async (collectionName, filters = [], orderByField = null, limitCount = null) => {
  if (!isFirestoreAvailable()) {
    return { data: [], error: getFirebaseConfigMessage() };
  }
  try {
    let q = collection(db, collectionName);
    
    // Aplicar filtros
    filters.forEach(filter => {
      q = query(q, where(filter.field, filter.operator, filter.value));
    });
    
    // Aplicar ordenamiento
    if (orderByField) {
      q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
    }
    
    // Aplicar límite
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { data, error: null };
  } catch (error) {
    return { data: [], error: error.message };
  }
};

/**
 * Crear un nuevo documento
 */
export const createDocument = async (collectionName, data) => {
  if (!isFirestoreAvailable()) {
    return { id: null, error: getFirebaseConfigMessage() };
  }
  try {
    const noEmptyStrings = emptyStringsToNull(data);
    const noEmptyValues = removeEmptyForFirestore(noEmptyStrings);
    const base = (typeof noEmptyValues === 'object' && noEmptyValues !== null && !Array.isArray(noEmptyValues))
      ? noEmptyValues
      : {};
    const withTimestamps = {
      ...base,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const cleanData = removeUndefined(withTimestamps);
    const docRef = await addDoc(collection(db, collectionName), cleanData);
    return { id: docRef.id, error: null };
  } catch (error) {
    return { id: null, error: error.message };
  }
};

/**
 * Crear o reemplazar un documento con ID específico (ej. users/{uid})
 */
export const setDocument = async (collectionName, docId, data) => {
  if (!isFirestoreAvailable()) {
    return { error: getFirebaseConfigMessage() };
  }
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Actualizar un documento.
 * Limpia campos vacíos (string vacío, array vacío, objeto vacío) para cumplir con Firestore:
 * "Document fields must not be empty".
 */
export const updateDocument = async (collectionName, docId, data) => {
  if (!isFirestoreAvailable()) {
    return { error: getFirebaseConfigMessage() };
  }
  try {
    const docRef = doc(db, collectionName, docId);
    const noEmptyStrings = emptyStringsToNull(data);
    const noEmptyValues = removeEmptyForFirestore(noEmptyStrings);
    const base = typeof noEmptyValues === 'object' && noEmptyValues !== null && !Array.isArray(noEmptyValues)
      ? noEmptyValues
      : {};
    const withTimestamps = {
      ...base,
      updatedAt: serverTimestamp()
    };
    const cleanData = removeUndefined(withTimestamps);
    await updateDoc(docRef, cleanData);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Eliminar un documento
 */
export const deleteDocument = async (collectionName, docId) => {
  if (!isFirestoreAvailable()) {
    return { error: getFirebaseConfigMessage() };
  }
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Buscar documentos con paginación
 */
export const getCollectionPaginated = async (
  collectionName,
  filters = [],
  orderByField = null,
  pageSize = 10,
  lastDoc = null
) => {
  if (!isFirestoreAvailable()) {
    return { data: [], lastDoc: null, hasMore: false, error: getFirebaseConfigMessage() };
  }
  try {
    let q = collection(db, collectionName);
    
    filters.forEach(filter => {
      q = query(q, where(filter.field, filter.operator, filter.value));
    });
    
    if (orderByField) {
      q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
    }
    
    if (lastDoc) {
      q = query(q, startAfter(lastDoc), limit(pageSize));
    } else {
      q = query(q, limit(pageSize));
    }
    
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
    
    return {
      data,
      lastDoc: lastVisible,
      hasMore: querySnapshot.docs.length === pageSize,
      error: null
    };
  } catch (error) {
    return { data: [], lastDoc: null, hasMore: false, error: error.message };
  }
};
