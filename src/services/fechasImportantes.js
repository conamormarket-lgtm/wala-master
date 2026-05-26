import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';

export const getUniversalDates = async () => {
  try {
    const snap = await getDocs(collection(db, 'universal_dates'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching universal dates:', error);
    return [];
  }
};

export const addUniversalDate = async (dateData) => {
  try {
    const docRef = await addDoc(collection(db, 'universal_dates'), dateData);
    return { id: docRef.id, ...dateData };
  } catch (error) {
    console.error('Error adding universal date:', error);
    throw error;
  }
};

export const deleteUniversalDate = async (id) => {
  try {
    await deleteDoc(doc(db, 'universal_dates', id));
  } catch (error) {
    console.error('Error deleting universal date:', error);
    throw error;
  }
};

export const getUserDates = async () => {
  try {
    const usersSnap = await getDocs(collection(db, PORTAL_USERS_COLLECTION));
    const dates = [];
    
    usersSnap.forEach(userDoc => {
      const userData = userDoc.data();
      if (userData.giftRecipients && Array.isArray(userData.giftRecipients)) {
        userData.giftRecipients.forEach(recipient => {
          if (recipient.events && Array.isArray(recipient.events)) {
            recipient.events.forEach(event => {
              dates.push({
                userId: userDoc.id,
                userEmail: userData.email || 'Sin correo',
                recipientId: recipient.id,
                recipientName: recipient.name || 'Sin nombre',
                recipientRole: recipient.roleDisplay || 'Otro',
                recipientGender: recipient.gender,
                selectedCategories: recipient.selectedCategories || [],
                categoryAnswers: recipient.categoryAnswers || {},
                familySet: recipient.familySet || false,
                familyAnswers: recipient.familyAnswers || {},
                eventId: event.id,
                eventType: event.type,
                eventDate: event.date // formato YYYY-MM-DD
              });
            });
          }
        });
      }
    });
    
    return dates;
  } catch (error) {
    console.error('Error fetching user dates:', error);
    return [];
  }
};

export const getOrganizableEvents = async () => {
  try {
    const snap = await getDocs(collection(db, 'organizable_events'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching organizable events:', error);
    return [];
  }
};

export const saveOrganizableEvent = async (eventData, id = null) => {
  try {
    if (id) {
      await setDoc(doc(db, 'organizable_events', id), eventData);
      return { id, ...eventData };
    } else {
      const docRef = await addDoc(collection(db, 'organizable_events'), eventData);
      return { id: docRef.id, ...eventData };
    }
  } catch (error) {
    console.error('Error saving organizable event:', error);
    throw error;
  }
};

export const deleteOrganizableEvent = async (id) => {
  try {
    await deleteDoc(doc(db, 'organizable_events', id));
  } catch (error) {
    console.error('Error deleting organizable event:', error);
    throw error;
  }
};

export const saveSuggestedPackage = async (packageData) => {
  try {
    packageData.createdAt = new Date().toISOString();
    const docRef = await addDoc(collection(db, 'suggested_packages'), packageData);
    return { id: docRef.id, ...packageData };
  } catch (error) {
    console.error('Error saving suggested package:', error);
    throw error;
  }
};
