import { db } from './firebase/config';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

const COLLECTION_NAME = 'cuestionarios_templates';

const DEFAULT_TEMPLATE = {
  name: 'Plantilla de Venta Completa',
  fields: [
    {
      id: `field_${Date.now()}_nombre`,
      label: 'Nombre y Apellidos completos',
      type: 'text',
      required: true
    },
    {
      id: `field_${Date.now()}_cel`,
      label: 'Número de Celular / WhatsApp',
      type: 'text',
      required: true
    },
    {
      id: `field_${Date.now()}_dni`,
      label: 'Número de DNI',
      type: 'text',
      required: true
    },
    {
      id: `field_${Date.now()}_dir`,
      label: 'Dirección exacta (Calle, número, distrito)',
      type: 'text',
      required: true
    },
    {
      id: `field_${Date.now()}_extra1`,
      label: '¿Qué nombre o iniciales deseas grabar/estampar?',
      type: 'text',
      required: false
    },
    {
      id: `field_${Date.now()}_extra2`,
      label: 'Mensaje corto para dedicatoria (Opcional)',
      type: 'textarea',
      required: false
    }
  ]
};

export const getCuestionariosTemplates = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const templates = [];
    querySnapshot.forEach((docSnap) => {
      templates.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (templates.length === 0) {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...DEFAULT_TEMPLATE,
        createdAt: new Date().toISOString()
      });
      templates.push({ id: docRef.id, ...DEFAULT_TEMPLATE });
    }

    return { data: templates, error: null };
  } catch (error) {
    console.error('Error fetching cuestionario templates:', error);
    return { data: null, error: error.message };
  }
};

export const getCuestionarioTemplate = async (id) => {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (docSnap.exists()) {
      return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
    } else {
      return { data: null, error: 'Document not found' };
    }
  } catch (error) {
    console.error('Error fetching cuestionario template:', error);
    return { data: null, error: error.message };
  }
};

export const createCuestionarioTemplate = async (templateData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...templateData,
      createdAt: new Date().toISOString()
    });
    return { data: docRef.id, error: null };
  } catch (error) {
    console.error('Error creating cuestionario template:', error);
    return { data: null, error: error.message };
  }
};

export const updateCuestionarioTemplate = async (id, templateData) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...templateData,
      updatedAt: new Date().toISOString()
    });
    return { data: true, error: null };
  } catch (error) {
    console.error('Error updating cuestionario template:', error);
    return { data: null, error: error.message };
  }
};

export const deleteCuestionarioTemplate = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return { data: true, error: null };
  } catch (error) {
    console.error('Error deleting cuestionario template:', error);
    return { data: null, error: error.message };
  }
};
