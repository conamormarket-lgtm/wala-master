import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase/config';
import { getDocument, setDocument } from './firebase/firestore';

const REFERRALS_COLLECTION = 'referrals';

/**
 * Registra un clic en el enlace de referido.
 * Crea un documento de seguimiento (tracker) para esta sesión.
 */
export async function createReferralShare(referrerCode) {
  try {
    const code = referrerCode.trim().toUpperCase();
    
    // Validar límite mensual (50 referidos compartidos)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const qLimit = query(
      collection(db, REFERRALS_COLLECTION),
      where('referrerCode', '==', code),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
    );
    const limitSnap = await getDocs(qLimit);
    if (limitSnap.size >= 50) {
      return { id: null, error: 'Has alcanzado el límite mensual de referidos compartidos.' };
    }

    const docRef = await addDoc(collection(db, REFERRALS_COLLECTION), {
      referrerCode: code,
      status: 'sent', // Etapa 1
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, error: null };
  } catch (error) {
    return { id: null, error: error.message };
  }
}

/**
 * Registra un clic en el enlace de referido.
 * Si recibe un shareId (Etapa 1 existente), lo actualiza a Etapa 2.
 * Si no, crea un documento de seguimiento (tracker) nuevo desde Etapa 2.
 */
export async function recordReferralClick(referrerCode, shareId = null) {
  try {
    if (shareId) {
      // Actualizar doc existente
      const docRef = doc(db, REFERRALS_COLLECTION, shareId);
      await updateDoc(docRef, {
        status: 'clicked', // Etapa 2
        clickedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { id: shareId, error: null };
    }

    const docRef = await addDoc(collection(db, REFERRALS_COLLECTION), {
      referrerCode: referrerCode.trim().toUpperCase(),
      status: 'clicked', // Etapa 2
      clickedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, error: null };
  } catch (error) {
    return { id: null, error: error.message };
  }
}

/**
 * Vincula una compra finalizada con el flujo del referido
 */
export async function linkPurchaseToReferral(referralId, orderId, orderTotal) {
  try {
    const docRef = doc(db, REFERRALS_COLLECTION, referralId);
    await updateDoc(docRef, {
      status: 'purchased', // Etapa 3
      orderId,
      orderTotal,
      purchasedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Actualiza el referido a Completado cuando el Admin finaliza el pedido.
 * Calcula las monedas ganadas (5 por cada 100).
 */
export async function updateReferralToCompletedByOrder(orderId, orderTotal) {
  try {
    const q = query(collection(db, REFERRALS_COLLECTION), where('orderId', '==', orderId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { error: null, found: false };

    const referralDoc = snapshot.docs[0];
    const data = referralDoc.data();
    
    // Contar compras completadas en este mes
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const countQ = query(
      collection(db, REFERRALS_COLLECTION),
      where('referrerCode', '==', data.referrerCode),
      where('status', 'in', ['completed', 'claimed']),
      where('completedAt', '>=', Timestamp.fromDate(startOfMonth))
    );
    const countSnapshot = await getDocs(countQ);
    const completedThisMonth = countSnapshot.size;
    
    // A partir de la 3ra compra del mes se duplica (20 monedas), caso contrario 10
    const earnedCoins = completedThisMonth >= 2 ? 20 : 10;

    await updateDoc(referralDoc.ref, {
      status: 'completed', // Etapa 4 lista para reclamar
      earnedCoins,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { error: null, found: true };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Obtiene todos los referidos para el panel del usuario
 */
export async function getReferralsByReferrer(referrerCode) {
  try {
    if (!referrerCode) return { data: [], error: null };
    
    const q = query(
      collection(db, REFERRALS_COLLECTION), 
      where('referrerCode', '==', referrerCode)
    );
    const snapshot = await getDocs(q);
    
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    // Ordenar manualmente porque orderBy requiere index en Firestore si combinamos con where
    .sort((a, b) => {
      const aTime = a.clickedAt?.toMillis() || a.createdAt?.toMillis() || 0;
      const bTime = b.clickedAt?.toMillis() || b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });

    return { data, error: null };
  } catch (error) {
    return { data: [], error: error.message };
  }
}

/**
 * Reclama las monedas de un referido (Etapa 4 -> Finalizado/Reclamado)
 */
export async function claimReferralCoins(referralId, earnedCoins, uid, currentMonedas = 0) {
  try {
    // 1. Actualizar el doc del referido a 'claimed'
    const docRef = doc(db, REFERRALS_COLLECTION, referralId);
    await updateDoc(docRef, {
      status: 'claimed',
      claimedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2. Sumar monedas al perfil
    await setDocument('portal_users', uid, {
      monedas: currentMonedas + earnedCoins,
      updatedAt: serverTimestamp()
    });

    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Permite editar el código de referido por única vez.
 */
export async function updateReferralCode(uid, newCode) {
  try {
    const cleanCode = newCode.trim().toUpperCase();
    
    // Verificar que no esté en uso
    const q = query(collection(db, 'portal_users'), where('referralCode', '==', cleanCode));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { error: 'El código ya está en uso' };
    }
    
    await setDocument('portal_users', uid, {
      referralCode: cleanCode,
      referralCodeEdited: true,
      updatedAt: serverTimestamp()
    });
    
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Obtiene el ranking Top 10 del mes actual
 */
export async function getTopReferrersOfMonth() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const q = query(
      collection(db, REFERRALS_COLLECTION),
      where('status', 'in', ['completed', 'claimed']),
      where('completedAt', '>=', Timestamp.fromDate(startOfMonth))
    );
    
    const snapshot = await getDocs(q);
    
    // Agrupar por código de referido
    const userStats = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const code = data.referrerCode;
      if (!userStats[code]) {
        userStats[code] = { referrerCode: code, count: 0, coins: 0 };
      }
      userStats[code].count += 1;
      userStats[code].coins += data.earnedCoins || 0;
    });
    
    // Ordenar y tomar Top 10
    const top10 = Object.values(userStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
      
    return { data: top10, error: null };
  } catch (error) {
    return { data: [], error: error.message };
  }
}
