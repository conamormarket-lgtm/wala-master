import { collection, addDoc, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase/config';

const COLLECTION = 'inventoryLogs';

export const logInventoryChange = async (productId, productName, oldStock, newStock, userEmail) => {
  try {
    await addDoc(collection(db, COLLECTION), {
      productId,
      productName,
      oldStock,
      newStock,
      userEmail: userEmail || 'Desconocido',
      timestamp: Timestamp.now().toMillis()
    });
  } catch (error) {
    console.error("Error logging inventory change:", error);
  }
};

export const getInventoryLogs = async () => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching inventory logs:", error);
    return [];
  }
};
