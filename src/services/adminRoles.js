import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase/config';

const COLLECTION_NAME = 'adminRoles';

/**
 * Obtener todos los roles de administrador
 */
export const getAdminRoles = async () => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error obteniendo roles de admin:", error);
    return [];
  }
};

/**
 * Obtener permisos de un administrador específico por email
 */
export const getAdminRoleByEmail = async (email) => {
  try {
    if (!email) return null;
    const docRef = doc(db, COLLECTION_NAME, email.toLowerCase());
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error obteniendo rol para email:", email, error);
    return null;
  }
};

/**
 * Establecer o actualizar permisos de un administrador
 */
export const setAdminRole = async (email, data) => {
  try {
    if (!email) throw new Error("Email requerido");
    const docId = email.toLowerCase();
    await setDoc(doc(db, COLLECTION_NAME, docId), {
      email: docId,
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("Error guardando rol de admin:", error);
    return { error: error.message };
  }
};

/**
 * Eliminar a un administrador
 */
export const deleteAdminRole = async (email) => {
  try {
    if (!email) return { error: "Email requerido" };
    await deleteDoc(doc(db, COLLECTION_NAME, email.toLowerCase()));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando rol de admin:", error);
    return { error: error.message };
  }
};
