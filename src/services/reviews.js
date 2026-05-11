import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { uploadFile } from './firebase/storage';

const REVIEWS_COLLECTION = 'product_reviews';

/**
 * Agrega una nueva reseña a un producto.
 */
export const addReview = async (productId, user, rating, comment, imageFiles) => {
  if (!user) throw new Error("Debes estar logueado para dejar una reseña.");
  
  try {
    const imageUrls = [];
    
    // Subir imágenes si existen
    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        // Carpeta en storage: product_reviews/{productId}/{timestamp}_{filename}
        const path = `product_reviews/${productId}/${Date.now()}_${file.name}`;
        const { url, error } = await uploadFile(file, path);
        if (error) throw new Error(`Error al subir imagen: ${error}`);
        if (url) imageUrls.push(url);
      }
    }

    const reviewData = {
      productId,
      userId: user.uid,
      userName: user.displayName || 'Anónimo',
      rating,
      comment,
      imageUrls,
      helpfulVotes: [],
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), reviewData);
    return { success: true, id: docRef.id, data: { ...reviewData, createdAt: new Date() } };
  } catch (error) {
    console.error("Error al agregar reseña:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene las reseñas de un producto.
 */
export const getProductReviews = async (productId) => {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where("productId", "==", productId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }));
  } catch (error) {
    console.error("Error al obtener reseñas:", error);
    // Nota: Firebase requiere un índice compuesto si usas where y orderBy juntos.
    // Si falla por índice, Firebase mostrará un link en la consola para crearlo.
    return [];
  }
};

/**
 * Alterna el voto "Útil" de un usuario en una reseña.
 */
export const toggleHelpfulVote = async (reviewId, userId) => {
  if (!userId) throw new Error("Debes estar logueado para votar.");

  try {
    const reviewRef = doc(db, REVIEWS_COLLECTION, reviewId);
    const reviewSnap = await getDoc(reviewRef);
    
    if (!reviewSnap.exists()) {
      throw new Error("La reseña no existe.");
    }

    const data = reviewSnap.data();
    const helpfulVotes = data.helpfulVotes || [];
    const hasVoted = helpfulVotes.includes(userId);

    if (hasVoted) {
      await updateDoc(reviewRef, {
        helpfulVotes: arrayRemove(userId)
      });
      return { success: true, voted: false };
    } else {
      await updateDoc(reviewRef, {
        helpfulVotes: arrayUnion(userId)
      });
      return { success: true, voted: true };
    }
  } catch (error) {
    console.error("Error al votar:", error);
    return { success: false, error: error.message };
  }
};
