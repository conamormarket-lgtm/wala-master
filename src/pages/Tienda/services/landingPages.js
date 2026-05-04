import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../../services/firebase/config';

const COLLECTION_NAME = 'landingPages';

export const getLandingPages = async () => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error obteniendo landing pages:", error);
    return [];
  }
};

export const getLandingPageBySlug = async (slug) => {
  try {
    if (!slug) return null;
    const q = query(collection(db, COLLECTION_NAME), where("slug", "==", slug));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error obteniendo landing page por slug:", error);
    return null;
  }
};

export const getLandingPageById = async (id) => {
  try {
    if (!id) return null;
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error obteniendo landing page:", error);
    return null;
  }
};

export const saveLandingPage = async (id, data) => {
  try {
    const docId = id || `lp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await setDoc(doc(db, COLLECTION_NAME, docId), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true, id: docId };
  } catch (error) {
    console.error("Error guardando landing page:", error);
    return { error: error.message };
  }
};

export const deleteLandingPage = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    // Opcional: También deberíamos eliminar las 'sections' en 'pages' pero
    // por ahora se quedan como documentos huérfanos sin slug o podemos limpiarlos.
    await deleteDoc(doc(db, 'pages', id));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando landing page:", error);
    return { error: error.message };
  }
};
