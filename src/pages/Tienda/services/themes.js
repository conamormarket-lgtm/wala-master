import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase/config';

const COLLECTION_NAME = 'tienda_themes';

export const getThemes = async () => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error obteniendo temas:", error);
    return [];
  }
};

export const getThemeById = async (id) => {
  try {
    if (!id) return null;
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error obteniendo tema:", error);
    return null;
  }
};

export const saveTheme = async (id, data) => {
  try {
    const docId = id || `theme_${Date.now()}`;
    await setDoc(doc(db, COLLECTION_NAME, docId), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true, id: docId };
  } catch (error) {
    console.error("Error guardando tema:", error);
    return { error: error.message };
  }
};

export const deleteTheme = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando tema:", error);
    return { error: error.message };
  }
};
