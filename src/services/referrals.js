import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  // eslint-disable-next-line no-unused-vars
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

const REFERRALS_COLLECTION = 'referrals';

/**
 * Estimado de cuántas monedas gana el referente por un pedido de este monto:
 * 5% si es S/200 o menos, 10% si supera los S/200 (1 moneda = S/1).
 *
 * SOLO para mostrar un número antes de reclamar (AdminReferidos y
 * CuentaReferidosPage). El monto real que se paga lo decide el backend
 * (claimReferralSecure en functions/index.js, misma fórmula) a partir del
 * monto validado contra el ERP — nunca de este cálculo del cliente.
 */
export function estimateReferralReward(montoTotal) {
  const monto = Number(montoTotal) || 0;
  if (monto <= 0) return 0;
  const tasa = monto > 200 ? 0.10 : 0.05;
  return Math.round(monto * tasa);
}

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
export async function claimReferralCoins(referralId) {
  // H-06: el reclamo (marcar 'claimed' + acreditar monedas) se hace server-side en
  // transacción (callable claimReferralSecure), validando propiedad y estado. Se
  // ignoran earnedCoins/currentMonedas que antes venían del cliente (falsificables).
  // El monto real (5%/10% del pedido según claimReferralSecure) viene en la
  // respuesta — se devuelve para que la UI muestre lo que de verdad se pagó,
  // no un estimado.
  try {
    const result = await httpsCallable(getFunctions(), 'claimReferralSecure')({ referralId });
    return { earned: result?.data?.earned ?? null, error: null };
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
