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
    // 1) Match exacto del slug.
    const q = query(collection(db, COLLECTION_NAME), where("slug", "==", slug));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    // 2) Fallback CASE-INSENSITIVE: la URL puede venir con otra capitalización
    //    (ej. /CONAMOR vs slug "ConAmor"). Firestore no compara sin distinguir
    //    mayúsculas, así que se busca en memoria (la colección es pequeña).
    const target = String(slug).toLowerCase();
    const all = await getDocs(collection(db, COLLECTION_NAME));
    const hit = all.docs.find(
      (d) => String((d.data() || {}).slug || d.id).toLowerCase() === target
    );
    if (hit) return { id: hit.id, ...hit.data() };
    // 3) Slug ANTERIOR: la landing se renombró (ej. /mussa → /lumi). Los links
    //    viejos (QR, anuncios, compartidos) se devuelven marcados para que
    //    DynamicLandingPage redirija a la URL nueva en vez de mandar al inicio.
    const renombrada = all.docs.find((d) =>
      ((d.data() || {}).slugsAnteriores || []).some((s) => String(s).toLowerCase() === target)
    );
    if (renombrada) return { id: renombrada.id, ...renombrada.data(), redirigirA: renombrada.data().slug };
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
    // brandId (multimarca): se persiste tal cual venga en `data`. Se normaliza a
    // string recortado; vacío => '' (página global, retrocompatible). Las landings
    // ya guardadas sin este campo simplemente no lo tendrán y seguirán infiriendo
    // la marca desde sus secciones (ver TiendaPage / pageBrandId).
    const brandId = typeof data.brandId === 'string' ? data.brandId.trim() : '';
    await setDoc(doc(db, COLLECTION_NAME, docId), {
      ...data,
      brandId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true, id: docId };
  } catch (error) {
    console.error("Error guardando landing page:", error);
    return { error: error.message };
  }
};

/**
 * El diseño de una landing vive en pages/<slug>: al cambiarle el slug, la
 * página nueva quedaba vacía aunque el diseño siguiera en pages/<slug viejo>.
 * Copia el diseño al slug nuevo (si ahí todavía no hay nada) y deja el viejo
 * intacto como respaldo.
 */
export const moverDisenoDeLanding = async (slugViejo, slugNuevo) => {
  try {
    if (!slugViejo || !slugNuevo || slugViejo === slugNuevo) return { success: true };
    const destino = doc(db, 'pages', slugNuevo);
    if ((await getDoc(destino)).exists()) return { success: true };
    const origen = await getDoc(doc(db, 'pages', slugViejo));
    if (!origen.exists()) return { success: true };
    await setDoc(destino, { ...origen.data(), updatedAt: new Date().toISOString() });
    return { success: true };
  } catch (error) {
    console.error("Error moviendo el diseño de la landing:", error);
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
