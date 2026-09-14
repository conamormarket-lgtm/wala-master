import { db } from './firebase/config';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const WISHLIST_COLLECTION = 'wishlists';

export const getWishlistByUserCode = async (userCode) => {
  try {
    const q = query(collection(db, WISHLIST_COLLECTION), where('userCode', '==', userCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { data: null, error: 'Lista no encontrada' };
    
    return { data: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }, error: null };
  } catch (error) {
    console.error("Error fetching wishlist by code:", error);
    return { data: null, error: error.message };
  }
};

/**
 * Realinea wishlists/{userId}.userCode con el referralCode ACTUAL del perfil.
 *
 * POR QUÉ EXISTE: userCode se graba UNA sola vez, al crear la wishlist
 * (createWishlist), con el referralCode que el perfil tenía en ESE momento.
 * Si el referralCode del perfil cambia después (se detectó un caso real: el
 * perfil quedó con un código distinto al que tenía la wishlist ya creada),
 * userCode se queda con el valor viejo PARA SIEMPRE — nada lo vuelve a tocar.
 * El link "Compartir mi lista" siempre arma la URL con el referralCode
 * ACTUAL (WishlistPage.jsx), así que ese link deja de encontrar la lista:
 * "Lista no encontrada" para un usuario que sí tiene productos guardados.
 *
 * Se llama (best-effort, no bloquea la carga) cada vez que se lee la wishlist
 * propia y el código no coincide, para que se autorepare sola.
 */
export const syncWishlistUserCode = async (userId, currentReferralCode) => {
  if (!userId || !currentReferralCode) return;
  try {
    await updateDoc(doc(db, WISHLIST_COLLECTION, userId), { userCode: currentReferralCode });
  } catch (error) {
    console.error("Error resincronizando userCode de la wishlist:", error);
  }
};

export const getWishlistByUserId = async (userId) => {
  try {
    const docRef = doc(db, WISHLIST_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return { data: null, error: null };
    
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    console.error("Error fetching wishlist by user id:", error);
    return { data: null, error: error.message };
  }
};

export const createWishlist = async (userId, userCode) => {
  try {
    const docRef = doc(db, WISHLIST_COLLECTION, userId);
    const newData = {
      userId,
      userCode,
      createdAt: new Date().toISOString(),
      items: []
    };
    await setDoc(docRef, newData);
    return { data: { id: userId, ...newData }, error: null };
  } catch (error) {
    console.error("Error creating wishlist:", error);
    return { data: null, error: error.message };
  }
};

export const addWishlistItem = async (userId, userCode, product) => {
  try {
    const docRef = doc(db, WISHLIST_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      await createWishlist(userId, userCode);
    }
    
    const newItem = {
      productId: product.id,
      productName: product.name,
      productImage: product.mainImage || product.images?.[0] || '',
      // Precio snapshot al momento de agregar (salePrice manda): así /regalar y
      // la wishlist pública muestran precio aunque el producto salga del catálogo.
      // Items antiguos no lo tienen → los lectores usan item.price || 0.
      price: product.salePrice || product.price || 0,
      addedAt: new Date().toISOString(),
      isGifted: false,
      giftedBy: null
    };

    await updateDoc(docRef, {
      items: arrayUnion(newItem)
    });

    return { data: newItem, error: null };
  } catch (error) {
    console.error("Error adding wishlist item:", error);
    return { data: null, error: error.message };
  }
};

export const removeWishlistItem = async (userId, productId) => {
  try {
    const docRef = doc(db, WISHLIST_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return { data: null, error: 'Lista no encontrada' };
    
    const items = docSnap.data().items || [];
    const itemToRemove = items.find(i => i.productId === productId);
    
    if (itemToRemove) {
      await updateDoc(docRef, {
        items: arrayRemove(itemToRemove)
      });
    }

    return { data: true, error: null };
  } catch (error) {
    console.error("Error removing wishlist item:", error);
    return { data: null, error: error.message };
  }
};

// Antes esto era un updateDoc/addDoc directo del cliente sobre la wishlist AJENA
// del dueño (y sobre su subcolección de notificaciones). Casi siempre fallaba en
// silencio: `wishlists/{userId}` exige ser el dueño para escribir y
// `users/{userId}/notifications` exige ser admin para crear (firestore.rules) —
// quien compra el regalo nunca es ninguna de las dos cosas. El pedido se creaba
// igual (el checkout no revisa el resultado), pero el item nunca quedaba
// marcado y el dueño nunca era notificado. Ahora corre en el servidor
// (markWishlistItemGiftedSecure, Admin SDK, bypassa las reglas) via Cloud Function.
export const markItemAsGifted = async (userCode, productId, buyerName) => {
  try {
    const callable = httpsCallable(getFunctions(), 'markWishlistItemGiftedSecure');
    const { data } = await callable({ wishlistUserCode: userCode, productId, buyerName });
    if (!data?.ok) return { data: null, error: data?.error || 'No se pudo marcar el regalo' };
    return { data: true, error: null };
  } catch (error) {
    console.error("Error marking item as gifted:", error);
    return { data: null, error: error.message };
  }
};
