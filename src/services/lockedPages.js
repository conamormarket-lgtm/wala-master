import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase/config';

const DOC_REF = doc(db, 'storeConfig', 'lockedPages');

export const getLockedPages = async () => {
  try {
    const snap = await getDoc(DOC_REF);
    if (snap.exists()) {
      return snap.data().pages || [];
    }
    return [];
  } catch (error) {
    console.error('Error obteniendo páginas bloqueadas:', error);
    return [];
  }
};

export const saveLockedPages = async (pagesArray) => {
  try {
    await setDoc(DOC_REF, { pages: pagesArray }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error guardando páginas bloqueadas:', error);
    return { error: error.message };
  }
};
