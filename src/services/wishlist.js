import { db } from './firebase/config';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

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

export const markItemAsGifted = async (userCode, productId, buyerName) => {
  try {
    const q = query(collection(db, WISHLIST_COLLECTION), where('userCode', '==', userCode));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { data: null, error: 'Lista no encontrada' };
    
    const wishlistDoc = snapshot.docs[0];
    const items = wishlistDoc.data().items || [];
    const itemIndex = items.findIndex(i => i.productId === productId);
    
    if (itemIndex > -1) {
      items[itemIndex].isGifted = true;
      items[itemIndex].giftedBy = buyerName || 'Alguien';
      
      await updateDoc(wishlistDoc.ref, { items });
      
      // Notify the owner
      if (wishlistDoc.data().userId) {
        try {
          await addDoc(collection(db, `users/${wishlistDoc.data().userId}/notifications`), {
            title: '¡Alguien acaba de regalarte algo de tu lista! 🎁',
            body: 'Han comprado un regalo de tu lista de deseos. ¡Qué emoción!',
            createdAt: new Date().toISOString(),
            read: false,
            type: 'wishlist_gift'
          });
        } catch (e) {
          console.error("Error notifying owner:", e);
        }
      }
      
      return { data: true, error: null };
    }
    
    return { data: null, error: 'Producto no encontrado en la lista' };
  } catch (error) {
    console.error("Error marking item as gifted:", error);
    return { data: null, error: error.message };
  }
};
